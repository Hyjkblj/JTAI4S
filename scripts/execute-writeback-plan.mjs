import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowedOperations = new Set(["base.record_upsert", "task.create", "docx.create"]);
const deterministicStartedAt = "2026-07-18T12:15:00+08:00";
const deterministicEndedAt = "2026-07-18T12:15:01+08:00";

function parseArgs(argv) {
  const args = {
    input: resolve(root, "evaluation", "demo-writeback-plan.generated.json"),
    output: resolve(root, "evaluation", "demo-writeback-execution-log.generated.json"),
    mode: "simulate"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input") {
      args.input = resolve(root, value);
      index += 1;
    } else if (arg === "--output") {
      args.output = resolve(root, value);
      index += 1;
    } else if (arg === "--mode") {
      args.mode = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["simulate", "real_dry_run"].includes(args.mode)) {
    throw new Error(`Unsupported execution mode: ${args.mode}`);
  }

  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function hashPreview(commandPreview) {
  return `sha256:${createHash("sha256").update(commandPreview).digest("hex")}`;
}

function buildChecks(command, plan) {
  return {
    operation_allowed: plan.safety.allowed_operations.includes(command.operation),
    uses_writer_profile: command.profile === "xtal-writer",
    uses_user_identity: command.identity === "user",
    dry_run_present:
      command.requires_dry_run === true && command.command_preview.includes("--dry-run"),
    confirmation_not_bypassed: !command.command_preview.includes("--yes"),
    source_claims_present: command.source_claim_ids.length > 0
  };
}

function allChecksPass(checks) {
  return Object.values(checks).every(Boolean);
}

function simulateCommand(command, plan, mode) {
  const checks = buildChecks(command, plan);
  const ok = allChecksPass(checks) && allowedOperations.has(command.operation);
  const realModeAllowed =
    mode === "real_dry_run" && process.env.XTALLOOP_ALLOW_REAL_DRY_RUN === "1";
  const blockedRealMode = mode === "real_dry_run" && !realModeAllowed;
  const status = blockedRealMode
    ? "blocked"
    : ok
      ? mode === "real_dry_run"
        ? "real_dry_run_ok"
        : "simulated_dry_run_ok"
      : "failed";

  return {
    command_id: command.command_id,
    operation: command.operation,
    target_type: command.target_type,
    mode,
    status,
    exit_code: status === "failed" ? 1 : 0,
    ok: status !== "failed" && status !== "blocked",
    external_command_executed: false,
    dry_run: true,
    idempotency_key: command.idempotency_key,
    started_at: deterministicStartedAt,
    ended_at: deterministicEndedAt,
    redacted_stdout: {
      ok: status !== "failed" && status !== "blocked",
      identity: command.identity,
      mode,
      simulated: true,
      command_preview_hash: hashPreview(command.command_preview),
      source_claim_count: command.source_claim_ids.length,
      note:
        status === "blocked"
          ? "Real dry-run is blocked until XTALLOOP_ALLOW_REAL_DRY_RUN=1 and target resource config are provided."
          : "No external Feishu command was executed in this repository-safe demo."
    },
    redacted_stderr:
      status === "blocked"
        ? {
            ok: false,
            error: {
              type: "safety",
              subtype: "real_dry_run_not_enabled",
              message:
                "Real dry-run execution requires explicit environment opt-in and private target config."
            }
          }
        : null,
    checks
  };
}

function executePlan(plan, mode) {
  if (!plan.safety.gateway_does_not_execute) {
    throw new Error("Refusing to execute a plan whose gateway_does_not_execute flag is false.");
  }
  if (!plan.safety.dry_run_default) {
    throw new Error("Refusing to execute a plan whose dry_run_default flag is false.");
  }

  const entries = plan.commands.map((command) => simulateCommand(command, plan, mode));
  const succeeded = entries.filter((entry) => entry.ok).length;
  const failed = entries.length - succeeded;
  const suffix = plan.plan_id.replace(/^PLAN-/u, "");

  return {
    schema_version: "1.0.0",
    execution_id: `EXEC-${suffix}`,
    plan_id: plan.plan_id,
    mode,
    started_at: deterministicStartedAt,
    ended_at: deterministicEndedAt,
    summary: {
      total: entries.length,
      succeeded,
      failed,
      executed_external_commands: entries.filter((entry) => entry.external_command_executed).length,
      dry_run_commands: entries.filter((entry) => entry.dry_run).length
    },
    entries
  };
}

const args = parseArgs(process.argv.slice(2));
const plan = await readJson(args.input);
const log = executePlan(plan, args.mode);

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(log, null, 2)}\n`, "utf8");

console.log(
  [
    `Execution log entries: ${log.entries.length}`,
    `Mode: ${log.mode}`,
    `Succeeded: ${log.summary.succeeded}`,
    `Failed: ${log.summary.failed}`,
    `External commands executed: ${log.summary.executed_external_commands}`,
    `Output: ${args.output}`
  ].join("\n")
);
