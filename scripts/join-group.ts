// scripts/join-group.ts
// Syncs all 5 agents to pick up any pending group invites from Convos
// After someone adds an agent to a Convos group via the invite link, the agent
// needs to sync its conversations to see the new group.
// 
// Run this AFTER: someone (the user) joined the Convos group from the app 
// and the agents were already online (so they got the welcome message).
// 
// Usage: node --import tsx/esm scripts/join-group.ts

import { Agent, createSigner, createUser } from "@xmtp/agent-sdk";
import type { XmtpEnv, HexString } from "@xmtp/agent-sdk";
import dotenv from "dotenv";

dotenv.config();

const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

const AGENTS = [
    {
        name: "ClawBot (Buyer)",
        walletKey: process.env.BUYER_WALLET_KEY! as HexString,
        encKey: process.env.BUYER_DB_ENCRYPTION_KEY,
        dbPath: ".data/buyer.db",
    },
    {
        name: "DealDasher",
        walletKey: process.env.SELLER_DISCOUNTER_WALLET_KEY! as HexString,
        encKey: process.env.SELLER_DISCOUNTER_DB_ENCRYPTION_KEY,
        dbPath: ".data/dealdasher.db",
    },
    {
        name: "BundleKing",
        walletKey: process.env.SELLER_BUNDLER_WALLET_KEY! as HexString,
        encKey: process.env.SELLER_BUNDLER_DB_ENCRYPTION_KEY,
        dbPath: ".data/bundleking.db",
    },
    {
        name: "PremiumHub",
        walletKey: process.env.SELLER_FIRM_WALLET_KEY! as HexString,
        encKey: process.env.SELLER_FIRM_DB_ENCRYPTION_KEY,
        dbPath: ".data/premiumhub.db",
    },
    {
        name: "FlashDeals",
        walletKey: process.env.SELLER_URGENCY_WALLET_KEY! as HexString,
        encKey: process.env.SELLER_URGENCY_DB_ENCRYPTION_KEY,
        dbPath: ".data/flashdeals.db",
    },
];

async function syncAgent(agentConfig: typeof AGENTS[0]) {
    const user = createUser(agentConfig.walletKey);
    const signer = createSigner(user);

    const a = await Agent.create(signer, {
        env: XMTP_ENV,
        dbPath: agentConfig.dbPath,
        dbEncryptionKey: agentConfig.encKey
            ? Buffer.from(agentConfig.encKey.replace(/^0x/, ""), "hex")
            : undefined,
    });

    // Sync to pick up pending group invites
    await a.client.conversations.sync();
    const groups = await a.client.conversations.listGroups();

    console.log(`\n[${agentConfig.name}] Found ${groups.length} group(s):`);
    for (const g of groups) {
        console.log(`  → ID: ${g.id}`);
    }

    return groups;
}

async function main() {
    console.log("🔄 Syncing all ClawFin agents to pick up group invites...\n");

    const allGroupIds = new Set<string>();

    for (const agentConfig of AGENTS) {
        try {
            const groups = await syncAgent(agentConfig);
            for (const g of groups) allGroupIds.add(g.id);
        } catch (err: any) {
            console.error(`[${agentConfig.name}] Error:`, err?.message);
        }
    }

    console.log("\n═══════════════════════════════════════");
    if (allGroupIds.size === 0) {
        console.log("⚠️  No groups found yet.");
        console.log("   → Make sure you (the user) are in the group via Convos");
        console.log("   → The agents will receive the invite when they run via 'npm run start:all'");
    } else {
        console.log("📋 All group IDs found:");
        for (const id of allGroupIds) {
            console.log(`   ${id}`);
        }
        console.log("\n💡 Update .env: CONVOS_GROUP_ID=<the group ID above>");
        console.log("💡 Then restart: npm run start:all");
    }
    console.log("═══════════════════════════════════════");

    process.exit(0);
}

main().catch(err => {
    console.error("❌", err);
    process.exit(1);
});
