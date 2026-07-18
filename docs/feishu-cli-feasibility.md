# 飞书 CLI P0 可行性验证报告

| 项目 | 当前结果 |
|---|---|
| 验证日期 | 2026-07-17 至 2026-07-18 |
| CLI | `lark-cli 1.0.72` |
| Node.js / npm | `v24.11.0` / `11.6.1` |
| 当前状态 | **读写门禁通过**：真实会议、事件、Note、Minutes、带时间戳逐字稿、Base、任务和 Docx 写回均已实测 |
| 数据安全 | 仓库仅包含明确标注的合成数据；未保存 App Secret、Token 或授权链接 |

## 1. 初步结论

飞书 CLI 能覆盖 XtalLoop 比赛原型所需的会议定位、纪要/妙记产物读取、Base、任务、文档、知识库和事件消费能力。测试应用、用户 OAuth、真实会议事件、Minutes 逐字稿以及受控写回均已打通，可以进入“会议抽取 -> 人工审核 -> 飞书写回 -> 知识复用”的 P0 原型阶段。

当前判断：

- **会后自动闭环：读写侧均可行。** 已真实捕获会议结束、纪要生成与妙记生成事件，并完成 Base、任务、Docx 写回读回验证。
- **原始对话提取：已验证 Minutes 路径。** Note 与 Minutes 是两条独立产物链，不能混用 Token；`normal` Note 正文读取仍需文档域 Scope。
- **Base/任务/文档写回：真实租户验证通过。** 写回前完成 dry-run，写入后完成读回校验；Base 与 Docx 读权限需要在写权限之外单独授权。
- **所有会议实时转写：不可直接承诺。** CLI 中的录制转写批次事件仅适用于连接飞书软件的 `recording_bean`。
- **Obsidian 不能承担常驻事件消费。** 常驻消费者应运行在独立 Agent 服务中。

## 2. 已完成验证

### 2.1 本地环境与安装

- npm Registry 最新稳定版本为 `1.0.72`。
- 官方安装器成功全局安装 CLI 和配套 Agent Skills。
- `lark-cli help`、领域帮助、Schema 元数据和事件目录均可正常读取。
- CLI 明确区分 `read`、`write`、`high-risk-write`，并支持 `--dry-run`。
- CLI JSON 成功判断以 `ok == true` 或退出码 `0` 为准，不能按传统 OpenAPI 的 `code == 0` 判断。

### 2.2 会议和产物能力

| 目标 | 已确认命令 | 风险级别 | 状态 |
|---|---|---:|---|
| 搜索已结束会议 | `lark-cli vc +search` | read | 租户实测成功；测试会议前的 7 天及 30 天窗口返回 0 场 |
| 获取 `note_id` / `minute_token` | `lark-cli vc +detail` | read | 真实会议实测成功，两个关联字段均返回 |
| 获取纪要展示类型和文档 Token | `lark-cli note +detail` | read | 真实 Note 实测成功，类型为 `normal` |
| 获取 unified 原始逐字稿 | `lark-cli note +transcript` | read | 命令已确认；待 unified Note 样本 |
| 获取妙记总结/待办/章节/逐字稿 | `lark-cli minutes +detail` | read | 真实妙记实测成功；总结和逐字稿存在，待办与章节为空数组 |

### 2.3 已确认事件

| EventKey | 作用 | Scope | 身份 | XtalLoop 用途 |
|---|---|---|---|---|
| `vc.meeting.participant_meeting_ended_v1` | 当前用户参加的会议结束 | `vc:meeting.meetingevent:read` | user | 创建会议处理任务，但产物可能尚未就绪 |
| `vc.note.generated_v1` | 纪要生成 | `vc:note:read` | user | Note 路径的首选触发器 |
| `minutes.minute.generated_v1` | 妙记生成 | `minutes:minutes.basic:read` | user | Minutes 路径的首选触发器 |
| `task.task.update_user_access_v2` | 当前用户/应用可见任务发生变化 | `task:task:read` | user/bot | 回收任务执行状态 |
| `vc.recording.recording_transcript_generated_v1` | 录制转写片段生成 | `vc:recording:read` | user | 仅限 `recording_bean`，不能当作普通会议实时能力 |

