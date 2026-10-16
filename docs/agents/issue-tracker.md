# 问题跟踪：本地 Markdown

本项目的需求与任务以 Markdown 文件保存在 `.scratch/` 下。

## 文件约定

- 每个功能使用一个目录：`.scratch/<功能名>/`
- 规格说明放在 `.scratch/<功能名>/spec.md`
- 每项实现任务单独保存为 `.scratch/<功能名>/issues/<编号>-<简短名称>.md`，从 `01` 开始编号，不把多个任务合并到一个文件
- 讨论记录追加到文件末尾的 `## 讨论` 标题下

## 技能要求“发布到问题跟踪器”时

在 `.scratch/<功能名>/` 下创建文件；目录不存在时一并创建。

## 技能要求“获取相关任务”时

读取用户提供的文件路径或任务编号所对应的文件。

## Wayfinder 文件约定

- **任务地图**：`.scratch/<工作项>/map.md`，正文记录 Notes、Decisions-so-far 和 Fog
- **子任务**：`.scratch/<工作项>/issues/<编号>-<简短名称>.md`，从 `01` 开始编号；正文写明问题
- **类型**：用 `Type:` 行标记，值为 `research`、`prototype`、`grilling` 或 `task`
- **状态**：用 `Status:` 行标记，值为 `claimed` 或 `resolved`
- **依赖**：用 `Blocked by: 01, 02` 行列出依赖任务；所有依赖文件都标记为 `resolved` 后，任务才算解除阻塞
- **待处理任务**：扫描 `.scratch/<工作项>/issues/`，选择编号最小、未解决、无阻塞且尚未认领的任务
- **认领任务**：先将 `Status:` 更新为 `claimed` 并保存，再开始工作
- **完成任务**：在 `## Answer` 下追加答案，将状态更新为 `resolved`，再把简要结论和链接追加到 `map.md` 的 Decisions-so-far 中
