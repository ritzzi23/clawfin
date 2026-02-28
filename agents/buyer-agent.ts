// agents/buyer-agent.ts
// ClawBot — the main buyer negotiation agent
// Uses @xmtp/agent-sdk: event-driven, no manual wallet/stream setup

import { Agent, createSigner, createUser, filter as f } from "@xmtp/agent-sdk";
import type { XmtpEnv } from "@xmtp/agent-sdk";
import dotenv from "dotenv";

import { chat } from "../lib/openrouter";
import { buildBuyerPrompt, BuyerConstraints } from "../lib/prompts/buyer-prompt";
import {
    createSession,
    getSession,
    addHumanConstraint,
    addToHistory,
    incrementRound,
    completeSession,
    parseNegotiationRequest,
    isConstraintUpdate,
} from "../lib/negotiation-state";
import { rankOffers, formatDealSummary, SellerOffer } from "../lib/deal-explainer";
import { runPostDealActions } from "../lib/composio";
import { AGENTS, LLM_MODELS, NEGOTIATION } from "../config/agents";

dotenv.config();

const BUYER_WALLET_KEY = process.env.BUYER_WALLET_KEY as `0x${string}`;
const BUYER_DB_ENCRYPTION_KEY = process.env.BUYER_DB_ENCRYPTION_KEY;
const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

// In-memory: track which group IDs are actively negotiating
const activeNegotiations = new Set<string>();

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOfferFromMessage(message: string, sellerName: string): SellerOffer | null {
    const priceMatch = message.match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
    if (!priceMatch) return null;
    const price = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (isNaN(price) || price <= 0) return null;

    const hasWarranty =
        message.toLowerCase().includes("warranty") ||
        message.toLowerCase().includes("guarantee");
    const isRefurbished =
        message.toLowerCase().includes("refurbished") ||
        message.toLowerCase().includes("open box");
    const bundleMatch = message.match(/includes?\s+([^.,$\n]+)/i);
    const bundleItems = bundleMatch
        ? bundleMatch[1].split(/,\s*|and\s+/).map((s) => s.trim()).filter(Boolean)
        : [];

    return { sellerName, price, hasWarranty, isRefurbished, bundleItems };
}

async function runNegotiationOrchestrator(
    conversation: any,
    groupId: string,
    productName: string,
    budget: number,
    minExpected: number
) {
    const session = getSession(groupId)!;
    const sellerNames = AGENTS.sellers.map((s) => s.name);

    console.log(`[ClawBot] 🚀 Starting negotiation for "${productName}" @ budget $${budget}`);

    await conversation.sendText(
        `🔍 On it! Reaching out to ${sellerNames.length} sellers for the best deal on **${productName}**...\n\nSellers in this chat: ${sellerNames.map((n) => `@${n}`).join(", ")}`
    );

    await sleep(5000);

    for (let round = 1; round <= NEGOTIATION.maxRounds; round++) {
        const currentRound = incrementRound(groupId);
        console.log(`[ClawBot] 📢 Round ${currentRound}`);

        const constraints: BuyerConstraints = {
            itemName: productName,
            budget,
            minExpected,
            quantity: session.quantity,
            extraConstraints: session.extraConstraints,
        };

        const messages = buildBuyerPrompt(sellerNames, constraints, session.history);
        const buyerResponse = await chat(messages, LLM_MODELS.buyer, 0.7, 512);

        if (buyerResponse) {
            await conversation.sendText(buyerResponse);
            addToHistory(groupId, AGENTS.buyer.name, buyerResponse);
        }

        await sleep(NEGOTIATION.roundDelayMs);

        if (round === NEGOTIATION.maxRounds) {
            await postDealSummary(conversation, session, productName, budget, groupId);
            break;
        }
    }
}

