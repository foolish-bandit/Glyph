# GLYPH

A Chrome extension that puts 30 legal and typographic symbols one click away from any text field.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](#install)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

## What It Does

Glyph docks a small tab to the edge of every page. It's always there — drag it up or down to reposition it along the edge, drag it past the center of the page to snap it to the other side, or click it (or press `Ctrl+Shift+G` / `⌘+Shift+G`) to open a panel with commonly needed symbols:

**Legal:** § ¶ † ‡ © ® ™ ℠
**Punctuation:** — – " " ' ' « » … •
**Math/Logic:** ∴ ∵ ≈ ≠ ≤ ≥ ± × ÷
**Currency & Other:** € £ ¥ ° ¢

Symbols insert directly at your cursor position when a text field is focused, and fall back to copying to the clipboard otherwise. No copy-paste gymnastics required.

## Features

- **Always-on edge tab** — a thin tab hangs on the side of every page, out of the way but always one click away
- **Drag to reposition** — drag the tab up or down to move it along the edge; drag across the page to snap it to the left or right side. Position is remembered across sites and sessions
- **Search & filter** — type to find symbols by name or keyword
- **Recently used** — your most-used symbols surface to the top
- **Keyboard-first** — `Ctrl+Shift+G` opens the panel, arrow keys walk the grid, `Enter` inserts, `Esc` closes. The edge tab itself is tab-focusable
- **Hides when you don't want it** — the tab disappears in fullscreen video and when printing
- **Works everywhere** — Gmail, Google Docs, Clio, CRMs, any web-based text field
- **Shadow DOM isolation** — won't break or be broken by page styles
- **Dark theme** — designed for long sessions

## Install

### From source (developer mode)

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the repo folder
5. Pin the extension from the puzzle-piece menu if desired

### Keyboard shortcut setup

The shortcut should work automatically. If not, go to `chrome://extensions/shortcuts` and assign `Ctrl+Shift+G` to the "Toggle Glyph panel" command.

## Usage

1. Open any web page — the Glyph tab docks itself to the edge
2. Click the tab (or press `Ctrl+Shift+G`) to open the symbol panel
3. Click any symbol to insert it at your cursor, or to copy it if no field is focused
4. Drag the tab up or down along the edge to move it; drag across the page to snap to the other side
5. Use the search bar to filter by name (e.g., "section", "copyright", "dash")

## Permissions

- **`storage`** — saves your recently-used symbols and tab position locally (via `chrome.storage.local`)
- **`<all_urls>`** — content script needs to run on all pages to render the edge tab

No data leaves your browser. No analytics. No network requests.

## Project Structure
├── manifest.json      # Extension manifest (V3)
├── content.js         # Content script — trigger button, symbol panel, insertion logic
├── background.js      # Service worker — handles keyboard shortcut commands
├── popup.html         # Extension popup (quick-reference)
└── icons/
├── icon16.png
├── icon48.png
└── icon128.png

## Tech

- Manifest V3
- Shadow DOM for style isolation
- `execCommand('insertText')` with `selectionStart`/clipboard fallback for insertion
- `chrome.storage.local` for recently-used tracking
- Zero dependencies

## Roadmap

- [ ] Chrome Web Store listing
- [ ] Firefox/Edge ports
- [ ] Custom symbol sets (user-defined)
- [ ] Bluebook-specific symbol presets
- [ ] Snippet expansion (e.g., type `\sec` → §)

## License

MIT

---

Built by [Zack Brenner](https://github.com/foolish-bandit)
