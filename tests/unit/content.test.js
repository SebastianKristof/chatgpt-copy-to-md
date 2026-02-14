import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentScriptPath = path.join(__dirname, '..', '..', 'content.js');
const contentScriptSource = readFileSync(contentScriptPath, 'utf-8');

function createChromeStub() {
  return {
    storage: {
      sync: {
        get(defaults, callback) {
          callback({ ...defaults, enabled: true });
        },
      },
      onChanged: {
        addListener() {},
      },
    },
  };
}

function loadContentScript({ html = '<!doctype html><html><body></body></html>', prefersDark = false } = {}) {
  const dom = new JSDOM(html, {
    url: 'https://chatgpt.com/c/unit-test',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;

  window.chrome = createChromeStub();
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {},
    },
  });
  window.document.execCommand = () => true;
  window.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  window.matchMedia = (query) => ({
    matches: prefersDark && query.includes('prefers-color-scheme: dark'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });

  vm.runInContext(contentScriptSource, dom.getInternalVMContext(), { filename: 'content.js' });
  return dom;
}

test('htmlToMarkdown converts rich content blocks', () => {
  const dom = loadContentScript();
  const { window } = dom;
  const root = window.document.createElement('div');
  root.innerHTML = `
    <h2>Title</h2>
    <p>Hello <strong>world</strong> and <code>inline()</code>.</p>
    <pre><code class="language-js">const value = 1;</code></pre>
  `;

  const markdown = window.htmlToMarkdown(root);

  assert.match(markdown, /## Title/);
  assert.match(markdown, /Hello \*\*world\*\* and `inline\(\)`\./);
  assert.match(markdown, /```js\nconst value = 1;\n```/);
  dom.window.close();
});

test('htmlToMarkdown converts tables to markdown table syntax', () => {
  const dom = loadContentScript();
  const { window } = dom;
  const root = window.document.createElement('div');
  root.innerHTML = `
    <table>
      <tr><th>Key</th><th>Value</th></tr>
      <tr><td>alpha</td><td>1</td></tr>
    </table>
  `;

  const markdown = window.htmlToMarkdown(root);

  assert.match(markdown, /\| Key \| Value \|/);
  assert.match(markdown, /\| --- \| --- \|/);
  assert.match(markdown, /\| alpha \| 1 \|/);
  dom.window.close();
});

test('shouldUseDarkTheme returns true when dark theme attributes are present', () => {
  const dom = loadContentScript({
    html: '<!doctype html><html data-theme="dark"><body></body></html>',
  });
  const { window } = dom;

  assert.equal(window.shouldUseDarkTheme(), true);
  dom.window.close();
});

test('shouldUseDarkTheme ignores transparent backgrounds', () => {
  const dom = loadContentScript({
    html: '<!doctype html><html><body style="background-color: rgba(0, 0, 0, 0)"></body></html>',
  });
  const { window } = dom;

  window.document.documentElement.removeAttribute('data-theme');
  window.document.body.removeAttribute('data-theme');
  window.document.documentElement.className = '';
  window.document.body.className = '';

  assert.equal(window.shouldUseDarkTheme(), false);
  dom.window.close();
});

test('shouldUseDarkTheme falls back to prefers-color-scheme when needed', () => {
  const dom = loadContentScript({ prefersDark: true });
  const { window } = dom;

  window.document.documentElement.removeAttribute('data-theme');
  window.document.body.removeAttribute('data-theme');
  window.document.documentElement.className = '';
  window.document.body.className = '';

  assert.equal(window.shouldUseDarkTheme(), true);
  dom.window.close();
});
