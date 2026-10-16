# 自动标签页分组

Manifest V3 扩展，按网站标识整理新建的普通 HTTP/HTTPS 标签页；跨站导航时按当前组标题决定是否换组，每个窗口独立创建或复用小写标题的 Chrome 原生标签组。

要求 Chrome 102 或更高版本。仅在浏览器 session 内存中暂存等待首次网页地址的标签 ID，使空白新标签页在后台休眠后仍能分组；不保存网址或分组来源，不写磁盘、不同步、不联网，也不在启动时扫描已有标签页。公共后缀采用内置的常见多段后缀表。

## 开发与验证

使用 Node.js 22 或更高版本，以及 pnpm 10.28.2：

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --no-shell
pnpm typecheck
pnpm test
```

测试在独立的临时 Chromium 配置目录中加载 `extension/`，通过 Chrome 公共 API 创建标签页，并断言原生标签组标题、成员关系及窗口隔离。网页请求由测试固定内容响应，不依赖真实网站。

运行某个行为场景：`pnpm test tests/auto-group.spec.ts -g '场景名称'`。

## 使用

在 Chrome 的 `chrome://extensions` 中启用开发者模式，选择“加载已解压的扩展程序”并选中 `extension/` 目录。

点击扩展工具栏图标，再点击“整理当前窗口”，即可整理当前窗口尚未分组的 HTTP/HTTPS 网页；已有标签组、特殊页面和其他窗口保持原样。

已分组网页跨站导航时，当前组标题若是网站识别规则可以产生的小写网站标识（包括未知域名主体），则自动换组。其他标题（如“工作资料”）保留用户安排。手动创建且标题恰好与网站标识相同的组也会按自动组处理；扩展不记录分组来源。

发布包由后续票据完成。
