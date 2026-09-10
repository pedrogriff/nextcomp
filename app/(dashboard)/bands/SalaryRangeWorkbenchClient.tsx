"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  calculateMinFromMidAndSpread,
  calculateMaxFromMinAndSpread,
  calculateSpread,
  calculateIncumbentImpact,
  calculateCompaRatio,
  calculateRangePenetrationPct,
  getPayCircleStatus,
  calculateGreenCircleCorrectionBudget,
} from "@/lib/comp-math";
import { updateSalaryBands } from "./actions";
import {
  TrendingUp,
  CheckCircle2,
  RotateCcw,
  Save,
  Users,
  AlertTriangle,
  ChevronRight,
  Filter,
  Layers,
  Search,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";

export interface SerializableJobFamily {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface SerializableSalaryBand {
  id: string;
  jobFamilyId: string;
  jobFamilyCode: string;
  jobFamilyName: string;
  level: string;
  locationTier: string;
  minBase: number;
  midBase: number;
  maxBase: number;
  targetEquity: number | null;
  currency: string;
  effectiveYear: number;
}

export interface SerializableEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  currentLevel: string;
  locationTier: string;
  currentBase: number;
  jobRoleTitle: string;
  jobRoleId: string;
  jobFamilyId: string;
  jobFamilyCode: string;
  jobFamilyName: string;
  performanceRating: string | null;
}

interface EditableBandState {
  id: string;
  jobFamilyId: string;
  level: string;
  midBase: number;
  spread: number; // decimal, e.g. 0.40 for 40%
  minBase: number;
  maxBase: number;
  baselineMid: number;
  baselineSpread: number;
  baselineMin: number;
  baselineMax: number;
}

interface Props {
  initialJobFamilies: SerializableJobFamily[];
  initialSalaryBands: SerializableSalaryBand[];
  initialEmployees: SerializableEmployee[];
}

const LEVEL_ORDER: Record<string, number> = {
  IC1: 1,
  IC2: 2,
  IC3: 3,
  IC4: 4,
  IC5: 5,
  IC6: 6,
};

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalaryRangeWorkbenchClient({
  initialJobFamilies,
  initialSalaryBands,
  initialEmployees,
}: Props) {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Local State Setup
  // ──────────────────────────────────────────────────────────────────────────

  // Initialize editable state from database records
  const initialBandsMap = useMemo(() => {
    const map: Record<string, EditableBandState> = {};
    for (const b of initialSalaryBands) {
      const spread = calculateSpread(b.minBase, b.maxBase);
      const key = `${b.jobFamilyId}_${b.level}`;
      map[key] = {
        id: b.id,
        jobFamilyId: b.jobFamilyId,
        level: b.level,
        midBase: b.midBase,
        spread: spread,
        minBase: b.minBase,
        maxBase: b.maxBase,
        baselineMid: b.midBase,
        baselineSpread: spread,
        baselineMin: b.minBase,
        baselineMax: b.maxBase,
      };
    }
    return map;
  }, [initialSalaryBands]);

  const [bandsState, setBandsState] = useState<Record<string, EditableBandState>>(initialBandsMap);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("ALL");
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const [circleFilter, setCircleFilter] = useState<string>("ALL");
  const [saveStatus, setSaveStatus] = useState<{
    type: "idle" | "saving" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  const [isPending, startTransition] = useTransition();

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Immediate Recalculation Engine
  // ──────────────────────────────────────────────────────────────────────────

  // Adjust midpoint with immediate recalculation of Min and Max
  const handleMidpointChange = (key: string, newMid: number) => {
    if (newMid <= 0 || isNaN(newMid)) return;

    setBandsState((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const newMin = calculateMinFromMidAndSpread(newMid, current.spread);
      const newMax = calculateMaxFromMinAndSpread(newMin, current.spread);

      return {
        ...prev,
        [key]: {
          ...current,
          midBase: Math.round(newMid),
          minBase: Math.round(newMin),
          maxBase: Math.round(newMax),
        },
      };
    });
  };

  // Adjust spread % with immediate recalculation of Min and Max
  const handleSpreadChange = (key: string, newSpreadPct: number) => {
    if (newSpreadPct <= 0 || isNaN(newSpreadPct)) return;
    const spreadDecimal = newSpreadPct / 100;

    setBandsState((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const newMin = calculateMinFromMidAndSpread(current.midBase, spreadDecimal);
      const newMax = calculateMaxFromMinAndSpread(newMin, spreadDecimal);

      return {
        ...prev,
        [key]: {
          ...current,
          spread: spreadDecimal,
          minBase: Math.round(newMin),
          maxBase: Math.round(newMax),
        },
      };
    });
  };

  // Step helper for fast bumping
  const stepMidpoint = (key: string, delta: number) => {
    const current = bandsState[key];
    if (!current) return;
    handleMidpointChange(key, Math.max(10000, current.midBase + delta));
  };

  const stepSpread = (key: string, deltaPct: number) => {
    const current = bandsState[key];
    if (!current) return;
    const currentPct = current.spread * 100;
    handleSpreadChange(key, Math.max(5, Math.min(150, currentPct + deltaPct)));
  };

  // Reset a single band to baseline
  const resetSingleBand = (key: string) => {
    setBandsState((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          midBase: current.baselineMid,
          spread: current.baselineSpread,
          minBase: current.baselineMin,
          maxBase: current.baselineMax,
        },
      };
    });
  };

  // Reset all bands to baseline
  const resetAllBands = () => {
    setBandsState(initialBandsMap);
    setSaveStatus({ type: "idle" });
  };

  // Batch presets
  const applyBatchMidpointBump = (percentDelta: number) => {
    setBandsState((prev) => {
      const next = { ...prev };
      for (const key in next) {
        const b = next[key];
        const newMid = Math.round(b.midBase * (1 + percentDelta / 100));
        const newMin = calculateMinFromMidAndSpread(newMid, b.spread);
        const newMax = calculateMaxFromMinAndSpread(newMin, b.spread);
        next[key] = {
          ...b,
          midBase: newMid,
          minBase: Math.round(newMin),
          maxBase: Math.round(newMax),
        };
      }
      return next;
    });
  };

  const applyBatchSpreadNormalize = (targetSpreadPct: number) => {
    const spreadDecimal = targetSpreadPct / 100;
    setBandsState((prev) => {
      const next = { ...prev };
      for (const key in next) {
        const b = next[key];
        const newMin = calculateMinFromMidAndSpread(b.midBase, spreadDecimal);
        const newMax = calculateMaxFromMinAndSpread(newMin, spreadDecimal);
        next[key] = {
          ...b,
          spread: spreadDecimal,
          minBase: Math.round(newMin),
          maxBase: Math.round(newMax),
        };
      }
      return next;
    });
  };

  // Check if any band was modified
  const hasModifications = useMemo(() => {
    return Object.values(bandsState).some(
      (b) =>
        b.midBase !== b.baselineMid ||
        Math.abs(b.spread - b.baselineSpread) > 0.0001 ||
        b.minBase !== b.baselineMin ||
        b.maxBase !== b.baselineMax
    );
  }, [bandsState]);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Incumbent Impact Calculations (Real-Time Synchronous)
  // ──────────────────────────────────────────────────────────────────────────

  // Evaluate Incumbent Impact Summary using lib/comp-math.ts
  const incumbentImpact = useMemo(() => {
    return calculateIncumbentImpact(
      initialEmployees.map((e) => ({
        id: e.id,
        name: e.fullName,
        jobFamilyId: e.jobFamilyId,
        jobFamilyName: e.jobFamilyName,
        level: e.currentLevel,
        currentBase: e.currentBase,
      })),
      (familyId, level) => {
        const key = `${familyId}_${level}`;
        const b = bandsState[key];
        if (!b) return undefined;
        return {
          min: b.minBase,
          mid: b.midBase,
          max: b.maxBase,
          spread: b.spread,
        };
      }
    );
  }, [initialEmployees, bandsState]);

  // Evaluate individual employee rows with real-time dynamic band metrics
  const analyzedEmployees = useMemo(() => {
    return initialEmployees.map((emp) => {
      const bandKey = `${emp.jobFamilyId}_${emp.currentLevel}`;
      const band = bandsState[bandKey];

      if (!band) {
        return {
          ...emp,
          band: null,
          compaRatio: 0,
          rangePenetrationPct: 0,
          circleStatus: "IN_RANGE" as const,
          correctionBudget: 0,
          isGreenCircle: false,
          isRedCircle: false,
        };
      }

      const compa = calculateCompaRatio(emp.currentBase, band.midBase);
      const penetrationPct = calculateRangePenetrationPct(
        emp.currentBase,
        band.minBase,
        band.maxBase
      );
      const circleStatus = getPayCircleStatus(
        emp.currentBase,
        band.minBase,
        band.maxBase
      );
      const correctionBudget = calculateGreenCircleCorrectionBudget(
        emp.currentBase,
        band.minBase
      );

      return {
        ...emp,
        band,
        compaRatio: compa,
        rangePenetrationPct: penetrationPct,
        circleStatus,
        correctionBudget,
        isGreenCircle: circleStatus === "GREEN_CIRCLE",
        isRedCircle: circleStatus === "RED_CIRCLE",
      };
    });
  }, [initialEmployees, bandsState]);

  // Filtered employees for incumbent list view
  const filteredEmployees = useMemo(() => {
    return analyzedEmployees.filter((emp) => {
      if (selectedFamilyId !== "ALL" && emp.jobFamilyId !== selectedFamilyId) {
        return false;
      }
      if (circleFilter !== "ALL" && emp.circleStatus !== circleFilter) {
        return false;
      }
      if (employeeSearch.trim() !== "") {
        const q = employeeSearch.toLowerCase();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchTitle = emp.jobRoleTitle.toLowerCase().includes(q);
        const matchLevel = emp.currentLevel.toLowerCase().includes(q);
        const matchNum = emp.employeeNumber.toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchLevel && !matchNum) {
          return false;
        }
      }
      return true;
    });
  }, [analyzedEmployees, selectedFamilyId, circleFilter, employeeSearch]);

  // Group bands by Job Family
  const groupedFamilies = useMemo(() => {
    return initialJobFamilies.map((fam) => {
      const famBands = Object.values(bandsState)
        .filter((b) => b.jobFamilyId === fam.id)
        .sort((a, b) => (LEVEL_ORDER[a.level] || 99) - (LEVEL_ORDER[b.level] || 99));

      const famEmployees = analyzedEmployees.filter((e) => e.jobFamilyId === fam.id);
      const deptMetric = incumbentImpact.departmentMetrics[fam.id];

      return {
        ...fam,
        bands: famBands,
        employees: famEmployees,
        metrics: deptMetric || {
          departmentName: fam.name,
          employeeCount: famEmployees.length,
          greenCircleCount: 0,
          greenCircleCorrectionBudget: 0,
          redCircleCount: 0,
          inRangeCount: famEmployees.length,
          averageCompaRatio: 0,
        },
      };
    });
  }, [initialJobFamilies, bandsState, analyzedEmployees, incumbentImpact]);

  // Filtered job families for table display
  const displayedFamilies = useMemo(() => {
    if (selectedFamilyId === "ALL") return groupedFamilies;
    return groupedFamilies.filter((f) => f.id === selectedFamilyId);
  }, [groupedFamilies, selectedFamilyId]);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Persistence Action
  // ──────────────────────────────────────────────────────────────────────────

  const handleSaveToDatabase = () => {
    startTransition(async () => {
      setSaveStatus({ type: "saving", message: "Persisting updated salary bands to PostgreSQL..." });
      const payload = Object.values(bandsState).map((b) => ({
        id: b.id,
        minBase: b.minBase,
        midBase: b.midBase,
        maxBase: b.maxBase,
      }));

      const res = await updateSalaryBands(payload);
      if (res.success) {
        // Update baseline to match saved state
        setBandsState((prev) => {
          const updated = { ...prev };
          for (const k in updated) {
            updated[k] = {
              ...updated[k],
              baselineMid: updated[k].midBase,
              baselineSpread: updated[k].spread,
              baselineMin: updated[k].minBase,
              baselineMax: updated[k].maxBase,
            };
          }
          return updated;
        });
        setSaveStatus({
          type: "success",
          message: `Successfully saved ${res.count} salary bands to database!`,
        });
        setTimeout(() => setSaveStatus({ type: "idle" }), 4000);
      } else {
        setSaveStatus({
          type: "error",
          message: res.error || "Failed to commit salary bands to database.",
        });
      }
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Header & Workbench Control Bar */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-navy-border pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-navy-card border border-navy-border text-xs font-mono text-terminal-cyan shadow-sm">
            <ChevronRight className="h-3.5 w-3.5 text-terminal-cyan" />
            <span>SALARY RANGE WORKBENCH</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">US_ZONE_1 &middot; USD</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>Salary Band Modeling Engine</span>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-navy-card border border-navy-border text-growth-emerald flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-growth-emerald animate-pulse"></span>
              Live Math Engine
            </span>
          </h1>
          <p className="text-sm text-slate-400 max-w-3xl">
            Simulate midpoint adjustments and band spread percentages with instant real-time recalculation of range minimums, maximums, and comprehensive incumbent circle impact.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={resetAllBands}
            disabled={!hasModifications || isPending}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
              hasModifications
                ? "border-navy-border bg-navy-card text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer shadow-sm"
                : "border-navy-border/40 bg-navy-card/40 text-slate-600 cursor-not-allowed"
            }`}
            title="Reset all midpoint and spread adjustments back to baseline"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Reset All</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={!hasModifications || isPending}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all shadow-md ${
              hasModifications
                ? "border border-terminal-cyan bg-terminal-cyan/15 text-terminal-cyan hover:bg-terminal-cyan/25 hover:shadow-[0_0_15px_rgba(0,242,254,0.25)] cursor-pointer"
                : "border border-navy-border bg-navy-card/60 text-slate-600 cursor-not-allowed"
            }`}
          >
            <Save className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>{isPending ? "Committing..." : "Save Bands to DB"}</span>
          </button>
        </div>
      </div>

      {/* Save Notification Toast */}
      {saveStatus.type !== "idle" && (
        <div
          className={`p-3.5 rounded-lg border font-mono text-xs flex items-center justify-between transition-all ${
            saveStatus.type === "success"
              ? "bg-growth-emerald/10 border-growth-emerald/40 text-growth-emerald"
              : saveStatus.type === "error"
              ? "bg-rose-500/10 border-rose-500/40 text-rose-400"
              : "bg-terminal-cyan/10 border-terminal-cyan/40 text-terminal-cyan"
          }`}
        >
          <div className="flex items-center space-x-2">
            {saveStatus.type === "success" && <CheckCircle2 className="h-4 w-4 text-growth-emerald" />}
            {saveStatus.type === "error" && <AlertTriangle className="h-4 w-4 text-rose-400" />}
            {saveStatus.type === "saving" && <span className="h-3 w-3 rounded-full border-2 border-terminal-cyan border-t-transparent animate-spin"></span>}
            <span>{saveStatus.message}</span>
          </div>
          {saveStatus.type === "success" && (
            <span className="text-[10px] text-growth-emerald/70 uppercase tracking-wider">
              PRISMA SYNC COMPLETE
            </span>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 3. Incumbent Impact Summary Widget */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="incumbent-impact-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-navy-card border border-navy-border flex items-center justify-center text-terminal-cyan shadow-[0_0_10px_rgba(0,242,254,0.15)]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="incumbent-impact-heading"
                className="text-base font-bold tracking-tight text-white flex items-center gap-2"
              >
                <span>Incumbent Impact Summary</span>
                <span className="text-xs font-mono font-normal text-slate-400">
                  ({incumbentImpact.totalEmployees} Active Headcount Analyzed)
                </span>
              </h2>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-growth-emerald"></span>
              <span>Green Circle: &lt; Min</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-400"></span>
              <span>In Range: Min - Max</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <span>Red Circle: &gt; Max</span>
            </span>
          </div>
        </div>

        {/* 3 Primary Impact KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* CARD 1: Employees Below Min (Green Circle) + Budget Required */}
          <div className="rounded-xl bg-navy-card border border-navy-border p-5 space-y-3 relative overflow-hidden group hover:border-growth-emerald/40 transition-all shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-growth-emerald/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold tracking-wider uppercase text-slate-400 group-hover:text-slate-200 transition-colors flex items-center gap-2">
                {/* Distinct Green Circle */}
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-growth-emerald opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-growth-emerald shadow-[0_0_8px_rgba(0,229,153,0.8)]"></span>
                </span>
                <span>Employees Below Min</span>
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-growth-emerald/10 border border-growth-emerald/30 text-growth-emerald font-bold">
                Green Circle
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                  {incumbentImpact.greenCircleCount}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  incumbents ({incumbentImpact.totalEmployees > 0 ? ((incumbentImpact.greenCircleCount / incumbentImpact.totalEmployees) * 100).toFixed(0) : 0}%)
                </span>
              </div>

              {/* Required Budget to Correct */}
              <div className="pt-2 border-t border-navy-border/70 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Budget Required to Correct:</span>
                  <span className="text-base font-bold text-growth-emerald flex items-center">
                    <ArrowUpRight className="h-4 w-4 mr-0.5 text-growth-emerald" />
                    {formatUSD(incumbentImpact.greenCircleCorrectionBudget)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Total equity adjustment required to bring all underpaid incumbents up to band minimums.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: Employees Above Max (Red Circle) */}
          <div className="rounded-xl bg-navy-card border border-navy-border p-5 space-y-3 relative overflow-hidden group hover:border-rose-500/40 transition-all shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold tracking-wider uppercase text-slate-400 group-hover:text-slate-200 transition-colors flex items-center gap-2">
                {/* Distinct Red Circle */}
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                </span>
                <span>Employees Above Max</span>
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                Red Circle
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                  {incumbentImpact.redCircleCount}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  incumbents ({incumbentImpact.totalEmployees > 0 ? ((incumbentImpact.redCircleCount / incumbentImpact.totalEmployees) * 100).toFixed(0) : 0}%)
                </span>
              </div>

              <div className="pt-2 border-t border-navy-border/70 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Governance Status:</span>
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Salary Freeze / VP Exception
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Incumbents exceeding salary range ceilings. Base merit increases should be paused or converted to lump-sum bonuses.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 3: Average Department Compa-Ratio */}
          <div className="rounded-xl bg-navy-card border border-navy-border p-5 space-y-3 relative overflow-hidden group hover:border-terminal-cyan/40 transition-all shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-terminal-cyan/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold tracking-wider uppercase text-slate-400 group-hover:text-slate-200 transition-colors flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-terminal-cyan" />
                <span>Average Compa-Ratio</span>
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan font-bold">
                Target: 1.000 (100%)
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                  {(incumbentImpact.averageCompaRatio * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-slate-400">
                  (Index: {incumbentImpact.averageCompaRatio.toFixed(3)})
                </span>
              </div>

              <div className="pt-2 border-t border-navy-border/70 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">In-Range Incumbents:</span>
                  <span className="text-slate-200 font-bold">
                    {incumbentImpact.inRangeCount} of {incumbentImpact.totalEmployees} (
                    {incumbentImpact.totalEmployees > 0
                      ? ((incumbentImpact.inRangeCount / incumbentImpact.totalEmployees) * 100).toFixed(0)
                      : 0}
                    %)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Normalized ratio of incumbent compensation relative to market midpoints across all active levels.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Department-by-Department Breakdown Strip */}
        <div className="rounded-xl bg-navy-card border border-navy-border p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-navy-border/60 pb-2">
            <span className="flex items-center gap-1.5 text-terminal-cyan font-bold uppercase tracking-wider">
              <ChevronRight className="h-3.5 w-3.5 text-terminal-cyan" />
              <span>Department Compa-Ratio & Circle Telemetry</span>
            </span>
            <span className="text-slate-500">Auto-calculated from live band bounds</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {groupedFamilies.map((fam) => {
              const m = fam.metrics;
              const ratioPct = (m.averageCompaRatio * 100).toFixed(1);
              const isCloseToMid = m.averageCompaRatio >= 0.95 && m.averageCompaRatio <= 1.05;

              return (
                <div
                  key={fam.id}
                  className={`rounded-lg p-3 border transition-colors ${
                    selectedFamilyId === fam.id
                      ? "border-terminal-cyan/60 bg-navy-canvas/80 shadow-[0_0_12px_rgba(0,242,254,0.1)]"
                      : "border-navy-border/80 bg-navy-canvas/40 hover:border-navy-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-white">
                        {fam.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-navy-card border border-navy-border text-slate-400">
                        {fam.code}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {m.employeeCount} headcount
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-slate-400">Avg Compa-Ratio:</span>
                    <span
                      className={`text-base font-mono font-bold ${
                        isCloseToMid ? "text-growth-emerald" : "text-terminal-cyan"
                      }`}
                    >
                      {ratioPct}%
                    </span>
                  </div>

                  {/* Micro Circle Distribution Badge */}
                  <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-navy-border/50">
                    <span className="inline-flex items-center text-growth-emerald gap-1">
                      <span className="h-2 w-2 rounded-full bg-growth-emerald"></span>
                      <span>{m.greenCircleCount} under ({formatUSD(m.greenCircleCorrectionBudget)})</span>
                    </span>
                    <span className="inline-flex items-center text-rose-400 gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      <span>{m.redCircleCount} over</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 1 & 2. Salary Bands Table with Interactive Midpoint & Spread % Adjustments */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="salary-bands-heading" className="space-y-4">
        {/* Table Filter & Preset Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-navy-card border border-navy-border p-3.5 rounded-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-terminal-cyan" />
              <span>Job Family:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedFamilyId("ALL")}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                selectedFamilyId === "ALL"
                  ? "bg-terminal-cyan text-navy-canvas font-bold shadow-[0_0_10px_rgba(0,242,254,0.3)]"
                  : "bg-navy-canvas border border-navy-border text-slate-400 hover:text-white"
              }`}
            >
              All Families (18 Bands)
            </button>

            {initialJobFamilies.map((fam) => (
              <button
                key={fam.id}
                type="button"
                onClick={() => setSelectedFamilyId(fam.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                  selectedFamilyId === fam.id
                    ? "bg-terminal-cyan text-navy-canvas font-bold shadow-[0_0_10px_rgba(0,242,254,0.3)]"
                    : "bg-navy-canvas border border-navy-border text-slate-400 hover:text-white"
                }`}
              >
                {fam.name} ({fam.code})
              </button>
            ))}
          </div>

          {/* Quick Preset Actions */}
          <div className="flex items-center space-x-2 border-t sm:border-t-0 border-navy-border/60 pt-2 sm:pt-0">
            <span className="text-[11px] font-mono text-slate-500 hidden xl:inline">
              Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => applyBatchMidpointBump(3.0)}
              className="px-2 py-1 rounded bg-navy-canvas border border-navy-border hover:border-growth-emerald/60 text-[11px] font-mono text-slate-300 hover:text-growth-emerald transition-colors"
              title="Increase all midpoints by +3% cost of living adjustment"
            >
              +3% Mid
            </button>
            <button
              type="button"
              onClick={() => applyBatchMidpointBump(5.0)}
              className="px-2 py-1 rounded bg-navy-canvas border border-navy-border hover:border-growth-emerald/60 text-[11px] font-mono text-slate-300 hover:text-growth-emerald transition-colors"
              title="Increase all midpoints by +5% market adjustment"
            >
              +5% Mid
            </button>
            <button
              type="button"
              onClick={() => applyBatchSpreadNormalize(40)}
              className="px-2 py-1 rounded bg-navy-canvas border border-navy-border hover:border-terminal-cyan/60 text-[11px] font-mono text-slate-300 hover:text-terminal-cyan transition-colors"
              title="Standardize spread to 40% across all levels"
            >
              40% Spread
            </button>
            <button
              type="button"
              onClick={() => applyBatchSpreadNormalize(50)}
              className="px-2 py-1 rounded bg-navy-canvas border border-navy-border hover:border-terminal-cyan/60 text-[11px] font-mono text-slate-300 hover:text-terminal-cyan transition-colors"
              title="Standardize spread to 50% across all levels"
            >
              50% Spread
            </button>
          </div>
        </div>

        {/* Salary Bands Table by Job Family */}
        <div className="space-y-6">
          {displayedFamilies.map((fam) => (
            <div
              key={fam.id}
              className="rounded-xl border border-navy-border bg-navy-card overflow-hidden shadow-xl"
            >
              {/* Job Family Header */}
              <div className="bg-navy-canvas/90 px-5 py-3.5 border-b border-navy-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-md bg-navy-card border border-navy-border flex items-center justify-center text-terminal-cyan">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-mono text-base font-bold text-white tracking-tight">
                        {fam.name} Family
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan font-bold">
                        {fam.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{fam.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
                  <span>6 IC Bands (IC1-IC6)</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-slate-300">
                    {fam.employees.length} Incumbents
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-terminal-cyan font-semibold">
                    Compa: {(fam.metrics.averageCompaRatio * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-navy-border bg-navy-canvas/50 text-slate-400 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 font-semibold">Level & Role</th>
                      <th className="py-3 px-3 font-semibold text-center">Incumbents</th>
                      <th className="py-3 px-4 font-semibold text-right">Min Base</th>
                      <th className="py-3 px-4 font-semibold text-center min-w-[200px]">
                        Midpoint (Editable)
                      </th>
                      <th className="py-3 px-4 font-semibold text-center min-w-[180px]">
                        Spread % (Editable)
                      </th>
                      <th className="py-3 px-4 font-semibold text-right">Max Base</th>
                      <th className="py-3 px-4 font-semibold text-right">Range Width</th>
                      <th className="py-3 px-4 font-semibold text-center min-w-[160px]">
                        Band Visual
                      </th>
                      <th className="py-3 px-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-border/60 text-slate-200">
                    {fam.bands.map((band) => {
                      const bandKey = `${band.jobFamilyId}_${band.level}`;
                      const isModified =
                        band.midBase !== band.baselineMid ||
                        Math.abs(band.spread - band.baselineSpread) > 0.0001;

                      // Find incumbents for this band
                      const bandEmployees = fam.employees.filter((e) => e.currentLevel === band.level);
                      const hasGreenCircle = bandEmployees.some((e) => e.isGreenCircle);
                      const hasRedCircle = bandEmployees.some((e) => e.isRedCircle);

                      return (
                        <tr
                          key={band.id}
                          className={`hover:bg-navy-canvas/60 transition-colors ${
                            isModified ? "bg-terminal-cyan/[0.02]" : ""
                          }`}
                        >
                          {/* Level & Role Title */}
                          <td className="py-3.5 px-4 font-medium">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white px-2 py-0.5 rounded bg-navy-canvas border border-navy-border text-xs text-terminal-cyan">
                                {band.level}
                              </span>
                              <span className="text-slate-300 font-sans text-xs">
                                {band.level === "IC1"
                                  ? "Associate"
                                  : band.level === "IC2"
                                  ? "Staff Contributor"
                                  : band.level === "IC3"
                                  ? "Senior"
                                  : band.level === "IC4"
                                  ? "Staff"
                                  : band.level === "IC5"
                                  ? "Principal"
                                  : "Distinguished / Fellow"}
                              </span>
                            </div>
                          </td>

                          {/* Incumbents Count Badge */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-navy-canvas border border-navy-border text-[11px]">
                              <span>{bandEmployees.length}</span>
                              {hasGreenCircle && (
                                <span
                                  className="h-2 w-2 rounded-full bg-growth-emerald"
                                  title="Has employees below Min (Green Circle)"
                                ></span>
                              )}
                              {hasRedCircle && (
                                <span
                                  className="h-2 w-2 rounded-full bg-rose-500"
                                  title="Has employees above Max (Red Circle)"
                                ></span>
                              )}
                            </div>
                          </td>

                          {/* Min Base (Derived via Mid / (1 + Spread/2)) */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-bold text-slate-100">
                              {formatUSD(band.minBase)}
                            </div>
                            {isModified && (
                              <div className="text-[10px] text-slate-500">
                                was {formatUSD(band.baselineMin)}
                              </div>
                            )}
                          </td>

                          {/* Midpoint Base (Interactive Input with Steppers) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => stepMidpoint(bandKey, -5000)}
                                className="h-7 w-7 rounded bg-navy-canvas border border-navy-border hover:border-terminal-cyan/60 text-slate-400 hover:text-terminal-cyan flex items-center justify-center text-xs font-bold transition-colors"
                                title="Decrement midpoint -$5,000"
                              >
                                -
                              </button>

                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="1000"
                                  min="20000"
                                  max="1000000"
                                  value={band.midBase}
                                  onChange={(e) =>
                                    handleMidpointChange(
                                      bandKey,
                                      parseFloat(e.target.value) || band.midBase
                                    )
                                  }
                                  className={`w-28 py-1 pl-6 pr-2 rounded bg-navy-canvas border text-right font-mono text-xs font-bold text-white focus:outline-none focus:border-terminal-cyan transition-colors ${
                                    isModified
                                      ? "border-terminal-cyan/70 text-terminal-cyan"
                                      : "border-navy-border"
                                  }`}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => stepMidpoint(bandKey, 5000)}
                                className="h-7 w-7 rounded bg-navy-canvas border border-navy-border hover:border-terminal-cyan/60 text-slate-400 hover:text-terminal-cyan flex items-center justify-center text-xs font-bold transition-colors"
                                title="Increment midpoint +$5,000"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Spread % (Interactive Input with Steppers) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => stepSpread(bandKey, -2.5)}
                                className="h-7 w-7 rounded bg-navy-canvas border border-navy-border hover:border-terminal-cyan/60 text-slate-400 hover:text-terminal-cyan flex items-center justify-center text-xs font-bold transition-colors"
                                title="Narrow spread -2.5%"
                              >
                                -
                              </button>

                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="10"
                                  max="150"
                                  value={Number((band.spread * 100).toFixed(1))}
                                  onChange={(e) =>
                                    handleSpreadChange(
                                      bandKey,
                                      parseFloat(e.target.value) || 40
                                    )
                                  }
                                  className={`w-20 py-1 pl-2 pr-6 rounded bg-navy-canvas border text-right font-mono text-xs font-bold text-white focus:outline-none focus:border-terminal-cyan transition-colors ${
                                    isModified
                                      ? "border-terminal-cyan/70 text-terminal-cyan"
                                      : "border-navy-border"
                                  }`}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                                  %
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => stepSpread(bandKey, 2.5)}
                                className="h-7 w-7 rounded bg-navy-canvas border border-navy-border hover:border-terminal-cyan/60 text-slate-400 hover:text-terminal-cyan flex items-center justify-center text-xs font-bold transition-colors"
                                title="Widen spread +2.5%"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Max Base (Derived via Min * (1 + Spread)) */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-bold text-slate-100">
                              {formatUSD(band.maxBase)}
                            </div>
                            {isModified && (
                              <div className="text-[10px] text-slate-500">
                                was {formatUSD(band.baselineMax)}
                              </div>
                            )}
                          </td>

                          {/* Range Width ($) */}
                          <td className="py-3.5 px-4 text-right text-slate-400">
                            {formatUSD(band.maxBase - band.minBase)}
                          </td>

                          {/* Band Visual Representation */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="h-2.5 w-full bg-navy-canvas rounded-full border border-navy-border overflow-hidden relative">
                                {/* Band spread bar */}
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-700 via-terminal-cyan/30 to-slate-700 opacity-60"></div>
                                {/* Midpoint indicator notch */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-terminal-cyan shadow-[0_0_6px_rgba(0,242,254,0.9)]"></div>
                              </div>
                              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                                <span>Min</span>
                                <span className="text-terminal-cyan font-bold">Mid</span>
                                <span>Max</span>
                              </div>
                            </div>
                          </td>

                          {/* Row Reset Action */}
                          <td className="py-3.5 px-3 text-center">
                            {isModified ? (
                              <button
                                type="button"
                                onClick={() => resetSingleBand(bandKey)}
                                className="p-1 rounded text-slate-400 hover:text-terminal-cyan hover:bg-navy-canvas transition-colors"
                                title="Reset this band to baseline"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-700 select-none">&bull;</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Incumbent Roster Drilldown & Real-Time Impact Evaluation */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="incumbent-roster-heading" className="space-y-4 pt-4">
        <div className="rounded-xl border border-navy-border bg-navy-card overflow-hidden shadow-xl">
          <div className="bg-navy-canvas/90 px-5 py-4 border-b border-navy-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3
                id="incumbent-roster-heading"
                className="font-mono text-base font-bold text-white tracking-tight flex items-center gap-2"
              >
                <Users className="h-4 w-4 text-terminal-cyan" />
                <span>Incumbent Roster Drilldown</span>
                <span className="text-xs font-mono font-normal text-slate-400">
                  (Showing {filteredEmployees.length} of {analyzedEmployees.length} employees)
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Live employee compensation positioning dynamically updated as you adjust midpoints and spreads above.
              </p>
            </div>

            {/* Roster Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search input */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search name, role, level..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 rounded bg-navy-canvas border border-navy-border text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-terminal-cyan w-48 transition-colors"
                />
              </div>

              {/* Circle Status Pill Filter */}
              <div className="inline-flex rounded-lg border border-navy-border bg-navy-canvas p-0.5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setCircleFilter("ALL")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    circleFilter === "ALL"
                      ? "bg-navy-card text-white font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setCircleFilter("GREEN_CIRCLE")}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                    circleFilter === "GREEN_CIRCLE"
                      ? "bg-growth-emerald/20 text-growth-emerald font-bold"
                      : "text-slate-400 hover:text-growth-emerald"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-growth-emerald"></span>
                  <span>Green Circle ({incumbentImpact.greenCircleCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCircleFilter("IN_RANGE")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    circleFilter === "IN_RANGE"
                      ? "bg-slate-700 text-slate-200 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  In Range ({incumbentImpact.inRangeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCircleFilter("RED_CIRCLE")}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                    circleFilter === "RED_CIRCLE"
                      ? "bg-rose-500/20 text-rose-400 font-bold"
                      : "text-slate-400 hover:text-rose-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  <span>Red Circle ({incumbentImpact.redCircleCount})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Incumbents Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-navy-border bg-navy-canvas/50 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Employee</th>
                  <th className="py-3 px-4 font-semibold">Department & Role</th>
                  <th className="py-3 px-3 font-semibold text-center">Level</th>
                  <th className="py-3 px-4 font-semibold text-right">Current Base</th>
                  <th className="py-3 px-4 font-semibold text-right">Target Mid</th>
                  <th className="py-3 px-3 font-semibold text-center">Compa-Ratio</th>
                  <th className="py-3 px-4 font-semibold text-center">Band Boundaries</th>
                  <th className="py-3 px-3 font-semibold text-center">Penetration</th>
                  <th className="py-3 px-4 font-semibold text-center">Circle Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Correction Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border/60 text-slate-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 font-mono">
                      No incumbents match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const compaPct = (emp.compaRatio * 100).toFixed(1);
                    return (
                      <tr
                        key={emp.id}
                        className={`hover:bg-navy-canvas/60 transition-colors ${
                          emp.isGreenCircle
                            ? "bg-growth-emerald/[0.03]"
                            : emp.isRedCircle
                            ? "bg-rose-500/[0.03]"
                            : ""
                        }`}
                      >
                        {/* Employee Name */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-white font-sans text-xs">
                            {emp.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {emp.employeeNumber} &middot; {emp.email}
                          </div>
                        </td>

                        {/* Department & Role */}
                        <td className="py-3 px-4">
                          <div className="text-slate-300 font-sans text-xs line-clamp-1">
                            {emp.jobRoleTitle}
                          </div>
                          <div className="text-[10px] text-terminal-cyan font-mono">
                            {emp.jobFamilyName} ({emp.jobFamilyCode})
                          </div>
                        </td>

                        {/* Level */}
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-navy-canvas border border-navy-border font-bold text-white text-xs">
                            {emp.currentLevel}
                          </span>
                        </td>

                        {/* Current Base */}
                        <td className="py-3 px-4 text-right font-bold text-slate-100">
                          {formatUSD(emp.currentBase)}
                        </td>

                        {/* Target Midpoint */}
                        <td className="py-3 px-4 text-right text-slate-300">
                          {emp.band ? formatUSD(emp.band.midBase) : "-"}
                        </td>

                        {/* Compa-Ratio */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-xs ${
                              emp.isGreenCircle
                                ? "bg-growth-emerald/10 text-growth-emerald border border-growth-emerald/30"
                                : emp.isRedCircle
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                : "bg-navy-canvas border border-navy-border text-slate-200"
                            }`}
                          >
                            {compaPct}%
                          </span>
                        </td>

                        {/* Band Boundaries */}
                        <td className="py-3 px-4 text-center text-[11px] text-slate-400">
                          {emp.band ? (
                            <span>
                              {formatUSD(emp.band.minBase)} &ndash; {formatUSD(emp.band.maxBase)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* Range Penetration */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-xs ${
                              emp.rangePenetrationPct < 0
                                ? "text-growth-emerald"
                                : emp.rangePenetrationPct > 100
                                ? "text-rose-400"
                                : "text-slate-300"
                            }`}
                          >
                            {emp.rangePenetrationPct.toFixed(1)}%
                          </span>
                        </td>

                        {/* Circle Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {emp.isGreenCircle && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-growth-emerald/10 border border-growth-emerald/40 text-growth-emerald text-[10px] font-bold">
                              <span className="h-1.5 w-1.5 rounded-full bg-growth-emerald"></span>
                              <span>GREEN CIRCLE</span>
                            </span>
                          )}
                          {emp.isRedCircle && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                              <span>RED CIRCLE</span>
                            </span>
                          )}
                          {!emp.isGreenCircle && !emp.isRedCircle && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-navy-canvas border border-navy-border text-slate-400 text-[10px]">
                              <span>IN RANGE</span>
                            </span>
                          )}
                        </td>

                        {/* Correction Budget Delta */}
                        <td className="py-3 px-4 text-right">
                          {emp.isGreenCircle ? (
                            <span className="text-growth-emerald font-bold">
                              +{formatUSD(emp.correctionBudget)}
                            </span>
                          ) : emp.isRedCircle ? (
                            <span className="text-rose-400">
                              +{formatUSD(emp.currentBase - (emp.band?.maxBase || 0))} over
                            </span>
                          ) : (
                            <span className="text-slate-500">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
