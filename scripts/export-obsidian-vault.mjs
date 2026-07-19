#!/usr/bin/env node
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(root, args.input ?? "evaluation/demo-extraction-bundle.generated.json");
const outputDir = path.resolve(root, args.output ?? "output/obsidian-vault");
const outputFolder = normalizeVaultPath(args.folder ?? "XtalLoop");
const installPlugin = Boolean(args["install-plugin"]);

if (!existsSync(inputPath)) {
  throw new Error(`input file not found: ${inputPath}`);
}

const bundle = JSON.parse(await readFile(inputPath, "utf8"));
validateBundle(bundle);
await exportVault(bundle, outputDir, outputFolder, installPlugin);

console.log(`Obsidian vault exported: ${path.relative(root, outputDir)}`);
console.log(`Claims exported: ${bundle.claims.length}`);
console.log(`Plugin installed: ${installPlugin ? "yes" : "no"}`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function validateBundle(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("extraction bundle must be a JSON object");
  }
  if (!bundle.bundle_id) {
    throw new Error("bundle_id is required");
  }
  if (!bundle.meeting?.meeting_id) {
    throw new Error("meeting.meeting_id is required");
  }
  if (!bundle.experiment?.experiment_id) {
    throw new Error("experiment.experiment_id is required");
  }
  if (!Array.isArray(bundle.claims)) {
    throw new Error("claims must be an array");
  }
}

async function exportVault(bundle, vaultDir, folder, shouldInstallPlugin) {
  await ensureDir(vaultDir);
  await ensureDir(path.join(vaultDir, ".obsidian"));
  await writeJson(path.join(vaultDir, ".obsidian", "app.json"), {
    newFileLocation: "folder",
    newFileFolderPath: folder,
    attachmentFolderPath: `${folder}/Attachments`
  });

  await writeJson(path.join(vaultDir, ".obsidian", "community-plugins.json"), shouldInstallPlugin ? ["xtalloop-importer"] : []);

  if (shouldInstallPlugin) {
    await installPluginToVault(vaultDir);
  }

  const importDir = path.join(vaultDir, ...folder.split("/"), "import");
  await ensureDir(importDir);
  await writeJson(path.join(importDir, "extraction-bundle.json"), bundle);

  const claimsDir = path.join(vaultDir, ...folder.split("/"), "Claims");
  const meetingsDir = path.join(vaultDir, ...folder.split("/"), "Meetings");
  const experimentsDir = path.join(vaultDir, ...folder.split("/"), "Experiments");
  const ontologyDir = path.join(vaultDir, ...folder.split("/"), "Ontology");
  const graphDir = path.join(vaultDir, ...folder.split("/"), "Graph");

  await Promise.all([
    ensureDir(claimsDir),
    ensureDir(meetingsDir),
    ensureDir(experimentsDir),
    ensureDir(ontologyDir),
    ensureDir(graphDir)
  ]);

  const ontologyVersion = firstNonEmpty(
    bundle.claims.map((claim) => claim.versions?.ontology),
    "xtalloop-core-0.1.0"
  );

  await writeText(path.join(vaultDir, ...folder.split("/"), "README.md"), renderReadme(bundle, folder));
  await writeText(path.join(vaultDir, ...folder.split("/"), "Index.md"), renderIndex(bundle, folder, ontologyVersion));
  await writeText(
    path.join(meetingsDir, `${safeFileName(bundle.meeting.meeting_id)}.md`),
    renderMeeting(bundle, folder)
  );
  await writeText(
    path.join(experimentsDir, `${safeFileName(bundle.experiment.experiment_id)}.md`),
    renderExperiment(bundle, folder)
  );
  await writeText(
    path.join(ontologyDir, `${safeFileName(ontologyVersion)}.md`),
    renderOntology(bundle, folder, ontologyVersion)
  );
  await writeText(path.join(graphDir, "Relationships.md"), renderGraph(bundle, folder));

  for (const claim of bundle.claims) {
    await writeText(path.join(claimsDir, `${safeFileName(claim.claim_id)}.md`), renderClaim(bundle, claim, folder));
  }
}

