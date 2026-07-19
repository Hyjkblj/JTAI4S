# XtalLoop 评委使用与评估指南

本文回答一个评委最自然的问题：如果我只打开 GitHub 仓库，应该如何判断这个方案是否可运行、是否真的能落地到飞书业务场景？

## 1. 先看结论

本仓库提供两类评估路径：

| 路径 | 是否需要飞书租户 | 评估内容 |
|---|---:|---|
| 公开离线评估 | 否 | 跑通 transcript -> claims -> writeback plan -> execution log -> report |
| Obsidian 个人知识复用评估 | 否 | 将 claims 导出成 Obsidian Vault，查看知识卡、双链、关系图和插件 MVP |
| 私有真实飞书烟测 | 是 | 用评委/企业自己的飞书测试租户验证真实会议产物读取和 dry-run 写回 |

公开仓库不会包含真实飞书 App Secret、OAuth token、Base token、Doc token、Open ID 或真实会议正文。

## 2. 公开离线评估方式

```powershell
npm install
npm run check:env
npm test
npm run demo:e2e
npm run obsidian:export
```

预期结果：

```text
Artifact validation passed.
Golden-set entries: 24
Scientific claims: 27
Meeting transcripts: 2
Extraction bundles: 2
Writeback commands: 4
Execution log entries: 4
```

评估产物：

- `evaluation/demo-e2e-report.md`
- `evaluation/demo-extraction-bundle.generated.json`
- `evaluation/demo-writeback-plan.generated.json`
- `evaluation/demo-writeback-execution-log.generated.json`
- `output/obsidian-vault`
- `output/pdf/XtalLoop_开题补充材料.pdf`

## 3. 公开离线 demo 证明什么

它证明：

1. 会议 transcript 可以被标准化；
2. 研发参数、风险、争议、任务可以被抽成结构化 claim；
3. 每条 claim 有 SourceAnchor；
4. 未审阅结论不会自动标记为 VERIFIED；
5. 写回飞书前会生成 dry-run 计划；
6. 命令白名单、幂等键、安全检查和执行日志都可验证。
7. 结构化 claim 可以转成 Obsidian Markdown 知识卡、双链索引和 Mermaid 关系图。

它不声称：

- 当前规则型 extractor 已具备生产级泛化能力；
- 当前公开仓库会直接连接评委的飞书租户；
- 当前 demo 会真实创建评委租户里的 Base、Task 或 Docx。
- 当前 Obsidian 插件会绕过飞书权限或自动发布组织知识。

## 3.1 如何评估 Obsidian MVP

运行：

```powershell
npm run obsidian:export
```

然后用 Obsidian 打开：

```text
output/obsidian-vault
```

建议检查：

- `XtalLoop/Index.md`：Claim 类型、状态和入口索引；
- `XtalLoop/Claims/*.md`：每条 Claim 的 YAML frontmatter、SourceAnchor、quote_hash、个人批注区；
- `XtalLoop/Graph/Relationships.md`：Meeting -> Experiment -> Claim -> Reference 的 Mermaid 关系图；
- `.obsidian/plugins/xtalloop-importer`：可安装的 Obsidian 插件 MVP。

安全边界：Obsidian 只承接个人复用视图；飞书仍是组织事实源；本地 Vault 不保存真实 token、Open ID、真实飞书 URL 或完整企业会议逐字稿。

## 4. 真实飞书场景如何评估

真实飞书评估需要评委或企业提供自己的测试租户、测试应用和测试会议。原因很简单：飞书会议、妙记、Base、Docx、Task 都是租户内资源，公开仓库不能携带这些私有凭据。

真实评估建议看：

- `docs/real-feishu-setup.md`
- `docs/feishu-cli-feasibility.md`
- `fixtures/feishu/*.redacted.json`

已实测能力包括：

- 会议结束事件
- Note 生成事件
- Minutes 生成事件
- Minutes transcript 读取
- Base / Task / Docx 写回与读回

## 5. 评估打分建议

| 维度 | 可以如何看 |
|---|---|
| 方案完整性 | README、PRD、PDF 补充材料 |
| 工程可运行性 | `npm test`、`npm run demo:e2e` |
| 飞书落地性 | Feishu CLI 可行性报告、脱敏实测 fixtures |
| 数据严谨性 | schemas、golden-set、SourceAnchor、quote_hash |
| Obsidian 复用端 | `npm run obsidian:export`、`output/obsidian-vault`、插件源码 |
| 安全意识 | `.env.example`、`.gitignore`、writeback plan、execution log |
| 可推广性 | P0/P1/P2 任务清单与真实租户配置指南 |

## 6. 推荐评委阅读顺序

1. `README.md`
2. `output/pdf/XtalLoop_开题补充材料.pdf`
3. `evaluation/demo-e2e-report.md`
4. `docs/feishu-cli-feasibility.md`
5. `docs/real-feishu-setup.md`
6. `output/obsidian-vault/XtalLoop/Index.md`
7. `obsidian-plugin/xtalloop-importer/README.md`
8. `schemas/scientific-claim.schema.json`
