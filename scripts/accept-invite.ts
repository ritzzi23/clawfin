// scripts/accept-invite.ts
// Syncs all 5 agents using syncAll() to pick up any pending group invites
// Run this AFTER the user has added the agent addresses to their Convos group
//
// The Convos invite URL (popup.convos.org/v2?i=...) is a deep link for mobile only.
// The actual joining happens when:
//   1. The user adds agent addresses in Convos → Settings → Add Members
//   2. This script calls syncAll() on each agent to process the welcome message
//
// Usage: node --import tsx/esm scripts/accept-invite.ts

import { Agent, createSigner, createUser, getInboxIdForIdentifier } from "@xmtp/agent-sdk";
import type { XmtpEnv, HexString, IdentifierKind } from "@xmtp/agent-sdk";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

const AGENTS = [
    {
        name: "ClawBot",
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

async function syncAgent(config: typeof AGENTS[0]) {
    const user = createUser(config.walletKey);
    const signer = createSigner(user);

    const agent = await Agent.create(signer, {
        env: XMTP_ENV,
        dbPath: config.dbPath,
        dbEncryptionKey: config.encKey
            ? Buffer.from(config.encKey.replace(/^0x/, ""), "hex")
            : undefined,
    });

    console.log(`[${config.name}] 🔄 Calling syncAll()...`);

    // syncAll() processes ALL pending welcome messages (group invites)
    const result = await agent.client.conversations.syncAll();
    console.log(`[${config.name}] ✅ Sync done:`, JSON.stringify(result));

    const groups = await agent.client.conversations.listGroups();
    console.log(`[${config.name}] 📦 Groups found: ${groups.length}`);
    for (const g of groups) {
        console.log(`   → ${g.id}`);
    }

    return groups;
}

async function main() {
    console.log("🔄 Running syncAll() on all ClawFin agents...\n");
    console.log("⚠️  FIRST: Make sure you added all agent addresses in Convos:");
    console.log("   ClawBot:    0xd1d9fc92b68d9517b2ff2a3344b85a2e667d8f00");
    console.log("   DealDasher: 0xff47c703c4d3187f8ce3fd7b75ffb35f58eca7ec");
    console.log("   BundleKing: 0xbc295133a5f244d115d539c5e3605fcdc0838c52");
    console.log("   PremiumHub: 0x87296f8b1637cd9914fb005d348b8d26a9979f60");
    console.log("   FlashDeals: 0x54ac197a40f2b0db50ef9c15766b386f7302ca43");
    console.log("\nIf you haven't done that yet, pause and add them in Convos first.\n");

    const allGroupIds = new Set<string>();

    for (const agentConfig of AGENTS) {
        try {
            const groups = await syncAgent(agentConfig);
            for (const g of groups) allGroupIds.add(g.id);
        } catch (err: any) {
            console.error(`[${agentConfig.name}] Error:`, err?.message);
        }
        console.log("");
    }

    console.log("═══════════════════════════════════════");
    if (allGroupIds.size === 0) {
        console.log("⚠️  No groups found yet.");
        console.log("\n📱 In Convos app on your phone:");
        console.log("   1. Open the group you created");
        console.log("   2. Tap the group name → Members → Add Members");
        console.log("   3. Paste each agent address above, one at a time");
        console.log("   4. Run this script again");
    } else {
        // Found groups — update .env with the newest one
        const groupIds = [...allGroupIds];
        const newGroupId = groupIds[groupIds.length - 1]; // Use the most recent

        console.log("✅ Groups found:");
        for (const id of groupIds) {
            console.log(`   ${id}${id === newGroupId ? " ← newest" : ""}`);
        }

        // Update .env
        const envPath = path.resolve(".env");
        let envContent = fs.readFileSync(envPath, "utf8");
        const currentId = process.env.CONVOS_GROUP_ID;

        if (newGroupId !== currentId) {
            envContent = envContent.replace(
                /CONVOS_GROUP_ID=.*/,
                `CONVOS_GROUP_ID=${newGroupId}`
            );
            fs.writeFileSync(envPath, envContent);
            console.log(`\n✅ Updated .env: CONVOS_GROUP_ID=${newGroupId}`);
        } else {
            console.log(`\n✅ .env already has correct CONVOS_GROUP_ID=${newGroupId}`);
        }

        console.log("\n💡 Now run: npm run start:all");
        console.log("💡 Type in Convos: Find me the best deal on AirPods Max, budget $450");
    }
    console.log("═══════════════════════════════════════");

    process.exit(0);
}

main().catch(err => {
    console.error("❌", err);
    process.exit(1);
});
