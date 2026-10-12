# Life Context — Decision Log

Status: **LIVING DRAFT**. Log major choices with date, alternatives, evidence and reversal conditions. Do not silently turn proposals into decisions.

## D-000 — Evaluate an existing base

- Date: 2026-10-10
- Status: **Accepted for evaluation only**
- Decision: Use the user's local clone of OpenSelf as the first candidate for source review and isolated experiments.
- Rationale: relevant Context Vault, MCP, permission and temporal modules already exist; MIT license preserves broad commercialization options.
- Does **not** decide: production adoption, authoritative data format, full product scope or licensing for newly developed components.
- Reconsider if: baseline cannot be reproduced; upstream constraints make desired workflows unduly expensive; security issues block usage.

## D-001 — Authoritative data store

- Status: **Open**
- Options: (A) SQLite authority + open exports; (B) Markdown/JSONL authority + rebuildable SQLite index; (C) hybrid with explicit reconciliation.
- Evidence needed: bidirectional consistency, edit workflow, migration/restore behavior, performance, maintenance and complexity.
- Rule: avoid irreversible schema redesign before deciding.

## D-002 — Update authority

- Status: **Open**; provisional preference for human-reviewed agent proposals.
- Options: always review vs trust/risk-tiered updates.
- Gate: demonstrate prevention of wrong/falsely inferred current facts and manageable review costs.

## D-003 — Automatic capture scope

- Status: **Open**
- Options: manual explicit imports; chat exports; local agent hooks; browser/platform adapters; background capture.
- Gate: legal/platform feasibility, source fidelity, privacy and meaningful capture coverage.

## D-004 — MVP form factor

- Status: **Open**
- Options: CLI/MCP-first, local web UI, Obsidian plugin, hosted app.
- Gate: first target user onboarding time and task completion; no consumer UI promise yet.

## D-005 — Business/licensing

- Status: **Open**
- Working constraint: preserve upstream MIT license/attribution, track third-party licenses, no premature dual-licensing or closed-source decision.
- Options: fully open-source, open-core + hosted services, paid hosted service, commercial extensions.
- Gate: valid demand, operational costs, contributor/IP considerations, license review before release.

## D-006 — Personal context is the product center

- Date: 2026-10-11
- Status: **Direction agreed in user discussion; detailed requirements remain draft**
- Direction: user-owned personal context, drawn from selected sources such as conversations and self-reports, inspectable and correctable across repeated agent updates.
- Retain: “context remains accurate and correctable after repeated agent updates, with low user maintenance cost” as the core objective.
- Positioning: personal context library for users; context interface for agents. “External tool” is an integration description.
- Boundary: project continuation is a proposed first scenario; personal goals, constraints and commitments remain central. Do not promise complete knowledge of a person.
- Novelty: the user considers the idea promising; product differentiation and research novelty remain unverified.

## D-007 — Sources, context records and core files

- Date: 2026-10-11
- Status: **Source-connected context direction agreed; representation remains open**
- Direction: retain selected sources and provenance alongside extracted context. A core file offers concise task-relevant background connected to those sources.
- Proposal: treat core files as versioned task views, with scope, budget, time and source references. Keep direct user statements distinct from agent inference.
- Does not decide: authoritative store, file editing/reconciliation, extraction model or automatic approval.
- Gate: faithful extraction, visible uncertainty, correct updates and recovery without losing evidence relationships.

## D-008 — Broad AI/Data Infrastructure alignment

- Date: 2026-10-11
- Status: **Research scope clarified by user; mechanism is an unverified proposal**
- Direction: align with broad AI/Data Infrastructure; no training-data-only restriction.
- Candidate problem: maintain derived task contexts under changing sources, balancing freshness, correctness and total maintenance cost.
- Gate: real workload evidence and residual loss after full rebuild and simple version-aware on-demand rebuild baselines.
- Stop: simple rebuild is sufficient, or dependency/confirmation costs erase gains.
- Does not decide: paper topic, novelty, optimizer architecture or experimental success.
- Protocol: [06-data-infrastructure.md](06-data-infrastructure.md).

## D-009 — Questionnaires and profiling

- Date: 2026-10-11
- Status: **Deferred by user**
- Direction: a possible later structured source for self-reports and analysis.
- Boundary: product onboarding questions and standardized psychometric scales have different evidence requirements. Avoid fixed personality labels inferred from sparse records.
- Does not authorize: collecting private records, selecting a scale, implementing profiling or making health/personality claims.

## D-010 — Minimum scope and evidence gates

- Date: 2026-10-11
- Status: **Proposal, not frozen**
- Proposal: personal/project cards, task reading, batched proposals, portable export/recovery, minimal decision/outcome records; initially one project and two clients.
- Gate: compare against actively maintained CONTEXT.md, count explanation/review/correction time together, and verify restoration.
- Cost cap proposal: four weeks, 6–8 development hours/week; daily user-maintenance median <=3 minutes.
- Does not authorize: implementation, bulk import, paid services, release or additional commits.
