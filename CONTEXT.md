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

## Feature Modules
### Salary Range Workbench (`app/(dashboard)/bands/page.tsx`)
- **Route**: `/bands`
- **Data Source**: Prisma ORM (`JobFamily`, `SalaryBand`, `Employee`)
- **Math Engine**: `lib/comp-math.ts`
  - `calculateMinFromMidAndSpread` & `calculateMaxFromMinAndSpread`
  - `calculateCompaRatio`, `calculateRangePenetrationPct`, `getPayCircleStatus`
  - `calculateGreenCircleCorrectionBudget` & `calculateIncumbentImpact`
- **Key Features**:
  - Live adjustment of Midpoint ($) and Spread % (%) with synchronous boundary re-evaluation
  - Incumbent Impact Summary widget tracking Green Circle headcount & correction budget, Red Circle count, and Department Compa-Ratio
  - Interactive Incumbent Roster drilldown with real-time text search and circle status filtering
  - Transactional persistence to PostgreSQL via Server Action (`updateSalaryBands`)

