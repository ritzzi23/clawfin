// scripts/test-send-message.ts
// Sends a test negotiation trigger message as the "user" into the ClawFin group

import { Agent, createSigner, createUser } from "@xmtp/agent-sdk";
import type { XmtpEnv, HexString } from "@xmtp/agent-sdk";
import dotenv from "dotenv";

dotenv.config();

const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

// Use the buyer's wallet as the "user" for test (we'll see the agent respond to a fresh wallet)
// Actually we want to send AS A SEPARATE USER so the agents pick it up
// Generate a temp throwaway key
import * as crypto from "crypto";

async function main() {
    // Use buyer wallet to act as a human tester (they will filter their own messages,
    // but a FRESH wallet simulates the real human)
    const testKey = ("0x" + crypto.randomBytes(32).toString("hex")) as HexString;
    const testUser = createUser(testKey);
    const testSigner = createSigner(testUser);

    const testAgent = await Agent.create(testSigner, {
        env: XMTP_ENV,
        dbPath: null as any, // in-memory, throwaway
    });

    console.log("🧪 Test sender online:", testAgent.address);
    console.log("📨 Sending negotiation trigger to group:", process.env.CONVOS_GROUP_ID);

    const groupId = process.env.CONVOS_GROUP_ID;
    if (!groupId) {
        console.error("❌ CONVOS_GROUP_ID not set in .env");
        process.exit(1);
    }

    // Get the group conversation
    await testAgent.client.conversations.sync();
    const convos = await testAgent.client.conversations.listGroups();
    const group = convos.find((c: any) => c.id === groupId);

    if (!group) {
        console.log("⚠️  Test sender not in the group yet. Adding them via buyer...");
        // Use buyer identity to find group and add test user
        const buyerKey = process.env.BUYER_WALLET_KEY! as HexString;
        const buyerEncKey = process.env.BUYER_DB_ENCRYPTION_KEY;
        const buyerUser = createUser(buyerKey);
        const buyerSigner = createSigner(buyerUser);
        const buyer = await Agent.create(buyerSigner, {
            env: XMTP_ENV,
            dbPath: ".data/buyer.db",
            dbEncryptionKey: buyerEncKey
                ? Buffer.from(buyerEncKey.replace(/^0x/, ""), "hex")
                : undefined,
        });

        await buyer.client.conversations.sync();
        const buyerGroups = await buyer.client.conversations.listGroups();
        const buyerGroup = buyerGroups.find((c: any) => c.id === groupId);

        if (buyerGroup) {
            await (buyerGroup as any).addMembers([testAgent.address!]);
            console.log("✅ Added test sender to group");
        } else {
            console.error("❌ Buyer can't find the group either. Run: npm run setup:group");
            process.exit(1);
        }

        // Re-sync test agent
        await testAgent.client.conversations.sync();
        const refreshed = await testAgent.client.conversations.listGroups();
        const refreshedGroup = refreshed.find((c: any) => c.id === groupId);

        if (!refreshedGroup) {
            console.error("❌ Still can't find group after adding. Try manually.");
            process.exit(1);
        }

        await refreshedGroup.sendText("Find me the best deal on Sony WH-1000XM5, budget $300");
        console.log("✅ Test message sent! Watch the agents respond...");
    } else {
        await group.sendText("Find me the best deal on Sony WH-1000XM5, budget $300");
        console.log("✅ Test message sent! Watch the agents respond...");
    }

    // Wait a bit to see responses
    await new Promise(r => setTimeout(r, 5000));
    process.exit(0);
}

main().catch(err => {
    console.error("❌", err);
    process.exit(1);
});
