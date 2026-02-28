// agents/start-sellers.ts
// Starts all 4 seller agents concurrently using @xmtp/agent-sdk
// Each agent has its own XMTP identity (wallet + db encryption key)

import dotenv from "dotenv";
import type { XmtpEnv } from "@xmtp/agent-sdk";
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
        console.error("Run: npm run gen:keys");
        process.exit(1);
    }

    const sellerPromises = [
        // --- Seller 1: DealDasher (Aggressive Discounter) ---
        startSellerAgent({
            displayName: "⚡ DealDasher",
            walletKey: process.env.SELLER_DISCOUNTER_WALLET_KEY! as `0x${string}`,
            dbEncryptionKey: process.env.SELLER_DISCOUNTER_DB_ENCRYPTION_KEY,
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
            walletKey: process.env.SELLER_BUNDLER_WALLET_KEY! as `0x${string}`,
            dbEncryptionKey: process.env.SELLER_BUNDLER_DB_ENCRYPTION_KEY,
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
            walletKey: process.env.SELLER_FIRM_WALLET_KEY! as `0x${string}`,
            dbEncryptionKey: process.env.SELLER_FIRM_DB_ENCRYPTION_KEY,
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
            walletKey: process.env.SELLER_URGENCY_WALLET_KEY! as `0x${string}`,
            dbEncryptionKey: process.env.SELLER_URGENCY_DB_ENCRYPTION_KEY,
            xmtpEnv: XMTP_ENV,
            sellerConfig: {
                name: "FlashDeals",
                strategy: "URGENCY",
                style: "casual",
                itemName: "product",
                msrp: 300,
                floorPrice: 234,
            },
        }),
    ];

    console.log("✅ All 4 seller agents starting...\n");

    await Promise.all(sellerPromises).catch((err) => {
        console.error("[Sellers] Fatal error:", err);
        process.exit(1);
    });
}

main();
