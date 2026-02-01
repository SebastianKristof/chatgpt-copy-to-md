const enabledCheckbox = document.getElementById('enabled');
const openOptions = document.getElementById('open-options');
const openShortcuts = document.getElementById('open-shortcuts');
const shortcutHint = document.getElementById('shortcut-hint');

function loadSettings() {
  if (!chrome?.storage?.sync) {
    enabledCheckbox.checked = true;
    shortcutHint.textContent = '';
    return;
  }
  chrome.storage.sync.get({ enabled: true }, (result) => {
    enabledCheckbox.checked = result.enabled !== false;
  });
}

function saveSettings() {
  if (!chrome?.storage?.sync) {
    return;
  }
  chrome.storage.sync.set({ enabled: enabledCheckbox.checked });
}

function updateShortcutHint() {
  if (!chrome?.commands?.getAll) {
    shortcutHint.textContent = '';
    return;
  }
  chrome.commands.getAll((commands) => {
    const toggleCommand = commands.find((cmd) => cmd.name === 'toggle-extension');
    if (toggleCommand?.shortcut) {
      shortcutHint.textContent = `Shortcut: ${toggleCommand.shortcut}`;
    } else {
      shortcutHint.textContent = 'Shortcut: not set';
    }
  });
}

enabledCheckbox.addEventListener('change', saveSettings);
openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
openShortcuts.addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

loadSettings();
updateShortcutHint();
