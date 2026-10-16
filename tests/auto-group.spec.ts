import { test, expect, openTab, groupFor } from './fixtures.js';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('新建普通网页标签页进入小写网站标识的标签组', async ({ browserTabs }) => {
  const tab = await openTab(browserTabs, 'https://WWW.Google.COM/search');
  await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({
    title: 'google', windowId: tab.windowId,
  });
});

test('未知网站使用注册域名主体作为网站标识', async ({ browserTabs }) => {
  const tab = await openTab(browserTabs, 'https://docs.example.com/guide');
  await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'example' });
});

test('网站标识优先命中注册域名主体，否则选择最近的完整名称标签', async ({ browserTabs }) => {
  for (const [hostname, title] of [
    ['notgoogle.com', 'notgoogle'],
    ['google.example.com', 'google'],
    ['youtu.be', 'youtu'],
    ['youtube.google.com', 'google'],
    ['youtube.google.example.com', 'google'],
    ['google.youtube.example.com', 'youtube'],
    ['www.bing.google', 'bing'],
  ]) {
    const tab = await openTab(browserTabs, `https://${hostname}/`);
    await expect.poll(() => groupFor(browserTabs, tab.id), { message: hostname })
      .toMatchObject({ title });
  }
});

test('忽略 www 与常见多段公共后缀，支持 HTTP 网页', async ({ browserTabs }) => {
  for (const [hostname, title] of [
    ['www.mail.google.co.uk', 'google'],
    ['docs.example.co.uk', 'example'],
    ['www.example.com.cn', 'example'],
    ['store.example.com.au', 'example'],
    ['www.example.co.jp', 'example'],
  ]) {
    const tab = await openTab(browserTabs, `http://${hostname}/`);
    await expect.poll(() => groupFor(browserTabs, tab.id), { message: hostname })
      .toMatchObject({ title });
  }
});

test('同一窗口连续或同时打开相同网站时复用唯一标签组', async ({ browserTabs }) => {
  const first = await openTab(browserTabs, 'https://www.google.com/');
  await expect.poll(() => groupFor(browserTabs, first.id)).toMatchObject({ title: 'google' });
  const firstGroup = await groupFor(browserTabs, first.id);
  const tabs = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    openTab(browserTabs, `https://mail.google.com/${i}`, first.windowId)));
  for (const tab of tabs) {
    await expect.poll(() => groupFor(browserTabs, tab.id)).toEqual(firstGroup);
  }
  const groups = await browserTabs.evaluate(windowId =>
    chrome.tabGroups.query({ windowId, title: 'google' }), first.windowId);
  expect(groups).toHaveLength(1);
});

test('同时首次打开同一网站也只创建一个标签组', async ({ browserTabs }) => {
  const tabs = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    openTab(browserTabs, `https://youtube.com/${i}`)));
  for (const tab of tabs) {
    await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'youtube' });
  }
  const groups = await browserTabs.evaluate(windowId =>
    chrome.tabGroups.query({ windowId, title: 'youtube' }), tabs[0].windowId);
  expect(groups).toHaveLength(1);
  const groupIds = await Promise.all(tabs.map(async tab => (await groupFor(browserTabs, tab.id))?.id));
  expect(new Set(groupIds)).toEqual(new Set([groups[0].id]));
});

test('新标签页先为空白页，首次进入普通网页后仍会自动分组', async ({ browserTabs }) => {
  const tab = await openTab(browserTabs, 'about:blank');
  expect(await groupFor(browserTabs, tab.id)).toBeNull();
  await browserTabs.evaluate(id => chrome.tabs.update(id, { url: 'https://bing.com/' }), tab.id);
  await expect.poll(() => groupFor(browserTabs, tab.id)).toMatchObject({ title: 'bing' });
});

test('不同窗口独立创建同名标签组', async ({ browserTabs }) => {
  const first = await openTab(browserTabs, 'https://google.com/');
  const secondWindowId = await browserTabs.evaluate(async () => {
    const window = await chrome.windows.create({ url: 'about:blank', focused: false });
    if (window?.id === undefined) throw new Error('Chrome did not create a window');
    return window.id;
  });
  const second = await openTab(browserTabs, 'https://mail.google.com/', secondWindowId);
  await expect.poll(() => groupFor(browserTabs, first.id)).toMatchObject({
    title: 'google', windowId: first.windowId,
  });
  await expect.poll(() => groupFor(browserTabs, second.id)).toMatchObject({
    title: 'google', windowId: secondWindowId,
  });
  expect((await groupFor(browserTabs, first.id))?.id)
    .not.toBe((await groupFor(browserTabs, second.id))?.id);
});

test('特殊 URL 保持未分组', async ({ browserTabs }) => {
  const extensionOrigin = `chrome-extension://${new URL(browserTabs.url()).host}`;
  const tabs = [];
  for (const url of [
    'chrome://version/',
    'chrome://newtab/',
    `${extensionOrigin}/manifest.json`,
    pathToFileURL(path.resolve('README.md')).href,
    'about:blank',
    'data:text/html,<title>Local page</title>',
  ]) {
    tabs.push(await openTab(browserTabs, url));
  }
  // A positive grouping result lets preceding event handling finish before negative assertions.
  const webTab = await openTab(browserTabs, 'https://bing.com/');
  await expect.poll(() => groupFor(browserTabs, webTab.id)).toMatchObject({ title: 'bing' });
  for (const tab of tabs) expect(await groupFor(browserTabs, tab.id)).toBeNull();
});

test('新标签页已被手动分组时不覆盖用户安排', async ({ browserTabs }) => {
  const tab = await openTab(browserTabs, 'about:blank');
  const groupId = await browserTabs.evaluate(async id => {
    const groupId = await chrome.tabs.group({ tabIds: id });
    await chrome.tabGroups.update(groupId, { title: '工作资料' });
    await chrome.tabs.update(id, { url: 'https://google.com/' });
    return groupId;
  }, tab.id);
  const sentinel = await openTab(browserTabs, 'https://bing.com/');
  await expect.poll(() => groupFor(browserTabs, sentinel.id)).toMatchObject({ title: 'bing' });
  expect(await groupFor(browserTabs, tab.id)).toMatchObject({ id: groupId, title: '工作资料' });
});

test('本地主机与 IP 网页使用完整主机名，域名末尾根点不改变网站标识', async ({ browserTabs }) => {
  for (const [hostname, title] of [
    ['localhost', 'localhost'],
    ['127.0.0.1', '127.0.0.1'],
    ['[::1]', '[::1]'],
    ['docs.example.com.', 'example'],
  ]) {
    const tab = await openTab(browserTabs, `http://${hostname}/`);
    await expect.poll(() => groupFor(browserTabs, tab.id), { message: hostname })
      .toMatchObject({ title });
  }
});
