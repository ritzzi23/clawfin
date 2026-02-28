// agents/seller-base.ts
// Shared base class for all seller agents
// Each seller runs its own XMTP identity and responds in the group chat

import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import { chat } from "../lib/openrouter";
import { buildSellerPrompt, SellerConfig, extractPriceFromMessage } from "../lib/prompts/seller-prompts";
import { getSession, addToHistory, recordOffer } from "../lib/negotiation-state";
import { LLM_MODELS, NEGOTIATION } from "../config/agents";
import { SellerStrategy } from "../config/agents";

export interface SellerAgentConfig {
    displayName: string;
    walletKey: `0x${string}`;
    sellerConfig: Omit<SellerConfig, "currentOffer">;
    xmtpEnv: XmtpEnv;
}

export async function startSellerAgent(agentConfig: SellerAgentConfig): Promise<void> {
    const { displayName, walletKey, sellerConfig, xmtpEnv } = agentConfig;

    const account = privateKeyToAccount(walletKey);
    const walletClient = createWalletClient({
        account,
        chain: mainnet,
        transport: http(),
    });

    const signer = {
        getAddress: () => account.address as string,
        signMessage: async (message: string): Promise<Uint8Array> => {
            const sig = await walletClient.signMessage({ account, message });
            const hex = sig.slice(2);
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            }
            return bytes;
        },
    };

    // Derive a stable 32-byte encryption key from wallet private key
    const encryptionKey = new Uint8Array(Buffer.from(walletKey.slice(2), "hex"));
    const client = await Client.create(signer, encryptionKey, { env: xmtpEnv });

    console.log(`[${displayName}] ✅ Online | Inbox: ${client.inboxId}`);

    await client.conversations.sync();

    const stream = client.conversations.streamAllMessages();

    for await (const message of await stream) {
        // Skip own messages
        if (message.senderInboxId === client.inboxId) continue;

        const content =
            typeof message.content === "string" ? message.content : String(message.content ?? "");

        if (!content.trim()) continue;

        const groupId = message.conversationId;
        const session = getSession(groupId);

        // Only respond when there's an active negotiation in this group
        if (!session || session.status === "completed") continue;

        const lower = content.toLowerCase();

        // Respond if:
        // 1. The buyer agent opened negotiations ("reaching out to sellers")
        // 2. Buyer mentioned this seller by @name
        // 3. Buyer posted a counter-offer referencing competitors
        const isMentioned =
            lower.includes(`@${sellerConfig.name.toLowerCase()}`) ||
            lower.includes("reaching out to") ||
            lower.includes("sellers") ||
            lower.includes("counter") ||
            lower.includes("can you do better") ||
            lower.includes("that's above my budget") ||
            lower.includes("i have other offers");

        if (!isMentioned) continue;

        // Add delay so sellers don't all respond simultaneously
        const delay = getStrategyDelay(sellerConfig.strategy);
        await new Promise((r) => setTimeout(r, delay));

        // Calculate current offer (starts at opening, adjusts per round)
        const round = session.round || 1;
        const currentOffer = calculateCurrentOffer(sellerConfig, session.budget, round);

        // Build prompt with history
        const history = session.history.map((h) => ({
            senderName: h.senderName,
            content: h.content,
        }));

        const promptConfig: SellerConfig = { ...sellerConfig, currentOffer };
        const messages = buildSellerPrompt(promptConfig, "ClawBot", history, session.budget);

        const response = await chat(messages, LLM_MODELS.seller, 0.8, 256);

        if (response) {
            const conversation = await client.conversations.getConversationById(groupId);
            if (conversation) {
                await conversation.send(response);

                // Record offer in session state
                const extractedPrice = extractPriceFromMessage(response);
                if (extractedPrice) {
                    recordOffer(groupId, sellerConfig.name, extractedPrice, {
                        hasWarranty: sellerConfig.strategy === "BUNDLER",
                        bundleItems: sellerConfig.strategy === "BUNDLER" ? sellerConfig.bundleItems : [],
                    });
                }

                addToHistory(groupId, sellerConfig.name, response);
                console.log(`[${displayName}] Responded: "${response.slice(0, 80)}..."`);
            }
        }
    }
}

/**
 * Calculate the seller's current offering price based on round and strategy
 */
function calculateCurrentOffer(
    config: Omit<SellerConfig, "currentOffer">,
    buyerBudget: number,
    round: number
): number {
    const msrp = config.msrp;
    const floor = config.floorPrice;

    switch (config.strategy) {
        case "DISCOUNTER": {
            // Drops aggressively each round
            const startPrice = msrp * 0.9; // 10% off to start
            const dropPerRound = (startPrice - floor) / (NEGOTIATION.maxRounds + 1);
            return Math.max(floor, startPrice - dropPerRound * round);
        }
        case "BUNDLER": {
            // Holds price, drops slowly
            const startPrice = msrp * 0.92;
            const dropPerRound = (startPrice - floor) / (NEGOTIATION.maxRounds * 2);
            return Math.max(floor, startPrice - dropPerRound * round);
        }
        case "FIRM": {
            // Barely moves
            const startPrice = msrp * 0.98;
            const maxDrop = msrp * 0.05; // max 5% total
            const dropPerRound = maxDrop / NEGOTIATION.maxRounds;
            return Math.max(floor, startPrice - dropPerRound * Math.min(round, 2));
        }
        default:
            return msrp * 0.9;
    }
}

/**
 * Add strategy-specific delays so sellers feel like separate entities
 */
function getStrategyDelay(strategy: SellerStrategy): number {
    switch (strategy) {
        case "DISCOUNTER": return 2000;  // responds fast (eager)
        case "BUNDLER": return 3500;     // takes a moment (considers bundle)
        case "FIRM": return 5000;        // takes its time (premium, unhurried)
        default: return 3000;
    }
}
