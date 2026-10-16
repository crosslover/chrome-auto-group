// Match complete hostname labels; these are names, not domain-to-brand aliases.
const websiteNames = new Set([
  // International: search, media, communities, commerce, development, AI and work.
  'google', 'bing', 'duckduckgo', 'yahoo', 'yandex',
  'youtube', 'netflix', 'twitch', 'spotify', 'vimeo',
  'facebook', 'instagram', 'threads', 'twitter', 'x', 'reddit', 'linkedin',
  'discord', 'telegram', 'whatsapp', 'pinterest', 'quora',
  'wikipedia', 'medium', 'substack', 'bbc', 'cnn', 'nytimes', 'reuters',
  'amazon', 'ebay', 'etsy', 'paypal', 'stripe', 'airbnb', 'booking',
  'microsoft', 'apple', 'github', 'gitlab', 'stackoverflow', 'stackexchange', 'leetcode',
  'npmjs', 'pypi', 'docker', 'cloudflare', 'amazonaws', 'vercel', 'netlify',
  'openai', 'chatgpt', 'anthropic', 'claude', 'perplexity', 'huggingface',
  'notion', 'figma', 'canva', 'slack', 'zoom', 'dropbox', 'atlassian', 'office', 'outlook',

  // China: search, communities, video, shopping, news, cloud, tools and services.
  'baidu', 'sogou', 'so', '360', 'qq', 'tencent', 'weibo', 'zhihu', 'douban', 'xiaohongshu',
  'bilibili', 'douyin', 'kuaishou', 'toutiao', 'ixigua', 'iqiyi', 'youku', 'mgtv', 'huya', 'douyu',
  'taobao', 'tmall', 'jd', 'pinduoduo', 'yangkeduo', '1688', 'alibaba', 'alipay',
  'meituan', 'dianping', 'eleme',
  '163', '126', 'sina', 'sohu', 'ifeng', 'xinhuanet', 'people', 'cctv', 'thepaper',
  'aliyun', 'huaweicloud', 'tencentcloud', 'volcengine',
  'csdn', 'cnblogs', 'juejin', 'segmentfault', 'oschina', 'gitee', 'coding', 'nowcoder',
  'feishu', 'dingtalk', 'yuque', 'kdocs', 'wps', 'shimo',
  'deepseek', 'doubao', 'kimi', 'moonshot', 'minimax', 'bigmodel', 'zhipuai', 'qwen', 'tongyi',
  'ctrip', 'qunar', '12306', 'amap', 'eastmoney', 'xueqiu', 'xiaomi', 'mi', 'huawei',
]);

// Deliberately small, bundled suffix table; no network updates or domain mappings.
const multiLabelSuffixes = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.hk', 'com.tw',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'co.kr',
  'com.au', 'net.au', 'org.au', 'co.nz', 'co.in',
  'com.br', 'com.sg', 'com.mx', 'com.tr', 'co.za',
]);

/** @param {number} tabId */
async function groupNewTab(tabId) {
  // session is browser memory, surviving worker suspension but not browser restarts.
  const pendingKey = `pending:${tabId}`;
  if (!(await chrome.storage.session.get(pendingKey))[pendingKey]) return;
  const tab = await chrome.tabs.get(tabId);
  if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    await chrome.storage.session.remove(pendingKey);
    return;
  }
  const url = new URL(tab.pendingUrl || tab.url || 'about:blank');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const hostname = url.hostname.replace(/\.$/, '');
  const hostnameLabels = hostname.split('.');
  const suffixLength = multiLabelSuffixes.has(hostnameLabels.slice(-2).join('.')) ? 2 : 1;
  const labels = hostnameLabels.slice(0, -suffixLength).filter(label => label !== 'www');
  const isAddressOrLocalHost = hostname.startsWith('[') || /^\d+(\.\d+){3}$/.test(hostname) || hostnameLabels.length === 1;
  const title = isAddressOrLocalHost ? hostname
    : [...labels].reverse().find(label => websiteNames.has(label)) || labels.at(-1);
  await chrome.storage.session.remove(pendingKey);
  if (!title) return;
  const [existing] = await chrome.tabGroups.query({ windowId: tab.windowId, title });
  if (existing) {
    await chrome.tabs.group({ tabIds: tabId, groupId: existing.id });
  } else {
    const groupId = await chrome.tabs.group({ tabIds: tabId, createProperties: { windowId: tab.windowId } });
    await chrome.tabGroups.update(groupId, { title });
  }
}

// Serialize marker changes and query/create/title so concurrent tabs share one group.
let pendingWork = Promise.resolve();
/** @param {() => Promise<void>} operation */
function enqueue(operation) {
  pendingWork = pendingWork.then(operation).catch(console.error);
}

chrome.tabs.onCreated.addListener(tab => {
  if (tab.id === undefined) return;
  const tabId = tab.id;
  enqueue(async () => {
    await chrome.storage.session.set({ [`pending:${tabId}`]: true });
    await groupNewTab(tabId);
  });
});

chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url || change.status || change.groupId !== undefined) {
    enqueue(() => groupNewTab(tabId));
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  enqueue(() => chrome.storage.session.remove(`pending:${tabId}`));
});
