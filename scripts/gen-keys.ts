// scripts/gen-keys.ts
// Generates 5 random private keys — 1 buyer + 4 sellers
// Run: npx ts-node scripts/gen-keys.ts >> .env

import { generatePrivateKey } from "viem/accounts";

const agents = [
    "BUYER",
    "SELLER_DISCOUNTER",
    "SELLER_BUNDLER",
    "SELLER_FIRM",
    "SELLER_URGENCY",
];

console.log("\n# === Generated Agent Wallet Keys ===");
console.log("# Paste these into your .env file\n");

for (const name of agents) {
    const key = generatePrivateKey();
    console.log(`${name}_WALLET_KEY=${key}`);
}

console.log(`\nXMTP_ENV=dev`);
console.log("\n# Done! Now run: npm run setup:group");
