# Skill: credit-card-calc

## When to Use This Skill

Use this skill when you need to determine which credit card gives the best cashback on a specific purchase, and what the effective (post-cashback) price is.

Called by the `deal-negotiation` skill during final ranking. Can also be used inline if the human asks "which card should I use for this?"

---

## Algorithm

For each offer (seller name + price + product name):

1. Look up the product name and seller against each card's keyword list
2. Find the best matching cashback tier for each card
3. Compute: `cashbackAmount = price × (cashbackPercent / 100)`
4. Compute: `effectivePrice = price - cashbackAmount`
5. Pick the card with the **lowest effective price** (highest cashback for this product)
6. Return: card name, cashback %, cashback amount, effective price, reason

---

## Card Reference Data

See `cards.json` for the full card catalog. Summary:

### Discover It
- **5% cashback** when product keywords match: `headphones, speaker, laptop, tablet, phone, camera, airpods, sony, apple, samsung, monitor, earbuds, tv, television, iphone, ipad, macbook, dell, hp, lenovo`
- **1% cashback** on everything else

### Chase Freedom Flex
- **5% cashback** when seller/retailer keywords match: `amazon, target, walmart, bestbuy, best buy, ebay, costco`
- **1.5% cashback** on everything else

### Amex Blue Cash
- **3% cashback** when keywords match: `online, shop, store, web, .com, purchase`
- **1% cashback** on everything else

---

## Matching Logic

To determine which tier applies:
- Combine the product name + seller name into one lowercase string
- Check each card's keyword list against this combined string
- If ANY keyword matches → use that card's bonus tier
- If NO keyword matches → use the default tier

For the Chase Freedom Flex: the seller names in this negotiation are fictional ("DealDasher", "BundleKing") — they won't match retailer keywords. Default to 1.5% unless the human specifies a specific retailer.

For online purchases (which group chat negotiation implies): Amex Blue Cash 3% often wins as the baseline since all purchases here are "online".

---

## Adjustments for Offer Quality

After computing effectivePrice, apply these adjustments to the **ranking score** (not the displayed effective price):
- **Has warranty:** score × 0.98 (warranty saves ~2% equivalent — counts as a bonus)
- **Is refurbished:** score × 1.03 (refurb risk — penalizes the ranking by 3%)
- **Has bundle items:** note in the output but don't adjust score (bundles are subjective)

The **displayed** effectivePrice is always the raw cashback-adjusted number. Adjustments only affect ranking order.

---

## Output Format

For each offer, return:

```
[SellerName]: $[price]
→ Best card: [Card Display Name] ([cashbackPercent]% back)
→ Cashback: -$[cashbackAmount]
→ Effective price: $[effectivePrice]
→ Reason: [why this card wins, e.g. "5% back on electronics"]
```

Then state the **winner**:
```
Winner by effective price: [SellerName] at $[effectivePrice] using [Card Name]
```

---

## Example

Input: AirPods Max, $380 from DealDasher / $395 from BundleKing (includes case + warranty)

Processing:
- "airpods" matches Discover It's electronics tier → 5% on both
- Discover It on $380: cashback = $19.00, effective = $361.00
- Discover It on $395: cashback = $19.75, effective = $375.25
- BundleKing has warranty → ranking score × 0.98 → $375.25 × 0.98 = $367.75 adjusted score

Rankings:
1. DealDasher: $361.00 effective (wins on pure price)
2. BundleKing: $375.25 effective, but $367.75 adjusted score with warranty

Summary note: "DealDasher wins on price, but BundleKing's warranty adds $30+ in value — worth considering."
