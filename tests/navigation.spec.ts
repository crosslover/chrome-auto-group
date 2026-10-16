import { test, expect, openTab, groupFor } from './fixtures.js';

test('跨站导航创建目标网站标签组，并复用当前窗口已有的目标组', async ({ browserTabs }) => {
  const tab = await openTab(browserTabs, 'https://google.com/');
  await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'google' });
  await browserTabs.evaluate(id => chrome.tabs.update(id, { url: 'https://youtube.com/' }), tab.id);
  await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'youtube' });

  const target = await openTab(browserTabs, 'https://bing.com/');
  await expect.poll(() => groupFor(browserTabs, target.id)).toMatchObject({ title: 'bing' });
  const targetGroup = await groupFor(browserTabs, target.id);
  await browserTabs.evaluate(id => chrome.tabs.update(id, { url: 'https://bing.com/search' }), tab.id);
  await expect.poll(() => groupFor(browserTabs, tab.id)).toEqual(targetGroup);
});

for (const title of ['工作资料', 'Research', 'google.com', 'two words', '']) {
  test(`手动组“${title}”导航后保持原组`, async ({ browserTabs }) => {
    const tab = await openTab(browserTabs, 'https://google.com/');
    await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'google' });
    const original = await groupFor(browserTabs, tab.id);
    await browserTabs.evaluate(async ({ id, groupId, title }) => {
      await chrome.tabGroups.update(groupId, { title });
      await chrome.tabs.update(id, { url: 'https://youtube.com/' });
    }, { id: tab.id, groupId: original!.id, title });
    const sentinel = await openTab(browserTabs, 'https://bing.com/');
    await expect.poll(() => groupFor(browserTabs, sentinel.id)).toMatchObject({ title: 'bing' });
    expect(await groupFor(browserTabs, tab.id)).toEqual({ ...original, title });
  });
}

for (const title of ['google', 'notgoogle', 'localhost', '127.0.0.1', '[::1]', '1688']) {
  test(`手动创建的有效网站标识组“${title}”也按标题换组`, async ({ browserTabs }) => {
    const tab = await openTab(browserTabs, 'about:blank');
    await browserTabs.evaluate(async ({ id, title }) => {
      const groupId = await chrome.tabs.group({ tabIds: id });
      await chrome.tabGroups.update(groupId, { title });
      await chrome.tabs.update(id, { url: 'https://docs.example.com/' });
    }, { id: tab.id, title });
    await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'example' });
  });
}

test('导航只复用所在窗口的目标组，特殊网页导航保持原组', async ({ browserTabs }) => {
  const other = await openTab(browserTabs, 'https://youtube.com/');
  await expect.poll(() => groupFor(browserTabs, other.id)).toMatchObject({ title: 'youtube' });
  const windowId = await browserTabs.evaluate(async () => (await chrome.windows.create({ url: 'about:blank' }))!.id!);
  const tab = await openTab(browserTabs, 'https://google.com/', windowId);
  await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'google' });
  await browserTabs.evaluate(id => chrome.tabs.update(id, { url: 'https://youtube.com/' }), tab.id);
  await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'youtube', windowId });
  expect((await groupFor(browserTabs, tab.id))!.id).not.toBe((await groupFor(browserTabs, other.id))!.id);
  const original = await groupFor(browserTabs, tab.id);
  await browserTabs.evaluate(id => chrome.tabs.update(id, { url: 'chrome://version/' }), tab.id);
  const sentinel = await openTab(browserTabs, 'https://bing.com/', windowId);
  await expect.poll(() => groupFor(browserTabs, sentinel.id)).toMatchObject({ title: 'bing' });
  expect(await groupFor(browserTabs, tab.id)).toEqual(original);
});
