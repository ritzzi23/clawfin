// agents/start-sellers.ts
// Starts all 4 seller agents concurrently
// Each gets its own XMTP wallet identity and runs independently

import dotenv from "dotenv";
import { type XmtpEnv } from "@xmtp/node-sdk";
import { startSellerAgent } from "./seller-base";

dotenv.config();

const XMTP_ENV = (process.env.XMTP_ENV || "dev") as XmtpEnv;

async function main() {
    console.log("🚀 Starting ClawFin Seller Agents (4 agents)...\n");

    // Check all wallet keys are present BEFORE starting agents
    const missing = [
        !process.env.SELLER_DISCOUNTER_WALLET_KEY && "SELLER_DISCOUNTER_WALLET_KEY",
        !process.env.SELLER_BUNDLER_WALLET_KEY && "SELLER_BUNDLER_WALLET_KEY",
        !process.env.SELLER_FIRM_WALLET_KEY && "SELLER_FIRM_WALLET_KEY",
        !process.env.SELLER_URGENCY_WALLET_KEY && "SELLER_URGENCY_WALLET_KEY",
    ].filter(Boolean);

    if (missing.length > 0) {
        console.error(`[Sellers] Missing env vars: ${missing.join(", ")}`);
        console.error("Run: npx ts-node scripts/gen-keys.ts");
        process.exit(1);
    }

    const sellerPromises = [
        // --- Seller 1: DealDasher (Aggressive Discounter) ---
        startSellerAgent({
            displayName: "⚡ DealDasher",
            walletKey: process.env.SELLER_DISCOUNTER_WALLET_KEY as `0x${string}`,
            xmtpEnv: XMTP_ENV,
            sellerConfig: {
                name: "DealDasher",
                strategy: "DISCOUNTER",
                style: "enthusiastic",
                itemName: "product",
                msrp: 300,
                floorPrice: 225,
            },
        }),

        // --- Seller 2: BundleKing (Value Bundler) ---
        startSellerAgent({
            displayName: "🎁 BundleKing",
            walletKey: process.env.SELLER_BUNDLER_WALLET_KEY as `0x${string}`,
            xmtpEnv: XMTP_ENV,
            sellerConfig: {
                name: "BundleKing",
                strategy: "BUNDLER",
                style: "very_sweet",
                itemName: "product",
                msrp: 300,
                floorPrice: 255,
                bundleItems: ["carrying case", "2-year warranty", "USB-C cable"],
            },
        }),

        // --- Seller 3: PremiumHub (Firm Pricing) ---
        startSellerAgent({
            displayName: "💎 PremiumHub",
            walletKey: process.env.SELLER_FIRM_WALLET_KEY as `0x${string}`,
            xmtpEnv: XMTP_ENV,
            sellerConfig: {
                name: "PremiumHub",
                strategy: "FIRM",
                style: "professional",
                itemName: "product",
                msrp: 300,
                floorPrice: 285,
            },
        }),

        // --- Seller 4: FlashDeals (Limited Inventory / Urgency) ---
        startSellerAgent({
            displayName: "🔥 FlashDeals",
            walletKey: process.env.SELLER_URGENCY_WALLET_KEY as `0x${string}`,
            xmtpEnv: XMTP_ENV,
            sellerConfig: {
                name: "FlashDeals",
                strategy: "URGENCY",
                style: "casual",
                itemName: "product",
                msrp: 300,
                floorPrice: 234,   // 78% of $300
            },
        }),
    ];

    console.log("✅ All 4 seller agents starting...");

    // Run all sellers concurrently (they each maintain their own XMTP stream)
    await Promise.all(sellerPromises).catch((err) => {
        console.error("[Sellers] Fatal error:", err);
        process.exit(1);
    });
}

main();
