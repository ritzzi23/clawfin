# Legacy Reference Code

> **This folder is not part of the production system.**

Shared utilities from the v1 prototype. The production system runs inside OpenClaw workspaces where negotiation logic, credit card math, and Composio actions are defined as SKILL.md files.

| File | Description |
|------|-------------|
| `openrouter.ts` | OpenRouter API client (still used by setup scripts) |
| `composio.ts` | Post-deal actions: Gmail, Sheets, Slack via `@composio/core` |
| `credit-card.ts` | Credit card cashback engine (logic ported to `workspaces/clawbuyer/skills/credit-card-calc/`) |
| `negotiation-state.ts` | Negotiation state machine (logic ported to `workspaces/clawbuyer/skills/deal-negotiation/`) |
| `deal-explainer.ts` | Deal summary formatter |
| `prompts/` | v1 system prompts (superseded by SOUL.md files in each workspace) |
