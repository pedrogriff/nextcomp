import { task, logger } from "@trigger.dev/sdk/v3";
import { embed, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Payload schema for the batch-job-match task.
 */
export const BatchJobMatchPayloadSchema = z.object({
  roleId: z.string().min(1, "roleId must not be empty"),
  orgId: z.string().min(1, "orgId must not be empty"),
});

export type BatchJobMatchPayload = z.infer<typeof BatchJobMatchPayloadSchema>;

/**
 * Structured output schema for LLM evaluation verifying the WorldatWork 80% duty match rule.
 */
export const DutyMatchEvaluationSchema = z.object({
  dutyMatchPercentage: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Estimated percentage of core job duties and responsibilities matching the benchmark (0 to 100)"
    ),
  meetsEightyPercentRule: z
    .boolean()
    .describe(
      "Strict compliance check: true if dutyMatchPercentage is >= 80, confirming standard benchmark parity"
    ),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall statistical confidence score in the benchmark match (0.0 to 1.0)"),
  rationale: z
    .string()
    .describe(
      "Comprehensive compensation audit rationale explaining duty alignment, seniority scope, or mismatches"
    ),
  keyMatchingDuties: z
    .array(z.string())
    .describe("Primary responsibilities that directly align between role and benchmark"),
  gapOrDiscrepancies: z
    .array(z.string())
    .describe("Notable scope gaps, level divergences, or non-overlapping duties"),
});

export type DutyMatchEvaluation = z.infer<typeof DutyMatchEvaluationSchema>;

/**
 * Row returned from raw pgvector cosine distance query.
 */
export interface NearestBenchmarkRow {
  id: string;
  surveyProvider: string;
  surveyCode: string;
  jobTitle: string;
  level: string;
  location: string;
  p10Base: unknown;
  p50Base: unknown;
  p90Base: unknown;
  distance: number | string;
}

/**
 * Result structure for an evaluated benchmark match.
 */
export interface BenchmarkMatchResult {
  benchmarkId: string;
  surveyProvider: string;
  surveyCode: string;
  jobTitle: string;
  level: string;
  location: string;
  cosineDistance: number;
  similarityScore: number;
  dutyMatchPercentage: number;
  meetsEightyPercentRule: boolean;
  confidenceScore: number;
  rationale: string;
  keyMatchingDuties: string[];
  gapOrDiscrepancies: string[];
  mappingId: string;
}

/**
 * Output structure returned by the batch-job-match task.
 */
export interface BatchJobMatchOutput {
  success: boolean;
  roleId: string;
  orgId: string;
  roleTitle: string;
  roleLevel: string;
  evaluatedCandidatesCount: number;
  verifiedMatchesCount: number;
  matches: BenchmarkMatchResult[];
  primaryMatch: BenchmarkMatchResult | null;
}

export interface BatchJobMatchServices {
  embedFn?: (text: string) => Promise<number[]>;
  evaluateFn?: (
    roleData: {
      title: string;
      level: string;
      familyName: string;
      description?: string | null;
      responsibilities?: string | null;
    },
    neighbor: NearestBenchmarkRow,
    cosineSim: number
  ) => Promise<DutyMatchEvaluation>;
}

/**
 * Core processor for batch job duty matching and benchmark mapping.
 *
 * 1. Accepts roleId and orgId.
 * 2. Ingests job duties and generates 1536-dim embedding using Vercel AI SDK (text-embedding-3-large).
 * 3. Queries SurveyBenchmark using raw SQL with pgvector cosine distance operator (<=>) for top 5 nearest neighbors.
 * 4. Executes LLM evaluation (structured output via Zod) verifying the 80% duty match rule.
 * 5. Saves resulting confidence score and rationale to JobBenchmarkMapping.
 */
