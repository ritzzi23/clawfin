// scripts/test-openrouter.ts
// Quick smoke test for OpenRouter API connectivity
// Run: npx ts-node scripts/test-openrouter.ts

import { chat } from "../lib/openrouter";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    console.log("🧪 Testing OpenRouter connection...");

    if (!process.env.OPENROUTER_API_KEY) {
        console.error("❌ OPENROUTER_API_KEY not set in .env");
        process.exit(1);
    }

    try {
        const response = await chat(
            [
                { role: "system", content: "You are a helpful assistant. Be very brief." },
                { role: "user", content: 'Say "ClawFin is live!" and nothing else.' },
            ],
            "anthropic/claude-3.5-haiku",
            0.1,
            50
        );

        console.log(`✅ OpenRouter OK. Response: "${response}"`);
    } catch (err: any) {
        console.error("❌ OpenRouter test failed:", err?.message);
        process.exit(1);
    }
}

main();
