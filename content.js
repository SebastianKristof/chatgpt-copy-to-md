// Утилиты для работы с текстом и Markdown

/**
 * Нормализация текста: удаление лишних пустых строк (>2 подряд → 2), trim
 */
function normalizeText(text) {
  return text
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Преобразование текста в blockquote формат
 */
function toBlockquote(text) {
  const normalized = normalizeText(text);
  return normalized
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

/**
 * Преобразование текста в fenced code block
 */
function toCodeBlock(text) {
  const normalized = normalizeText(text);
  return `\`\`\`text\n${normalized}\n\`\`\``;
}

/**
 * Копирование текста в буфер обмена с fallback
 */
let lastCopyError = '';

async function copyToClipboard(text) {
  lastCopyError = '';
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    lastCopyError = err?.name || err?.message || 'clipboard-write-failed';
  }

  // Fallback: trigger copy event and set clipboard data manually
  try {
    let handled = false;
    const onCopy = (e) => {
      try {
        e.preventDefault();
        e.clipboardData.setData('text/plain', text);
        handled = true;
      } catch (err) {
        lastCopyError = err?.name || err?.message || 'copy-event-failed';
      }
    };
    document.addEventListener('copy', onCopy, { once: true });
    const success = document.execCommand('copy');
    if (!success || !handled) {
      lastCopyError = lastCopyError || 'execCommand-copy-failed';
      return false;
    }
    return true;
  } catch (fallbackErr) {
    lastCopyError = fallbackErr?.name || fallbackErr?.message || 'clipboard-fallback-failed';
    console.error('Failed to copy:', fallbackErr);
    return false;
  }
}

/**
 * Показ toast-уведомления
 */
function showToast(message) {
  // Удаляем существующий toast, если есть
  const existingToast = document.querySelector('.ce-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'ce-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Удаляем через 2 секунды (анимация уже скрывает через 1.7s)
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 2000);
}

// Кнопка в bubble "Ask ChatGPT"

let bubbleButton = null;
let bubbleInsertTimer = null;
let bubbleInsertAttempts = 0;
let isExtensionEnabled = true;
let lastSelectionText = '';

/**
 * Проверка валидности выделения
 */
function isValidSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const text = selection.toString().trim();
  if (text.length > 0) {
    lastSelectionText = text;
  }
  return text.length >= 3;
}

/**
 * Создание всплывающей кнопки
 */
function findAskBubbleContainer() {
  const buttons = Array.from(document.querySelectorAll('button'));
  const askButton = buttons.find((btn) => {
    const text = (btn.innerText || btn.textContent || '').trim();
    return text.includes('Ask ChatGPT');
  });
  if (!askButton) {
    return null;
  }
  return askButton.closest('.shadow-long') || askButton.parentElement;
}

function createBubbleButton() {
  if (bubbleButton) {
    return bubbleButton;
  }
  const button = document.createElement('button');
  button.className = 'ce-bubble-copy-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Copy selection to Markdown');
  button.innerHTML = `
    <span class="ce-bubble-copy-button__icon" aria-hidden="true"></span>
    <span class="ce-bubble-copy-button__label">Copy to MD</span>
  `;

  button.addEventListener('click', async (e) => {
    e.stopPropagation();
    const selection = window.getSelection();
    const text = (selection && selection.rangeCount > 0 ? selection.toString() : '') || lastSelectionText;
    if (!text || text.trim().length === 0) {
      showToast('Nothing to copy');
      return;
    }
    const markdown = toBlockquote(text);
    const success = await copyToClipboard(markdown);
    if (success) {
      showToast('Copied to Markdown');
    } else {
      showToast(`Copy failed${lastCopyError ? `: ${lastCopyError}` : ''}`);
    }
    selection?.removeAllRanges();
    removeFloatingButton();
  });

  bubbleButton = button;
  return button;
}

/**
 * Удаление всплывающей кнопки
 */
function removeFloatingButton() {
  if (bubbleButton && bubbleButton.parentNode) {
    bubbleButton.remove();
  }
  bubbleButton = null;
  if (bubbleInsertTimer) {
    clearTimeout(bubbleInsertTimer);
    bubbleInsertTimer = null;
  }
  bubbleInsertAttempts = 0;
}

function tryInsertBubbleButton() {
  const bubbleContainer = findAskBubbleContainer();
  if (bubbleContainer) {
    const button = createBubbleButton();
    if (!bubbleContainer.querySelector('.ce-bubble-copy-button')) {
      bubbleContainer.appendChild(button);
    }
    bubbleInsertAttempts = 0;
    bubbleInsertTimer = null;
    return;
  }

  bubbleInsertAttempts += 1;
  if (bubbleInsertAttempts <= 12) {
    bubbleInsertTimer = setTimeout(tryInsertBubbleButton, 120);
  } else {
    bubbleInsertAttempts = 0;
    bubbleInsertTimer = null;
  }
}

