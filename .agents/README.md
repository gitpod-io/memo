# Agent Knowledge Base

This directory is the system of record for agent context. AGENTS.md in the repo root
is the entry point and routing table — it points here for details.

Agents: start with AGENTS.md, then read the relevant file here before working.

## Contents

| File | Purpose | When to read |
|---|---|---|
| `architecture.md` | System design, data model, component map | Before making structural changes or adding new features |
| `conventions.md` | Coding patterns with examples | Before writing any new code |
| `design.md` | Visual design spec — colors, typography, spacing, components, interactions | Before implementing or reviewing any UI |
| `quality.md` | Quality grades per domain, known gaps | When deciding what to improve |
| `plans/active/` | Current feature plans | Before picking up work |
| `plans/completed/` | Done plans (context on past decisions) | When you need to understand why something was built a certain way |

## How Agents Should Use This

1. Read `AGENTS.md` for rules and project structure.
2. Read `architecture.md` for system context and data model.
3. Read `design.md` before implementing or reviewing any UI.
4. Read `conventions.md` for coding patterns and examples.
5. Check `quality.md` to understand current state and known gaps.
6. Check `plans/active/` for current work in progress.

## How to update these files

- `architecture.md` — update when adding new system components, changing data model, or making infrastructure decisions
- `conventions.md` — update when a new coding pattern emerges that should be replicated, or when an anti-pattern is discovered
- `design.md` — update when introducing a new UI pattern, component variant, or interaction pattern not covered by the existing spec
- `quality.md` — updated weekly by the Automation Auditor, or manually after significant changes
- Plans move from `active/` to `completed/` when all issues in the plan are closed
