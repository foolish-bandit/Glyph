(() => {
  // Prevent double-injection
  if (window.__glyphInjected) return;
  window.__glyphInjected = true;

  // Skip tiny iframes (e.g., Google Docs' input capture iframe)
  if (window !== window.top) {
    try {
      if (window.innerWidth < 100 || window.innerHeight < 100) return;
    } catch (e) { return; }
  }

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
    { char: '"', name: 'Left Double Quote', shortcut: 'Alt+0147' },
    { char: '"', name: 'Right Double Quote', shortcut: 'Alt+0148' },
    { char: ''', name: 'Left Single Quote', shortcut: 'Alt+0145' },
    { char: ''', name: 'Right Single Quote', shortcut: 'Alt+0146' },
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
  let recentChars = [];
  let activeField = null;
  let panelVisible = false;
  let triggerEl = null;
  let panelEl = null;
  let shadowHost = null;
  let shadowRoot = null;

  // Google Docs detection (main frame only)
  const isGoogleDocs = window.location.hostname === 'docs.google.com' && window === window.top;

  // ─── Load recent from storage ───────────────────────────────────
  try {
    chrome.storage.local.get(['glyphRecent'], (result) => {
      if (result.glyphRecent) recentChars = result.glyphRecent;
    });
  } catch (e) {
    // storage unavailable in some contexts
  }

  function saveRecent() {
    try {
      chrome.storage.local.set({ glyphRecent: recentChars });
    } catch (e) {}
  }

  function addToRecent(char) {
    recentChars = recentChars.filter(c => c !== char);
    recentChars.unshift(char);
    if (recentChars.length > MAX_RECENT) recentChars.pop();
    saveRecent();
  }

  // ─── Logo as data URI (inline SVG fallback with § symbol) ──────
  const LOGO_URL = typeof chrome !== 'undefined' && chrome.runtime
    ? chrome.runtime.getURL('icons/icon48.png')
    : null;

  // ─── Create Shadow DOM Host ─────────────────────────────────────
  function initShadowDOM() {
    if (shadowHost) return;
    shadowHost = document.createElement('div');
    shadowHost.id = '__glyph-ext-host';
    shadowHost.style.cssText = 'all:initial;position:absolute;top:0;left:0;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }

      .glyph-trigger {
        position: fixed;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: #1a1a1a;
        border: 1px solid #333;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        z-index: 2147483647;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      }
      .glyph-trigger.visible {
        opacity: 1;
        transform: scale(1);
      }
      .glyph-trigger:hover {
        border-color: #f0b429;
        box-shadow: 0 2px 12px rgba(240,180,41,0.25);
      }
      .glyph-trigger img {
        width: 18px;
        height: 18px;
        border-radius: 4px;
      }
      .glyph-trigger .fallback-icon {
        font-size: 16px;
        color: #f0b429;
        font-family: Georgia, 'Times New Roman', serif;
        font-weight: bold;
        line-height: 1;
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
    `;
    shadowRoot.appendChild(style);
  }

  // ─── Create Trigger Button ──────────────────────────────────────
  function createTrigger() {
    if (triggerEl) return;
    initShadowDOM();

    triggerEl = document.createElement('div');
    triggerEl.className = 'glyph-trigger';

    // Always use text § — the PNG icons are dark-on-transparent,
    // invisible against the dark trigger background
    const span = document.createElement('span');
    span.className = 'fallback-icon';
    span.textContent = '§';
    triggerEl.appendChild(span);

    triggerEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (panelVisible) {
        hidePanel();
      } else {
        showPanel();
      }
    });

    shadowRoot.appendChild(triggerEl);
  }

  // ─── Position trigger near field ────────────────────────────────
  function positionTrigger(field) {
    if (!triggerEl) return;
    const rect = field.getBoundingClientRect();
    const viewportArea = window.innerWidth * window.innerHeight;
    const fieldArea = rect.width * rect.height;
    const fieldIsHuge = fieldArea > viewportArea * 0.5;
    const fieldIsTiny = rect.width < 10 || rect.height < 10;

    let top, left;

    if (fieldIsHuge || fieldIsTiny) {
      // Use caret position for oversized or undersized fields
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const caretRect = range.getBoundingClientRect();
        if (caretRect && (caretRect.top !== 0 || caretRect.left !== 0)) {
          top = caretRect.top - 2;
          left = caretRect.right + 8;
        }
      }
    }

    // Default: position at field's top-right corner
    if (top === undefined || left === undefined) {
      top = rect.top - 2;
      left = rect.right - 34;
    }

    // Keep on screen
    if (top < 4) top = (rect.bottom || top) + 4;
    if (left < 4) left = rect.left || 4;
    if (left + 28 > window.innerWidth) left = window.innerWidth - 32;

    triggerEl.style.top = top + 'px';
    triggerEl.style.left = left + 'px';
  }

  // ─── Create Panel ───────────────────────────────────────────────
  function createPanel() {
    if (panelEl) return;

    panelEl = document.createElement('div');
    panelEl.className = 'glyph-panel';

    // Search
    const search = document.createElement('input');
    search.className = 'glyph-search';
    search.type = 'text';
    search.placeholder = 'Search symbols…';
    search.addEventListener('input', () => filterChars(search.value));
    search.addEventListener('keydown', (e) => e.stopPropagation());
    panelEl.appendChild(search);

    // Recent section
    const recentLabel = document.createElement('div');
    recentLabel.className = 'glyph-section-label';
    recentLabel.textContent = 'Recent';
    recentLabel.id = 'glyph-recent-label';
    panelEl.appendChild(recentLabel);

    const recentGrid = document.createElement('div');
    recentGrid.className = 'glyph-grid';
    recentGrid.id = 'glyph-recent-grid';
    panelEl.appendChild(recentGrid);

    // All section
    const allLabel = document.createElement('div');
    allLabel.className = 'glyph-section-label';
    allLabel.textContent = 'All Symbols';
    panelEl.appendChild(allLabel);

    const allGrid = document.createElement('div');
    allGrid.className = 'glyph-grid';
    allGrid.id = 'glyph-all-grid';
    panelEl.appendChild(allGrid);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'glyph-footer';
    footer.innerHTML = `
      <span class="glyph-brand">GLYPH</span>
      <span class="glyph-shortcut-hint"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd></span>
    `;
    panelEl.appendChild(footer);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'glyph-tooltip';
    tooltip.id = 'glyph-tooltip';
    shadowRoot.appendChild(tooltip);

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

    // Recent
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

    // All
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
    cell.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      insertChar(data.char);
    });

    return cell;
  }

  function filterChars(query) {
    renderAllChars(query);
  }

  // ─── Tooltip ────────────────────────────────────────────────────
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

  // ─── Insert Character ───────────────────────────────────────────
  function insertChar(char) {
    if (!activeField) return;

    // Google Docs: insert via the hidden text event target iframe
    if (isGoogleDocs) {
      // Try known iframe selectors (Google may rename these)
      const docsIframe = document.querySelector('.docs-texteventtarget-iframe')
        || document.querySelector('iframe.docs-texteventtarget-iframe')
        || document.querySelector('iframe[class*="texteventtarget"]');
      if (docsIframe) {
        try {
          const iframeDoc = docsIframe.contentDocument;
          const iframeBody = iframeDoc && (iframeDoc.querySelector('[contenteditable="true"]') || iframeDoc.body);
          if (iframeBody) {
            iframeBody.focus();
            iframeDoc.execCommand('insertText', false, char);
            addToRecent(char);
            renderAllChars();
            return;
          }
        } catch (e) {
          // Fall through to clipboard fallback
        }
      }
      // Also try any contenteditable on the page
      const editable = document.querySelector('[contenteditable="true"]');
      if (editable) {
        try {
          editable.focus();
          const success = document.execCommand('insertText', false, char);
          if (success) {
            addToRecent(char);
            renderAllChars();
            return;
          }
        } catch (e) {}
      }
      // Clipboard fallback for Google Docs
      navigator.clipboard.writeText(char).then(() => {
        addToRecent(char);
        renderAllChars();
      });
      return;
    }

    activeField.focus();

    // Try execCommand first (works for contenteditable)
    if (activeField.isContentEditable || document.queryCommandSupported('insertText')) {
      const success = document.execCommand('insertText', false, char);
      if (success) {
        addToRecent(char);
        renderAllChars();
        return;
      }
    }

    // Fallback for textarea/input
    if ('selectionStart' in activeField) {
      const start = activeField.selectionStart;
      const end = activeField.selectionEnd;
      const val = activeField.value;
      activeField.value = val.substring(0, start) + char + val.substring(end);
      activeField.selectionStart = activeField.selectionEnd = start + char.length;

      // Dispatch events so frameworks detect the change
      activeField.dispatchEvent(new Event('input', { bubbles: true }));
      activeField.dispatchEvent(new Event('change', { bubbles: true }));

      addToRecent(char);
      renderAllChars();
      return;
    }

    // Last resort: clipboard
    navigator.clipboard.writeText(char).then(() => {
      addToRecent(char);
      renderAllChars();
    });
  }

  // ─── Show / Hide Panel ──────────────────────────────────────────
  function showPanel() {
    createPanel();
    if (!triggerEl || !panelEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    let top = triggerRect.bottom + 6;
    let left = triggerRect.right - 268;

    // Keep on screen
    if (top + 360 > window.innerHeight) {
      top = triggerRect.top - 360;
    }
    if (left < 8) left = 8;
    if (left + 268 > window.innerWidth) left = window.innerWidth - 276;

    panelEl.style.top = top + 'px';
    panelEl.style.left = left + 'px';

    renderAllChars();

    requestAnimationFrame(() => {
      panelEl.classList.add('visible');
    });

    panelVisible = true;

    // Focus search
    const searchInput = panelEl.querySelector('.glyph-search');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  }

  function hidePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('visible');
    panelVisible = false;
  }

  function showTrigger(field) {
    createTrigger();
    activeField = field;
    positionTrigger(field);
    requestAnimationFrame(() => {
      triggerEl.classList.add('visible');
    });
  }

  function hideTrigger() {
    if (triggerEl) triggerEl.classList.remove('visible');
    hidePanel();
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
    if (el.getAttribute('role') === 'textbox') return true;
    return false;
  }

  function findEditableAncestor(el) {
    let node = el;
    while (node && node !== document.body) {
      if (isEditableField(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  // ─── Event Listeners ───────────────────────────────────────────
  let hideTimeout = null;

  document.addEventListener('focusin', (e) => {
    clearTimeout(hideTimeout);
    if (isEditableField(e.target)) {
      showTrigger(e.target);
    }
  }, true);

  // Show trigger on click too (handles already-focused fields and contenteditable children)
  document.addEventListener('click', (e) => {
    clearTimeout(hideTimeout);
    const target = isEditableField(e.target)
      ? e.target
      : findEditableAncestor(e.target);
    if (target) {
      showTrigger(target);
    }
  }, true);

  document.addEventListener('focusout', (e) => {
    hideTimeout = setTimeout(() => {
      // Don't hide if focus moved into our shadow DOM
      const newFocus = document.activeElement;
      if (shadowHost && shadowHost.contains(newFocus)) return;
      hideTrigger();
      activeField = null;
    }, 200);
  }, true);

  // Close panel on outside click
  document.addEventListener('mousedown', (e) => {
    if (!panelVisible) return;
    // Check if click is on our elements (approximate — shadow DOM makes this tricky)
    if (shadowHost && shadowHost === e.target) return;
    // Small delay to let the panel click handlers fire first
    setTimeout(() => {
      if (panelVisible && activeField && !activeField.contains(e.target)) {
        hidePanel();
      }
    }, 100);
  }, true);

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelVisible) {
      hidePanel();
      if (activeField) activeField.focus();
    }
  }, true);

  // Handle scroll — reposition trigger
  let scrollTick = false;
  window.addEventListener('scroll', () => {
    if (!scrollTick) {
      requestAnimationFrame(() => {
        if (activeField && triggerEl) {
          positionTrigger(activeField);
          if (panelVisible) {
            // Reposition panel too
            const triggerRect = triggerEl.getBoundingClientRect();
            let top = triggerRect.bottom + 6;
            let left = triggerRect.right - 268;
            if (top + 360 > window.innerHeight) top = triggerRect.top - 360;
            if (left < 8) left = 8;
            panelEl.style.top = top + 'px';
            panelEl.style.left = left + 'px';
          }
        }
        scrollTick = false;
      });
      scrollTick = true;
    }
  }, true);

  // ─── Google Docs Support ────────────────────────────────────────
  if (isGoogleDocs) {
    document.addEventListener('mouseup', (e) => {
      // Skip clicks on toolbar, menus, buttons, dialogs, and other UI chrome
      const tag = e.target.tagName;
      if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'OPTION') return;
      if (e.target.closest(
        '[role="toolbar"], [role="menu"], [role="menubar"], [role="menuitem"], ' +
        '[role="button"], [role="dialog"], [role="tablist"], [role="tab"], ' +
        '.docs-titlebar-container, .docs-material-mode-switcher'
      )) return;

      clearTimeout(hideTimeout);

      // Find editing iframe's contenteditable for insertion
      let gdocsField = null;
      try {
        const iframe = document.querySelector('.docs-texteventtarget-iframe');
        if (iframe && iframe.contentDocument) {
          gdocsField = iframe.contentDocument.body;
        }
      } catch (err) {}

      // Fallback: look for any contenteditable on the page
      if (!gdocsField) {
        gdocsField = document.querySelector('[contenteditable="true"]');
      }

      activeField = gdocsField || document.body;
      createTrigger();

      // Position near the click
      const top = Math.max(4, e.clientY - 34);
      const left = Math.min(e.clientX + 16, window.innerWidth - 32);
      triggerEl.style.top = top + 'px';
      triggerEl.style.left = left + 'px';

      requestAnimationFrame(() => {
        triggerEl.classList.add('visible');
      });
    }, true);
  }

  // Handle keyboard shortcut from background
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'toggle-glyph') {
        if (panelVisible) {
          hidePanel();
        } else if (activeField) {
          showPanel();
        }
      }
    });
  } catch (e) {}

})();
