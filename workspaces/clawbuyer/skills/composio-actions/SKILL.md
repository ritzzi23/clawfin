# Skill: composio-actions

## When to Use This Skill

Use this skill **immediately after** the DEAL SUMMARY is posted in the group chat. It fires two post-deal actions in parallel:

1. **Gmail** — sends the deal summary to the user's email
2. **Google Sheets** — appends a row to the user's deal tracker spreadsheet

Both require environment variables: `COMPOSIO_API_KEY`, `USER_EMAIL`, `DEAL_TRACKER_SHEET_ID`.

If `COMPOSIO_API_KEY` is not set, skip both actions silently (no error message to the group).

---

## Action 1: Gmail — Send Deal Summary Email

**API call:**
```
POST https://backend.composio.dev/api/v1/actions/execute/CLAWFIN
Headers:
  x-api-key: {COMPOSIO_API_KEY}
  Content-Type: application/json

Body:
{
  "appName": "gmail",
  "actionName": "GMAIL_SEND_EMAIL",
  "input": {
    "to": "{USER_EMAIL}",
    "subject": "🏆 ClawFin Deal Found: {productName} @ ${effectivePrice}",
    "body": "Your ClawFin agent found you a deal!\n\n{summaryText}\n\nNegotiated by ClawFin — powered by XMTP + OpenClaw"
  }
}
```

**On success:** Post to group: *"📧 Deal summary sent to your email"*
**On failure:** Log error silently. Do not post to group.

---

## Action 2: Google Sheets — Log Deal Row

**API call:**
```
POST https://backend.composio.dev/api/v1/actions/execute/CLAWFIN
Headers:
  x-api-key: {COMPOSIO_API_KEY}
  Content-Type: application/json

Body:
{
  "appName": "googlesheets",
  "actionName": "GOOGLESHEETS_SHEET_APPEND_ROW",
  "input": {
    "spreadsheetId": "{DEAL_TRACKER_SHEET_ID}",
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
}
```

**Spreadsheet column order:**
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Timestamp | Product | Seller | Price | Card Used | Cashback | Effective Price | Savings |

**On success:** Post to group: *"📊 Logged to your deal tracker spreadsheet"*
**On failure:** Log error silently.

---

## Execution

Run both actions in parallel (don't wait for one before starting the other).

After both complete (or fail), post a single combined status to the group:

If both succeeded:
```
📬 Post-deal actions complete:
📧 Deal summary sent to your email
📊 Logged to your deal tracker spreadsheet
```

If neither is configured (no API key):
```
(Composio not configured — set COMPOSIO_API_KEY to enable email + sheet logging)
```

---

## Input Variables

This skill expects to receive these values from the `deal-negotiation` skill:

| Variable | Description |
|----------|-------------|
| `productName` | What was negotiated (e.g., "AirPods Max") |
| `winnerSeller` | Winning seller name (e.g., "DealDasher") |
| `price` | Nominal price agreed (e.g., 380.00) |
| `effectivePrice` | After credit card cashback (e.g., 361.00) |
| `cardUsed` | Best card name (e.g., "Discover It") |
| `cashbackAmount` | Dollar amount of cashback (e.g., 19.00) |
| `savings` | Budget − effectivePrice (e.g., 89.00) |
| `summaryText` | Full text of the DEAL SUMMARY block |
| `timestamp_iso` | Current datetime in ISO 8601 format |
