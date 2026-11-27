# Diagnosis

## #15 diagnosis — 11795 ms · OpenAI gpt-5.4-mini · 7728 tokens

```json
{
  "ok": true,
  "diagnosis": {
    "version": 2,
    "headline": "The yearly rent comes as one big amount, and the shop’s cash is already tight",
    "insight": "This is not only a rent problem. Your own figures show the shop is already under pressure before rent lands, so another loan would only push the same gap forward.",
    "working": "People still find you by passing by, calling, WhatsApp, and delivery apps.",
    "story": "You told me the rent is the big thing because it arrives all at once, and that the landlord has split payment before. You also said prices have stayed the same while diesel has gone up and the delivery apps take a slice before paying you.",
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
    "meaning": "What is probably happening is that the shop is carrying a monthly squeeze, then the yearly rent sits on top of it. The loan app and the overdue supplier bill show the pressure has already started before the rent date. I cannot see your till or your cash book from here, so this is from your own counts, but it points to a repeating gap, not just one hard month.",
    "whyItMatters": "On your own figures, ₦4.6m is due and you have ₦700k in hand, so about ₦3.9m is still missing. If nothing changes, the rent problem comes back after this bill too, because sales do not cover the running costs you listed.",
    "nextInvestigation": "First, test whether the landlord will take part now and the rest later, since they have done that before. That tells us whether the fastest path is a payment split, not another loan app.",
    "confidence": 69,
    "focusStage": "deliver",
    "steps": [
      "Call the landlord and ask for part now, with the rest later.",
      "Write down what the shop takes in for a normal day this week.",
      "Stop any new loan app plan until the landlord answers."
    ],
    "tools": [
      {
        "kind": "message",
        "title": "Ask for split rent again",
        "body": "Good day [name], I am asking if you can allow me pay part of the rent now and the balance later.\nYou did this for me before, and I am hoping for the same help again.\nPlease let me know if this can work.",
        "when": "Send to the landlord before the rent date"
      },
      {
        "kind": "offer",
        "title": "Priority order options",
        "body": "Small order — for one person or a light lunch\nStandard order — for a family or regular lunch\nPriority order — for urgent pickup or delivery at your chosen time",
        "when": "Use when a customer needs food quickly or for a set time"
      }
    ],
    "stake": null,
    "nextStep": {
      "kind": "recommendation",
      "title": "Ask for part rent and the rest later",
      "why": "You already said the landlord has accepted a split before, so this is the fastest thing to test before the due date.",
      "how": [
        "Call or message the landlord today.",
        "Ask for part now and a clear date for the rest.",
        "Keep the loan app out of the plan until you hear back."
      ],
      "days": 14,
      "measure": "Did the landlord agree to part payment and a later balance?",
      "unit": "count",
      "countHow": "Mark one tick if the landlord agrees, one if they do not, and one if they ask you to try again later.",
      "draft": {
        "kind": "whatsapp",
        "label": "Write the rent message",
        "purpose": "A short WhatsApp message to the landlord asking for part payment now and the rest later."
      },
      "draftIsMain": true
    },
    "checked": true,
    "money": [
      "Due, from what they told you: Rent ₦3.6m (In 9 days); Loan app repayment ₦650k (On day 8); Supplier bill ₦350k (Overdue) — ₦4.6m in total.",
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
