# First agent task — Read-only repository onboarding

Copy the task below into Codex/Claude Code from the local repository root.

---

You are the engineering reviewer for the Life Context project. We cloned OpenSelf as a **candidate** technical base. The product PRD is still under discussion.

Read `AGENTS.md`, `docs/life-context/{01-product-brief,02-use-cases-and-requirements,03-upstream-baseline,04-decision-log,06-data-infrastructure}.md` and inspect the actual local repository. Use the latest user instruction if any document conflicts.

**This pass is read-only. Do not edit or delete source, configs or docs; do not change dependencies, run automatic fixers, commit, push, tag or deploy. Do not import private chats or personal files.** Check `git status --short`, `git rev-parse HEAD`, current branch, remote and Node version first. State any uncommitted changes without modifying them.

Do not restart completed onboarding or rerun checks solely because this task template exists. Reuse current recorded evidence; inspect changes and unresolved gaps. The local source baseline is initial commit 8fe349f2944af92222f924f64ef01e218707aeb6 as of 2026-10-11. This is a source review, not a passed runtime baseline.

Tasks:
1. Map the real data paths and boundaries: `ContextStore`, memory schema, indexing, importer/capture, compiler, MCP stdio/HTTP, policy, proposals, dashboard, backup and evaluation; distinguish Context Vault from legacy persona/messaging modules.
2. Compare source implementation against J1–J11 in the requirements document. For each, mark implemented, partially implemented, absent, or unverified, with exact file paths and relevant functions.
3. Determine whether Markdown/JSONL can become authoritative without rewriting core modules; give at least two approaches and a dependency/impact map. Do not choose a design yet.
4. Inspect security boundaries: default MCP capabilities, agent identity, HTTP authentication, permissions, audit, direct OS access and destructive-forget semantics.
5. Inspect import behavior, especially OpenAI `conversations.json`, message branches, provenance and semantic extraction; distinguish raw document chunking from durable fact extraction.
6. Check the potential CJK deduplication and tokenization bug in the compiler using a synthetic example. If dependencies are already installed, a bounded non-mutating reproduction is acceptable. No fixes yet.
7. Inspect source-to-context relationships, view freshness and stale-agent proposals against J9–J11. Classify deterministic dependencies separately from uncertain semantic impacts; do not claim an incremental-maintenance mechanism is novel or needed before comparing simple rebuild baselines.
8. Establish a **verified local baseline** if dependencies are already available; otherwise list exact checks to run and prerequisites. No `npm ci` or package-manager network actions without the user's authorization.

Deliver in chat:
- Executive verdict on using OpenSelf as a base.
- Component/dependency map.
- Gap matrix J1–J11.
- Ranked architectural risks with supporting code paths.
- Current git status and results of tests actually run, with failures and skips explicit.
- Recommended smallest reversible spike and its measurable Gate.
- No more than 5 product questions that materially determine the architecture.

Prefer concrete evidence over generic architectural recommendations. Do not start implementation until the user selects and authorizes a specific task.
