# Life Context — Candidate Use Cases and Requirements

Status: **DRAFT / DISCUSSION**, updated 2026-10-11; not a signed-off PRD. Personal-context direction is agreed; implementation scope and numeric gates remain proposals.

## User journeys (proposed order for discovery)

| ID | User journey | Candidate acceptance condition | State |
|---|---|---|---|
| J1 | Import a small curated Markdown profile | Data appears with source attribution and can be exported without loss | To verify |
| J2 | Ask Agent A for task-specific current context | Relevant, time-valid records returned within permissions and budget | To verify |
| J3 | Agent B proposes an updated research decision | Proposal remains pending; no current-truth mutation before approval | To verify |
| J4 | User approves and Agent A re-reads | A sees new decision; old decision remains historically traceable | To verify |
| J5 | User changes a file by hand | System defines deterministic propagation or explicit rejection, without silent divergence | Design choice |
| J6 | Import ChatGPT conversations | Preserve message origin, conversation ID and branch; separate raw text from extracted facts | New work |
| J7 | Restrict research agent from personal/private data | Attempts using exposed interfaces do not return forbidden content; OS-level threat scope explicit | To verify |
| J8 | Export and recover on a fresh device/directory | Confirmed state, history, evidence relationships and permission scope preserved; absent external sources explicitly reported | To verify |
| J9 | Extract context from selected chat records and user self-reports | Source speaker, time and locator preserved; direct statement and agent inference distinguished; negation/conditions retained | New work |
| J10 | Source or confirmed constraint changes | Definitely affected views updated; possibly affected analyses marked for review; unrelated context preserved | Design choice |
| J11 | Another agent submits an update from an older version | Read version checked; intervening changes visible; no silent overwrite of newer state | Design choice |

## Candidate minimum product slice

The latest direction puts personal context at the center. Project continuation remains a proposed first use case. Start with a personal card, one active project, selected short self-reports/chat excerpts, task-context reading, batched proposals, and small decision/outcome records.

Favor a bounded J1–J4/J8/J9 path with synthetic bilingual data and two explicitly supported clients. J8 is a product gate, not a late optional study. J9 can begin with pasted excerpts and manual provenance; a full ChatGPT archive adapter is not required for this first slice. J10/J11 require explicit impact/version semantics before any such behavior is advertised.

Questionnaires/profile analysis, automatic bulk capture, vector search expansion, attachment archiving, complex historical query UI, and multi-device sync remain deferred. Preserve history needed for recovery even when historical query UI is deferred.

## Proposed product screening

A four-week screening window with 6–8 development hours/week is a cost cap proposal, not an implementation-time estimate. Delete optional scope when over budget; reliability and restoration gates cannot be represented as passed by cutting checks.

Strong baseline: an actively maintained CONTEXT.md given the same information and task conditions. Across ten real continuation tasks, record explanation, review and correction time together, plus stale-context errors. Controlled contradictory/stale inputs are separate robustness checks.

Suggested initial targets: first useful read within 15 minutes; median daily maintenance <=3 minutes; net reduction in explanation/review/correction time without increased errors; fresh-directory recovery preserves state/history/relationships and reports missing sources. These numbers are design proposals, not measured results or approved release thresholds.

Stop expansion when maintenance/correction offsets the saved explanation time. Pause real use if unreviewed errors enter confirmed state and continue propagating. External adoption and willingness to pay remain unvalidated; simulated role reviews are not user interviews.

## Quality gates (proposed)

- Zero confirmed unauthorized memory disclosure in a predefined permission test set. This only covers tested paths, not full security proof.
- Zero accepted fact changes without the user-authorized update path in tests.
- An updated fact is visible to a second client after approval; superseded history remains queryable with explicit historical intent.
- Retrieval and deduplication work on distinct Chinese memories; no empty-key collapse.
- Exact test dataset, gold answers, client identities, budgets, prompts and versions are frozen before comparing architectures.
- Report latency, memory size, token use and review actions; do not assert performance improvement without baseline.

## Decisions required before architecture changes

1. Authority: Markdown/JSONL files vs SQLite with lossless export vs hybrid authority.
2. Capture: manual import, explicit session-end export, filesystem watchers, browser extension, platform connector.
3. Review: all agent writes gated vs risk-tiered auto-approval.
4. History: event stream, versioned facts, conversation archive and true deletion semantics.
5. Privacy: local-only default, remote MCP gateway, OAuth/device trust, encryption and consent model.
6. Market: CLI-first for developers vs local visual app for individuals.

## Metric definitions to refine

- Correct-current-fact rate: fraction of questions correctly answered with current verified facts.
- Temporal error rate: fraction of questions where expired/superseded content is presented as current.
- Evidence fidelity: fraction of facts traceable to correct raw sources.
- Update integrity: accepted updates present, rejected proposals absent, past versions recoverable.
- Maintenance cost: active human review minutes and number of interventions per week.
- Portability: reconstruct confirmed state, lifecycle history, evidence relationships and permission scope from documented open formats; report attachment coverage and missing sources.
- Impact correctness: distinguish definitely affected, possibly affected and unknown records; measure false/missed impact flags separately.
- Consumer version integrity: identify the version delivered to each client and detect stale proposals. A delivery receipt does not prove model understanding.

These are proposed metrics; sample sizes and thresholds require a frozen protocol before experiments.

Research hypotheses and a falsification protocol are maintained in [06-data-infrastructure.md](06-data-infrastructure.md). Product gates do not establish research novelty.
