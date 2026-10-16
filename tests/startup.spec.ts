import { test, expect, openTab, groupFor, launchExtension, extensionWorker } from './fixtures.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('扩展重新启动不重整已有标签页，仍能处理后续新建标签页', async ({ browserContext, browserTabs }) => {
  const existing = await openTab(browserTabs, 'https://google.com/');
  await expect.poll(() => groupFor(browserTabs, existing.id)).toMatchObject({ title: 'google' });
  await browserTabs.evaluate(id => chrome.tabs.ungroup(id), existing.id);

  const cdp = await browserContext.newCDPSession(browserContext.pages()[0]);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  await cdp.detach();

  // Opening a page wakes the suspended extension through a real Chrome tab event.
  const page = await browserContext.newPage();
  await page.goto('https://bing.com/');
  const worker = browserTabs;

  // Existing, ungrouped pages stay untouched even when they later finish navigating.
  await worker.evaluate(id => chrome.tabs.update(id, { url: 'https://youtube.com/' }), existing.id);
  const [newTab] = await worker.evaluate(() => chrome.tabs.query({ url: 'https://bing.com/' }));
  await expect.poll(() => groupFor(worker, newTab.id!)).toMatchObject({ title: 'bing' });
  expect(await groupFor(worker, existing.id)).toBeNull();
});

test('浏览器恢复已有会话时不自动重整标签页', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'chrome-auto-group-startup-'));
  let context = await launchExtension(profile);
  try {
    let worker = await extensionWorker(context);
    const page = await context.newPage();
    await page.goto('https://startup.example.test/');
    const [tab] = await worker.evaluate(() => chrome.tabs.query({ url: 'https://startup.example.test/' }));
    const tabId = tab.id;
    if (tabId === undefined) throw new Error('Chrome did not open the session page');
    await expect.poll(() => groupFor(worker, tabId)).toMatchObject({ title: 'example' });
    await worker.evaluate(id => chrome.tabs.ungroup(id), tabId);
    await context.close();

    context = await launchExtension(profile, ['--restore-last-session']);
    worker = await extensionWorker(context);
    await expect.poll(async () => {
      const tabs = await worker.evaluate(() => chrome.tabs.query({}));
      return tabs.some(tab => (tab.pendingUrl || tab.url) === 'https://startup.example.test/');
    }, { message: 'Chrome restored the prior session' }).toBe(true);
    const restored = (await worker.evaluate(() => chrome.tabs.query({})))
      .find(tab => (tab.pendingUrl || tab.url) === 'https://startup.example.test/')!;
    const newTab = await openTab(worker, 'https://bing.com/');
    await expect.poll(() => groupFor(worker, newTab.id)).toMatchObject({ title: 'bing' });
    expect(await groupFor(worker, restored.id!)).toBeNull();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('空白标签页等待期间 worker 重启后首次网页导航仍会分组', async ({ browserContext, browserTabs }) => {
  const page = await browserContext.newPage();
  await page.goto('about:blank#awaiting-first-webpage');
  const tab = (await browserTabs.evaluate(() => chrome.tabs.query({})))
    .find(tab => tab.url === 'about:blank#awaiting-first-webpage')!;
  // Let creation events finish through an observable result before simulating idle suspension.
  const sentinel = await openTab(browserTabs, 'https://bing.com/');
  await expect.poll(() => groupFor(browserTabs, sentinel.id)).toMatchObject({ title: 'bing' });
  const cdp = await browserContext.newCDPSession(browserContext.pages()[0]);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  await cdp.detach();
  // The browser navigation event, rather than a new tab, wakes the worker.
  await page.goto('https://google.com/');
  await expect.poll(() => groupFor(browserTabs, tab.id!)).toMatchObject({ title: 'google' });
});