async function installPluginToVault(vaultDir) {
  const pluginSource = path.resolve(root, "obsidian-plugin", "xtalloop-importer");
  const pluginTarget = path.join(vaultDir, ".obsidian", "plugins", "xtalloop-importer");
  await ensureDir(pluginTarget);
  for (const fileName of ["manifest.json", "main.js", "styles.css", "README.md"]) {
    await copyFile(path.join(pluginSource, fileName), path.join(pluginTarget, fileName));
  }
}

function renderReadme(bundle, folder) {
  return [
    "# XtalLoop Obsidian Demo Vault",
    "",
    "这个 Vault 用于演示 XtalLoop 的个人知识复用端。",
    "",
    "## 使用方式",
    "",
    "1. 用 Obsidian 打开本目录。",
    "2. 若 Obsidian 提示安全模式，请仅在本地演示环境中启用社区插件。",
    "3. 打开 XtalLoop Importer 插件，或直接查看下面的入口文件。",
    "",
    "## 入口",
    "",
    `- [[${folder}/Index|XtalLoop Index]]`,
    `- [[${folder}/Graph/Relationships|Relationships]]`,
    `- [[${folder}/Meetings/${bundle.meeting.meeting_id}|Meeting ${bundle.meeting.meeting_id}]]`,
    `- [[${folder}/Experiments/${bundle.experiment.experiment_id}|Experiment ${bundle.experiment.experiment_id}]]`,
    "",
    "## 边界",
    "",
    "- 本 Vault 只保存脱敏 demo bundle。",
    "- 飞书仍是组织事实源。",
    "- Obsidian 只做个人阅读、复盘、双链和图谱浏览。",
    ""
  ].join("\n");
}

function renderIndex(bundle, folder, ontologyVersion) {
  const byType = groupBy(bundle.claims, (claim) => claim.claim_type ?? "unknown");
  const byStatus = groupBy(bundle.claims, (claim) => claim.verification_status ?? "UNKNOWN");
  return [
    "---",
    "xtalloop_type: index",
    `bundle_id: ${yaml(bundle.bundle_id)}`,
    `meeting_id: ${yaml(bundle.meeting.meeting_id)}`,
    `experiment_id: ${yaml(bundle.experiment.experiment_id)}`,
    `ontology: ${yaml(ontologyVersion)}`,
    "---",
    "",
    "# XtalLoop 知识收件箱",
    "",
    "> 从飞书会议/妙记 transcript 抽取出的结构化研发 Claim，进入本地 Obsidian 作为个人研究复用视图。",
    "",
    "## Overview",
    "",
    `- Bundle: \`${bundle.bundle_id}\``,
    `- Meeting: [[${folder}/Meetings/${bundle.meeting.meeting_id}|${bundle.meeting.meeting_id}]]`,
    `- Experiment: [[${folder}/Experiments/${bundle.experiment.experiment_id}|${bundle.experiment.experiment_id}]]`,
    `- Ontology: [[${folder}/Ontology/${ontologyVersion}|${ontologyVersion}]]`,
    `- Graph: [[${folder}/Graph/Relationships|Relationships]]`,
    "",
    "## Type distribution",
    "",
    ...Object.entries(byType).map(([type, claims]) => `- \`${type}\`: ${claims.length}`),
    "",
    "## Status distribution",
    "",
    ...Object.entries(byStatus).map(([status, claims]) => `- \`${status}\`: ${claims.length}`),
    "",
    "## Claims",
    "",
    ...bundle.claims.map((claim) => `- [[${folder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.claim_type} - ${claim.predicate} - ${summarizeObject(claim.object)}`),
    ""
  ].join("\n");
}

function renderMeeting(bundle, folder) {
  return [
    "---",
    "xtalloop_type: meeting",
    `meeting_id: ${yaml(bundle.meeting.meeting_id)}`,
    `source_system: ${yaml(bundle.meeting.source_system)}`,
    `started_at: ${yaml(bundle.meeting.started_at)}`,
    `ended_at: ${yaml(bundle.meeting.ended_at)}`,
    "---",
    "",
    `# 会议 ${bundle.meeting.meeting_id}`,
    "",
    `标题: ${bundle.meeting.title}`,
    "",
    "## Claims",
    "",
    ...bundle.claims.map((claim) => `- [[${folder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.claim_type} - ${summarizeObject(claim.object)}`),
    ""
  ].join("\n");
}

