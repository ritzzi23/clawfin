# Legacy Reference Code

> **This folder is not part of the production system.**

These are v1 TypeScript agents from the initial prototype, where each negotiation role was a standalone XMTP listener running custom logic.

The production ClawFin system uses **OpenClaw workspaces** instead — see [`workspaces/`](../workspaces/) for the live agent definitions (SOUL.md, AGENTS.md, skills/).

| File | Role |
|------|------|
| `buyer-agent.ts` | Buyer orchestrator (replaced by `workspaces/clawbuyer/`) |
| `seller-base.ts` | Shared seller base class (replaced by `workspaces/dealdash/` + `workspaces/bundleking/`) |
| `start-sellers.ts` | Seller startup script (replaced by OpenClaw gateway) |
