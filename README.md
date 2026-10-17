# NextComp — Enterprise Total Rewards & Compensation Intelligence Engine

[![Next.js](https://img.shields.io/badge/Next.js-15.5.25-black?style=flat&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6.19%20%2B%20pgvector-2D3748?style=flat&logo=prisma)](https://prisma.io)
[![Trigger.dev](https://img.shields.io/badge/Trigger.dev-v3%20Workers-00F2FE?style=flat)](https://trigger.dev)
[![Vercel AI SDK](https://img.shields.io/badge/AI%20SDK-OpenAI%20gpt--4o%20%7C%20text--embedding--3--large-000000?style=flat&logo=openai)](https://sdk.vercel.ai)
[![Vitest](https://img.shields.io/badge/Vitest-5.0.0-729B1B?style=flat&logo=vitest)](https://vitest.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)

**NextComp** is an enterprise total rewards intelligence platform and compensation calculation engine designed for modern people teams, compensation committees, and financial modelers. It unifies deterministic mathematical compensation formulas, pgvector semantic search over market survey benchmarks, and asynchronous AI-driven job duty evaluation.

---

## 🏛️ Core Architecture & Capabilities

### 1. Deterministic Compensation Math Engine (`lib/comp-math.ts`)
TypeScript functions for these standard total rewards formulas, checked by 51 unit tests in `tests/comp-math.test.ts`:
- **Midpoint & Spread Reciprocal Invariants**:
  $$\text{Min} = \frac{\text{Mid}}{1 + \frac{\text{Spread}}{2}}, \quad \text{Max} = \text{Min} \times (1 + \text{Spread})$$
  $$\text{Spread} = \frac{\text{Max} - \text{Min}}{\text{Min}}, \quad \text{Mid} = \frac{\text{Min} + \text{Max}}{2}$$
- **Compa-Ratio**:
  $$\text{Compa-Ratio} = \frac{\text{Base}}{\text{Midpoint}}$$
- **Range Penetration**:
  $$\text{Range Penetration} = \frac{\text{Base} - \text{Min}}{\text{Max} - \text{Min}} \quad (\times 100\%)$$
- **Boundary Conditions & Pay Circle Classification**:
  - **Green-Circle**: $\text{Base} < \text{Min}$ (flagged for upward equity/merit adjustment)
  - **In-Range**: $\text{Min} \le \text{Base} \le \text{Max}$ (compliant within band)
  - **Red-Circle**: $\text{Base} > \text{Max}$ (flagged for salary freeze or executive exception governance)
- **Incumbent Impact & Correction Budget Formulas**:
  $$\text{Green Circle Correction Budget} = \sum_{i \in \text{GreenCircle}} (\text{Min}_i - \text{Base}_i)$$
  $$\text{Average Department Compa-Ratio} = \frac{1}{|D|} \sum_{j \in D} \frac{\text{Base}_j}{\text{Mid}_j}$$

### 2. Interactive Salary Range Workbench (`app/(dashboard)/bands/page.tsx`)
Full-featured, reactive compensation modeling workbench built with Next.js 15 App Router and Server Actions:
- **Hierarchical Band Grouping**: Displays all 18 salary bands grouped across Job Families (Engineering `ENG`, Product `PROD`, Design `DSGN`) and career levels (`IC1` through `IC6`).
- **Immediate Recalculation Engine**: Dynamic inputs for **Midpoint** ($) and **Spread %** (%) with instant, client-side re-computation of range minimums and maximums using `calculateMinFromMidAndSpread` and `calculateMaxFromMinAndSpread`.
- **Incumbent Impact Summary Widget**:
  - **Employees Below Min (Green Circle)**: Glowing emerald indicator highlighting total headcount below band minimums, percentage of active workforce, and the exact dollar **Budget Required to Correct** to bring underpaid employees to band minimums.
  - **Employees Above Max (Red Circle)**: Glowing rose indicator tracking headcount exceeding salary band maximums, flagged for salary freeze governance and VP exception approvals.
  - **Department Compa-Ratio Telemetry**: High-level organization average compa-ratio index (target: 1.000 / 100%) alongside departmental breakdown cards comparing average compa-ratios, underpaid headcount, and overpaid headcount.
- **Incumbent Roster Drilldown**:
  - Live employee list tracking each incumbent's current base, target midpoint, live compa-ratio %, band bounds, range penetration %, circle status badge, and correction delta.
  - Real-time search and circle status filter pills (`All`, `Green Circle`, `In Range`, `Red Circle`).
- **Modeling Presets & Persistence**:
  - Quick presets: `+3% Mid`, `+5% Mid` (cost of living / market inflation adjustments), `40% Spread`, `50% Spread` (spread normalization).
  - Single-row reset (`RotateCcw`), global `Reset All`, and transactional database persistence via `updateSalaryBands` Server Action.

### 3. Asynchronous AI Batch Job Matching Task (`app/trigger/batch-job-match.ts`)
High-throughput background task built on **Trigger.dev v3** and **Vercel AI SDK**:
- **Ingestion & Embedding**: Ingests internal job descriptions, titles, and responsibilities, generating dense 1536-dimensional vectors using `text-embedding-3-large`.
- **Vector Nearest Neighbors (`<=>`)**: Executes raw SQL with pgvector's cosine distance operator `<=>` against the `SurveyBenchmark` table to retrieve top 5 market candidates in real-time.
- **WorldatWork 80% Duty Match Evaluation**: Runs structured LLM evaluations with `gpt-4o` and Zod validation, verifying whether $\ge 80\%$ of functional duties align with external benchmark candidates.
- **Persistent Mapping**: Upserts audit records into `JobBenchmarkMapping` with statistical confidence scores, structured rationales, and calibrated weighting.

### 4. Relational & Vector Persistence (`prisma/schema.prisma`)
- **PostgreSQL 16 + pgvector**: Native 1536-dim vector indexing on `JobRole` and `SurveyBenchmark`.
- **Multi-Tenant Total Rewards Data Model**: Organizations, Job Families, Job Roles, Market Survey Benchmarks, Geographic Salary Bands (`US_ZONE_1`, `US_ZONE_2`, `US_ZONE_3`), Employee Rosters, and Merit Allocation Cycles.

---

## 🧪 Comprehensive Vitest Test Suite

All mathematical invariants, edge cases, incumbent impact formulas, and background task pipelines are covered with test suites in `tests/`:

```bash
pnpm test
```

- **`tests/comp-math.test.ts`**: 51 unit tests covering spread calculations, midpoint symmetry, compa-ratio calculations, range penetration bounds, strict green/red circle inequality checks, green circle correction budget calculations, and dynamic incumbent impact evaluations.
- **`tests/batch-job-match.test.ts`**: 5 end-to-end integration tests validating Zod payload validation, pgvector `<=>` cosine distance sorting, and database persistence.
- **Total: 56 tests**. 5 of them need a local Postgres.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 10+
- PostgreSQL with `pgvector` extension enabled

### Environment Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@127.0.0.1:5432/nextcomp?schema=public"
OPENAI_API_KEY="your-openai-api-key"
```

### Installation & Database Seeding
```bash
# Install dependencies
pnpm install

# Run database seed (Job families, IC1-IC6 roles, survey benchmarks, salary bands)
pnpm prisma db push
pnpm prisma db seed
```

### Running Tests & Quality Checks
```bash
# Execute unit & integration test suites
pnpm test

# Run ESLint
pnpm lint

# TypeScript strict type check
pnpm tsc --noEmit
```

### Development Server
```bash
pnpm dev
```
- Open [http://localhost:3000](http://localhost:3000) for the Executive Telemetry Console.
- Open [http://localhost:3000/bands](http://localhost:3000/bands) to access the interactive **Salary Range Workbench**.

