import prisma from "@/lib/prisma";
import SalaryRangeWorkbenchClient, {
  SerializableJobFamily,
  SerializableSalaryBand,
  SerializableEmployee,
} from "./SalaryRangeWorkbenchClient";

export const metadata = {
  title: "Salary Range Workbench | NextComp",
  description:
    "Interactive compensation modeling workbench: adjust midpoint and spread %, preview dynamic recalculations, and evaluate real-time incumbent circle impact.",
};

export default async function SalaryBandsPage() {
  // 1. Fetch Job Families, Salary Bands, and Employees via Prisma ORM
  const [jobFamiliesRaw, salaryBandsRaw, employeesRaw] = await Promise.all([
    prisma.jobFamily.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.salaryBand.findMany({
      include: {
        jobFamily: true,
      },
      orderBy: [{ level: "asc" }],
    }),
    prisma.employee.findMany({
      include: {
        jobRole: {
          include: {
            jobFamily: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  // 2. Normalize and serialize Prisma Decimal types to standard JSON numbers
  const jobFamilies: SerializableJobFamily[] = jobFamiliesRaw.map((f) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    description: f.description || "",
  }));

  const salaryBands: SerializableSalaryBand[] = salaryBandsRaw.map((b) => ({
    id: b.id,
    jobFamilyId: b.jobFamilyId || "",
    jobFamilyCode: b.jobFamily?.code || "",
    jobFamilyName: b.jobFamily?.name || "",
    level: b.level,
    locationTier: b.locationTier,
    minBase: Number(b.minBase),
    midBase: Number(b.midBase),
    maxBase: Number(b.maxBase),
    targetEquity: b.targetEquity ? Number(b.targetEquity) : null,
    currency: b.currency,
    effectiveYear: b.effectiveYear,
  }));

  const employees: SerializableEmployee[] = employeesRaw.map((e) => ({
    id: e.id,
    employeeNumber: e.employeeNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    fullName: `${e.firstName} ${e.lastName}`,
    email: e.email,
    currentLevel: e.currentLevel,
    locationTier: e.locationTier,
    currentBase: Number(e.currentBase),
    jobRoleTitle: e.jobRole.title,
    jobRoleId: e.jobRoleId,
    jobFamilyId: e.jobRole.jobFamily.id,
    jobFamilyCode: e.jobRole.jobFamily.code,
    jobFamilyName: e.jobRole.jobFamily.name,
    performanceRating: e.performanceRating,
  }));

  return (
    <SalaryRangeWorkbenchClient
      initialJobFamilies={jobFamilies}
      initialSalaryBands={salaryBands}
      initialEmployees={employees}
    />
  );
}
