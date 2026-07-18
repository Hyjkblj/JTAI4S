import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {
    transcript: resolve(root, "evaluation", "demo-meeting-transcript.normalized-from-minutes.json"),
    bundle: resolve(root, "evaluation", "demo-extraction-bundle.generated.json"),
    plan: resolve(root, "evaluation", "demo-writeback-plan.generated.json"),
    executionLog: resolve(root, "evaluation", "demo-writeback-execution-log.generated.json"),
    output: resolve(root, "evaluation", "demo-e2e-report.md")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--transcript") {
      args.transcript = resolve(root, value);
      index += 1;
    } else if (arg === "--bundle") {
      args.bundle = resolve(root, value);
      index += 1;
    } else if (arg === "--plan") {
      args.plan = resolve(root, value);
      index += 1;
    } else if (arg === "--execution-log") {
      args.executionLog = resolve(root, value);
      index += 1;
    } else if (arg === "--output") {
      args.output = resolve(root, value);
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

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function markdownTable(rows) {
  const header = "| 项目 | 结果 |\n|---|---|";
  return [header, ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join("\n");
}

function buildReport(transcript, bundle, plan, executionLog) {
  const claimTypeCounts = countBy(bundle.claims, (claim) => claim.claim_type);
  const anchoredClaims = bundle.claims.filter(
    (claim) =>
      claim.source?.quote &&
      Number.isInteger(claim.source?.start_ms) &&
      Number.isInteger(claim.source?.end_ms)
  ).length;
  const reviewRequired = bundle.claims.filter(
    (claim) => claim.verification_status === "IN_REVIEW"
  ).length;
  const dryRunCommands = plan.commands.filter(
    (command) => command.requires_dry_run && command.command_preview.includes("--dry-run")
  ).length;
  const executionSucceeded = executionLog.summary.succeeded;
  const externalCommands = executionLog.summary.executed_external_commands;

  return [
    "# XtalLoop P0 端到端演示报告",
    "",
    "> 本报告由 `npm run demo:e2e` 自动生成，使用脱敏/合成飞书妙记样例，不包含真实飞书资源 URL、Token、Open ID 或原始企业会议正文。",
    "",
    "## 1. 链路概览",
    "",
    "```text",
    "Feishu Minutes redacted sample",
    "  -> normalized transcript",
    "  -> rule-based extractor",
    "  -> reviewable extraction bundle",
    "  -> dry-run writeback plan",
    "```",
    "",
    markdownTable([
      ["会议 ID", transcript.meeting.meeting_id],
      ["实验 ID", transcript.experiment.experiment_id],
      ["来源系统", transcript.meeting.source_system],
      ["数据来源", transcript.data_origin],
      ["发言片段", `${transcript.utterances.length}`],
      ["结构化 Claims", `${bundle.claims.length}`],
      ["SourceAnchor 覆盖", `${anchoredClaims}/${bundle.claims.length}`],
      ["待人工审阅 Claims", `${reviewRequired}/${bundle.claims.length}`],
      ["写回命令计划", `${plan.commands.length}`],
      ["Dry-run 命令", `${dryRunCommands}/${plan.commands.length}`],
      ["执行日志成功项", `${executionSucceeded}/${executionLog.summary.total}`],
      ["真实外部命令执行数", `${externalCommands}`]
    ]),
    "",
    "## 2. Claim 类型分布",
    "",
    markdownTable(
      Object.entries(claimTypeCounts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([type, count]) => [type, `${count}`])
    ),
    "",
    "## 3. 写回计划安全边界",
    "",
    markdownTable([
      ["执行模式", plan.mode],
      ["写入 Profile", plan.actor.profile],
      ["写入身份", plan.actor.identity],
      ["仅生成计划不执行", plan.safety.gateway_does_not_execute ? "是" : "否"],
      ["默认 dry-run", plan.safety.dry_run_default ? "是" : "否"],
      ["写操作需要人工确认", plan.safety.requires_human_confirmation_for_write ? "是" : "否"],
      ["允许操作", plan.safety.allowed_operations.join(", ")],
      ["禁止操作", plan.safety.forbidden_operations.join(", ")]
    ]),
    "",
    "## 4. 可演示业务故事",
    "",
    "1. 会议中出现参数变化、候选建议、最终决策、风险、历史失败复用和 ASR 日期异常。",
    "2. Extractor 将它们拆成 9 条可追溯 claim，每条都有说话人、时间戳、原文和 quote hash。",
    "3. Planner 只生成 Base / Task / Docx 的 dry-run 写回计划，避免未审阅结论自动发布。",
    "4. Executor 在仓库演示模式下只生成模拟 dry-run execution log，不触发真实飞书调用。",
    "",
    "## 5. 当前限制",
    "",
    "- 当前 extractor 是规则型 MVP，适合稳定演示，不代表泛化模型能力。",
    "- 当前 writeback planner 不执行真实 lark-cli；真实执行层仍需接入退出码、重试、限流和失败队列。",
    "- 真实会议正文应放在 `.tmp/` 或私有目录中运行，不提交到仓库。",
    ""
  ].join("\n");
}

const args = parseArgs(process.argv.slice(2));
const transcript = await readJson(args.transcript);
const bundle = await readJson(args.bundle);
const plan = await readJson(args.plan);
const executionLog = await readJson(args.executionLog);
const report = buildReport(transcript, bundle, plan, executionLog);

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, report, "utf8");

console.log(`Demo report: ${args.output}`);
