# 真实飞书场景配置说明

本文说明如何在私有飞书测试租户中评估 XtalLoop。公开仓库默认只能运行离线 demo，因为真实飞书资源必须由评委或企业自己的租户授权。

## 1. 为什么仓库里没有真实飞书配置

以下内容不能进入公开 Git 仓库：

- App Secret
- Access Token / Refresh Token
- OAuth URL / Device Code
- Open ID
- Base token / Table ID / Record ID
- Docx token / Wiki token
- Minutes token / Note ID
- 真实会议逐字稿

仓库只提供：

- `.env.example`
- 脱敏 fixtures
- 配置步骤
- schema
- 离线 demo
- dry-run 计划网关

## 2. 推荐 Profile 设计

| Profile | 身份 | 用途 |
|---|---|---|
| `xtal-reader` | user | 读取会议、Note、Minutes、transcript |
| `xtal-writer` | user | 写入 Base、Task、Docx，并按需读回校验 |

不要用一个高权限 profile 同时承担全部能力。Reader / Writer 分离可以降低误写、误读和权限扩散风险。

## 3. 最小 Scope 清单

Reader 已验证最小只读方向：

```text
vc:meeting.search:read
vc:meeting.meetingevent:read
vc:note:read
vc:record:readonly
minutes:minutes.basic:read
minutes:minutes.artifacts:read
```

Writer 已验证最小写回方向：

```text
base:app:create
base:table:read
base:table:create
base:table:update
base:table:delete
base:record:create
base:record:update
base:record:read
task:task:write
docx:document:create
docx:document:readonly
```

真实企业试点时建议进一步收敛到固定测试空间、固定 Base、固定文件夹。

## 4. 本地私有配置步骤

复制环境变量模板：

```powershell
Copy-Item .env.example .env.local
```

填入私有测试值。不要提交 `.env.local`。

检查本地环境：

```powershell
npm run check:env
```

如果要强制检查 lark-cli 是否存在：

```powershell
node scripts/check-env.mjs --require-feishu
```

## 5. lark-cli 配置建议

初始化测试应用配置：

```powershell
lark-cli config init --new
```

授权时按最小 scope 增量授权。真实授权 URL、device code、二维码不要写入仓库。

检查授权状态：

```powershell
lark-cli auth status --json --verify
```

判定成功要看 `ok == true` 或进程退出码 0，不要用传统 OpenAPI 的 `code == 0` 规则。

## 6. 私有真实会议烟测流程

1. 在测试租户中创建或加入一场测试会议。
2. 开启飞书会议 AI 纪要和录制/妙记。
3. 会议结束后获取 `meeting_id`、`note_id` 或 `minute_token`。
4. 用 `minutes +detail --transcript` 获取 transcript。
5. 将真实响应保存到 `.tmp/`，不要提交：

```text
.tmp/real-minutes-detail.json
```

6. 通过 normalizer 转成标准 transcript。
7. 运行 extractor 和 planner。
8. 先查看 dry-run plan。
9. 人工确认后再进入真实写回。

当前公开仓库的 `execute-writeback-plan.mjs` 默认是 simulate，不会执行外部飞书命令。真实 dry-run 执行需要额外提供私有目标 Base / Table / Folder 配置，并显式设置：

```text
XTALLOOP_ALLOW_REAL_DRY_RUN=1
```

## 7. 真实场景验收标准

| 验收项 | 标准 |
|---|---|
| 会议文本读取 | transcript 有说话人和时间戳 |
| 结构化抽取 | claim 有 SourceAnchor |
| 审阅状态 | 默认 IN_REVIEW |
| 写回计划 | 只含白名单操作 |
| 幂等性 | 重复同一 bundle 不产生重复任务 |
| 安全 | 不输出 token、Open ID、真实 URL |
| 失败处理 | 权限不足、产物未就绪、ASR 异常可进入人工队列 |

## 8. 当前真实验证状态

已在测试租户完成：

- 真实会议事件捕获
- Note / Minutes 产物生成事件捕获
- Minutes transcript 读取
- Base / Task / Docx 真实写回
- 写回后读回校验

脱敏证据保存在：

```text
fixtures/feishu/
```

真实 token、URL、Open ID 和会议正文没有进入仓库。
