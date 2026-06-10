import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: "Display" }, update: {}, create: { name: "Display" } }),
    prisma.category.upsert({ where: { name: "Battery" }, update: {}, create: { name: "Battery" } }),
    prisma.category.upsert({ where: { name: "Power Flex" }, update: {}, create: { name: "Power Flex" } }),
    prisma.category.upsert({ where: { name: "Volume Flex" }, update: {}, create: { name: "Volume Flex" } }),
    prisma.category.upsert({ where: { name: "Charging Port" }, update: {}, create: { name: "Charging Port" } }),
    prisma.category.upsert({ where: { name: "Back Cover" }, update: {}, create: { name: "Back Cover" } }),
    prisma.category.upsert({ where: { name: "Camera" }, update: {}, create: { name: "Camera" } }),
    prisma.category.upsert({ where: { name: "Speaker" }, update: {}, create: { name: "Speaker" } }),
  ]);
  console.log(`✓ ${categories.length} categories`);

  // Brands + Models
  const samsung = await prisma.brand.upsert({
    where: { name: "Samsung" },
    update: {},
    create: { name: "Samsung" },
  });
  const samsungModels = ["A54", "A34", "A14", "A04", "S23", "S22", "S21", "A52", "A72", "M14"];
  for (const m of samsungModels) {
    await prisma.phoneModel.upsert({
      where: { brandId_name: { brandId: samsung.id, name: m } },
      update: {},
      create: { name: m, brandId: samsung.id },
    });
  }

  const redmi = await prisma.brand.upsert({
    where: { name: "Redmi" },
    update: {},
    create: { name: "Redmi" },
  });
  const redmiModels = ["Note 12", "Note 11", "Note 10", "Note 9", "12C", "10C", "9C", "A2"];
  for (const m of redmiModels) {
    await prisma.phoneModel.upsert({
      where: { brandId_name: { brandId: redmi.id, name: m } },
      update: {},
      create: { name: m, brandId: redmi.id },
    });
  }

  const iphone = await prisma.brand.upsert({
    where: { name: "iPhone" },
    update: {},
    create: { name: "iPhone" },
  });
  const iphoneModels = ["15 Pro Max", "15 Pro", "15", "14 Pro Max", "14 Pro", "14", "13", "12", "11", "XR"];
  for (const m of iphoneModels) {
    await prisma.phoneModel.upsert({
      where: { brandId_name: { brandId: iphone.id, name: m } },
      update: {},
      create: { name: m, brandId: iphone.id },
    });
  }

  const oppo = await prisma.brand.upsert({
    where: { name: "Oppo" },
    update: {},
    create: { name: "Oppo" },
  });
  for (const m of ["A78", "A58", "A38", "A18", "Reno 8"]) {
    await prisma.phoneModel.upsert({
      where: { brandId_name: { brandId: oppo.id, name: m } },
      update: {},
      create: { name: m, brandId: oppo.id },
    });
  }

  const vivo = await prisma.brand.upsert({
    where: { name: "Vivo" },
    update: {},
    create: { name: "Vivo" },
  });
  for (const m of ["Y36", "Y27", "Y22", "Y16", "V29"]) {
    await prisma.phoneModel.upsert({
      where: { brandId_name: { brandId: vivo.id, name: m } },
      update: {},
      create: { name: m, brandId: vivo.id },
    });
  }

  console.log("✓ 5 brands + models seeded");

  // Admin user
  const adminPw = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@hmstocks.lk" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@hmstocks.lk",
      password: adminPw,
      role: "ADMIN",
    },
  });

  // Owner user
  const ownerPw = await bcrypt.hash("owner123", 10);
  const owner = await prisma.user.upsert({
    where: { email: "owner@hmstocks.lk" },
    update: {},
    create: {
      name: "Shop Owner",
      email: "owner@hmstocks.lk",
      password: ownerPw,
      role: "OWNER",
    },
  });

  // Seller user
  const sellerPw = await bcrypt.hash("seller123", 10);
  await prisma.user.upsert({
    where: { email: "seller@hmstocks.lk" },
    update: {},
    create: {
      name: "Seller",
      email: "seller@hmstocks.lk",
      password: sellerPw,
      role: "SELLER",
    },
  });

  console.log("✓ 3 users seeded");
  console.log("\n📋 Login credentials:");
  console.log("  Admin:  admin@hmstocks.lk  / admin123");
  console.log("  Owner:  owner@hmstocks.lk  / owner123");
  console.log("  Seller: seller@hmstocks.lk / seller123");
  console.log("\n⚠️  Change all passwords after first login!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