export async function processBatchJobMatch(
  payload: BatchJobMatchPayload,
  services: BatchJobMatchServices = {}
): Promise<BatchJobMatchOutput> {
  // Validate input payload
  const validated = BatchJobMatchPayloadSchema.parse(payload);
  const { roleId, orgId } = validated;

  logger.info(`[batch-job-match] Starting batch match for role '${roleId}' in org '${orgId}'`);

  // Step 1: Ingest the job duties from JobRole
  const role = await prisma.jobRole.findFirst({
    where: {
      id: roleId,
      jobFamily: {
        organizationId: orgId,
      },
    },
    include: {
      jobFamily: true,
    },
  });

  if (!role) {
    throw new Error(
      `JobRole '${roleId}' not found for organization '${orgId}'`
    );
  }

  const dutiesComponents = [
    `Job Title: ${role.title}`,
    `Level: ${role.level}`,
    `Job Family: ${role.jobFamily.name} (${role.jobFamily.code})`,
    role.description ? `Job Description: ${role.description}` : "",
    role.responsibilities
      ? `Responsibilities & Core Duties: ${role.responsibilities}`
      : "",
  ].filter(Boolean);

  const dutiesText = dutiesComponents.join("\n");

  // Step 2: Generate 1536-dim embedding using Vercel AI SDK (text-embedding-3-large)
  logger.info(
    `[batch-job-match] Generating 1536-dim embedding for role '${role.title}' (${role.level})...`
  );

  let embeddingVector: number[];
  if (services.embedFn) {
    embeddingVector = await services.embedFn(dutiesText);
  } else {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-large"),
      value: dutiesText,
    });
    embeddingVector = embedding;
  }

  if (embeddingVector.length !== 1536) {
    throw new Error(
      `Expected 1536-dimension embedding vector, received ${embeddingVector.length}`
    );
  }

  const vectorLiteral = `[${embeddingVector.join(",")}]`;

  // Persist the generated embedding to JobRole
  await prisma.$executeRawUnsafe(
    `UPDATE "JobRole" SET embedding = $1::vector WHERE id = $2`,
    vectorLiteral,
    role.id
  );

  // Step 3: Query SurveyBenchmark using raw SQL with pgvector cosine distance operator <=> for top 5 nearest neighbors
  logger.info(
    `[batch-job-match] Querying SurveyBenchmark for top 5 nearest neighbors using pgvector <=> operator...`
  );

  const rawNeighbors = await prisma.$queryRawUnsafe<NearestBenchmarkRow[]>(
    `SELECT 
       id,
       "surveyProvider",
       "surveyCode",
       "jobTitle",
       level,
       location,
       "p10Base",
       "p50Base",
       "p90Base",
       (embedding <=> $1::vector) AS distance
     FROM "SurveyBenchmark"
     WHERE embedding IS NOT NULL
       AND ("organizationId" = $2 OR "organizationId" IS NULL)
     ORDER BY (embedding <=> $1::vector) ASC
     LIMIT 5`,
    vectorLiteral,
    orgId
  );

  logger.info(
    `[batch-job-match] Retrieved ${rawNeighbors.length} nearest survey benchmark candidates.`
  );

  // Step 4 & 5: Execute LLM evaluation call (with structured output via Zod) verifying the 80% duty match rule
  // and save confidence score & rationale to JobBenchmarkMapping
  const matches: BenchmarkMatchResult[] = [];

  for (const neighbor of rawNeighbors) {
    const distanceNum =
      typeof neighbor.distance === "number"
        ? neighbor.distance
        : parseFloat(String(neighbor.distance));
    // Cosine similarity in [0, 1] derived from cosine distance: similarity = 1 - distance
    const cosineSim = Math.max(0, Math.min(1, 1 - distanceNum));

    let evalResult: DutyMatchEvaluation;

    if (services.evaluateFn) {
      evalResult = await services.evaluateFn(
        {
          title: role.title,
          level: role.level,
          familyName: role.jobFamily.name,
          description: role.description,
          responsibilities: role.responsibilities,
        },
        neighbor,
        cosineSim
      );
    } else {
      const evaluationPrompt = `You are a certified Total Rewards Compensation Director and Market Benchmarking Auditor.
Evaluate the alignment between the following internal Job Role and external Market Survey Benchmark according to the industry-standard WorldatWork 80% Duty Match Rule.

### Internal Job Role:
- Organization ID: ${orgId}
- Title: ${role.title}
- Level: ${role.level}
- Job Family: ${role.jobFamily.name} (${role.jobFamily.code})
- Description: ${role.description ?? "None provided"}
- Duties & Responsibilities: ${role.responsibilities ?? "None provided"}

### External Survey Benchmark Candidate:
- Benchmark ID: ${neighbor.id}
- Survey Provider: ${neighbor.surveyProvider}
- Survey Code: ${neighbor.surveyCode}
- Title: ${neighbor.jobTitle}
- Level: ${neighbor.level}
- Location: ${neighbor.location}
- P50 Base: $${String(neighbor.p50Base)}
- Vector Cosine Distance: ${distanceNum.toFixed(4)} (Cosine Similarity: ${(cosineSim * 100).toFixed(1)}%)

### Audit Requirements:
1. Estimate dutyMatchPercentage (0-100%): What proportion of core day-to-day duties and functional scope align?
2. WorldatWork 80% Rule: A benchmark mapping is deemed acceptable ONLY IF dutyMatchPercentage >= 80%. Set meetsEightyPercentRule = true if and only if dutyMatchPercentage >= 80.
3. Provide confidenceScore (0.0 to 1.0) incorporating functional duty match and career level parity.
4. Output detailed audit rationale, key matching duties, and any critical scope discrepancies.`;

      const llmResponse = await generateObject({
        model: openai("gpt-4o"),
        schema: DutyMatchEvaluationSchema,
        prompt: evaluationPrompt,
      });
      evalResult = llmResponse.object;
    }

    // Step 5: Save resulting confidence score and rationale to JobBenchmarkMapping
    const ruleTag = evalResult.meetsEightyPercentRule
      ? `[80% RULE PASSED: ${evalResult.dutyMatchPercentage.toFixed(1)}% MATCH]`
      : `[80% RULE FAILED: ${evalResult.dutyMatchPercentage.toFixed(1)}% MATCH]`;

    const auditNotes = `${ruleTag} ${evalResult.rationale}`.trim();
    // Default weight is 1.0 if compliant with 80% rule, 0.5 if below threshold
    const mappingWeight = evalResult.meetsEightyPercentRule ? 1.0 : 0.5;

    const mapping = await prisma.jobBenchmarkMapping.upsert({
      where: {
        jobRoleId_surveyBenchmarkId: {
          jobRoleId: role.id,
          surveyBenchmarkId: neighbor.id,
        },
      },
      create: {
        jobRoleId: role.id,
        surveyBenchmarkId: neighbor.id,
        weight: mappingWeight,
        similarityScore: evalResult.confidenceScore,
        notes: auditNotes,
      },
      update: {
        weight: mappingWeight,
        similarityScore: evalResult.confidenceScore,
        notes: auditNotes,
      },
    });

    matches.push({
      benchmarkId: neighbor.id,
      surveyProvider: neighbor.surveyProvider,
      surveyCode: neighbor.surveyCode,
      jobTitle: neighbor.jobTitle,
      level: neighbor.level,
      location: neighbor.location,
      cosineDistance: distanceNum,
      similarityScore: cosineSim,
      dutyMatchPercentage: evalResult.dutyMatchPercentage,
      meetsEightyPercentRule: evalResult.meetsEightyPercentRule,
      confidenceScore: evalResult.confidenceScore,
      rationale: evalResult.rationale,
      keyMatchingDuties: evalResult.keyMatchingDuties,
      gapOrDiscrepancies: evalResult.gapOrDiscrepancies,
      mappingId: mapping.id,
    });
  }

  const verifiedMatches = matches.filter((m) => m.meetsEightyPercentRule);
  const primaryMatch =
    verifiedMatches.length > 0 ? verifiedMatches[0] : matches[0] ?? null;

  logger.info(
    `[batch-job-match] Successfully mapped role '${role.title}' against ${matches.length} benchmarks. Verified matches: ${verifiedMatches.length}.`
  );

  return {
    success: true,
    roleId: role.id,
    orgId,
    roleTitle: role.title,
    roleLevel: role.level,
    evaluatedCandidatesCount: matches.length,
    verifiedMatchesCount: verifiedMatches.length,
    matches,
    primaryMatch,
  };
}

/**
 * Trigger.dev v3 Background Task definition.
 * Runs asynchronously for long-running batch job matching per CONTEXT.md Rule #3.
 */
export const batchJobMatch = task({
  id: "batch-job-match",
  run: async (payload: BatchJobMatchPayload): Promise<BatchJobMatchOutput> => {
    return processBatchJobMatch(payload);
  },
});

export default batchJobMatch;
