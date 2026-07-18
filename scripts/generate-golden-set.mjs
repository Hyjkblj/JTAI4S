import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "evaluation", "golden-set.jsonl");
const bundleExamplePath = resolve(
  root,
  "evaluation",
  "extraction-bundle.example.json"
);
const validExamplesDir = resolve(root, "schemas", "examples", "valid");
const invalidExamplesDir = resolve(root, "schemas", "examples", "invalid");

const scenarios = [
  {
    tags: ["parameter_change", "negation", "decision"],
    role: "manager",
    text: "不是八十度，主实验改成七十五度；八十度只保留做小样对照。",
    claims: [
      {
        type: "parameter_change",
        subject: "PS-SYNTH-001-V2",
        predicate: "has_reaction_temperature",
        object: {
          value_type: "number",
          parameter_name: "reaction_temperature",
          previous_value: 80,
          value: 75,
          operator: "exact",
          unit_ucum: "Cel",
          unit_raw: "度",
          raw_text: "主实验改成七十五度"
        },
        scope: ["main_run", "主实验"],
        flags: []
      },
      {
        type: "parameter",
        subject: "PS-SYNTH-001-CONTROL",
        predicate: "has_reaction_temperature",
        object: {
          value_type: "number",
          parameter_name: "reaction_temperature",
          value: 80,
          operator: "exact",
          unit_ucum: "Cel",
          unit_raw: "度",
          raw_text: "八十度只保留做小样对照"
        },
        scope: ["control_run", "小样对照"],
        flags: []
      }
    ]
  },
  {
    tags: ["parameter_change", "ratio", "unit"],
    role: "experiment",
    text: "流动相里的乙腈从百分之三十降到百分之二十五，体积比。",
    claims: [
      {
        type: "parameter_change",
        subject: "PS-SYNTH-002-V3",
        predicate: "has_acetonitrile_ratio",
        object: {
          value_type: "number",
          parameter_name: "acetonitrile_ratio",
          previous_value: 30,
          value: 25,
          operator: "exact",
          unit_ucum: "%",
          unit_raw: "体积百分比",
          raw_text: "乙腈从百分之三十降到百分之二十五"
        },
        scope: ["all_runs", "本批次全部运行"],
        flags: []
      }
    ]
  },
  {
    tags: ["range", "parameter", "ph"],
    role: "experiment",
    text: "缓冲液 pH 控制在 7.2 到 7.4 之间。",
    claims: [
      {
        type: "parameter",
        subject: "PS-SYNTH-003-V1",
        predicate: "has_buffer_ph",
        object: {
          value_type: "range",
          parameter_name: "buffer_ph",
          lower_bound: 7.2,
          upper_bound: 7.4,
          operator: "range",
          unit_ucum: "1",
          unit_raw: "pH",
          raw_text: "pH 控制在 7.2 到 7.4 之间"
        },
        scope: ["all_runs", "全部运行"],
        flags: []
      }
    ]
  },
  {
    tags: ["approximate", "duration", "parameter"],
    role: "experiment",
    text: "反应时间先按大约两小时设置。",
    claims: [
      {
        type: "parameter",
        subject: "PS-SYNTH-004-V1",
        predicate: "has_reaction_duration",
        object: {
          value_type: "number",
          parameter_name: "reaction_duration",
          value: 2,
          operator: "approximately",
          unit_ucum: "h",
          unit_raw: "小时",
          raw_text: "大约两小时"
        },
        scope: ["all_runs", "本轮实验"],
        flags: []
      }
    ]
  },
  {
    tags: ["control_run", "parameter", "scope"],
    role: "manager",
    text: "主实验用七十五度，对照组仍然保持八十度。",
    claims: [
      {
        type: "parameter",
        subject: "PS-SYNTH-005-MAIN",
        predicate: "has_reaction_temperature",
        object: {
          value_type: "number",
          parameter_name: "reaction_temperature",
          value: 75,
          operator: "exact",
          unit_ucum: "Cel",
          unit_raw: "度",
          raw_text: "主实验用七十五度"
        },
        scope: ["main_run", "主实验"],
        flags: []
      },
      {
        type: "parameter",
        subject: "PS-SYNTH-005-CONTROL",
        predicate: "has_reaction_temperature",
        object: {
          value_type: "number",
          parameter_name: "reaction_temperature",
          value: 80,
          operator: "exact",
          unit_ucum: "Cel",
          unit_raw: "度",
          raw_text: "对照组仍然保持八十度"
        },
        scope: ["control_run", "对照组"],
        flags: []
      }
    ]
  },
  {
    tags: ["proposal", "not_decided", "parameter"],
    role: "algorithm",
    text: "我建议把搅拌速度提到 600 转，但这只是建议，今天先不定。",
    claims: [
      {
        type: "proposal",
        subject: "PROP-SYNTH-006",
        predicate: "proposes_parameter_change",
        object: {
          value_type: "text",
          parameter_name: "stirring_speed",
          value: "600 r/min",
          normalized_text: "建议将搅拌速度调整为 600 r/min，尚未决策",
          raw_text: "建议把搅拌速度提到 600 转，但这只是建议"
        },
        scope: ["experiment", "当前实验的候选方案"],
        flags: ["unresolved_decision"]
      }
    ]
  },
  {
    tags: ["controversy", "unresolved", "alternative"],
    role: "manager",
    text: "方案 A 和方案 B 都有支持者，这次没有形成结论，下次评审再决定。",
    claims: [
      {
        type: "controversy",
        subject: "CONT-SYNTH-007",
        predicate: "compares_alternatives",
        object: {
          value_type: "text",
          value: "方案 A vs 方案 B",
          normalized_text: "两个候选方案均有支持者，未形成决策",
          raw_text: "方案 A 和方案 B 都有支持者，这次没有形成结论"
        },
        scope: ["experiment", "当前方案评审"],
        flags: ["unresolved_decision"]
      }
    ]
  },
  {
    tags: ["controversy", "decision", "tradeoff"],
    role: "manager",
    text: "算法组倾向方案 A，实验组担心溶解性；综合考虑后先采用方案 B。",
    claims: [
      {
        type: "controversy",
        subject: "CONT-SYNTH-008",
        predicate: "records_team_disagreement",
        object: {
          value_type: "text",
          value: "算法组支持方案 A，实验组对溶解性有风险意见",
          raw_text: "算法组倾向方案 A，实验组担心溶解性"
        },
        scope: ["experiment", "当前方案评审"],
        flags: ["conflicting_claim"]
      },
      {
        type: "decision",
        subject: "DEC-SYNTH-008",
        predicate: "selects_proposal",
        object: {
          value_type: "reference",
          value: "方案 B",
          reference_id: "PROP-SYNTH-008-B",
          raw_text: "综合考虑后先采用方案 B"
        },
        scope: ["experiment", "当前实验"],
        flags: []
      }
    ]
  },
  {
    tags: ["risk", "threshold", "degradation"],
    role: "experiment",
    text: "温度超过九十度可能加速降解，这个风险要写进去。",
    claims: [
      {
        type: "risk",
        subject: "RISK-SYNTH-009",
        predicate: "warns_temperature_degradation",
        object: {
          value_type: "text",
          value: "温度 > 90 Cel 时存在加速降解风险",
          normalized_text: "高于 90 Cel 可能加速降解",
          raw_text: "温度超过九十度可能加速降解"
        },
        scope: ["experiment", "温度条件风险"],
        flags: ["needs_domain_review"]
      }
    ]
  },
  {
    tags: ["task", "missing_due_date"],
    role: "manager",
    text: "王敏负责核对物料批次，时间稍后补。",
    claims: [
      {
        type: "task",
        subject: "TASK-SYNTH-010",
        predicate: "assigns_action",
        object: {
          value_type: "text",
          value: "核对物料批次",
          action_text: "核对物料批次",
          assignee_id: "USER-WANGMIN",
          due_at: null,
          raw_text: "王敏负责核对物料批次，时间稍后补"
        },
        scope: ["experiment", "当前实验"],
        flags: ["missing_due_date"]
      }
    ]
  },
  {
    tags: ["task", "ambiguous_person"],
    role: "manager",
    text: "请李老师确认一下仪器状态，我们组里有两位李老师，先别直接派任务。",
    claims: [
      {
        type: "task",
        subject: "TASK-SYNTH-011",
        predicate: "requests_action",
        object: {
          value_type: "text",
          value: "确认仪器状态",
          action_text: "确认仪器状态",
          assignee_id: null,
          due_at: null,
          raw_text: "请李老师确认一下仪器状态"
        },
        scope: ["experiment", "当前实验"],
        flags: ["ambiguous_person", "missing_due_date"]
      }
    ]
  },
  {
    tags: ["task", "relative_time"],
    role: "materials",
    text: "赵工明天下午把库存结果发到群里。",
    claims: [
      {
        type: "task",
        subject: "TASK-SYNTH-012",
        predicate: "assigns_action",
        object: {
          value_type: "text",
          value: "发送库存结果",
          action_text: "将库存结果发送到项目群",
          assignee_id: "USER-ZHAO",
          due_at: null,
          raw_text: "赵工明天下午把库存结果发到群里"
        },
        scope: ["project", "当前项目群"],
        flags: ["relative_time"]
      }
    ]
  },
  {
    tags: ["failure_case", "historical_reuse", "duplicate"],
    role: "experiment",
    text: "这个条件和 EXP-HIST-017 很像，上次在含水量偏高时已经失败过，不要直接重复。",
    claims: [
      {
        type: "failure_case",
        subject: "FAIL-HIST-017",
        predicate: "warns_repeated_failure",
        object: {
          value_type: "reference",
          value: "含水量偏高条件下的历史失败",
          reference_id: "EXP-HIST-017",
          raw_text: "上次在含水量偏高时已经失败过，不要直接重复"
        },
        scope: ["project", "相似实验复用"],
        flags: ["possible_duplicate_failure"]
      }
    ]
  },
  {
    tags: ["parameter", "missing_unit"],
    role: "algorithm",
    text: "浓度设成十，但我这里没有记录单位，需要实验同事补充。",
    claims: [
      {
        type: "parameter",
        subject: "PS-SYNTH-014-V1",
        predicate: "has_concentration",
        object: {
          value_type: "number",
          parameter_name: "concentration",
          value: 10,
          operator: "exact",
          unit_ucum: null,
          unit_raw: null,
          raw_text: "浓度设成十"
        },
        scope: ["experiment", "当前实验"],
        flags: ["missing_unit", "needs_domain_review"]
      }
    ]
  },
  {
    tags: ["parameter", "ambiguous_value", "room_temperature"],
    role: "experiment",
    text: "样品先在室温下平衡，现场温度还没有记录。",
    claims: [
      {
        type: "parameter",
        subject: "PS-SYNTH-015-V1",
        predicate: "has_equilibration_temperature",
        object: {
          value_type: "text",
          parameter_name: "equilibration_temperature",
          value: "室温",
          operator: "none",
          unit_ucum: null,
          unit_raw: "室温",
          raw_text: "在室温下平衡"
        },
        scope: ["all_runs", "样品平衡步骤"],
        flags: ["missing_unit", "needs_domain_review"]
      }
    ]
  },
  {
    tags: ["parameter", "upper_bound", "mass"],
    role: "experiment",
    text: "每孔加样量不要超过五毫克。",
    claims: [
      {
        type: "parameter",
        subject: "PS-SYNTH-016-V1",
        predicate: "has_sample_mass_per_well",
        object: {
          value_type: "number",
          parameter_name: "sample_mass_per_well",
          value: 5,
          operator: "at_most",
          unit_ucum: "mg",
          unit_raw: "毫克",
          raw_text: "不要超过五毫克"
        },
        scope: ["all_runs", "每孔"],
        flags: []
      }
    ]
  },
  {
    tags: ["parameter", "lower_bound", "replicate"],
    role: "manager",
    text: "每个条件至少做三次独立重复。",
    claims: [
      {
        type: "parameter",
        subject: "PS-SYNTH-017-V1",
        predicate: "has_independent_replicates",
        object: {
          value_type: "number",
          parameter_name: "independent_replicates",
          value: 3,
          operator: "at_least",
          unit_ucum: "1",
          unit_raw: "次",
          raw_text: "至少做三次独立重复"
        },
        scope: ["all_runs", "每个实验条件"],
        flags: []
      }
    ]
  },
  {
    tags: ["result", "yield", "unit"],
    role: "experiment",
    text: "这批反应的分离收率是百分之八十二。",
    claims: [
      {
        type: "result",
        subject: "RESULT-SYNTH-018",
        predicate: "has_isolated_yield",
        object: {
          value_type: "number",
          parameter_name: "isolated_yield",
          value: 82,
          operator: "exact",
          unit_ucum: "%",
          unit_raw: "百分比",
          raw_text: "分离收率是百分之八十二"
        },
        scope: ["experiment", "当前批次"],
        flags: []
      }
    ]
  },
  {
    tags: ["failure_case", "uncertain_causality"],
    role: "experiment",
    text: "析晶失败可能是含水量造成的，但现在还没有检测结果支持。",
    claims: [
      {
        type: "failure_case",
        subject: "FAIL-SYNTH-019",
        predicate: "proposes_failure_cause",
        object: {
          value_type: "text",
          value: "含水量可能导致析晶失败",
          normalized_text: "候选原因，尚无检测证据",
          raw_text: "析晶失败可能是含水量造成的"
        },
        scope: ["experiment", "当前失败 Run"],
        flags: ["uncertain_causality", "needs_domain_review"]
      }
    ]
  },
  {
    tags: ["material_batch", "fact", "traceability"],
    role: "materials",
    text: "主原料使用批次 MAT-2026-0717-B，不要和上一批混用。",
    claims: [
      {
        type: "fact",
        subject: "RUN-SYNTH-020",
        predicate: "uses_material_batch",
        object: {
          value_type: "reference",
          value: "MAT-2026-0717-B",
          reference_id: "MAT-2026-0717-B",
          raw_text: "主原料使用批次 MAT-2026-0717-B"
        },
        scope: ["main_run", "主实验"],
        flags: []
      }
    ]
  },
  {
    tags: ["task", "due_date", "instrument"],
    role: "manager",
    text: "陈工在七月十八日下午五点前确认二号反应器是否空闲。",
    claims: [
      {
        type: "task",
        subject: "TASK-SYNTH-021",
        predicate: "assigns_action",
        object: {
          value_type: "text",
          value: "确认二号反应器是否空闲",
          action_text: "确认二号反应器是否空闲",
          assignee_id: "USER-CHEN",
          due_at: "2026-07-18T17:00:00+08:00",
          raw_text: "陈工在七月十八日下午五点前确认二号反应器是否空闲"
        },
        scope: ["experiment", "当前实验"],
        flags: []
      }
    ]
  },
  {
    tags: ["insight", "cross_experiment", "reuse"],
    role: "algorithm",
    text: "EXP-HIST-022 在相同溶剂体系下出现过类似峰型，可以作为本轮判断的参考。",
    claims: [
      {
        type: "insight",
        subject: "INSIGHT-SYNTH-022",
        predicate: "references_similar_experiment",
        object: {
          value_type: "reference",
          value: "相同溶剂体系下的类似峰型",
          reference_id: "EXP-HIST-022",
          raw_text: "EXP-HIST-022 在相同溶剂体系下出现过类似峰型"
        },
        scope: ["project", "跨实验参考"],
        flags: []
      }
    ]
  },
  {
    tags: ["decision", "supersedes", "versioning"],
    role: "manager",
    text: "今天的决定替代上周版本：不再使用方案 C，正式切换到方案 D。",
    claims: [
      {
        type: "decision",
        subject: "DEC-SYNTH-023",
        predicate: "selects_proposal",
        object: {
          value_type: "reference",
          value: "方案 D",
          reference_id: "PROP-SYNTH-023-D",
          raw_text: "正式切换到方案 D"
        },
        scope: ["experiment", "当前实验版本"],
        flags: [],
        supersedes: "CLM-HIST-0023"
      }
    ]
  },
  {
    tags: ["decision", "negation", "no_change"],
    role: "manager",
    text: "溶剂保持乙醇，不改成甲醇；刚才那个只是讨论。",
    claims: [
      {
        type: "decision",
        subject: "DEC-SYNTH-024",
        predicate: "keeps_existing_solvent",
        object: {
          value_type: "text",
          parameter_name: "solvent",
          value: "乙醇",
          normalized_text: "维持乙醇，不采用甲醇候选方案",
          raw_text: "溶剂保持乙醇，不改成甲醇"
        },
        scope: ["all_runs", "本轮全部运行"],
        flags: []
      }
    ]
  }
];

