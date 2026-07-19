---
xtalloop_type: claim
claim_id: "CLM-DEMO-002-002"
meeting_id: "MTG-DEMO-002"
experiment_id: "EXP-DEMO-002"
claim_type: "parameter"
predicate: "has_reaction_temperature"
verification_status: "IN_REVIEW"
confidence: 0.9
ontology: "xtalloop-core-0.1.0"
source_quote_hash: "sha256:eee485f974d0e8669ecc28e4d5f5a3c62d8b60295e5a1afde0dfe1dd5dabe704"
tags: ["xtalloop/claim", "xtalloop/type/parameter", "xtalloop/status/in_review"]
---

# CLM-DEMO-002-002

摘要: **八十度只保留小样对照**

## Links

- Meeting: [[XtalLoop/Meetings/MTG-DEMO-002|MTG-DEMO-002]]
- Experiment: [[XtalLoop/Experiments/EXP-DEMO-002|EXP-DEMO-002]]
- Ontology: [[XtalLoop/Ontology/xtalloop-core-0.1.0|xtalloop-core-0.1.0]]

## Claim fields

- Type: `parameter`
- Predicate: `has_reaction_temperature`
- Subject: `PS-DEMO-002-CONTROL`
- Status: `IN_REVIEW`
- Confidence: `0.9`
- Flags: 无

## SourceAnchor

- System: `feishu_minutes`
- Utterance: `UTT-DEMO-002-001`
- Speaker: `SPEAKER-01`
- Time: `10000ms -> 28000ms`
- Quote hash: `sha256:eee485f974d0e8669ecc28e4d5f5a3c62d8b60295e5a1afde0dfe1dd5dabe704`

> 实验编号 EXP-DEMO-002，本轮做合成条件复核；不是八十度，主实验改成七十五度，八十度只保留小样对照。

## Object JSON

```json
{
  "value_type": "number",
  "parameter_name": "reaction_temperature",
  "value": 80,
  "operator": "exact",
  "unit_ucum": "Cel",
  "unit_raw": "度",
  "raw_text": "八十度只保留小样对照"
}
```

## Personal note

- 在这里补充个人复盘。若要进入组织知识库，应回到飞书审核流。
