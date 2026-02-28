# User Profile — ClawBot

This file contains the user's personal preferences and financial profile.
ClawBot uses this to optimize deals for the specific user.

---

## Credit Cards

The user's available credit cards (used by the `credit-card-calc` skill):

| Card | Best Category | Cashback | Notes |
|------|---------------|----------|-------|
| Discover It | Electronics | 5% | Rotating quarterly category |
| Chase Freedom Flex | Amazon, Target, Best Buy, Walmart, eBay | 5% | Select retailers |
| Amex Blue Cash | US online retailers | 3% | Any online purchase |

Default cashback on all cards: 1–1.5%

---

## Preferences

- Preferred condition: **new only** (not refurbished, not open box) unless user explicitly says otherwise
- Warranty: preferred but not required
- Quantity: 1 unit unless user specifies otherwise

---

## Post-Deal Actions

After a deal is finalized:
- Email summary → `USER_EMAIL` (from environment)
- Log to Google Sheets → `DEAL_TRACKER_SHEET_ID` (from environment)

---

## Notes

Update this file if the user adds cards or changes preferences between sessions.
The `credit-card-calc` skill reads `cards.json` for the exact cashback logic — update that file too if card rewards change.
