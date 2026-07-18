import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plannerVersion = "writeback-planner-0.1.0";

function parseArgs(argv) {
  const args = {
    input: resolve(root, "evaluation", "demo-extraction-bundle.generated.json"),
    output: resolve(root, "evaluation", "demo-writeback-plan.generated.json")
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

function suffixFromId(id, prefix) {
  return id.replace(new RegExp(`^${prefix}-`), "");
}

function redactSpeakerIds(claims) {
  return [...new Set(claims.map((claim) => claim.source.speaker_id))].map(
    (speakerId, index) => ({
      original: speakerId,
      redacted: `SPEAKER-${String(index + 1).padStart(2, "0")}`
    })
  );
}

function summarizeParameters(claims) {
  return claims
    .filter((claim) => claim.object.parameter_name)
    .map((claim) => ({
      claim_id: claim.claim_id,
      name: claim.object.parameter_name,
      value: claim.object.value ?? null,
      previous_value: claim.object.previous_value ?? null,
      unit: claim.object.unit_ucum ?? null,
      status: claim.verification_status,
      raw_text: claim.object.raw_text
    }));
}

function collectClaimsByType(claims, type) {
  return claims.filter((claim) => claim.claim_type === type);
}

function idempotencyKey(bundle, targetType, discriminator) {
  return [
    bundle.meeting.meeting_id,
    bundle.bundle_id,
    plannerVersion,
    targetType,
    discriminator
  ].join(":");
}

function makeBaseReviewCommand(bundle, suffix) {
  const claims = bundle.claims;
  const sourceClaimIds = claims.map((claim) => claim.claim_id);
  const flags = [...new Set(claims.flatMap((claim) => claim.flags))];

  return {
    command_id: `CMD-${suffix}-BASE-001`,
    target_type: "base_review_record",
    operation: "base.record_upsert",
    profile: "xtal-writer",
    identity: "user",
    risk_level: "write",
    requires_dry_run: true,
    requires_confirmation: true,
    idempotency_key: idempotencyKey(bundle, "base_review_record", "review-desk"),
    source_claim_ids: sourceClaimIds,
    command_preview:
      "lark-cli base +record-upsert --profile xtal-writer --as user --dry-run --payload @.tmp/writeback/base-review-record.json",
    payload: {
      table_purpose: "结论审阅台",
      experiment_id: bundle.experiment.experiment_id,
      meeting_id: bundle.meeting.meeting_id,
      bundle_id: bundle.bundle_id,
      review_status: "IN_REVIEW",
      claim_count: claims.length,
      parameter_count: summarizeParameters(claims).length,
      risk_count: collectClaimsByType(claims, "risk").length,
      task_count: collectClaimsByType(claims, "task").length,
      flags,
      parameter_summary: summarizeParameters(claims),
      source_claim_ids: sourceClaimIds
    },
    redaction: {
      resource_tokens_redacted: true,
      person_identifiers_redacted: true,
      raw_transcript_excluded: true
    }
  };
}

function makeTaskCommands(bundle, suffix) {
  const taskClaims = collectClaimsByType(bundle.claims, "task");
  const riskClaims = collectClaimsByType(bundle.claims, "risk");
  const commands = taskClaims.map((claim, index) => ({
    command_id: `CMD-${suffix}-TASK-${String(index + 1).padStart(3, "0")}`,
    target_type: "task_review_action",
    operation: "task.create",
    profile: "xtal-writer",
    identity: "user",
    risk_level: "write",
    requires_dry_run: true,
    requires_confirmation: true,
    idempotency_key: idempotencyKey(bundle, "task_review_action", claim.claim_id),
    source_claim_ids: [claim.claim_id],
    command_preview:
      "lark-cli task +create --profile xtal-writer --as user --dry-run --payload @.tmp/writeback/review-task.json",
    payload: {
      summary: claim.object.action_text,
      due_at: claim.object.due_at ?? null,
      assignee_hint: claim.object.assignee_id ?? null,
      status: "todo",
      source_claim_id: claim.claim_id,
      review_status: claim.verification_status
    },
    redaction: {
      resource_tokens_redacted: true,
      person_identifiers_redacted: true,
      raw_transcript_excluded: true
    }
  }));

  if (riskClaims.length > 0) {
    commands.push({
      command_id: `CMD-${suffix}-TASK-${String(commands.length + 1).padStart(3, "0")}`,
      target_type: "task_review_action",
      operation: "task.create",
      profile: "xtal-writer",
      identity: "user",
      risk_level: "write",
      requires_dry_run: true,
      requires_confirmation: true,
      idempotency_key: idempotencyKey(bundle, "task_review_action", "risk-review"),
      source_claim_ids: riskClaims.map((claim) => claim.claim_id),
      command_preview:
        "lark-cli task +create --profile xtal-writer --as user --dry-run --payload @.tmp/writeback/risk-review-task.json",
      payload: {
        summary: `复核 ${bundle.experiment.experiment_id} 的高风险实验条件`,
        due_at: null,
        assignee_hint: "reviewer",
        status: "todo",
        source_claim_ids: riskClaims.map((claim) => claim.claim_id),
        review_status: "IN_REVIEW"
      },
      redaction: {
        resource_tokens_redacted: true,
        person_identifiers_redacted: true,
        raw_transcript_excluded: true
      }
    });
  }

  return commands;
}

function makeDocxKnowledgeCardCommand(bundle, suffix) {
  const claims = bundle.claims;
  const riskClaims = collectClaimsByType(claims, "risk");
  const insightClaims = collectClaimsByType(claims, "insight");
  const taskClaims = collectClaimsByType(claims, "task");

  return {
    command_id: `CMD-${suffix}-DOCX-001`,
    target_type: "docx_knowledge_card",
    operation: "docx.create",
    profile: "xtal-writer",
    identity: "user",
    risk_level: "write",
    requires_dry_run: true,
    requires_confirmation: true,
    idempotency_key: idempotencyKey(bundle, "docx_knowledge_card", "draft-card"),
    source_claim_ids: claims.map((claim) => claim.claim_id),
    command_preview:
      "lark-cli docs +create --profile xtal-writer --as user --dry-run --title '<redacted-demo-title>' --content @.tmp/writeback/knowledge-card.xml",
    payload: {
      title: `${bundle.experiment.experiment_id} 知识卡片草稿`,
      publication_status: "IN_REVIEW",
      sections: [
        {
          heading: "结论摘要",
          items: summarizeParameters(claims)
        },
        {
          heading: "风险与复核",
          items: riskClaims.map((claim) => ({
            claim_id: claim.claim_id,
            summary: claim.object.normalized_text ?? claim.object.raw_text,
            flags: claim.flags
          }))
        },
        {
          heading: "历史复用线索",
          items: insightClaims.map((claim) => ({
            claim_id: claim.claim_id,
            reference_id: claim.object.reference_id,
            summary: claim.object.normalized_text ?? claim.object.raw_text
          }))
        },
        {
          heading: "待办",
          items: taskClaims.map((claim) => ({
            claim_id: claim.claim_id,
            summary: claim.object.action_text,
            due_at: claim.object.due_at ?? null
          }))
        }
      ],
      source_bundle_id: bundle.bundle_id,
      speaker_map: redactSpeakerIds(claims)
    },
    redaction: {
      resource_tokens_redacted: true,
      person_identifiers_redacted: true,
      raw_transcript_excluded: true
    }
  };
}

function planWriteback(bundle) {
  const suffix = suffixFromId(bundle.bundle_id, "BND");
  const commands = [
    makeBaseReviewCommand(bundle, suffix),
    ...makeTaskCommands(bundle, suffix),
    makeDocxKnowledgeCardCommand(bundle, suffix)
  ];

  return {
    schema_version: "1.0.0",
    plan_id: `PLAN-${suffix}-WRITEBACK`,
    source_bundle_id: bundle.bundle_id,
    mode: "dry_run",
    created_at: "2026-07-18T12:10:00+08:00",
    actor: {
      profile: "xtal-writer",
      identity: "user",
      permission_boundary:
        "Separate writer profile. Plan generation only; real CLI execution requires dry-run preview and explicit human confirmation."
    },
    safety: {
      gateway_does_not_execute: true,
      dry_run_default: true,
      requires_human_confirmation_for_write: true,
      redacts_sensitive_fields: true,
      allowed_operations: ["base.record_upsert", "task.create", "docx.create"],
      forbidden_operations: [
        "raw_api_call",
        "permission_change",
        "message_send",
        "delete",
        "share_public_link"
      ]
    },
    commands
  };
}

const args = parseArgs(process.argv.slice(2));
const bundle = await readJson(args.input);
const plan = planWriteback(bundle);

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

console.log(
  [
    `Planned ${plan.commands.length} writeback commands.`,
    `Mode: ${plan.mode}`,
    `Profile: ${plan.actor.profile}`,
    `Output: ${args.output}`
  ].join("\n")
);
