# ClawFin 🏷️

**"Drop a product in a group chat. Three OpenClaw agents negotiate the best deal — live, in the thread."**

Built at **ClawHack NYC 2026** | Theme: Group Agents

---

## What It Does

A Convos group chat with 3 OpenClaw agents coordinating in real time:

| Agent | Role | Strategy |
|-------|------|----------|
| 🤖 **ClawBot** | Buyer orchestrator | Negotiates aggressively, plays sellers against each other, ranks offers by effective price after card rewards |
| ⚡ **DealDasher** | Seller #1 | Aggressive discounter — drops fast, creates urgency |
| 🎁 **BundleKing** | Seller #2 | Value bundler — adds accessories + warranty each round instead of dropping price |

### Demo Flow

1. Human types: `"Find me the best deal on AirPods Max, budget $450"`
2. ClawBot opens negotiations with both sellers simultaneously
3. Sellers respond with distinct personalities and strategies in the group thread
4. Human can interject mid-negotiation: `"No refurbished"` — ClawBot adapts immediately
5. After 3–4 rounds, ClawBot posts a ranked DEAL SUMMARY with credit card optimization
6. Composio fires: deal summary emailed to inbox + logged to Google Sheets

---

## Architecture

```
    CONVOS GROUP CHAT (XMTP)
    ─────────────────────────
    You + 3 OpenClaw Agents
              │
              │ XMTP
              ▼
    ┌─────────────────────┐
    │  OPENCLAW GATEWAY   │
    │                     │
    │  clawbuyer ─────────┼── workspace-clawbuyer/
    │  dealdash  ─────────┼── workspace-dealdash/
    │  bundleking ────────┼── workspace-bundleking/
    │                     │
    │  LLM: OpenRouter    │
    │  Post-deal: Composio│
    └─────────────────────┘
```

Each agent has its own isolated workspace with a `SOUL.md` personality, `AGENTS.md` rules, and custom skills. OpenClaw handles routing, isolation, and execution — no custom agent runtime code.

---

## Tech Stack

| Layer | Tool |
|-------|------|
| **Group Chat** | XMTP + Convos |
| **Execution** | OpenClaw gateway (multi-agent, workspace-isolated) |
| **LLM** | OpenRouter — Claude 3.5 Haiku (buyer), Llama 3.1 8B free (sellers) |
| **Post-deal** | Composio (Gmail + Google Sheets) |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

### 2. Generate wallet keys

```bash
npx ts-node scripts/gen-keys.ts
# Copy the output into .env
```

### 3. Configure environment

```bash
cp .env.example .env
# Required: OPENROUTER_API_KEY, wallet keys, CONVOS_GROUP_ID
# Optional: COMPOSIO_API_KEY, USER_EMAIL, DEAL_TRACKER_SHEET_ID
```

### 4. Create the Convos group

```bash
npm run setup:group
# Copy the Group ID into .env as CONVOS_GROUP_ID
```

### 5. Deploy OpenClaw workspaces

```bash
bash scripts/setup-openclaw.sh
# Deploys all 3 agent workspaces to ~/.openclaw/
# Substitutes env vars into openclaw.json
# Validates the config
```

### 6. Start the gateway

```bash
openclaw gateway --verbose
```

### 7. Open Convos and negotiate

In the ClawFin Deal Room group, type:
```
Find me the best deal on AirPods Max, budget $450
```

Then interject mid-negotiation:
```
Only with warranty
```

---

## Project Structure

```
clawfin/
├── openclaw.json                    # Gateway config — 3 agents, OpenRouter, XMTP bindings
├── workspaces/
│   ├── clawbuyer/                   # ClawBot (buyer)
│   │   ├── SOUL.md                  # Personality + negotiation strategy
│   │   ├── AGENTS.md                # Operational rules + triggers
│   │   ├── USER.md                  # User's credit cards + preferences
│   │   └── skills/
│   │       ├── deal-negotiation/    # Full 4-round negotiation orchestration
│   │       ├── credit-card-calc/    # Cashback engine (3 cards + cards.json)
│   │       └── composio-actions/    # Gmail + Sheets post-deal
│   ├── dealdash/                    # DealDasher (aggressive discounter)
│   │   ├── SOUL.md
│   │   ├── AGENTS.md
│   │   └── skills/seller-strategy/ # Pricing by round + urgency tactics
│   └── bundleking/                  # BundleKing (value bundler)
│       ├── SOUL.md
│       ├── AGENTS.md
│       └── skills/seller-strategy/ # Bundle progression by round
├── scripts/
│   ├── setup-openclaw.sh            # Deploy workspaces → ~/.openclaw/
│   ├── gen-keys.ts                  # Generate agent wallet keys
│   ├── create-group.ts              # One-time Convos group setup
│   └── test-openrouter.ts           # OpenRouter smoke test
├── agents/                          # v1 TypeScript agents (reference / fallback)
├── lib/                             # v1 TypeScript libs (credit-card, composio, etc.)
├── config/                          # Agent config constants
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Judging Criteria Alignment

| Criterion | How ClawFin Delivers |
|-----------|----------------------|
| **Working Prototype** | 3 live OpenClaw agents, full negotiation loop, Composio post-deal |
| **OpenClaw as execution layer** | `openclaw gateway` IS the runtime — no custom agent scaffolding |
| **Agents in group chats** | All 3 agents bound to the same Convos group via `openclaw.json` bindings |
| **Multiple agents coordinating** | ClawBot orchestrates sellers; sellers compete blind (workspace isolation) |
| **Clear agent boundaries** | Each agent has its own workspace, SOUL.md, and skills — no shared state |
| **Human + Agent Collab** | Humans add constraints mid-negotiation; ClawBot adapts in real time |

---

## Credits

- **XMTP / Convos** — group messaging layer
- **OpenClaw** — multi-agent execution runtime
- **OpenRouter** — unified LLM API
- **Composio** — post-deal Gmail/Sheets integrations
- Core negotiation logic ported from [DealForge](https://github.com/ritzzi23/negotiation_ai)

MIT License
