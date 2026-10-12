# OpenSelf Upstream Baseline and Review Checklist

Status: **SOURCE-INSPECTED ONLY**, updated 2026-10-11 (not a successful local test run).

## Reference snapshot

A prior source review inspected Open-Self/Open-Self at `380785d21d9c7b6ef1d9b1707f2d149ab4c423da`, package v1.2.0 (MIT). **The user's local clone may point to another commit: check `git rev-parse HEAD` before using any findings.**

## Local source snapshot, 2026-10-11

- Code repository: sibling `Open-Self-main/`, branch `main`, initial import commit `8fe349f2944af92222f924f64ef01e218707aeb6`; working tree clean when inspected for this documentation update.
- This local initial import SHA identifies the downloaded source snapshot. It is not the upstream reference SHA above and does not establish identical upstream history.
- Rechecked `src/context/access-policy.js`: default trusted-local capabilities include read, remember, forget and propose. Proposal-only updates require explicit Life Context policy; upstream README wording does not enforce them.
- Rechecked `src/context/compiler.js`: ASCII-only normalization remains. A prior bounded string reproduction showed distinct pure-Chinese texts collapse to an empty dedupe key; full compiler behavior and a fix are not verified.
- Rechecked `src/context/exporter.js` `serializeMemory`: exported fields do not include full supersession/relationship/history state. Treat existing JSONL as insufficient evidence for lossless lifecycle migration.
- Full test/lint/type/evaluation suites have not been run in this documentation update. None of the product's acceptance gates are marked passed.

## Verified via reading source

- `src/context/store.js`: SQLite (`context.db`) is the authoritative memory store, with FTS5, version history, pending proposals and related tables.
- `src/context/schema.js`: facts, preferences, decisions, commitments, relationships, events and notes; source trust, confidence, sensitivity, scope, timestamps.
- `src/context/compiler.js`: query, permission envelope, temporal resolution, ranking, deduplication, budgets, receipts.
- `src/context/mcp.js`: separate `openself_remember` (direct write) and `openself_propose_memory` (owner review); multiple query/context tools.
- `src/context/access-policy.js`: default trusted-local configuration grants read, remember, forget and propose. Explicit per-client policies can restrict this.
- `src/context/mcp-http.js`: authenticated localhost-first Streamable HTTP; remote mode requires explicit credentials.
- `src/context/importer.js`: Markdown/text chunks, Telegram JSON, WhatsApp TXT and OpenSelf exports. The generic `.json` path defaults to Telegram; no native OpenAI `conversations.json` parser was found in this importer.
- `src/context/project-capture.js`: incremental file capture with checkpoint state. This is not yet an authoritative bidirectional Markdown vault.
- `src/context/embeddings.js`: default local feature hashing, optional Ollama or OpenAI-compatible embeddings.
- `README.md`: earlier personality/messaging pipeline remains in repository, separate from Context Vault.

## High-priority potential bug: CJK deduplication

In `src/context/compiler.js`, normalized content key uses `/[^a-z0-9]+/g`. Distinct strings consisting only of Chinese characters normalize to `''`, so the `seenText` deduplication rule can incorrectly suppress a second candidate. The related `tokenOverlap` heuristic removes non-ASCII text. Add focused regression tests before changing implementation.

## Upstream CI evidence (historical, not current local status)

- Run `35490798219` on 2026-09-20: most test matrix jobs passed, but the Linux Node 22.13 coverage job failed global thresholds (lines 79.92% vs 80%, functions 84.91% vs 85%, branches 69.54% vs 72%).
- Run `36574982185` on 2026-09-29: several matrix jobs stopped at npm audit (moderate advisories in `ip-address` and `undici`) and one failed install. Recheck against current lockfile and advisory database; do not assume a current vulnerability from historical CI alone.

## Local inspection to do before edits

1. `git status --short && git branch --show-current && git rev-parse HEAD && git remote -v`
2. Verify Node >=22.13, package manager, package-lock integrity and CI scripts.
3. Before `npm ci`, inspect lifecycle scripts and native build requirements; install only in a safe development environment.
4. Run and capture test/lint/type/format/coverage/eval/audit exit codes and failing logs separately. No silent auto-fixes.
5. Construct a tiny synthetic Chinese memory set for current-truth, distinct-record dedupe and conflict detection.
6. Check ability to import/export/rebuild, proposal vs direct-write policy and cross-client permission boundaries.
7. Inspect module dependencies before proposing a file-authoritative storage conversion; do not replace store wholesale as a first change.

## Document caveat

`docs/codebase-summary.md` still emphasizes an earlier AI personality-clone architecture and Node >=20. Current `package.json` requires Node >=22.13; code and current executable config take precedence over stale prose.
