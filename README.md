# Clutch

Premium sports betting tracker built with Next.js App Router, TypeScript, and Tailwind CSS.

## Stack

- Next.js (latest) with App Router
- TypeScript
- Tailwind CSS v4
- Route middleware for auth gating

## Folder Structure

- app/: routes, layouts, pages, and API handlers
- components/: reusable UI and shell components
- lib/: data models, mock data, and formatting helpers
- public/: static assets

## Key Features Implemented

- Authenticated app shell with sidebar + topbar
- Supabase email/password auth with signup and login
- User name and email shown in dashboard topbar
- Dashboard routes:
	- /dashboard
	- /dashboard/bets
	- /dashboard/bankroll
	- /dashboard/analytics
- Supabase-backed data API routes:
	- GET /api/bets
	- GET /api/bankroll
	- GET /api/analytics
- Interactive data mutations:
	- POST/PATCH /api/bets
	- POST /api/bankroll
- Premium dark-only brand system with matte gold accent and dense data UI
- AI assistant panel in dashboard (OpenRouter-powered) for:
	- bet note summarization
	- natural-language analytics queries
	- insights over live betting history
	- a visible multi-agent workflow with Auto Router, General Analyst, Prediction Lab, Bankroll Coach, Recap Writer, and Watchlist Scout

## Supabase Setup

Run the SQL in supabase/schema.sql in the Supabase SQL editor for your project. This creates:

- public.bets
- public.bankroll_snapshots
- row-level security policies for per-user access

If the schema has not been run yet, the dashboard stays empty and shows a setup notice until the tables are available.

## Auth (Mock)

Auth is powered by Supabase email/password sign in.

## Scripts

- npm run dev
- npm run build
- npm run start
- npm run lint

## AI Setup (OpenRouter)

Set `OPENROUTER_API_KEY` in `.env.local`.

The assistant runs at `POST /api/ai/chat` and is available from the floating panel in dashboard routes.

Cross-device chat history is persisted in `public.ai_chat_messages` (created by `supabase/schema.sql`) and exposed by `GET/DELETE /api/ai/history`.

Prediction Lab returns a structured prediction card with confidence, rationale, risk flags, recommended stake %, and time horizon.

The Bankroll Coach focuses on exposure and stake sizing, the Recap Writer produces concise performance summaries, and the Watchlist Scout reviews tracked teams and segment trends. Each agent now keeps its own chat thread using the `mode` field in `public.ai_chat_messages`.

The Auto Workflow mode adds explicit orchestration:

- Router agent chooses the primary specialist from the user's message and data summary.
- Conditional branch 1: watchlist or recap requests fall back to General Analyst when the required data is insufficient.
- Conditional branch 2: prediction or risky portfolio situations trigger a Bankroll Coach review branch.
- The UI now shows a workflow trace so the agent path is visible during demos and grading.
