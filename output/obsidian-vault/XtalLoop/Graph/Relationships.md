---
xtalloop_type: graph
bundle_id: "BND-DEMO-002"
---

# 关系图

```mermaid
flowchart LR
  M["Meeting MTG-DEMO-002"] --> E["Experiment EXP-DEMO-002"]
  E --> C1["parameter_change: has_reaction_temperature"]
  E --> C2["parameter: has_reaction_temperature"]
  E --> C3["parameter_change: has_acetonitrile_ratio"]
  E --> C4["proposal: proposes_parameter_change"]
  E --> C5["decision: sets_final_stirring_speed"]
  E --> C6["risk: warns_degradation_risk"]
  E --> C7["insight: references_similar_experiment"]
  C7 --> R7["Reference EXP-HIST-009"]
  E --> C8["task: assigns_action"]
  E --> C9["controversy: records_unresolved_option"]
```

## Obsidian links

- [[XtalLoop/Meetings/MTG-DEMO-002|Meeting MTG-DEMO-002]]
- [[XtalLoop/Experiments/EXP-DEMO-002|Experiment EXP-DEMO-002]]
- [[XtalLoop/Claims/CLM-DEMO-002-001|CLM-DEMO-002-001]]
- [[XtalLoop/Claims/CLM-DEMO-002-002|CLM-DEMO-002-002]]
- [[XtalLoop/Claims/CLM-DEMO-002-003|CLM-DEMO-002-003]]
- [[XtalLoop/Claims/CLM-DEMO-002-004|CLM-DEMO-002-004]]
- [[XtalLoop/Claims/CLM-DEMO-002-005|CLM-DEMO-002-005]]
- [[XtalLoop/Claims/CLM-DEMO-002-006|CLM-DEMO-002-006]]
- [[XtalLoop/Claims/CLM-DEMO-002-007|CLM-DEMO-002-007]]
- [[XtalLoop/Claims/CLM-DEMO-002-008|CLM-DEMO-002-008]]
- [[XtalLoop/Claims/CLM-DEMO-002-009|CLM-DEMO-002-009]]
