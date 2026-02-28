// lib/composio.ts
// Post-deal integrations via Composio — Gmail + Google Sheets
// Fires after the buyer agent posts the deal summary

// Uses Composio REST API directly via axios (no SDK dependency needed)
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || "";
const BASE_URL = "https://backend.composio.dev/api/v1";

interface ComposioActionPayload {
    appName: string;
    actionName: string;
    input: Record<string, unknown>;
    entityId?: string;
}

async function executeAction(payload: ComposioActionPayload): Promise<any> {
    if (!COMPOSIO_API_KEY) {
        console.warn("[Composio] No API key set, skipping action:", payload.actionName);
        return null;
    }

    try {
        const response = await axios.post(
            `${BASE_URL}/actions/execute/CLAWFIN`,
            payload,
            {
                headers: {
                    "x-api-key": COMPOSIO_API_KEY,
                    "Content-Type": "application/json",
                },
                timeout: 15000,
            }
        );
        return response.data;
    } catch (err: any) {
        console.error(`[Composio] Action failed (${payload.actionName}):`, err?.message);
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
 * Send deal summary email via Gmail using Composio
 */
export async function sendDealEmail(deal: DealForEmail): Promise<void> {
    const userEmail = process.env.USER_EMAIL;
    if (!userEmail) {
        console.warn("[Composio] USER_EMAIL not set, skipping email");
        return;
    }

    const subject = `🏆 ClawFin Deal Found: ${deal.productName} @ $${deal.effectivePrice.toFixed(2)}`;
    const body = `Your ClawFin agent found you a deal!\n\n${deal.summaryText}\n\nNegotiated by ClawFin — powered by XMTP + OpenClaw`;

    console.log("[Composio] Sending deal email to", userEmail);
    await executeAction({
        appName: "gmail",
        actionName: "GMAIL_SEND_EMAIL",
        input: {
            to: userEmail,
            subject,
            body,
        },
    });
    console.log("[Composio] Email sent ✓");
}

/**
 * Log deal to Google Sheets via Composio
 */
export async function logDealToSheets(deal: DealForEmail): Promise<void> {
    const sheetId = process.env.DEAL_TRACKER_SHEET_ID;
    if (!sheetId) {
        console.warn("[Composio] DEAL_TRACKER_SHEET_ID not set, skipping Sheets log");
        return;
    }

    console.log("[Composio] Logging deal to Google Sheets...");
    await executeAction({
        appName: "googlesheets",
        actionName: "GOOGLESHEETS_SHEET_APPEND_ROW",
        input: {
            spreadsheetId: sheetId,
            values: [
                new Date().toISOString(),
                deal.productName,
                deal.winnerSeller,
                deal.price.toFixed(2),
                deal.cardUsed,
                deal.cashbackAmount.toFixed(2),
                deal.effectivePrice.toFixed(2),
                deal.savings.toFixed(2),
            ],
        },
    });
    console.log("[Composio] Sheets logged ✓");
}

/**
 * Run all post-deal actions (email + sheets) after negotiation completes
 */
export async function runPostDealActions(deal: DealForEmail): Promise<string> {
    const results: string[] = [];

    await Promise.allSettled([
        sendDealEmail(deal).then(() => results.push("📧 Deal summary sent to your email")),
        logDealToSheets(deal).then(() => results.push("📊 Logged to your deal tracker spreadsheet")),
    ]);

    return results.length > 0
        ? `\n${results.join("\n")}`
        : "\n(Composio integrations not configured)";
}
