import { expect, test } from '@playwright/test';
import { openMockConversation, selectAssistantText, setupExtension } from './setup.js';

test.describe('Copy buttons', () => {
  let context;
  let page;

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
  });

  test('injects Copy as MD button and updates styles after theme toggle', async () => {
    context = await setupExtension();
    page = await openMockConversation(context, { conversationId: 'copy-button-theme', theme: 'light' });

    const copyButton = page.locator('.ce-copy-md-button').first();
    await expect(copyButton).toBeVisible();
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.getAttribute('data-ce-copy-md-theme'))
    ).toBe('light');

    const lightColor = await copyButton.evaluate((el) => getComputedStyle(el).color);
    expect(lightColor).toContain('55, 65, 81');

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.getAttribute('data-ce-copy-md-theme'))
    ).toBe('dark');

    await expect
      .poll(async () => copyButton.evaluate((el) => getComputedStyle(el).color), { timeout: 5_000 })
      .toContain('229, 231, 235');
  });

  test('shows bubble Copy as MD button for text selection in dark mode', async () => {
    context = await setupExtension();
    page = await openMockConversation(context, { conversationId: 'bubble-dark', theme: 'dark' });

    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.getAttribute('data-ce-copy-md-theme'))
    ).toBe('dark');

    await selectAssistantText(page);
    const bubbleButton = page.locator('.ce-bubble-copy-button').first();
    await expect(bubbleButton).toBeVisible();

    const bubbleColor = await bubbleButton.evaluate((el) => getComputedStyle(el).color);
    expect(bubbleColor).toContain('229, 231, 235');
  });
});
