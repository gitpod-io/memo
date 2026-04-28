# Automation Registry

Mapping between YAML files in `.ona/automations/` and their registered Ona automation IDs.

All automations execute as the `sw-factory-automations` service account (`019dd3fd-60b4-7cb3-888d-7a1223eb04f7`).

| YAML File | Automation Name | Ona ID |
|---|---|---|
| automation-auditor.yaml | Automation Auditor | 019dd418-58cf-7257-bd54-fa7fc9e9567c |
| bug-fixer.yaml | Bug Fixer | 019dd419-ba3f-730b-adb4-b6a0ddb6b51b |
| daily-metrics.yaml | Daily Metrics | 019dd419-cf92-751f-b023-1fa333dd0e74 |
| feature-builder.yaml | Feature Builder | 019d8daa-6efc-76bb-9326-d814d0a17bdf |
| feature-planner.yaml | Feature Planner | 019d8d97-b2fd-7589-b685-e8373538c552 |
| feedback-digest.yaml | Feedback Digest | 019dd419-f1c2-7ccb-9e56-d6d6d5dafe4a |
| incident-responder.yaml | Incident Responder | 019dd41a-6f97-77f9-9236-5fd6d1b608ab |
| needs-human-requeue.yaml | Needs-Human Requeue | 019dd41a-b116-79e2-be1a-be07221d4b1b |
| performance-monitor.yaml | Performance Monitor | 019dd41a-c52d-703a-88a0-bb3d3e51cc46 |
| post-merge-verifier.yaml | Post-Merge Verifier | 019dd41a-fd52-746b-aa5a-6800ed7f8d59 |
| pr-reviewer.yaml | PR Reviewer | 019dd424-3592-72e5-a5ba-666569f2f71b |
| pr-shepherd.yaml | PR Shepherd | 019dd41b-79eb-7b05-91e5-fa5f10706ed2 |
| product-improver.yaml | Product Improver | 019dd41b-1150-78d6-9eb3-2aa5fbfd566f |
| stale-issue-reviewer.yaml | Stale Issue Reviewer | 019dd41b-943b-7116-8c0c-a50c7b51ac6f |
| tweet-drafter.yaml | Tweet Drafter | 019dd41b-ab60-7b33-b7cc-ca86d2fc5387 |
| ui-verifier.yaml | UI Verifier | 019dd41b-e319-78cc-91ae-ca03087ec812 |
| weekly-recap.yaml | Weekly Recap | 019dd41b-f727-7a6b-bf84-231781903a01 |

## Keeping this file in sync

When you create a new automation, add its row here immediately after `ona ai automation create` returns the ID.
When you delete an automation, remove its row.
