#!/usr/bin/env node
// scripts/convos-handler.ts
// LLM handler for ClawFin bridge script.
// Called by clawfin-bridge.sh with --message argument.
// Prints reply to stdout, which the bridge sends to Convos.

import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";

const args = process.argv.slice(2);
const convIdIdx = args.indexOf("--conv-id");
const msgIdx = args.indexOf("--message");

const convId = convIdIdx >= 0 ? args[convIdIdx + 1] : "default";
const message = msgIdx >= 0 ? args[msgIdx + 1] : "";

// Simple in-memory per-session history (process restarts clear it)
const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

const SYSTEM_PROMPT = `You are ClawBot, an AI deal-negotiation agent in a Convos group chat.

Your role:
- Listen for product deal requests from the user
- Once you understand what they want, tell them you're contacting sellers
- You represent a buyer looking for the best price
- Be concise, friendly, and helpful
- Keep responses SHORT — 1-3 sentences max
- If they say "Find me the best deal on X, budget $Y", acknowledge it enthusiastically

You are powered by ClawFin, a multi-agent deal negotiation system.
Other agents (DealDasher, BundleKing, PremiumHub, FlashDeals) are also in the group as sellers.

Rules:
- Plain text only, no markdown
- Short responses
- Be enthusiastic about finding deals
`;

async function main() {
    if (message === "__INIT__") {
        process.stdout.write(
            "🤖 ClawBot online! I find you the best deals by negotiating with multiple sellers.\n" +
            "Try: Find me the best deal on AirPods Max, budget $450\n"
        );
        return;
    }

    if (!message) {
        process.stdout.write("(no message)");
        return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        process.stdout.write("ClawBot here! (API key not configured — set OPENROUTER_API_KEY)");
        return;
    }

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
    });

    conversationHistory.push({ role: "user", content: message });

    try {
        const response = await openai.chat.completions.create({
            model: process.env.LLM_BUYER_MODEL || "anthropic/claude-3-haiku",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...conversationHistory,
            ],
            max_tokens: 200,
        });

        const reply = response.choices[0]?.message?.content?.trim() || "I'm on it!";
        conversationHistory.push({ role: "assistant", content: reply });
        process.stdout.write(reply + "\n");
    } catch (err: any) {
        process.stdout.write("ClawBot is thinking... (LLM error: " + err.message + ")\n");
    }
}

main().catch((err) => {
    process.stdout.write("ClawBot error: " + err.message + "\n");
    process.exit(0); // Don't crash the bridge
});
