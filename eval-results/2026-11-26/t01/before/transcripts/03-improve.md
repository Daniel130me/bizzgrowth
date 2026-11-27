# Improve diagnosis

## #13 improve — 5991 ms · OpenAI gpt-5.4-mini · 1856 tokens

```json
{
  "form": [
    {
      "name": "Walk-in mostly, people passing by",
      "enquiries": 150,
      "customers": 150
    },
    {
      "name": "Calls or WhatsApp",
      "enquiries": 45,
      "customers": 30
    },
    {
      "name": "Delivery apps",
      "enquiries": 80,
      "customers": 80
    }
  ],
  "response": {
    "ok": true,
    "improved": {
      "channelRows": [
        {
          "name": "Walk-in mostly, people passing by",
          "enquiries": 150,
          "customers": 150,
          "conversion": 100
        },
        {
          "name": "Calls or WhatsApp",
          "enquiries": 45,
          "customers": 30,
          "conversion": 66.7
        },
        {
          "name": "Delivery apps",
          "enquiries": 80,
          "customers": 80,
          "conversion": 100
        }
      ],
      "bestChannel": "Walk-in mostly, people passing by",
      "worstChannel": "Calls or WhatsApp",
      "headline": "Calls and WhatsApp are the only weak spot; walk-ins and apps are strong",
      "story": "You added real counts for 3 ways people find you. 150 of the 150 people who asked through Walk-in mostly, people passing by went on to pay, while 30 of the 45 who asked through Calls or WhatsApp did. That gap is now the clearest signal in your diagnosis.",
      "meaning": "Your numbers fit what you told me: you reply right away, give the price when asked, and then leave it there if they do not order. That works well when people are already in front of the food or already using an app, but it is weaker when someone is still deciding on a call or WhatsApp. So the business itself is drawing interest, but some of that interest slips away before it turns into paid orders through chat.",
      "whyItMatters": "If you leave it as it is, the easiest money to win back is the one that keeps walking away after a message or call. With rent due in 9 days, that gap matters because you need the quickest cash you can pull from the enquiries you already have.",
      "nextInvestigation": "For the next two weeks, follow up once on every call or WhatsApp enquiry that does not order, within the same day. Keep a simple count of how many people you message again, how many reply, and how many then pay. That will show whether the missing money is being lost because people need one more nudge, or because the price or meal choice is not quite right.",
      "confidence": 88
    },
    "degraded": false
  }
}
```
