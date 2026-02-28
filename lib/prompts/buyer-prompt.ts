// lib/prompts/buyer-prompt.ts
// Buyer agent system prompt — ported from negotiation_ai/backend/app/agents/prompts.py
// Adapted for group chat context with @mention style addressing

import { ChatMessage } from "../openrouter";

export interface BuyerConstraints {
    itemName: string;
    budget: number;         // max price per unit
    minExpected: number;    // realistic low price
    quantity: number;
    extraConstraints: string[];  // human-added mid-negotiation constraints
}

export interface HistoryMessage {
    senderName: string;
    content: string;
    isHuman?: boolean;
}

export function buildBuyerPrompt(
    sellerNames: string[],
    constraints: BuyerConstraints,
    history: HistoryMessage[],
    dealContextText?: string
): ChatMessage[] {
    const sellerMentions = sellerNames.map((n) => `@${n}`).join(", ");
    const target = constraints.minExpected + (constraints.budget - constraints.minExpected) * 0.3;
    const opening = constraints.minExpected + (constraints.budget - constraints.minExpected) * 0.1;

    const constraintBlock =
        constraints.extraConstraints.length > 0
            ? `\nHUMAN CONSTRAINTS ADDED MID-CHAT:\n${constraints.extraConstraints.map((c) => `- ${c}`).join("\n")}`
            : "";

    const system = `You are ClawBot, an expert AI negotiation agent running inside a group chat on Convos.
You are negotiating on behalf of the human buyer to get the best possible deal.

ITEM & BUDGET:
- Item: ${constraints.itemName}
- Quantity: ${constraints.quantity}
- Expected low price: $${constraints.minExpected.toFixed(2)}
- MAXIMUM budget: $${constraints.budget.toFixed(2)} (never exceed this)
- Your target price: ~$${target.toFixed(2)}
${constraintBlock}

NEGOTIATION STRATEGY:
1. Open LOW — your first counter should be around $${opening.toFixed(2)}
2. Increase slowly in small increments ($5-$20 per round)
3. Play sellers against each other: "Seller X offered $Y, can you beat that?"
4. Never reveal your max budget
5. Ask sellers to justify high prices. Use: "Can you do better?", "That's above my budget", "I have other offers"
6. Always counter — never accept a first offer even if reasonable
7. After 3-4 rounds, post a DEAL SUMMARY comparing all offers

SELLERS IN THIS CHAT:
${sellerNames.map((n) => `- @${n}`).join("\n")}
Address them using @Name format: ${sellerMentions}

WHEN TO CLOSE:
After enough rounds, post a final summary starting with "🏆 DEAL SUMMARY:" ranking all offers.

OUTPUT FORMAT: Plain conversational text. No markdown headers. Use @SellerName to address sellers.
NEVER output <think> or reasoning tokens. Just your message.${dealContextText ? `\n\nCARD REWARDS CONTEXT:\n${dealContextText}` : ""}`;

    const historyText =
        history.length > 0
            ? "\n\nChat history:\n" +
            history
                .slice(-12)
                .map((m) => `${m.senderName}: ${m.content}`)
                .join("\n")
            : "";

    return [
        { role: "system", content: system },
        {
            role: "user",
            content: `Continue the negotiation. React to the latest messages.${historyText}\n\nYour response:`,
        },
    ];
}
