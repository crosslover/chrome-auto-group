import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

export const extensionPath = path.resolve('extension');

export async function launchExtension(userDataDir = '', browserArgs: string[] = []) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      ...browserArgs,
    ],
  });
  // All web pages are local fixtures: no test depends on DNS or public websites.
  await context.route(/^https?:/, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Website fixture</title>',
  }));
  return context;
}

export async function extensionWorker(context: BrowserContext) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  // The target can appear before the newly-installed extension has executed its script.
  await worker.evaluate(() => chrome.runtime.getManifest());
  return worker;
}

export const test = base.extend<{ browserContext: BrowserContext; browserTabs: Worker }>({
  browserContext: async ({}, use) => {
    const context = await launchExtension();
    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
  browserTabs: async ({ browserContext }, use) => {
    await use(await extensionWorker(browserContext));
  },
});

export { expect } from '@playwright/test';

export async function openTab(worker: Worker, url: string, windowId?: number) {
  return worker.evaluate(async ({ url, windowId }) => {
    const tab = await chrome.tabs.create({ url, windowId, active: false });
    if (tab.id === undefined) throw new Error('Chrome did not create a tab');
    return { id: tab.id, windowId: tab.windowId };
  }, { url, windowId });
}

export async function groupFor(worker: Worker, tabId: number) {
  return worker.evaluate(async id => {
    const tab = await chrome.tabs.get(id);
    if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return null;
    try {
      const group = await chrome.tabGroups.get(tab.groupId);
      return { id: group.id, title: group.title, windowId: group.windowId };
    } catch (error) {
      // A navigation can move the last member and remove its old group between reads.
      if (String(error).includes('No group with id:')) return null;
      throw error;
    }
  }, tabId);
}
