// scripts/add-me.ts
// Adds YOUR wallet address to the ClawFin group so you can see it in Convos
// 
// Usage:
//   1. Find your wallet address from Convos: go to Convos Settings -> Profile -> copy your address
//   2. Run: MY_ADDRESS=0xYourWalletHere node --import tsx/esm scripts/add-me.ts
//      OR:  Set MY_ADDRESS= in .env and run: npm run add:me

import { Agent, createSigner, createUser } from "@xmtp/agent-sdk";
import type { XmtpEnv, HexString } from "@xmtp/agent-sdk";
import dotenv from "dotenv";

dotenv.config();

const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;
const GROUP_ID = process.env.CONVOS_GROUP_ID;
const MY_ADDRESS = (process.env.MY_ADDRESS || process.argv[2]) as HexString;

async function main() {
    if (!GROUP_ID) {
        console.error("❌ CONVOS_GROUP_ID not set in .env");
        process.exit(1);
    }

    if (!MY_ADDRESS) {
        console.error("❌ Provide your wallet address as an argument:");
        console.error("   MY_ADDRESS=0xYourAddress node --import tsx/esm scripts/add-me.ts");
        console.error("   OR: node --import tsx/esm scripts/add-me.ts 0xYourAddress");
        process.exit(1);
    }

    console.log(`🔗 Adding ${MY_ADDRESS} to group ${GROUP_ID}...`);

    const buyerKey = process.env.BUYER_WALLET_KEY! as HexString;
    const buyerEncKey = process.env.BUYER_DB_ENCRYPTION_KEY;

    const user = createUser(buyerKey);
    const signer = createSigner(user);

    const agent = await Agent.create(signer, {
        env: XMTP_ENV,
        dbPath: ".data/buyer.db",
        dbEncryptionKey: buyerEncKey
            ? Buffer.from(buyerEncKey.replace(/^0x/, ""), "hex")
            : undefined,
    });

    await agent.client.conversations.sync();
    const groups = await agent.client.conversations.listGroups();
    const group = groups.find((g: any) => g.id === GROUP_ID);

    if (!group) {
        console.error(`❌ Group ${GROUP_ID} not found. Run: npm run setup:group`);
        process.exit(1);
    }

    await agent.addMembersWithAddresses(group as any, [MY_ADDRESS]);
    console.log(`\n✅ Added ${MY_ADDRESS} to the ClawFin group!`);
    console.log(`💡 Open Convos app — you should now see the group.`);
    console.log(`💡 Start agents: npm run start:all`);
    console.log(`💡 Send a message: "Find me the best deal on AirPods Max, budget $450"`);

    process.exit(0);
}

main().catch(err => {
    console.error("❌", err?.message || err);
    process.exit(1);
});
