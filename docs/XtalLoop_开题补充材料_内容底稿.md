# XtalLoop 开题补充材料内容底稿

> 用途：海选附件 / PDF / 演示稿底稿  
> 建议页数：12-14 页  
> 版本：v0.1  
> 数据声明：本文中的会议样例、实验编号与输出结果均为脱敏/合成演示材料；真实飞书读写链路已在测试租户中完成验证，但真实 token、URL、Open ID、会议原文不进入仓库。

---

## 第 1 页：封面

**XtalLoop：AI 实验研发加速器**

基于飞书会议 AI、飞书妙记、多维表格、任务、文档与 Obsidian 的智能自主实验室研发效能方案。

一句话价值：

> 把研发会议中的实验参数、方案争议、风险提示、待办任务和历史失败经验，自动转成可追溯、可审阅、可写回、可复用的结构化研发知识。

---

## 第 2 页：命题痛点再理解

智能自主实验室每天产生高通量合成、晶型筛选、活性测试等大量实验信息，但关键知识常常散落在会议、文档、群聊、表格和个人笔记中。

核心矛盾不是“没有会议纪要”，而是“会议知识没有变成可流转的数据对象”。

| 痛点 | 研发后果 |
|---|---|
| 参数调整依据难追溯 | 后续实验难解释，责任边界模糊 |
| 方案争议只停留在会议口头讨论 | 下次评审重复争论 |
| 失败经验难沉淀 | 重复试错，浪费物料和排期 |
| AI 纪要缺少领域结构 | 结论难进入实验执行系统 |
| 多角色跨地域协作 | 信息不同步，任务落地慢 |

---

## 第 3 页：外部洞察与竞品启发

参考 ELN、LIMS、知识库、企业协同工具和 AI 会议助手的发展趋势，可以看到三类能力正在融合：

1. 会议智能化：自动转写、总结、待办识别、章节划分。
2. 研发数据结构化：实验编号、参数、物料、结果、失败原因需要标准化表达。
3. 知识可复用：知识不应只是文档，而要能按实验、参数、失败模式、证据来源检索。

常规 AI 会议助手的问题：

- 擅长总结，但不保证科学参数准确；
- 擅长生成待办，但不理解实验版本和 SourceAnchor；
- 擅长压缩信息，但可能丢失争议过程和失败经验。

XtalLoop 的差异化切入：

> 不把 AI 纪要当最终答案，而是把 transcript 拆成“可审阅的研发 Claim”，再进入飞书事实源。

---

## 第 4 页：整体方案概览

XtalLoop 不是替代飞书，而是在飞书之上补一层研发知识结构化与安全流转。

```text
飞书会议 / 妙记
  -> transcript
  -> AI / 规则抽取
  -> SourceAnchor 证据绑定
  -> 人工审阅
  -> Base / Task / Docx / Wiki
  -> Obsidian 复用与知识图谱
```

产品定位：

- 飞书：组织事实源、权限边界、协同执行入口
- Agent：结构化抽取、幂等计划、安全检查
- Base：结论审阅台
- Task：行动项承接
- Docx/Wiki：知识卡片沉淀
- Obsidian：个人研究工作台与轻量知识图谱

---

## 第 5 页：核心架构

| 层级 | 模块 | 作用 |
|---|---|---|
| 数据接入层 | Feishu VC / Minutes / Note | 获取会议产物和 transcript |
| 结构化层 | Transcript Normalizer / Extractor | 标准化发言片段，抽取参数、争议、风险、任务 |
| 证据层 | SourceAnchor / Quote Hash | 绑定说话人、时间戳、原文和哈希 |
| 审阅写回层 | Writeback Planner / Dry-run Executor | 生成 Base、Task、Docx 写回计划并安全校验 |
| 复用层 | Wiki / Obsidian Graph | 形成历史案例、参数、失败模式的可检索网络 |

当前仓库已实现：

- transcript 标准化适配器
- 规则型 extractor MVP
- Claim / Bundle / Plan / ExecutionLog schema
- dry-run 写回计划
- simulated execution log
- 一键 demo 报告

---

## 第 6 页：数据对象设计

XtalLoop 的最小核心不是“文档”，而是可追溯 Claim。

一条 Claim 包含：

| 字段 | 示例 |
|---|---|
| claim_type | parameter_change / risk / task / controversy |
| predicate | has_reaction_temperature |
| object | 80°C -> 75°C |
| verification_status | IN_REVIEW |
| source.speaker_id | SPEAKER-01 |
| source.start_ms / end_ms | 10000 / 28000 |
| source.quote | 原始发言 |
| source.quote_hash | sha256 |

关键设计：

- AI/规则抽取结果默认 `IN_REVIEW`
- 无 SourceAnchor 的结论不能发布
- 历史实验引用只作为 `reference_id`，不能污染当前实验 ID
- 参数值、单位、原始表达分开保存

---

## 第 7 页：飞书能力实测证据

| 能力 | 状态 |
|---|---|
| 历史会议查询 | 已验证 |
| 会议结束事件 | 已验证 |
| Note 生成事件 | 已验证 |
| Minutes 生成事件 | 已验证 |
| Minutes transcript 读取 | 已验证 |
| Base 创建与记录写回 | 已验证 |
| 飞书任务创建与读回 | 已验证 |
| Docx 知识卡片创建与读回 | 已验证 |

