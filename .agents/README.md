# Agent Knowledge Base

This directory is the system of record for agent context. AGENTS.md in the repo root
is the entry point and routing table — it points here for details.

Agents: start with AGENTS.md, then read the relevant file here before working.

## Contents

| File | Purpose | When to read |
|---|---|---|
| `architecture.md` | System design, data model, component map | Before making structural changes or adding new features |
| `conventions.md` | Coding patterns with examples | Before writing any new code |
| `quality.md` | Quality grades per domain, known gaps | When deciding what to improve |
| `plans/active/` | Current feature plans | Before picking up work |
| `plans/completed/` | Done plans (context on past decisions) | When you need to understand why something was built a certain way |

## How to update these files

- `architecture.md` — update when adding new system components, changing data model, or making infrastructure decisions
- `conventions.md` — update when a new coding pattern emerges that should be replicated, or when an anti-pattern is discovered
- `quality.md` — updated weekly by the Automation Auditor, or manually after significant changes
- Plans move from `active/` to `completed/` when all issues in the plan are closed
