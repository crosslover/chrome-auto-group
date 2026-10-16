# 自动标签页分组

Manifest V3 扩展，按网站标识整理新建的普通 HTTP/HTTPS 标签页；每个窗口独立创建或复用小写标题的 Chrome 原生标签组。

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

本票据只实现新标签页自动分组；跨站导航换组、工具栏整理和发布包分别由后续票据完成。
