const {
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  normalizePath
} = require("obsidian");

const DEFAULT_SETTINGS = {
  importPath: "XtalLoop/import/extraction-bundle.json",
  outputFolder: "XtalLoop"
};

module.exports = class XtalLoopImporterPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.addRibbonIcon("network", "Import XtalLoop bundle", () => {
      this.importBundle();
    });

    this.addCommand({
      id: "import-xtalloop-bundle",
      name: "Import extraction bundle into XtalLoop vault",
      callback: () => this.importBundle()
    });

    this.addCommand({
      id: "open-xtalloop-index",
      name: "Open XtalLoop index",
      callback: () => this.openIndex()
    });

    this.addSettingTab(new XtalLoopSettingTab(this.app, this));
  }

  async importBundle() {
    const importPath = normalizePath(this.settings.importPath);
    const outputFolder = normalizePath(this.settings.outputFolder || DEFAULT_SETTINGS.outputFolder);

    try {
      const exists = await this.app.vault.adapter.exists(importPath);
      if (!exists) {
        new Notice(`XtalLoop import file not found: ${importPath}`);
        return;
      }

      const raw = await this.app.vault.adapter.read(importPath);
      const bundle = JSON.parse(raw);
      const result = await writeBundleToVault(this.app, bundle, outputFolder);
      new Notice(`XtalLoop imported ${result.claimCount} claims into ${outputFolder}`);
      await this.openIndex();
    } catch (error) {
      console.error("[XtalLoop] import failed", error);
      new Notice(`XtalLoop import failed: ${error.message}`);
    }
  }

  async openIndex() {
    const indexPath = normalizePath(`${this.settings.outputFolder || DEFAULT_SETTINGS.outputFolder}/Index.md`);
    const file = this.app.vault.getAbstractFileByPath(indexPath);
    if (file) {
      await this.app.workspace.getLeaf(true).openFile(file);
    } else {
      new Notice(`XtalLoop index not found: ${indexPath}`);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

class XtalLoopSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "XtalLoop Importer" });
    containerEl.createEl("p", {
      text: "Import an extraction bundle generated from Feishu Minutes into local Obsidian knowledge cards. The plugin does not connect to Feishu and does not store secrets."
    });

    new Setting(containerEl)
      .setName("Import bundle path")
      .setDesc("Path inside the current vault.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.importPath)
          .setValue(this.plugin.settings.importPath)
          .onChange(async (value) => {
            this.plugin.settings.importPath = value.trim() || DEFAULT_SETTINGS.importPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Folder where XtalLoop cards and graph index will be written.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.outputFolder)
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value.trim() || DEFAULT_SETTINGS.outputFolder;
            await this.plugin.saveSettings();
          })
      );
  }
}

async function writeBundleToVault(app, bundle, outputFolder) {
  validateBundle(bundle);

  const claims = Array.isArray(bundle.claims) ? bundle.claims : [];
  const meeting = bundle.meeting || {};
  const experiment = bundle.experiment || {};
  const ontologyVersion = firstNonEmpty(
    claims.map((claim) => claim.versions && claim.versions.ontology),
    "xtalloop-core-0.1.0"
  );

  await ensureFolder(app, outputFolder);
  await ensureFolder(app, `${outputFolder}/Claims`);
  await ensureFolder(app, `${outputFolder}/Meetings`);
  await ensureFolder(app, `${outputFolder}/Experiments`);
  await ensureFolder(app, `${outputFolder}/Ontology`);
  await ensureFolder(app, `${outputFolder}/Graph`);

  await writeFile(app, `${outputFolder}/Index.md`, renderIndex(bundle, claims, outputFolder, ontologyVersion));
  await writeFile(app, `${outputFolder}/Graph/Relationships.md`, renderRelationships(bundle, claims, outputFolder));
  await writeFile(app, `${outputFolder}/Meetings/${safeFileName(meeting.meeting_id || "UNKNOWN-MEETING")}.md`, renderMeeting(bundle, claims, outputFolder));
  await writeFile(app, `${outputFolder}/Experiments/${safeFileName(experiment.experiment_id || "UNKNOWN-EXPERIMENT")}.md`, renderExperiment(bundle, claims, outputFolder));
  await writeFile(app, `${outputFolder}/Ontology/${safeFileName(ontologyVersion)}.md`, renderOntology(ontologyVersion, claims, outputFolder));

  for (const claim of claims) {
    await writeFile(app, `${outputFolder}/Claims/${safeFileName(claim.claim_id)}.md`, renderClaim(claim, bundle, outputFolder));
  }

  return { claimCount: claims.length };
}

