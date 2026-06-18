import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const data: Record<string, string[]> = {
  Samsung: [
    // A series
    "A04", "A04e", "A04s",
    "A05", "A05s",
    "A12", "A13", "A13s", "A13 5G",
    "A14", "A14 5G",
    "A15", "A15s", "A15 5G",
    "A22", "A22 5G",
    "A23", "A23 5G",
    "A24",
    "A25", "A25 5G",
    "A32", "A32 5G",
    "A33 5G",
    "A34 5G",
    "A35 5G",
    "A52", "A52s 5G",
    "A53 5G",
    "A54 5G",
    "A55 5G",
    "A72",
    "A73 5G",
    // M series
    "M12", "M13", "M14", "M15",
    "M21", "M22", "M31", "M32",
    "M33 5G", "M34 5G",
    "M52", "M53 5G", "M54 5G",
    // F series
    "F13", "F14", "F15",
    "F23", "F34", "F54", "F55",
    // S series
    "S20", "S20+", "S20 Ultra",
    "S21", "S21+", "S21 Ultra",
    "S22", "S22+", "S22 Ultra",
    "S23", "S23+", "S23 Ultra",
    "S24", "S24+", "S24 Ultra",
  ],

  iPhone: [
    "X", "XR", "XS", "XS Max",
    "11", "11 Pro", "11 Pro Max",
    "12", "12 mini", "12 Pro", "12 Pro Max",
    "13", "13 mini", "13 Pro", "13 Pro Max",
    "14", "14 Plus", "14 Pro", "14 Pro Max",
    "15", "15 Plus", "15 Pro", "15 Pro Max",
    "16", "16 Plus", "16 Pro", "16 Pro Max",
  ],

  Redmi: [
    "9", "9A", "9C",
    "10", "10A", "10C",
    "12", "12C",
    "13", "13C",
    "A1", "A2", "A3",
    "Note 8", "Note 9", "Note 9s",
    "Note 10", "Note 10s",
    "Note 11", "Note 11s",
    "Note 12", "Note 12s",
    "Note 13", "Note 13 Pro", "Note 13 Pro+",
  ],

  Xiaomi: [
    "Mi 11", "Mi 11 Lite", "Mi 11T",
    "12", "12 Pro",
    "13", "13 Pro",
    "14",
    "POCO M3", "POCO M4", "POCO M5", "POCO M6",
    "POCO X3", "POCO X4", "POCO X5", "POCO X6",
    "POCO F3", "POCO F5",
    "POCO C51", "POCO C55", "POCO C65",
  ],

  Oppo: [
    // A series
    "A15", "A16", "A17", "A17k",
    "A18", "A38",
    "A52", "A54", "A55",
    "A57", "A57s",
    "A58", "A58x",
    "A74", "A76", "A77",
    "A78", "A78 5G",
    "A95", "A96", "A98",
    // F series
    "F9", "F11", "F17", "F19",
    "F21 Pro", "F23", "F25 Pro", "F27 Pro",
    // Reno series
    "Reno 5", "Reno 6", "Reno 7",
    "Reno 8", "Reno 8T",
    "Reno 10", "Reno 10 Pro",
    "Reno 11", "Reno 11 Pro",
  ],

  Vivo: [
    // Y series
    "Y02", "Y02s", "Y02t",
    "Y11", "Y12s", "Y15s",
    "Y16", "Y17s",
    "Y20", "Y21", "Y22",
    "Y27", "Y28",
    "Y33s", "Y35", "Y36",
    "Y52", "Y55", "Y55s",
    "Y72", "Y76", "Y77",
    // V series
    "V21", "V23", "V25",
    "V27", "V27e",
    "V29", "V29e",
    "V30", "V30e",
    "V40",
    // T series
    "T1x", "T2x",
  ],

  Realme: [
    // C series
    "C11", "C12", "C15",
    "C20", "C21", "C25", "C25s",
    "C30", "C31", "C33", "C35",
    "C51", "C53", "C55",
    "C65", "C67",
    // Number series
    "5", "5i", "6", "6i", "7", "7i",
    "8", "8s", "8i",
    "9", "9i",
    "10", "10s",
    "11", "11x",
    "12", "12+",
    // Narzo series
    "Narzo 20", "Narzo 30A",
    "Narzo 50i", "Narzo 50",
    "Narzo N53", "Narzo N55",
  ],

  Huawei: [
    "P30", "P30 Lite", "P30 Pro",
    "P40", "P40 Lite",
    "Y5", "Y6", "Y6p",
    "Y7", "Y7p",
    "Y8p", "Y9", "Y9s",
    "Nova 3i", "Nova 4",
    "Nova 5T", "Nova 7i",
  ],

  Nokia: [
    "C21", "C22", "C32",
    "G21", "G42",
    "X21",
    "3.4", "5.3", "6.3",
  ],

  Motorola: [
    "Moto G9", "Moto G9 Power",
    "Moto G13", "Moto G14",
    "Moto G22", "Moto G32",
    "Moto G42", "Moto G52",
    "Moto G62", "Moto G72",
    "Moto G82", "Moto G84",
    "Moto E13", "Moto E22",
  ],

  Tecno: [
    // Spark series
    "Spark 6", "Spark 7", "Spark 8",
    "Spark 8C", "Spark 8P",
    "Spark 9", "Spark 9T",
    "Spark 10", "Spark 10C", "Spark 10B",
    "Spark 20", "Spark 20C",
    // Pop series
    "Pop 5", "Pop 6", "Pop 7", "Pop 8",
    // Camon series
    "Camon 15", "Camon 16",
    "Camon 17", "Camon 18",
    "Camon 19", "Camon 20",
  ],

  Infinix: [
    // Hot series
    "Hot 9", "Hot 10", "Hot 10i",
    "Hot 11", "Hot 12", "Hot 12i",
    "Hot 20", "Hot 20i",
    "Hot 30", "Hot 30i",
    "Hot 40", "Hot 40i",
    // Note series
    "Note 10", "Note 11", "Note 12",
    "Note 30", "Note 40",
    // Smart series
    "Smart 6", "Smart 7", "Smart 8",
  ],

  OnePlus: [
    "8", "8 Pro", "8T",
    "9", "9 Pro", "9R",
    "10 Pro", "10T",
    "11", "11R",
    "12",
    "Nord CE", "Nord CE 2", "Nord CE 3",
    "Nord N10", "Nord N20",
  ],

  Sony: [
    "Xperia 10 III",
    "Xperia 10 IV",
    "Xperia 10 V",
    "Xperia 1 III",
    "Xperia 1 IV",
    "Xperia 1 V",
  ],

  Itel: [
    "A23", "A26", "A36",
    "P40", "P55",
    "S23", "S24",
    "Vision 1", "Vision 2", "Vision 3",
  ],
};

async function main() {
  console.log("Seeding brands and models for Sri Lanka market...\n");

  let totalBrands = 0;
  let totalModels = 0;

  for (const [brandName, models] of Object.entries(data)) {
    const brand = await prisma.brand.findFirst({ where: { name: brandName, deletedAt: null } })
      ?? await prisma.brand.create({ data: { name: brandName } });

    let added = 0;
    for (const model of models) {
      await (prisma.phoneModel.findFirst({ where: { brandId: brand.id, name: model, deletedAt: null } })
        .then(existing => existing ?? prisma.phoneModel.create({ data: { name: model, brandId: brand.id } })));
      added++;
    }

    console.log(`✓ ${brandName}: ${added} models`);
    totalBrands++;
    totalModels += added;
  }

  console.log(`\n✅ Done — ${totalBrands} brands, ${totalModels} models`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
