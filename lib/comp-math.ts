/**
 * NextComp Compensation Calculation Engine
 * Core mathematical engine for total rewards, salary band construction,
 * market benchmark alignment, compa-ratios, and range penetration.
 *
 * Formulas per PRD and CONTEXT specifications:
 * - Midpoint from Spread & Min/Max: Min = Mid / (1 + Spread/2), Max = Min * (1 + Spread)
 * - Compa-Ratio = Base / Midpoint
 * - Range Penetration = (Base - Min) / (Max - Min)
 * - Green-Circle (< Min) and Red-Circle (> Max) boundary conditions
 */

/**
 * Circle status classifying whether employee pay is below range minimum,
 * within standard salary band boundaries, or exceeding range maximum.
 */
export type PayCircleStatus = "GREEN_CIRCLE" | "IN_RANGE" | "RED_CIRCLE";

/**
 * Result structure of a salary band generated from midpoint and spread.
 */
export interface SalaryBandBounds {
  min: number;
  mid: number;
  max: number;
  spread: number;
}

/**
 * Complete multi-dimensional compensation positioning analysis.
 */
export interface CompPositionAnalysis {
  base: number;
  min: number;
  mid: number;
  max: number;
  spread: number;
  compaRatio: number;
  rangePenetration: number;
  rangePenetrationPct: number;
  isGreenCircle: boolean;
  isRedCircle: boolean;
  isInRange: boolean;
  circleStatus: PayCircleStatus;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Midpoint & Spread Calculations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the range minimum given the midpoint and band spread.
 *
 * Formula:
 *   Min = Mid / (1 + Spread / 2)
 *
 * @param mid - Range midpoint (must be > 0)
 * @param spread - Range spread expressed as a positive decimal (e.g., 0.50 for 50%)
 */
export function calculateMinFromMidAndSpread(mid: number, spread: number): number {
  if (mid <= 0) {
    throw new Error("Midpoint must be greater than zero");
  }
  if (spread <= 0) {
    throw new Error("Spread must be greater than zero");
  }
  return mid / (1 + spread / 2);
}

/**
 * Calculates the range maximum given the minimum and band spread.
 *
 * Formula:
 *   Max = Min * (1 + Spread)
 *
 * @param min - Range minimum (must be > 0)
 * @param spread - Range spread expressed as a positive decimal (e.g., 0.50 for 50%)
 */
export function calculateMaxFromMinAndSpread(min: number, spread: number): number {
  if (min <= 0) {
    throw new Error("Minimum must be greater than zero");
  }
  if (spread <= 0) {
    throw new Error("Spread must be greater than zero");
  }
  return min * (1 + spread);
}

/**
 * Calculates the range maximum directly from midpoint and spread.
 *
 * Combines:
 *   Min = Mid / (1 + Spread / 2)
 *   Max = Min * (1 + Spread)
 *
 * @param mid - Range midpoint (must be > 0)
 * @param spread - Range spread expressed as a positive decimal
 */
export function calculateMaxFromMidAndSpread(mid: number, spread: number): number {
  const min = calculateMinFromMidAndSpread(mid, spread);
  return calculateMaxFromMinAndSpread(min, spread);
}

/**
 * Calculates the band spread given the range minimum and maximum.
 *
 * Formula:
 *   Spread = (Max - Min) / Min
 *
 * @param min - Range minimum (must be > 0)
 * @param max - Range maximum (must be > min)
 */
export function calculateSpread(min: number, max: number): number {
  if (min <= 0) {
    throw new Error("Minimum must be greater than zero");
  }
  if (max <= min) {
    throw new Error("Maximum must be greater than minimum");
  }
  return (max - min) / min;
}

/**
 * Calculates the midpoint given range minimum and maximum.
 *
 * Formula:
 *   Mid = (Min + Max) / 2
 *
 * @param min - Range minimum (must be > 0)
 * @param max - Range maximum (must be > min)
 */
export function calculateMidpoint(min: number, max: number): number {
  if (min <= 0) {
    throw new Error("Minimum must be greater than zero");
  }
  if (max <= min) {
    throw new Error("Maximum must be greater than minimum");
  }
  return (min + max) / 2;
}

/**
 * Constructs full salary band boundaries given a midpoint and spread.
 *
 * @param mid - Range midpoint (must be > 0)
 * @param spread - Range spread (must be > 0)
 */
export function calculateBandFromMidpoint(
  mid: number,
  spread: number
): SalaryBandBounds {
  const min = calculateMinFromMidAndSpread(mid, spread);
  const max = calculateMaxFromMinAndSpread(min, spread);
  return {
    min,
    mid,
    max,
    spread,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Compa-Ratio Calculations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the Compa-Ratio (comparative salary ratio against midpoint).
 *
 * Formula:
 *   Compa-Ratio = Base / Midpoint
 *
 * Standard interpretations:
 *   - 1.000: Paid exactly at target market midpoint
 *   - < 1.000: Paid below market midpoint (e.g., developing/new in role)
 *   - > 1.000: Paid above market midpoint (e.g., seasoned high performer)
 *
 * @param base - Base salary (must be >= 0)
 * @param midpoint - Salary band midpoint (must be > 0)
 */
export function calculateCompaRatio(base: number, midpoint: number): number {
  if (base < 0) {
    throw new Error("Base salary cannot be negative");
  }
  if (midpoint <= 0) {
    throw new Error("Midpoint must be greater than zero");
  }
  return base / midpoint;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Range Penetration Calculations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculates Range Penetration (how far into the salary band an employee has progressed).
 *
 * Formula:
 *   Range Penetration = (Base - Min) / (Max - Min)
 *
 * Returns a decimal value:
 *   - 0.00: Paid exactly at band minimum
 *   - 0.50: Paid exactly at band midpoint (symmetric band)
 *   - 1.00: Paid exactly at band maximum
 *   - < 0.00: Green-circle rate (below minimum)
 *   - > 1.00: Red-circle rate (exceeding maximum)
 *
 * @param base - Base salary (must be >= 0)
 * @param min - Salary band minimum (must be > 0)
 * @param max - Salary band maximum (must be > min)
 */
export function calculateRangePenetration(
  base: number,
  min: number,
  max: number
): number {
  if (base < 0) {
    throw new Error("Base salary cannot be negative");
  }
  if (min <= 0) {
    throw new Error("Minimum must be greater than zero");
  }
  if (max <= min) {
    throw new Error("Maximum must be greater than minimum");
  }
  return (base - min) / (max - min);
}

/**
 * Calculates Range Penetration as a percentage [0% to 100%].
 *
 * Formula:
 *   Range Penetration % = ((Base - Min) / (Max - Min)) * 100
 *
 * @param base - Base salary (must be >= 0)
 * @param min - Salary band minimum
 * @param max - Salary band maximum
 */
export function calculateRangePenetrationPct(
  base: number,
  min: number,
  max: number
): number {
  return calculateRangePenetration(base, min, max) * 100;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Green-Circle & Red-Circle Boundary Conditions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a salary is a Green-Circle rate (strictly below band minimum).
 * Green-circle rates typically flag employees requiring upward equity or merit
 * adjustments to maintain internal pay equity and band compliance.
 *
 * Boundary condition:
 *   Base < Min (strict inequality; Base === Min is In-Range, not Green-Circle)
 *
 * @param base - Base salary (must be >= 0)
 * @param min - Range minimum (must be > 0)
 */
export function isGreenCircle(base: number, min: number): boolean {
  if (base < 0) {
    throw new Error("Base salary cannot be negative");
  }
  if (min <= 0) {
    throw new Error("Minimum must be greater than zero");
  }
  return base < min;
}

/**
 * Determines whether a salary is a Red-Circle rate (strictly above band maximum).
 * Red-circle rates typically flag employees requiring salary freezes or VP exception
 * governance to prevent band compression.
 *
 * Boundary condition:
 *   Base > Max (strict inequality; Base === Max is In-Range, not Red-Circle)
 *
 * @param base - Base salary (must be >= 0)
 * @param max - Range maximum (must be > 0)
 */
export function isRedCircle(base: number, max: number): boolean {
  if (base < 0) {
    throw new Error("Base salary cannot be negative");
  }
  if (max <= 0) {
    throw new Error("Maximum must be greater than zero");
  }
  return base > max;
}

/**
 * Determines whether a salary is In-Range (within inclusive band boundaries).
 *
 * Boundary condition:
 *   Min <= Base <= Max
 *
 * @param base - Base salary (must be >= 0)
 * @param min - Range minimum (must be > 0)
 * @param max - Range maximum (must be > min)
 */
export function isInRange(base: number, min: number, max: number): boolean {
  if (base < 0) {
    throw new Error("Base salary cannot be negative");
  }
  if (min <= 0) {
    throw new Error("Minimum must be greater than zero");
  }
  if (max <= min) {
    throw new Error("Maximum must be greater than minimum");
  }
  return base >= min && base <= max;
}

/**
 * Classifies an employee's pay into one of three circle statuses:
 *   - 'GREEN_CIRCLE' if Base < Min
 *   - 'RED_CIRCLE'   if Base > Max
 *   - 'IN_RANGE'     if Min <= Base <= Max
 *
 * @param base - Base salary (must be >= 0)
 * @param min - Range minimum (must be > 0)
 * @param max - Range maximum (must be > min)
 */
export function getPayCircleStatus(
  base: number,
  min: number,
  max: number
): PayCircleStatus {
  if (isGreenCircle(base, min)) {
    return "GREEN_CIRCLE";
  }
  if (isRedCircle(base, max)) {
    return "RED_CIRCLE";
  }
  return "IN_RANGE";
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Comprehensive Position Analysis
// ────────────────────────────────────────────────────────────────────────────

/**
 * Performs a comprehensive compensation position analysis evaluating midpoint,
 * spread, compa-ratio, range penetration, and circle status boundaries.
 *
 * @param base - Base salary
 * @param min - Salary band minimum
 * @param max - Salary band maximum
 * @param midpointOverride - Optional explicit midpoint if non-symmetric band
 */
export function analyzeCompPosition(
  base: number,
  min: number,
  max: number,
  midpointOverride?: number
): CompPositionAnalysis {
  const mid =
    midpointOverride !== undefined
      ? midpointOverride
      : calculateMidpoint(min, max);
  const spread = calculateSpread(min, max);
  const compaRatio = calculateCompaRatio(base, mid);
  const rangePenetration = calculateRangePenetration(base, min, max);
  const rangePenetrationPct = calculateRangePenetrationPct(base, min, max);
  const green = isGreenCircle(base, min);
  const red = isRedCircle(base, max);
  const inBand = isInRange(base, min, max);
  const circleStatus = getPayCircleStatus(base, min, max);

  return {
    base,
    min,
    mid,
    max,
    spread,
    compaRatio,
    rangePenetration,
    rangePenetrationPct,
    isGreenCircle: green,
    isRedCircle: red,
    isInRange: inBand,
    circleStatus,
  };
}