/**
 * Обработка выделения текста
 */
function handleSelection() {
  if (!isExtensionEnabled) {
    removeFloatingButton();
    return;
  }

  if (isValidSelection()) {
    tryInsertBubbleButton();
  } else {
    removeFloatingButton();
  }
}

// Обработчики событий для всплывающей кнопки
document.addEventListener('selectionchange', handleSelection);
document.addEventListener('mouseup', handleSelection);
document.addEventListener('keyup', (e) => {
  if (e.key === 'Escape') {
    removeFloatingButton();
    window.getSelection()?.removeAllRanges();
  } else {
    handleSelection();
  }
});

// Кнопка "Copy MD" под ответом

/**
 * Поиск контейнера кнопок для сообщения
 */
function findButtonContainer(messageElement) {
  // Ищем контейнер с кнопками действий (Copy, Share, Regenerate и т.д.)
  // ChatGPT обычно использует контейнеры с кнопками рядом с сообщением
  
  // Вариант 1: Ищем родительский контейнер и ищем кнопки внутри
  let container =
    messageElement.closest('article[data-testid^="conversation-turn-"]') ||
    messageElement.closest('[data-message-id]') ||
    messageElement.parentElement;
  
  if (!container) {
    return null;
  }

  // Вариант 1.1: Явный toolbar рядом с сообщением
  const toolbar = container.querySelector('[role="toolbar"], div[class*="toolbar"], div[class*="actions"]');
  if (toolbar) {
    return toolbar;
  }

  // Ищем контейнер с кнопками - обычно это div с несколькими button элементами
  const buttons = container.querySelectorAll('button, [role="button"]');
  if (buttons.length > 0) {
    // Находим общий контейнер кнопок (минимально близкий общий родитель)
    const firstButton = buttons[0];
    return firstButton.parentElement;
  }

  // Вариант 2: Ищем по классам или атрибутам
  const actionContainer = container.querySelector('[class*="button"], [class*="action"], [class*="toolbar"]');
  if (actionContainer) {
    return actionContainer;
  }

  return null;
}

/**
 * Создание кнопки "Copy MD"
 */
