import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extractorVersion = "rule-extractor-0.1.0";
const promptVersion = "none-rule-based-0.1.0";
const ontologyVersion = "xtalloop-core-0.1.0";

function parseArgs(argv) {
  const args = {
    input: resolve(root, "evaluation", "demo-meeting-transcript.json"),
    output: resolve(root, "evaluation", "demo-extraction-bundle.generated.json")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      args.input = resolve(root, argv[index + 1]);
      index += 1;
    } else if (arg === "--output") {
      args.output = resolve(root, argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function quoteHash(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function suffixFromId(id, prefix) {
  return id.replace(new RegExp(`^${prefix}-`), "");
}

function baseClaim(transcript, utterance, counter, partial) {
  const meetingId = transcript.meeting.meeting_id;
  const experimentId = transcript.experiment.experiment_id;
  const suffix = suffixFromId(meetingId, "MTG");
  const claimId = `CLM-${suffix}-${String(counter).padStart(3, "0")}`;

  return {
    schema_version: "1.0.0",
    claim_id: claimId,
    meeting_id: meetingId,
    experiment_id: experimentId,
    claim_type: partial.claim_type,
    subject_id: partial.subject_id,
    predicate: partial.predicate,
    object: partial.object,
    scope: partial.scope,
    source: {
      system: transcript.meeting.source_system,
      meeting_id: meetingId,
      utterance_id: utterance.utterance_id,
      speaker_id: utterance.speaker_id,
      start_ms: utterance.start_ms,
      end_ms: utterance.end_ms,
      quote: utterance.text,
      quote_hash: quoteHash(utterance.text),
      source_url: null
    },
    confidence: partial.confidence,
    verification_status: "IN_REVIEW",
    data_origin: transcript.data_origin,
    idempotency_key: `${meetingId}:${extractorVersion}:${utterance.utterance_id}:${partial.claim_type}:${partial.predicate}:${counter}`,
    flags: partial.flags ?? [],
    relationships: partial.relationships ?? [],
    versions: {
      extractor: extractorVersion,
      prompt: promptVersion,
      ontology: ontologyVersion
    },
    review: {
      decision: "pending",
      reviewed_by: null,
      reviewed_at: null,
      notes: "Rule-based draft. Human review is required before publication or writeback."
    },
    created_at: transcript.extracted_at
  };
}

function extractPartials(transcript, utterance) {
  const text = utterance.text;
  const experimentId = transcript.experiment.experiment_id;
  const partials = [];

  if (/不是八十度/u.test(text) && /主实验改成七十五度/u.test(text)) {
    partials.push({
      claim_type: "parameter_change",
      subject_id: `PS-${suffixFromId(experimentId, "EXP")}-MAIN`,
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
      scope: {
        type: "main_run",
        description: "主实验"
      },
      confidence: 0.92
    });
  }

  if (/八十度只保留.*对照/u.test(text)) {
    partials.push({
      claim_type: "parameter",
      subject_id: `PS-${suffixFromId(experimentId, "EXP")}-CONTROL`,
      predicate: "has_reaction_temperature",
      object: {
        value_type: "number",
        parameter_name: "reaction_temperature",
        value: 80,
        operator: "exact",
        unit_ucum: "Cel",
        unit_raw: "度",
        raw_text: "八十度只保留小样对照"
      },
      scope: {
        type: "control_run",
        description: "小样对照"
      },
      confidence: 0.9
    });
  }

  if (/乙腈从百分之三十降到百分之二十五/u.test(text)) {
    partials.push({
      claim_type: "parameter_change",
      subject_id: `PS-${suffixFromId(experimentId, "EXP")}-MOBILE-PHASE`,
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
      scope: {
        type: "all_runs",
        description: "流动相体积比"
      },
      confidence: 0.9
    });
  }

  if (/建议.*搅拌速度.*600 转/u.test(text)) {
    partials.push({
      claim_type: "proposal",
      subject_id: `PROP-${suffixFromId(experimentId, "EXP")}-STIR-600`,
      predicate: "proposes_parameter_change",
      object: {
        value_type: "text",
        parameter_name: "stirring_speed",
        value: "600 r/min",
        operator: "none",
        unit_ucum: "r/min",
        unit_raw: "转",
        normalized_text: "建议将搅拌速度调整为 600 r/min，尚未决策",
        raw_text: "建议把搅拌速度提到 600 转"
      },
      scope: {
        type: "experiment",
        description: "候选搅拌条件"
      },
      confidence: 0.82,
      flags: ["unresolved_decision"]
    });
  }

  if (/先按 500 转每分钟执行/u.test(text)) {
    partials.push({
      claim_type: "decision",
      subject_id: `DEC-${suffixFromId(experimentId, "EXP")}-STIR-500`,
      predicate: "sets_final_stirring_speed",
      object: {
        value_type: "number",
        parameter_name: "stirring_speed",
        value: 500,
        operator: "exact",
        unit_ucum: "r/min",
        unit_raw: "转每分钟",
        raw_text: "先按 500 转每分钟执行"
      },
      scope: {
        type: "experiment",
        description: "本轮执行方案"
      },
      confidence: 0.88
    });
  }

  if (/90 摄氏度以上可能出现降解/u.test(text)) {
    partials.push({
      claim_type: "risk",
      subject_id: `RISK-${suffixFromId(experimentId, "EXP")}-DEGRADATION`,
      predicate: "warns_degradation_risk",
      object: {
        value_type: "text",
        value: "90 Cel 以上可能出现降解",
        operator: "none",
        unit_ucum: "Cel",
        unit_raw: "摄氏度",
        normalized_text: "90 摄氏度以上可能出现降解，需要审阅",
        raw_text: "90 摄氏度以上可能出现降解"
      },
      scope: {
        type: "experiment",
        description: "温度风险"
      },
      confidence: 0.86,
      flags: ["uncertain_causality", "needs_domain_review"]
    });
  }

  if (/历史失败案例 EXP-HIST-009/u.test(text)) {
    partials.push({
      claim_type: "insight",
      subject_id: `INSIGHT-${suffixFromId(experimentId, "EXP")}-HIST-009`,
      predicate: "references_similar_experiment",
      object: {
        value_type: "reference",
        value: "高温条件下相似杂质峰",
        reference_id: "EXP-HIST-009",
        normalized_text: "历史失败案例可作为本轮风险判断的复用证据",
        raw_text: "EXP-HIST-009 在高温条件下出现过相似杂质峰"
      },
      scope: {
        type: "project",
        description: "跨实验失败案例复用"
      },
      confidence: 0.84,
      flags: ["possible_duplicate_failure"]
    });
  }

  if (/今天下午五点前复核截止日期/u.test(text)) {
    partials.push({
      claim_type: "task",
      subject_id: `TASK-${suffixFromId(experimentId, "EXP")}-ASR-DATE-REVIEW`,
      predicate: "assigns_action",
      object: {
        value_type: "text",
        value: "复核截止日期与 ASR 年份异常",
        action_text: "复核截止日期，确认飞书 ASR 是否将 2026 识别成 2020",
        assignee_id: "USER-DEMO-MANAGER",
        due_at: "2026-07-18T17:00:00+08:00",
        raw_text: "今天下午五点前复核截止日期"
      },
      scope: {
        type: "experiment",
        description: "会后审阅任务"
      },
      confidence: 0.8,
      flags: ["relative_time", "needs_domain_review"]
    });
  }

  if (/没有形成结论.*下次评审再决定/u.test(text)) {
    partials.push({
      claim_type: "controversy",
      subject_id: `CONT-${suffixFromId(experimentId, "EXP")}-CRYSTAL-B`,
      predicate: "records_unresolved_option",
      object: {
        value_type: "text",
        value: "晶型筛选 B 方案未形成结论",
        normalized_text: "晶型筛选 B 方案仍处于待评审状态",
        raw_text: "晶型筛选 B 方案这次没有形成结论"
      },
      scope: {
        type: "experiment",
        description: "晶型筛选方案评审"
      },
      confidence: 0.78,
      flags: ["unresolved_decision"]
    });
  }

  return partials;
}

function deriveParameterSets(transcript, claims) {
  const parameters = claims
    .filter((claim) =>
      ["parameter", "parameter_change", "decision"].includes(claim.claim_type) &&
      claim.object.parameter_name
    )
    .map((claim) => ({
      name: claim.object.parameter_name,
      value: claim.object.value ?? null,
      unit_ucum: claim.object.unit_ucum ?? null,
      operator: claim.object.operator ?? "none",
      raw_text: claim.object.raw_text
    }));

  if (parameters.length === 0) {
    return [];
  }

  return [
    {
      parameter_set_id: `PS-${suffixFromId(transcript.experiment.experiment_id, "EXP")}-DRAFT`,
      experiment_id: transcript.experiment.experiment_id,
      version: 1,
      verification_status: "IN_REVIEW",
      parameters
    }
  ];
}

function deriveDecisions(claims) {
  return claims
    .filter((claim) => claim.claim_type === "decision")
    .map((claim, index) => ({
      decision_id: `DEC-${claim.experiment_id.replace(/^EXP-/, "")}-${String(index + 1).padStart(3, "0")}`,
      claim_id: claim.claim_id,
      status: "candidate",
      selected_proposal_id: claim.subject_id,
      rationale: claim.object.raw_text
    }));
}

function deriveRisks(claims) {
  return claims
    .filter((claim) => claim.claim_type === "risk")
    .map((claim, index) => ({
      risk_id: `RISK-${claim.experiment_id.replace(/^EXP-/, "")}-${String(index + 1).padStart(3, "0")}`,
      claim_id: claim.claim_id,
      severity: /高风险/u.test(claim.source.quote) ? "HIGH" : "UNKNOWN",
      likelihood: "UNKNOWN",
      mitigation_task_id: null
    }));
}

function deriveTasks(claims) {
  return claims
    .filter((claim) => claim.claim_type === "task")
    .map((claim, index) => ({
      task_id: `TASK-${claim.experiment_id.replace(/^EXP-/, "")}-${String(index + 1).padStart(3, "0")}`,
      claim_id: claim.claim_id,
      summary: claim.object.action_text,
      assignee_id: claim.object.assignee_id ?? null,
      due_at: claim.object.due_at ?? null,
      status: "DRAFT"
    }));
}

function deriveControversies(claims, decisions) {
  const proposal = claims.find(
    (claim) => claim.claim_type === "proposal" && claim.object.parameter_name === "stirring_speed"
  );
  const decision = claims.find(
    (claim) => claim.claim_type === "decision" && claim.object.parameter_name === "stirring_speed"
  );
  const unresolved = claims.find((claim) => claim.claim_type === "controversy");

  const controversies = [];
  if (proposal && decision) {
    controversies.push({
      controversy_id: `CONT-${proposal.experiment_id.replace(/^EXP-/, "")}-001`,
      status: "RESOLVED",
      position_claim_ids: [proposal.claim_id, decision.claim_id],
      resolved_by_decision_id: decisions[0]?.decision_id ?? null
    });
  }

  if (unresolved) {
    controversies.push({
      controversy_id: `CONT-${unresolved.experiment_id.replace(/^EXP-/, "")}-002`,
      status: "OPEN",
      position_claim_ids: [unresolved.claim_id, proposal?.claim_id ?? decision?.claim_id].filter(Boolean),
      resolved_by_decision_id: null
    });
  }

  return controversies.filter((controversy) => controversy.position_claim_ids.length >= 2);
}

function extractBundle(transcript) {
  let counter = 1;
  const claims = [];
  for (const utterance of transcript.utterances) {
    for (const partial of extractPartials(transcript, utterance)) {
      claims.push(baseClaim(transcript, utterance, counter, partial));
      counter += 1;
    }
  }

  const decisions = deriveDecisions(claims);

  return {
    schema_version: "1.0.0",
    bundle_id: `BND-${suffixFromId(transcript.meeting.meeting_id, "MTG")}`,
    meeting: transcript.meeting,
    experiment: transcript.experiment,
    parameter_sets: deriveParameterSets(transcript, claims),
    decisions,
    controversies: deriveControversies(claims, decisions),
    risks: deriveRisks(claims),
    tasks: deriveTasks(claims),
    results: [],
    claims
  };
}

const args = parseArgs(process.argv.slice(2));
const transcript = await readJson(args.input);
const bundle = extractBundle(transcript);

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

console.log(
  [
    `Extracted ${bundle.claims.length} claims.`,
    `Parameter sets: ${bundle.parameter_sets.length}`,
    `Decisions: ${bundle.decisions.length}`,
    `Controversies: ${bundle.controversies.length}`,
    `Risks: ${bundle.risks.length}`,
    `Tasks: ${bundle.tasks.length}`,
    `Output: ${args.output}`
  ].join("\n")
);
