# Diagnosis

## #12 diagnosis — 12604 ms · OpenAI gpt-5.4-mini · 5787 tokens

```json
{
  "ok": true,
  "diagnosis": {
    "version": 2,
    "headline": "The rent is the real squeeze, not the food business",
    "insight": "Your food business is still moving, and that matters. The part that is trapping you is not demand, but the yearly rent landing as one big bill while your cash comes in day by day.",
    "working": "People already buy from you without much pushing, so your business has steady demand.",
    "story": "You said the kitchen is okay, the food sells, and people around Surulere keep coming in. You also said the rent is the main issue because it is yearly and comes as one big payment, while your money comes in little by little.",
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
        "direction": "flat",
        "goodness": "neutral",
        "caption": "Direction you described"
      },
      {
        "label": "Customers",
        "delta": null,
        "direction": "flat",
        "goodness": "neutral",
        "caption": "Direction you described"
      },
      {
        "label": "Revenue",
        "delta": null,
        "direction": "flat",
        "goodness": "neutral",
        "caption": "Direction you described"
      }
    ],
    "meaning": "This looks like a timing problem, not a sales problem. Your business can make money and still feel stuck if a large rent bill arrives before enough cash has been set aside for it. I cannot see your cash balance or rent agreement inside the app, so the practical test is something you count yourself: how much of the rent can be covered through a direct talk, a split plan, or early cash from trusted customers.",
    "whyItMatters": "If nothing changes, the rent deadline will keep forcing good sales money to disappear before it can help your business breathe. That can leave you scrambling even in a busy month.",
    "nextInvestigation": "Start with the landlord conversation, because this is the fastest way to find out whether the rent can be broken into parts before you look anywhere else. If the landlord agrees to a payment plan, you get immediate breathing space without changing the food business.",
    "confidence": 69,
    "focusStage": "deliver",
    "steps": [
      "Call the landlord and ask for a split rent arrangement",
      "List the customers who can pay ahead for meals or bulk orders",
      "Set aside every cash sale for the rent pot until the deadline"
    ],
    "tools": [
      {
        "kind": "message",
        "title": "Ask for advance lunch orders",
        "body": "Hello [name], hope you are well. We are taking advance lunch orders for the coming days. If you want, you can place your order early and pay now so your meal is set aside for you.",
        "when": "Send to regular workers and office customers today"
      },
      {
        "kind": "script",
        "title": "Say it plainly to the landlord",
        "body": "Good day, sir/ma. My business is still running well, but the rent is falling at a difficult time. I want to ask if I can pay part now and clear the rest in agreed parts. I am not avoiding the rent; I am asking for a short breathing space so I can settle it properly.",
        "when": "Use this when you call or visit about the rent"
      },
      {
        "kind": "offer",
        "title": "Simple prepay meal option",
        "body": "Lunch card\nPay now, eat later\nChoose your meals in advance\nPick up from the shop or ask for delivery\nAvailable for regular customers and office teams",
        "when": "Offer it to trusted regulars and nearby offices"
      }
    ],
    "stake": null,
    "nextStep": {
      "kind": "recommendation",
      "title": "Ask for a rent split today",
      "why": "This comes first because your own words show your business is still selling, and the pressure is the lump-sum rent, not weak demand.",
      "how": [
        "Go to the landlord or call directly and ask for a split payment plan.",
        "Explain that your business is healthy but the rent timing is the problem.",
        "If the landlord agrees, write down the new dates and pay what you promised."
      ],
      "days": 14,
      "measure": "How many rent talks end with a payment plan you can actually follow",
      "unit": "count",
      "countHow": "Keep a simple notebook page with one line for each landlord talk and the result",
      "draft": {
        "kind": "call-script",
        "label": "Ask for rent split",
        "purpose": "A short script for speaking to the landlord about splitting the yearly rent into parts"
      },
      "draftIsMain": true
    },
    "checked": true
  },
  "plan": null,
  "degraded": false
}
```
