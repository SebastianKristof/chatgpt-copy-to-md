// Утилиты для работы с текстом и Markdown

/**
 * Нормализация текста: удаление лишних пустых строк (>2 подряд → 2), trim
 */
function normalizeText(text) {
  return text
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

function escapeInlineText(text) {
  return text.replace(/([*_`])/g, '\\$1');
}

function wrapInlineCode(text) {
  const hasBacktick = text.includes('`');
  const fence = hasBacktick ? '``' : '`';
  return `${fence}${text}${fence}`;
}

function getCodeBlockLanguage(codeEl) {
  if (!codeEl) return '';
  const className = codeEl.className || '';
  const match = className.match(/language-([a-z0-9_-]+)/i);
  return match ? match[1] : '';
}

function normalizeMarkdown(md) {
  return md
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeTableCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
}

function tableToMarkdown(tableEl, ctx) {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  const cellsByRow = rows.map((row) =>
    Array.from(row.children).filter((cell) =>
      cell.tagName && (cell.tagName.toLowerCase() === 'th' || cell.tagName.toLowerCase() === 'td')
    )
  );

  const headerCells = cellsByRow.find((row) =>
    row.some((cell) => cell.tagName.toLowerCase() === 'th')
  ) || cellsByRow[0];

  const headerTexts = headerCells.map((cell) => {
    const text = normalizeMarkdown(childrenToMarkdown(cell, ctx));
    return escapeTableCell(text || '');
  });

  const alignRow = headerCells.map(() => '---');

  const bodyRows = cellsByRow.filter((row) => row !== headerCells);
  const bodyTexts = bodyRows.map((row) =>
    row.map((cell) => {
      const text = normalizeMarkdown(childrenToMarkdown(cell, ctx));
      return escapeTableCell(text || '');
    })
  );

  const lines = [];
  lines.push(`| ${headerTexts.join(' | ')} |`);
  lines.push(`| ${alignRow.join(' | ')} |`);
  bodyTexts.forEach((row) => {
    const padded = row.length < headerTexts.length
      ? row.concat(Array(headerTexts.length - row.length).fill(''))
      : row;
    lines.push(`| ${padded.join(' | ')} |`);
  });

  return `\n\n${lines.join('\n')}\n\n`;
}

function nodeToMarkdown(node, ctx) {
  if (!node) return '';

  if (node.nodeType === Node.TEXT_NODE) {
    return escapeInlineText(node.textContent || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const tag = node.tagName.toLowerCase();

  if (tag === 'br') {
    return '\n';
  }

  if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') {
    return wrapInlineCode(node.textContent || '');
  }

  if (tag === 'pre') {
    const codeEl = node.querySelector('code') || node;
    const language = getCodeBlockLanguage(codeEl);
    const codeText = codeEl.textContent || '';
    return `\n\n\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
  }

  if (tag === 'strong' || tag === 'b') {
    return `**${childrenToMarkdown(node, ctx)}**`;
  }

  if (tag === 'em' || tag === 'i') {
    return `*${childrenToMarkdown(node, ctx)}*`;
  }

  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    const text = childrenToMarkdown(node, ctx) || href;
    return href ? `[${text}](${href})` : text;
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
    const level = Number(tag.replace('h', '')) || 1;
    const hashes = '#'.repeat(level);
    return `\n\n${hashes} ${childrenToMarkdown(node, ctx)}\n\n`;
  }

  if (tag === 'blockquote') {
    const inner = normalizeMarkdown(childrenToMarkdown(node, ctx));
    const rawLines = inner.split('\n');
    const trimmedLines = [];
    for (let i = 0; i < rawLines.length; i += 1) {
      const line = rawLines[i];
      if (trimmedLines.length === 0 && line.trim() === '') {
        continue;
      }
      trimmedLines.push(line);
    }
    while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1].trim() === '') {
      trimmedLines.pop();
    }
    const collapsed = [];
    trimmedLines.forEach((line) => {
      if (line.trim() === '' && collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === '') {
        return;
      }
      collapsed.push(line);
    });
    const lines = collapsed.map((line) => `> ${line}`);
    return `\n\n${lines.join('\n')}\n\n`;
  }

  if (tag === 'table') {
    return tableToMarkdown(node, ctx);
  }

  if (tag === 'ul' || tag === 'ol') {
    const isOrdered = tag === 'ol';
    const items = [];
    const prevList = ctx.list;
    ctx.list = { ordered: isOrdered, index: 1, indent: (prevList?.indent || 0) + 2 };

    Array.from(node.children).forEach((child) => {
      if (child.tagName.toLowerCase() === 'li') {
        items.push(nodeToMarkdown(child, ctx));
      }
    });

    ctx.list = prevList;
    return `\n${items.join('')}\n`;
  }

  if (tag === 'li') {
    const list = ctx.list || { ordered: false, index: 1, indent: 2 };
    const bullet = list.ordered ? `${list.index}. ` : '- ';
    if (list.ordered) {
      list.index += 1;
    }
    const indent = ' '.repeat(Math.max(0, list.indent - 2));
    const content = normalizeMarkdown(childrenToMarkdown(node, ctx));
    const lines = content.split('\n');
    const first = `${indent}${bullet}${lines.shift() || ''}`;
    const rest = lines.map((line) => `${indent}  ${line}`).join('\n');
    return `${first}${rest ? `\n${rest}` : ''}\n`;
  }

  if (tag === 'p') {
    const content = childrenToMarkdown(node, ctx);
    return `\n\n${content}\n\n`;
  }

  return childrenToMarkdown(node, ctx);
}

function childrenToMarkdown(node, ctx) {
  const parts = [];
  node.childNodes.forEach((child) => {
    parts.push(nodeToMarkdown(child, ctx));
  });
  return parts.join('');
}

function htmlToMarkdown(root) {
  const ctx = { list: null };
  const markdown = childrenToMarkdown(root, ctx);
  return normalizeMarkdown(markdown);
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
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const fragment = range ? range.cloneContents() : null;
    const markdown = fragment ? htmlToMarkdown(fragment) : normalizeText(text);
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

  // Вариант 1.2: Панель действий ответа (частичный набор кнопок)
  const actionButton = container.querySelector('[data-testid$="turn-action-button"]');
  if (actionButton) {
    return actionButton.closest('div');
  }

  const actionCandidates = Array.from(container.querySelectorAll('button[aria-label]'))
    .filter((btn) => {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      return (
        label.includes('copy') ||
        label.includes('good response') ||
        label.includes('bad response') ||
        label.includes('share') ||
        label.includes('more actions')
      );
    })
    .map((btn) => btn.parentElement)
    .filter(Boolean);

  if (actionCandidates.length > 0) {
    return actionCandidates[0];
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
  const roleElement = messageElement.closest('[data-message-author-role]');
  if (roleElement && roleElement.getAttribute('data-message-author-role') !== 'assistant') {
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

    const markdown = htmlToMarkdown(messageContainer);
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
          const role = article.getAttribute?.('data-message-author-role');
          if (role === 'assistant') {
            scheduleAddButton(article);
          }
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

// Перепроверяем через чуть большее время на случай позднего рендера панели действий
setTimeout(processAssistantMessages, 1500);

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