function validateBundle(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("bundle must be a JSON object");
  }
  if (!bundle.bundle_id) {
    throw new Error("bundle.bundle_id is required");
  }
  if (!Array.isArray(bundle.claims)) {
    throw new Error("bundle.claims must be an array");
  }
}

async function ensureFolder(app, folderPath) {
  const normalized = normalizePath(folderPath);
  if (!normalized || normalized === ".") return;
  const parts = normalized.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const exists = await app.vault.adapter.exists(current);
    if (!exists) {
      await app.vault.createFolder(current);
    }
  }
}

async function writeFile(app, path, content) {
  const normalized = normalizePath(path);
  const folder = normalized.split("/").slice(0, -1).join("/");
  await ensureFolder(app, folder);
  const exists = await app.vault.adapter.exists(normalized);
  if (exists) {
    await app.vault.adapter.write(normalized, content);
  } else {
    await app.vault.create(normalized, content);
  }
}

function renderIndex(bundle, claims, outputFolder, ontologyVersion) {
  const meeting = bundle.meeting || {};
  const experiment = bundle.experiment || {};
  const byType = groupBy(claims, (claim) => claim.claim_type || "unknown");

  return [
    "---",
    "xtalloop_type: index",
    `bundle_id: ${yaml(bundle.bundle_id)}`,
    `meeting_id: ${yaml(meeting.meeting_id)}`,
    `experiment_id: ${yaml(experiment.experiment_id)}`,
    `ontology: ${yaml(ontologyVersion)}`,
    "generated_by: XtalLoop Importer",
    "---",
    "",
    "# XtalLoop 知识收件箱",
    "",
    "> 本 Vault 由 XtalLoop extraction bundle 生成，用于演示“飞书会议 Claim -> Obsidian 知识卡/图谱索引”的个人复用链路。所有内容应视为脱敏演示或已授权摘要。",
    "",
    "## 快速入口",
    "",
    `- 会议: [[${outputFolder}/Meetings/${meeting.meeting_id || "UNKNOWN-MEETING"}|${meeting.meeting_id || "UNKNOWN-MEETING"}]]`,
    `- 实验: [[${outputFolder}/Experiments/${experiment.experiment_id || "UNKNOWN-EXPERIMENT"}|${experiment.experiment_id || "UNKNOWN-EXPERIMENT"}]]`,
    `- 关系图: [[${outputFolder}/Graph/Relationships|Relationships]]`,
    `- 本体版本: [[${outputFolder}/Ontology/${ontologyVersion}|${ontologyVersion}]]`,
    "",
    "## Claim 类型分布",
    "",
    ...Object.entries(byType).map(([type, items]) => `- ${type}: ${items.length}`),
    "",
    "## 待审阅 Claim",
    "",
    ...claims.map((claim) => {
      const status = claim.verification_status || "UNKNOWN";
      return `- [[${outputFolder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.claim_type} - ${claim.predicate} - ${status}`;
    }),
    "",
    "## 安全边界",
    "",
    "- Obsidian 只承接个人研究工作台和本地图谱复用。",
    "- 飞书仍是组织事实源，关键参数与发布动作必须回到飞书审阅。",
    "- 本地卡片不保存真实 token、URL、Open ID 或完整企业会议逐字稿。",
    ""
  ].join("\n");
}

