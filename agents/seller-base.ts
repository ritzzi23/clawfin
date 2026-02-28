// agents/seller-base.ts
// Shared base for all seller agents using @xmtp/agent-sdk
// Each seller is an Agent instance with its own identity and wallet

import { Agent, createSigner, createUser, filter as f } from "@xmtp/agent-sdk";
import type { XmtpEnv } from "@xmtp/agent-sdk";

import { chat } from "../lib/openrouter";
import { buildSellerPrompt, SellerConfig, extractPriceFromMessage } from "../lib/prompts/seller-prompts";
import { getSession, addToHistory, recordOffer } from "../lib/negotiation-state";
import { LLM_MODELS, NEGOTIATION } from "../config/agents";

export interface SellerAgentConfig {
    displayName: string;
    walletKey: `0x${string}`;
    dbEncryptionKey?: string;
    sellerConfig: Omit<SellerConfig, "currentOffer">;
    xmtpEnv: XmtpEnv;
}

export async function startSellerAgent(agentConfig: SellerAgentConfig): Promise<void> {
    const { displayName, walletKey, dbEncryptionKey, sellerConfig, xmtpEnv } = agentConfig;
    const safeId = sellerConfig.name.toLowerCase().replace(/\s+/g, "-");

    const user = createUser(walletKey);
    const signer = createSigner(user);

    const agent = await Agent.create(signer, {
        env: xmtpEnv,
        dbPath: `.data/${safeId}.db`,
        dbEncryptionKey: dbEncryptionKey
            ? Buffer.from(dbEncryptionKey.replace(/^0x/, ""), "hex")
            : undefined,
    });

    console.log(`[${displayName}] ✅ Online | Address: ${agent.address}`);

    agent.on("text", async (ctx) => {
        // Skip own messages
        if (f.fromSelf(ctx.message, ctx.client)) return;

        const content = ctx.message.content;
        if (!content?.trim()) return;

        const groupId = ctx.conversation.id;
        const session = getSession(groupId);

        // Only respond when there's an active negotiation in this group
        if (!session || session.status === "completed") return;

        const lower = content.toLowerCase();

        // Visibility filter: respond only to buyer (ClawBot) or negotiation triggers
        const isMentioned =
            lower.includes(`@${sellerConfig.name.toLowerCase()}`) ||
            lower.includes("reaching out to") ||
            lower.includes("sellers") ||
            lower.includes("counter") ||
            lower.includes("can you do better") ||
            lower.includes("that's above my budget") ||
            lower.includes("i have other offers") ||
            lower.includes("best offer");

        if (!isMentioned) return;

        // Add strategy-based delay so sellers feel like separate entities
        const delay = getStrategyDelay(sellerConfig.strategy);
        await new Promise((r) => setTimeout(r, delay));

        const round = session.round || 1;
        const currentOffer = calculateCurrentOffer(sellerConfig, session.budget, round);

        // Apply visibility filter — seller only sees buyer messages + its own
        const history = session.history
            .filter(
                (h) =>
                    h.senderName === "ClawBot" ||
                    h.senderName === sellerConfig.name ||
                    (h.senderName !== "DealDasher" &&
                        h.senderName !== "BundleKing" &&
                        h.senderName !== "PremiumHub" &&
                        h.senderName !== "FlashDeals")
            )
            .map((h) => ({
                senderName: h.senderName,
                content: h.content,
                isHuman: h.senderName !== "ClawBot" &&
                    h.senderName !== "DealDasher" &&
                    h.senderName !== "BundleKing" &&
                    h.senderName !== "PremiumHub" &&
                    h.senderName !== "FlashDeals",
            }));

        const promptConfig: SellerConfig = { ...sellerConfig, currentOffer };
        const messages = buildSellerPrompt(promptConfig, "ClawBot", history, session.budget);

        const response = await chat(messages, LLM_MODELS.seller, 0.8, 256);

        if (response) {
            await ctx.conversation.sendText(response);

            const extractedPrice = extractPriceFromMessage(response);
            if (extractedPrice) {
                recordOffer(groupId, sellerConfig.name, extractedPrice, {
                    hasWarranty: sellerConfig.strategy === "BUNDLER",
                    bundleItems: sellerConfig.strategy === "BUNDLER" ? sellerConfig.bundleItems : [],
                });
            }

            addToHistory(groupId, sellerConfig.name, response);
            console.log(`[${displayName}] 💬 "${response.slice(0, 80)}..."`);
        }
    });

    agent.on("unhandledError", (error) => {
        console.error(`[${displayName}] Error:`, error);
    });

    await agent.start();
}

function calculateCurrentOffer(
    config: Omit<SellerConfig, "currentOffer">,
    buyerBudget: number,
    round: number
): number {
    const msrp = config.msrp;
    const floor = config.floorPrice;

    switch (config.strategy) {
        case "DISCOUNTER": {
            const startPrice = msrp * 0.9;
            const dropPerRound = (startPrice - floor) / (NEGOTIATION.maxRounds + 1);
            return Math.max(floor, startPrice - dropPerRound * round);
        }
        case "BUNDLER": {
            const startPrice = msrp * 0.92;
            const dropPerRound = (startPrice - floor) / (NEGOTIATION.maxRounds * 2);
            return Math.max(floor, startPrice - dropPerRound * round);
        }
        case "FIRM": {
            const startPrice = msrp * 0.98;
            const maxDrop = msrp * 0.05;
            const dropPerRound = maxDrop / NEGOTIATION.maxRounds;
            return Math.max(floor, startPrice - dropPerRound * Math.min(round, 2));
        }
        case "URGENCY": {
            const startPrice = msrp * 0.88;
            const dropPerRound = (startPrice - floor) / (NEGOTIATION.maxRounds + 1);
            return Math.max(floor, startPrice - dropPerRound * round);
        }
        default:
            return msrp * 0.9;
    }
}

function getStrategyDelay(strategy: string): number {
    switch (strategy) {
        case "DISCOUNTER": return 2000;
        case "BUNDLER": return 3500;
        case "FIRM": return 5000;
        case "URGENCY": return 1500;
        default: return 3000;
    }
}
