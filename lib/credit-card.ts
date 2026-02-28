// lib/credit-card.ts
// Credit card rewards engine — ported from negotiation_ai/backend/app/services/credit_card_service.py
// Simplified for demo: 3 hardcoded cards with category-based rewards

export interface CreditCard {
    name: string;
    displayName: string;
    rewards: RewardTier[];
    signupBonus?: string;
}

export interface RewardTier {
    category: string;
    keywords: string[];
    cashbackPercent: number;
    note?: string;
}

export interface CardRecommendation {
    card: string;
    cashbackPercent: number;
    cashbackAmount: number;
    effectivePrice: number;
    reason: string;
}

// Demo credit card catalog — simplified from the full Python version
export const DEMO_CARDS: CreditCard[] = [
    {
        name: "discover_it",
        displayName: "Discover It",
        rewards: [
            {
                category: "Electronics",
                keywords: ["headphones", "speaker", "laptop", "tablet", "phone", "camera", "airpods", "sony", "apple", "samsung", "monitor"],
                cashbackPercent: 5,
                note: "5% rotating electronics category",
            },
            { category: "Everything Else", keywords: [], cashbackPercent: 1 },
        ],
    },
    {
        name: "chase_freedom",
        displayName: "Chase Freedom Flex",
        rewards: [
            {
                category: "Shopping",
                keywords: ["amazon", "target", "walmart", "bestbuy", "best buy", "ebay"],
                cashbackPercent: 5,
                note: "5% at select online & in-store retailers",
            },
            { category: "Everything Else", keywords: [], cashbackPercent: 1.5 },
        ],
    },
    {
        name: "amex_blue",
        displayName: "Amex Blue Cash",
        rewards: [
            {
                category: "US Online Retail",
                keywords: ["online", "shop", "store"],
                cashbackPercent: 3,
                note: "3% at US online retailers",
            },
            { category: "Everything Else", keywords: [], cashbackPercent: 1 },
        ],
    },
];

export function getBestCard(
    price: number,
    productName: string,
    vendorName?: string
): CardRecommendation {
    const context = `${productName} ${vendorName || ""}`.toLowerCase();
    let best: CardRecommendation | null = null;

    for (const card of DEMO_CARDS) {
        let bestTier = card.rewards[card.rewards.length - 1]; // default tier
        for (const tier of card.rewards) {
            if (tier.keywords.length === 0) continue;
            if (tier.keywords.some((kw) => context.includes(kw))) {
                bestTier = tier;
                break;
            }
        }

        const cashbackAmount = (price * bestTier.cashbackPercent) / 100;
        const effectivePrice = price - cashbackAmount;

        if (!best || effectivePrice < best.effectivePrice) {
            best = {
                card: card.displayName,
                cashbackPercent: bestTier.cashbackPercent,
                cashbackAmount,
                effectivePrice,
                reason: bestTier.note || `${bestTier.cashbackPercent}% back on ${bestTier.category}`,
            };
        }
    }

    return best!;
}

export function formatCardContext(
    offers: Array<{ sellerName: string; price: number }>,
    productName: string
): string {
    return offers
        .map((o) => {
            const rec = getBestCard(o.price, productName);
            return `${o.sellerName} @ $${o.price.toFixed(2)}: Use ${rec.card} (${rec.cashbackPercent}% back) → effective $${rec.effectivePrice.toFixed(2)}`;
        })
        .join("\n");
}