function renderMeeting(bundle, claims, outputFolder) {
  const meeting = bundle.meeting || {};
  return [
    "---",
    "xtalloop_type: meeting",
    `meeting_id: ${yaml(meeting.meeting_id)}`,
    `source_system: ${yaml(meeting.source_system)}`,
    `started_at: ${yaml(meeting.started_at)}`,
    `ended_at: ${yaml(meeting.ended_at)}`,
    "---",
    "",
    `# 会议 ${meeting.meeting_id || "UNKNOWN-MEETING"}`,
    "",
    `标题: ${meeting.title || "未命名会议"}`,
    "",
    "## 关联 Claim",
    "",
    ...claims.map((claim) => `- [[${outputFolder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.claim_type} - ${summarizeObject(claim.object)}`),
    ""
  ].join("\n");
}

function renderExperiment(bundle, claims, outputFolder) {
  const experiment = bundle.experiment || {};
  return [
    "---",
    "xtalloop_type: experiment",
    `experiment_id: ${yaml(experiment.experiment_id)}`,
    `project_id: ${yaml(experiment.project_id)}`,
    `experiment_type: ${yaml(experiment.experiment_type)}`,
    `status: ${yaml(experiment.status)}`,
    "---",
    "",
    `# 实验 ${experiment.experiment_id || "UNKNOWN-EXPERIMENT"}`,
    "",
    "## 关联对象",
    "",
    `- Project: ${experiment.project_id || "UNKNOWN"}`,
    `- Type: ${experiment.experiment_type || "UNKNOWN"}`,
    `- Status: ${experiment.status || "UNKNOWN"}`,
    "",
    "## 关联 Claim",
    "",
    ...claims.map((claim) => `- [[${outputFolder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.predicate}`),
    ""
  ].join("\n");
}

