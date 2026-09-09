# NEXTCOMP ARCHITECTURE & GUARDRAILS (CONTEXT.md)

## Tech Stack
- Framework: Next.js 15 (App Router, Server Actions)
- Database: PostgreSQL with pgvector extension via Prisma ORM
- Background Worker: Trigger.dev v3
- Styling: Tailwind CSS v4, Lucide Icons, Radix UI Primitives
- AI: Vercel AI SDK (@ai-sdk/openai, text-embedding-3-large, gpt-4o)

## Brand Identity Tokens
- Primary Navy Canvas: #0A0F1D (Cards: #131B2E, Borders: #1E2A47)
- Cyan Terminal Accent: #00F2FE (Command chevron, active borders)
- Emerald Growth Accent: #00E599 (Upward arrow, positive deltas)

## Engineering Rules
1. Zero unnecessary libraries: Whitelist = [prisma, @trigger.dev/sdk, ai, @ai-sdk/openai, zod, lucide-react, tailwindcss].
2. Always write unit tests in Vitest before implementing complex compensation formulas.
3. Every long-running task (>5s) must be an asynchronous Trigger.dev task.
