// scripts/gen-keys.ts
// Generates XMTP wallet keys and DB encryption keys for all 5 agents
// Appends them to .env (safe to run multiple times — only adds missing keys)

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const ENV_PATH = path.resolve(process.cwd(), ".env");

function generatePrivateKey(): string {
    return "0x" + crypto.randomBytes(32).toString("hex");
}

function generateEncryptionKey(): string {
    return "0x" + crypto.randomBytes(32).toString("hex");
}

const AGENTS = [
    { walletKey: "BUYER_WALLET_KEY", encKey: "BUYER_DB_ENCRYPTION_KEY" },
    { walletKey: "SELLER_DISCOUNTER_WALLET_KEY", encKey: "SELLER_DISCOUNTER_DB_ENCRYPTION_KEY" },
    { walletKey: "SELLER_BUNDLER_WALLET_KEY", encKey: "SELLER_BUNDLER_DB_ENCRYPTION_KEY" },
    { walletKey: "SELLER_FIRM_WALLET_KEY", encKey: "SELLER_FIRM_DB_ENCRYPTION_KEY" },
    { walletKey: "SELLER_URGENCY_WALLET_KEY", encKey: "SELLER_URGENCY_DB_ENCRYPTION_KEY" },
];

function main() {
    let existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
    const additions: string[] = [];

    for (const agent of AGENTS) {
        if (!existing.includes(agent.walletKey + "=")) {
            const key = generatePrivateKey();
            additions.push(`${agent.walletKey}=${key}`);
            console.log(`✅ Generated ${agent.walletKey}`);
        } else {
            console.log(`⏭️  ${agent.walletKey} already exists — skipping`);
        }

        if (!existing.includes(agent.encKey + "=")) {
            const key = generateEncryptionKey();
            additions.push(`${agent.encKey}=${key}`);
            console.log(`✅ Generated ${agent.encKey}`);
        } else {
            console.log(`⏭️  ${agent.encKey} already exists — skipping`);
        }
    }

    if (additions.length > 0) {
        const block = "\n# --- Generated XMTP Keys ---\n" + additions.join("\n") + "\n";
        fs.appendFileSync(ENV_PATH, block);
        console.log(`\n✅ Appended ${additions.length} keys to .env`);
    } else {
        console.log("\n✅ All keys already exist in .env — nothing to do.");
    }

    console.log("\n📋 Next: set CONVOS_GROUP_ID= in .env (run: npm run setup:group)");
}

main();
