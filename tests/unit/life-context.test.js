import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LifeVault } from '../../src/life-context/vault.js';
import { seedDemo } from '../../src/life-context/seed.js';
import { createLifeServer } from '../../src/life-context/server.js';

const resources = [];
const directories = [];
const fixture = (options = { dbPath: ':memory:' }) => {
    const vault = new LifeVault(options);
    resources.push(() => vault.close());
    seedDemo(vault);
    return vault;
};
const pending = (vault) => vault.proposals().find((p) => p.status === 'pending');
const contents = (pkg) => pkg.memories.map((r) => r.content);
afterEach(async () => {
    while (resources.length) await resources.pop()();
    while (directories.length) rmSync(directories.pop(), { recursive: true, force: true });
});

describe('Life Context prototype contracts', () => {
    it('keeps five distinct Chinese facts and excludes unreviewed/private text for both identities', () => {
        const v = fixture();
        for (const id of ['research-agent', 'writing-agent']) {
            const pkg = v.context(id);
            expect(pkg.items).toBe(5);
            expect(pkg.context).toContain('六小时');
            expect(JSON.stringify(pkg)).not.toContain('三小时');
            expect(JSON.stringify(pkg)).not.toContain('演示私密记录');
            expect(pkg.evidence.every((e) => e.source.id === e.sourceId)).toBe(true);
        }
    });
    it('atomically approves replacement, preserves history, and second identity reads current state', () => {
        const v = fixture();
        const p = pending(v);
        const base = v.version;
        v.review(p.id, 'approve');
        expect(v.version).toBe(base + 1);
        expect(v.store.get(p.targetId).supersededBy).toBe(p.id);
        expect(v.store.history(p.targetId).map((h) => h.changeKind)).toContain('superseded');
        const pkg = v.context('writing-agent');
        expect(pkg.context).toContain('三小时');
        expect(pkg.context).not.toContain('六小时');
        expect(pkg.vaultVersion).toBe(base + 1);
        expect(v.store.edges(p.id).some((e) => e.predicate === 'supersedes')).toBe(true);
    });
    it('rejects without changing the current version or exposing the rejected proposal', () => {
        const v = fixture();
        const base = v.version;
        v.review(pending(v).id, 'reject');
        expect(v.version).toBe(base);
        expect(v.context('research-agent').context).toContain('六小时');
        expect(v.context('research-agent').context).not.toContain('三小时');
    });
    it('blocks stale proposals and exposes intervening approval events to the owner', () => {
        const v = fixture();
        const p = pending(v);
        const other = v.propose({ ...p, content: '同一目标的新决定' });
        v.review(other.id, 'approve');
        expect(() => v.review(p.id, 'approve')).toThrow('Context changed');
        expect(v.store.getProposal(p.id).status).toBe('pending');
        expect(
            v
                .events()
                .some((e) => e.kind === 'proposal_approved' && e.payload.version === v.version),
        ).toBe(true);
    });
    it('allows unrelated approvals but rejects submission based on an unknown snapshot', () => {
        const v = fixture();
        const p = pending(v);
        const other = v.propose({ ...p, targetId: null, content: '另一项独立决定' });
        v.review(other.id, 'approve');
        expect(v.proposals().find((item) => item.id === p.id).stale).toBe(false);
        v.review(p.id, 'approve');
        expect(() => v.propose({ ...p, targetId: null })).toThrow('Unknown base version');
    });
    it('recalls Chinese tasks and keeps current facts after 100 expired additions', () => {
        const v = fixture();
        expect(v.context('research-agent', { query: '时间安排' }).items).toBeGreaterThan(0);
        expect(v.context('research-agent', { query: '原型验证' }).items).toBeGreaterThan(0);
        expect(v.context('research-agent', { query: '火星旅游' }).items).toBe(0);
        const p = pending(v);
        for (let i = 0; i < 100; i++) {
            const draft = v.propose({
                ...p,
                targetId: null,
                baseVersion: v.version,
                content: `过期任务 ${i}`,
                validTo: '2020-01-01T00:00:00.000Z',
            });
            v.review(draft.id, 'approve');
        }
        expect(v.context('research-agent').items).toBe(5);
    });
    it('keeps inference attribution in the rendered context and selected memory', () => {
        const v = fixture();
        const p = v.propose(
            {
                ...pending(v),
                targetId: null,
                epistemicStatus: 'inference',
                content: 'The user may prefer short tasks.',
            },
            'research-agent',
        );
        v.review(p.id, 'approve');
        const pkg = v.context('research-agent', { query: 'short tasks', format: 'markdown' });
        expect(pkg.context).toContain('inference');
        expect(pkg.context).toContain('research-agent');
        expect(pkg.memories[0].assertedBy).toBe('research-agent');
    });
    it('rejects missing evidence and malformed payloads without committing restored data', () => {
        const v = fixture();
        for (const corrupt of [
            (bundle) => {
                bundle.tables.lc_sources = [];
            },
            (bundle) => {
                bundle.tables.lc_sources[0].payload = '{bad';
            },
            (bundle) => {
                bundle.tables.lc_state = [];
            },
        ]) {
            const bundle = structuredClone(v.export());
            corrupt(bundle);
            const { checksum: _checksum, ...payload } = bundle;
            bundle.checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
            const target = new LifeVault({ dbPath: ':memory:' });
            resources.push(() => target.close());
            expect(() => target.restore(bundle)).toThrow();
            expect(target.version).toBe(0);
            expect(target.records()).toEqual([]);
            expect(target.sources()).toEqual([]);
        }
    });
    it('rolls back approval when the lifecycle operation fails', () => {
        const v = fixture();
        const p = pending(v);
        const base = v.version;
        v.store.supersede = () => {
            throw new Error('synthetic lifecycle failure');
        };
        expect(() => v.review(p.id, 'approve')).toThrow('synthetic lifecycle');
        expect(v.version).toBe(base);
        expect(v.store.getProposal(p.id).status).toBe('pending');
        expect(v.store.get(p.id)).toBeNull();
        expect(v.metadata(p.id)).toBeNull();
    });
    it('rejects cross-scope source references, sensitivity downgrade and prohibited source probing', () => {
        const v = fixture();
        const p = pending(v);
        const source = v.sources().find((s) => s.sensitivity === 'private');
        expect(() => v.propose({ ...p, sourceId: source.id }, 'research-agent')).toThrow(
            'Access denied',
        );
        expect(() => v.propose({ ...p, sourceId: source.id })).toThrow('Source scope');
        expect(() => v.context('research-agent', { scope: 'personal/private' })).toThrow(
            'Access denied',
        );
    });
    it('revokes permissions on the next request and preserves approved inference labels', () => {
        const v = fixture();
        const p = pending(v);
        const inference = v.propose({
            ...p,
            content: 'This is a tentative interpretation.',
            epistemicStatus: 'inference',
            targetId: null,
        });
        v.review(inference.id, 'approve');
        expect(
            v.context('writing-agent').evidence.find((e) => e.memoryId === inference.id)
                .epistemicStatus,
        ).toBe('inference');
        v.toggleClient('writing-agent', false);
        expect(() => v.context('writing-agent')).toThrow('Client access denied');
        expect(() => v.propose({ ...p, baseVersion: v.version }, 'writing-agent')).toThrow(
            'Client access denied',
        );
    });
    it('round-trips all logical tables into a new directory, retaining lifecycle, sources and client revocation', () => {
        const v = fixture();
        v.review(pending(v).id, 'approve');
        v.toggleClient('writing-agent', false);
        v.addSource({
            title: 'External reference',
            excerpt: 'synthetic external source',
            speaker: 'demo',
            locator: 'file:///missing',
            observedAt: new Date().toISOString(),
            scope: 'projects/demo',
            externalPath: '/missing/life-context-demo-source.md',
        });
        const bundle = v.export();
        const path = mkdtempSync(join(tmpdir(), 'life-context-restored-'));
        directories.push(path);
        const fresh = new LifeVault({ dataDir: path });
        resources.push(() => fresh.close());
        const result = fresh.restore(bundle);
        expect(result.missingSources).toHaveLength(1);
        expect(fresh.export().tables).toEqual(bundle.tables);
        expect(fresh.export().checksum).toBe(bundle.checksum);
        expect(fresh.context('research-agent').context).toContain('三小时');
        expect(() => fresh.context('writing-agent')).toThrow('Client access denied');
        expect(fresh.store.search('Life').map((r) => r.id)).toEqual(
            v.store.search('Life').map((r) => r.id),
        );
        expect(fresh.store.search('Life').length).toBeGreaterThan(0);
        expect(() => fresh.restore(bundle)).toThrow('fresh empty vault');
    });
    it('rejects corruption without modifying an empty destination and deduplicates exact sources', () => {
        const v = fixture();
        const source = v.sources()[0];
        expect(v.addSource(source).duplicate).toBe(true);
        const bundle = v.export();
        bundle.tables.memories[0].content = 'tampered';
        const fresh = new LifeVault({ dbPath: ':memory:' });
        resources.push(() => fresh.close());
        expect(() => fresh.restore(bundle)).toThrow('checksum');
        expect(fresh.version).toBe(0);
        expect(fresh.records()).toEqual([]);
    });
    it('enforces character budgets and validity on bilingual records', () => {
        const v = fixture();
        const p = pending(v);
        const expired = v.propose({
            ...p,
            content: 'Expired English statement',
            targetId: null,
            validTo: '2020-01-01T00:00:00.000Z',
        });
        v.review(expired.id, 'approve');
        const pkg = v.context('research-agent', { budget: { maxChars: 1000 } });
        expect(pkg.usedChars).toBeLessThanOrEqual(1000);
        expect(contents(pkg)).not.toContain('Expired English statement');
        expect(pkg.context).not.toContain('Expired English statement');
    });
    it('authenticates owner API, denies foreign-origin mutations and validates restore in isolation', async () => {
        const v = fixture();
        const { app } = createLifeServer({ vault: v, token: 'synthetic-owner-test-only' });
        const listener = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => listener.once('listening', resolve));
        resources.push(() => new Promise((resolve) => listener.close(resolve)));
        const url = `http://127.0.0.1:${listener.address().port}`;
        expect((await fetch(`${url}/api/state`)).status).toBe(401);
        const headers = {
            Authorization: 'Bearer synthetic-owner-test-only',
            'Content-Type': 'application/json',
        };
        expect(
            (
                await fetch(`${url}/api/proposals`, {
                    method: 'POST',
                    headers: { ...headers, Origin: 'https://foreign.example' },
                    body: '{}',
                })
            ).status,
        ).toBe(403);
        const response = await fetch(`${url}/api/verify-restore`, {
            method: 'POST',
            headers,
            body: JSON.stringify(v.export()),
        });
        expect((await response.json()).identical).toBe(true);
        expect(v.version).toBe(6);
    });
    it('shares an approved replacement over two real stdio MCP clients and denies revoked reads', async () => {
        const path = mkdtempSync(join(tmpdir(), 'life-context-two-clients-'));
        directories.push(path);
        const v = fixture({ dataDir: path });
        const clients = [];
        for (const id of ['research-agent', 'writing-agent']) {
            const transport = new StdioClientTransport({
                command: process.execPath,
                args: [
                    fileURLToPath(new URL('../../src/life-context/mcp.js', import.meta.url)),
                    path,
                    id,
                ],
                stderr: 'pipe',
                env: { ...process.env },
            });
            resources.push(() => transport.close());
            const client = new Client({ name: `test-${id}`, version: '0.1.0' });
            resources.push(() => client.close());
            await client.connect(transport);
            clients.push(client);
            expect((await client.listTools()).tools.map((t) => t.name)).toEqual([
                'get_context',
                'register_source',
                'propose_update',
            ]);
        }
        const call = async (client) => client.callTool({ name: 'get_context', arguments: {} });
        expect(JSON.parse((await call(clients[0])).content[0].text).context).toContain('六小时');
        const p = pending(v);
        const evidence = {
            title: 'MCP quoted update',
            excerpt: p.content,
            speaker: '演示用户',
            observedAt: new Date().toISOString(),
            locator: 'synthetic://mcp/current-turn',
            scope: p.scope,
            sensitivity: p.sensitivity,
        };
        const deniedSource = await clients[0].callTool({
            name: 'register_source',
            arguments: { ...evidence, scope: 'personal/private', sensitivity: 'private' },
        });
        expect(deniedSource.isError).toBe(true);
        const registered = await clients[0].callTool({
            name: 'register_source',
            arguments: evidence,
        });
        expect(registered.isError).toBeUndefined();
        const registeredId = JSON.parse(registered.content[0].text).source.id;
        const proposed = await clients[0].callTool({
            name: 'propose_update',
            arguments: {
                content: p.content,
                type: p.memory.type,
                scope: p.scope,
                sensitivity: p.sensitivity,
                sourceId: registeredId,
                baseVersion: v.version,
                targetId: p.targetId,
                epistemicStatus: p.epistemicStatus,
            },
        });
        expect(proposed.isError).toBeUndefined();
        v.review(JSON.parse(proposed.content[0].text).id, 'approve');
        const received = JSON.parse((await call(clients[1])).content[0].text);
        expect(received.context).toContain('三小时');
        expect(received.context).not.toContain('六小时');
        v.toggleClient('writing-agent', false);
        expect((await call(clients[1])).isError).toBe(true);
    });
});
