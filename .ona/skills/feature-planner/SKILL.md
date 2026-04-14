---
name: feature-planner
description: >-
  Decompose the product vision into a prioritized backlog of GitHub Issues.
  Reads the product spec, creates issues with acceptance criteria and
  dependency chains, and sets up labels for the autonomous Feature Builder.
  Use when starting a new product, adding a new feature area, or
  re-planning after a scope change.
  Triggers on "plan features", "create backlog", "decompose spec",
  "what should we build", "create issues", "plan the product".
---

# Feature Planner

## When to Use

- Starting a new product from a spec
- Adding a new feature area to an existing product
- Re-planning after scope changes or user feedback

## Workflow

### Step 1: Read Context

1. Read `AGENTS.md` for tech stack and conventions.
2. Read `docs/product-spec.md` for the product vision, scope boundaries, and feature priority.
3. Read `.agents/architecture.md` for the data model and system design.
4. List existing GitHub Issues: `gh issue list --state all --json number,title,state,labels`
5. Identify what's already planned, in progress, or done.

### Step 2: Ensure Labels Exist

Create these labels if they don't exist:

```bash
gh label create "status:backlog" --color 0E8A16 --force
gh label create "status:in-progress" --color 1D76DB --force
gh label create "status:in-review" --color FBCA04 --force
gh label create "status:done" --color 6F42C1 --force
gh label create "priority:1" --color B60205 --force
gh label create "priority:2" --color FF9F1C --force
gh label create "priority:3" --color 0E8A16 --force
gh label create "feature" --color A2EEEF --force
gh label create "enhancement" --color A2EEEF --force
gh label create "chore" --color FEF2C0 --force
gh label create "bug" --color D73A4A --force
gh label create "performance" --color F9D0C4 --force
```

### Step 3: Decompose into Issues

For each feature, create a GitHub Issue. Each issue must be:
- **Single-concern**: one independently implementable feature, resulting in one PR
- **Ordered by dependency**: foundational features first (auth, DB schema, layout)
- **Sized for one session**: an agent should be able to implement it in a single run

#### Issue Template

```markdown
## Description
One paragraph: what this feature does and why a user cares.

## Acceptance Criteria
- [ ] Criterion 1 (user-visible behavior)
- [ ] Criterion 2
- [ ] Criterion 3

## Dependencies
Depends on #N, #M (or "None")

## Technical Notes
- Implementation hints, relevant files, patterns to follow
- Reference .agents/conventions.md for component patterns
- Reference .agents/architecture.md for data model
```

#### Labels

Each issue gets exactly 3 labels:
- **Status**: `status:backlog`
- **Priority**: `priority:1` (foundation), `priority:2` (core features), `priority:3` (polish/stretch)
- **Type**: `feature`, `enhancement`, or `chore`

#### Priority Guidelines

| Priority | What belongs here | Examples |
|---|---|---|
| `priority:1` | Foundation — nothing else works without this | Auth, workspace CRUD, page CRUD, DB schema, app layout/navigation |
| `priority:2` | Core features — the product's value | Block editor, slash commands, nested pages, search, realtime |
| `priority:3` | Polish and stretch goals | Dark mode, responsive design, markdown import/export, member management |

### Step 4: Present the Plan

After creating all issues, present a summary to the user:

```markdown
## Feature Plan Summary

**Total issues created**: N
**By priority**: P1: X, P2: Y, P3: Z

### Suggested Implementation Order
1. #N — Title (P1, no deps)
2. #M — Title (P1, depends on #N)
3. ...

### Ambiguities / Questions for Human
- [Any unclear requirements from the spec]
- [Any scope decisions that need human input]
```

Wait for the user to review, reorder, or adjust before the Feature Builder starts picking up issues.

## Anti-patterns

- Do NOT create issues that bundle multiple unrelated changes
- Do NOT create issues for infrastructure that already exists (check the codebase)
- Do NOT create overly granular issues (e.g., "add import statement") — each should be a meaningful feature
- Do NOT create issues without acceptance criteria — the Feature Builder needs them to know when it's done
- Do NOT assign priority:1 to non-foundational features — P1 means "blocks other work"
