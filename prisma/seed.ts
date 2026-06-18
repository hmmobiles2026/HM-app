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
  async function upsertBrand(name: string) {
    return await prisma.brand.findFirst({ where: { name, deletedAt: null } })
      ?? await prisma.brand.create({ data: { name } });
  }
  async function upsertModel(brandId: string, name: string) {
    return await prisma.phoneModel.findFirst({ where: { brandId, name, deletedAt: null } })
      ?? await prisma.phoneModel.create({ data: { name, brandId } });
  }

  const samsung = await upsertBrand("Samsung");
  for (const m of ["A54", "A34", "A14", "A04", "S23", "S22", "S21", "A52", "A72", "M14"])
    await upsertModel(samsung.id, m);

  const redmi = await upsertBrand("Redmi");
  for (const m of ["Note 12", "Note 11", "Note 10", "Note 9", "12C", "10C", "9C", "A2"])
    await upsertModel(redmi.id, m);

  const iphone = await upsertBrand("iPhone");
  for (const m of ["15 Pro Max", "15 Pro", "15", "14 Pro Max", "14 Pro", "14", "13", "12", "11", "XR"])
    await upsertModel(iphone.id, m);

  const oppo = await upsertBrand("Oppo");
  for (const m of ["A78", "A58", "A38", "A18", "Reno 8"])
    await upsertModel(oppo.id, m);

  const vivo = await upsertBrand("Vivo");
  for (const m of ["Y36", "Y27", "Y22", "Y16", "V29"])
    await upsertModel(vivo.id, m);

  console.log("✓ 5 brands + models seeded");

  // Admin user
  const adminPw = await bcrypt.hash("Admin@518", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { name: "Admin", username: "admin", password: adminPw, role: "ADMIN" },
  });

  // Owner user
  const ownerPw = await bcrypt.hash("Owner@1234", 10);
  await prisma.user.upsert({
    where: { username: "owner" },
    update: {},
    create: { name: "Shop Owner", username: "owner", password: ownerPw, role: "OWNER" },
  });

  // Seller user
  const sellerPw = await bcrypt.hash("Seller@1234", 10);
  await prisma.user.upsert({
    where: { username: "seller" },
    update: {},
    create: { name: "Seller", username: "seller", password: sellerPw, role: "SELLER" },
  });

  console.log("✓ 3 users seeded");
  console.log("\n📋 Login credentials:");
  console.log("  Admin:  username=admin  / Admin@518");
  console.log("  Owner:  username=owner  / Owner@1234");
  console.log("  Seller: username=seller / Seller@1234");
  console.log("\n⚠️  Change all passwords after first login!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
