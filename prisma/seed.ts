import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

function generateMockVector(dim: number, seed: number): string {
  const vec: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(seed * 1000 + i * 0.17);
    vec.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1;
  const normalized = vec.map((v) => (v / norm).toFixed(6));
  return `[${normalized.join(",")}]`;
}

async function main() {
  console.log("🌱 Starting NextComp database seed...");

  // Clean existing records in reverse dependency order
  await prisma.meritAllocation.deleteMany();
  await prisma.compCycle.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.salaryBand.deleteMany();
  await prisma.jobBenchmarkMapping.deleteMany();
  await prisma.surveyBenchmark.deleteMany();
  await prisma.jobRole.deleteMany();
  await prisma.jobFamily.deleteMany();
  await prisma.organization.deleteMany();

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: "NextComp Technologies Inc.",
      slug: "nextcomp",
    },
  });
  console.log(`✓ Organization created: ${org.name} (${org.id})`);

  // 2. Create 3 Job Families
  const familiesData = [
    {
      name: "Engineering",
      code: "ENG",
      description: "Software engineering, infrastructure, distributed systems, and ML engineering.",
    },
    {
      name: "Product",
      code: "PROD",
      description: "Product strategy, roadmap execution, technical specifications, and user growth.",
    },
    {
      name: "Design",
      code: "DSGN",
      description: "Product design, user experience, visual identity, and design systems.",
    },
  ];

  const jobFamilies: Record<string, { id: string; code: string; name: string }> = {};
  for (const f of familiesData) {
    const created = await prisma.jobFamily.create({
      data: {
        organizationId: org.id,
        name: f.name,
        code: f.code,
        description: f.description,
      },
    });
    jobFamilies[f.code] = created;
    console.log(`✓ Job Family created: ${created.name} [${created.code}]`);
  }

  // 3. Create 6 IC Levels (IC1 - IC6) across all 3 Job Families
  const rolesConfig: Record<string, { level: string; title: string; desc: string }[]> = {
    ENG: [
      { level: "IC1", title: "Associate Software Engineer", desc: "Builds scoped features, writes unit tests, and contributes to code reviews." },
      { level: "IC2", title: "Software Engineer", desc: "Owns end-to-end features, designs robust APIs, and ensures high availability." },
      { level: "IC3", title: "Senior Software Engineer", desc: "Leads component architectures, mentors junior engineers, and drives tech standards." },
      { level: "IC4", title: "Staff Software Engineer", desc: "Drives multi-team technical strategy, distributed systems design, and scalability." },
      { level: "IC5", title: "Principal Software Engineer", desc: "Sets organization-wide technical direction, cross-domain innovations, and core architecture." },
      { level: "IC6", title: "Distinguished Engineer", desc: "Industry-recognized domain luminary, enterprise-critical foundational patents and systems." },
    ],
    PROD: [
      { level: "IC1", title: "Associate Product Manager", desc: "Assists with user stories, sprint backlog tracking, and competitive analysis." },
      { level: "IC2", title: "Product Manager", desc: "Owns product feature pods, user interviews, metrics telemetry, and roadmaps." },
      { level: "IC3", title: "Senior Product Manager", desc: "Leads key product pillars, cross-functional stakeholder alignment, and quarterly OKRs." },
      { level: "IC4", title: "Staff Product Manager", desc: "Defines cross-product domain strategy, revenue modeling, and portfolio prioritization." },
      { level: "IC5", title: "Principal Product Manager", desc: "Shapes overarching platform vision, multi-year product bets, and market expansions." },
      { level: "IC6", title: "VP / Product Fellow", desc: "Company-wide executive product fellow and principal strategist." },
    ],
    DSGN: [
      { level: "IC1", title: "Associate Product Designer", desc: "Supports UI asset production, wireframing, and design system component hygiene." },
      { level: "IC2", title: "Product Designer", desc: "Designs user flows, interactive prototypes, and usability testing validation." },
      { level: "IC3", title: "Senior Product Designer", desc: "Leads holistic design journeys, complex interactions, and design token architectures." },
      { level: "IC4", title: "Staff Product Designer", desc: "Sets enterprise design vision, multi-platform design systems, and design ops." },
      { level: "IC5", title: "Principal Product Designer", desc: "Elevates brand and product aesthetic standards across all product lines." },
      { level: "IC6", title: "Design Architect", desc: "Industry benchmark for spatial, interaction, and computational design excellence." },
    ],
  };

  const createdRoles: Record<string, string> = {}; // key: `${familyCode}_${level}` => id
  let vectorSeed = 1;

  for (const [familyCode, roles] of Object.entries(rolesConfig)) {
    const family = jobFamilies[familyCode];
    for (const role of roles) {
      const created = await prisma.jobRole.create({
        data: {
          jobFamilyId: family.id,
          title: role.title,
          level: role.level,
          description: role.desc,
          responsibilities: `Core responsibilities for ${role.title} (${role.level}) in ${family.name}.`,
        },
      });
      createdRoles[`${familyCode}_${role.level}`] = created.id;

      // Populate 1536-dimensional embedding column
      const vectorLiteral = generateMockVector(1536, vectorSeed++);
      await prisma.$executeRawUnsafe(
        `UPDATE "JobRole" SET embedding = '${vectorLiteral}'::vector WHERE id = '${created.id}'`
      );
    }
  }
  console.log(`✓ 18 Job Roles created across IC1-IC6 with 1536-dim vector embeddings.`);

  // 4. Create 10 Sample Radford-Style Market Benchmarks
  const radfordBenchmarks = [
    {
      provider: "Radford",
      code: "RAD-SWE-P1",
      title: "Software Engineer I (P1)",
      level: "IC1",
      familyCode: "ENG",
      location: "US-SF-Bay-Area",
      p10: 105000,
      p25: 120000,
      p50: 135000,
      p75: 152000,
      p90: 168000,
      totalCash: 145000,
      equity: 35000,
    },
    {
      provider: "Radford",
      code: "RAD-SWE-P2",
      title: "Software Engineer II (P2)",
      level: "IC2",
      familyCode: "ENG",
      location: "US-SF-Bay-Area",
      p10: 130000,
      p25: 145000,
      p50: 165000,
      p75: 185000,
      p90: 205000,
      totalCash: 180000,
      equity: 60000,
    },
    {
      provider: "Radford",
      code: "RAD-SWE-P3",
      title: "Senior Software Engineer (P3)",
      level: "IC3",
      familyCode: "ENG",
      location: "US-SF-Bay-Area",
      p10: 165000,
      p25: 185000,
      p50: 210000,
      p75: 235000,
      p90: 260000,
      totalCash: 235000,
      equity: 120000,
    },
    {
      provider: "Radford",
      code: "RAD-SWE-P4",
      title: "Staff Software Engineer (P4)",
      level: "IC4",
      familyCode: "ENG",
      location: "US-SF-Bay-Area",
      p10: 205000,
      p25: 230000,
      p50: 265000,
      p75: 295000,
      p90: 330000,
      totalCash: 300000,
      equity: 220000,
    },
    {
      provider: "Radford",
      code: "RAD-SWE-P5",
      title: "Principal Software Engineer (P5)",
      level: "IC5",
      familyCode: "ENG",
      location: "US-SF-Bay-Area",
      p10: 250000,
      p25: 280000,
      p50: 320000,
      p75: 360000,
      p90: 410000,
      totalCash: 375000,
      equity: 380000,
    },
    {
      provider: "Radford",
      code: "RAD-SWE-P6",
      title: "Distinguished Engineer (P6)",
      level: "IC6",
      familyCode: "ENG",
      location: "US-SF-Bay-Area",
      p10: 310000,
      p25: 350000,
      p50: 400000,
      p75: 460000,
      p90: 525000,
      totalCash: 480000,
      equity: 650000,
    },
    {
      provider: "Radford",
      code: "RAD-PM-P3",
      title: "Senior Product Manager (P3)",
      level: "IC3",
      familyCode: "PROD",
      location: "US-SF-Bay-Area",
      p10: 155000,
      p25: 175000,
      p50: 198000,
      p75: 220000,
      p90: 245000,
      totalCash: 220000,
      equity: 100000,
    },
    {
      provider: "Radford",
      code: "RAD-PM-P4",
      title: "Staff Product Manager (P4)",
      level: "IC4",
      familyCode: "PROD",
      location: "US-SF-Bay-Area",
      p10: 195000,
      p25: 220000,
      p50: 250000,
      p75: 280000,
      p90: 315000,
      totalCash: 285000,
      equity: 190000,
    },
    {
      provider: "Radford",
      code: "RAD-DSGN-P3",
      title: "Senior Product Designer (P3)",
      level: "IC3",
      familyCode: "DSGN",
      location: "US-SF-Bay-Area",
      p10: 145000,
      p25: 165000,
      p50: 188000,
      p75: 210000,
      p90: 235000,
      totalCash: 205000,
      equity: 90000,
    },
    {
      provider: "Radford",
      code: "RAD-DSGN-P4",
      title: "Staff Product Designer (P4)",
      level: "IC4",
      familyCode: "DSGN",
      location: "US-SF-Bay-Area",
      p10: 185000,
      p25: 205000,
      p50: 235000,
      p75: 265000,
      p90: 295000,
      totalCash: 265000,
      equity: 160000,
    },
  ];

  const benchmarkIdMap: Record<string, string> = {};
  for (const b of radfordBenchmarks) {
    const family = jobFamilies[b.familyCode];
    const created = await prisma.surveyBenchmark.create({
      data: {
        organizationId: org.id,
        jobFamilyId: family.id,
        surveyProvider: b.provider,
        surveyCode: b.code,
        jobTitle: b.title,
        level: b.level,
        location: b.location,
        p10Base: new Prisma.Decimal(b.p10),
        p25Base: new Prisma.Decimal(b.p25),
        p50Base: new Prisma.Decimal(b.p50),
        p75Base: new Prisma.Decimal(b.p75),
        p90Base: new Prisma.Decimal(b.p90),
        p50TotalCash: new Prisma.Decimal(b.totalCash),
        p50Equity: new Prisma.Decimal(b.equity),
        effectiveDate: new Date("2026-01-01T00:00:00Z"),
      },
    });
    benchmarkIdMap[b.code] = created.id;

    // Map benchmark to matching JobRole
    const roleKey = `${b.familyCode}_${b.level}`;
    const roleId = createdRoles[roleKey];
    if (roleId) {
      await prisma.jobBenchmarkMapping.create({
        data: {
          jobRoleId: roleId,
          surveyBenchmarkId: created.id,
          weight: 1.0,
          similarityScore: 0.98,
          notes: `Primary market match for ${b.title} (${b.code})`,
        },
      });
    }
  }
  console.log(`✓ 10 Radford-style SurveyBenchmarks created and mapped to JobRoles.`);

  // 5. Seed Salary Bands for all levels (US_ZONE_1)
  const salaryBandBase: Record<string, { min: number; mid: number; max: number; equity: number }> = {
    IC1: { min: 110000, mid: 135000, max: 160000, equity: 35000 },
    IC2: { min: 140000, mid: 165000, max: 195000, equity: 65000 },
    IC3: { min: 180000, mid: 210000, max: 250000, equity: 130000 },
    IC4: { min: 225000, mid: 265000, max: 315000, equity: 240000 },
    IC5: { min: 275000, mid: 325000, max: 390000, equity: 420000 },
    IC6: { min: 340000, mid: 410000, max: 500000, equity: 700000 },
  };

  for (const [code, family] of Object.entries(jobFamilies)) {
    const factor = code === "ENG" ? 1.0 : code === "PROD" ? 0.95 : 0.90;
    for (const [lvl, band] of Object.entries(salaryBandBase)) {
      await prisma.salaryBand.create({
        data: {
          organizationId: org.id,
          jobFamilyId: family.id,
          level: lvl,
          locationTier: "US_ZONE_1",
          minBase: new Prisma.Decimal(Math.round(band.min * factor)),
          midBase: new Prisma.Decimal(Math.round(band.mid * factor)),
          maxBase: new Prisma.Decimal(Math.round(band.max * factor)),
          targetEquity: new Prisma.Decimal(Math.round(band.equity * factor)),
          currency: "USD",
          effectiveYear: 2026,
        },
      });
    }
  }
  console.log(`✓ Salary Bands created for Engineering, Product, and Design (IC1-IC6).`);

  // 6. Seed Sample Employees
  const employeeData = [
    {
      num: "EMP-001",
      first: "Alex",
      last: "Vance",
      email: "alex.vance@nextcomp.local",
      family: "ENG",
      level: "IC4",
      base: 265000,
      equity: 15000,
      rating: "EXCEEDS",
      hire: "2022-03-15",
    },
    {
      num: "EMP-002",
      first: "Elena",
      last: "Rostova",
      email: "elena.rostova@nextcomp.local",
      family: "ENG",
      level: "IC3",
      base: 205000,
      equity: 8000,
      rating: "STRONGLY_OUTPERFORMS",
      hire: "2023-06-01",
    },
    {
      num: "EMP-003",
      first: "Marcus",
      last: "Chen",
      email: "marcus.chen@nextcomp.local",
      family: "PROD",
      level: "IC4",
      base: 245000,
      equity: 12000,
      rating: "CONSISTENTLY_MEETS",
      hire: "2021-11-10",
    },
    {
      num: "EMP-004",
      first: "Sarah",
      last: "Lin",
      email: "sarah.lin@nextcomp.local",
      family: "DSGN",
      level: "IC3",
      base: 185000,
      equity: 6500,
      rating: "EXCEEDS",
      hire: "2023-01-20",
    },
  ];

  const seededEmployees = [];
  for (const emp of employeeData) {
    const roleId = createdRoles[`${emp.family}_${emp.level}`];
    const created = await prisma.employee.create({
      data: {
        organizationId: org.id,
        jobRoleId: roleId,
        employeeNumber: emp.num,
        firstName: emp.first,
        lastName: emp.last,
        email: emp.email,
        currentLevel: emp.level,
        location: "US-San-Francisco",
        locationTier: "US_ZONE_1",
        currentBase: new Prisma.Decimal(emp.base),
        currentEquityUnits: emp.equity,
        performanceRating: emp.rating,
        hireDate: new Date(emp.hire),
      },
    });
    seededEmployees.push(created);
  }
  console.log(`✓ Sample Employees created.`);

  // 7. Seed CompCycle & MeritAllocation
  const cycle = await prisma.compCycle.create({
    data: {
      organizationId: org.id,
      name: "2026 H1 Total Rewards Planning Cycle",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-03-31T00:00:00Z"),
      effectiveDate: new Date("2026-04-01T00:00:00Z"),
      status: "ACTIVE",
      totalBudgetCash: new Prisma.Decimal(1250000.0),
      totalBudgetEquity: 100000,
    },
  });
  console.log(`✓ CompCycle created: ${cycle.name}`);

  for (const emp of seededEmployees) {
    const curBase = Number(emp.currentBase);
    const meritPct = 6.5;
    const proposed = Math.round(curBase * (1 + meritPct / 100));
    await prisma.meritAllocation.create({
      data: {
        compCycleId: cycle.id,
        employeeId: emp.id,
        previousBase: emp.currentBase,
        proposedBase: new Prisma.Decimal(proposed),
        meritIncreasePct: new Prisma.Decimal(meritPct),
        promoIncreasePct: new Prisma.Decimal(0.0),
        proposedEquityUnits: 1500,
        status: "AUTO_APPROVED",
        auditNotes: "Automated audit: in-band compliance confirmed against Radford P50 benchmark.",
      },
    });
  }
  console.log(`✓ MeritAllocations seeded for active cycle.`);

  console.log("🚀 NextComp database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