事件的 `event_id` 可用于去重。`event consume` 是长驻阻塞进程，父进程必须等待 stderr 的 `[event] ready` 标记，禁止用固定 sleep 猜测就绪状态。

2026-07-17 使用 `xtal-reader` 对会议结束、Note 生成、Minutes 生成三类 EventKey 并行执行 30 秒有界烟测。三条通道均完成 PreConsume、WebSocket 连接、`ready` 标记、超时退出和清理，退出码均为 `0`；窗口内收到 0 个事件，符合当时无会议活动的预期。该结果证明订阅握手可用，不等价于已经验证真实事件载荷。

同日使用一场 3 分 19 秒的授权单人测试会议完成真实载荷验证。三类事件均到达并通过同一 `meeting_id` 关联；Minutes 事件相对会议结束约延迟 90 秒，Note 事件约延迟 106 秒。消费者在收到首个事件后正常清理，无孤儿订阅。

Minutes 逐字稿包含说话人和相对时间戳，并成功识别主要参数、建议、决策和风险。但测试同时发现：实验编号被插入空格，口述的 2026 年截止日期被识别为 2020 年；AI 待办和章节均为空。因此关键编号、日期和任务不能直接自动发布，必须经过规范化与人工审核。

### 2.4 受控写回验证

2026-07-18 使用独立 `xtal-writer` Profile 完成一次最小写回验证。写入前先对 Base 创建、Base 记录、任务创建和 Docx 创建执行 `--dry-run`，确认请求体后再真实执行。

| 目标 | 命令族 | 状态 | 读回结果 |
|---|---|---:|---|
| 创建结论审阅台 | `base +base-create` | 成功 | 新 Base 含 1 张表、12 个字段 |
| 写入实验审阅记录 | `base +record-upsert` | 成功 | `EXP-DEMO-002`、`IN_REVIEW`、温度/体积比/搅拌/风险字段均可读回 |
| 创建复核任务 | `task +create` | 成功 | 任务状态为 `todo`，截止日期为 2026-07-18 |
| 创建知识卡片 | `docs +create` | 成功 | 文档含“结论摘要、风险与复核、联动对象、复用建议”四部分 |

写回验证暴露两个工程细节：

1. Base 与 Docx 的读回校验需要额外只读 Scope：`base:record:read`、`docx:document:readonly`。
2. Windows PowerShell 下复杂 JSON/XML 应优先通过 `@file` 传入 CLI，避免空格、引号和中文内容被原生命令参数层拆分。

## 3. 正确的数据路由

### 3.1 Note 路径（会议开启 AI 总结）

```text
vc.note.generated_v1
  -> note_id
  -> note +detail
  -> note_display_type
     -> normal: docs +fetch(verbatim_doc_token)
     -> unified: note +transcript(note_id)
  -> 原始逐字稿
```

逐字稿含说话人和相对时间戳，可作为 SourceAnchor 的主要输入。

### 3.2 Minutes 路径（会议开启录制或上传音视频）

```text
minutes.minute.generated_v1
  -> minute_token
  -> minutes +detail --transcript --todo --chapter
  -> Transcript / Todo / Chapter
```

需要独立提炼研发参数和争议时必须基于 Transcript，不能只搬运飞书 AI Summary。

### 3.3 产物未就绪降级

如果只有会议结束事件，尚未收到 Note/Minutes 生成事件：

1. 以 `meeting_id` 创建唯一处理任务；
2. 调用 `vc +detail` 查询 `note_id` 和 `minute_token`；
3. 按 30 秒、1 分钟、2 分钟、5 分钟退避重试；
4. 10 分钟后仍无产物则进入人工异常队列；
5. 后续生成事件到达时复用同一幂等键继续处理。

