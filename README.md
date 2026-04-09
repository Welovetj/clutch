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
	- persistent chat history in browser storage

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

Prediction mode returns a structured prediction card with confidence, rationale, risk flags, recommended stake %, and time horizon.
