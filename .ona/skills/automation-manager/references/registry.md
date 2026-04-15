# Automation Registry

Mapping between YAML files in `.ona/automations/` and their registered Ona automation IDs.

| YAML File | Automation Name | Ona ID |
|---|---|---|
| automation-auditor.yaml | Automation Auditor | 019d8d98-446b-7afb-907a-5b623fb180ad |
| bug-fixer.yaml | Bug Fixer | 019d8daa-712b-7ad0-b3f2-82d6f9edb8bf |
| daily-metrics.yaml | Daily Metrics | 019d8d98-3977-772e-b93a-8d94d0878a8f |
| feature-builder.yaml | Feature Builder | 019d8daa-6efc-76bb-9326-d814d0a17bdf |
| feature-planner.yaml | Feature Planner | 019d8d97-b2fd-7589-b685-e8373538c552 |
| incident-responder.yaml | Incident Responder | 019d8db6-f940-78ac-86ce-788536c849ec |
| performance-monitor.yaml | Performance Monitor | 019d8db6-fb68-7228-9e1f-9bb6719331fc |
| post-merge-verifier.yaml | Post-Merge Verifier | 019d8db6-fd99-7744-8e92-af4ab899ac57 |
| pr-reviewer.yaml | PR Reviewer | 019d8dbc-3121-7934-9594-2eddfc588e3f |
| pr-shepherd.yaml | PR Shepherd | 019d8dcc-adc3-7d23-a2b9-39aa4fbd6463 |
| tweet-drafter.yaml | Tweet Drafter | 019d8da2-46d3-7493-8bd5-7191a31f47ec |
| ui-verifier.yaml | UI Verifier | 019d8d99-7474-725b-aa77-0310122b2c64 |
| weekly-recap.yaml | Weekly Recap | 019d8d98-3e15-762d-a6e8-4ca0ea77acb5 |

## Keeping this file in sync

When you create a new automation, add its row here immediately after `ona ai automation create` returns the ID.
When you delete an automation, remove its row.