## 4. 身份与权限设计

### 4.1 身份边界

- 会议、妙记、用户文档等个人资源主要需要 `--as user`。
- Bot 看不到用户个人资源，不能用 Bot 读取用户会议代替 OAuth。
- User 权限需要同时满足：开发者后台开通 Scope + 用户 OAuth 授权。
- Bot 缺权限时应在开发者后台补 Scope，不得对 Bot 执行 `auth login`。

### 4.2 计划 Profile

| Profile | 身份/权限 | 用途 |
|---|---|---|
| `xtal-reader` | user，只读会议、纪要、妙记、知识库 | 事件消费和证据读取 |
| `xtal-writer` | 独立应用/最小写权限 | 写测试 Base、任务和文档，并按需读回校验 |

真实写操作前必须先输出执行计划并使用 `--dry-run`。高风险写命令出现退出码 `10` 时，不得自动追加 `--yes`。

### 4.3 已验证授权

- `xtal-reader` 的 Bot 与 User 身份均为 `ready`、`verified=true`；User token 状态为 `valid`。
- 已授权最小只读 Scope：`vc:meeting.search:read`、`vc:meeting.meetingevent:read`、`vc:note:read`、`vc:record:readonly`、`minutes:minutes.basic:read`、`minutes:minutes.artifacts:read`。
- `xtal-writer` 已通过最小写回 Scope 验证：`base:app:create`、`base:table:read/create/update/delete`、`base:record:create/update/read`、`task:task:write`、`docx:document:create/readonly`。
- 仓库只保存脱敏状态，不保存姓名、Open ID、App ID、Token、授权 URL 或设备码。

## 5. 待完成租户实测

- [x] 完成测试应用配置和用户 OAuth
- [x] 创建并验证 `xtal-reader` Profile
- [x] 创建独立的 `xtal-writer` Profile
- [x] 保存 `auth status --json --verify` 的脱敏摘要
- [x] 取得一场授权会议的 `meeting_id`
- [x] 实测 Note 详情及 `normal` 展示类型
- [ ] 实测 `normal` Note 独立逐字稿文档正文读取
- [x] 实测 Minutes 路径 Transcript/章节/待办
- [x] 对目标 EventKey 做 30 秒有界消费测试
- [x] 对 Base、任务、文档执行 dry-run
- [x] 经用户确认后执行测试写入并读取校验
- [ ] 验证知识库空间可见性与节点权限

## 6. Go/No-Go 门槛

### Go

- 能取得带说话人和时间戳的逐字稿或 Transcript；
- 至少一个产物生成事件可在测试租户订阅；
- 能在指定测试空间写入并读回 Base、任务和文档；
- 无权限用户无法通过事件、查询或图关系获得内容。

### 降级 Go

真实会议权限暂不可用，但允许用明确标注的合成/脱敏文本导入完成比赛原型；材料必须写明接口依赖和未验证项。

### No-Go

- 无法合法取得任何带来源定位的会议文本；
- 检索前无法执行来源权限过滤；
- Agent 必须获得租户全局高权限才能完成基本闭环。

## 7. 当前证据

- `evaluation/golden-set.jsonl`：24 条合成会议样本、27 条人工标准 Claim；
- `schemas/scientific-claim.schema.json`：可追溯 Claim 数据契约；
- `schemas/golden-set-entry.schema.json`：黄金集条目数据契约；
- `fixtures/feishu/`：租户授权、会议检索和事件订阅的脱敏实测摘要；
- `fixtures/feishu/e2e-meeting-validation.redacted.json`：真实授权会议的无原文、无标识符 E2E 证据；
- `fixtures/feishu/writeback-validation.redacted.json`：Base、任务和 Docx 的真实写回读回脱敏证据；
- `npm test`：验证黄金集、SourceAnchor 一致性、Quote Hash、ID 唯一性及正反 Schema 样例。
