import Link from "next/link";
import { Terminal, Layers, ArrowLeft } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy-canvas text-slate-100 flex flex-col selection:bg-terminal-cyan/20 selection:text-terminal-cyan">
      {/* Top Terminal Navigation Bar */}
      <header className="border-b border-navy-border bg-navy-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-3 group focus:outline-none"
              title="Return to Home Console"
            >
              <div className="h-9 w-9 rounded-lg bg-navy-canvas border border-navy-border flex items-center justify-center text-terminal-cyan group-hover:border-terminal-cyan/60 transition-colors shadow-[0_0_12px_rgba(0,242,254,0.15)]">
                <Terminal className="h-5 w-5" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="font-mono text-lg font-bold tracking-tight text-white group-hover:text-slate-100 transition-colors">
                  Next<span className="text-terminal-cyan">Comp</span>
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-navy-canvas border border-navy-border text-terminal-cyan">
                  v1.0.0
                </span>
              </div>
            </Link>

            <div className="hidden sm:flex items-center space-x-1 pl-4 border-l border-navy-border text-xs font-mono text-slate-400">
              <span className="text-terminal-cyan">&gt;</span>
              <span>workbench</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-200 font-semibold">salary-bands</span>
            </div>
          </div>

          <nav className="flex items-center space-x-4 text-xs font-mono">
            <Link
              href="/"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-navy-border bg-navy-canvas hover:border-terminal-cyan/60 text-slate-300 hover:text-terminal-cyan transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Telemetry</span>
            </Link>

            <Link
              href="/bands"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 text-terminal-cyan font-medium shadow-[0_0_10px_rgba(0,242,254,0.1)]"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Bands Workbench</span>
            </Link>

            <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-navy-canvas border border-navy-border text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-growth-emerald animate-pulse"></span>
              <span className="text-slate-300">Cluster 10.0.0.170: LIVE</span>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-border bg-navy-card/40 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-terminal-cyan">&gt;_</span>
            <span>NEXTCOMP COMPENSATION ENGINE &middot; CONTEXT.md COMPLIANT</span>
          </div>
          <div className="text-slate-400">
            PostgreSQL pgvector &middot; Vitest Verified &middot; Prisma ORM
          </div>
        </div>
      </footer>
    </div>
  );
}
