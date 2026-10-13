export function seedDemo(vault) {
    if (vault.records().length || vault.sources().length || vault.version) return;
    for (const clientId of ['research-agent', 'writing-agent']) {
        vault.setClient({
            clientId,
            label: clientId === 'research-agent' ? '研究助手' : '写作助手',
            transport: 'stdio',
            scopes: ['personal/work', 'projects/demo'],
            deny: ['personal/private'],
            maxSensitivity: 'personal',
            minSourceTrust: 'verified',
            capabilities: ['read', 'propose'],
            budget: { maxChars: 6000, maxItems: 12 },
        });
    }
    const add = (title, content, scope, type, sensitivity = 'personal') => {
        const { source } = vault.addSource({
            title,
            excerpt: content,
            speaker: '演示用户',
            locator: `demo://${title}`,
            observedAt: new Date().toISOString(),
            scope,
            sensitivity,
        });
        const p = vault.propose({
            content,
            scope,
            type,
            sensitivity,
            sourceId: source.id,
            epistemicStatus: 'self_report',
            baseVersion: vault.version,
        });
        return vault.review(p.id, 'approve').memory;
    };
    add(
        '我的当前目标',
        '我希望不同 AI 助手读取同一份经过确认的背景，减少反复解释。',
        'personal/work',
        'fact',
    );
    const budget = add(
        '本周时间安排',
        '本周副项目最多投入六小时，先完成可验证的小原型。',
        'personal/work',
        'commitment',
    );
    add(
        '协作偏好',
        '先检查来源和现有实现；发现证据不足时明确标注。',
        'personal/work',
        'preference',
    );
    add(
        '项目范围',
        'Life Context 演示先验证来源、审核、上下文读取和恢复。',
        'projects/demo',
        'decision',
    );
    add(
        '验证顺序',
        '先用合成双语样例核查中文、权限和版本更新，再考虑真实导入。',
        'projects/demo',
        'decision',
    );
    add('仅限本人', '演示私密记录：周末与朋友的私人安排。', 'personal/private', 'note', 'private');
    const { source } = vault.addSource({
        title: '更新后的时间安排',
        excerpt: '本周时间减少，副项目最多投入三小时，优先完成审核闭环。',
        speaker: '演示用户',
        locator: 'demo://budget-update',
        observedAt: new Date().toISOString(),
        scope: 'personal/work',
        sensitivity: 'personal',
    });
    vault.propose(
        {
            content: source.excerpt,
            scope: source.scope,
            type: 'commitment',
            sensitivity: source.sensitivity,
            sourceId: source.id,
            epistemicStatus: 'self_report',
            baseVersion: vault.version,
            targetId: budget.id,
            note: '替代旧时间预算；需要本人确认后才进入当前上下文。',
        },
        'research-agent',
    );
}