关键实测发现：

- Note 与 Minutes 是两条相互独立的会议产物链路；
- 分析必须基于 transcript，不能直接搬运 AI summary；
- ASR 会出现实验编号插空格、年份识别错误等问题；
- 因此关键参数、日期、任务必须经过人工审阅。

证据文件：

- `docs/feishu-cli-feasibility.md`
- `fixtures/feishu/*.redacted.json`
- `fixtures/feishu/writeback-validation.redacted.json`

---

## 第 8 页：当前 Demo 链路

本仓库可运行：

```powershell
npm run demo:e2e
```

输出链路：

```text
Feishu Minutes 脱敏样例
  -> normalized transcript
  -> 9 条 IN_REVIEW claims
  -> 4 条写回命令计划
  -> 4 条 simulated dry-run execution log
  -> demo-e2e-report.md
```

当前 demo 覆盖：

- 温度参数调整：80°C -> 75°C
- 对照组参数：80°C
- 乙腈比例：30% -> 25%
- 候选建议：600 转
- 最终决策：500 转/分钟
- 高温降解风险
- 历史失败案例复用
- ASR 日期异常复核任务
- 晶型方案未决争议

---

## 第 9 页：安全与权限设计

XtalLoop 的写回策略是“先计划，后审阅，再执行”。

| 风险 | 控制 |
|---|---|
| 模型触发任意 API | 只开放白名单操作 |
| 未审阅结论自动发布 | 默认 IN_REVIEW |
| 重复执行造成重复任务 | 幂等键 |
| 真实 token 泄露 | 输出脱敏与 `.gitignore` |
| 高风险写操作 | dry-run + 人工确认 |
| 权限过大 | reader / writer profile 分离 |

当前写回白名单：

- `base.record_upsert`
- `task.create`
- `docx.create`

明确禁止：

- raw API call
- delete
- permission change
- share public link
- message send

---

## 第 10 页：Obsidian + 飞书联动方案

导师提出的 Obsidian 方向适合做“低成本、高灵活度”的个人研究工作台。

| 系统 | 定位 |
|---|---|
| 飞书 | 组织级事实源、权限、任务、审阅、知识库 |
| Obsidian | 个人研究笔记、图谱浏览、离线思考、局部复用 |
| Agent 后台 | 数据关系整理、Claim 版本化、相似案例检索 |

关键原则：

- Obsidian 不保存完整真实会议 transcript；
- Obsidian 只引用已授权、已审阅或脱敏摘要；
- 图谱可以重建，不作为唯一事实源；
- 组织发布仍回到飞书 Wiki / Docx / Base。

---

## 第 11 页：预期业务价值

| 指标 | 目标 |
|---|---|
| 会后 24 小时知识就绪率 | >= 80% |
| SourceAnchor 覆盖率 | 100% |
| 关键参数人工审阅覆盖率 | 100% |
| 会议结论进入任务系统比例 | >= 70% |
| 相似历史失败案例命中率 | 持续提升 |
| 重复讨论与重复试错 | 试点后下降 |

当前 demo 已能证明：

- 会议片段可以结构化；
- claim 可以绑定证据；
- 写回计划可以幂等、安全、可审阅；
- 风险和失败经验可以进入复用链路。

---

## 第 12 页：落地路线

| 阶段 | 目标 | 交付 |
|---|---|---|
| P0 | 海选 MVP | 可运行 demo、飞书能力实测、README、补充材料 |
| P1 | 试点原型 | 真实会议烟测、真实 dry-run 执行、Base 审阅台、Obsidian 插件 MVP |
| P2 | 企业化增强 | LLM + 本体混合抽取、权限过滤检索、指标看板、ELN/LIMS 对接 |

当前所处阶段：

- P0 工程链路基本完成；
- 海选材料仍需 PDF 化、视频化和公开链接包装；
- 下一步建议完成真实 `.tmp/` 烟测和 3 分钟演示视频。

---

## 第 13 页：团队能力证明

| 能力 | 证据 |
|---|---|
| 产品设计 | PRD、架构、流程闭环 |
| 飞书集成 | CLI 实测报告、脱敏读写验证 |
| 数据建模 | Claim / Bundle / Plan / ExecutionLog schema |
| AI 工程 | Transcript normalizer、Extractor MVP |
| 安全工程 | 白名单、dry-run、幂等键、敏感扫描 |
| 交付能力 | 一键 demo、自动校验、README |

命令级证据：

```powershell
npm test
npm run demo:e2e
```

---

## 第 14 页：海选提交建议链接

建议准备三个公开入口：

1. GitHub 仓库链接：放 README、代码、schema、脱敏 evidence。
2. 3 分钟演示视频链接：展示 `npm run demo:e2e`、报告、核心 JSON 片段。
3. PDF 补充材料链接：由本文档排版生成。

提交时强调：

- 不是纯概念方案，已有飞书读写实测；
- 不是直接相信 AI 纪要，而是 evidence-first；
- 不是绕过飞书权限，而是飞书作为组织事实源；
- Obsidian 是低成本复用工作台，不替代企业事实源。

