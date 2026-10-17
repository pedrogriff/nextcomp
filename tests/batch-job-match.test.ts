import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import {
  processBatchJobMatch,
  BatchJobMatchPayloadSchema,
  DutyMatchEvaluationSchema,
  DutyMatchEvaluation,
} from "../app/trigger/batch-job-match";

describe("Batch Job Match Trigger.dev Task (app/trigger/batch-job-match.ts)", () => {
  let testOrgId: string;
  let testRoleId: string;
  let seededBenchmarkCount: number;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({
      where: { slug: "nextcomp" },
    });
    if (!org) {
      throw new Error("Seeded organization 'nextcomp' not found. Run db seed first.");
    }
    testOrgId = org.id;

    // Find IC3 Senior Software Engineer role in Engineering family
    const role = await prisma.jobRole.findFirst({
      where: {
        level: "IC3",
        jobFamily: {
          organizationId: testOrgId,
          code: "ENG",
        },
      },
      include: {
        jobFamily: true,
      },
    });
    if (!role) {
      throw new Error("Seeded IC3 ENG JobRole not found.");
    }
    testRoleId = role.id;

    seededBenchmarkCount = await prisma.surveyBenchmark.count({
      where: {
        organizationId: testOrgId,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Schema and Type Invariants", () => {
    it("validates payload correctly using BatchJobMatchPayloadSchema", () => {
      const valid = BatchJobMatchPayloadSchema.safeParse({
        roleId: testRoleId,
        orgId: testOrgId,
      });
      expect(valid.success).toBe(true);

      const invalid = BatchJobMatchPayloadSchema.safeParse({
        roleId: "",
        orgId: "",
      });
      expect(invalid.success).toBe(false);
    });

    it("validates structured LLM output using DutyMatchEvaluationSchema", () => {
      const validEval: DutyMatchEvaluation = {
        dutyMatchPercentage: 85.5,
        meetsEightyPercentRule: true,
        confidenceScore: 0.92,
        rationale:
          "Over 85% core distributed systems engineering responsibilities align with the survey P3 benchmark.",
        keyMatchingDuties: ["Writes robust unit tests", "Designs scalable APIs"],
        gapOrDiscrepancies: [],
      };

      const result = DutyMatchEvaluationSchema.safeParse(validEval);
      expect(result.success).toBe(true);

      // Verify boundary rule validation
      const failingEval = {
        dutyMatchPercentage: 65.0,
        meetsEightyPercentRule: false,
        confidenceScore: 0.58,
        rationale: "Only 65% overlap; scope diverges significantly from benchmark.",
        keyMatchingDuties: ["Code reviews"],
        gapOrDiscrepancies: ["Lacks distributed architecture scope"],
      };
      expect(DutyMatchEvaluationSchema.safeParse(failingEval).success).toBe(true);
    });
  });

  describe("End-to-End Task Processor Execution", () => {
    it("executes the full 5-step pipeline with pgvector <=> query and saves mappings", async () => {
      // Deterministic mock 1536-dim embedding vector
      const mockVector: number[] = Array.from({ length: 1536 }, (_, i) =>
        parseFloat((Math.sin(i * 0.17 + 100) / Math.sqrt(1536)).toFixed(6))
      );

      const output = await processBatchJobMatch(
        {
          roleId: testRoleId,
          orgId: testOrgId,
        },
        {
          embedFn: async (text: string) => {
            expect(text).toContain("Job Title: Senior Software Engineer");
            expect(text).toContain("Level: IC3");
            return mockVector;
          },
          evaluateFn: async (roleData, neighbor, cosineSim) => {
            expect(roleData.title).toBe("Senior Software Engineer");
            expect(neighbor.id).toBeDefined();
            expect(typeof cosineSim).toBe("number");

            // Evaluate: If benchmark is also IC3, give 88% match (passes 80% rule)
            const isMatch = neighbor.level === "IC3";
            return {
              dutyMatchPercentage: isMatch ? 88.0 : 62.0,
              meetsEightyPercentRule: isMatch,
              confidenceScore: isMatch ? 0.94 : 0.65,
              rationale: isMatch
                ? `Strong 88% alignment with ${neighbor.jobTitle} (${neighbor.surveyCode}). Meets 80% rule.`
                : `Level divergence: ${neighbor.level} vs IC3. Duty overlap at 62% is below 80% threshold.`,
              keyMatchingDuties: [
                "Component architecture design",
                "Mentorship & technical standards",
              ],
              gapOrDiscrepancies: isMatch ? [] : ["Scope and seniority mismatch"],
            };
          },
        }
      );

      // 1. Verify output shape and types
      expect(seededBenchmarkCount).toBeGreaterThan(0);
      expect(output.success).toBe(true);
      expect(output.roleId).toBe(testRoleId);
      expect(output.orgId).toBe(testOrgId);
      expect(output.roleTitle).toBe("Senior Software Engineer");
      expect(output.roleLevel).toBe("IC3");
      expect(output.evaluatedCandidatesCount).toBeLessThanOrEqual(5);
      expect(output.evaluatedCandidatesCount).toBeGreaterThan(0);
      expect(output.matches.length).toBe(output.evaluatedCandidatesCount);

      // 2. Verify pgvector distance ordering (<=> operator ordered ASC)
      for (let i = 0; i < output.matches.length - 1; i++) {
        expect(output.matches[i].cosineDistance).toBeLessThanOrEqual(
          output.matches[i + 1].cosineDistance
        );
      }

      // 3. Verify that JobBenchmarkMapping records were persisted in database
      for (const match of output.matches) {
        const mapping = await prisma.jobBenchmarkMapping.findUnique({
          where: {
            jobRoleId_surveyBenchmarkId: {
              jobRoleId: testRoleId,
              surveyBenchmarkId: match.benchmarkId,
            },
          },
        });
        expect(mapping).not.toBeNull();
        expect(mapping?.similarityScore).toBeCloseTo(match.confidenceScore, 4);
        expect(mapping?.notes).toContain(
          match.meetsEightyPercentRule ? "[80% RULE PASSED" : "[80% RULE FAILED"
        );
        expect(mapping?.weight).toBe(match.meetsEightyPercentRule ? 1.0 : 0.5);
      }
    });

    it("throws a descriptive error when roleId does not exist or orgId mismatches", async () => {
      await expect(
        processBatchJobMatch({
          roleId: "non-existent-role-id",
          orgId: testOrgId,
        })
      ).rejects.toThrowError(/JobRole 'non-existent-role-id' not found/i);

      await expect(
        processBatchJobMatch({
          roleId: testRoleId,
          orgId: "mismatched-org-id",
        })
      ).rejects.toThrowError(/not found for organization 'mismatched-org-id'/i);
    });

    it("throws if the embedding dimensions are not 1536", async () => {
      await expect(
        processBatchJobMatch(
          {
            roleId: testRoleId,
            orgId: testOrgId,
          },
          {
            embedFn: async () => [0.1, 0.2, 0.3], // Invalid: only 3 dimensions
          }
        )
      ).rejects.toThrowError(/Expected 1536-dimension embedding vector, received 3/i);
    });
  });
});
