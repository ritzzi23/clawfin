// lib/negotiation-state.ts
// In-memory session state for active negotiations
// Keyed by XMTP group conversation ID

import { SellerOffer } from "./deal-explainer";

export type NegotiationStatus = "idle" | "searching" | "negotiating" | "completed";

export interface NegotiationSession {
    groupId: string;
    productName: string;
    budget: number;
    minExpected: number;
    quantity: number;
    extraConstraints: string[];
    status: NegotiationStatus;
    round: number;
    offers: Record<string, SellerOffer>;   // sellerName → latest offer
    history: Array<{ senderName: string; content: string; timestamp: number }>;
    startedAt: number;
    completedAt?: number;
    winnerSeller?: string;
}

// Singleton map: groupId → session
const sessions = new Map<string, NegotiationSession>();

export function getSession(groupId: string): NegotiationSession | undefined {
    return sessions.get(groupId);
}

export function createSession(
    groupId: string,
    productName: string,
    budget: number,
    minExpected: number,
    quantity: number = 1
): NegotiationSession {
    const session: NegotiationSession = {
        groupId,
        productName,
        budget,
        minExpected,
        quantity,
        extraConstraints: [],
        status: "searching",
        round: 0,
        offers: {},
        history: [],
        startedAt: Date.now(),
    };
    sessions.set(groupId, session);
    return session;
}

export function addHumanConstraint(groupId: string, constraint: string): void {
    const session = sessions.get(groupId);
    if (session) {
        session.extraConstraints.push(constraint);
    }
}

export function recordOffer(
    groupId: string,
    sellerName: string,
    price: number,
    extra?: Partial<SellerOffer>
): void {
    const session = sessions.get(groupId);
    if (session) {
        session.offers[sellerName] = {
            sellerName,
            price,
            ...extra,
        };
    }
}

export function addToHistory(
    groupId: string,
    senderName: string,
    content: string
): void {
    const session = sessions.get(groupId);
    if (session) {
        session.history.push({ senderName, content, timestamp: Date.now() });
        // Keep last 30 messages
        if (session.history.length > 30) {
            session.history = session.history.slice(-30);
        }
    }
}

export function incrementRound(groupId: string): number {
    const session = sessions.get(groupId);
    if (session) {
        session.round++;
        return session.round;
    }
    return 0;
}

export function completeSession(groupId: string, winnerSeller: string): void {
    const session = sessions.get(groupId);
    if (session) {
        session.status = "completed";
        session.winnerSeller = winnerSeller;
        session.completedAt = Date.now();
    }
}

export function clearSession(groupId: string): void {
    sessions.delete(groupId);
}

/**
 * Parse a natural language message for product + budget
 * e.g. "Find me the best deal on Sony WH-1000XM5, budget $300"
 */
export function parseNegotiationRequest(message: string): {
    productName: string;
    budget: number;
    minExpected: number;
} | null {
    // Extract budget: $XXX or XXX dollars/bucks
    const budgetMatch = message.match(/\$([0-9,]+(?:\.[0-9]{1,2})?)|(\d+)\s*(?:dollars|bucks)/i);
    if (!budgetMatch) return null;

    const budgetStr = budgetMatch[1] || budgetMatch[2];
    const budget = parseFloat(budgetStr.replace(/,/g, ""));
    if (isNaN(budget) || budget <= 0) return null;

    // Extract product name — text between trigger word and budget/comma/period
    const triggerPattern = /(?:find me|deal on|negotiate|best price for|get me)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:,|\.|for\s*\$|\s+budget|\s+under|\s+max|$)/i;
    const productMatch = message.match(triggerPattern);
    if (!productMatch) return null;

    const productName = productMatch[1].trim();
    if (!productName) return null;

    // Estimate min expected price as 70% of budget
    const minExpected = Math.round(budget * 0.7);

    return { productName, budget, minExpected };
}

/**
 * Check if a message is a human constraint update
 */
export function isConstraintUpdate(message: string, hasActiveSession: boolean): boolean {
    if (!hasActiveSession) return false;
    const lower = message.toLowerCase();
    return (
        lower.startsWith("no ") ||
        lower.startsWith("only ") ||
        lower.includes("must have") ||
        lower.includes("budget is") ||
        lower.includes("prefer ") ||
        lower.includes("without ") ||
        lower.includes("not refurbished") ||
        lower.includes("with warranty")
    );
}
