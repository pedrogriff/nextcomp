import { describe, it, expect } from "vitest";
import {
  calculateMinFromMidAndSpread,
  calculateMaxFromMinAndSpread,
  calculateMaxFromMidAndSpread,
  calculateMidpoint,
  calculateSpread,
  calculateBandFromMidpoint,
  calculateCompaRatio,
  calculateRangePenetration,
  calculateRangePenetrationPct,
  isGreenCircle,
  isRedCircle,
  isInRange,
  getPayCircleStatus,
  analyzeCompPosition,
  calculateGreenCircleCorrectionBudget,
  calculateIncumbentImpact,
} from "../lib/comp-math";

describe("Compensation Math Engine", () => {
  describe("1. Midpoint from Spread & Min/Max formulas", () => {
    // Formula specifications:
    // Min = Mid / (1 + Spread / 2)
    // Max = Min * (1 + Spread)
    // Spread = (Max - Min) / Min
    // Mid = (Min + Max) / 2

    it("calculates Min from Midpoint and Spread accurately: Min = Mid / (1 + Spread/2)", () => {
      // Example: Mid = $125,000, Spread = 0.50 (50% spread)
      // Min = 125,000 / (1 + 0.25) = 125,000 / 1.25 = 100,000
      const mid = 125000;
      const spread = 0.5;
      const min = calculateMinFromMidAndSpread(mid, spread);
      expect(min).toBe(100000);
    });

    it("calculates Max from Min and Spread accurately: Max = Min * (1 + Spread)", () => {
      // Example: Min = $100,000, Spread = 0.50
      // Max = 100,000 * (1 + 0.50) = 150,000
      const min = 100000;
      const spread = 0.5;
      const max = calculateMaxFromMinAndSpread(min, spread);
      expect(max).toBe(150000);
    });

    it("calculates Max directly from Midpoint and Spread", () => {
      // Mid = 125,000, Spread = 0.50 -> Min = 100,000 -> Max = 150,000
      const mid = 125000;
      const spread = 0.5;
      const max = calculateMaxFromMidAndSpread(mid, spread);
      expect(max).toBe(150000);
    });

    it("calculates Spread from Min and Max: Spread = (Max - Min) / Min", () => {
      // Min = 100,000, Max = 150,000 -> Spread = (150,000 - 100,000) / 100,000 = 0.50 (50%)
      const spread = calculateSpread(100000, 150000);
      expect(spread).toBeCloseTo(0.5, 6);

      // Min = 200,000, Max = 280,000 -> Spread = 80,000 / 200,000 = 0.40 (40%)
      expect(calculateSpread(200000, 280000)).toBeCloseTo(0.4, 6);
    });

    it("calculates Midpoint from Min and Max: Mid = (Min + Max) / 2", () => {
      // Min = 100,000, Max = 150,000 -> Mid = 125,000
      expect(calculateMidpoint(100000, 150000)).toBe(125000);
      // Min = 140,000, Max = 190,000 -> Mid = 165,000
      expect(calculateMidpoint(140000, 190000)).toBe(165000);
    });

    it("generates a full salary band from Midpoint and Spread and verifies mathematical identity", () => {
      // Mid = $200,000, Spread = 0.40 (40%)
      // Min = 200,000 / (1 + 0.20) = 166,666.666...
      // Max = Min * 1.40 = 233,333.333...
      const band = calculateBandFromMidpoint(200000, 0.4);
      expect(band.mid).toBe(200000);
      expect(band.spread).toBe(0.4);
      expect(band.min).toBeCloseTo(166666.67, 2);
      expect(band.max).toBeCloseTo(233333.33, 2);

      // Verify reciprocal invariant: (Min + Max) / 2 === Mid
      const recalculatedMid = (band.min + band.max) / 2;
      expect(recalculatedMid).toBeCloseTo(200000, 6);

      // Verify reciprocal invariant: (Max - Min) / Min === Spread
      const recalculatedSpread = (band.max - band.min) / band.min;
      expect(recalculatedSpread).toBeCloseTo(0.4, 6);
    });

    it("validates boundary inputs and throws on invalid midpoint or spread", () => {
      expect(() => calculateMinFromMidAndSpread(0, 0.5)).toThrowError(
        /Midpoint must be greater than zero/i
      );
      expect(() => calculateMinFromMidAndSpread(-50000, 0.5)).toThrowError(
        /Midpoint must be greater than zero/i
      );
      expect(() => calculateMinFromMidAndSpread(100000, 0)).toThrowError(
        /Spread must be greater than zero/i
      );
      expect(() => calculateMinFromMidAndSpread(100000, -0.2)).toThrowError(
        /Spread must be greater than zero/i
      );
      expect(() => calculateMaxFromMinAndSpread(0, 0.5)).toThrowError(
        /Minimum must be greater than zero/i
      );
      expect(() => calculateSpread(150000, 100000)).toThrowError(
        /Maximum must be greater than minimum/i
      );
      expect(() => calculateSpread(0, 100000)).toThrowError(
        /Minimum must be greater than zero/i
      );
    });
  });

  describe("2. Compa-Ratio calculations", () => {
    // Formula: Compa-Ratio = Base / Midpoint

    it("calculates exact market midpoint parity (Compa-Ratio = 1.0)", () => {
      const base = 125000;
      const midpoint = 125000;
      expect(calculateCompaRatio(base, midpoint)).toBe(1.0);
    });

    it("calculates below-midpoint compa-ratio (< 1.0)", () => {
      // Base = $100,000, Midpoint = $125,000 -> 100,000 / 125,000 = 0.800
      expect(calculateCompaRatio(100000, 125000)).toBe(0.8);

      // Base = $112,500, Midpoint = $125,000 -> 0.900
      expect(calculateCompaRatio(112500, 125000)).toBe(0.9);
    });

    it("calculates above-midpoint compa-ratio (> 1.0)", () => {
      // Base = $150,000, Midpoint = $125,000 -> 150,000 / 125,000 = 1.200
      expect(calculateCompaRatio(150000, 125000)).toBe(1.2);

      // Base = $137,500, Midpoint = $125,000 -> 1.100
      expect(calculateCompaRatio(137500, 125000)).toBe(1.1);
    });

    it("calculates realistic compensation benchmark compa-ratios", () => {
      // Senior SWE IC3: Base = $205,000, Midpoint = $210,000
      const compa = calculateCompaRatio(205000, 210000);
      expect(compa).toBeCloseTo(0.97619, 4);

      // Principal Engineer IC5: Base = $340,000, Midpoint = $325,000
      expect(calculateCompaRatio(340000, 325000)).toBeCloseTo(1.04615, 4);
    });

    it("handles zero base salary as 0.0 compa-ratio", () => {
      expect(calculateCompaRatio(0, 100000)).toBe(0);
    });

    it("validates inputs and throws for non-positive midpoint or negative base", () => {
      expect(() => calculateCompaRatio(100000, 0)).toThrowError(
        /Midpoint must be greater than zero/i
      );
      expect(() => calculateCompaRatio(100000, -100000)).toThrowError(
        /Midpoint must be greater than zero/i
      );
      expect(() => calculateCompaRatio(-5000, 100000)).toThrowError(
        /Base salary cannot be negative/i
      );
    });
  });

  describe("3. Range Penetration calculations", () => {
    // Formula: Range Penetration = (Base - Min) / (Max - Min)

    const MIN = 100000;
    const MAX = 150000;
    const MID = 125000;

    it("calculates range penetration at exactly minimum (0.0)", () => {
      const penetration = calculateRangePenetration(MIN, MIN, MAX);
      expect(penetration).toBe(0.0);
    });

    it("calculates range penetration at exactly maximum (1.0)", () => {
      const penetration = calculateRangePenetration(MAX, MIN, MAX);
      expect(penetration).toBe(1.0);
    });

    it("calculates range penetration at symmetric midpoint (0.5)", () => {
      const penetration = calculateRangePenetration(MID, MIN, MAX);
      expect(penetration).toBe(0.5);
    });

    it("calculates fractional range penetration within band", () => {
      // 25% penetration: Base = $112,500
      expect(calculateRangePenetration(112500, MIN, MAX)).toBe(0.25);

      // 75% penetration: Base = $137,500
      expect(calculateRangePenetration(137500, MIN, MAX)).toBe(0.75);

      // 62.5% penetration: Base = $131,250
      expect(calculateRangePenetration(131250, MIN, MAX)).toBe(0.625);
    });

    it("calculates range penetration as percentage (0% to 100%)", () => {
      expect(calculateRangePenetrationPct(MIN, MIN, MAX)).toBe(0);
      expect(calculateRangePenetrationPct(MID, MIN, MAX)).toBe(50);
      expect(calculateRangePenetrationPct(MAX, MIN, MAX)).toBe(100);
      expect(calculateRangePenetrationPct(131250, MIN, MAX)).toBe(62.5);
    });

    it("handles out-of-range penetration below minimum (< 0.0)", () => {
      // Base = $90,000 (< Min $100,000) -> (90,000 - 100,000) / 50,000 = -0.20 (-20%)
      const belowMinPenetration = calculateRangePenetration(90000, MIN, MAX);
      expect(belowMinPenetration).toBe(-0.2);
      expect(calculateRangePenetrationPct(90000, MIN, MAX)).toBe(-20);
    });

    it("handles out-of-range penetration above maximum (> 1.0)", () => {
      // Base = $160,000 (> Max $150,000) -> (160,000 - 100,000) / 50,000 = 1.20 (120%)
      const aboveMaxPenetration = calculateRangePenetration(160000, MIN, MAX);
      expect(aboveMaxPenetration).toBe(1.2);
      expect(calculateRangePenetrationPct(160000, MIN, MAX)).toBe(120);
    });

    it("validates inputs and throws for invalid band boundaries or negative base", () => {
      expect(() => calculateRangePenetration(100000, 150000, 100000)).toThrowError(
        /Maximum must be greater than minimum/i
      );
      expect(() => calculateRangePenetration(100000, 100000, 100000)).toThrowError(
        /Maximum must be greater than minimum/i
      );
      expect(() => calculateRangePenetration(-10000, MIN, MAX)).toThrowError(
        /Base salary cannot be negative/i
      );
    });
  });

  describe("4. Green-circle (< Min) and Red-circle (> Max) boundary conditions", () => {
    // Boundary definitions:
    // Green-circle: Base < Min (strictly below minimum)
    // In-range:     Min <= Base <= Max (at or between bounds)
    // Red-circle:   Base > Max (strictly above maximum)

    const MIN = 100000;
    const MAX = 150000;
    const EPSILON = 0.01;

    describe("isGreenCircle (< Min)", () => {
      it("returns true when Base is strictly below Min", () => {
        expect(isGreenCircle(99999.99, MIN)).toBe(true);
        expect(isGreenCircle(MIN - EPSILON, MIN)).toBe(true);
        expect(isGreenCircle(85000, MIN)).toBe(true);
        expect(isGreenCircle(0, MIN)).toBe(true);
      });

      it("returns false at exactly Min boundary (boundary condition)", () => {
        expect(isGreenCircle(MIN, MIN)).toBe(false);
      });

      it("returns false when Base is above Min", () => {
        expect(isGreenCircle(MIN + EPSILON, MIN)).toBe(false);
        expect(isGreenCircle(125000, MIN)).toBe(false);
        expect(isGreenCircle(MAX, MIN)).toBe(false);
        expect(isGreenCircle(MAX + 10000, MIN)).toBe(false);
      });

      it("throws when Base is negative or Min <= 0", () => {
        expect(() => isGreenCircle(-1, MIN)).toThrowError(/Base salary cannot be negative/i);
        expect(() => isGreenCircle(100000, 0)).toThrowError(/Minimum must be greater than zero/i);
      });
    });

    describe("isRedCircle (> Max)", () => {
      it("returns true when Base is strictly above Max", () => {
        expect(isRedCircle(150000.01, MAX)).toBe(true);
        expect(isRedCircle(MAX + EPSILON, MAX)).toBe(true);
        expect(isRedCircle(175000, MAX)).toBe(true);
      });

      it("returns false at exactly Max boundary (boundary condition)", () => {
        expect(isRedCircle(MAX, MAX)).toBe(false);
      });

      it("returns false when Base is below Max", () => {
        expect(isRedCircle(MAX - EPSILON, MAX)).toBe(false);
        expect(isRedCircle(125000, MAX)).toBe(false);
        expect(isRedCircle(MIN, MAX)).toBe(false);
        expect(isRedCircle(MIN - 10000, MAX)).toBe(false);
      });

      it("throws when Base is negative or Max <= 0", () => {
        expect(() => isRedCircle(-1, MAX)).toThrowError(/Base salary cannot be negative/i);
        expect(() => isRedCircle(100000, 0)).toThrowError(/Maximum must be greater than zero/i);
      });
    });

    describe("isInRange (Min <= Base <= Max)", () => {
      it("returns true at exact Min boundary", () => {
        expect(isInRange(MIN, MIN, MAX)).toBe(true);
      });

      it("returns true at exact Max boundary", () => {
        expect(isInRange(MAX, MIN, MAX)).toBe(true);
      });

      it("returns true anywhere inside band", () => {
        expect(isInRange(MIN + EPSILON, MIN, MAX)).toBe(true);
        expect(isInRange(125000, MIN, MAX)).toBe(true);
        expect(isInRange(MAX - EPSILON, MIN, MAX)).toBe(true);
      });

      it("returns false when strictly below Min (Green-circle)", () => {
        expect(isInRange(MIN - EPSILON, MIN, MAX)).toBe(false);
        expect(isInRange(80000, MIN, MAX)).toBe(false);
      });

      it("returns false when strictly above Max (Red-circle)", () => {
        expect(isInRange(MAX + EPSILON, MIN, MAX)).toBe(false);
        expect(isInRange(160000, MIN, MAX)).toBe(false);
      });

      it("throws when Max <= Min or Base is negative", () => {
        expect(() => isInRange(100000, MAX, MIN)).toThrowError(
          /Maximum must be greater than minimum/i
        );
      });
    });

    describe("getPayCircleStatus (Classification)", () => {
      it("classifies pay strictly below Min as GREEN_CIRCLE", () => {
        expect(getPayCircleStatus(95000, MIN, MAX)).toBe("GREEN_CIRCLE");
        expect(getPayCircleStatus(MIN - EPSILON, MIN, MAX)).toBe("GREEN_CIRCLE");
      });

      it("classifies pay at exact Min boundary as IN_RANGE", () => {
        expect(getPayCircleStatus(MIN, MIN, MAX)).toBe("IN_RANGE");
      });

      it("classifies pay inside band as IN_RANGE", () => {
        expect(getPayCircleStatus(125000, MIN, MAX)).toBe("IN_RANGE");
      });

      it("classifies pay at exact Max boundary as IN_RANGE", () => {
        expect(getPayCircleStatus(MAX, MIN, MAX)).toBe("IN_RANGE");
      });

      it("classifies pay strictly above Max as RED_CIRCLE", () => {
        expect(getPayCircleStatus(MAX + EPSILON, MIN, MAX)).toBe("RED_CIRCLE");
        expect(getPayCircleStatus(165000, MIN, MAX)).toBe("RED_CIRCLE");
      });
    });
  });

  describe("5. Comprehensive Position Analysis (analyzeCompPosition)", () => {
    const MIN = 100000;
    const MAX = 150000;
    const MID = 125000;

    it("analyzes an in-band midpoint employee correctly", () => {
      const analysis = analyzeCompPosition(MID, MIN, MAX);
      expect(analysis).toEqual({
        base: MID,
        min: 100000,
        mid: 125000,
        max: 150000,
        spread: 0.5,
        compaRatio: 1.0,
        rangePenetration: 0.5,
        rangePenetrationPct: 50.0,
        isGreenCircle: false,
        isRedCircle: false,
        isInRange: true,
        circleStatus: "IN_RANGE",
      });
    });

    it("analyzes a green-circle employee requiring equity/merit adjustment", () => {
      const analysis = analyzeCompPosition(90000, MIN, MAX);
      expect(analysis.isGreenCircle).toBe(true);
      expect(analysis.isRedCircle).toBe(false);
      expect(analysis.isInRange).toBe(false);
      expect(analysis.circleStatus).toBe("GREEN_CIRCLE");
      expect(analysis.compaRatio).toBe(0.72);
      expect(analysis.rangePenetration).toBe(-0.2);
      expect(analysis.rangePenetrationPct).toBe(-20);
    });

    it("analyzes a red-circle employee requiring salary cap / exception governance", () => {
      const analysis = analyzeCompPosition(160000, MIN, MAX);
      expect(analysis.isGreenCircle).toBe(false);
      expect(analysis.isRedCircle).toBe(true);
      expect(analysis.isInRange).toBe(false);
      expect(analysis.circleStatus).toBe("RED_CIRCLE");
      expect(analysis.compaRatio).toBe(1.28);
      expect(analysis.rangePenetration).toBe(1.2);
      expect(analysis.rangePenetrationPct).toBe(120);
    });

    it("respects explicit midpoint override if provided", () => {
      // In cases where mid is explicitly set slightly asymmetric
      const customMid = 128000;
      const analysis = analyzeCompPosition(128000, MIN, MAX, customMid);
      expect(analysis.mid).toBe(128000);
      expect(analysis.compaRatio).toBe(1.0);
    });
  });

  describe("6. Real-World Enterprise Radford Benchmark Scenarios", () => {
    it("evaluates IC4 Staff Engineer against NextComp seeded band", () => {
      // From seed: IC4 Staff SWE has min: 225,000, mid: 265,000, max: 315,000
      const min = 225000;
      const mid = 265000;
      const max = 315000;
      const base = 265000; // Alex Vance from seed.ts

      const compa = calculateCompaRatio(base, mid);
      expect(compa).toBe(1.0);

      const penetration = calculateRangePenetration(base, min, max);
      // (265,000 - 225,000) / (315,000 - 225,000) = 40,000 / 90,000 = 0.4444...
      expect(penetration).toBeCloseTo(0.4444, 4);

      expect(isInRange(base, min, max)).toBe(true);
      expect(isGreenCircle(base, min)).toBe(false);
      expect(isRedCircle(base, max)).toBe(false);
    });

    it("evaluates promotion adjustment from IC2 to IC3 band", () => {
      // IC2 Max = 195,000. Employee promoted to IC3 (Min = 180,000, Mid = 210,000, Max = 250,000)
      const ic3Min = 180000;
      const ic3Mid = 210000;
      const ic3Max = 250000;

      // Promoted base: $200,000
      const newBase = 200000;
      const compa = calculateCompaRatio(newBase, ic3Mid);
      const penetration = calculateRangePenetrationPct(newBase, ic3Min, ic3Max);

      expect(compa).toBeCloseTo(0.9524, 4);
      // (200,000 - 180,000) / (250,000 - 180,000) * 100 = 20,000 / 70,000 * 100 = 28.57%
      expect(penetration).toBeCloseTo(28.5714, 3);
      expect(getPayCircleStatus(newBase, ic3Min, ic3Max)).toBe("IN_RANGE");
    });
  });

  describe("7. Incumbent Impact Summary Calculations", () => {
    const MIN = 100000;
    const MAX = 150000;

    describe("calculateGreenCircleCorrectionBudget", () => {
      it("calculates positive correction budget when base is below minimum", () => {
        // Base $85,000, Min $100,000 -> Needs $15,000 to bring to minimum
        expect(calculateGreenCircleCorrectionBudget(85000, MIN)).toBe(15000);
        expect(calculateGreenCircleCorrectionBudget(99500, MIN)).toBe(500);
      });

      it("returns 0 correction budget when base is at or above minimum", () => {
        expect(calculateGreenCircleCorrectionBudget(MIN, MIN)).toBe(0);
        expect(calculateGreenCircleCorrectionBudget(120000, MIN)).toBe(0);
        expect(calculateGreenCircleCorrectionBudget(MAX, MIN)).toBe(0);
        expect(calculateGreenCircleCorrectionBudget(180000, MIN)).toBe(0);
      });

      it("throws when inputs are invalid", () => {
        expect(() => calculateGreenCircleCorrectionBudget(-1000, MIN)).toThrowError(
          /Base salary cannot be negative/i
        );
        expect(() => calculateGreenCircleCorrectionBudget(80000, 0)).toThrowError(
          /Minimum must be greater than zero/i
        );
      });
    });

    describe("calculateIncumbentImpact", () => {
      it("correctly evaluates employees across departments, counting green/red circles and required budget", () => {
        const mockEmployees = [
          // Engineering
          {
            id: "emp-1",
            name: "Alex Vance",
            jobFamilyId: "eng-id",
            jobFamilyName: "Engineering",
            level: "IC4",
            currentBase: 220000, // Below min 225k -> Green Circle, needs 5,000
          },
          {
            id: "emp-2",
            name: "Elena Rostova",
            jobFamilyId: "eng-id",
            jobFamilyName: "Engineering",
            level: "IC3",
            currentBase: 260000, // Above max 250k -> Red Circle
          },
          {
            id: "emp-3",
            name: "Maya Patel",
            jobFamilyId: "eng-id",
            jobFamilyName: "Engineering",
            level: "IC2",
            currentBase: 165000, // Exactly mid 165k -> In Range
          },
          // Product
          {
            id: "emp-4",
            name: "Marcus Chen",
            jobFamilyId: "prod-id",
            jobFamilyName: "Product",
            level: "IC4",
            currentBase: 200000, // Below min 210k -> Green Circle, needs 10,000
          },
        ];

        const mockBands: Record<string, { min: number; mid: number; max: number; spread: number }> = {
          "eng-id_IC4": { min: 225000, mid: 265000, max: 315000, spread: 0.4 },
          "eng-id_IC3": { min: 180000, mid: 210000, max: 250000, spread: 0.3889 },
          "eng-id_IC2": { min: 140000, mid: 165000, max: 195000, spread: 0.3929 },
          "prod-id_IC4": { min: 210000, mid: 250000, max: 295000, spread: 0.4048 },
        };

        const result = calculateIncumbentImpact(mockEmployees, (familyId, level) => {
          return mockBands[`${familyId}_${level}`];
        });

        // Totals
        expect(result.totalEmployees).toBe(4);
        expect(result.greenCircleCount).toBe(2);
        expect(result.greenCircleCorrectionBudget).toBe(15000); // 5,000 (emp-1) + 10,000 (emp-4)
        expect(result.redCircleCount).toBe(1); // emp-2
        expect(result.inRangeCount).toBe(1); // emp-3

        // Compa-ratios:
        // emp-1: 220000 / 265000 = 0.830188
        // emp-2: 260000 / 210000 = 1.238095
        // emp-3: 165000 / 165000 = 1.000000
        // emp-4: 200000 / 250000 = 0.800000
        // Total avg = (0.830188 + 1.238095 + 1.000000 + 0.800000) / 4 = 3.868283 / 4 = 0.96707
        expect(result.averageCompaRatio).toBeCloseTo(0.9671, 3);

        // Department breakdown: Engineering
        const engDept = result.departmentMetrics["eng-id"];
        expect(engDept).toBeDefined();
        expect(engDept.departmentName).toBe("Engineering");
        expect(engDept.employeeCount).toBe(3);
        expect(engDept.greenCircleCount).toBe(1);
        expect(engDept.greenCircleCorrectionBudget).toBe(5000);
        expect(engDept.redCircleCount).toBe(1);
        expect(engDept.inRangeCount).toBe(1);
        // Eng avg compa-ratio = (0.830188 + 1.238095 + 1.000000) / 3 = 1.02276
        expect(engDept.averageCompaRatio).toBeCloseTo(1.0228, 3);

        // Department breakdown: Product
        const prodDept = result.departmentMetrics["prod-id"];
        expect(prodDept).toBeDefined();
        expect(prodDept.departmentName).toBe("Product");
        expect(prodDept.employeeCount).toBe(1);
        expect(prodDept.greenCircleCount).toBe(1);
        expect(prodDept.greenCircleCorrectionBudget).toBe(10000);
        expect(prodDept.redCircleCount).toBe(0);
        expect(prodDept.inRangeCount).toBe(0);
        expect(prodDept.averageCompaRatio).toBeCloseTo(0.8, 4);
      });

      it("recalculates immediately when bands shift dynamically", () => {
        const employees = [
          {
            id: "emp-1",
            name: "Dev",
            jobFamilyId: "f1",
            jobFamilyName: "Eng",
            level: "IC3",
            currentBase: 200000,
          },
        ];

        // Initial band: min 180k, mid 210k, max 250k -> In range
        let band = { min: 180000, mid: 210000, max: 250000, spread: 0.3889 };
        let impact = calculateIncumbentImpact(employees, () => band);
        expect(impact.greenCircleCount).toBe(0);
        expect(impact.greenCircleCorrectionBudget).toBe(0);
        expect(impact.redCircleCount).toBe(0);
        expect(impact.inRangeCount).toBe(1);

        // Adjust band midpoint higher: min 210k, mid 245k, max 290k -> Dev becomes Green Circle!
        band = { min: 210000, mid: 245000, max: 290000, spread: 0.381 };
        impact = calculateIncumbentImpact(employees, () => band);
        expect(impact.greenCircleCount).toBe(1);
        expect(impact.greenCircleCorrectionBudget).toBe(10000); // 210k - 200k
        expect(impact.redCircleCount).toBe(0);

        // Adjust band midpoint lower: min 140k, mid 165k, max 195k -> Dev becomes Red Circle!
        band = { min: 140000, mid: 165000, max: 195000, spread: 0.3929 };
        impact = calculateIncumbentImpact(employees, () => band);
        expect(impact.greenCircleCount).toBe(0);
        expect(impact.greenCircleCorrectionBudget).toBe(0);
        expect(impact.redCircleCount).toBe(1);
      });
    });
  });
});
