# Skill: composio-actions

## When to Use This Skill

Use this skill **immediately after** the DEAL SUMMARY is posted in the group chat.

Fires three post-deal actions in parallel via the Composio SDK (`@composio/core`):
1. **Gmail** — sends the full deal summary to the user's email
2. **Google Sheets** — appends a row to the user's deal tracker spreadsheet
3. **Slack** — posts a deal notification to the user's Slack channel

Requires `COMPOSIO_API_KEY` in environment. If not set, skip all actions silently.

Before running for the first time: `npm run composio:connect` (one-time OAuth setup for Gmail, Sheets, Slack).

---

## SDK Usage

The Composio SDK executes all actions via:
```
composio.tools.execute(actionSlug, { arguments: {...}, userId: ENTITY_ID })
```

`ENTITY_ID` defaults to `"default"` (controlled by `COMPOSIO_ENTITY_ID` env var).

---

## Action 1: Gmail

**Action slug:** `GMAIL_SEND_EMAIL`

**Arguments:**
```json
{
  "recipient_email": "{USER_EMAIL}",
  "subject": "🏆 ClawFin Deal Found: {productName} @ ${effectivePrice}",
  "body": "Your ClawFin agent found you a deal!\n\n{summaryText}\n\n---\nNegotiated by ClawFin — powered by XMTP + OpenClaw"
}
```

**On success:** Announce to group: `"📧 Deal summary sent to your email"`
**On failure:** Log error silently. Do not post to group.
**If USER_EMAIL not set:** Skip silently.

---

## Action 2: Google Sheets

**Action slug:** `GOOGLESHEETS_SHEET_APPEND_ROW`

**Arguments:**
```json
{
  "spreadsheet_id": "{DEAL_TRACKER_SHEET_ID}",
  "sheet_id": "Sheet1",
  "values": [
    "{timestamp_iso}",
    "{productName}",
    "{winnerSeller}",
    "{price}",
    "{cardUsed}",
    "{cashbackAmount}",
    "{effectivePrice}",
    "{savings}"
  ]
}
```

**Spreadsheet columns:** Timestamp | Product | Seller | Price | Card | Cashback | Effective Price | Saved

**On success:** Announce: `"📊 Logged to your deal tracker"`
**If DEAL_TRACKER_SHEET_ID not set:** Skip silently.

---

## Action 3: Slack

**Action slug:** `SLACK_SEND_MESSAGE`

**Arguments:**
```json
{
  "channel": "{SLACK_CHANNEL_ID}",
  "text": "🏷️ *ClawFin Deal Closed*\n*Product:* {productName}\n*Winner:* @{winnerSeller}\n*Price:* ${price} → ${effectivePrice} effective ({cardUsed})\n*Saved:* ${savings}"
}
```

**On success:** Announce: `"💬 Posted to Slack"`
**If SLACK_CHANNEL_ID not set:** Skip silently.

---

## Combined Group Chat Response

After all three actions complete, post a single message:

If any succeeded:
```
📬 Post-deal actions complete:
📧 Deal summary sent to your email
📊 Logged to your deal tracker
💬 Posted to Slack
```

If none configured:
```
(Composio not configured — set COMPOSIO_API_KEY to enable post-deal actions)
```

---

## Input Variables

Received from the `deal-negotiation` skill:

| Variable | Description |
|----------|-------------|
| `productName` | Negotiated product (e.g., "AirPods Max") |
| `winnerSeller` | Winning seller name (e.g., "DealDasher") |
| `price` | Agreed price (e.g., 380.00) |
| `effectivePrice` | After credit card cashback (e.g., 361.00) |
| `cardUsed` | Best card name (e.g., "Discover It") |
| `cashbackAmount` | Dollar amount of cashback (e.g., 19.00) |
| `savings` | Budget − effectivePrice (e.g., 89.00) |
| `summaryText` | Full DEAL SUMMARY text block |
| `timestamp_iso` | Current datetime in ISO 8601 |

---

## Pre-Demo Checklist

Before demoing, run once:
```bash
npm run composio:connect
# Opens OAuth URLs for Gmail, Sheets, Slack
# Authenticate in browser, then connections are saved in Composio
```

Verify connections at: platform.composio.dev → Connected Accounts
