// scripts/composio-connect.ts
// One-time OAuth setup: connects Gmail, Google Sheets, and Slack to Composio
// Run once before the hackathon demo: npm run composio:connect
//
// Flow:
//   1. Creates a Composio-managed auth config for each app
//   2. Generates a connection link (OAuth URL)
//   3. Opens it in your browser — authenticate to authorize
//   4. Composio stores the tokens; ClawFin can fire actions without further auth

import { Composio } from "@composio/core";
import { execSync } from "child_process";
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
    console.log(`   Entity: ${ENTITY_ID}`);
    console.log(`   Apps:   ${APPS_TO_CONNECT.join(", ")}\n`);

    // Check which apps are already connected
    const existing = await composio.connectedAccounts.list({ userIds: [ENTITY_ID] } as any);
    const activeApps = new Set(
        (existing.items || [])
            .filter((a: any) => a.status === "ACTIVE")
            .map((a: any) => a.appName?.toLowerCase())
    );

    for (const app of APPS_TO_CONNECT) {
        console.log(`── ${app.toUpperCase()} ──`);

        if (activeApps.has(app)) {
            console.log(`✅ Already connected\n`);
            continue;
        }

        try {
            // Create Composio-managed auth config, then generate link
            const authConfig = await composio.authConfigs.create(app, {
                type: "use_composio_managed_auth",
            });

            const connectionReq = await composio.connectedAccounts.link(
                ENTITY_ID,
                authConfig.id
            );

            const url = (connectionReq as any).redirectUrl;

            if (url) {
                console.log(`🌐 OAuth URL:\n   ${url}\n`);
                try {
                    execSync(`open "${url}"`, { stdio: "ignore" });
                    console.log("   (Opened in browser — authorize then come back)\n");
                } catch {
                    console.log("   (Paste the URL above into your browser)\n");
                }
            } else {
                console.log(`⚠️  No URL returned for ${app}\n`);
            }
        } catch (err: any) {
            console.error(`❌ ${app}: ${err?.message}\n`);
        }
    }

    console.log("──────────────────────────────────────────────");
    console.log("After authorizing in your browser, add to .env:");
    console.log("  USER_EMAIL=your@gmail.com");
    console.log("  DEAL_TRACKER_SHEET_ID=<id from Sheet URL>");
    console.log("  SLACK_CHANNEL_ID=<#channel or C0123ABCD>");
    console.log("\nRe-run this script to verify all show as connected.");
    console.log("──────────────────────────────────────────────\n");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
