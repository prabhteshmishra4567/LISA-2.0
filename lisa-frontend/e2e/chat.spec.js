import { test, expect } from '@playwright/test';

async function send(page, text) {
  await page.getByLabel('Message LISA').fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop response' })).toHaveCount(0);
}

test('chat keeps context across reload, renders Markdown, exports, renames and deletes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await send(page, 'Remember my project');
  await expect(page.locator('.message-content strong')).toHaveText('Test answer');
  await expect(page.locator('.message-content pre')).toContainText('const working = true;');
  await send(page, 'Follow up');
  await expect(page.locator('.message.assistant').last()).toContainText('Previous messages: 2');
  await page.reload();
  await expect(page.locator('.message')).toHaveCount(4);
  const downloadPromise = page.waitForEvent('download');
  await page.getByLabel('Export conversation').click();
  expect((await downloadPromise).suggestedFilename()).toBe('lisa-conversation.md');
  await page.getByRole('button', { name: 'Rename Remember my project' }).click();
  await page.getByLabel('Title', { exact: true }).fill('My workspace');
  await page.getByRole('button', { name: 'Save title' }).click();
  await expect(page.getByRole('heading', { name: 'My workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete My workspace' }).click();
  await page.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: /A little curiosity/ })).toBeVisible();
  await expect(page.locator('.message')).toHaveCount(0);
});

test('research displays source links and search suggestions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await send(page, 'Research a topic');
  await expect(page.getByRole('link', { name: '1. Example source' })).toHaveAttribute('href', 'https://example.com');
  await expect(page.frameLocator('iframe').getByText('Search suggestions')).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
});

test('failed and stopped requests restore the draft without saving duplicate messages', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await send(page, 'fail request');
  await expect(page.getByLabel('Message LISA')).toHaveValue('fail request');
  await expect(page.getByRole('status')).toContainText('quota');
  await expect(page.locator('.message')).toHaveCount(0);
  await page.getByLabel('Message LISA').fill('slow request');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Stop response' }).click();
  await expect(page.getByLabel('Message LISA')).toHaveValue('slow request');
  await expect(page.locator('.message')).toHaveCount(0);
  await send(page, 'Successful retry');
  await expect(page.locator('.message')).toHaveCount(2);
});

test('local actions use safe links and voice gracefully falls back when unavailable', async ({ page }) => {
  await page.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Start voice conversation')).toBeDisabled();
  await send(page, 'open youtube');
  await expect(page.getByRole('link', { name: 'Open youtube' })).toHaveAttribute('href', 'https://www.youtube.com');
  await expect(page.getByRole('link', { name: 'Open youtube' })).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByLabel('Switch to light theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('voice mode switches the whole interface, sends speech, answers aloud and returns to chat', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        if (this.sent) return setTimeout(() => this.onend?.(), 0);
        this.sent = true;
        this.onresult({ results: [[{ transcript: this.lang === 'hi-IN' ? 'नमस्ते लिसा' : 'Hello LISA' }]] });
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {}
    };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, getVoices() { return []; }, speak(utterance) {
        setTimeout(() => utterance.onstart?.(), 0);
        setTimeout(() => utterance.onend?.(), 20);
      },
    } });
  });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Preferences/ }).click();
  await page.getByLabel('Voice language').selectOption('hi-IN');
  await page.getByLabel('Close preferences').click();
  await page.getByLabel('Start voice conversation').click();
  await expect(page.getByText('LISA Live', { exact: true })).toBeVisible();
  await expect(page.locator('.voice-turn.user')).toContainText('नमस्ते लिसा');
  await expect(page.locator('.voice-turn.assistant')).toContainText('Test answer');
  await page.getByRole('button', { name: 'Switch to chat' }).click();
  await expect(page.getByLabel('Message LISA')).toBeVisible();
});

test('mobile navigation and composer fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A little curiosity/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible();
  await page.getByLabel('Open navigation').click();
  await expect(page.getByRole('button', { name: /New conversation/ })).toBeVisible();
  await page.getByRole('button', { name: /New conversation/ }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: 'test-results/lisa-mobile.png', fullPage: true });
});

test('desktop welcome screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Make room for ideas/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/lisa-desktop.png', fullPage: true });
});
