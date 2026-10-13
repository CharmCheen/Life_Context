# 原型验证记录

2026-10-13，本机 macOS，Node v26.0.0。代码基于 OpenSelf commit `54bd72fc7fbf88f3304feba7b4426323724fa97e`。本轮使用合成样例；无真实个人语料导入、模型 API 调用、提交、推送或部署。

## 实际运行结果

| 检查 | 结果 |
|---|---|
| `npm ci --no-audit --no-fund` | 成功安装锁文件依赖，未新增依赖 |
| 修改前 `npm test` | 73 个文件，675 项通过、2 项失败 |
| `npm run test:prototype` | 12 项通过 |
| 最终 `npm test` | 74 个文件、690 项全部通过；最后运行耗时 13.34 秒 |
| `npm run lint` | 通过 |
| `npm run test:types` | 通过 |
| `npm run format:check` | 通过 |
| `npm run eval:context` | 既有 openself-context-v1 数据集通过 |
| `git diff --check` | 通过 |

基线中的两项失败均在真实 stdio 测试：测试用 URL.pathname 构造子进程文件路径，目录空格被保留为 `%20`。改为 `fileURLToPath` 后原测试通过。npm prepare 临时改变 CLI 可执行位，本轮已恢复原文件模式，未留下无关变更。

中文去重修改有回归测试：两个不同的中文条目和两条不同纯标点文本都保留；既有其他编译器测试继续通过。未宣称中文分词或语义检索质量达标。

## 新增契约测试

`tests/unit/life-context.test.js` 覆盖：

- 两个身份读取五条独立中文背景，响应中不含未审更新或私密文本。
- 审批原子替代，保留旧条目、history 和 supersedes 边，第二身份读取新状态。
- 拒绝提案保持当前版本，拒绝内容不进入上下文。
- 拦截陈旧版本提案，保留期间已发生的审批事件。
- 人工制造替代操作失败，批准、元数据和版本全部回滚。
- 跨 scope 来源、敏感度降低、禁止来源引用及越权读取被拒绝。
- 已批准推断仍保留认识类型；撤权后下一请求被拒绝。
- 新磁盘目录逐表恢复，保留来源、历史、替代边、策略与撤权；重建 FTS；报告缺失外部原件。
- 校验和损坏拒绝恢复，目标空库保持不变；完全相同来源幂等。
- 双语过期条目过滤与正文字符预算。
- owner HTTP 身份、外部 Origin 拒绝、独立空库恢复验证。
- 两个真实 stdio 子进程通过 MCP SDK 连接，共享批准后的更新；现有连接撤权后读取被拒绝。

读取正文、证据和版本凭据在同一 SQLite 事务内完成。MCP 集成测试使用两个实际进程，覆盖本原型适配器，未安装到具体 Codex/Claude 产品配置。

## 浏览器人工验收

通过 Codex 内置浏览器完成：

1. 审批前读取 v6，返回六小时预算；私密记录与三小时候选没有进入返回正文。
2. 页面批准三小时提案，版本变为 v7。
3. 选择 writing-agent 再读取，返回 v7 三小时预算，旧六小时预算退出当前包。
4. 点击“在空库验证恢复”，显示恢复后逐表一致，包含 7 条记录、7 份来源、v7。
5. 表单新建合成来源“本周的下一步（演示）”，整理为 decision 候选，提交到待审列表。
6. 检查窄屏默认预览与 1365×900 桌面断点；回到首页保留交互预览。

交付时演示库为 v7，保留一项新的待审候选与 8 份来源。文档中的六小时→三小时流程可在历史中检查；全新数据目录会从 v6 样例开始。

## 未执行及真实边界

本轮没有运行 coverage、npm audit、全平台 CI、原有 dashboard 的 Playwright 套件、性能基准或真实使用收益实验。浏览器验收覆盖上述人工操作，未形成新 UI 的自动浏览器回归套件。

自动 ChatGPT 导入、模型提取、真实 Agent 产品接入、加密开放迁移、签名密钥迁移、完整硬删除与跨设备同步仍待后续验证；本轮原型未声称生产就绪。源代码、说明和样例位于本地现有仓库，原始 context-hub 与聊天归档未修改。

## 2026-10-13 audit corrections

- Current discovery pages through authorized records, excludes expired/superseded records before limiting candidates, and uses deterministic Han bigrams / Latin terms against record text and source titles. This is a small-vault lexical baseline; semantic recall and large-vault latency remain unverified.
- Context output carries inference/self-report/observation labels and source IDs; inference authorship refers to the proposing client separately from the source speaker and owner review.
- New proposals capture the target content snapshot. Unrelated approvals remain reviewable; changed/superseded targets are rejected. Legacy proposals retain conservative global-version checks.
- Restore validates source JSON, source references, client policies and required state inside the rollback transaction.
- Approved cards show final memory content. Inbox/overview refresh every ten seconds unless a dialog is open; navigation/focus refreshes state.
- MCP register_source accepts explicit quoted provenance under the client propose policy. Registered evidence still requires a separate proposal and owner approval. Real application configuration is not installed.
- Added regressions cover 100 expired records, Chinese positive/negative queries, unrelated/conflicting approvals, inference attribution and three malformed restore cases.

Final verification: 74 test files / 694 tests passed, including 16 prototype tests and the real two-process MCP source-registration / proposal / approval / revocation flow. ESLint, type checks and formatting checks passed. Browser interaction regressions and large-vault performance were not run in this correction pass.
