# XtalLoop P0 端到端演示报告

> 本报告由 `npm run demo:e2e` 自动生成，使用脱敏/合成飞书妙记样例，不包含真实飞书资源 URL、Token、Open ID 或原始企业会议正文。

## 1. 链路概览

```text
Feishu Minutes redacted sample
  -> normalized transcript
  -> rule-based extractor
  -> reviewable extraction bundle
  -> dry-run writeback plan
```

| 项目 | 结果 |
|---|---|
| 会议 ID | MTG-DEMO-002 |
| 实验 ID | EXP-DEMO-002 |
| 来源系统 | feishu_minutes |
| 数据来源 | deidentified |
| 发言片段 | 8 |
| 结构化 Claims | 9 |
| SourceAnchor 覆盖 | 9/9 |
| 待人工审阅 Claims | 9/9 |
| 写回命令计划 | 4 |
| Dry-run 命令 | 4/4 |

## 2. Claim 类型分布

| 项目 | 结果 |
|---|---|
| controversy | 1 |
| decision | 1 |
| insight | 1 |
| parameter | 1 |
| parameter_change | 2 |
| proposal | 1 |
| risk | 1 |
| task | 1 |

## 3. 写回计划安全边界

| 项目 | 结果 |
|---|---|
| 执行模式 | dry_run |
| 写入 Profile | xtal-writer |
| 写入身份 | user |
| 仅生成计划不执行 | 是 |
| 默认 dry-run | 是 |
| 写操作需要人工确认 | 是 |
| 允许操作 | base.record_upsert, task.create, docx.create |
| 禁止操作 | raw_api_call, permission_change, message_send, delete, share_public_link |

## 4. 可演示业务故事

1. 会议中出现参数变化、候选建议、最终决策、风险、历史失败复用和 ASR 日期异常。
2. Extractor 将它们拆成 9 条可追溯 claim，每条都有说话人、时间戳、原文和 quote hash。
3. Planner 只生成 Base / Task / Docx 的 dry-run 写回计划，避免未审阅结论自动发布。

## 5. 当前限制

- 当前 extractor 是规则型 MVP，适合稳定演示，不代表泛化模型能力。
- 当前 writeback planner 不执行真实 lark-cli；真实执行层仍需接入退出码、重试、限流和失败队列。
- 真实会议正文应放在 `.tmp/` 或私有目录中运行，不提交到仓库。
