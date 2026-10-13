import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LifeVault, fail } from './vault.js';
import { seedDemo } from './seed.js';

const directory = dirname(fileURLToPath(import.meta.url));
const equal = (a, b) =>
    typeof a === 'string' &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createLifeServer({ vault, token = randomBytes(24).toString('base64url') }) {
    const app = express();
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        const host = req.headers.host || '';
        if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
            return res.status(403).json({ error: 'Local host required' });
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        );
        if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `http://${host}`)
            return res.status(403).json({ error: 'Cross-origin mutation denied' });
        next();
    });
    app.use(express.json({ limit: '20mb' }));
    app.get('/health', (_req, res) => res.json({ ok: true, product: 'Life Context prototype' }));
    app.get('/auth', (req, res) => {
        if (!equal(req.query.token, token)) return res.status(401).send('Authentication required');
        res.cookie('life_owner', token, { httpOnly: true, sameSite: 'strict', maxAge: 43200000 });
        res.redirect(303, '/');
    });
    app.use((req, res, next) => {
        const cookie = req.headers.cookie
            ?.split(';')
            .map((s) => s.trim())
            .find((s) => s.startsWith('life_owner='))
            ?.slice(11);
        const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!equal(bearer || cookie, token))
            return res
                .status(401)
                .send('Open the authenticated local preview URL from the terminal.');
        next();
    });
    app.get('/api/state', (_req, res) => res.json(vault.state()));
    app.post('/api/sources', (req, res) => res.status(201).json(vault.addSource(req.body)));
    // This owner UI previews a client's policy; agents use the identity-bound
    // stdio MCP adapter, never the owner cookie or this preview selector.
    app.post('/api/context', (req, res) =>
        res.json(vault.context(req.body.clientId, req.body.request || {})),
    );
    app.post('/api/proposals', (req, res) =>
        res.status(201).json(vault.propose(req.body.proposal, req.body.clientId || 'owner')),
    );
    app.post('/api/proposals/:id/review', (req, res) =>
        res.json(vault.review(req.params.id, req.body.decision, req.body.content)),
    );
    app.post('/api/clients/:id', (req, res) => {
        if (typeof req.body.enabled !== 'boolean') fail('enabled must be boolean');
        vault.toggleClient(req.params.id, req.body.enabled);
        res.json({ updated: true });
    });
    app.get('/api/export', (_req, res) => {
        res.attachment('life-context-vault.json').json(vault.export());
    });
    app.post('/api/verify-restore', (req, res) => {
        const fresh = new LifeVault({ dbPath: ':memory:' });
        try {
            const result = fresh.restore(req.body);
            const roundTrip = fresh.export();
            res.json({
                ...result,
                identical: roundTrip.checksum === req.body.checksum,
                records: fresh.records().length,
                sources: fresh.sources().length,
            });
        } finally {
            fresh.close();
        }
    });
    app.use(express.static(join(directory, 'ui')));
    app.use((error, _req, res, _next) => {
        const status =
            error.code === 'ACCESS_DENIED'
                ? 403
                : error.status ||
                  (error.name === 'ZodError' || error instanceof SyntaxError ? 400 : 500);
        res.status(status).json({
            error: status === 500 ? 'Prototype operation failed' : error.message,
        });
    });
    return { app, token };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const vault = new LifeVault({
        dataDir: process.env.LIFE_CONTEXT_DATA_DIR || './data/life-context-demo',
    });
    seedDemo(vault);
    const { app, token } = createLifeServer({ vault });
    const port = Number(process.env.LIFE_CONTEXT_PORT || 4317);
    const server = app.listen(port, '127.0.0.1', () => {
        console.log(`Life Context: http://127.0.0.1:${port}/auth?token=${token}`);
        console.log('Synthetic demo data. Local prototype; no remote model calls.');
    });
    const stop = () =>
        server.close(() => {
            vault.close();
            process.exit(0);
        });
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
}
