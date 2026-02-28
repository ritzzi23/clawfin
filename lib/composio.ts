// lib/composio.ts
// Post-deal integrations via Composio SDK (@composio/core)
// Fires after the buyer agent posts the DEAL SUMMARY
// Actions: Gmail send + Google Sheets log + Slack notification

import { Composio } from "@composio/core";
import dotenv from "dotenv";

dotenv.config();

// Entity ID scopes which connected account to use.
// "default" works for single-user setups.
const ENTITY_ID = process.env.COMPOSIO_ENTITY_ID || "default";

let _client: Composio | null = null;

function getClient(): Composio | null {
    if (!process.env.COMPOSIO_API_KEY) return null;
    if (!_client) {
        _client = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
    }
    return _client;
}

async function executeAction(
    slug: string,
    args: Record<string, unknown>
): Promise<any> {
    const client = getClient();
    if (!client) {
        console.warn(`[Composio] COMPOSIO_API_KEY not set — skipping ${slug}`);
        return null;
    }

    try {
        const result = await client.tools.execute(slug, {
            arguments: args,
            userId: ENTITY_ID,
            dangerouslySkipVersionCheck: true,
        } as any);
        return result;
    } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.toLowerCase().includes("connected account") || msg.toLowerCase().includes("not found")) {
            console.error(`[Composio] ${slug}: No connected account. Run: npx ts-node scripts/composio-connect.ts`);
        } else {
            console.error(`[Composio] ${slug} failed:`, msg);
        }
        return null;
    }
}

export interface DealForEmail {
    productName: string;
    winnerSeller: string;
    price: number;
    effectivePrice: number;
    cardUsed: string;
    cashbackAmount: number;
    savings: number;
    summaryText: string;
}

/**
 * Send deal summary email via Gmail (Composio)
 */
export async function sendDealEmail(deal: DealForEmail): Promise<boolean> {
    const userEmail = process.env.USER_EMAIL;
    if (!userEmail) {
        console.warn("[Composio] USER_EMAIL not set — skipping Gmail");
        return false;
    }

    const subject = `🏆 ClawFin Deal Found: ${deal.productName} @ $${deal.effectivePrice.toFixed(2)}`;
    const body =
        `Your ClawFin agent found you a deal!\n\n` +
        `${deal.summaryText}\n\n` +
        `---\nNegotiated by ClawFin — powered by XMTP + OpenClaw`;

    console.log("[Composio] Sending deal email to", userEmail);
    const result = await executeAction("GMAIL_SEND_EMAIL", {
        recipient_email: userEmail,
        subject,
        body,
    });
    if (result) console.log("[Composio] Gmail ✓");
    return !!result;
}

/**
 * Append deal row to Google Sheets (Composio)
 * Columns: Timestamp | Product | Seller | Price | Card | Cashback | Effective | Saved
 */
export async function logDealToSheets(deal: DealForEmail): Promise<boolean> {
    const spreadsheetId = process.env.DEAL_TRACKER_SHEET_ID;
    if (!spreadsheetId) {
        console.warn("[Composio] DEAL_TRACKER_SHEET_ID not set — skipping Sheets");
        return false;
    }

    console.log("[Composio] Logging deal to Google Sheets...");
    const result = await executeAction("GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", {
        spreadsheetId,
        range: "Sheet1!A:H",
        values: [[
            new Date().toISOString(),
            deal.productName,
            deal.winnerSeller,
            deal.price.toFixed(2),
            deal.cardUsed,
            deal.cashbackAmount.toFixed(2),
            deal.effectivePrice.toFixed(2),
            deal.savings.toFixed(2),
        ]],
        valueInputOption: "RAW",
    });
    if (result) console.log("[Composio] Sheets ✓");
    return !!result;
}

/**
 * Post deal notification to Slack (Composio)
 */
export async function postDealToSlack(deal: DealForEmail): Promise<boolean> {
    const channel = process.env.SLACK_CHANNEL_ID;
    if (!channel) {
        console.warn("[Composio] SLACK_CHANNEL_ID not set — skipping Slack");
        return false;
    }

    const text =
        `🏷️ *ClawFin Deal Closed*\n` +
        `*Product:* ${deal.productName}\n` +
        `*Winner:* @${deal.winnerSeller}\n` +
        `*Price:* $${deal.price.toFixed(2)} → $${deal.effectivePrice.toFixed(2)} effective (${deal.cardUsed})\n` +
        `*Saved:* $${deal.savings.toFixed(2)}`;

    console.log("[Composio] Posting deal to Slack...");
    const result = await executeAction("SLACK_SEND_MESSAGE", {
        channel,
        text,
    });
    if (result) console.log("[Composio] Slack ✓");
    return !!result;
}

/**
 * Run all three post-deal actions in parallel after negotiation completes.
 * Returns a summary string posted back to the Convos group chat.
 */
export async function runPostDealActions(deal: DealForEmail): Promise<string> {
    if (!process.env.COMPOSIO_API_KEY) {
        return "\n(Composio not configured — set COMPOSIO_API_KEY to enable post-deal actions)";
    }

    const results: string[] = [];

    await Promise.allSettled([
        sendDealEmail(deal).then((ok) => { if (ok) results.push("📧 Deal summary sent to your email"); }),
        logDealToSheets(deal).then((ok) => { if (ok) results.push("📊 Logged to your deal tracker"); }),
        postDealToSlack(deal).then((ok) => { if (ok) results.push("💬 Posted to Slack"); }),
    ]);

    return results.length > 0
        ? `\n${results.join("\n")}`
        : "\n(Composio connected — check OAuth connections for Gmail/Sheets/Slack)";
}
