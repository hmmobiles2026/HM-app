/**
 * License key generator — run this to create a key for a paying customer.
 *
 * Usage:
 *   LICENSE_SECRET=your_secret node scripts/gen-license.mjs [months]
 *
 * Example (3 months):
 *   LICENSE_SECRET=abc123 node scripts/gen-license.mjs 3
 */

import { createHmac } from "crypto";

const months = parseInt(process.argv[2] ?? "3");
const secret = process.env.LICENSE_SECRET;

if (!secret) {
  console.error("❌  Set LICENSE_SECRET environment variable first.");
  console.error("    Example: LICENSE_SECRET=your_secret node scripts/gen-license.mjs 3");
  process.exit(1);
}

const expiry = Date.now() + months * 30 * 24 * 60 * 60 * 1000;
const data = expiry.toString(16);
const sig = createHmac("sha256", secret).update(data).digest("hex");
const key = Buffer.from(`${data}:${sig}`).toString("base64url");

const expiryDate = new Date(expiry).toLocaleDateString("en-LK", {
  day: "2-digit", month: "long", year: "numeric",
});

console.log(`\n✅  License key (${months} months — expires ${expiryDate}):`);
console.log(`\n    ${key}\n`);
