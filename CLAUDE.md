# CLAUDE.md — monthly-essays

Monthly essay collection presented as an interactive bookshelf.
Single HTML file — no build tools, no frameworks.

## Stack
- Vanilla HTML/CSS/JS (single file: `index.html`)
- Google Fonts: Noto Serif KR, Cormorant Garamond, Playfair Display

## Structure
```
monthly-essays/
├── CLAUDE.md
└── index.html      # bookshelf + reader (all-in-one)
```

## Design Decisions
- **Bookshelf metaphor**: shelf scene → book spine click → spread reader
- **Two-panel reader**: left = TOC/nav, right = content (mobile: right only + bottom chapter panel)
- **URL routing**: hash-based (`#book-id/pN`), pushState for open/close, replaceState for page turns
- **Content in JS object**: essays are stored as HTML strings in a `books` object inside `<script>`

## Adding a New Essay
1. Add a new entry to the `books` object with: `title`, `date`, `theme`, `coverTitle`, `coverSub`, `chapters[]`, `pages[]`
2. Add a `<div class="book-spine">` in the shelf HTML
3. Theme colors: `t1` = blue (#8BB4F7), `t2` = gold (#D4B96A) — add new `.tN` CSS for new themes

## Known Limitations
- Content lives inside JS — not SEO-crawlable
- CSS class names are abbreviated (`.rp`, `.ci`, `.cl`) — see inline comments for meaning
- Mobile hides left panel entirely; chapter context via bottom panel only