function pad(value) {
  return String(value).padStart(3, "0");
}

function createClaim(sampleIndex, claimIndex, scenario, spec) {
  const serial = pad(sampleIndex);
  const meetingId = `MTG-SYNTH-${serial}`;
  const experimentId = `EXP-SYNTH-${serial}`;
  const utteranceId = `UTT-SYNTH-${serial}`;
  const claim = {
    schema_version: "1.0.0",
    claim_id: `CLM-GS${serial}-${String(claimIndex).padStart(2, "0")}`,
    meeting_id: meetingId,
    experiment_id: experimentId,
    claim_type: spec.type,
    subject_id: spec.subject,
    predicate: spec.predicate,
    object: spec.object,
    scope: {
      type: spec.scope[0],
      description: spec.scope[1]
    },
    source: {
      system: "imported_fixture",
      meeting_id: meetingId,
      utterance_id: utteranceId,
      speaker_id: `USER-SYNTH-${serial}`,
      start_ms: sampleIndex * 10000,
      end_ms: sampleIndex * 10000 + 8000,
      quote: scenario.text,
      quote_hash: `sha256:${createHash("sha256").update(scenario.text).digest("hex")}`,
      source_url: null
    },
    confidence: 1,
    verification_status: "VERIFIED",
    data_origin: "synthetic",
    idempotency_key: `${meetingId}:gold-v1:${spec.type}:${claimIndex}`,
    supersedes_claim_id: spec.supersedes ?? null,
    flags: spec.flags,
    relationships: [],
    versions: {
      extractor: "gold-annotation-1.0.0",
      prompt: "manual-gold-1.0.0",
      ontology: "xtalloop-core-0.1.0"
    },
    review: {
      decision: "approved",
      reviewed_by: "CURATOR-001",
      reviewed_at: "2026-07-17T12:00:00+08:00",
      notes: "Synthetic sample, single-review annotation."
    },
    created_at: "2026-07-17T12:00:00+08:00"
  };

  if (spec.type !== "parameter_change" && claim.supersedes_claim_id === null) {
    delete claim.supersedes_claim_id;
  }

  return claim;
}

