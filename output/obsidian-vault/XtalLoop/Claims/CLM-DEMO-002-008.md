---
xtalloop_type: claim
claim_id: "CLM-DEMO-002-008"
meeting_id: "MTG-DEMO-002"
experiment_id: "EXP-DEMO-002"
claim_type: "task"
predicate: "assigns_action"
verification_status: "IN_REVIEW"
confidence: 0.8
ontology: "xtalloop-core-0.1.0"
source_quote_hash: "sha256:3abf3655240864fc5292785c54556cd3608284eab75c5497fedce5cf815602c7"
tags: ["xtalloop/claim", "xtalloop/type/task", "xtalloop/status/in_review"]
---

# CLM-DEMO-002-008

摘要: **今天下午五点前复核截止日期**

## Links

- Meeting: [[XtalLoop/Meetings/MTG-DEMO-002|MTG-DEMO-002]]
- Experiment: [[XtalLoop/Experiments/EXP-DEMO-002|EXP-DEMO-002]]
- Ontology: [[XtalLoop/Ontology/xtalloop-core-0.1.0|xtalloop-core-0.1.0]]

## Claim fields

- Type: `task`
- Predicate: `assigns_action`
- Subject: `TASK-DEMO-002-ASR-DATE-REVIEW`
- Status: `IN_REVIEW`
- Confidence: `0.8`
- Flags: `relative_time`, `needs_domain_review`

## SourceAnchor

- System: `feishu_minutes`
- Utterance: `UTT-DEMO-002-007`
- Speaker: `SPEAKER-01`
- Time: `108000ms -> 126000ms`
- Quote hash: `sha256:3abf3655240864fc5292785c54556cd3608284eab75c5497fedce5cf815602c7`

> 会后今天下午五点前复核截止日期，飞书 ASR 可能把 2026 识别成 2020。

## Object JSON

```json
{
  "value_type": "text",
  "value": "复核截止日期与 ASR 年份异常",
  "action_text": "复核截止日期，确认飞书 ASR 是否将 2026 识别成 2020",
  "assignee_id": "USER-DEMO-MANAGER",
  "due_at": "2026-07-18T17:00:00+08:00",
  "raw_text": "今天下午五点前复核截止日期"
}
```

## Personal note

- 在这里补充个人复盘。若要进入组织知识库，应回到飞书审核流。
