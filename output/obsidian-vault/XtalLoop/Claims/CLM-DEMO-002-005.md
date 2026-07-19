---
xtalloop_type: claim
claim_id: "CLM-DEMO-002-005"
meeting_id: "MTG-DEMO-002"
experiment_id: "EXP-DEMO-002"
claim_type: "decision"
predicate: "sets_final_stirring_speed"
verification_status: "IN_REVIEW"
confidence: 0.88
ontology: "xtalloop-core-0.1.0"
source_quote_hash: "sha256:dc79aed15bc5f3bbcad09430202bd16383be710d8ddfcb7239f263cb902178ab"
tags: ["xtalloop/claim", "xtalloop/type/decision", "xtalloop/status/in_review"]
---

# CLM-DEMO-002-005

摘要: **先按 500 转每分钟执行**

## Links

- Meeting: [[XtalLoop/Meetings/MTG-DEMO-002|MTG-DEMO-002]]
- Experiment: [[XtalLoop/Experiments/EXP-DEMO-002|EXP-DEMO-002]]
- Ontology: [[XtalLoop/Ontology/xtalloop-core-0.1.0|xtalloop-core-0.1.0]]

## Claim fields

- Type: `decision`
- Predicate: `sets_final_stirring_speed`
- Subject: `DEC-DEMO-002-STIR-500`
- Status: `IN_REVIEW`
- Confidence: `0.88`
- Flags: 无

## SourceAnchor

- System: `feishu_minutes`
- Utterance: `UTT-DEMO-002-004`
- Speaker: `SPEAKER-01`
- Time: `58000ms -> 72000ms`
- Quote hash: `sha256:dc79aed15bc5f3bbcad09430202bd16383be710d8ddfcb7239f263cb902178ab`

> 最终不要直接用 600 转，先按 500 转每分钟执行，结果复盘后再调。

## Object JSON

```json
{
  "value_type": "number",
  "parameter_name": "stirring_speed",
  "value": 500,
  "operator": "exact",
  "unit_ucum": "r/min",
  "unit_raw": "转每分钟",
  "raw_text": "先按 500 转每分钟执行"
}
```

## Personal note

- 在这里补充个人复盘。若要进入组织知识库，应回到飞书审核流。