function renderExperiment(bundle, folder) {
  const experiment = bundle.experiment;
  return [
    "---",
    "xtalloop_type: experiment",
    `experiment_id: ${yaml(experiment.experiment_id)}`,
    `project_id: ${yaml(experiment.project_id)}`,
    `experiment_type: ${yaml(experiment.experiment_type)}`,
    `status: ${yaml(experiment.status)}`,
    "---",
    "",
    `# 实验 ${experiment.experiment_id}`,
    "",
    `- Project: \`${experiment.project_id}\``,
    `- Type: \`${experiment.experiment_type}\``,
    `- Status: \`${experiment.status}\``,
    "",
    "## Parameter sets",
    "",
    ...(bundle.parameter_sets ?? []).map((set) => `- \`${set.parameter_set_id}\` v${set.version} - ${set.verification_status}`),
    "",
    "## Claims",
    "",
    ...bundle.claims.map((claim) => `- [[${folder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.predicate}`),
    ""
  ].join("\n");
}

function renderClaim(bundle, claim, folder) {
  const source = claim.source ?? {};
  const ontologyVersion = claim.versions?.ontology ?? "xtalloop-core-0.1.0";
  const flags = Array.isArray(claim.flags) ? claim.flags : [];
  const referenceLine = claim.object?.reference_id
    ? [`- Reference: \`${claim.object.reference_id}\``]
    : [];

  return [
    "---",
    "xtalloop_type: claim",
    `claim_id: ${yaml(claim.claim_id)}`,
    `meeting_id: ${yaml(claim.meeting_id)}`,
    `experiment_id: ${yaml(claim.experiment_id)}`,
    `claim_type: ${yaml(claim.claim_type)}`,
    `predicate: ${yaml(claim.predicate)}`,
    `verification_status: ${yaml(claim.verification_status)}`,
    `confidence: ${claim.confidence ?? ""}`,
    `ontology: ${yaml(ontologyVersion)}`,
    `source_quote_hash: ${yaml(source.quote_hash)}`,
    `tags: ["xtalloop/claim", "xtalloop/type/${claim.claim_type}", "xtalloop/status/${String(claim.verification_status).toLowerCase()}"]`,
    "---",
    "",
    `# ${claim.claim_id}`,
    "",
    `摘要: **${summarizeObject(claim.object)}**`,
    "",
    "## Links",
    "",
    `- Meeting: [[${folder}/Meetings/${bundle.meeting.meeting_id}|${bundle.meeting.meeting_id}]]`,
    `- Experiment: [[${folder}/Experiments/${bundle.experiment.experiment_id}|${bundle.experiment.experiment_id}]]`,
    `- Ontology: [[${folder}/Ontology/${ontologyVersion}|${ontologyVersion}]]`,
    ...referenceLine,
    "",
    "## Claim fields",
    "",
    `- Type: \`${claim.claim_type}\``,
    `- Predicate: \`${claim.predicate}\``,
    `- Subject: \`${claim.subject_id}\``,
    `- Status: \`${claim.verification_status}\``,
    `- Confidence: \`${claim.confidence}\``,
    flags.length ? `- Flags: ${flags.map((flag) => `\`${flag}\``).join(", ")}` : "- Flags: 无",
    "",
    "## SourceAnchor",
    "",
    `- System: \`${source.system ?? "UNKNOWN"}\``,
    `- Utterance: \`${source.utterance_id ?? "UNKNOWN"}\``,
    `- Speaker: \`${source.speaker_id ?? "UNKNOWN"}\``,
    `- Time: \`${source.start_ms ?? "?"}ms -> ${source.end_ms ?? "?"}ms\``,
    `- Quote hash: \`${source.quote_hash ?? "UNKNOWN"}\``,
    "",
    "> " + String(source.quote ?? "No quote available.").replace(/\n/g, "\n> "),
    "",
    "## Object JSON",
    "",
    "```json",
    JSON.stringify(claim.object ?? {}, null, 2),
    "```",
    "",
    "## Personal note",
    "",
    "- 在这里补充个人复盘。若要进入组织知识库，应回到飞书审核流。",
    ""
  ].join("\n");
}