function createCopyMDButton() {
  const button = document.createElement('button');
  button.className = 'ce-copy-md-button';
  button.setAttribute('aria-label', 'Copy full response to Markdown');
  button.type = 'button';

  const icon = document.createElement('span');
  icon.className = 'ce-copy-md-button__icon';
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 3h8a2 2 0 0 1 2 2v8h-2V5H9V3z"></path>
      <path d="M5 7h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v8h8V9H5z"></path>
    </svg>
  `;

  const label = document.createElement('span');
  label.className = 'ce-copy-md-button__label';
  label.textContent = 'Copy to MD';

  button.appendChild(icon);
  button.appendChild(label);
  return button;
}

/**
 * Извлечение текста ответа без элементов управления
 */
function extractMessageText(messageElement) {
  const root = messageElement.cloneNode(true);
  const selectorsToRemove = [
    'button',
    '[role="button"]',
    'nav',
    'footer',
    'form',
    'input',
    'textarea',
    'svg',
    '[data-testid*="copy"]',
    '[data-testid*="share"]',
    '[class*="toolbar"]',
    '[class*="action"]'
  ];

  selectorsToRemove.forEach((selector) => {
    root.querySelectorAll(selector).forEach((el) => el.remove());
  });

  return (root.innerText || root.textContent || '').trim();
}

/**
 * Добавление кнопки Copy MD к сообщению
 */
function addCopyMDButtonToMessage(messageElement) {
  if (!isExtensionEnabled) {
    return;
  }
  // Проверяем, не добавлена ли уже кнопка
  if (messageElement.querySelector('.ce-copy-md-button') || messageElement.dataset.ceCopyMdInjected === '1') {
    return;
  }

  const buttonContainer = findButtonContainer(messageElement);
  if (!buttonContainer) {
    return;
  }

  const button = createCopyMDButton();
  
  button.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    // Находим контейнер с текстом ответа
    const messageContainer = messageElement.closest('[data-message-author-role="assistant"]') || messageElement;
    const textContent = extractMessageText(messageContainer);
    
    if (!textContent || textContent.trim().length === 0) {
      showToast('Nothing to copy');
      return;
    }

    const markdown = toCodeBlock(textContent);
    const success = await copyToClipboard(markdown);
    
    if (success) {
      showToast('Copied to Markdown');
    } else {
      showToast(`Copy failed${lastCopyError ? `: ${lastCopyError}` : ''}`);
    }
  });

  // Вставляем кнопку в контейнер
  buttonContainer.appendChild(button);
  messageElement.dataset.ceCopyMdInjected = '1';
}

// Дебаунс вставки кнопки до завершения генерации
const pendingInsertions = new WeakMap();

function scheduleAddButton(messageElement) {
  if (!isExtensionEnabled) {
    return;
  }
  if (!messageElement) return;
  const existing = pendingInsertions.get(messageElement);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    // Не вставляем, если еще идет генерация (косвенный признак — есть кнопка "Stop")
    const hasStop = !!document.querySelector('button[aria-label*="Stop"], button[aria-label*="stop"]');
    if (hasStop) {
      scheduleAddButton(messageElement);
      return;
    }
    // Ждем появления стандартной панели действий
    const container = findButtonContainer(messageElement);
    if (!container) {
      scheduleAddButton(messageElement);
      return;
    }
    addCopyMDButtonToMessage(messageElement);
  }, 800);
  pendingInsertions.set(messageElement, timer);
}

/**
 * Поиск всех сообщений ассистента и добавление кнопок
 */
function processAssistantMessages() {
  if (!isExtensionEnabled) {
    return;
  }
  const turnArticles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
  if (turnArticles.length > 0) {
    turnArticles.forEach((article) => {
      const assistant = article.querySelector('[data-message-author-role="assistant"]');
      if (assistant) {
        scheduleAddButton(assistant);
      } else {
        const text = article.innerText || '';
        if (text.length > 50 && !article.querySelector('input, textarea')) {
          scheduleAddButton(article);
        }
      }
    });
    return;
  }

  // Ищем сообщения ассистента по разным возможным селекторам
  const selectors = [
    '[data-message-author-role="assistant"]',
    'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
    'article[data-testid^="conversation-turn-"]',
    '[data-testid*="assistant"]',
    'div[class*="assistant"]',
  ];

  let messages = [];
  for (const selector of selectors) {
    const found = document.querySelectorAll(selector);
    if (found.length > 0) {
      messages = Array.from(found);
      break;
    }
  }

  // Если не нашли по селекторам, ищем по структуре
  if (messages.length === 0) {
    // ChatGPT может использовать другую структуру - ищем все возможные контейнеры сообщений
    const allMessages = document.querySelectorAll(
      '[data-message-id], [data-message-author-role], div[class*="message"], div[class*="Message"]'
    );
    messages = Array.from(allMessages).filter(el => {
      // Проверяем, что это не сообщение пользователя
      const role = el.getAttribute?.('data-message-author-role');
      if (role && role !== 'assistant') {
        return false;
      }
      const text = el.innerText || '';
      // Обычно сообщения ассистента содержат больше текста и имеют определенную структуру
      return text.length > 50 && !el.querySelector('input, textarea');
    });
  }

  messages.forEach(message => {
    if (message.matches && message.matches('article[data-testid^="conversation-turn-"]')) {
      const assistant = message.querySelector('[data-message-author-role="assistant"]');
      if (assistant) {
        scheduleAddButton(assistant);
        return;
      }
    }
    scheduleAddButton(message);
  });
}

// Инициализация при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', processAssistantMessages);
} else {
  processAssistantMessages();
}

// MutationObserver для динамических сообщений
const observer = new MutationObserver((mutations) => {
  let shouldProcess = false;
  
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      // Проверяем, добавлены ли новые сообщения
      Array.from(mutation.addedNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Проверяем, является ли это сообщением ассистента
          if (node.matches && (
            node.matches('[data-message-author-role="assistant"]') ||
            node.querySelector('[data-message-author-role="assistant"]')
          )) {
            shouldProcess = true;
          }
        }
      });
    }
  });

  if (shouldProcess) {
    // Небольшая задержка, чтобы DOM успел обновиться
    setTimeout(processAssistantMessages, 100);
  }
});

// Начинаем наблюдение за изменениями DOM
observer.observe(document.body, {
  childList: true,
  subtree: true
});

function removeAllInjectedButtons() {
  document.querySelectorAll('.ce-copy-md-button, .ce-bubble-copy-button').forEach((btn) => btn.remove());
  document.querySelectorAll('[data-ce-copy-md-injected]').forEach((el) => {
    delete el.dataset.ceCopyMdInjected;
  });
}

function setExtensionEnabled(nextValue) {
  isExtensionEnabled = !!nextValue;
  if (!isExtensionEnabled) {
    removeFloatingButton();
    removeAllInjectedButtons();
  } else {
    processAssistantMessages();
  }
}

function initSettings() {
  if (!chrome?.storage?.sync) {
    setExtensionEnabled(true);
    return;
  }
  chrome.storage.sync.get({ enabled: true }, (result) => {
    setExtensionEnabled(result.enabled !== false);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled) {
      setExtensionEnabled(changes.enabled.newValue !== false);
    }
  });
}

initSettings();
