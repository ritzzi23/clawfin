// scripts/composio-connect.ts
// One-time OAuth setup: connects Gmail, Google Sheets, and Slack to Composio
// Run once before the hackathon demo: npx ts-node scripts/composio-connect.ts
//
// What this does:
//   1. Generates OAuth connection URLs for Gmail, Sheets, and Slack
//   2. Opens them in your browser (or prints them if browser unavailable)
//   3. After you authenticate, Composio stores the tokens
//   4. ClawFin can then fire Gmail/Sheets/Slack actions without any auth prompts

import { Composio } from "@composio/core";
import dotenv from "dotenv";

dotenv.config();

const ENTITY_ID = process.env.COMPOSIO_ENTITY_ID || "default";

const APPS_TO_CONNECT = ["gmail", "googlesheets", "slack"] as const;

async function main() {
    if (!process.env.COMPOSIO_API_KEY) {
        console.error("❌ COMPOSIO_API_KEY not set in .env");
        console.error("   Get it from: platform.composio.dev/settings");
        process.exit(1);
    }

    const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

    console.log("\n🔗 ClawFin — Composio OAuth Setup");
    console.log("   Entity ID:", ENTITY_ID);
    console.log("   Apps:", APPS_TO_CONNECT.join(", "));
    console.log("");

    for (const app of APPS_TO_CONNECT) {
        console.log(`\n── Connecting ${app.toUpperCase()} ──`);

        try {
            // Check if already connected
            const accounts = await composio.connectedAccounts.list({
                userId: ENTITY_ID,
            } as any);

            const existing = (accounts as any)?.items?.find(
                (a: any) => a.appName?.toLowerCase() === app
            );

            if (existing && existing.status === "ACTIVE") {
                console.log(`✅ ${app} already connected (ID: ${existing.id})`);
                continue;
            }

            // Generate OAuth URL
            const connectionRequest = await composio.connectedAccounts.create({
                appName: app,
                userId: ENTITY_ID,
                config: {},
            } as any);

            const authUrl = (connectionRequest as any).redirectUrl || (connectionRequest as any).url;

            if (authUrl) {
                console.log(`🌐 Open this URL to connect ${app}:`);
                console.log(`   ${authUrl}`);
                console.log("");

                // Try to open in browser on macOS/Linux
                try {
                    const { execSync } = require("child_process");
                    const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
                    execSync(`${openCmd} "${authUrl}"`, { stdio: "ignore" });
                    console.log("   (Opened in browser)");
                } catch {
                    console.log("   (Copy and paste the URL above into your browser)");
                }
            } else {
                console.log(`⚠️  Could not get OAuth URL for ${app}. Check the Composio dashboard.`);
            }
        } catch (err: any) {
            console.error(`❌ Failed to connect ${app}:`, err?.message || err);
        }
    }

    console.log("\n\n──────────────────────────────────────────────");
    console.log("After connecting all apps in your browser:");
    console.log("  Re-run this script to verify all connections are ACTIVE.");
    console.log("");
    console.log("Then set these in your .env:");
    console.log("  USER_EMAIL=your@email.com");
    console.log("  DEAL_TRACKER_SHEET_ID=your-google-sheet-id");
    console.log("  SLACK_CHANNEL_ID=your-slack-channel-id (e.g. #deals or C0123456)");
    console.log("──────────────────────────────────────────────\n");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
