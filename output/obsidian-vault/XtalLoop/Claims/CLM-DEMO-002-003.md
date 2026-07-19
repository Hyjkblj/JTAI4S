---
xtalloop_type: claim
claim_id: "CLM-DEMO-002-003"
meeting_id: "MTG-DEMO-002"
experiment_id: "EXP-DEMO-002"
claim_type: "parameter_change"
predicate: "has_acetonitrile_ratio"
verification_status: "IN_REVIEW"
confidence: 0.9
ontology: "xtalloop-core-0.1.0"
source_quote_hash: "sha256:76c7b7fc80fc540bdf40d4204ff75a7bea8364a47543cf0442a34233ff488957"
tags: ["xtalloop/claim", "xtalloop/type/parameter_change", "xtalloop/status/in_review"]
---

# CLM-DEMO-002-003

摘要: **乙腈从百分之三十降到百分之二十五**

## Links

- Meeting: [[XtalLoop/Meetings/MTG-DEMO-002|MTG-DEMO-002]]
- Experiment: [[XtalLoop/Experiments/EXP-DEMO-002|EXP-DEMO-002]]
- Ontology: [[XtalLoop/Ontology/xtalloop-core-0.1.0|xtalloop-core-0.1.0]]

## Claim fields

- Type: `parameter_change`
- Predicate: `has_acetonitrile_ratio`
- Subject: `PS-DEMO-002-MOBILE-PHASE`
- Status: `IN_REVIEW`
- Confidence: `0.9`
- Flags: 无

## SourceAnchor

- System: `feishu_minutes`
- Utterance: `UTT-DEMO-002-002`
- Speaker: `SPEAKER-02`
- Time: `30000ms -> 42000ms`
- Quote hash: `sha256:76c7b7fc80fc540bdf40d4204ff75a7bea8364a47543cf0442a34233ff488957`

> 流动相乙腈从百分之三十降到百分之二十五，按体积比记录。

## Object JSON

```json
{
  "value_type": "number",
  "parameter_name": "acetonitrile_ratio",
  "previous_value": 30,
  "value": 25,
  "operator": "exact",
  "unit_ucum": "%",
  "unit_raw": "体积百分比",
  "raw_text": "乙腈从百分之三十降到百分之二十五"
}
```

## Personal note

- 在这里补充个人复盘。若要进入组织知识库，应回到飞书审核流。
