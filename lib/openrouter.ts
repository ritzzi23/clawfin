// lib/openrouter.ts
// Thin OpenRouter API client using the OpenAI-compatible endpoint

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/ritzzi23/clawfin",
        "X-Title": "ClawFin — Group Chat Negotiation",
    },
});

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export async function chat(
    messages: ChatMessage[],
    model: string = "anthropic/claude-3.5-haiku",
    temperature: number = 0.7,
    maxTokens: number = 512
): Promise<string> {
    try {
        const response = await client.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
        });

        return response.choices[0]?.message?.content?.trim() || "";
    } catch (err: any) {
        console.error("[OpenRouter] Error:", err?.message);
        throw err;
    }
}

export default client;
