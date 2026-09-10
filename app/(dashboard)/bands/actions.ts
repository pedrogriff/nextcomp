"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface BandUpdatePayload {
  id: string;
  minBase: number;
  midBase: number;
  maxBase: number;
}

export async function updateSalaryBands(bands: BandUpdatePayload[]) {
  try {
    if (!bands || bands.length === 0) {
      return { success: false, error: "No salary bands provided for update" };
    }

    await prisma.$transaction(
      bands.map((band) =>
        prisma.salaryBand.update({
          where: { id: band.id },
          data: {
            minBase: new Prisma.Decimal(Math.round(band.minBase)),
            midBase: new Prisma.Decimal(Math.round(band.midBase)),
            maxBase: new Prisma.Decimal(Math.round(band.maxBase)),
          },
        })
      )
    );

    revalidatePath("/bands");
    return { success: true, count: bands.length };
  } catch (err) {
    console.error("Failed to update salary bands:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown database error occurred",
    };
  }
}
