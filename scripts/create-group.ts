// scripts/create-group.ts
// Creates the ClawFin Deal Room XMTP group with all 5 agents as members
// Run once: npm run setup:group
// Output: CONVOS_GROUP_ID= value to paste into .env

import { Agent, createSigner, createUser } from "@xmtp/agent-sdk";
import type { XmtpEnv, HexString } from "@xmtp/agent-sdk";
import dotenv from "dotenv";

dotenv.config();

const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

// Each agent wallet key → will derive the address for group invitation
const AGENT_WALLET_KEYS = [
    { name: "ClawBot (Buyer)", key: process.env.BUYER_WALLET_KEY! as HexString },
    { name: "DealDasher (Seller)", key: process.env.SELLER_DISCOUNTER_WALLET_KEY! as HexString },
    { name: "BundleKing (Seller)", key: process.env.SELLER_BUNDLER_WALLET_KEY! as HexString },
    { name: "PremiumHub (Seller)", key: process.env.SELLER_FIRM_WALLET_KEY! as HexString },
    { name: "FlashDeals (Seller)", key: process.env.SELLER_URGENCY_WALLET_KEY! as HexString },
];

async function main() {
    console.log("🏗️  Creating ClawFin Deal Room group on XMTP...\n");

    const missing = AGENT_WALLET_KEYS.filter((a) => !a.key).map((a) => a.name);
    if (missing.length > 0) {
        console.error("❌ Missing wallet keys for:", missing.join(", "));
        console.error("Run: npm run gen:keys");
        process.exit(1);
    }

    // Use the buyer agent as the group creator
    const buyerKey = AGENT_WALLET_KEYS[0].key;
    const buyerEncKey = process.env.BUYER_DB_ENCRYPTION_KEY;

    const buyerUser = createUser(buyerKey);
    const buyerSigner = createSigner(buyerUser);

    const creator = await Agent.create(buyerSigner, {
        env: XMTP_ENV,
        dbPath: ".data/buyer.db",
        dbEncryptionKey: buyerEncKey
            ? Buffer.from(buyerEncKey.replace(/^0x/, ""), "hex")
            : undefined,
    });

    console.log(`✅ Creator (ClawBot) online — ${creator.address}\n`);

    // Collect all seller agent wallet addresses
    const agentAddresses: HexString[] = [];
    for (const agentConfig of AGENT_WALLET_KEYS.slice(1)) {
        if (!agentConfig.key) continue;
        const user = createUser(agentConfig.key);
        const addr = user.account.address as HexString;
        agentAddresses.push(addr);
        console.log(`   ${agentConfig.name}: ${addr}`);
    }

    console.log(`\n📦 Creating group with ${agentAddresses.length + 1} agents...`);

    // Create the group with all seller addresses
    const group = await creator.createGroupWithAddresses(agentAddresses);

    console.log("\n✅ Group created successfully!");
    console.log("═══════════════════════════════════════════");
    console.log(`📋 Add this to your .env:`);
    console.log(`\nCONVOS_GROUP_ID=${group.id}\n`);
    console.log("═══════════════════════════════════════════");
    console.log("\n💡 Open Convos app and you should see '🏷️ ClawFin Deal Room' in your chats.");
    console.log("💡 Start all agents: npm run start:all");
    console.log("💡 Then type: Find me the best deal on AirPods Max, budget $450\n");

    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
});
