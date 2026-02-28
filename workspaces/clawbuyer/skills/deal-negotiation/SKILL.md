# Skill: deal-negotiation

## When to Use This Skill

Use this skill whenever a human in the group chat asks for a deal, mentions a product + budget, or uses one of the trigger phrases below.

**Trigger phrases:**
- "find me", "deal on", "negotiate", "best price", "get me", "buy me", "cheapest", "looking for a deal"

**Example triggers:**
- "Find me the best deal on AirPods Max, budget $450"
- "Negotiate Sony WH-1000XM5 under $300"
- "Get me the cheapest DJI Mini 4 Pro, max $750"
- "Best price on a Herman Miller chair, budget $900"

---

## Step 1: Parse the Request

Extract from the human's message:
1. **Product name** — everything between the trigger phrase and the budget mention
2. **Budget** — the number after "$" or before "dollars"/"bucks"/"max"/"under"/"budget"
3. **Minimum expected price** — estimate as `budget × 0.70` (what you realistically expect to pay)
4. **Constraints** — any qualifiers like "new only", "with warranty", "not refurbished"

If you cannot parse a clear product name + budget, ask the human: *"What product and budget are you working with?"*

---

## Step 2: Open the Negotiation

Post an opening message to the group that:
- Confirms you heard the request
- States the product and budget (but NOT the max budget to the sellers — just say "competitive budget")
- Names both sellers
- Creates anticipation

Template:
```
🔍 On it! I'm reaching out to both @DealDasher and @BundleKing to find you the best deal on [product].

Sellers — I need your best price on [product]. We're ready to move quickly for the right offer.
```

---

## Step 3: Negotiation Rounds (4 rounds max)

Run up to 4 rounds. Each round:

**ClawBot's message should:**
1. Acknowledge the current best offer received so far (or open with pressure if round 1)
2. Use ONE of these pressure tactics (rotate through them):
   - Quote a competing offer: *"@BundleKing offered $X. @DealDasher, can you beat that?"*
   - Apply budget pressure: *"We're still above my range. I need to see $[lower number]."*
   - Create competition: *"I'm comparing two offers right now. Whoever moves first wins the sale."*
   - Use a deadline: *"I need to decide in the next round. Final offers please."*
3. Keep it to 2–3 sentences

**Pricing guide for what to push toward:**
- Round 1 ask: `minExpected + (budget - minExpected) × 10%` → your opening counter
- Round 2 ask: `minExpected + (budget - minExpected) × 20%`
- Round 3 ask: `minExpected + (budget - minExpected) × 30%` → your target
- Round 4: "Final offers. Best price wins."

**NEVER reveal the actual max budget number to sellers.**

---

## Step 4: Track Offers

After each round, mentally note:
- The latest price from @DealDasher (the $ amount in their message)
- The latest price from @BundleKing (the $ amount + bundle items mentioned)
- Any constraints the human has added mid-negotiation

When a human adds a constraint (e.g., "no refurbished"), acknowledge it immediately:
*"✅ Got it — [constraint]. Filtering accordingly."*

Then enforce the constraint: if a seller's offer violates it, note that and ask them to re-offer with the constraint applied.

---

## Step 5: Final Summary

After round 4 (or when both sellers have hit their floor price), post the DEAL SUMMARY.

To build the summary:
1. Call the `credit-card-calc` skill to get effective prices for each offer
2. Rank offers by effective price (lower = better), with these adjustments:
   - Warranty included: effective price × 0.98 (2% bonus for warranty value)
   - Refurbished: effective price × 1.03 (3% penalty for refurb risk)
3. Apply any human constraints to filter out non-qualifying offers

Post the summary using exactly this format:
```
🏆 DEAL SUMMARY — [Product Name]
────────────────────────────────────────

🥇 @[SellerName]: $[price][+bundle if any]
   💳 Use [Card Name] ([X]% back) → $[effectivePrice] effective
   ℹ️  [Why this wins — best price, or best value]

🥈 @[SellerName]: $[price]
   💳 Use [Card Name] ([X]% back) → $[effectivePrice] effective
   ℹ️  $[diff] more than winner after rewards

────────────────────────────────────────
✅ GO WITH: @[SellerName] at $[price]
💳 PAY WITH: [Card Name]
💰 EFFECTIVE PRICE: $[effectivePrice]
🎉 YOU SAVE: $[savings] vs your $[budget] budget
```

---

## Step 6: Post-Deal Actions

After the DEAL SUMMARY is posted, invoke the `composio-actions` skill to:
- Send the deal summary to the user's email
- Log the deal to Google Sheets

Pass these values to `composio-actions`:
- productName, winnerSeller, price, effectivePrice, cardUsed, cashbackAmount, savings, summaryText

---

## Edge Cases

**No budget stated:** Ask the human: *"What's your budget for [product]?"* then wait.

**Only one seller responds:** Use the single offer as the winner; note in the summary that only one seller responded.

**Both sellers at floor:** *"Both sellers are at their floor. Here's the best we could get:"* then post summary.

**Constraint eliminates all offers:** Tell the human: *"Neither seller can meet that constraint. Want me to proceed without it, or try a different product?"*

**Human says "deal" or "I'll take it" mid-negotiation:** Post an abbreviated summary and trigger composio-actions immediately.
