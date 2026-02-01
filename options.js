const enabledCheckbox = document.getElementById('enabled');
const status = document.getElementById('status');

function setStatus(message) {
  status.textContent = message;
  if (message) {
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  }
}

function loadSettings() {
  if (!chrome?.storage?.sync) {
    enabledCheckbox.checked = true;
    setStatus('Storage unavailable in this browser context.');
    return;
  }
  chrome.storage.sync.get({ enabled: true }, (result) => {
    enabledCheckbox.checked = result.enabled !== false;
  });
}

function saveSettings() {
  if (!chrome?.storage?.sync) {
    setStatus('Storage unavailable in this browser context.');
    return;
  }
  chrome.storage.sync.set({ enabled: enabledCheckbox.checked }, () => {
    setStatus('Saved');
  });
}

enabledCheckbox.addEventListener('change', saveSettings);
loadSettings();
