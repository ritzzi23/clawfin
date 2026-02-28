# DealForge Group -- ClawHack NYC Hackathon Plan

## Concept (One-Liner)

**"Drop a product link in a group chat. AI agents negotiate the best deal for you -- live, in the thread, while your friends watch and help."**

A Convos group chat where a Buyer Agent, multiple Seller Agents, a Voice Agent, and a Research Agent all coordinate in real-time to find you the best deal -- with credit card optimization, voice narration, and secure third-party app integrations.

---

## Sponsor Tools Integration Map (7 of 7 sponsors used)

| Sponsor | How You Use It | Why It Matters |
|---------|---------------|----------------|
| **XMTP / Convos** (required) | Communication layer -- all agents and humans talk in an XMTP group chat via Convos | Core hackathon requirement |
| **OpenClaw** (required) | Execution layer -- your Buyer Agent and orchestrator run as OpenClaw agents | Core hackathon requirement |
| **OpenRouter** ($10 credits) | LLM backbone -- powers all agent reasoning via Claude/GPT/Llama through one API | Replaces your LM Studio (no local hardware needed) |
| **Composio** ($25K prize eligible) | Connects agents to real-world apps: Gmail (send deal summary), Google Sheets (log deals), Slack (notify team) | Secure OAuth, no raw API keys exposed |
| **Vapi** (voice AI) | Voice Agent in the group chat -- narrates negotiation progress, reads final deal summary aloud | Adds "wow factor" to demo |
| **ElevenLabs** (voice platform) | Powers Vapi's text-to-speech with natural, expressive voice for the narrator agent | Premium voice quality |
| **Auth0** (authentication) | Secures agent-to-API access -- Token Vault manages credentials for third-party integrations | Enterprise-grade auth layer |
| **CopilotKit** (bonus) | If time permits: React dashboard showing live negotiation state alongside the Convos chat | Optional visual layer |

---

## Architecture

```
                        CONVOS GROUP CHAT (XMTP)
                    ================================
                    |  Human: "Find me AirPods Max   |
                    |          budget $450"           |
                    |                                 |
                    |  @BuyerBot: "On it! Searching   |
                    |   3 sellers..."                 |
                    |                                 |
                    |  @SellerBot1 (Discounter):      |
                    |   "I can do $389 today only"    |
                    |                                 |
                    |  @SellerBot2 (Bundler):         |
                    |   "$420 with AppleCare + case"  |
                    |                                 |
                    |  @SellerBot3 (Firm):            |
                    |   "$449, firm. Premium quality"  |
                    |                                 |
                    |  Human2: "No refurbished pls"   |
                    |                                 |
                    |  @BuyerBot: "Got it, updating   |
                    |   constraints..."               |
                    |                                 |
                    |  @VoiceBot: [audio] "Seller 1   |
                    |   just dropped to $375!"        |
                    |                                 |
                    |  @BuyerBot: DEAL SUMMARY        |
                    |   Winner: Seller1 @ $375        |
                    |   Use Discover card (5% back)   |
                    |   Effective price: $356.25      |
                    ================================

    BACKEND SERVICES
    ================

    OpenClaw Agent (Orchestrator)
        |
        |-- OpenRouter API (LLM reasoning for all agents)
        |       Models: claude-sonnet-4-5, gpt-4o, llama-3
        |
        |-- Composio (third-party integrations)
        |       Gmail: send deal summary email
        |       Google Sheets: log negotiation history
        |       Slack: notify team of completed deal
        |
        |-- Vapi + ElevenLabs (voice narration)
        |       Real-time voice updates in chat
        |
        |-- Auth0 (Token Vault)
        |       Manages OAuth for all integrations
        |
        |-- Your DealForge Logic (from existing repo)
                buyer_agent.py -- negotiation strategy
                seller_agent.py -- 3 seller strategies
                credit_card_service.py -- rewards engine
                deal_explainer.py -- ranking + explanation
```

---

## What to Reuse from Your Existing Repo

