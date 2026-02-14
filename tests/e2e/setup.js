import { chromium, expect } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', '..');
const mockRouteHandlers = new WeakMap();

function resolveExecutablePath() {
  const candidate = process.env.E2E_BROWSER_PATH;
  if (candidate && existsSync(candidate)) {
    return candidate;
  }
  return null;
}

export async function setupExtension() {
  const executablePath = resolveExecutablePath();
  const e2eHomeDir = path.join(os.tmpdir(), 'chatgpt-copy-md-e2e-home');
  mkdirSync(e2eHomeDir, { recursive: true });

  const launchOptions = {
    headless: false,
    env: {
      ...process.env,
      HOME: e2eHomeDir,
    },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  try {
    return await chromium.launchPersistentContext('', launchOptions);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("Executable doesn't exist")) {
      throw new Error(
        `Cannot launch browser for E2E tests. Install Chromium with "npx playwright install chromium" or set E2E_BROWSER_PATH.\n` +
          `Original error: ${message}`
      );
    }
    throw error;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildMockMarkup({ theme = 'light' } = {}) {
  const rootTheme = theme === 'dark' ? 'dark' : 'light';

  return `
    <!doctype html>
    <html data-theme="${rootTheme}">
      <head>
        <meta charset="utf-8" />
        <title>ChatGPT Mock</title>
      </head>
      <body>
        <main>
          <article data-testid="conversation-turn-1">
            <div data-message-id="assistant-msg" data-message-author-role="assistant">
              <p>${escapeHtml('Assistant response that should become Markdown when copied.')}</p>
            </div>
            <div role="toolbar">
              <button aria-label="Copy">Copy</button>
            </div>
          </article>

          <article data-testid="conversation-turn-2">
            <div data-message-id="user-msg" data-message-author-role="user">
              <p>${escapeHtml('User prompt')}</p>
            </div>
          </article>
        </main>

        <div class="shadow-long">
          <button type="button">Ask ChatGPT</button>
        </div>
      </body>
    </html>
  `;
}

export async function openMockConversation(context, options = {}) {
  const page = await context.newPage();
  const url = `https://chatgpt.com/c/${options.conversationId || 'e2e-test'}`;
  const htmlDocument = buildMockMarkup(options);

  const existingHandler = mockRouteHandlers.get(page);
  if (existingHandler) {
    await page.unroute('https://chatgpt.com/**', existingHandler);
  }

  const handler = async (route) => {
    const request = route.request();
    if (request.resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: htmlDocument,
      });
      return;
    }
    await route.fulfill({
      status: 204,
      contentType: 'text/plain; charset=utf-8',
      body: '',
    });
  };

  mockRouteHandlers.set(page, handler);
  await page.route('https://chatgpt.com/**', handler);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForCopyButton(page);
  return page;
}

export async function waitForCopyButton(page) {
  await expect(page.locator('.ce-copy-md-button').first()).toBeVisible({ timeout: 10_000 });
}

export async function selectAssistantText(page) {
  await page.evaluate(() => {
    const target = document.querySelector('[data-message-id="assistant-msg"] p');
    if (!target) {
      throw new Error('assistant text target not found');
    }
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

  await page.dispatchEvent('body', 'mouseup');
}
