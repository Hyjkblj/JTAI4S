# 飞书实测脱敏证据

本目录只保存可公开提交的结构化摘要，不保存原始租户响应。

脱敏规则：

- App ID、Open ID、姓名、Token、授权 URL 和设备码一律删除或替换为占位符；
- 不保存真实会议标题、参与人、逐字稿和文档 Token；
- `private/` 与 `raw/` 已由 `.gitignore` 排除；
- `observed` 字段只记录实际调用结果，不将“命令存在”表述为“真实产物已验证”。

当前证据覆盖用户 OAuth 状态、空结果会议检索、三类事件订阅握手、一场授权测试会议的脱敏 E2E 结果，以及一次 Base / 任务 / Docx 的真实写回读回验证。E2E 和写回证据只记录链路、字段命中与错误类型，不保存原始逐字稿、飞书资源标识符或个人标识符。

`minutes-detail-transcript.sample.redacted.json` 是仿照 `lark-cli minutes +detail --transcript` 产物形状整理的脱敏/合成样例，用于测试 transcript 规范化适配器。真实妙记响应应放在 `.tmp/` 或 `fixtures/feishu/private/`，不要提交。