function renderClaim(claim, bundle, outputFolder) {
  const meeting = bundle.meeting || {};
  const experiment = bundle.experiment || {};
  const ontologyVersion = claim.versions && claim.versions.ontology ? claim.versions.ontology : "xtalloop-core-0.1.0";
  const source = claim.source || {};
  const flags = Array.isArray(claim.flags) ? claim.flags : [];
  const tags = [
    "xtalloop/claim",
    `xtalloop/type/${claim.claim_type || "unknown"}`,
    `xtalloop/status/${(claim.verification_status || "unknown").toLowerCase()}`
  ];

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
    `tags: [${tags.map(yaml).join(", ")}]`,
    "---",
    "",
    `# ${claim.claim_id}`,
    "",
    `状态: \`${claim.verification_status || "UNKNOWN"}\`  `,
    `类型: \`${claim.claim_type || "unknown"}\`  `,
    `谓词: \`${claim.predicate || "unknown"}\`  `,
    `摘要: **${summarizeObject(claim.object)}**`,
    "",
    "## 链接",
    "",
    `- 会议: [[${outputFolder}/Meetings/${meeting.meeting_id || claim.meeting_id}|${meeting.meeting_id || claim.meeting_id}]]`,
    `- 实验: [[${outputFolder}/Experiments/${experiment.experiment_id || claim.experiment_id}|${experiment.experiment_id || claim.experiment_id}]]`,
    `- 本体: [[${outputFolder}/Ontology/${ontologyVersion}|${ontologyVersion}]]`,
    "",
    "## SourceAnchor",
    "",
    `- System: ${source.system || "UNKNOWN"}`,
    `- Speaker: ${source.speaker_id || "UNKNOWN"}`,
    `- Time: ${source.start_ms ?? "?"} ms -> ${source.end_ms ?? "?"} ms`,
    `- Quote hash: \`${source.quote_hash || "UNKNOWN"}\``,
    "",
    "> " + String(source.quote || "No quote available.").replace(/\n/g, "\n> "),
    "",
    "## Object",
    "",
    "```json",
    JSON.stringify(claim.object || {}, null, 2),
    "```",
    "",
    "## Review",
    "",
    `- Decision: ${(claim.review && claim.review.decision) || "pending"}`,
    `- Notes: ${(claim.review && claim.review.notes) || "无"}`,
    flags.length ? `- Flags: ${flags.map((flag) => `\`${flag}\``).join(", ")}` : "- Flags: 无",
    "",
    "## Local note",
    "",
    "- 个人批注写在这里。若要发布为组织事实，应回到飞书审核流创建提案。",
    ""
  ].join("\n");
}

function renderRelationships(bundle, claims, outputFolder) {
  const meeting = bundle.meeting || {};
  const experiment = bundle.experiment || {};
  const referenceClaims = claims.filter((claim) => claim.object && claim.object.reference_id);

  const lines = [
    "---",
    "xtalloop_type: graph",
    `bundle_id: ${yaml(bundle.bundle_id)}`,
    "---",
    "",
    "# XtalLoop 关系图",
    "",
    "```mermaid",
    "flowchart LR",
    `  M["Meeting ${meeting.meeting_id || "UNKNOWN"}"] --> E["Experiment ${experiment.experiment_id || "UNKNOWN"}"]`
  ];

  claims.forEach((claim, index) => {
    const id = `C${index + 1}`;
    lines.push(`  E --> ${id}["${escapeMermaid(`${claim.claim_type}: ${claim.predicate}`)}"]`);
    if (claim.object && claim.object.reference_id) {
      const refId = `R${index + 1}`;
      lines.push(`  ${id} --> ${refId}["Reference ${escapeMermaid(claim.object.reference_id)}"]`);
    }
  });

  lines.push("```", "", "## 双链入口", "");
  lines.push(`- [[${outputFolder}/Meetings/${meeting.meeting_id || "UNKNOWN-MEETING"}|Meeting]]`);
  lines.push(`- [[${outputFolder}/Experiments/${experiment.experiment_id || "UNKNOWN-EXPERIMENT"}|Experiment]]`);
  for (const claim of claims) {
    lines.push(`- [[${outputFolder}/Claims/${claim.claim_id}|${claim.claim_id}]]`);
  }

  if (referenceClaims.length) {
    lines.push("", "## 历史引用线索", "");
    for (const claim of referenceClaims) {
      lines.push(`- ${claim.claim_id} references \`${claim.object.reference_id}\`: ${summarizeObject(claim.object)}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function renderOntology(ontologyVersion, claims, outputFolder) {
  const predicates = [...new Set(claims.map((claim) => claim.predicate).filter(Boolean))].sort();
  const types = [...new Set(claims.map((claim) => claim.claim_type).filter(Boolean))].sort();

  return [
    "---",
    "xtalloop_type: ontology",
    `ontology: ${yaml(ontologyVersion)}`,
    "---",
    "",
    `# 本体版本 ${ontologyVersion}`,
    "",
    "> MVP 阶段只维护轻量应用本体索引，用于把会议 Claim 归一到稳定 predicate 和 claim_type。正式生命科学本体治理仍需要知识管理员审批。",
    "",
    "## Claim types",
    "",
    ...types.map((type) => `- \`${type}\``),
    "",
    "## Predicates",
    "",
    ...predicates.map((predicate) => `- \`${predicate}\``),
    "",
    "## 关联 Claim",
    "",
    ...claims.map((claim) => `- [[${outputFolder}/Claims/${claim.claim_id}|${claim.claim_id}]] - ${claim.predicate}`),
    ""
  ].join("\n");
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
    acc[key] = acc[key] || [];
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
  return String(value || "unknown")
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

function yaml(value) {
  if (value === null || value === undefined) return "\"\"";
  return JSON.stringify(String(value));
}

function escapeMermaid(value) {
  return String(value || "")
    .replace(/"/g, "'")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .slice(0, 72);
}
