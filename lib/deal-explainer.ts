// lib/deal-explainer.ts
// Deal ranking and explanation engine — ported from negotiation_ai/backend/app/services/deal_explainer.py
// Given a list of offers, ranks them by effective price and generates a chat-ready summary

import { getBestCard } from "./credit-card";

export interface SellerOffer {
    sellerName: string;
    price: number;
    bundleItems?: string[];    // extras included (bundler strategy)
    isRefurbished?: boolean;
    hasWarranty?: boolean;
}

export interface RankedOffer extends SellerOffer {
    rank: number;
    cardName: string;
    cashbackPercent: number;
    cashbackAmount: number;
    effectivePrice: number;
    explanation: string;
}

export function rankOffers(
    offers: SellerOffer[],
    productName: string,
    budget: number
): RankedOffer[] {
    if (offers.length === 0) return [];

    const scored = offers.map((offer) => {
        const card = getBestCard(offer.price, productName);
        let score = card.effectivePrice;

        // Bonus for warranty (-2% discount equivalent)
        if (offer.hasWarranty) score *= 0.98;

        // Penalty for refurbished (+3% penalty)
        if (offer.isRefurbished) score *= 1.03;

        return { ...offer, card, score };
    });

    // Sort by effective price ascending (lower = better)
    scored.sort((a, b) => a.score - b.score);

    return scored.map((item, idx) => {
        const rank = idx + 1;
        let explanation = "";

        if (rank === 1) {
            explanation = `Best deal! ${item.card.card} gives ${item.card.cashbackPercent}% back`;
            if (item.bundleItems && item.bundleItems.length > 0) {
                explanation += ` + includes ${item.bundleItems.join(", ")}`;
            }
            if (item.hasWarranty) explanation += " + warranty included";
        } else if (rank === 2) {
            const diff = item.card.effectivePrice - scored[0].card.effectivePrice;
            explanation = `$${diff.toFixed(2)} more than winner after rewards`;
        } else {
            explanation = `$${(item.card.effectivePrice - scored[0].card.effectivePrice).toFixed(2)} above best — not recommended`;
        }

        return {
            ...item,
            rank,
            cardName: item.card.card,
            cashbackPercent: item.card.cashbackPercent,
            cashbackAmount: item.card.cashbackAmount,
            effectivePrice: item.card.effectivePrice,
            explanation,
        };
    });
}

export function formatDealSummary(
    ranked: RankedOffer[],
    productName: string,
    budget: number
): string {
    if (ranked.length === 0) return "No offers received.";

    const winner = ranked[0];
    const savings = budget - winner.effectivePrice;

    let summary = `🏆 DEAL SUMMARY — ${productName}\n`;
    summary += `${"─".repeat(40)}\n\n`;

    ranked.forEach((offer) => {
        const medal = ["🥇", "🥈", "🥉"][offer.rank - 1] || `#${offer.rank}`;
        const bundle = offer.bundleItems?.length ? ` (+${offer.bundleItems.join(", ")})` : "";
        summary += `${medal} @${offer.sellerName}: $${offer.price.toFixed(2)}${bundle}\n`;
        summary += `   💳 Use ${offer.cardName} (${offer.cashbackPercent}% back) → $${offer.effectivePrice.toFixed(2)} effective\n`;
        summary += `   ℹ️  ${offer.explanation}\n\n`;
    });

    summary += `${"─".repeat(40)}\n`;
    summary += `✅ GO WITH: @${winner.sellerName} at $${winner.price.toFixed(2)}\n`;
    summary += `💳 PAY WITH: ${winner.cardName}\n`;
    summary += `💰 EFFECTIVE PRICE: $${winner.effectivePrice.toFixed(2)}\n`;
    if (savings > 0) {
        summary += `🎉 YOU SAVE: $${savings.toFixed(2)} vs your $${budget} budget\n`;
    }

    return summary;
}
