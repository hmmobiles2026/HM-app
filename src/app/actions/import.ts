"use server";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

export type ImportResult = {
  total: number;
  created: number;
  errors: { row: number; error: string }[];
} | { error: string };

export async function importStockCSV(_state: unknown, formData: FormData): Promise<ImportResult> {
  const session = await verifySession();
  if (session.role === "SELLER") return { error: "Unauthorized" };

  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) return { error: "No file uploaded." };
  if (!file.name.endsWith(".csv")) return { error: "Please upload a .csv file." };

  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: "CSV must have a header row and at least one data row." };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const col = (row: string[], name: string): string => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  let created = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const rowNum = i + 1;

    try {
      const brandName = col(row, "brand");
      const modelName = col(row, "model");
      const categoryName = col(row, "category");
      const name = col(row, "name");
      const grade = col(row, "grade").toUpperCase() || "ORIGINAL";
      const costPrice = parseFloat(col(row, "cost_price") || col(row, "cost"));
      const sellingPrice = parseFloat(col(row, "selling_price") || col(row, "selling"));
      const stockQty = parseInt(col(row, "qty") || col(row, "stock_qty") || "0");
      const lowStockThreshold = parseInt(col(row, "threshold") || col(row, "low_stock_threshold") || "5");

      if (!brandName) { errors.push({ row: rowNum, error: "Missing brand" }); continue; }
      if (!categoryName) { errors.push({ row: rowNum, error: "Missing category" }); continue; }
      if (!name) { errors.push({ row: rowNum, error: "Missing name" }); continue; }
      if (isNaN(costPrice) || costPrice < 0) { errors.push({ row: rowNum, error: "Invalid cost_price" }); continue; }
      if (isNaN(sellingPrice) || sellingPrice < 0) { errors.push({ row: rowNum, error: "Invalid selling_price" }); continue; }

      const validGrades = ["ORIGINAL", "COPY_A", "COPY_B", "OTHER"];
      const qualityGrade = validGrades.includes(grade) ? grade as "ORIGINAL" | "COPY_A" | "COPY_B" | "OTHER" : "OTHER";

      const [brand, category] = await Promise.all([
        prisma.brand.upsert({
          where: { name: brandName },
          create: { name: brandName },
          update: {},
        }),
        prisma.category.upsert({
          where: { name: categoryName },
          create: { name: categoryName },
          update: {},
        }),
      ]);

      let modelId: string | null = null;
      if (modelName) {
        const model = await prisma.phoneModel.upsert({
          where: { brandId_name: { brandId: brand.id, name: modelName } },
          create: { brandId: brand.id, name: modelName },
          update: {},
        });
        modelId = model.id;
      }

      await prisma.product.create({
        data: {
          name,
          brandId: brand.id,
          modelId,
          categoryId: category.id,
          qualityGrade,
          costPrice,
          sellingPrice,
          stockQty: isNaN(stockQty) ? 0 : stockQty,
          lowStockThreshold: isNaN(lowStockThreshold) ? 5 : lowStockThreshold,
        },
      });

      created++;
    } catch {
      errors.push({ row: rowNum, error: "Database error — check for duplicate product." });
    }
  }

  return { total: lines.length - 1, created, errors };
}
