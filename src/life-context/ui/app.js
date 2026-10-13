/* global document, window */
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
    String(value ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const time = (value) =>
    new Date(value).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
const epistemic = { self_report: '本人陈述', inference: 'Agent 推断', observation: '观察记录' };
const typeLabel = {
    fact: '目标与背景',
    preference: '协作偏好',
    commitment: '时间与承诺',
    decision: '已确认决定',
    note: '补充记录',
    event: '事件与结果',
};
let state;
let page = window.location.hash.slice(1) || 'overview';
let inboxTab = 'pending';
let lastContext;
let toastTimer;
async function api(path, body) {
    const response = await window.fetch(
        `/api/${path}`,
        body === undefined
            ? {}
            : {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
              },
    );
    if (!response.ok) {
        const result = await response.json().catch(() => ({ error: '请求失败，请重新打开预览。' }));
        throw new Error(result.error);
    }
    return response.json();
}
function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 5000);
}
async function refresh() {
    const next = await api('state');
    if (
        state &&
        (next.version !== state.version ||
            JSON.stringify(next.clients) !== JSON.stringify(state.clients))
    )
        lastContext = null;
    state = next;
    render();
}
function navigate(next) {
    page = next;
    if (window.location.hash.slice(1) === next) render();
    else window.location.hash = next;
}
function heading(kicker, title, subtitle, action = '') {
    return `<div class="heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}
const button = (text, action, cls = '') =>
    `<button class="button ${cls}" data-action="${action}">${text}</button>`;
function record(item) {
    return `<div class="record"><div class="record-label">${typeLabel[item.type] || escape(item.type)}</div><p class="record-content">${escape(item.content)}</p><div class="record-meta"><span>◦ ${epistemic[item.epistemicStatus] || '待分类'}</span><button class="link-button" data-detail="${item.id}">查看依据 ↗</button><button class="link-button" data-correct="${item.id}">纠正</button></div></div>`;
}
function overview() {
    const current = state.records.filter((r) => r.current);
    const pending = state.proposals.filter((p) => p.status === 'pending');
    const personal = current.filter((r) => r.scope === 'personal/work');
    const project = current.filter((r) => r.scope === 'projects/demo');
    return (
        heading(
            'YOUR CONTEXT, IN YOUR HANDS',
            '让 AI 从你的当前状态出发',
            '一份背景，持续修正。每条认识都有来源，每次更新由你确认。',
            button('＋ 添加来源', 'add-source'),
        ) +
        `<div class="stats">${[
            [current.length, '当前上下文', '已审核且有效'],
            [pending.length, '待确认变更', '审核后更新当前状态'],
            [state.sources.length, '来源记录', '保留原文与说话者'],
            [state.clients.filter((c) => c.enabled).length, '授权 Agent', '共享同一份上下文'],
        ]
            .map(
                ([n, l, f]) =>
                    `<div class="stat"><div class="stat-label">${l}</div><div class="stat-number">${n.toString().padStart(2, '0')}</div><div class="stat-foot">${f}</div></div>`,
            )
            .join('')}</div>` +
        (pending.length
            ? `<div class="notice"><div class="notice-icon">▤</div><div><h3>${pending.length} 项变更等待你的确认</h3><p>有新的上下文更新。批准前，Agent 仍读取已确认的版本。</p></div>${button('查看变更 →', 'inbox', 'subtle')}</div>`
            : `<div class="notice"><div class="notice-icon">✓</div><div><h3>所有变更已处理</h3><p>当前上下文已就绪，可以交给下一个 Agent。</p></div>${button('生成上下文 →', 'context', 'subtle')}</div>`) +
        `<div class="section-heading"><h2>我的核心背景</h2><span>当前版本 v${state.version} · 私密条目仅本人可见</span></div><div class="cards"><section class="panel"><div class="panel-header"><div class="panel-icon">◎</div><div><h2>个人卡</h2><small>目标、约束与协作偏好</small></div><span class="badge">已确认</span></div>${personal.map(record).join('')}<div class="panel-foot"><span>适用范围 · personal/work</span><span>${personal.length} 条当前记录</span></div></section><section class="panel"><div class="panel-header"><div class="panel-icon">◫</div><div><h2>Life Context</h2><small>活跃项目 · 可逆验证阶段</small></div><span class="badge gray">演示项目</span></div>${project.map(record).join('')}<div class="record"><div class="record-label">本次接续</div><p class="record-content muted">生成一个带版本和来源的上下文包，查看研究助手实际能读到的内容。</p>${button('预览 Agent 上下文 ↗', 'context', 'text')}</div><div class="panel-foot"><span>适用范围 · projects/demo</span><span>${project.length} 条当前记录</span></div></section></div><div class="flow"><div class="step"><b>1</b> 选择来源</div><span class="arrow">→</span><div class="step"><b>2</b> 确认变更</div><span class="arrow">→</span><div class="step"><b>3</b> 按任务读取</div><span class="arrow">→</span><div class="step"><b>4</b> 持续修正</div><small>每一步都保留可检查的依据</small></div>`
    );
}
function inbox() {
    const proposals = state.proposals.filter((p) => p.status === inboxTab);
    const labels = { pending: '待确认', approved: '已批准', rejected: '已拒绝' };
    return (
        heading(
            'REVIEW CHANGES',
            '把更新留在你的掌控中',
            '检查新旧内容与原文，确认后其他 Agent 才能读取新状态。',
        ) +
        `<div class="tabs">${Object.entries(labels)
            .map(
                ([key, value]) =>
                    `<button data-tab="${key}" class="${inboxTab === key ? 'active' : ''}">${value} <span>${state.proposals.filter((p) => p.status === key).length}</span></button>`,
            )
            .join('')}</div>` +
        (proposals.length
            ? proposals
                  .map((p) => {
                      const old = state.records.find((r) => r.id === p.targetId);
                      const source = state.sources.find((s) => s.id === p.sourceId);
                      const stale = p.stale;
                      return `<section class="panel proposal"><div class="proposal-title"><div><h2>${p.targetId ? '更新一条已有上下文' : '新增一条上下文'}</h2><p>${escape(p.proposedBy)} · ${time(p.proposedAt)} · 基于 v${p.baseVersion}</p></div><span class="badge ${p.status === 'pending' ? 'amber' : 'gray'}">${labels[p.status]}</span></div><div class="diff-grid"><div class="diff-box"><div class="diff-label">当前内容</div>${old ? escape(old.content) : '尚无对应条目'}</div><div class="diff-box new"><div class="diff-label">建议内容 · ${epistemic[p.epistemicStatus]}</div><p>${escape(p.status === 'approved' ? state.records.find((r) => r.id === p.memoryId)?.content || p.memory.content : p.memory.content)}</p></div></div><div class="source-strip"><h3>来源：${escape(source?.title)}</h3><p>“${escape(source?.excerpt)}”</p><div class="tip">${escape(source?.speaker)} · ${time(source?.observedAt)} · ${escape(source?.locator)}</div></div>${p.note ? `<p class="muted">${escape(p.note)}</p>` : ''}${p.status === 'pending' && stale ? `<div class="error-box">当前已更新到 v${state.version}。此提案需要按最新版本重新提交。</div>` : ''}${p.status === 'pending' ? `<div class="actions"><button class="button danger" data-review="${p.id}" data-decision="reject">拒绝</button>${stale ? `<button class="button subtle" data-resubmit="${p.id}">查看并重新提交</button>` : `<button class="button subtle" data-edit-proposal="${p.id}">编辑后批准</button><button class="button" data-review="${p.id}" data-decision="approve">确认更新 ✓</button>`}</div>` : ''}</section>`;
                  })
                  .join('')
            : `<div class="empty"><h2>这一组没有变更</h2><p>从来源记录添加候选，或通过 MCP 接收 Agent 提案。</p></div>`)
    );
}
function sources() {
    return (
        heading(
            'SOURCE RECORDS',
            '每条认识，回到原话',
            '摘录、说话者、时间和位置一起保存。新增来源后，手动整理候选并审核。',
            button('＋ 添加来源', 'add-source'),
        ) +
        `<div class="source-list">${state.sources.map((s) => `<article class="panel source-card"><div class="section-heading"><h3>${escape(s.title)}</h3><span class="badge ${s.sensitivity === 'private' ? 'amber' : 'gray'}">${s.sensitivity === 'private' ? '仅本人' : '工作背景'}</span></div><p>${escape(s.excerpt)}</p><div class="inline-meta">${escape(s.speaker)} · ${time(s.observedAt)}</div><div class="tip">${escape(s.locator)}</div><div class="panel-foot"><span>已保留摘录 · ${s.fingerprint.slice(0, 8)}</span><button class="link-button" data-candidate="${s.id}">整理候选 →</button></div></article>`).join('')}</div>`
    );
}
function context() {
    return (
        heading(
            'CONTEXT DELIVERY',
            '查看 Agent 将收到什么',
            '按授权范围生成当前背景，带版本凭据与来源。这里是本人可操作的客户端预览。',
        ) +
        `<div class="split"><form id="context-form" class="panel"><h2>一次任务，一份背景</h2><div class="field space-top"><label for="client">客户端身份</label><select name="client" id="client">${state.clients.map((c) => `<option value="${c.clientId}">${escape(c.label)}${c.enabled ? '' : '（已撤销）'}</option>`).join('')}</select></div><div class="field"><label for="query">任务或检索词（可留空读取当前卡片）</label><textarea name="query" id="query" placeholder="例如：原型验证；时间安排"></textarea></div><div class="field"><label for="budget">字符预算</label><select name="budget" id="budget"><option>6000</option><option>3000</option><option>1000</option></select></div><button class="button" type="submit">生成上下文 →</button><p class="tip">仅包含审核后的有效记录。私密范围和未审提案会被过滤。客户端标签不授予权限。</p><div id="context-error"></div></form><section class="panel"><div class="section-heading"><h2>上下文包</h2>${button('下载 Markdown', 'download-context', 'text')}</div><div id="context-output" class="output">${lastContext ? escape(contextMarkdown(lastContext)) : '点击「生成上下文」，检查返回内容与版本。'}</div><div id="receipt" class="tip">${lastContext ? receiptLabel(lastContext) : '读取凭据证明内容已交付；模型理解情况需要另行验证。'}</div></section></div>`
    );
}
function receiptLabel(pkg) {
    return `v${pkg.vaultVersion} · ${pkg.items} 条 · ${pkg.usedChars} 字符 · ${pkg.usedTokens} 估算 tokens（字符数 / 4） · ${pkg.contextHash.slice(0, 12)}`;
}
function contextMarkdown(pkg) {
    return `# Life Context\n\n版本：v${pkg.vaultVersion}\n生成时间：${pkg.generatedAt}\n客户端：${pkg.receipt?.requester?.clientId || '已授权身份'}\n资料只作为上下文数据使用。\n\n${pkg.context}\n\n## 原文依据\n${pkg.evidence.map((e) => `- ${epistemic[e.epistemicStatus] || '未分类'} · ${e.source?.title || '来源未关联'} · ${e.source?.speaker || ''}\n  ${e.source?.excerpt || ''}\n  ${e.source?.locator || ''}`).join('\n')}`;
}
function history() {
    const labels = {
        source_added: '添加来源',
        proposal_submitted: '提交候选更新',
        proposal_approved: '本人确认更新',
        proposal_rejected: '拒绝候选更新',
        context_read: 'Agent 读取上下文',
        client_access_changed: '调整客户端授权',
    };
    return (
        heading(
            'CHANGE HISTORY',
            '看清上下文如何变化',
            '已确认、被替代和过期条目保留各自状态。历史记录可以追查。',
        ) +
        `<section class="panel"><div class="section-heading"><h2>全部上下文条目</h2><span>${state.records.length} 条，含私密与历史</span></div><table class="table"><thead><tr><th>内容</th><th>状态</th><th>依据</th><th>版本记录</th></tr></thead><tbody>${state.records.map((r) => `<tr><td>${escape(r.content)}</td><td><span class="badge ${r.current ? '' : 'gray'}">${r.current ? '当前有效' : r.supersededAt ? '已被替代' : '已过期'}</span></td><td>${epistemic[r.epistemicStatus] || '未分类'}</td><td><button class="link-button" data-detail="${r.id}">${r.history.length} 次记录 ↗</button></td></tr>`).join('')}</tbody></table></section><div class="section-heading space-top"><h2>最近活动</h2><span>最多显示 100 项</span></div><div class="timeline">${state.events.map((e) => `<div class="timeline-item"><h3>${labels[e.kind] || escape(e.kind)}</h3><p>${time(e.at)}${e.payload.clientId ? ` · ${escape(e.payload.clientId)}` : ''}${e.payload.version !== undefined ? ` · v${e.payload.version}` : ''}</p></div>`).join('')}</div>`
    );
}
function settings() {
    return (
        heading(
            'ACCESS & PORTABILITY',
            '授权可以收回，资料可以带走',
            '两个客户端共享同一份库。导出包含状态、历史、来源、关系与策略。',
        ) +
        `<div class="stack"><section class="panel"><h2>Agent 接入</h2>${state.clients.map((c) => `<div class="connection"><div class="panel-icon">${c.clientId.startsWith('research') ? '⌕' : '✎'}</div><div><h3>${escape(c.label)} <span class="badge ${c.enabled ? '' : 'gray'}">${c.enabled ? '已授权' : '已撤销'}</span></h3><small>${escape(c.clientId)} · 读取 / 提案 · ${escape(c.scopes.join(', '))}</small></div><button class="button subtle" data-toggle-client="${c.clientId}" data-enabled="${!c.enabled}">${c.enabled ? '撤销访问' : '恢复访问'}</button></div>`).join('')}<p class="tip">界面展示配置与读取记录，尚未连接你的真实 Agent。MCP 启动命令见原型文档；进程身份固定，每次请求重新检查授权。同一系统用户的文件访问权限需单独管理。</p></section><section class="panel"><div class="section-heading"><h2>导出与恢复检查</h2><span>开放 JSON · 校验和</span></div><p class="subtitle">原始附件未打包。所选摘录会随导出迁移，外部原件以路径引用。</p><div class="actions">${button('下载完整资料包', 'export', 'subtle')}${button('在空库验证恢复', 'verify-restore')}</div><div class="field space-top"><label for="restore-file">也可以选择此前导出的资料包，在独立空库中核验</label><input type="file" id="restore-file" accept="application/json,.json"></div><div id="restore-result"></div><p class="tip">恢复检查创建独立空库，逐项恢复并重新导出核对。当前演示库继续保留。</p></section></div>`
    );
}
function render() {
    if (!state) return;
    const views = { overview, inbox, sources, context, history, settings };
    if (!views[page]) page = 'overview';
    $('#main').innerHTML = views[page]();
    $('#inbox-count').textContent = state.proposals.filter((p) => p.status === 'pending').length;
    $('#version-label').textContent = `v${state.version}`;
    $('#breadcrumb').textContent =
        `个人上下文 / ${{ overview: '概览', inbox: '待审变更', sources: '来源记录', context: '上下文读取', history: '变化记录', settings: '接入与迁移' }[page]}`;
    document
        .querySelectorAll('[data-page]')
        .forEach((b) => b.classList.toggle('active', b.dataset.page === page));
}
function dialog(html) {
    $('#dialog-content').innerHTML = html;
    $('#detail-dialog').showModal();
}
function showSourceForm() {
    dialog(
        `<h2>添加一份来源</h2><p class="subtitle">保存你选择的原话，再手动整理候选上下文。</p><form id="source-form"><div class="field space-top"><label for="source-title">标题</label><input id="source-title" name="title" required maxlength="300" placeholder="例如：本周的时间安排"></div><div class="field"><label for="excerpt">原文摘录</label><textarea id="excerpt" name="excerpt" required maxlength="20000"></textarea></div><div class="form-row"><div><label for="speaker">说话者</label><input id="speaker" name="speaker" value="本人" required></div><div><label for="source-scope">适用范围</label><select id="source-scope" name="scope"><option value="personal/work">个人工作背景</option><option value="projects/demo">Life Context 项目</option><option value="personal/private">私密记录（仅本人）</option></select></div></div><div class="field"><label for="locator">来源位置</label><input id="locator" name="locator" value="manual excerpt"></div><div class="actions"><button class="button" type="submit">保存来源 →</button></div></form>`,
    );
}
function candidateForm(source, target = null, initial = source.excerpt) {
    dialog(
        `<h2>${target ? '提出一项纠正' : '整理候选上下文'}</h2><div class="source-strip"><h3>${escape(source.title)}</h3><p>${escape(source.excerpt)}</p></div><form id="candidate-form" data-source="${source.id}" data-target="${target?.id || ''}"><div class="field"><label for="candidate-content">候选内容</label><textarea id="candidate-content" name="content" required>${escape(initial)}</textarea></div><div class="form-row"><div><label for="epistemic">认识类型</label><select id="epistemic" name="epistemicStatus"><option value="self_report">本人陈述</option><option value="inference">Agent 推断</option><option value="observation">观察记录</option></select></div><div><label for="candidate-type">条目类型</label><select id="candidate-type" name="type">${Object.entries(
            typeLabel,
        )
            .map(
                ([k, v]) =>
                    `<option value="${k}" ${target?.type === k ? 'selected' : ''}>${v}</option>`,
            )
            .join(
                '',
            )}</select></div></div><p class="tip">基于当前 v${state.version} 提交。本人审核后才进入 Agent 的上下文。</p><div class="actions"><button class="button" type="submit">提交待审变更</button></div></form>`,
    );
}
function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function verifyRestore(bundle) {
    const result = await api('verify-restore', bundle);
    $('#restore-result').innerHTML =
        `<div class="restore-result">${result.identical ? '✓ 恢复后逐表一致' : '恢复后校验存在差异'} · ${result.records} 条上下文 · ${result.sources} 份来源 · v${result.version}<p class="tip">外部原件缺失：${result.missingSources.length}。${escape(result.attachmentCoverage)}</p></div>`;
}
document.addEventListener('click', async (event) => {
    const b = event.target.closest('button');
    if (!b) return;
    try {
        if (b.dataset.page) return navigate(b.dataset.page);
        if (b.dataset.tab) {
            inboxTab = b.dataset.tab;
            render();
            return;
        }
        if (b.dataset.action) {
            const action = b.dataset.action;
            if (['inbox', 'context'].includes(action)) return navigate(action);
            if (action === 'add-source') return showSourceForm();
            if (action === 'export') {
                download(
                    JSON.stringify(await api('export'), null, 2),
                    'life-context-vault.json',
                    'application/json',
                );
                toast('完整资料包已导出');
            }
            if (action === 'verify-restore') await verifyRestore(await api('export'));
            if (action === 'download-context') {
                if (!lastContext) return toast('请先生成上下文');
                download(
                    contextMarkdown(lastContext),
                    `CONTEXT-v${lastContext.vaultVersion}.md`,
                    'text/markdown',
                );
            }
        }
        if (b.dataset.detail) {
            const r = state.records.find((r) => r.id === b.dataset.detail);
            const s = state.sources.find((s) => s.id === r.sourceId);
            dialog(
                `<h2>上下文与依据</h2><p>${escape(r.content)}</p><div class="source-strip"><h3>${escape(s?.title)}</h3><p>“${escape(s?.excerpt)}”</p><div class="tip">${escape(s?.speaker)} · ${epistemic[r.epistemicStatus]} · ${escape(s?.locator)}</div></div><h3>版本记录</h3>${r.history.map((h) => `<div class="record"><div class="tip">${time(h.changedAt)} · ${escape(h.changeKind)}</div><p>${escape(h.snapshot.content)}</p></div>`).join('')}`,
            );
        }
        if (b.dataset.candidate)
            candidateForm(state.sources.find((s) => s.id === b.dataset.candidate));
        if (b.dataset.correct) {
            const r = state.records.find((r) => r.id === b.dataset.correct);
            dialog(
                `<h2>纠正一条当前背景</h2><p class="subtitle">新的原话会保存为独立来源，批准后替代旧条目。</p><div class="source-strip"><p>${escape(r.content)}</p></div><form id="correction-form" data-target="${r.id}"><div class="field"><label for="correction">新的本人陈述</label><textarea name="content" id="correction" required>${escape(r.content)}</textarea></div><div class="actions"><button class="button" type="submit">保存依据并提交待审</button></div></form>`,
            );
        }
        if (b.dataset.review) {
            await api(`proposals/${b.dataset.review}/review`, { decision: b.dataset.decision });
            await refresh();
            toast(
                b.dataset.decision === 'approve' ? '已更新当前上下文，历史已保留' : '已拒绝此提案',
            );
        }
        if (b.dataset.editProposal) {
            const p = state.proposals.find((p) => p.id === b.dataset.editProposal);
            dialog(
                `<h2>编辑后批准</h2><form id="edit-proposal-form" data-id="${p.id}"><div class="field"><label for="edited-content">最终内容（依据与认识类型沿用原提案）</label><textarea id="edited-content" name="content" required>${escape(p.memory.content)}</textarea></div><div class="actions"><button class="button" type="submit">确认更新</button></div></form>`,
            );
        }
        if (b.dataset.resubmit) {
            const p = state.proposals.find((p) => p.id === b.dataset.resubmit);
            const s = state.sources.find((s) => s.id === p.sourceId);
            const target = state.records.find((r) => r.id === p.targetId);
            if (p.targetId && !target?.current) {
                return toast('旧条目已退出当前状态，请从最新条目提出纠正。');
            }
            candidateForm(s, target || null, p.memory.content);
            $('#epistemic').value = p.epistemicStatus;
            $('#candidate-type').value = p.memory.type;
        }
        if (b.dataset.toggleClient) {
            await api(`clients/${b.dataset.toggleClient}`, {
                enabled: b.dataset.enabled === 'true',
            });
            await refresh();
            toast('授权已更新，下一次请求立即生效');
        }
        if (b.id === 'close-dialog') $('#detail-dialog').close();
    } catch (error) {
        toast(error.message);
    }
});
document.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form));
    try {
        if (form.id === 'source-form') {
            const result = await api('sources', {
                ...values,
                observedAt: new Date().toISOString(),
                sensitivity: values.scope === 'personal/private' ? 'private' : 'personal',
            });
            $('#detail-dialog').close();
            await refresh();
            navigate('sources');
            toast(result.duplicate ? '来源已存在，沿用原记录' : '来源已保存，可以整理候选');
        }
        if (form.id === 'candidate-form') {
            const s = state.sources.find((s) => s.id === form.dataset.source);
            await api('proposals', {
                proposal: {
                    ...values,
                    scope: s.scope,
                    sensitivity: s.sensitivity,
                    sourceId: s.id,
                    targetId: form.dataset.target || null,
                    baseVersion: state.version,
                },
            });
            $('#detail-dialog').close();
            await refresh();
            inboxTab = 'pending';
            navigate('inbox');
            toast('已提交候选，等待本人确认');
        }
        if (form.id === 'correction-form') {
            const r = state.records.find((r) => r.id === form.dataset.target);
            const { source } = await api('sources', {
                title: '本人纠正',
                excerpt: values.content,
                speaker: '本人',
                locator: `manual correction: ${r.id}`,
                observedAt: new Date().toISOString(),
                scope: r.scope,
                sensitivity: r.sensitivity,
            });
            await api('proposals', {
                proposal: {
                    content: values.content,
                    type: r.type,
                    scope: r.scope,
                    sensitivity: r.sensitivity,
                    sourceId: source.id,
                    targetId: r.id,
                    epistemicStatus: 'self_report',
                    baseVersion: state.version,
                },
            });
            $('#detail-dialog').close();
            await refresh();
            navigate('inbox');
            toast('纠正已提交，请确认变更');
        }
        if (form.id === 'edit-proposal-form') {
            await api(`proposals/${form.dataset.id}/review`, {
                decision: 'approve',
                content: values.content,
            });
            $('#detail-dialog').close();
            await refresh();
            toast('已批准编辑后的内容');
        }
        if (form.id === 'context-form') {
            lastContext = await api('context', {
                clientId: values.client,
                request: {
                    query: values.query,
                    budget: { maxChars: Number(values.budget) },
                    format: 'markdown',
                },
            });
            $('#context-output').textContent = contextMarkdown(lastContext);
            $('#receipt').textContent = receiptLabel(lastContext);
            $('#context-error').innerHTML = '';
            state = await api('state');
        }
    } catch (error) {
        if (form.id === 'context-form') {
            $('#context-error').innerHTML = `<div class="error-box">${escape(error.message)}</div>`;
            $('#context-output').textContent = '此次读取未返回上下文。';
            lastContext = null;
            $('#receipt').textContent = '';
        } else toast(error.message);
    }
});
document.addEventListener('change', async (event) => {
    if (event.target.id === 'client') {
        lastContext = null;
        $('#context-output').textContent = '客户端已切换，请重新生成上下文。';
        $('#receipt').textContent = '';
        return;
    }
    if (event.target.id !== 'restore-file' || !event.target.files[0]) return;
    try {
        await verifyRestore(JSON.parse(await event.target.files[0].text()));
    } catch (error) {
        $('#restore-result').textContent = `恢复检查失败：${error.message}`;
    }
});
window.addEventListener('hashchange', () => {
    page = window.location.hash.slice(1);
    refresh().catch((error) => toast(error.message));
});
window.setInterval(() => {
    if (['overview', 'inbox'].includes(page) && !document.querySelector('dialog[open]'))
        refresh().catch((error) => toast(error.message));
}, 10000);
window.addEventListener('focus', () => {
    if (!document.querySelector('dialog[open]') && !document.querySelector('#context-form'))
        refresh().catch((error) => toast(error.message));
});
refresh().catch((error) => {
    $('#main').textContent = error.message;
});
