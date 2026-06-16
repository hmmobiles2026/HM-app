/**
 * One-time script to wipe all test/sample data before going live.
 * Run: npx tsx prisma/clear-data.ts
 *
 * Removes: all sales, sale items, stock movements, price history, products.
 * Keeps:   brands, models, categories, users.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import * as readline from "readline";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  const [saleCount, productCount] = await Promise.all([
    prisma.sale.count(),
    prisma.product.count(),
  ]);

  console.log(`\n⚠️  This will permanently delete:`);
  console.log(`   • ${saleCount} sales`);
  console.log(`   • ${productCount} products`);
  console.log(`   • All stock movements and price history`);
  console.log(`\n   Brands, models, categories and users will be kept.\n`);

  const answer = await ask(`Type "yes" to confirm: `);
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nClearing data...");

  await prisma.saleItem.deleteMany({});
  console.log("✓ Sale items deleted");

  await prisma.sale.deleteMany({});
  console.log("✓ Sales deleted");

  await prisma.stockMovement.deleteMany({});
  console.log("✓ Stock movements deleted");

  await prisma.priceHistory.deleteMany({});
  console.log("✓ Price history deleted");

  await prisma.product.deleteMany({});
  console.log("✓ Products deleted");

  console.log("\nDone. Your app is ready for real data.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
