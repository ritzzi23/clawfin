// scripts/create-group.ts
// One-time setup: creates an XMTP group and adds all 5 agents to it
// Run this ONCE before starting agents: npm run setup:group

import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

async function getClientAndAddress(walletKey: `0x${string}`): Promise<{ client: Client; address: string }> {
    const account = privateKeyToAccount(walletKey);
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http() });
    const signer = {
        getAddress: () => account.address as string,
        signMessage: async (message: string): Promise<Uint8Array> => {
            const sig = await walletClient.signMessage({ account, message });
            const hex = sig.slice(2);
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            }
            return bytes;
        },
    };
    const encryptionKey = new Uint8Array(Buffer.from(walletKey.slice(2), "hex"));
    const client = await Client.create(signer, encryptionKey, { env: XMTP_ENV });
    return { client, address: account.address };
}

async function main() {
    console.log("\n🔑 Initializing all ClawFin agent clients...\n");

    const keys = {
        buyer: process.env.BUYER_WALLET_KEY as `0x${string}`,
        discounter: process.env.SELLER_DISCOUNTER_WALLET_KEY as `0x${string}`,
        bundler: process.env.SELLER_BUNDLER_WALLET_KEY as `0x${string}`,
        firm: process.env.SELLER_FIRM_WALLET_KEY as `0x${string}`,
        urgency: process.env.SELLER_URGENCY_WALLET_KEY as `0x${string}`,
    };

    // Validate all keys present
    const missing = Object.entries(keys)
        .filter(([, v]) => !v)
        .map(([k]) => k);
    if (missing.length > 0) {
        console.error(`❌ Missing wallet keys: ${missing.join(", ")}\nRun 'npm run gen:keys' first and paste into .env`);
        process.exit(1);
    }

    // Create all 5 clients (this registers them on XMTP network)
    console.log("📡 Registering agents on XMTP (this takes ~30s for new identities)...");
    const [buyerResult, discounterResult, bundlerResult, firmResult, urgencyResult] = await Promise.all([
        getClientAndAddress(keys.buyer),
        getClientAndAddress(keys.discounter),
        getClientAndAddress(keys.bundler),
        getClientAndAddress(keys.firm),
        getClientAndAddress(keys.urgency),
    ]);

    // Account addresses (used by newGroup — it expects 0x... addresses, not inboxIds)
    const sellerAddresses = [
        discounterResult.address,
        bundlerResult.address,
        firmResult.address,
        urgencyResult.address,
    ];

    console.log("\n📋 Agent Addresses & Inbox IDs:");
    console.log(`  🤖 ClawBot (Buyer):      ${buyerResult.address}  | ${buyerResult.client.inboxId.slice(0, 16)}...`);
    console.log(`  ⚡ DealDasher (Disc):    ${discounterResult.address}  | ${discounterResult.client.inboxId.slice(0, 16)}...`);
    console.log(`  🎁 BundleKing (Bndlr):   ${bundlerResult.address}  | ${bundlerResult.client.inboxId.slice(0, 16)}...`);
    console.log(`  💎 PremiumHub (Firm):    ${firmResult.address}  | ${firmResult.client.inboxId.slice(0, 16)}...`);
    console.log(`  🔥 FlashDeals (Urgency): ${urgencyResult.address}  | ${urgencyResult.client.inboxId.slice(0, 16)}...`);

    console.log("\n📦 Creating group chat with all 5 agents...");

    // Buyer creates the group with all seller account addresses
    await buyerResult.client.conversations.sync();
    const group = await buyerResult.client.conversations.newGroup(sellerAddresses, {
        groupName: "🏷️ ClawFin Deal Room",
        groupDescription: "AI agents negotiate the best deals for you — live, in this thread.",
    });

    console.log(`\n✅ Group created!`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`\n🚀 Next steps:`);
    console.log(`   1. Open Convos app and look for "ClawFin Deal Room"`);
    console.log(`   2. Add yourself to the group (DM @ClawBot in Convos with the group ID)`);
    console.log(`   3. Run: npm run start:all`);
    console.log(`   4. In the group, type: "Find me the best deal on AirPods Pro Max, budget $350"`);
    console.log(`\n📌 Group ID (share with teammates):`);
    console.log(`   ${group.id}\n`);
}

main().catch((err) => {
    console.error("❌ Setup failed:", err);
    process.exit(1);
});
