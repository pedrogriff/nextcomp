import Link from "next/link";
import {
  Terminal,
  ChevronRight,
  TrendingUp,
  ArrowUpRight,
  Coins,
  Activity,
  CheckCircle2,
  Layers,
  Cpu,
  ShieldCheck,
} from "lucide-react";

interface KpiMetric {
  title: string;
  value: string;
  delta: string;
  deltaLabel: string;
  caption: string;
  icon: React.ComponentType<{ className?: string }>;
}

const KPI_DATA: KpiMetric[] = [
  {
    title: "Total Equity Modeled",
    value: "$428.5M",
    delta: "+18.4%",
    deltaLabel: "vs prev quarter",
    caption: "4,250,000 RSUs actively modeled across 12 tranches",
    icon: Coins,
  },
  {
    title: "Comp Band Compliance",
    value: "98.6%",
    delta: "+2.1%",
    deltaLabel: "parity index",
    caption: "Automated real-time audit against geo-benchmarks",
    icon: Activity,
  },
  {
    title: "Retention Schedule Yield",
    value: "33/33/22/12",
    delta: "+14.2%",
    deltaLabel: "talent lock-in",
    caption: "Front-loaded vesting curve optimized for senior staff",
    icon: TrendingUp,
  },
  {
    title: "Sim Engine Throughput",
    value: "14.2ms",
    delta: "0 errors",
    deltaLabel: "pgvector query",
    caption: "Trigger.dev v3 asynchronous queue operational",
    icon: CheckCircle2,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-navy-canvas text-slate-100 flex flex-col selection:bg-terminal-cyan/20 selection:text-terminal-cyan">
      {/* Top Terminal Navigation Bar */}
      <header className="border-b border-navy-border bg-navy-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-navy-canvas border border-navy-border flex items-center justify-center text-terminal-cyan shadow-[0_0_12px_rgba(0,242,254,0.15)]">
              <Terminal className="h-5 w-5" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-mono text-lg font-bold tracking-tight text-white">
                Next<span className="text-terminal-cyan">Comp</span>
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-navy-canvas border border-navy-border text-terminal-cyan">
                v1.0.0
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-400">
            <Link href="/bands" className="text-terminal-cyan font-mono hover:text-terminal-cyan/80 transition-colors flex items-center space-x-1">
              <span className="text-xs">&gt;</span>
              <span>Bands Workbench</span>
            </Link>
            <a href="#kpis" className="hover:text-terminal-cyan transition-colors">
              Metrics
            </a>
            <a href="#terminal" className="hover:text-terminal-cyan transition-colors">
              Console
            </a>
            <a href="#architecture" className="hover:text-terminal-cyan transition-colors">
              Architecture
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-navy-canvas border border-navy-border text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-growth-emerald animate-pulse"></span>
              <span className="text-slate-300">Cluster 10.0.0.170: READY</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-12">
        {/* Hero Section */}
        <section className="space-y-6 text-center max-w-3xl mx-auto pt-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-navy-card border border-navy-border text-xs font-mono text-terminal-cyan shadow-sm">
            <ChevronRight className="h-3.5 w-3.5 text-terminal-cyan" />
            <span>ALGORITHMIC COMPENSATION ARCHITECTURE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Deterministic modeling for modern tech compensation.
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Execute front-loaded vesting simulations, enforce real-time salary band compliance,
            and leverage pgvector embeddings with zero unnecessary overhead.
          </p>

          {/* Interactive Terminal Bar */}
          <div className="pt-2 max-w-2xl mx-auto">
            <div className="rounded-xl border border-navy-border bg-navy-card p-3 shadow-2xl flex items-center space-x-3 font-mono text-sm text-left group focus-within:border-terminal-cyan transition-colors">
              <span className="text-terminal-cyan font-bold select-none">&gt;</span>
              <span className="text-slate-200 flex-1 overflow-x-auto whitespace-nowrap">
                nextcomp simulate --shares=1500 --schedule=FRONT_LOADED_33_33_22_12
              </span>
              <span className="inline-block w-2 h-4 bg-terminal-cyan animate-pulse"></span>
              <button
                type="button"
                className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-navy-canvas border border-navy-border hover:border-terminal-cyan text-xs text-slate-300 hover:text-terminal-cyan transition-all"
              >
                <span>RUN</span>
              </button>
            </div>
          </div>
        </section>

        {/* KPI Cards Grid */}
        <section id="kpis" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <span className="text-terminal-cyan">&gt;&gt;</span>
              <span>Platform KPI Telemetry</span>
            </h2>
            <span className="text-xs font-mono text-slate-500">Auto-refreshing: 5s interval</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {KPI_DATA.map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={idx}
                  className="rounded-xl bg-navy-card border border-navy-border p-5 space-y-4 hover:border-terminal-cyan/60 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,242,254,0.06)] group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                      {kpi.title}
                    </span>
                    <div className="h-8 w-8 rounded-lg bg-navy-canvas border border-navy-border flex items-center justify-center text-terminal-cyan group-hover:border-terminal-cyan/40 transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-3xl font-bold font-mono tracking-tight text-white">
                      {kpi.value}
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs font-mono">
                      <span className="inline-flex items-center text-growth-emerald font-semibold">
                        <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                        {kpi.delta}
                      </span>
                      <span className="text-slate-500">{kpi.deltaLabel}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 border-t border-navy-border/60 pt-3 leading-relaxed">
                    {kpi.caption}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* NextComp Terminal Execution Shell */}
        <section id="terminal" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <span className="text-terminal-cyan">&gt;&gt;</span>
              <span>Live Engine Console</span>
            </h2>
            <div className="flex items-center space-x-2 text-xs font-mono text-growth-emerald">
              <span className="h-1.5 w-1.5 rounded-full bg-growth-emerald"></span>
              <span>DAEMON ACTIVE</span>
            </div>
          </div>

          <div className="rounded-xl border border-navy-border bg-navy-card overflow-hidden shadow-2xl">
            {/* Terminal Window Chrome */}
            <div className="bg-navy-canvas/90 px-4 py-3 border-b border-navy-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-growth-emerald/80"></div>
                <span className="text-xs font-mono text-slate-400 ml-2">
                  worker-session: comp-sim-engine.local
                </span>
              </div>
              <div className="text-xs font-mono text-terminal-cyan">
                PROTOCOL: FAST-MCP/TRIGGER.DEV
              </div>
            </div>

            {/* Terminal Code/Log Content */}
            <div className="p-5 font-mono text-xs space-y-2.5 bg-navy-card text-slate-300 overflow-x-auto">
              <div className="flex items-center space-x-2 text-slate-500">
                <span>[10:04:12]</span>
                <span className="text-terminal-cyan">SYS</span>
                <span>Connecting to PostgreSQL vector store via Prisma ORM...</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-500">
                <span>[10:04:13]</span>
                <span className="text-terminal-cyan">INFO</span>
                <span>Vector index loaded: text-embedding-3-large (dim: 1536)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-500">[10:04:14]</span>
                <span className="text-growth-emerald font-semibold">AUDIT</span>
                <span className="text-slate-200">
                  Target job_level=&quot;L6&quot; location=&quot;US-MTV&quot; base_salary=$265,000 =&gt; COMPLIANT (P68)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-500">[10:04:15]</span>
                <span className="text-terminal-cyan font-semibold">EXEC</span>
                <span className="text-slate-200">
                  Schedule calculated: Y1=495 shares (33%), Y2=495 shares (33%), Y3=330 shares (22%), Y4=180 shares (12%)
                </span>
              </div>
              <div className="flex items-center space-x-2 pt-2 border-t border-navy-border/50 text-terminal-cyan">
                <span>nextcomp:~$</span>
                <span className="text-slate-100">trigger-dev run --task=compensation-audit-v3</span>
                <span className="h-3.5 w-1.5 bg-terminal-cyan animate-pulse"></span>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture & Guardrails Stack */}
        <section id="architecture" className="space-y-4 pt-4">
          <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <span className="text-terminal-cyan">&gt;&gt;</span>
            <span>Guardrail Compliance</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-navy-card border border-navy-border p-4 space-y-2">
              <div className="flex items-center space-x-2 text-terminal-cyan">
                <Layers className="h-4 w-4" />
                <span className="text-xs font-mono font-bold uppercase">Next.js 15 & Tailwind v4</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                App Router with CSS theme tokens (#0A0F1D, #131B2E, #1E2A47, #00F2FE, #00E599).
              </p>
            </div>

            <div className="rounded-lg bg-navy-card border border-navy-border p-4 space-y-2">
              <div className="flex items-center space-x-2 text-growth-emerald">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-mono font-bold uppercase">Strict Whitelist</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero bloat policy enforced. Prisma, Trigger.dev v3, Vercel AI SDK, and Lucide Icons.
              </p>
            </div>

            <div className="rounded-lg bg-navy-card border border-navy-border p-4 space-y-2">
              <div className="flex items-center space-x-2 text-terminal-cyan">
                <Cpu className="h-4 w-4" />
                <span className="text-xs font-mono font-bold uppercase">Trigger.dev & pgvector</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                All long-running compensation formulas executed asynchronously with Vitest test coverage.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-border bg-navy-card/40 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-terminal-cyan">&gt;_</span>
            <span>NEXTCOMP ENGINE &middot; CONTEXT.md COMPLIANT</span>
          </div>
          <div>Built with Next.js 15 App Router &amp; Tailwind CSS v4</div>
        </div>
      </footer>
    </div>
  );
}
