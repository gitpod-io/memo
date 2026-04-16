---
name: development-workflow
description: >-
  Documents how feature requests and bug fixes flow through the automation
  system. Use when asked about the development process, how to submit a
  feature request, how bugs get fixed, or how the automations work together.
  Triggers on "how do I submit a feature", "how do bugs get fixed",
  "development process", "automation workflow", "how does the backlog work",
  "how are issues handled", "what automations exist".
---

# Development Workflow

## How to Submit a Feature Request

1. Create a GitHub Issue using the **Feature Request** template.
2. Fill in: description (what + why), priority, affected area.
3. The **Feature Planner** triages unlabeled issues on its next manual run:
   - If the issue has sufficient detail → labels are added (`status:backlog` +
     priority + type) and it enters the automation queue.
   - If detail is insufficient → `needs-human` label is added with a comment
     asking specific questions.
4. Respond to the questions. The **Needs-Human Requeue** automation detects
   your response (within 30 min) and removes `needs-human`.
5. The Feature Planner re-triages on its next run.
6. The **Feature Builder** picks up `status:backlog` issues and implements them.

## How to Report a Bug

1. Create a GitHub Issue using the **Bug Report** template.
2. Fill in: description, steps to reproduce, expected vs actual, priority.
3. Same triage flow as features (Feature Planner → labels → queue).
4. The **Bug Fixer** picks up `bug` + `status:backlog` issues and fixes them.

## How Bugs Get Fixed Automatically

Several automations detect bugs and create issues:

| Source | Automation | What it detects |
|---|---|---|
| Production errors | Incident Responder | Sentry errors (every 15 min) |
| Post-deploy regressions | Post-Merge Verifier | Smoke test failures (on PR merge) |
| Design violations | UI Verifier | Design spec mismatches (on PR merge) |
| Performance degradation | Performance Monitor | Latency/error/size regressions (weekly) |

These automations create issues with `bug` + `status:backlog` labels. The Bug Fixer
picks them up, implements a fix, and opens a PR. The PR Reviewer reviews and merges.

## How Features Get Built Automatically

1. **Feature Planner** (manual trigger) triages unlabeled issues or decomposes
   the product spec into new issues with `status:backlog` labels.
2. **Feature Builder** (cron, every 30 min) picks up the highest-priority
   non-bug `status:backlog` issue, implements it, and opens a PR.
3. **PR Reviewer** (cron, every 15 min) reviews the PR, fixes CI failures
   if needed, and merges.

## The Full Automation Roster

| Automation | Trigger | Role |
|---|---|---|
| Feature Planner | Manual | Triages unlabeled issues, decomposes specs into issues |
| Feature Builder | Cron (30 min) | Implements features/enhancements from backlog |
| Bug Fixer | Cron (30 min) | Implements bug fixes from backlog |
| PR Reviewer | Cron (15 min) | Reviews and merges PRs |
| PR Shepherd | Cron (6 hours) | Cleans up stale/conflicted PRs |
| Incident Responder | Cron (15 min) | Triages Sentry errors into bug issues |
| Post-Merge Verifier | On PR merge | Smoke-tests production after merge |
| UI Verifier | On PR merge | Checks design spec compliance |
| Performance Monitor | Weekly | Checks latency, errors, build size |
| Needs-Human Requeue | Cron (30 min) | Re-queues issues after user responds |
| Automation Auditor | Weekly | Audits label hygiene, doc freshness |
| Daily Metrics | Daily | Snapshots project metrics |
| Weekly Recap | Weekly | Summarizes week's progress |

## Label Reference

### Status labels (lifecycle)
- `status:backlog` — ready for automation pickup
- `status:in-progress` — being worked on by an automation or human
- `status:in-review` — PR open, awaiting review
- `status:done` — completed and merged

### Priority labels
- `priority:1` — foundation (blocks other work)
- `priority:2` — core features (product value)
- `priority:3` — polish (nice to have)

### Type labels
- `feature` — new functionality
- `enhancement` — improvement to existing functionality
- `bug` — defect or regression
- `chore` — internal quality, no user-visible change
- `performance` — performance-related issue

### Flag labels
- `needs-human` — needs user input; re-queue automation removes when user responds
- `ona-user` — PR created via interactive Ona session (no issue reference required)

## Issue Lifecycle

```
Created (unlabeled)
  → Feature Planner triages
    → Sufficient: status:backlog + priority + type
      → Feature Builder / Bug Fixer implements
        → status:in-progress
          → PR opened
            → status:in-review
              → PR Reviewer merges
                → status:done
    → Insufficient: needs-human + questions
      → User responds
        → Needs-Human Requeue removes needs-human
          → Feature Planner re-triages
```
