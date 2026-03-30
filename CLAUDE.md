# CLAUDE.md — monthly-essays

Monthly essay collection presented as an interactive bookshelf.
Essays authored in Markdown, built into a single HTML file.

## Stack
- Vanilla HTML/CSS/JS (single file: `index.html`)
- Google Fonts: Noto Serif KR, Cormorant Garamond, Playfair Display
- Build: `node build.js` (zero dependencies)

## Structure
```
monthly-essays/
├── content/
│   ├── my-new-os.md        ← Essay 1 (Markdown)
│   └── dot-dot-dot.md      ← Essay 2 (Markdown)
├── build.js                ← Markdown → index.html patcher
├── index.html              ← Built output (single-file deploy)
└── CLAUDE.md
```

## Editing Essays
1. Edit `content/<book-id>.md`
2. Run `node build.js`
3. Open `index.html` or push to deploy

## Markdown Format
- Frontmatter: `title`, `date`, `theme`, `coverTitle`, `coverSub`, `order`
- `# Label | Title` → chapter, `## Section` → section, `### Subsection` → subsection
- `---` → page break (same context), `{fin}` → fin marker
- `==text==` → highlight, `**text**` → bold, `> text` → blockquote
- `{kw}...{/kw}` → keyword block, `{br}` → line break within inline text
- Consecutive headings (no body between them) stack on the same page

## Adding a New Essay
1. Create `content/<book-id>.md` with frontmatter and body
2. Add a `<div class="book-spine">` in the shelf HTML
3. Run `node build.js`
4. Theme colors: `t1` = blue (#8BB4F7), `t2` = gold (#D4B96A) — add new `.tN` CSS for new themes

## Design Decisions
- **Bookshelf metaphor**: shelf scene → book spine click → spread reader
- **Two-panel reader**: left = TOC/nav, right = content (mobile: right only + bottom chapter panel)
- **URL routing**: hash-based (`#book-id/pN`), pushState for open/close, replaceState for page turns
- **Content separation**: Markdown source → build script → patched `index.html` between `/*--BOOKS-START--*/` and `/*--BOOKS-END--*/` markers

## Known Limitations
- Content lives inside JS — not SEO-crawlable
- CSS class names are abbreviated (`.rp`, `.ci`, `.cl`) — see inline comments for meaning
- Mobile hides left panel entirely; chapter context via bottom panel only
