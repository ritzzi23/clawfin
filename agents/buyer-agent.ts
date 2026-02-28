// agents/buyer-agent.ts
// ClawBot — the main buyer negotiation agent
// Runs as a standalone process with its own XMTP identity
// Listens in a Convos group chat and orchestrates the full negotiation flow

import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
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
const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

// In-memory: track which group IDs are actively negotiating
const activeNegotiations = new Set<string>();

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOfferFromMessage(
    message: string,
    sellerName: string
): SellerOffer | null {
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
    const bundleMatch = message.match(
        /includes?\s+([^.,$\n]+)/i
    );
    const bundleItems = bundleMatch
        ? bundleMatch[1].split(/,\s*|and\s+/).map((s) => s.trim()).filter(Boolean)
        : [];

    return { sellerName, price, hasWarranty, isRefurbished, bundleItems };
}

async function runNegotiationOrchestrator(
    client: Client,
    conversation: any,
    productName: string,
    budget: number,
    minExpected: number
) {
    const groupId = conversation.id;
    const session = getSession(groupId)!;
    const sellerNames = AGENTS.sellers.map((s) => s.name);

    console.log(`[BuyerAgent] Starting negotiation for "${productName}" @ budget $${budget}`);

    // --- Opening message ---
    await conversation.send(
        `🔍 On it! I'm reaching out to ${sellerNames.length} sellers simultaneously to find the best deal on **${productName}**...\n\nSellers in this chat: ${sellerNames.map((n) => `@${n}`).join(", ")}`
    );

    // Wait for sellers to see the message and respond
    await sleep(5000);

    // --- Negotiation rounds ---
    for (let round = 1; round <= NEGOTIATION.maxRounds; round++) {
        const currentRound = incrementRound(groupId);
        console.log(`[BuyerAgent] Round ${currentRound}`);

        // Build constraint-aware buyer prompt
        const constraints: BuyerConstraints = {
            itemName: productName,
            budget,
            minExpected,
            quantity: session.quantity,
            extraConstraints: session.extraConstraints,
        };

        // Collect current offers for credit card context
        const currentOffers = Object.values(session.offers).map((o) => ({
            sellerName: o.sellerName,
            price: o.price,
        }));

        const messages = buildBuyerPrompt(sellerNames, constraints, session.history);
        const buyerResponse = await chat(messages, LLM_MODELS.buyer, 0.7, 512);

        if (buyerResponse) {
            await conversation.send(buyerResponse);
            addToHistory(groupId, AGENTS.buyer.name, buyerResponse);
            console.log(`[BuyerAgent] Sent round ${currentRound} message`);
        }

        // Give sellers time to respond naturally
        await sleep(NEGOTIATION.roundDelayMs);

        // Check if we're at the final round
        if (round === NEGOTIATION.maxRounds) {
            // Gather all offers received so far and post summary
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

    // If no offers collected (edge case), use fallback demo offers
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

    await conversation.send(summary);

    const winner = ranked[0];
    completeSession(groupId, winner.sellerName);

    // Fire Composio post-deal actions asynchronously
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
        await conversation.send(
            `📬 Post-deal actions complete:${composioResult}`
        );
    }

    activeNegotiations.delete(groupId);
    console.log(`[BuyerAgent] Negotiation complete for group ${groupId}`);
}

async function main() {
    if (!BUYER_WALLET_KEY) {
        console.error("[BuyerAgent] BUYER_WALLET_KEY not set in .env");
        process.exit(1);
    }

    const account = privateKeyToAccount(BUYER_WALLET_KEY);
    const walletClient = createWalletClient({
        account,
        chain: mainnet,
        transport: http(),
    });

    const signer = {
        getAddress: () => account.address as string,
        signMessage: async (message: string): Promise<Uint8Array> => {
            const sig = await walletClient.signMessage({ account, message });
            // Convert hex "0x..." signature to Uint8Array
            const hex = sig.slice(2);
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            }
            return bytes;
        },
    };

    // Derive a stable 32-byte encryption key from the wallet private key
    const encryptionKey = new Uint8Array(
        Buffer.from(BUYER_WALLET_KEY.slice(2), "hex")
    );

    const client = await Client.create(signer, encryptionKey, {
        env: XMTP_ENV,
    });

    console.log(`[BuyerAgent] ✅ ${AGENTS.buyer.displayName} online`);
    console.log(`[BuyerAgent] Inbox ID: ${client.inboxId}`);
    console.log(`[BuyerAgent] Listening for group chat messages on XMTP (${XMTP_ENV})...`);

    // Sync conversations
    await client.conversations.sync();

    // Stream all messages
    const stream = client.conversations.streamAllMessages();

    for await (const message of await stream) {
        // Skip own messages
        if (message.senderInboxId === client.inboxId) continue;

        const content =
            typeof message.content === "string" ? message.content : String(message.content ?? "");

        if (!content.trim()) continue;

        const conversation = await client.conversations.getConversationById(
            message.conversationId
        );
        if (!conversation) continue;

        const groupId = message.conversationId;
        const session = getSession(groupId);
        const senderName = message.senderInboxId.slice(0, 6); // short ID as display name

        // Record ALL messages to history for context
        if (session) {
            addToHistory(groupId, senderName, content);

            // Capture seller offers from their messages
            for (const seller of AGENTS.sellers) {
                if (content.toLowerCase().includes(seller.name.toLowerCase()) ||
                    message.senderInboxId !== client.inboxId) {
                    const offer = extractOfferFromMessage(content, seller.name);
                    if (offer && offer.price > 0) {
                        session.offers[seller.name] = offer;
                        console.log(`[BuyerAgent] Captured offer from @${seller.name}: $${offer.price}`);
                    }
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
                const newSession = createSession(
                    groupId,
                    parsed.productName,
                    parsed.budget,
                    parsed.minExpected
                );
                addToHistory(groupId, senderName, content);

                // Run negotiation in background (non-blocking)
                runNegotiationOrchestrator(
                    client,
                    conversation,
                    parsed.productName,
                    parsed.budget,
                    parsed.minExpected
                ).catch((err) => {
                    console.error("[BuyerAgent] Negotiation error:", err);
                    activeNegotiations.delete(groupId);
                });
            }
        }

        // --- Mid-negotiation: human constraint update ---
        else if (isConstraintUpdate(content, !!session)) {
            addHumanConstraint(groupId, content);
            console.log(`[BuyerAgent] Detected constraint update: "${content}"`);
            await conversation.send(
                `✅ Noted! Constraint added: "${content}". Adjusting negotiation parameters...`
            );
        }
    }
}

main().catch((err) => {
    console.error("[BuyerAgent] Fatal error:", err);
    process.exit(1);
});