async function postDealSummary(
    conversation: any,
    session: any,
    productName: string,
    budget: number,
    groupId: string
) {
    const allOffers = Object.values(session.offers) as SellerOffer[];

    const offersToRank =
        allOffers.length > 0
            ? allOffers
            : AGENTS.sellers.map((s, i) => ({
                sellerName: s.name,
                price: budget * (0.85 - i * 0.05),
                hasWarranty: s.strategy === "BUNDLER",
                isRefurbished: false,
                bundleItems: s.strategy === "BUNDLER" ? ["carrying case", "2-year warranty"] : [],
            }));

    const ranked = rankOffers(offersToRank, productName, budget);
    const summary = formatDealSummary(ranked, productName, budget);

    await conversation.sendText(summary);

    const winner = ranked[0];
    completeSession(groupId, winner.sellerName);

    const composioResult = await runPostDealActions({
        productName,
        winnerSeller: winner.sellerName,
        price: winner.price,
        effectivePrice: winner.effectivePrice,
        cardUsed: winner.cardName,
        cashbackAmount: winner.cashbackAmount,
        savings: budget - winner.effectivePrice,
        summaryText: summary,
    });

    if (composioResult && composioResult.trim()) {
        await conversation.sendText(`📬 Post-deal actions complete:${composioResult}`);
    }

    activeNegotiations.delete(groupId);
    console.log(`[ClawBot] ✅ Negotiation complete for group ${groupId}`);
}

async function main() {
    if (!BUYER_WALLET_KEY) {
        console.error("[ClawBot] BUYER_WALLET_KEY not set in .env — run: npm run gen:keys");
        process.exit(1);
    }

    const user = createUser(BUYER_WALLET_KEY);
    const signer = createSigner(user);

    const agent = await Agent.create(signer, {
        env: XMTP_ENV,
        dbPath: ".data/buyer.db",
        dbEncryptionKey: BUYER_DB_ENCRYPTION_KEY
            ? Buffer.from(BUYER_DB_ENCRYPTION_KEY.replace(/^0x/, ""), "hex")
            : undefined,
    });

    console.log(`[ClawBot] ✅ ${AGENTS.buyer.displayName} online`);
    console.log(`[ClawBot] 📡 Listening for messages on XMTP ${XMTP_ENV}...`);
    console.log(`[ClawBot] 📬 Address: ${agent.address}`);

    agent.on("text", async (ctx) => {
        // Skip own messages
        if (f.fromSelf(ctx.message, ctx.client)) return;

        const content = ctx.message.content;
        if (!content?.trim()) return;

        const groupId = ctx.conversation.id;
        const session = getSession(groupId);
        const senderName = (ctx.message as any).senderInboxId?.slice(0, 6) || "Human";

        // Track history for context
        if (session) {
            addToHistory(groupId, senderName, content);

            // Capture seller offers
            for (const seller of AGENTS.sellers) {
                const offer = extractOfferFromMessage(content, seller.name);
                if (offer && offer.price > 0) {
                    session.offers[seller.name] = offer;
                    console.log(`[ClawBot] 💰 Captured offer from @${seller.name}: $${offer.price}`);
                }
            }
        }

        const lower = content.toLowerCase();

        // --- Trigger: new negotiation request ---
        const isNegotiationTrigger = NEGOTIATION.triggerPhrases.some((phrase) =>
            lower.includes(phrase)
        );

        if (isNegotiationTrigger && !activeNegotiations.has(groupId)) {
            const parsed = parseNegotiationRequest(content);
            if (parsed) {
                activeNegotiations.add(groupId);
                createSession(groupId, parsed.productName, parsed.budget, parsed.minExpected);
                addToHistory(groupId, senderName, content);

                runNegotiationOrchestrator(
                    ctx.conversation,
                    groupId,
                    parsed.productName,
                    parsed.budget,
                    parsed.minExpected
                ).catch((err) => {
                    console.error("[ClawBot] Negotiation error:", err);
                    activeNegotiations.delete(groupId);
                });
            }
        }

        // --- Mid-negotiation: human constraint update ---
        else if (isConstraintUpdate(content, !!session)) {
            addHumanConstraint(groupId, content);
            console.log(`[ClawBot] 📝 Constraint added: "${content}"`);
            await ctx.conversation.sendText(
                `✅ Got it! Constraint added: "${content}". Adjusting negotiation...`
            );
        }
    });

    agent.on("unhandledError", (error) => {
        console.error("[ClawBot] Unhandled error:", error);
    });

    await agent.start();
}

main().catch((err) => {
    console.error("[ClawBot] Fatal error:", err);
    process.exit(1);
});
