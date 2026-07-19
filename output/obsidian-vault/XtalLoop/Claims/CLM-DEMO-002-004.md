---
xtalloop_type: claim
claim_id: "CLM-DEMO-002-004"
meeting_id: "MTG-DEMO-002"
experiment_id: "EXP-DEMO-002"
claim_type: "proposal"
predicate: "proposes_parameter_change"
verification_status: "IN_REVIEW"
confidence: 0.82
ontology: "xtalloop-core-0.1.0"
source_quote_hash: "sha256:984ca1c7948ad1c0c864856a1367e89b61cbf839c82fa778486145036faece66"
tags: ["xtalloop/claim", "xtalloop/type/proposal", "xtalloop/status/in_review"]
---

# CLM-DEMO-002-004

摘要: **建议把搅拌速度提到 600 转**

## Links

- Meeting: [[XtalLoop/Meetings/MTG-DEMO-002|MTG-DEMO-002]]
- Experiment: [[XtalLoop/Experiments/EXP-DEMO-002|EXP-DEMO-002]]
- Ontology: [[XtalLoop/Ontology/xtalloop-core-0.1.0|xtalloop-core-0.1.0]]

## Claim fields

- Type: `proposal`
- Predicate: `proposes_parameter_change`
- Subject: `PROP-DEMO-002-STIR-600`
- Status: `IN_REVIEW`
- Confidence: `0.82`
- Flags: `unresolved_decision`

## SourceAnchor

- System: `feishu_minutes`
- Utterance: `UTT-DEMO-002-003`
- Speaker: `SPEAKER-03`
- Time: `44000ms -> 56000ms`
- Quote hash: `sha256:984ca1c7948ad1c0c864856a1367e89b61cbf839c82fa778486145036faece66`

> 我建议把搅拌速度提到 600 转，但这只是建议，今天先不定。

## Object JSON

```json
{
  "value_type": "text",
  "parameter_name": "stirring_speed",
  "value": "600 r/min",
  "operator": "none",
  "unit_ucum": "r/min",
  "unit_raw": "转",
  "normalized_text": "建议将搅拌速度调整为 600 r/min，尚未决策",
  "raw_text": "建议把搅拌速度提到 600 转"
}
```

## Personal note

- 在这里补充个人复盘。若要进入组织知识库，应回到飞书审核流。
