# ClawFin 🏷️ — Group Deal Negotiation via XMTP Multi-Agent

> **ClawHack NYC 2026** — Built on XMTP + OpenRouter + Composio

A team of **5 AI agents** in a Convos group chat that negotiate product deals in real-time. Each agent has its own personality, tools, and strategy — coordinating through XMTP using `@xmtp/agent-sdk`.

---

## Agents

| Agent | Role | Strategy |
|---|---|---|
| 🤖 **ClawBot** | Buyer Orchestrator | Drives negotiation, plays sellers against each other, ranks deals by effective price (including credit card rewards) |
| ⚡ **DealDasher** | Seller | Aggressive discounter — drops price fast, creates urgency |
| 🎁 **BundleKing** | Seller | Value bundler — adds accessories/warranties instead of dropping price |
| 💎 **PremiumHub** | Seller | Firm pricing — holds near MSRP, emphasizes quality |
| 🔥 **FlashDeals** | Seller | Scarcity seller — "Only 2 left!", creates FOMO, beats everyone on speed |

---

## How It Works

1. Open Convos app → join the **ClawFin Deal Room** group
2. Type: `Find me the best deal on AirPods Max, budget $450`
3. **ClawBot** kicks off the negotiation with all 4 sellers
4. Each seller responds with their opening offer (distinct personality)
5. ClawBot runs 4 rounds, pressing sellers against each other
6. Type mid-negotiation: `No refurbished items` → ClawBot picks it up
7. ClawBot posts a **DEAL SUMMARY** with credit card recommendation
8. **Composio** fires: deal summary sent to Gmail + logged to Google Sheets

---

## Quick Start

```bash
# 1. Install deps
npm install

# 2. Set your OpenRouter API key in .env
# Get from: openrouter.ai

# 3. Generate wallet + DB encryption keys for all 5 agents
npm run gen:keys

# 4. Create the XMTP group (all agents must have keys first)
npm run setup:group
# → Copy the printed CONVOS_GROUP_ID= into your .env

# 5. Start all agents
npm run start:all

# 6. Open Convos, join the group, type a deal request!
```

---

## Sponsors Used

| Sponsor | How |
|---|---|
| **XMTP / Convos** | Group chat layer. All 5 agents communicate via Convos on XMTP. |
| **OpenRouter** | LLM provider. Claude for ClawBot (buyer), Llama 3.1 for sellers. |
| **Composio** | Post-deal: sends Gmail summary + logs to Google Sheets automatically. |
| **Auth0** | Secures Composio OAuth tokens for Gmail/Sheets. |
| **Vapi** | (Stretch) Voice deal summary narrated after negotiation completes. |
| **ElevenLabs** | (Stretch) Powers Vapi's TTS for voice message in group chat. |
| **Zo Computer** | (Stretch) Host agents on Zo ($30 free credits). |

---

## Architecture

```
   CONVOS GROUP CHAT (XMTP)
   ========================
   You + 5 ClawFin Agents (@xmtp/agent-sdk)
              |
              | XMTP protocol
              |
   ========================
   Each agent: Agent.create(signer, opts)
               agent.on("text", ctx => ...)
               ctx.conversation.send(...)
   ========================
              |
       OpenRouter LLM
       Composio Actions
       Credit Card Engine
       Negotiation State
```

---

## Project Structure

```
clawfin/
├── agents/
│   ├── buyer-agent.ts      # 🤖 ClawBot — orchestrates negotiation
│   ├── seller-base.ts      # Shared seller agent base class
│   └── start-sellers.ts    # Launches all 4 sellers concurrently
├── lib/
│   ├── openrouter.ts       # LLM client (OpenAI-compatible)
│   ├── credit-card.ts      # Credit card rewards engine
│   ├── deal-explainer.ts   # Offer ranking + deal summary formatter
│   ├── negotiation-state.ts# In-memory session state per group ID
│   ├── composio.ts         # Post-deal Gmail + Sheets actions
│   └── prompts/
│       ├── buyer-prompt.ts # ClawBot system prompt builder
│       └── seller-prompts.ts # Seller prompts (4 strategies + styles)
├── config/
│   └── agents.ts           # Agent identities, LLM models, negotiation params
└── scripts/
    ├── gen-keys.ts         # Generate wallet + DB encryption keys
    ├── create-group.ts     # Create XMTP group, print CONVOS_GROUP_ID
    └── test-openrouter.ts  # Quick LLM sanity check
```

---

## Demo Script

1. Show `agents/` folder — "5 AI agents, each `Agent.create()` with its own wallet"
2. Open Convos — "This is our Deal Room. ClawBot, DealDasher, BundleKing, PremiumHub, and FlashDeals are all in here."
3. Type: `Find me the best deal on AirPods Max, budget $450`
4. Watch agents negotiate with distinct personalities
5. Interject: `Must include warranty`
6. ClawBot adapts → posts DEAL SUMMARY with credit card recommendation
7. Show Gmail — Composio sent the deal summary
8. Show Google Sheets — deal logged automatically

**Key line for judges:** "5 isolated XMTP agents, each with their own identity, soul, and strategy — all coordinating in a single Convos group chat over @xmtp/agent-sdk."
