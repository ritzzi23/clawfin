// config/agents.ts
// Agent identities, seller strategies, and configuration

export const AGENTS = {
    buyer: {
        name: "ClawBot",
        displayName: "🤖 ClawBot",
        envKey: "BUYER_WALLET_KEY",
    },
    sellers: [
        {
            id: "discounter",
            name: "DealDasher",
            displayName: "⚡ DealDasher",
            envKey: "SELLER_DISCOUNTER_WALLET_KEY",
            strategy: "DISCOUNTER" as const,
            style: "enthusiastic" as const,
            floorPriceMultiplier: 0.75,
            openingDiscountPercent: 0.1,
            maxDiscountPercent: 0.25,
        },
        {
            id: "bundler",
            name: "BundleKing",
            displayName: "🎁 BundleKing",
            envKey: "SELLER_BUNDLER_WALLET_KEY",
            strategy: "BUNDLER" as const,
            style: "very_sweet" as const,
            floorPriceMultiplier: 0.85,
            bundleItems: ["carrying case", "2-year warranty", "USB-C cable", "cleaning kit"],
        },
        {
            id: "firm",
            name: "PremiumHub",
            displayName: "💎 PremiumHub",
            envKey: "SELLER_FIRM_WALLET_KEY",
            strategy: "FIRM" as const,
            style: "professional" as const,
            floorPriceMultiplier: 0.95,
            maxDiscountPercent: 0.05,
        },
        {
            id: "urgency",
            name: "FlashDeals",
            displayName: "🔥 FlashDeals",
            envKey: "SELLER_URGENCY_WALLET_KEY",
            strategy: "URGENCY" as const,
            style: "casual" as const,
            floorPriceMultiplier: 0.78,
        },
    ],
} as const;

export const LLM_MODELS = {
    buyer: "anthropic/claude-3.5-haiku", // smarter model for buyer strategy
    seller: "meta-llama/llama-3.1-8b-instruct:free", // free model for sellers
} as const;

export const NEGOTIATION = {
    maxRounds: 4,
    roundDelayMs: 3000, // 3 seconds between rounds (feels natural in chat)
    triggerPhrases: ["find me", "deal on", "negotiate", "best price", "get me"],
    constraintPhrases: ["no ", "only ", "budget is", "max ", "must have", "without", "prefer"],
    dealKeywords: ["done", "deal", "accept", "i'll take it", "sold"],
} as const;

export type SellerStrategy = "DISCOUNTER" | "BUNDLER" | "FIRM" | "URGENCY";
export type SellerStyle = "enthusiastic" | "very_sweet" | "professional" | "casual";
