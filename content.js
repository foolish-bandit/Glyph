(() => {
  // Prevent double-injection
  if (window.__glyphInjected) return;
  window.__glyphInjected = true;

  // Only render the persistent sidebar in the top frame — iframes still run
  // the script so focus tracking stays cheap, but they won't create a UI.
  const IS_TOP_FRAME = window === window.top;

  // ─── Character Data ─────────────────────────────────────────────
  const CHARACTERS = [
    { char: '§', name: 'Section', shortcut: 'Alt+0167' },
    { char: '¶', name: 'Pilcrow / Paragraph', shortcut: 'Alt+0182' },
    { char: '†', name: 'Dagger', shortcut: 'Alt+0134' },
    { char: '‡', name: 'Double Dagger', shortcut: 'Alt+0135' },
    { char: '©', name: 'Copyright', shortcut: 'Alt+0169' },
    { char: '®', name: 'Registered', shortcut: 'Alt+0174' },
    { char: '™', name: 'Trademark', shortcut: 'Alt+0153' },
    { char: '℠', name: 'Service Mark', shortcut: '' },
    { char: '№', name: 'Numero', shortcut: '' },
    { char: '⁋', name: 'Reversed Pilcrow', shortcut: '' },
    { char: '°', name: 'Degree', shortcut: 'Alt+0176' },
    { char: '—', name: 'Em Dash', shortcut: 'Alt+0151' },
    { char: '–', name: 'En Dash', shortcut: 'Alt+0150' },
    { char: '“', name: 'Left Double Quote', shortcut: 'Alt+0147' },
    { char: '”', name: 'Right Double Quote', shortcut: 'Alt+0148' },
    { char: '‘', name: 'Left Single Quote', shortcut: 'Alt+0145' },
    { char: '’', name: 'Right Single Quote', shortcut: 'Alt+0146' },
    { char: '«', name: 'Left Guillemet', shortcut: 'Alt+0171' },
    { char: '»', name: 'Right Guillemet', shortcut: 'Alt+0187' },
    { char: '…', name: 'Ellipsis', shortcut: 'Alt+0133' },
    { char: '•', name: 'Bullet', shortcut: 'Alt+0149' },
    { char: '∴', name: 'Therefore', shortcut: '' },
    { char: '∵', name: 'Because', shortcut: '' },
    { char: '¿', name: 'Inverted Question', shortcut: 'Alt+0191' },
    { char: '¡', name: 'Inverted Exclamation', shortcut: 'Alt+0161' },
    { char: '×', name: 'Multiplication', shortcut: 'Alt+0215' },
    { char: '÷', name: 'Division', shortcut: 'Alt+0247' },
    { char: '±', name: 'Plus-Minus', shortcut: 'Alt+0177' },
    { char: '≠', name: 'Not Equal', shortcut: '' },
    { char: '≈', name: 'Approximately', shortcut: '' },
  ];

  const MAX_RECENT = 8;
  const STORAGE_RECENT = 'glyphRecent';
  const STORAGE_POSITION = 'glyphTriggerPosition';
  const DRAG_THRESHOLD = 5;

  let recentChars = [];
  let activeField = null;
  let panelVisible = false;
  let triggerEl = null;
  let panelEl = null;
  let shadowHost = null;
  let shadowRoot = null;

  // Docking position — side ('left' or 'right') and vertical ratio (0..1).
  let triggerPos = { side: 'right', topRatio: 0.5 };

  // ─── Storage ────────────────────────────────────────────────────
  try {
    chrome.storage.local.get([STORAGE_RECENT, STORAGE_POSITION], (result) => {
      if (result[STORAGE_RECENT]) recentChars = result[STORAGE_RECENT];
      if (result[STORAGE_POSITION]) {
        const stored = result[STORAGE_POSITION];
        if (stored.side === 'left' || stored.side === 'right') {
          triggerPos.side = stored.side;
        }
        if (typeof stored.topRatio === 'number' && stored.topRatio >= 0 && stored.topRatio <= 1) {
          triggerPos.topRatio = stored.topRatio;
        }
      }
      if (IS_TOP_FRAME) applyTriggerPosition();
    });
  } catch (e) {}

  function saveRecent() {
    try { chrome.storage.local.set({ [STORAGE_RECENT]: recentChars }); } catch (e) {}
  }

  function savePosition() {
    try { chrome.storage.local.set({ [STORAGE_POSITION]: triggerPos }); } catch (e) {}
  }

  function addToRecent(char) {
    recentChars = recentChars.filter(c => c !== char);
    recentChars.unshift(char);
    if (recentChars.length > MAX_RECENT) recentChars.pop();
    saveRecent();
  }

  const LOGO_URL = typeof chrome !== 'undefined' && chrome.runtime
    ? chrome.runtime.getURL('icons/icon48.png')
    : null;

  // ─── Shadow DOM ─────────────────────────────────────────────────
  function initShadowDOM() {
    if (shadowHost) return;
    shadowHost = document.createElement('div');
    shadowHost.id = '__glyph-ext-host';
    shadowHost.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }

      .glyph-trigger {
        position: fixed;
        width: 34px;
        height: 48px;
        background: #1a1a1a;
        border: 1px solid #333;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 0.2s ease, background 0.15s ease, border-color 0.15s ease, width 0.15s ease, box-shadow 0.15s ease;
        z-index: 2147483647;
        user-select: none;
        touch-action: none;
        -webkit-user-select: none;
      }
      .glyph-trigger.visible {
        opacity: 0.78;
      }
      .glyph-trigger:hover {
        opacity: 1;
        border-color: #f0b429;
        background: #222;
        width: 38px;
      }
      .glyph-trigger.dragging {
        cursor: grabbing;
        opacity: 1;
        border-color: #f0b429;
        box-shadow: 0 6px 20px rgba(0,0,0,0.6);
      }
      .glyph-trigger-right {
        right: 0;
        border-radius: 10px 0 0 10px;
        border-right: none;
        box-shadow: -3px 2px 12px rgba(0,0,0,0.35);
      }
      .glyph-trigger-left {
        left: 0;
        border-radius: 0 10px 10px 0;
        border-left: none;
        box-shadow: 3px 2px 12px rgba(0,0,0,0.35);
      }
      .glyph-trigger img {
        width: 22px;
        height: 22px;
        border-radius: 5px;
        pointer-events: none;
      }
      .glyph-trigger .fallback-icon {
        font-size: 20px;
        color: #f0b429;
        font-family: Georgia, 'Times New Roman', serif;
        font-weight: bold;
        line-height: 1;
        pointer-events: none;
      }

      .glyph-panel {
        position: fixed;
        width: 268px;
        background: #141414;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
        pointer-events: auto;
        opacity: 0;
        transform: translateY(4px) scale(0.96);
        transition: opacity 0.15s ease, transform 0.15s ease;
        z-index: 2147483647;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .glyph-panel.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .glyph-search {
        width: 100%;
        padding: 10px 12px;
        background: #1a1a1a;
        border: none;
        border-bottom: 1px solid #222;
        color: #e0e0e0;
        font-size: 12px;
        outline: none;
        font-family: inherit;
      }
      .glyph-search::placeholder { color: #555; }
      .glyph-search:focus { background: #1e1e1e; }

      .glyph-section-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: #555;
        padding: 8px 10px 4px;
        font-family: inherit;
      }

      .glyph-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        padding: 4px 6px 8px;
      }

      .glyph-cell {
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        cursor: pointer;
        font-size: 17px;
        color: #d0d0d0;
        background: transparent;
        border: 1px solid transparent;
        transition: all 0.1s ease;
        font-family: Georgia, 'Times New Roman', 'Noto Serif', serif;
        position: relative;
        pointer-events: auto;
      }
      .glyph-cell:hover {
        background: rgba(240,180,41,0.12);
        border-color: rgba(240,180,41,0.3);
        color: #f0b429;
        transform: scale(1.1);
      }
      .glyph-cell.highlight {
        background: rgba(240,180,41,0.2);
        border-color: rgba(240,180,41,0.5);
      }

      .glyph-tooltip {
        position: fixed;
        background: #222;
        color: #ccc;
        font-size: 11px;
        padding: 6px 10px;
        border-radius: 6px;
        pointer-events: none;
        white-space: nowrap;
        z-index: 2147483648;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0;
        transition: opacity 0.1s ease;
      }
      .glyph-tooltip.visible { opacity: 1; }
      .glyph-tooltip .shortcut {
        color: #f0b429;
        margin-left: 6px;
        font-size: 10px;
      }

      .glyph-footer {
        padding: 6px 10px 8px;
        border-top: 1px solid #222;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .glyph-brand {
        font-size: 9px;
        color: #444;
        letter-spacing: 0.5px;
        font-family: inherit;
      }
      .glyph-shortcut-hint {
        font-size: 9px;
        color: #444;
        font-family: inherit;
      }
      .glyph-shortcut-hint kbd {
        background: #222;
        border: 1px solid #333;
        border-radius: 3px;
        padding: 1px 4px;
        font-size: 9px;
        color: #666;
        font-family: inherit;
      }

      .glyph-clipboard-flash {
        position: fixed;
        background: #1a1a1a;
        border: 1px solid #f0b429;
        color: #f0b429;
        font-size: 11px;
        padding: 6px 10px;
        border-radius: 6px;
        pointer-events: none;
        z-index: 2147483648;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .glyph-clipboard-flash.visible { opacity: 1; }
    `;
    shadowRoot.appendChild(style);
  }

  // ─── Trigger ────────────────────────────────────────────────────
  function createTrigger() {
    if (triggerEl) return;
    initShadowDOM();

    triggerEl = document.createElement('div');
    triggerEl.className = 'glyph-trigger glyph-trigger-' + triggerPos.side;
    triggerEl.setAttribute('role', 'button');
    triggerEl.setAttribute('aria-label', 'Glyph — legal symbol picker (drag to move, click to open)');
    triggerEl.title = 'Glyph — drag up/down to move, click to open';

    if (LOGO_URL) {
      const img = document.createElement('img');
      img.src = LOGO_URL;
      img.alt = 'Glyph';
      img.draggable = false;
      img.onerror = () => {
        img.remove();
        const span = document.createElement('span');
        span.className = 'fallback-icon';
        span.textContent = '§';
        triggerEl.appendChild(span);
      };
      triggerEl.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.className = 'fallback-icon';
      span.textContent = '§';
      triggerEl.appendChild(span);
    }

    // Drag-vs-click handling
    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let startTop = 0;
    let hasDragged = false;

    triggerEl.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      pointerDown = true;
      hasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = triggerEl.getBoundingClientRect();
      startTop = rect.top;
      try { triggerEl.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });

    triggerEl.addEventListener('pointermove', (e) => {
      if (!pointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!hasDragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasDragged = true;
        triggerEl.classList.add('dragging');
        if (panelVisible) hidePanel();
      }
      if (hasDragged) {
        const vh = window.innerHeight;
        const h = triggerEl.offsetHeight || 48;
        let newTop = startTop + dy;
        newTop = Math.max(8, Math.min(vh - h - 8, newTop));
        triggerEl.style.top = newTop + 'px';
        triggerEl.style.bottom = 'auto';
        triggerPos.topRatio = newTop / vh;

        // Snap to whichever side the cursor is closer to
        const newSide = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
        if (newSide !== triggerPos.side) {
          triggerPos.side = newSide;
          triggerEl.classList.remove('glyph-trigger-left', 'glyph-trigger-right');
          triggerEl.classList.add('glyph-trigger-' + newSide);
        }
      }
    });

    function endPointer(e) {
      if (!pointerDown) return;
      pointerDown = false;
      try { triggerEl.releasePointerCapture(e.pointerId); } catch (_) {}
      triggerEl.classList.remove('dragging');
      if (hasDragged) {
        savePosition();
      } else {
        if (panelVisible) hidePanel();
        else showPanel();
      }
    }
    triggerEl.addEventListener('pointerup', endPointer);
    triggerEl.addEventListener('pointercancel', endPointer);

    // Suppress the synthetic click that follows pointerup — we already handled it.
    triggerEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    shadowRoot.appendChild(triggerEl);
  }

  function applyTriggerPosition() {
    if (!triggerEl) return;
    triggerEl.classList.remove('glyph-trigger-left', 'glyph-trigger-right');
    triggerEl.classList.add('glyph-trigger-' + triggerPos.side);
    const vh = window.innerHeight;
    const h = triggerEl.offsetHeight || 48;
    let top = triggerPos.topRatio * vh;
    top = Math.max(8, Math.min(vh - h - 8, top));
    triggerEl.style.top = top + 'px';
    triggerEl.style.bottom = 'auto';
  }

  // ─── Panel ──────────────────────────────────────────────────────
  function createPanel() {
    if (panelEl) return;

    panelEl = document.createElement('div');
    panelEl.className = 'glyph-panel';

    const search = document.createElement('input');
    search.className = 'glyph-search';
    search.type = 'text';
    search.placeholder = 'Search symbols…';
    search.addEventListener('input', () => filterChars(search.value));
    search.addEventListener('keydown', (e) => e.stopPropagation());
    panelEl.appendChild(search);

    const recentLabel = document.createElement('div');
    recentLabel.className = 'glyph-section-label';
    recentLabel.textContent = 'Recent';
    recentLabel.id = 'glyph-recent-label';
    panelEl.appendChild(recentLabel);

    const recentGrid = document.createElement('div');
    recentGrid.className = 'glyph-grid';
    recentGrid.id = 'glyph-recent-grid';
    panelEl.appendChild(recentGrid);

    const allLabel = document.createElement('div');
    allLabel.className = 'glyph-section-label';
    allLabel.textContent = 'All Symbols';
    panelEl.appendChild(allLabel);

    const allGrid = document.createElement('div');
    allGrid.className = 'glyph-grid';
    allGrid.id = 'glyph-all-grid';
    panelEl.appendChild(allGrid);

    const footer = document.createElement('div');
    footer.className = 'glyph-footer';
    footer.innerHTML = `
      <span class="glyph-brand">GLYPH</span>
      <span class="glyph-shortcut-hint"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd></span>
    `;
    panelEl.appendChild(footer);

    const tooltip = document.createElement('div');
    tooltip.className = 'glyph-tooltip';
    tooltip.id = 'glyph-tooltip';
    shadowRoot.appendChild(tooltip);

    const flash = document.createElement('div');
    flash.className = 'glyph-clipboard-flash';
    flash.id = 'glyph-clipboard-flash';
    shadowRoot.appendChild(flash);

    shadowRoot.appendChild(panelEl);
    renderAllChars();
  }

  function renderAllChars(filter = '') {
    const allGrid = shadowRoot.getElementById('glyph-all-grid');
    const recentGrid = shadowRoot.getElementById('glyph-recent-grid');
    const recentLabel = shadowRoot.getElementById('glyph-recent-label');

    if (!allGrid) return;

    allGrid.innerHTML = '';
    recentGrid.innerHTML = '';

    const lowerFilter = filter.toLowerCase();

    const filteredRecent = recentChars.filter(c => {
      if (!lowerFilter) return true;
      const data = CHARACTERS.find(ch => ch.char === c);
      return data && data.name.toLowerCase().includes(lowerFilter);
    });

    if (filteredRecent.length > 0 && !filter) {
      recentLabel.style.display = 'block';
      recentGrid.style.display = 'grid';
      filteredRecent.forEach(c => {
        const data = CHARACTERS.find(ch => ch.char === c);
        if (data) recentGrid.appendChild(createCell(data));
      });
    } else {
      recentLabel.style.display = 'none';
      recentGrid.style.display = 'none';
    }

    const filtered = CHARACTERS.filter(ch =>
      !lowerFilter || ch.name.toLowerCase().includes(lowerFilter) || ch.char === lowerFilter
    );

    filtered.forEach(data => {
      const cell = createCell(data);
      if (lowerFilter && data.name.toLowerCase().includes(lowerFilter)) {
        cell.classList.add('highlight');
      }
      allGrid.appendChild(cell);
    });
  }

  function createCell(data) {
    const cell = document.createElement('div');
    cell.className = 'glyph-cell';
    cell.textContent = data.char;

    cell.addEventListener('mouseenter', (e) => showTooltip(e, data));
    cell.addEventListener('mouseleave', hideTooltip);
    // Use mousedown so we insert before the textarea loses focus.
    cell.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      insertChar(data.char);
    });

    return cell;
  }

  function filterChars(query) {
    renderAllChars(query);
  }

  function showTooltip(e, data) {
    const tooltip = shadowRoot.getElementById('glyph-tooltip');
    if (!tooltip) return;

    let html = data.name;
    if (data.shortcut) {
      html += `<span class="shortcut">${data.shortcut}</span>`;
    }
    tooltip.innerHTML = html;

    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 32) + 'px';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    const tooltip = shadowRoot.getElementById('glyph-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  function showClipboardFlash(char) {
    const flash = shadowRoot && shadowRoot.getElementById('glyph-clipboard-flash');
    if (!flash) return;
    flash.textContent = `Copied ${char} to clipboard`;
    const triggerRect = triggerEl.getBoundingClientRect();
    flash.style.top = (triggerRect.top + triggerRect.height / 2 - 14) + 'px';
    if (triggerPos.side === 'right') {
      flash.style.right = (window.innerWidth - triggerRect.left + 8) + 'px';
      flash.style.left = 'auto';
    } else {
      flash.style.left = (triggerRect.right + 8) + 'px';
      flash.style.right = 'auto';
    }
    flash.classList.add('visible');
    clearTimeout(flash._hideTimer);
    flash._hideTimer = setTimeout(() => flash.classList.remove('visible'), 1200);
  }

  // ─── Insertion ──────────────────────────────────────────────────
  function isFieldUsable(el) {
    return el && document.contains(el) && !el.disabled && !el.readOnly;
  }

  function insertChar(char) {
    if (isFieldUsable(activeField)) {
      activeField.focus();

      if (activeField.isContentEditable || document.queryCommandSupported('insertText')) {
        const success = document.execCommand('insertText', false, char);
        if (success) {
          addToRecent(char);
          renderAllChars();
          return;
        }
      }

      if ('selectionStart' in activeField) {
        const start = activeField.selectionStart;
        const end = activeField.selectionEnd;
        const val = activeField.value;
        activeField.value = val.substring(0, start) + char + val.substring(end);
        activeField.selectionStart = activeField.selectionEnd = start + char.length;
        activeField.dispatchEvent(new Event('input', { bubbles: true }));
        activeField.dispatchEvent(new Event('change', { bubbles: true }));
        addToRecent(char);
        renderAllChars();
        return;
      }
    }

    // No focused field — copy so the user can paste wherever they need.
    try {
      navigator.clipboard.writeText(char).then(() => {
        addToRecent(char);
        renderAllChars();
        showClipboardFlash(char);
      }).catch(() => {});
    } catch (_) {}
  }

  // ─── Show / Hide Panel ──────────────────────────────────────────
  function showPanel() {
    if (!triggerEl) return;
    createPanel();

    // Measure after making it momentarily visible to avoid flicker.
    panelEl.style.visibility = 'hidden';
    panelEl.classList.add('visible');
    const panelRect = panelEl.getBoundingClientRect();
    const panelWidth = panelRect.width || 268;
    const panelHeight = panelRect.height || 320;
    panelEl.classList.remove('visible');
    panelEl.style.visibility = '';

    const triggerRect = triggerEl.getBoundingClientRect();
    let left;
    if (triggerPos.side === 'right') {
      left = triggerRect.left - panelWidth - 8;
    } else {
      left = triggerRect.right + 8;
    }
    let top = triggerRect.top + triggerRect.height / 2 - panelHeight / 2;

    if (top < 8) top = 8;
    if (top + panelHeight > window.innerHeight - 8) top = window.innerHeight - panelHeight - 8;
    if (left < 8) left = 8;
    if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;

    panelEl.style.top = top + 'px';
    panelEl.style.left = left + 'px';

    renderAllChars();

    requestAnimationFrame(() => {
      panelEl.classList.add('visible');
    });

    panelVisible = true;

    const searchInput = panelEl.querySelector('.glyph-search');
    if (searchInput) {
      // Only steal focus if the user wasn't mid-typing in a field — otherwise
      // focusing search would break insertion into that field.
      if (!isFieldUsable(activeField)) {
        setTimeout(() => searchInput.focus(), 50);
      }
    }
  }

  function hidePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('visible');
    panelVisible = false;
  }

  // ─── Field Detection ────────────────────────────────────────────
  function isEditableField(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      return ['text', 'search', 'url', 'email', ''].includes(type);
    }
    if (el.isContentEditable) return true;
    if (el.getAttribute && el.getAttribute('role') === 'textbox') return true;
    return false;
  }

  // Track the last editable field that had focus so the panel can insert into
  // it even after focus moves to the picker.
  document.addEventListener('focusin', (e) => {
    if (isEditableField(e.target)) {
      activeField = e.target;
    }
  }, true);

  // ─── Initial Mount (top frame only) ─────────────────────────────
  if (IS_TOP_FRAME) {
    function mount() {
      if (!document.body) {
        setTimeout(mount, 50);
        return;
      }
      createTrigger();
      applyTriggerPosition();
      requestAnimationFrame(() => {
        if (triggerEl) triggerEl.classList.add('visible');
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }

    // Keep the trigger on the edge when the viewport resizes.
    window.addEventListener('resize', () => {
      applyTriggerPosition();
      if (panelVisible) hidePanel();
    });

    // Close panel on outside click (composedPath pierces the shadow DOM).
    document.addEventListener('mousedown', (e) => {
      if (!panelVisible) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(shadowHost)) return;
      hidePanel();
    }, true);

    // ESC closes the panel.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panelVisible) {
        hidePanel();
        if (isFieldUsable(activeField)) activeField.focus();
      }
    }, true);
  }

  // Keyboard shortcut from background service worker.
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (!IS_TOP_FRAME) return;
      if (message && message.action === 'toggle-glyph') {
        if (panelVisible) hidePanel();
        else showPanel();
      }
    });
  } catch (e) {}
})();
