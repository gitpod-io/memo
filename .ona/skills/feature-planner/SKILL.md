---
name: feature-planner
description: >-
  Triage unlabeled GitHub Issues, decompose product specs into backlog items,
  and ensure issue quality for the automation loop. Reads the product spec,
  triages user-created issues, creates issues with acceptance criteria and
  dependency chains, and sets up labels for the autonomous Feature Builder.
  Use when starting a new product, adding a new feature area, re-planning
  after a scope change, or triaging incoming feature requests and bug reports.
  Triggers on "plan features", "create backlog", "decompose spec",
  "what should we build", "create issues", "plan the product",
  "triage issues", "review backlog".
---

# Feature Planner

## When to Use

- Starting a new product from a spec
- Adding a new feature area to an existing product
- Re-planning after scope changes or user feedback
- Triaging unlabeled GitHub Issues (user-created feature requests and bugs)

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

## Continuous Improvement: Triaging Unlabeled Issues

After the initial product spec is implemented, the Feature Planner's primary role
shifts to triaging incoming issues. Users and automations create GitHub Issues that
need to be assessed and labeled before the Feature Builder or Bug Fixer can act.

### Triage Workflow

1. Find open issues with NO `status:*` label and NO `needs-human` label.
2. For each issue, assess quality:
   - **Sufficient detail** (clear what/why, testable definition of done):
     - Enrich the body if needed (add Acceptance Criteria, Technical Notes)
     - Add 3 labels: `status:backlog` + `priority:*` + type
   - **Insufficient detail:**
     - Add `needs-human` label
     - Post a comment with specific questions (what, why, context)
3. Do NOT remove `needs-human` from issues — the Needs-Human Requeue automation
   handles that when the user responds.

### The `needs-human` Feedback Loop

1. Feature Planner adds `needs-human` + questions to an insufficient issue
2. User responds with the requested information
3. Needs-Human Requeue automation (cron, every 30 min) detects the response
   and removes `needs-human`
4. Feature Planner re-triages the issue on its next manual run

### Issue Quality Checklist

Every issue entering the backlog must have:
- [ ] Description: what and why
- [ ] Acceptance Criteria: testable checkboxes
- [ ] Dependencies: explicit issue refs or "None"
- [ ] Technical Notes: relevant files, patterns, edge cases
- [ ] 3 labels: status + priority + type

## Anti-patterns

- Do NOT create issues that bundle multiple unrelated changes
- Do NOT create issues for infrastructure that already exists (check the codebase)
- Do NOT create overly granular issues (e.g., "add import statement") — each should be a meaningful feature
- Do NOT create issues without acceptance criteria — the Feature Builder needs them to know when it's done
- Do NOT assign priority:1 to non-foundational features — P1 means "blocks other work"
- Do NOT triage issues that already have a `status:*` label — they're already in the workflow
- Do NOT remove `needs-human` — that's the re-queue automation's job