| Existing Code | Reuse As |
|--------------|----------|
| `backend/app/agents/buyer_agent.py` | Core buyer negotiation logic -- wrap in XMTP message handler |
| `backend/app/agents/seller_agent.py` | Seller strategies -- each becomes a separate XMTP agent identity |
| `backend/app/agents/prompts.py` | Agent prompt templates -- adapt for group chat context |
| `backend/app/services/credit_card_service.py` | Credit card rewards engine -- call at deal summary time |
| `backend/app/services/deal_explainer.py` | Deal ranking + explanation -- post results to group chat |
| `backend/app/agents/graph_builder.py` | Negotiation flow orchestration -- adapt from SSE to XMTP messages |

---

## New Code to Write

### 1. XMTP Agent Setup (TypeScript)

Each agent gets its own XMTP identity and joins the same group chat:

```typescript
// buyer-agent.ts
import { Agent } from "@xmtp/agent-sdk";
import { createUser, createSigner } from "@xmtp/agent-sdk/user";
import OpenRouter from "@openrouter/sdk";

const openrouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const user = createUser();
const signer = createSigner(user);
const agent = await Agent.create(signer, { env: "dev" });

agent.on("text", async (ctx) => {
  const message = ctx.message.content;
  
  // Skip own messages and other agent messages
  if (ctx.message.senderInboxId === agent.client.inboxId) return;
  
  // Detect negotiation triggers
  if (message.toLowerCase().includes("find me") || message.toLowerCase().includes("deal on")) {
    await ctx.sendText("I'm on it! Searching sellers now...");
    // Call your DealForge buyer logic via OpenRouter
    const response = await openrouter.chat.completions.create({
      model: "anthropic/claude-sonnet-4-5",
      messages: [{ role: "system", content: BUYER_AGENT_PROMPT }, { role: "user", content: message }]
    });
    await ctx.sendText(response.choices[0].message.content);
  }
  
  // Detect human constraint updates
  if (message.toLowerCase().includes("no ") || message.toLowerCase().includes("only ")) {
    await ctx.sendText(`Constraint noted: "${message}". Updating negotiation parameters...`);
  }
});

await agent.start();
```

### 2. Composio Integration (for real-world actions)

```typescript
import { Composio } from "@composio/core";

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

// After deal is finalized, trigger real actions:
async function postDealActions(dealSummary: string, userEmail: string) {
  // Send deal summary via Gmail
  await composio.executeAction("GMAIL_SEND_EMAIL", {
    to: userEmail,
    subject: "Your DealForge Negotiation Result",
    body: dealSummary
  });
  
  // Log to Google Sheets
  await composio.executeAction("GOOGLESHEETS_APPEND_ROW", {
    spreadsheetId: "YOUR_SHEET_ID",
    values: [new Date().toISOString(), product, winningPrice, cardUsed, savings]
  });
}
```

### 3. Vapi Voice Agent (narrates in the chat)

```typescript
// voice-narrator.ts
import Vapi from "@vapi-ai/sdk";

const vapi = new Vapi({ apiKey: process.env.VAPI_API_KEY });

// Create a voice assistant that narrates negotiation updates
async function narrateDeal(update: string) {
  const audio = await vapi.calls.create({
    assistant: {
      model: { provider: "openrouter", model: "anthropic/claude-sonnet-4-5" },
      voice: { provider: "11labs", voiceId: "your-elevenlabs-voice-id" },
      firstMessage: update
    }
  });
  // Post audio link to XMTP group chat
  return audio;
}
```

---

## Sprint Schedule

| Time | Task | Sponsor Tools |
|------|------|---------------|
| **9:00-10:00** | Check in, network, get promo codes (OpenRouter $10, Zo $30, Vapi credits) | -- |
| **10:00-10:45** | Attend kickoff + Convo sponsor spotlight. Ask questions about XMTP agent setup | XMTP/Convos |
| **10:45-11:30** | Get ONE agent saying "hello" in a Convos group chat. Clone `xmtp-agent-examples`, run `yarn gen:keys`, test on xmtp.chat | XMTP, OpenClaw |
| **11:30-12:30** | Wire OpenRouter as LLM provider. Port buyer agent prompts from your repo. Agent should now respond intelligently to "Find me a deal on X" | OpenRouter |
| **12:30-1:00** | Lunch. Set up Composio account + API key | Composio |
| **1:00-2:30** | Add 2-3 seller agent identities (Discounter, Bundler, Firm). Each joins the group and negotiates with distinct strategies | XMTP, OpenRouter |
| **2:30-3:30** | Composio integration: Gmail send deal summary + Google Sheets logging after negotiation completes | Composio, Auth0 |
| **3:30-4:30** | Human-in-the-loop: agent listens for constraint messages from humans and adjusts mid-negotiation | XMTP |
| **4:30-5:15** | Vapi + ElevenLabs voice narration: agent posts voice updates to the chat | Vapi, ElevenLabs |
| **5:15-5:45** | Credit card engine integration: final summary includes card recommendation + savings | Your existing code |
| **5:45-6:00** | Test full demo flow, record screen capture, submit | All |

