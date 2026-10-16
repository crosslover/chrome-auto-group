import { test, expect, openTab, groupFor } from './fixtures.js';

test('工具栏整理当前窗口只处理未分组网页，保留已有组和其他窗口', async ({ browserContext, browserTabs }) => {
  const existing = await openTab(browserTabs, 'https://google.com/');
  await expect.poll(() => groupFor(browserTabs, existing.id)).toMatchObject({ title: 'google' });
  const existingGroup = await groupFor(browserTabs, existing.id);
  const manual = await openTab(browserTabs, 'https://youtube.com/');
  await expect.poll(() => groupFor(browserTabs, manual.id)).toMatchObject({ title: 'youtube' });
  const manualGroup = await groupFor(browserTabs, manual.id);
  await browserTabs.evaluate(id => chrome.tabGroups.update(id, { title: '工作资料' }), manualGroup!.id);
  const loose = [];
  for (const url of ['https://mail.google.com/', 'https://docs.example.com/', 'https://store.example.com/']) {
    const tab = await openTab(browserTabs, url);
    await expect.poll(() => groupFor(browserTabs, tab.id)).not.toBeNull();
    await browserTabs.evaluate(id => chrome.tabs.ungroup(id), tab.id);
    loose.push(tab);
  }
  const special = await openTab(browserTabs, 'chrome://version/');
  const otherWindow = await browserTabs.evaluate(async () => (await chrome.windows.create({ url: 'about:blank' }))!.id!);
  const other = await openTab(browserTabs, 'https://bing.com/', otherWindow);
  await expect.poll(() => groupFor(browserTabs, other.id)).toMatchObject({ title: 'bing' });
  await browserTabs.evaluate(id => chrome.tabs.ungroup(id), other.id);

  // Open the manifest-declared toolbar popup in the target window, then use its real button.
  const popupPath = await browserTabs.evaluate(() => chrome.runtime.getManifest().action?.default_popup);
  expect(popupPath).toBeTruthy();
  const origin = `chrome-extension://${new URL(browserTabs.url()).host}`;
  const popupUrl = `${origin}/${popupPath}`;
  const popupTab = await openTab(browserTabs, popupUrl, existing.windowId);
  await expect.poll(() => browserContext.pages().some(page => page.url() === popupUrl)).toBe(true);
  const popup = browserContext.pages().find(page => page.url() === popupUrl)!;
  await popup.getByRole('button', { name: '整理当前窗口', exact: true }).click();
  await expect(popup.getByRole('status')).toHaveText('整理完成');
  expect(await groupFor(browserTabs, loose[0].id)).toEqual(existingGroup);
  const exampleGroup = await groupFor(browserTabs, loose[1].id);
  expect(exampleGroup).toMatchObject({ title: 'example', windowId: existing.windowId });
  expect(await groupFor(browserTabs, loose[2].id)).toEqual(exampleGroup);
  expect(await groupFor(browserTabs, existing.id)).toEqual(existingGroup);
  expect(await groupFor(browserTabs, manual.id)).toEqual({ ...manualGroup, title: '工作资料' });
  for (const tab of [special, other, popupTab]) expect(await groupFor(browserTabs, tab.id)).toBeNull();
  // Repeating the action preserves the same groups and membership.
  await popup.getByRole('button', { name: '整理当前窗口', exact: true }).click();
  await expect(popup.getByRole('status')).toHaveText('整理完成');
  expect(await groupFor(browserTabs, loose[1].id)).toEqual(exampleGroup);
});
