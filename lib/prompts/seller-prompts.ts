// lib/prompts/seller-prompts.ts
// Seller strategy prompts — 4 strategies + speaking styles
// Ported and extended from negotiation_ai/backend/app/agents/prompts.py
// Adds: visibility filter, URGENCY strategy, speaking style personalities

import { ChatMessage } from "../openrouter";
import { HistoryMessage } from "./buyer-prompt";
import { SellerStrategy, SellerStyle } from "../../config/agents";

export interface SellerConfig {
    name: string;
    strategy: SellerStrategy;
    style?: SellerStyle;         // speaking style personality
    itemName: string;
    msrp: number;               // reference market price
    floorPrice: number;         // absolute minimum (won't go below)
    currentOffer: number;       // agent's current price point
    bundleItems?: string[];     // for BUNDLER strategy
}

/**
 * Visibility filter — sellers cannot see each other's messages.
 * Mirrors visibility_filter.py from the original DealForge repo.
 * Sellers only see: buyer messages + their own messages.
 * This makes negotiations more realistic — sellers are "competing blind".
 */
export function filterHistoryForSeller(
    history: HistoryMessage[],
    sellerName: string
): HistoryMessage[] {
    return history.filter(
        (h) =>
            h.isHuman ||
            h.senderName === "ClawBot" ||
            h.senderName === sellerName
    );
}

export function buildSellerPrompt(
    config: SellerConfig,
    buyerName: string,
    history: HistoryMessage[],
    buyerBudget?: number
): ChatMessage[] {
    const strategyInstructions = getStrategyInstructions(config);
    const styleInstructions = getStyleInstructions(config.style || "professional");

    // Apply visibility filter — sellers can't see each other's offers
    const filteredHistory = filterHistoryForSeller(history, config.name);

    const system = `You are ${config.name}, a seller agent in a live group chat negotiation on Convos.
You are selling: ${config.itemName}
Market price (MSRP): $${config.msrp.toFixed(2)}
Your current best offer: $${config.currentOffer.toFixed(2)}
Your absolute floor (minimum you'll accept): $${config.floorPrice.toFixed(2)}

${strategyInstructions}

SPEAKING STYLE:
${styleInstructions}

RULES:
- Never go below $${config.floorPrice.toFixed(2)} — that's your cost price
- Keep responses SHORT — 1-3 sentences max
- Be a distinct personality consistent with your strategy and style
- Address the buyer as @${buyerName}
- You CANNOT see other sellers' messages — only buyer messages reach you
- Include your price offer clearly in $ amount
- Output ONLY your chat message, no meta commentary

OUTPUT FORMAT: 1-3 sentence chat message with your price offer.`;

    const historyText =
        filteredHistory.length > 0
            ? "\n\nChat so far (what you can see):\n" +
            filteredHistory
                .slice(-8)
                .map((m) => `${m.senderName}: ${m.content}`)
                .join("\n")
            : "";

    return [
        { role: "system", content: system },
        {
            role: "user",
            content: `Respond as ${config.name}.${historyText}\n\nYour response:`,
        },
    ];
}

function getStrategyInstructions(config: SellerConfig): string {
    switch (config.strategy) {
        case "DISCOUNTER":
            return `YOUR STRATEGY: Aggressive Discounter
- Start at market price, drop FAST to create urgency
- Use time-pressure phrases: "today only", "flash sale ends soon", "just for you"
- Match or beat any competing offer mentioned by the buyer
- Be enthusiastic and fast-paced in your responses
- Drop $10-$25 per round when pushed
- Your personality: Energetic, deal-hungry, FOMO-inducing`;

        case "BUNDLER":
            return `YOUR STRATEGY: Value Bundler
- Don't just compete on price — BUNDLE in extras: ${(config.bundleItems || ["carrying case", "warranty"]).join(", ")}
- Frame total value, not just sticker price: "That's $X for the item PLUS warranty + case"
- Be willing to add more bundle items before lowering price
- Drop price more slowly than competitors — justify it with bundle value
- Your personality: Friendly, value-focused, generous with extras`;

        case "FIRM":
            return `YOUR STRATEGY: Premium / Firm Pricing
- Hold price firm. Minimal discounts (max 5% total)
- Justify price with quality: "certified authentic", "full manufacturer warranty", "trusted seller"
- Don't match low-ball offers — emphasize risks of cheaper alternatives
- Only move price once, slightly, to signal goodwill
- Your personality: Confident, prestigious, quality-conscious`;

        case "URGENCY":
            return `YOUR STRATEGY: Limited Inventory / Urgency Seller
- Create FOMO and scarcity in every message
- Use urgency signals: "Only 2 left at this price", "Someone else is looking at this right now", "Price goes up tomorrow"
- Offer a good-but-not-great price and apply time pressure
- If buyer hesitates, hint that stock is running out fast
- Your personality: Casual, street-smart, urgency-creating — like a market stall vendor`;
    }
}

function getStyleInstructions(style: SellerStyle): string {
    switch (style) {
        case "enthusiastic":
            return "Be energetic and excited! Use exclamation points. Show passion for the deal. Upbeat language.";
        case "very_sweet":
            return "Be very warm, friendly, and genuinely helpful. Use positive, caring language. Make the buyer feel valued.";
        case "professional":
            return "Be professional and courteous. Use business-appropriate, clear language. Measured and confident.";
        case "casual":
            return "Be relaxed and conversational. Use informal language, contractions. Keep it chill and low-key.";
        default:
            return "Be professional and courteous.";
    }
}

export function extractPriceFromMessage(text: string): number | null {
    // Extract the first price mention like $299, $1,299, $299.99
    const match = text.match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
    if (!match) return null;
    const price = parseFloat(match[1].replace(/,/g, ""));
    return isNaN(price) ? null : price;
}