---

## Demo Script (for the 7 PM presentation)

1. **Open Convos app** -- show the group chat with 5 participants: You, a Friend, BuyerBot, SellerBot1, SellerBot2

2. **Type:** "Hey @BuyerBot, find me the best deal on Sony WH-1000XM5, budget $300"

3. **BuyerBot responds:** "On it! I found 2 sellers. Starting negotiations..."

4. **SellerBot1 (Discounter):** "I can offer $269, today only"

5. **SellerBot2 (Bundler):** "$289 with a carrying case and 2-year warranty"

6. **Friend types:** "Get the one with the warranty, worth it"

7. **BuyerBot:** "Noted! Prioritizing warranty offers. Countering Seller2..."

8. **Voice narration plays** in the chat (Vapi/ElevenLabs)

9. **BuyerBot posts final summary:**
   - Winner: Seller2 @ $279 with warranty + case
   - Use: Chase Freedom (5% back on electronics)
   - Effective price: $265.05
   - Savings: $34.95 vs retail

10. **Composio triggers:** "Deal summary sent to your Gmail. Logged to your deal tracker spreadsheet."

---

## Judging Alignment

| Criterion | Score Target | Why |
|-----------|-------------|-----|
| Working Prototype | 4-5 | Most logic already exists in your repo. You're rewiring I/O. |
| Clarity of Concept | 5 | "AI agents negotiate for you in a group chat" -- instant understanding |
| Theme: Group Agents | 5 | Multiple agents + humans in one thread. The group setting IS the product. |
| Human + Agent Collab | 5 | Humans set constraints, interject mid-negotiation, agents adapt in real-time |
| Creativity | 4-5 | Group negotiation is novel. Voice narration + credit card optimization + Composio actions add depth |

---

## Quick Setup Commands

```bash
# 1. Clone XMTP agent starter
git clone https://github.com/xmtplabs/xmtp-agent-examples.git
cd xmtp-agent-examples
yarn install
yarn gen:keys

# 2. Install sponsor SDKs
npm install @openrouter/sdk @composio/core @vapi-ai/sdk

# 3. Set environment variables
export OPENROUTER_API_KEY="your-key"       # Get from openrouter.ai
export COMPOSIO_API_KEY="your-key"         # Get from platform.composio.dev
export VAPI_API_KEY="your-key"             # Get from dashboard.vapi.ai
export ELEVENLABS_API_KEY="your-key"       # Get from elevenlabs.io
export XMTP_ENV="dev"

# 4. Redeem credits
# OpenRouter: openrouter.ai/redeem (use city promo code)
# Vapi: dashboard.vapi.ai (code: Openclaw022026)
# Zo: zo.computer?promo=CLAWDBOT
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| XMTP setup takes too long | Use Convos Native Assistant for 1-2 seller agents (zero code, just write a prompt) |
| OpenRouter rate limits | Fall back to a cheaper model (llama-3) for seller agents, keep Claude for buyer |
| Composio auth flow complex | Start with just Gmail send. Skip Sheets if time is tight |
| Voice integration fails | Drop Vapi/ElevenLabs -- it's a "nice to have", not core |
| Not enough time for 3 sellers | Ship with 2 sellers. Two is enough for the demo |

---

## Composio Prize Strategy ($25K)

To maximize your shot at the Composio prize:
- Use at least 2-3 Composio integrations (Gmail + Sheets + Slack)
- Make Composio central to the "post-deal actions" workflow
- Mention Composio prominently in your demo
- Show the Composio dashboard with audit logs during presentation
