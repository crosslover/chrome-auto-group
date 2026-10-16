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

## 打包

在仓库根目录执行（需要 Node.js 22+、pnpm 和系统 `zip` 命令；macOS 自带，Linux 可安装 `zip`）：

```sh
pnpm package
```

生成 `dist/chrome-auto-group-0.1.0.zip`，文件名中的版本号取自 `extension/manifest.json`。打包本身不下载依赖、不联网；每次重新生成 ZIP，只包含 manifest、后台脚本、弹窗 HTML/JS 和 16/32/48/128 像素 PNG 图标，不包含源码仓库、测试或开发依赖。

ZIP 根目录直接包含 `manifest.json`，可由用户自行提交 Chrome Web Store。所有运行时代码和资源均在包内，无远程代码或网络服务依赖。版本更新时先递增 manifest 的 `version`，再重新打包。

验证实际提交包（需要系统 `unzip`；使用全新的解压目录，避免残留旧文件）：

```sh
unzip -t dist/chrome-auto-group-0.1.0.zip
unzip dist/chrome-auto-group-0.1.0.zip -d dist/unpacked
EXTENSION_PATH=dist/unpacked pnpm test
```

也可在 `chrome://extensions` 中启用开发者模式，点击“加载已解压的扩展程序”，选择解压后的 `dist/unpacked/`，验证自动分组、跨站导航和工具栏整理功能。Chrome 不能直接以未打包模式加载 ZIP。

`tabs` 用于读取标签页 URL，`tabGroups` 用于管理原生标签组，`storage` 仅用于上述 session 内存标记。商店填写权限用途时可据此说明。此命令仅生成扩展包；商店页面文字、截图等素材和开发者账号操作由用户另行准备，最终提交仍需经过商店审核。

打包格式和图标要求参考 Chrome 官方的[提交前准备](https://developer.chrome.com/docs/webstore/prepare)及[manifest 图标](https://developer.chrome.com/docs/extensions/reference/manifest/icons)文档。
