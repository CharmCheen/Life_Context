import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { ContextStore, VAULT_SCHEMA_VERSION } from '../context/store.js';
import { AccessPolicy } from '../context/access-policy.js';
import { memoryInputSchema } from '../context/schema.js';

const sourceSchema = z.object({
    title: z.string().trim().min(1).max(300),
    excerpt: z.string().trim().min(1).max(20000),
    speaker: z.string().trim().min(1).max(100),
    locator: z.string().max(2000).default('manual excerpt'),
    observedAt: z.string().datetime({ offset: true }),
    scope: z.string().min(1).max(200),
    sensitivity: z.enum(['public', 'personal', 'private', 'restricted']).default('personal'),
    externalPath: z.string().max(2000).optional(),
});
const proposalSchema = z.object({
    content: z.string().trim().min(1).max(20000),
    type: memoryInputSchema.shape.type,
    scope: z.string().min(1).max(200),
    sensitivity: sourceSchema.shape.sensitivity,
    sourceId: z.string().uuid(),
    epistemicStatus: z.enum(['self_report', 'inference', 'observation']),
    baseVersion: z.number().int().nonnegative(),
    targetId: z.string().uuid().nullable().default(null),
    note: z.string().max(2000).default(''),
    validTo: z.string().datetime({ offset: true }).nullable().optional(),
});
const TABLES = [
    'memories',
    'import_items',
    'memory_vectors',
    'memory_versions',
    'vault_metadata',
    'capture_checkpoints',
    'memory_proposals',
    'memory_edges',
    'entities',
    'entity_aliases',
    'memory_entities',
    'lc_sources',
    'lc_metadata',
    'lc_proposals',
    'lc_state',
    'lc_events',
    'lc_clients',
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
export function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

// This spike adds namespaced tables to an isolated vault; upstream schema and
// public APIs stay intact. SQLite authority remains a reversible prototype choice.
export class LifeVault {
    constructor(options = {}) {
        this.store = options.store || new ContextStore(options);
        this.db = this.store.db;
        if (this.store.encryptionEnabled)
            fail('Prototype requires a separate plaintext demo vault');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS lc_sources (id TEXT PRIMARY KEY, fingerprint TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS lc_metadata (memory_id TEXT PRIMARY KEY REFERENCES memories(id), payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS lc_proposals (proposal_id TEXT PRIMARY KEY REFERENCES memory_proposals(id), payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS lc_state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
            INSERT OR IGNORE INTO lc_state VALUES (1,0);
            CREATE TABLE IF NOT EXISTS lc_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, at TEXT NOT NULL, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS lc_clients (id TEXT PRIMARY KEY, payload TEXT NOT NULL, enabled INTEGER NOT NULL);
        `);
    }
    get version() {
        return this.db.prepare('SELECT version FROM lc_state WHERE id=1').get().version;
    }
    close() {
        this.store.close();
    }
    event(kind, payload) {
        this.db
            .prepare('INSERT INTO lc_events VALUES (?,?,?,?)')
            .run(randomUUID(), kind, new Date().toISOString(), JSON.stringify(payload));
    }
    bump() {
        this.db.prepare('UPDATE lc_state SET version=version+1 WHERE id=1').run();
    }
    source(id) {
        const row = this.db.prepare('SELECT payload FROM lc_sources WHERE id=?').get(id);
        return row ? JSON.parse(row.payload) : null;
    }
    sources() {
        return this.db
            .prepare('SELECT payload FROM lc_sources')
            .all()
            .map((r) => JSON.parse(r.payload));
    }
    addSource(input) {
        const parsed = sourceSchema.parse(input);
        const fingerprint = hash(
            JSON.stringify({
                ...parsed,
                targetSnapshot: parsed.targetId
                    ? this.store.get(parsed.targetId).contentHash
                    : 'addition',
            }),
        );
        const existing = this.db
            .prepare('SELECT id FROM lc_sources WHERE fingerprint=?')
            .get(fingerprint);
        if (existing) return { source: this.source(existing.id), duplicate: true };
        const source = {
            ...parsed,
            id: randomUUID(),
            fingerprint,
            createdAt: new Date().toISOString(),
            managed: 'excerpt',
        };
        this.db.transaction(() => {
            this.db
                .prepare('INSERT INTO lc_sources VALUES (?,?,?)')
                .run(source.id, fingerprint, JSON.stringify(source));
            this.event('source_added', { sourceId: source.id });
        })();
        return { source, duplicate: false };
    }
    clients() {
        return this.db
            .prepare('SELECT * FROM lc_clients')
            .all()
            .map((r) => ({ ...JSON.parse(r.payload), enabled: Boolean(r.enabled) }));
    }
    setClient(input, enabled = true) {
        const policy = new AccessPolicy(input);
        this.db
            .prepare('INSERT OR REPLACE INTO lc_clients VALUES (?,?,?)')
            .run(policy.clientId, JSON.stringify(input), Number(enabled));
    }
    toggleClient(id, enabled) {
        if (
            !this.db.prepare('UPDATE lc_clients SET enabled=? WHERE id=?').run(Number(enabled), id)
                .changes
        )
            fail('Client unavailable', 404);
        this.event('client_access_changed', { clientId: id, enabled });
    }
    policy(id, capability = 'read') {
        const row = this.db.prepare('SELECT * FROM lc_clients WHERE id=? AND enabled=1').get(id);
        if (!row) fail('Client access denied', 403);
        const policy = new AccessPolicy(JSON.parse(row.payload));
        policy.require(capability);
        return policy;
    }
    metadata(id) {
        const row = this.db.prepare('SELECT payload FROM lc_metadata WHERE memory_id=?').get(id);
        return row ? JSON.parse(row.payload) : null;
    }
    records() {
        return this.db
            .prepare('SELECT id FROM memories ORDER BY created_at DESC')
            .all()
            .map((r) => {
                const memory = this.store.get(r.id, { includeForgotten: true });
                const now = Date.now();
                const current =
                    memory.status === 'active' &&
                    !memory.supersededAt &&
                    (!memory.validFrom || Date.parse(memory.validFrom) <= now) &&
                    (!memory.validTo || Date.parse(memory.validTo) >= now);
                return {
                    ...memory,
                    ...this.metadata(r.id),
                    current,
                    history: this.store.history(r.id),
                };
            });
    }
    proposalStale(proposal) {
        if (proposal.baseVersion === this.version) return false;
        if (!proposal.targetSnapshot) return true;
        const target = proposal.targetId ? this.store.get(proposal.targetId) : null;
        return proposal.targetId
            ? !target || target.supersededAt || target.contentHash !== proposal.targetSnapshot
            : false;
    }
    proposals() {
        return this.db
            .prepare('SELECT proposal_id,payload FROM lc_proposals')
            .all()
            .map((r) => {
                const proposal = {
                    ...this.store.getProposal(r.proposal_id),
                    ...JSON.parse(r.payload),
                };
                return { ...proposal, stale: this.proposalStale(proposal) };
            });
    }
    propose(input, clientId = 'owner') {
        const parsed = proposalSchema.parse(input);
        const source = this.source(parsed.sourceId);
        if (!source) fail('Source unavailable', 404);
        const draft = {
            content: parsed.content,
            type: parsed.type,
            scope: parsed.scope,
            sensitivity: parsed.sensitivity,
        };
        if (clientId !== 'owner') {
            const policy = this.policy(clientId, 'propose');
            policy.requireMemory(draft);
            policy.requireMemory(source);
        }
        // A citation's visibility must fit the record's scope and sensitivity.
        const levels = ['public', 'personal', 'private', 'restricted'];
        if (
            source.scope !== parsed.scope ||
            levels.indexOf(parsed.sensitivity) < levels.indexOf(source.sensitivity)
        )
            fail('Source scope or sensitivity incompatible');
        if (parsed.targetId) {
            const target = this.store.get(parsed.targetId);
            if (clientId !== 'owner') this.policy(clientId, 'propose').requireMemory(target);
            if (!target || target.scope !== parsed.scope || target.supersededAt)
                fail('Target unavailable', 409);
        }
        if (parsed.baseVersion !== this.version) fail('Unknown base version', 409);
        return this.db.transaction(() => {
            const proposal = this.store.proposeMemory(
                {
                    ...draft,
                    sourceTrust: 'external',
                    validTo: parsed.validTo,
                    source: {
                        kind: 'evidence',
                        locator: `life-context:source:${source.id}`,
                        title: source.title,
                    },
                },
                { proposedBy: clientId, note: parsed.note },
            );
            this.db.prepare('INSERT INTO lc_proposals VALUES (?,?)').run(
                proposal.id,
                JSON.stringify({
                    ...parsed,
                    targetSnapshot: parsed.targetId
                        ? this.store.get(parsed.targetId).contentHash
                        : 'addition',
                }),
            );
            this.event('proposal_submitted', {
                proposalId: proposal.id,
                clientId,
                baseVersion: parsed.baseVersion,
            });
            return { ...proposal, ...parsed };
        })();
    }
    review(id, decision, content) {
        if (!['approve', 'reject'].includes(decision)) fail('Unknown review decision');
        return this.db.transaction(() => {
            const proposal = this.proposals().find((p) => p.id === id);
            if (!proposal) fail('Proposal unavailable', 404);
            if (proposal.status !== 'pending') fail('Proposal already reviewed', 409);
            if (decision === 'reject') {
                this.store.rejectProposal(id);
                this.event('proposal_rejected', { proposalId: id });
                return { version: this.version, rejected: true };
            }
            if (this.proposalStale(proposal))
                fail('Context changed. Review intervening changes and submit a new proposal.', 409);
            if (proposal.targetId) {
                const target = this.store.get(proposal.targetId);
                if (!target || target.supersededAt) fail('Target has changed', 409);
            }
            const memory = this.store.approveProposal(id, {
                ...(content === undefined ? {} : { content }),
                sourceTrust: 'verified',
            });
            const metadata = {
                sourceId: proposal.sourceId,
                epistemicStatus: proposal.epistemicStatus,
                sourceSpeaker: this.source(proposal.sourceId).speaker,
                assertedBy:
                    proposal.epistemicStatus === 'inference'
                        ? proposal.proposedBy
                        : this.source(proposal.sourceId).speaker,
                proposedBy: proposal.proposedBy,
                reviewedBy: 'owner',
                reviewedAt: new Date().toISOString(),
            };
            this.db
                .prepare('INSERT INTO lc_metadata VALUES (?,?)')
                .run(memory.id, JSON.stringify(metadata));
            if (proposal.targetId) this.store.supersede(memory.id, proposal.targetId);
            this.bump();
            this.event('proposal_approved', {
                proposalId: id,
                memoryId: memory.id,
                targetId: proposal.targetId,
                version: this.version,
            });
            return { memory, version: this.version };
        })();
    }
    discoverCurrent(request, params) {
        // Page through the policy-filtered store before bounding current candidates.
        const superseded = this.store.supersededIds(request.asOf);
        const rows = [];
        for (let offset = 0; ; offset += 100) {
            const page = this.store.list({ ...params, asOf: request.asOf, limit: 100, offset });
            rows.push(...page.filter((m) => !superseded.has(m.id)));
            if (page.length < 100) break;
        }
        let candidates = rows;
        if (request.query) {
            const query = request.query.normalize('NFKC').toLowerCase().trim();
            const terms = query.match(/[\p{Script=Han}]{2,}|[a-z0-9]+/gu) || [query];
            const tokens = terms.flatMap((term) =>
                /\p{Script=Han}/u.test(term)
                    ? Array.from({ length: term.length - 1 }, (_, i) => term.slice(i, i + 2))
                    : [term],
            );
            candidates = rows
                .map((memory) => {
                    const text = `${memory.content} ${memory.source.title || ''}`
                        .normalize('NFKC')
                        .toLowerCase();
                    return { memory, score: tokens.filter((token) => text.includes(token)).length };
                })
                .filter((item) => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(({ memory, score }) => ({
                    ...memory,
                    relevance: score / Math.max(tokens.length, 1),
                }));
        }
        return candidates
            .slice(0, params.limit)
            .map((memory) => ({ ...memory, ...this.metadata(memory.id) }));
    }
    context(clientId, request = {}) {
        // Compilation, evidence and the version receipt share a snapshot even
        // when another MCP process is updating the same vault.
        return this.db
            .transaction(() => {
                const policy = this.policy(clientId);
                const pkg = this.store.compileContext(
                    {
                        ...request,
                        minSourceTrust: 'verified',
                        includeSuperseded: false,
                        includeStale: false,
                        explain: true,
                    },
                    {
                        policy,
                        discover: (normalized, params) => this.discoverCurrent(normalized, params),
                    },
                );
                const selectedIds = pkg.memories.map((m) => m.id);
                const evidence = pkg.memories.map((memory) => ({
                    memoryId: memory.id,
                    ...this.metadata(memory.id),
                    source: this.source(this.metadata(memory.id)?.sourceId),
                }));
                this.event('context_read', {
                    clientId,
                    version: this.version,
                    selectedIds,
                    contextHash: pkg.receipt?.contextHash,
                });
                return {
                    ...pkg,
                    evidence,
                    vaultVersion: this.version,
                    generatedAt: new Date().toISOString(),
                };
            })
            .immediate();
    }
    events() {
        return this.db
            .prepare('SELECT * FROM lc_events ORDER BY rowid DESC LIMIT 100')
            .all()
            .map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
    }
    state() {
        return {
            version: this.version,
            records: this.records(),
            proposals: this.proposals(),
            sources: this.sources(),
            clients: this.clients(),
            events: this.events(),
        };
    }
    export() {
        return this.db.transaction(() => {
            const tables = Object.fromEntries(
                TABLES.map((table) => [
                    table,
                    this.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
                ]),
            );
            const payload = {
                format: 'life-context-vault',
                version: 1,
                upstreamSchema: VAULT_SCHEMA_VERSION,
                tables,
                attachmentCoverage:
                    'Selected excerpts only; external originals are referenced, not bundled.',
            };
            return { ...payload, checksum: hash(JSON.stringify(payload)) };
        })();
    }
    // Restore is owner-only, into a fresh vault. Table names/columns come from
    // installed code, never from an imported SQL schema or executable content.
    restore(bundle) {
        if (
            this.version !== 0 ||
            this.sources().length ||
            this.records().length ||
            this.proposals().length ||
            this.clients().length ||
            this.events().length
        )
            fail('Restore requires a fresh empty vault', 409);
        const { checksum, ...payload } = bundle;
        if (
            payload.format !== 'life-context-vault' ||
            payload.version !== 1 ||
            payload.upstreamSchema !== VAULT_SCHEMA_VERSION ||
            hash(JSON.stringify(payload)) !== checksum
        )
            fail('Invalid vault format or checksum');
        if (
            Object.keys(payload.tables || {})
                .sort()
                .join() !== [...TABLES].sort().join()
        )
            fail('Incomplete vault table manifest');
        this.db.transaction(() => {
            this.db.pragma('defer_foreign_keys = ON');
            for (const table of [...TABLES].reverse())
                this.db.prepare(`DELETE FROM ${table}`).run();
            for (const table of TABLES) {
                const columns = this.db
                    .prepare(`PRAGMA table_info(${table})`)
                    .all()
                    .map((c) => c.name);
                const insert = this.db.prepare(
                    `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
                );
                if (!Array.isArray(payload.tables[table])) fail('Invalid table data');
                for (const row of payload.tables[table]) {
                    if (Object.keys(row).sort().join() !== [...columns].sort().join())
                        fail('Incompatible table columns');
                    insert.run(...columns.map((c) => row[c]));
                }
            }
            if (this.db.prepare('SELECT version FROM lc_state WHERE id=1').get()?.version == null)
                fail('Missing vault state');
            for (const source of this.sources()) sourceSchema.parse(source);
            for (const { enabled: _enabled, ...client } of this.clients()) new AccessPolicy(client);
            for (const record of this.records()) {
                if (!record.sourceId || !this.source(record.sourceId))
                    fail('Missing record evidence');
            }
            for (const proposal of this.proposals()) {
                proposalSchema.parse(proposal);
                if (!this.source(proposal.sourceId)) fail('Missing proposal evidence');
            }
            if (this.db.pragma('foreign_key_check').length)
                fail('Broken evidence or record relationships');
            this.db.prepare('DELETE FROM memory_fts').run();
            for (const record of this.records())
                if (record.status === 'active') this.store._writeFts(record);
        })();
        const missingSources = this.sources()
            .filter((s) => s.externalPath && !existsSync(s.externalPath))
            .map((s) => ({ id: s.id, path: s.externalPath }));
        return {
            restored: true,
            version: this.version,
            missingSources,
            attachmentCoverage: payload.attachmentCoverage,
        };
    }
}
