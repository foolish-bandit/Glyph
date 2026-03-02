chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-glyph') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-glyph' });
      }
    });
  }
});
