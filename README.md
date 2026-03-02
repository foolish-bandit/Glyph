# Glyph — Legal Symbol Picker

A Chrome extension that puts 30 legal and typographic symbols one click away from any text field.

![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## What It Does

Glyph adds a small floating button next to any text input, textarea, or contenteditable field. Click it (or press `Ctrl+Shift+G` / `⌘+Shift+G`) to open a panel with commonly needed symbols:

**Legal:** § ¶ † ‡ © ® ™ ℠  
**Punctuation:** — – " " ' ' « » … •  
**Math/Logic:** ∴ ∵ ≈ ≠ ≤ ≥ ± × ÷  
**Currency & Other:** € £ ¥ ° ¢

Symbols insert directly at your cursor position. No copy-paste required.

## Features

- **Floating trigger button** — appears on text field focus, stays out of the way
- **Search & filter** — type to find symbols by name or keyword
- **Recently used** — your most-used symbols surface to the top
- **Keyboard shortcut** — `Ctrl+Shift+G` (Windows/Linux) or `⌘+Shift+G` (Mac)
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

1. Click into any text field on any website
2. A small **G.** button appears near the field
3. Click the button or press `Ctrl+Shift+G`
4. Click any symbol to insert it at your cursor
5. Use the search bar to filter by name (e.g., "section", "copyright", "dash")

## Permissions

- **`storage`** — saves your recently-used symbols locally (via `chrome.storage.local`)
- **`<all_urls>`** — content script needs to run on all pages to detect text fields

No data leaves your browser. No analytics. No network requests.

## Project Structure

```
├── manifest.json      # Extension manifest (V3)
├── content.js         # Content script — trigger button, symbol panel, insertion logic
├── background.js      # Service worker — handles keyboard shortcut commands
├── popup.html         # Extension popup (quick-reference)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Tech

- Manifest V3
- Shadow DOM for style isolation
- `execCommand('insertText')` with `selectionStart`/clipboard fallback for insertion
- `chrome.storage.local` for recently-used tracking
- Zero dependencies

## License

MIT

---

Built by [Zack](https://github.com/YOUR_USERNAME) • Part of the [Sonomos](https://sonomos.io) ecosystem
