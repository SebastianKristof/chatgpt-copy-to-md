function setEnabled(nextValue) {
  chrome.storage.sync.set({ enabled: nextValue });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ enabled: true }, (result) => {
    if (typeof result.enabled !== 'boolean') {
      chrome.storage.sync.set({ enabled: true });
    }
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-extension') return;
  chrome.storage.sync.get({ enabled: true }, (result) => {
    setEnabled(!result.enabled);
  });
});
