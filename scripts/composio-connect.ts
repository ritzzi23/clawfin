// scripts/composio-connect.ts
// One-time setup: test Composio API connectivity and verify Gmail+Sheets access
// Run once before the demo: npm run composio:connect

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || "";
const BASE_URL = "https://backend.composio.dev/api/v1";

async function checkComposioConnections() {
    if (!COMPOSIO_API_KEY) {
        console.error("❌ COMPOSIO_API_KEY not set in .env");
        console.error("   Get it from: platform.composio.dev/settings");
        process.exit(1);
    }

    console.log("\n🔗 ClawFin — Composio Connection Check\n");

    try {
        const res = await axios.get(`${BASE_URL}/connectedAccounts`, {
            headers: { "x-api-key": COMPOSIO_API_KEY },
        });

        const accounts = res.data?.items || [];
        if (accounts.length === 0) {
            console.log("⚠️  No connected accounts found.");
            console.log("\n💡 Connect Gmail and Google Sheets at: platform.composio.dev");
            console.log("   Then run this script again to verify.\n");
        } else {
            console.log(`✅ Found ${accounts.length} connected account(s):\n`);
            for (const acct of accounts) {
                const status = acct.status === "ACTIVE" ? "✅" : "⚠️ ";
                console.log(`   ${status} ${acct.appName} (${acct.status})`);
            }
            console.log("\n🎉 Composio is ready! Post-deal Gmail + Sheets actions will fire.");
        }
    } catch (err: any) {
        console.error("❌ Composio API error:", err?.message);
        console.error("   Check your COMPOSIO_API_KEY in .env");
    }
}

checkComposioConnections();