const entries = scenarios.map((scenario, index) => {
  const sampleIndex = index + 1;
  const serial = pad(sampleIndex);
  return {
    sample_id: `GS-${serial}`,
    language: "zh-CN",
    data_origin: "synthetic",
    scenario_tags: scenario.tags,
    meeting: {
      meeting_id: `MTG-SYNTH-${serial}`,
      experiment_id: `EXP-SYNTH-${serial}`,
      title: `合成研发会议样本 ${serial}`,
      occurred_at: "2026-07-17T10:00:00+08:00"
    },
    utterance: {
      utterance_id: `UTT-SYNTH-${serial}`,
      speaker_id: `USER-SYNTH-${serial}`,
      speaker_role: scenario.role,
      start_ms: sampleIndex * 10000,
      end_ms: sampleIndex * 10000 + 8000,
      text: scenario.text
    },
    expected_claims: scenario.claims.map((claim, claimIndex) =>
      createClaim(sampleIndex, claimIndex + 1, scenario, claim)
    ),
    annotation_status: "single_reviewed",
    annotation_notes: "Synthetic fixture. A second independent reviewer is still required."
  };
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
  "utf8"
);

await mkdir(validExamplesDir, { recursive: true });
await mkdir(invalidExamplesDir, { recursive: true });

const validExamples = entries.slice(0, 5).map((entry) => entry.expected_claims[0]);
for (const [index, example] of validExamples.entries()) {
  await writeFile(
    resolve(validExamplesDir, `valid-${String(index + 1).padStart(2, "0")}.json`),
    `${JSON.stringify(example, null, 2)}\n`,
    "utf8"
  );
}

const invalidExamples = validExamples.map((example) => structuredClone(example));
delete invalidExamples[0].source;
invalidExamples[1].review = {
  decision: "pending",
  reviewed_by: null,
  reviewed_at: null,
  notes: "Invalid: VERIFIED without an approving reviewer."
};
invalidExamples[2].confidence = 1.5;
invalidExamples[3].claim_id = "invalid-id";
invalidExamples[4].claim_type = "parameter_change";
delete invalidExamples[4].object.previous_value;

for (const [index, example] of invalidExamples.entries()) {
  await writeFile(
    resolve(invalidExamplesDir, `invalid-${String(index + 1).padStart(2, "0")}.json`),
    `${JSON.stringify(example, null, 2)}\n`,
    "utf8"
  );
}

const bundleExample = {
  schema_version: "1.0.0",
  bundle_id: "BND-SYNTH-001",
  meeting: {
    meeting_id: entries[0].meeting.meeting_id,
    title: entries[0].meeting.title,
    started_at: entries[0].meeting.occurred_at,
    ended_at: "2026-07-17T10:30:00+08:00",
    source_system: "imported_fixture"
  },
  experiment: {
    experiment_id: entries[0].meeting.experiment_id,
    project_id: "PROJECT-SYNTH-001",
    experiment_type: "synthesis",
    status: "PLANNING"
  },
  parameter_sets: [
    {
      parameter_set_id: "PS-SYNTH-001-V2",
      experiment_id: entries[0].meeting.experiment_id,
      version: 2,
      verification_status: "VERIFIED",
      parameters: [
        {
          name: "reaction_temperature",
          value: 75,
          unit_ucum: "Cel",
          operator: "exact",
          raw_text: "主实验改成七十五度"
        }
      ]
    }
  ],
  decisions: [],
  controversies: [],
  risks: [],
  tasks: [],
  results: [],
  claims: entries[0].expected_claims
};

await writeFile(
  bundleExamplePath,
  `${JSON.stringify(bundleExample, null, 2)}\n`,
  "utf8"
);

console.log(
  `Generated ${entries.length} golden-set entries, ${validExamples.length} valid examples, ${invalidExamples.length} invalid examples, and one extraction bundle.`
);
