# Diagnosis

## #14 diagnosis — 10311 ms · OpenAI gpt-5.4-mini · 7416 tokens

```json
{
  "ok": true,
  "diagnosis": {
    "version": 2,
    "headline": "Yearly rent is tying up your kitchen cash in one big hit",
    "insight": "This is not just a rent problem; it is a timing problem that turns steady daily sales into one heavy bill. You already have proof the landlord can bend, because he once accepted part first and the rest later.",
    "working": "People still buy your jollof, fried rice, stew and swallow every day.",
    "story": "You told me your business is OK, and you also said the rent is yearly and comes in one big payment. You also said the landlord once took half first and the rest later, which tells me there is room to ask again before the due date.",
    "deltas": [
      {
        "label": "Marketing spend",
        "delta": null,
        "direction": "unknown",
        "goodness": "neutral",
        "caption": "Not mentioned in your checkup"
      },
      {
        "label": "Enquiries",
        "delta": null,
        "direction": "unknown",
        "goodness": "neutral",
        "caption": "You did not report this yet"
      },
      {
        "label": "Customers",
        "delta": null,
        "direction": "unknown",
        "goodness": "neutral",
        "caption": "You did not report this yet"
      },
      {
        "label": "Revenue",
        "delta": null,
        "direction": "unknown",
        "goodness": "neutral",
        "caption": "You did not report this yet"
      }
    ],
    "meaning": "What is happening is that the restaurant can keep serving, but the cash is being pulled out in a lump that the day-to-day takings cannot carry comfortably. On your own figures, the money coming in is about ₦1.4m–₦1.8m a month while running costs are about ₦1.8m a month, so your business is already running tight before rent even lands. I cannot see the cash in the till from here, so any fix has to come from what you count yourself: what is due, what is in hand, and what the landlord will accept.",
    "whyItMatters": "You have ₦700k in hand against ₦4.6m due, so the gap is already about ₦3.9m before anything else is paid. Your food bill alone is taking about 60%–77% of the money coming in, so if the rent stays one lump payment, every quiet week will keep squeezing the kitchen.",
    "nextInvestigation": "First, test whether the landlord will split the rent again before the due date. That comes first because it can ease the biggest squeeze without changing your menu, your staff, or your app sales.",
    "confidence": 69,
    "focusStage": "deliver",
    "steps": [
      "Call the landlord today and ask for part now, rest on an agreed date.",
      "Write down every due payment and mark which one must move first.",
      "Tell suppliers you are settling the overdue balance in a clear plan."
    ],
    "tools": [
      {
        "kind": "message",
        "title": "Ask for rent split again",
        "body": "Good day [name], I want to talk about the rent due soon.\nMy kitchen is steady, but the full payment is heavy at once.\nCan I pay part now and finish on [date]?\nI will keep to the plan and follow up as agreed.",
        "when": "Send today before you call or visit the landlord"
      },
      {
        "kind": "script",
        "title": "What to say to the landlord",
        "body": "Good day, [name]. I want to settle the rent, but the full amount at once is too heavy for the business.\nThe restaurant is trading, so I am asking for the same kind of help you gave before.\nPlease let me pay part now and agree the rest on [date].",
        "when": "Use this on a call or face to face today"
      },
      {
        "kind": "offer",
        "title": "Rent plan options",
        "body": "Option one: part now, rest on [date]\nOption two: part now, part next month, rest after that\nOption three: full amount on [date] if I can raise it",
        "when": "Use when the landlord asks what you can do"
      }
    ],
    "stake": null,
    "nextStep": {
      "kind": "recommendation",
      "title": "Ask for part now and a date for the rest",
      "why": "You already said the landlord once accepted half first and the rest later, so this is the clearest test to try first.",
      "how": [
        "Write the rent due date, what you can pay now, and the date you want for the rest.",
        "Call or visit the landlord with a calm request for part now and a fixed follow-up date.",
        "If they agree, write the promise down immediately and keep to it."
      ],
      "days": 9,
      "measure": "Whether the landlord agrees to take part now and gives a date for the rest",
      "unit": "count",
      "countHow": "Keep a notebook list with one line for each landlord reply: yes, maybe, or no",
      "draft": {
        "kind": "whatsapp",
        "label": "Write the rent split request",
        "purpose": "A short WhatsApp message to the landlord asking for part now and the rest later."
      },
      "draftIsMain": true
    },
    "checked": true,
    "money": [
      "Due, from what they told you: Rent ₦3.6m (In 9 days); Loan app repayment ₦650k (On day 8); Supplier ₦350k (Overdue) — ₦4.6m in total.",
      "Cash they have now: ₦700k.",
      "So they are about ₦3.9m short of what is due (₦4.6m due minus ₦700k in hand).",
      "Money coming in, from their figures: about ₦1.4m–₦1.8m a month (₦55k–₦70k a day × 26 days).",
      "Running costs they listed: about ₦1.8m a month (Food and ingredients ₦1.1m + Staff ₦480k + Generator diesel and gas ₦260k).",
      "So on their own figures the business loses about ₦20k–₦410k a month before the payments above — sales don't cover the running costs.",
      "Their biggest cost, food and ingredients, is about 60%–77% of the money coming in.",
      "They also said about ₦2.5m a month — more than their own figures add up to (about ₦1.4m–₦1.8m). Worth asking which months that was."
    ]
  },
  "plan": null,
  "degraded": false
}
```
