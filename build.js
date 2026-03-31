#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, 'content');
const INDEX_FILE = path.join(__dirname, 'index.html');
const START = '/*--BOOKS-START--*/';
const END = '/*--BOOKS-END--*/';

// ── Helpers ──────────────────────────────────────────

function q(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function inlineFormat(text) {
  text = text.replace(/&/g, '&amp;');
  text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  text = text.replace(/==([\s\S]*?)==/g, '<span class="hl">$1</span>');
  text = text.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\{br\}/g, '<br>');
  return text;
}

// ── Parsers ──────────────────────────────────────────

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('Missing frontmatter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (/^["']/.test(val) && val[0] === val[val.length - 1]) val = val.slice(1, -1);
    if (/^\d+$/.test(val)) val = Number(val);
    meta[key] = val;
  }
  return { meta, body: m[2] };
}

function parseBody(body) {
  const lines = body.split('\n');
  const pages = [];
  const chapterMeta = [];
  let ch = -1, sec = '', subsec = '', html = '';
  let lastHeading = false;

  function flush() {
    if (html) {
      pages.push({ ch, sec, subsec: subsec || undefined, html });
      html = '';
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;

    // Page break
    if (trimmed === '---') { html += '<div class="pb"></div>'; lastHeading = false; continue; }

    // Chapter: # Label | Title
    if (/^# /.test(trimmed) && !/^## /.test(trimmed)) {
      if (!lastHeading) flush();
      ch++;
      const content = trimmed.slice(2);
      const pipe = content.indexOf('|');
      const label = pipe >= 0 ? content.slice(0, pipe).trim() : content.trim();
      const title = pipe >= 0 ? content.slice(pipe + 1).trim() : '';
      chapterMeta.push({ label, title });
      sec = ''; subsec = '';
      html += '<div class="lbl">' + label + '</div>';
      if (title) html += '<h2>' + inlineFormat(title) + '</h2>';
      html += '<div class="dl"></div>';
      lastHeading = true;
      continue;
    }

    // Section: ## Title
    if (/^## /.test(trimmed) && !/^### /.test(trimmed)) {
      const consecutive = lastHeading;
      if (!lastHeading) flush();
      sec = trimmed.slice(3).trim();
      subsec = '';
      html += '<h3>' + inlineFormat(sec) + '</h3>';
      if (!consecutive) html += '<div class="dl"></div>';
      lastHeading = true;
      continue;
    }

    // Subsection: ### Title
    if (/^### /.test(trimmed)) {
      if (!lastHeading) flush();
      subsec = trimmed.slice(4).trim();
      html += '<p class="lbl">' + inlineFormat(subsec) + '</p>';
      lastHeading = true;
      continue;
    }

    lastHeading = false;

    // Blockquote
    if (/^> /.test(trimmed)) {
      html += '<p class="qt">' + inlineFormat(trimmed.slice(2)) + '</p>';
      continue;
    }

    // Keyword block
    if (trimmed === '{kw}') {
      const parts = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '{/kw}') {
        parts.push(inlineFormat(lines[i].trim()));
        i++;
      }
      html += '<div class="kw">' + parts.join('<br>') + '</div>';
      continue;
    }

    // Fin marker
    if (trimmed === '{fin}') {
      html += '<div class="dl c"></div><div class="fin">fin.</div>';
      continue;
    }

    // Regular paragraph
    html += '<p>' + inlineFormat(trimmed) + '</p>';
  }

  flush();
  return { pages, chapterMeta };
}

// ── Chapter derivation ───────────────────────────────

function deriveChapters(pages, chapterMeta) {
  const chapters = [];
  let prevCh = -1;

  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    if (pg.ch !== prevCh) {
      prevCh = pg.ch;
      const m = chapterMeta[pg.ch] || { label: '', title: '' };
      chapters.push({ label: m.label, title: m.title, startPage: i + 1, _secs: [] });
    }

    const ch = chapters[chapters.length - 1];
    if (!pg.sec) continue;

    let entry = ch._secs.find(s => (typeof s === 'object' ? s.t : s) === pg.sec);
    if (!entry) {
      if (pg.subsec) {
        entry = { t: pg.sec, sub: [pg.subsec] };
        ch._secs.push(entry);
      } else {
        ch._secs.push(pg.sec);
      }
    } else if (pg.subsec && typeof entry === 'object') {
      if (!entry.sub.includes(pg.subsec)) entry.sub.push(pg.subsec);
    }
  }

  for (const ch of chapters) {
    const hasObj = ch._secs.some(s => typeof s === 'object');
    ch.sections = hasObj
      ? ch._secs.map(s => typeof s === 'string' ? { t: s } : s)
      : ch._secs;
    delete ch._secs;
  }
  return chapters;
}

// ── Serialization ────────────────────────────────────

function serializeSections(secs) {
  if (!secs || !secs.length) return null;
  if (typeof secs[0] === 'string') return '[' + secs.map(q).join(',') + ']';
  return '[' + secs.map(s => {
    let str = '{t:' + q(s.t);
    if (s.sub && s.sub.length) str += ',sub:[' + s.sub.map(q).join(',') + ']';
    return str + '}';
  }).join(',') + ']';
}

function serializeBooks(allBooks) {
  const entries = allBooks.map(b => {
    const ct = (b.meta.coverTitle || b.meta.title).replace(/\\n/g, '<br>');
    const chStr = b.chapters.map(c => {
      let s = '{label:' + q(c.label) + ',title:' + q(c.title) + ',startPage:' + c.startPage;
      const ss = serializeSections(c.sections);
      if (ss) s += ',sections:' + ss;
      return s + '}';
    }).join(',\n');

    const pgStr = b.pages.map(p => {
      let s = '{ch:' + p.ch + ',sec:' + q(p.sec || '');
      if (p.subsec) s += ',subsec:' + q(p.subsec);
      return s + ',html:`' + p.html + '`}';
    }).join(',\n');

    return "'" + b.id + "':{title:" + q(b.meta.title) + ',date:' + q(b.meta.date) +
      ",theme:'" + b.meta.theme + "',coverTitle:" + q(ct) + ',coverSub:' + q(b.meta.coverSub) +
      ',\nchapters:[\n' + chStr + '\n],\npages:[\n' + pgStr + '\n]}';
  });

  return 'const books={\n' + entries.join(',\n\n') + '\n};';
}

// ── Main ─────────────────────────────────────────────

function main() {
  const mdFiles = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).sort();
  const allBooks = [];

  for (const file of mdFiles) {
    const id = path.basename(file, '.md');
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8');
    const { meta, body } = parseFrontmatter(raw);
    const { pages, chapterMeta } = parseBody(body);
    const chapters = deriveChapters(pages, chapterMeta);
    allBooks.push({ id, meta, chapters, pages });
  }

  allBooks.sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0));
  const booksJs = serializeBooks(allBooks);

  let html = fs.readFileSync(INDEX_FILE, 'utf-8');
  const si = html.indexOf(START);
  const ei = html.indexOf(END);
  if (si < 0 || ei < 0) throw new Error('Markers not found in index.html');

  html = html.slice(0, si) + START + '\n' + booksJs + '\n' + html.slice(ei);
  fs.writeFileSync(INDEX_FILE, html, 'utf-8');
  console.log('Built ' + allBooks.length + ' book(s): ' + allBooks.map(b => b.id).join(', '));
}

main();