function renderOntology(bundle, folder, ontologyVersion) {
  const predicates = [...new Set(bundle.claims.map((claim) => claim.predicate).filter(Boolean))].sort();
  const types = [...new Set(bundle.claims.map((claim) => claim.claim_type).filter(Boolean))].sort();
  return [
    "---",
    "xtalloop_type: ontology",
    `ontology: ${yaml(ontologyVersion)}`,
    "---",
    "",
    `# 轻量本体 ${ontologyVersion}`,
    "",
    "MVP 阶段只做轻量应用本体索引，记录 Claim 类型、谓词和证据来源。正式生命科学本体治理仍需要知识管理员审批。",
    "",
    "## Claim types",
    "",
    ...types.map((type) => `- \`${type}\``),
    "",
    "## Predicates",
    "",
    ...predicates.map((predicate) => `- \`${predicate}\``),
    "",
    "## Claims",
    "",
    ...bundle.claims.map((claim) => `- [[${folder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.predicate}`),
    ""
  ].join("\n");
}

function renderGraph(bundle, folder) {
  const lines = [
    "---",
    "xtalloop_type: graph",
    `bundle_id: ${yaml(bundle.bundle_id)}`,
    "---",
    "",
    "# 关系图",
    "",
    "```mermaid",
    "flowchart LR",
    `  M["Meeting ${escapeMermaid(bundle.meeting.meeting_id)}"] --> E["Experiment ${escapeMermaid(bundle.experiment.experiment_id)}"]`
  ];

  bundle.claims.forEach((claim, index) => {
    const claimNode = `C${index + 1}`;
    lines.push(`  E --> ${claimNode}["${escapeMermaid(`${claim.claim_type}: ${claim.predicate}`)}"]`);
    if (claim.object?.reference_id) {
      lines.push(`  ${claimNode} --> R${index + 1}["Reference ${escapeMermaid(claim.object.reference_id)}"]`);
    }
  });

  lines.push("```", "", "## Obsidian links", "");
  lines.push(`- [[${folder}/Meetings/${bundle.meeting.meeting_id}|Meeting ${bundle.meeting.meeting_id}]]`);
  lines.push(`- [[${folder}/Experiments/${bundle.experiment.experiment_id}|Experiment ${bundle.experiment.experiment_id}]]`);
  for (const claim of bundle.claims) {
    lines.push(`- [[${folder}/Claims/${claim.claim_id}|${claim.claim_id}]]`);
  }
  lines.push("");
  return lines.join("\n");
}

function summarizeObject(object) {
  if (!object || typeof object !== "object") return "无结构化对象";
  if (object.raw_text) return object.raw_text;
  if (object.action_text) return object.action_text;
  if (object.normalized_text) return object.normalized_text;
  if (object.reference_id) return object.reference_id;
  if (object.parameter_name && object.value !== undefined) {
    return `${object.parameter_name} = ${object.value}${object.unit_raw || object.unit_ucum || ""}`;
  }
  if (object.value !== undefined) return String(object.value);
  return JSON.stringify(object);
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});
}

function firstNonEmpty(values, fallback) {
  for (const value of values) {
    if (value) return value;
  }
  return fallback;
}

function safeFileName(value) {
  return String(value)
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

function normalizeVaultPath(value) {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
}

function yaml(value) {
  if (value === undefined || value === null) return "\"\"";
  return JSON.stringify(String(value));
}

function escapeMermaid(value) {
  return String(value ?? "")
    .replace(/"/g, "'")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .slice(0, 72);
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${content.replace(/\s+$/u, "")}\n`, "utf8");
}

async function writeJson(filePath, value) {
  await writeText(filePath, JSON.stringify(value, null, 2));
}
