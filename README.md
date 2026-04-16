```
 ███╗   ███╗███████╗███╗   ███╗ ██████╗ 
 ████╗ ████║██╔════╝████╗ ████║██╔═══██╗
 ██╔████╔██║█████╗  ██╔████╔██║██║   ██║
 ██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║
 ██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝
 ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ 
```

# Memo — a Notion-style note-taking app, built entirely by AI agents.

## About

Memo is the product being built during the [Software Factory](https://software-factory.dev) build-in-public sprint (April 13–25, 2026). The goal: ship a functional, polished note-taking app in two weeks — without a single line of human-written code.

Every line of code in this repository — every PR, every commit, every migration — is written by AI agents using [Ona](https://ona.com). Humans provide intent and direction (what to build, feature priorities, design decisions). Agents handle everything else: architecture, implementation, testing, code review, and deployment.

The repo is public so anyone can follow along, inspect the code, and see how an AI-driven software development lifecycle works in practice. The live app is at [memo.software-factory.dev](https://memo.software-factory.dev).

## Live streams

The build process is streamed live daily during the sprint.

- **Schedule:** weekdays, 5 PM BST / 12 PM ET / 9 AM PT
- **Week 1:** April 13–17 · **Week 2:** April 21–25
- **Where to watch:** [YouTube (@ona_hq)](https://www.youtube.com/@ona_hq), [X (@ona_hq)](https://x.com/ona_hq), [X (@swfactory_dev)](https://x.com/swfactory_dev)

Past streams are available on the [YouTube channel](https://www.youtube.com/@ona_hq).

## Stack

- [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Lexical](https://lexical.dev/) (rich text editor)
- [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime)
- [Sentry](https://sentry.io/) (error tracking)
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) (testing)
- Deployed on [Vercel](https://vercel.com/)

## Getting started

[![Run in Ona](https://ona.com/run-in-ona.svg)](https://app.ona.com/#https://github.com/gitpod-io/memo)

The fastest way to run Memo is in an [Ona](https://ona.com). Click the badge above, or:

1. [Add this repository to an Ona project](https://ona.com/docs/ona/create-first-project)
2. Configure the required [**project secrets**](https://ona.com/docs/ona/projects/project-secrets#project-secrets) (see below)
3. Open the environment — dependencies install automatically and the dev server starts on port 3000

### Required project secrets

Set these in your Ona project settings under **Secrets**:

| Secret | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (optional — leave empty to disable) |
| `SENTRY_DSN` | Sentry server-side DSN (optional) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps (optional) |
| `SENTRY_ORG` | Sentry organization slug (optional) |
| `SENTRY_PROJECT` | Sentry project slug (optional) |

Without Supabase secrets, the app starts but auth and data features won't work.

## Project links

- **Live app:** [memo.software-factory.dev](https://memo.software-factory.dev)
- **Landing page:** [software-factory.dev](https://software-factory.dev)
- **Background agents:** [background-agents.com](https://background-agents.com)
- **Ona:** [ona.com](https://ona.com)

---

Built with [Ona](https://ona.com)
