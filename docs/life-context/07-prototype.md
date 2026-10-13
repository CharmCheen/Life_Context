# Life Context 本地原型

2026-10-13。可逆验证切片；SQLite 暂时承担运行时存储，D-001 的生产选择继续开放。所有内置样例均为合成数据，原始个人语料未导入。上游基线为 `54bd72fc7fbf88f3304feba7b4426323724fa97e`，保留 OpenSelf 的 MIT 许可证与署名。

## 启动与使用

在 Open-Self-main 中执行 `npm ci`，然后 `npm run prototype`。打开终端打印的本地 `/auth?token=…` 链接。默认端口 4317，数据目录 `data/life-context-demo`。可通过 `LIFE_CONTEXT_PORT` 与 `LIFE_CONTEXT_DATA_DIR` 设置独立端口/目录。服务只监听 `127.0.0.1`，无需模型 API 或云账号。

推荐体验顺序：

1. 我的上下文：查看个人卡与项目卡，点“查看依据”。
2. 给 Agent 的上下文：留空检索词，获取当前授权背景，检查六小时预算与 v6。
3. 待审变更：检查原话与新旧内容，确认三小时预算。
4. 再次生成上下文：另一客户端身份读取 v7，旧预算退出当前包。
5. 变化记录：旧条目和替代历史继续存在。
6. 接入与迁移：导出 JSON，并在独立空库执行恢复核验。

也可添加来源，手动整理候选；或对当前卡片点“纠正”，保存新自述作为依据并提交待审提案。认识类型支持本人陈述、Agent 推断与观察记录；确认推断后仍保留推断标签。

界面的客户端选择器属于 owner 预览工具，不授予 Agent 身份。内置两种身份与配置，无真实平台在线状态。页面中“已授权”表示策略已配置。

## 框架与复用

```text
选定摘录 / 自述 ──→ lc_sources ──→ 上游 pending proposal
                                         │ lc_proposals：来源、认识类型、旧版本、替代目标
                                  owner 审核 + 版本检查
                                         ↓ 单个 SQLite 事务
                    ContextStore + memory_versions + supersedes 图关系
                                         ↓
               ContextCompiler + AccessPolicy ──→ 任务包 + 版本凭据 + 来源
                                         ↓
                          本地界面 / 两个 stdio MCP 进程
```

| 能力 | 复用 | 本轮扩展 |
|---|---|---|
| 本地持久化与历史 | ContextStore / better-sqlite3 | 命名空间 lc_* 表；个人资料独立目录 |
| 候选与审核状态 | proposeMemory / approveProposal / rejectProposal | 引用原文、认识类型、baseVersion、targetId |
| 替代与历史 | supersede / graph / memory_versions | 同事务批准与替代；失败回滚 |
| 任务上下文 | ContextCompiler / AccessPolicy | 只读 verified 当前记录；版本凭据和证据返回 |
| Agent 接入 | 原有 MCP SDK 与 stdio transport | 固定进程身份；get_context / propose_update；每次加载最新策略 |
| 迁移 | 上游 SQLite 逻辑表、历史和关系 | JSON 逐表导出、清单、校验和、空库恢复、FTS 重建 |
| 界面 | 已有 Express 依赖 | 独立六页中文 HTML/CSS/JS；未引入前端框架 |

实现入口：`src/life-context/vault.js`、`server.js`、`mcp.js`、`seed.js`、`ui/`。通过 `npm run prototype` 启动，`npm run test:prototype` 验证闭环。上游默认客户端权限没有全局改动，本原型的 MCP 只提供读取与提案工具。

## MCP 接入示例

兼容客户端可以把以下 command/args 配成两个独立 MCP server。路径需按本机修改，首次启动 UI 后会建立样例库和客户端政策。

```json
{
  "mcpServers": {
    "life-context-research": {
      "command": "node",
      "args": ["/Users/charmcheen/code_world/Life Context/Open-Self-main/src/life-context/mcp.js", "/Users/charmcheen/code_world/Life Context/Open-Self-main/data/life-context-demo", "research-agent"]
    },
    "life-context-writing": {
      "command": "node",
      "args": ["/Users/charmcheen/code_world/Life Context/Open-Self-main/src/life-context/mcp.js", "/Users/charmcheen/code_world/Life Context/Open-Self-main/data/life-context-demo", "writing-agent"]
    }
  }
}
```

`get_context` 返回 `vaultVersion`、上下文、证据与 receipt。`propose_update` 使用已授权的 `sourceId` 和读取时的 `baseVersion`；新增来源通过本人界面登记。Agent 无批准工具。SDK 的真实双 stdio 进程集成测试验证交接，具体 Codex/Claude 产品内的安装与调用仍待实际配置。

## 数据与恢复契约

开放包 `format=life-context-vault, version=1` 包含上游全部非 FTS 逻辑表，以及 lc_* 表，覆盖正式记录、历史、待审/拒绝提案、替代边、证据摘录、活动记录、授权策略和撤销状态。索引重建。SHA-256 检查传输变化，不证明内容真实或来源身份。

恢复只允许空的同版本本原型库；完整表名和列名从本地代码读取，禁止运行导入 SQL。所有写入在事务内。本人界面恢复按钮使用独立内存库验证；测试额外验证新磁盘目录恢复。当前库不会被恢复按钮覆盖。外部原件未打包，恢复报告列出不存在的 externalPath。

这个接口是本人明确选择的受信整库恢复；外部资料应通过来源/候选流程。当前扩展仅支持独立明文演示库；上游加密 Vault、签名密钥、独立 mcp-audit.db 的完整备份继续使用上游方案，本轮开放包不覆盖它们。

## 边界与未完成范围

- 版本冲突采用全库严格检查；其他已确认记录发生变化也会阻止旧提案。重新提交需本人重新检查，未实现自动合并或复杂依赖失效。
- 不支持直接编辑 Markdown 作为权威源；Markdown 是带版本的导出视图。字符预算约束编译后的上下文正文，证据与传输元数据另计。token 数是上游 chars/4 估算。
- 中文独立条目去重已修复并回归验证。上游 unicode61/feature-hash 检索继续复用；中文分词、任意子串召回和语义准确性尚未验证。留空词读取授权卡片可完成核心接续流程。
- 自动聊天导入、模型候选提取、量表画像、向量服务、同步、硬删除、生产安全、性能与真实日常收益尚未实现/验证。当前不采集真实私人资料。
- 同一 OS 身份下的文件访问可绕开 MCP 策略。浏览器端 owner 会话具备本人权限，与 Agent MCP 分开。

验证结果见 `08-prototype-validation.md`。
