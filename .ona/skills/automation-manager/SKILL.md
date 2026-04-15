---
name: automation-manager
description: >-
  Create, update, and sync Ona automations. Ensures YAML files in
  .ona/automations/ stay in sync with the live Ona automation registry.
  Use when creating a new automation, modifying triggers or prompts,
  deleting an automation, or auditing drift between YAML and live state.
  Triggers on "create automation", "update automation", "delete automation",
  "sync automations", "register automation", "automation drift",
  "add a new automation", "change automation triggers".
---

# Automation Manager

Automations have two representations that must stay in sync:

1. **YAML file** in `.ona/automations/<name>.yaml` — version-controlled source of truth.
2. **Live registration** in Ona — the runtime configuration that actually triggers executions.

Editing only the YAML does nothing. Registering only via CLI loses version history.
Every change must update both.

## Authentication

The environment principal cannot manage automations. Authenticate with the user PAT:

```bash
ona login --token "$ONA_PAT"
```

Restore the environment context when done:

```bash
ona config context use environment
```

## Creating a new automation

1. Generate the example syntax for reference:
   ```bash
   ona ai automation create --example
   ```

2. Create the YAML file at `.ona/automations/<name>.yaml`. Follow the structure of
   existing automations in that directory. Required fields: `name`, `description`,
   `triggers`, `action.limits`, `action.steps`.

3. Register it:
   ```bash
   ona login --token "$ONA_PAT"
   ona ai automation create .ona/automations/<name>.yaml
   ```
   The CLI prints the new automation ID.

4. Add the new entry to `references/registry.md` with the YAML filename, name, and ID.

5. Restore context:
   ```bash
   ona config context use environment
   ```

6. Commit both the YAML file and the updated registry.

## Updating an existing automation

1. Look up the automation ID in `references/registry.md`.

2. Edit the YAML file.

3. Push the update to Ona:
   ```bash
   ona login --token "$ONA_PAT"
   ona ai automation update <automation-id> .ona/automations/<name>.yaml
   ```

4. Verify the update took effect:
   ```bash
   ona ai automation get <automation-id> -o json | jq '.[0].spec.triggers'
   ```

5. Restore context:
   ```bash
   ona config context use environment
   ```

6. Commit the YAML change.

## Deleting an automation

1. Look up the automation ID in `references/registry.md`.

2. Delete from Ona:
   ```bash
   ona login --token "$ONA_PAT"
   ona ai automation delete <automation-id>
   ```

3. Delete the YAML file.

4. Remove the row from `references/registry.md`.

5. Restore context and commit.

## Auditing drift

Compare YAML files against live registrations to find mismatches.

1. List live automations:
   ```bash
   ona login --token "$ONA_PAT"
   ona ai automation list -o json | jq '[.[] | {id: .id, name: .metadata.name}]'
   ```

2. List YAML files:
   ```bash
   ls .ona/automations/*.yaml
   ```

3. Check for:
   - YAML files with no matching live automation (unregistered).
   - Live automations with no matching YAML file (untracked).
   - Name mismatches between YAML `name:` field and live `metadata.name`.

4. For each unregistered YAML: run `ona ai automation create`.
5. For each untracked live automation: either create the YAML or delete the live registration.
6. Update `references/registry.md` with any changes.

## Trigger design rules

These rules prevent the race conditions that caused duplicate PRs (#45/#46, #40/#41):

- **One trigger type per automation.** Use either cron OR webhook, not both.
  The cron alone is sufficient — a 10-minute delay after a merge is acceptable.
- **`maxParallel: 1`** on all automations. This is necessary but not sufficient
  (the platform has a TOCTOU window during environment startup).
- **Prompt-level guards** are defense-in-depth, not primary protection. The prompt
  should check for existing work (open PRs, in-progress labels) but cannot
  guarantee mutual exclusion.

## YAML structure reference

```yaml
name: Human-readable name
description: One-line description of what the automation does.
triggers:
    - context:
        projects:
            projectIds:
                - 019d8bf4-1ded-7317-be2f-555e8fb55ff9
      time:
        cronExpression: "*/10 * * * *"
    - context:
        projects:
            projectIds:
                - 019d8bf4-1ded-7317-be2f-555e8fb55ff9
      manual: {}
action:
    limits:
        maxParallel: 1
        maxTotal: 50
    steps:
        - agent:
            prompt: |
                Your prompt here.
```

Trigger types (use only one per automation, plus manual):
- `time.cronExpression` — cron schedule
- `pullRequest.events` — webhook events (avoid combining with cron)
- `manual` — always include for manual runs

## Reference files

- `references/registry.md` — Read when you need to look up an automation ID or check
  which automations are registered.
