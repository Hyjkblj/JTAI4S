---
xtalloop_type: claim
claim_id: "CLM-DEMO-002-006"
meeting_id: "MTG-DEMO-002"
experiment_id: "EXP-DEMO-002"
claim_type: "risk"
predicate: "warns_degradation_risk"
verification_status: "IN_REVIEW"
confidence: 0.86
ontology: "xtalloop-core-0.1.0"
source_quote_hash: "sha256:9612c80a37bee3e24a1906717742d52f8286527fa5dc4b5d8002b923aaccba7a"
tags: ["xtalloop/claim", "xtalloop/type/risk", "xtalloop/status/in_review"]
---

# CLM-DEMO-002-006

摘要: **90 摄氏度以上可能出现降解**

## Links

- Meeting: [[XtalLoop/Meetings/MTG-DEMO-002|MTG-DEMO-002]]
- Experiment: [[XtalLoop/Experiments/EXP-DEMO-002|EXP-DEMO-002]]
- Ontology: [[XtalLoop/Ontology/xtalloop-core-0.1.0|xtalloop-core-0.1.0]]

## Claim fields

- Type: `risk`
- Predicate: `warns_degradation_risk`
- Subject: `RISK-DEMO-002-DEGRADATION`
- Status: `IN_REVIEW`
- Confidence: `0.86`
- Flags: `uncertain_causality`, `needs_domain_review`

## SourceAnchor

- System: `feishu_minutes`
- Utterance: `UTT-DEMO-002-005`
- Speaker: `SPEAKER-02`
- Time: `74000ms -> 90000ms`
- Quote hash: `sha256:9612c80a37bee3e24a1906717742d52f8286527fa5dc4b5d8002b923aaccba7a`

> 90 摄氏度以上可能出现降解，这个作为高风险提示写进审阅台。

## Object JSON

```json
{
  "value_type": "text",
  "value": "90 Cel 以上可能出现降解",
  "operator": "none",
  "unit_ucum": "Cel",
  "unit_raw": "摄氏度",
  "normalized_text": "90 摄氏度以上可能出现降解，需要审阅",
  "raw_text": "90 摄氏度以上可能出现降解"
}
```

## Personal note

- 在这里补充个人复盘。若要进入组织知识库，应回到飞书审核流。
