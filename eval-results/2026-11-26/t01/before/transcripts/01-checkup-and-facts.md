# Checkup conversation

**Nellovia:** Hi, and welcome! I'm Nellovia, an AI business consultant. I'd love to hear about your business — what do you do, and what would you most like to improve?

**Owner:** My rent of ₦3.6m is due in 9 days and I only have ₦700k. Business is OK, we make about ₦2.5m a month. I just need to get through this.

**Nellovia:** Thanks for being straight with me. I’ve got the cash pressure and the rough monthly money flow; what do you sell most, and who usually pays you for it?
<sub>read: partial · next: monthlyEnquiries · phase: interview · 6416 ms · OpenAI gpt-5.4-mini · 3641 tokens</sub>
<sub>Understood as: Revenue: about ₦2.5m/month | Hardest part: rent cash shortfall</sub>
<sub>Tap answers: [Food orders] [Catering] [Meals and snacks] [Not sure]</sub>

**Owner:** Food. Restaurant and takeaway — jollof, fried rice, stew, swallow. Mostly people around Surulere, workers on lunch break, some families.

**Nellovia:** That helps a lot — food for lunch crowds and families tells me this is probably tied to steady daily sales. What do you think is behind the cash shortfall right now: fewer people coming in, smaller orders, price pressure, or something else you’ve noticed?
<sub>read: answer · next: ownerTheory · phase: interview · 2689 ms · OpenAI gpt-5.4-mini · 3715 tokens</sub>
<sub>Understood as: Sells: food, restaurant and takeaway meals | Customers: workers, families nearby</sub>
<sub>Tap answers: [Fewer people coming in] [Smaller orders] [Price pressure] [Something else]</sub>

**Owner:** Nothing is wrong with the business o. The rent is yearly, that's the thing. Big money at once.

**Nellovia:** That makes sense — it’s a timing squeeze, not a sales problem. Is anything else holding the business back right now? Tap any that apply — I'll keep them on your list, and let's take them one at a time.
<sub>read: answer · next: otherChallenges · phase: interview · 2705 ms · OpenAI gpt-5.4-mini · 3713 tokens</sub>
<sub>Understood as: Your view: yearly rent due | Cash shortfall is timing-driven</sub>
<sub>Tap answers: [Not enough customers] [Slow days or quiet months] [Customers don't come back] [Finding good staff] [Can't keep up with orders] [No, that's the main one]</sub>

**Owner:** No, that's the main one

**Nellovia:** Good, that helps narrow it down. Roughly how many people ask about buying in a normal month — a range is fine, and if you’re not sure, your best guess is enough?
<sub>read: answer · next: closeRate · phase: interview · 3127 ms · OpenAI gpt-5.4-mini · 3844 tokens</sub>
<sub>Tap answers: [1 or 2 out of 10] [3 to 5 out of 10] [6 to 8 out of 10] [Not sure]</sub>

**Owner:** Is food, people don't really ask, they just come and buy. Maybe 20 orders a day.

**Nellovia:** That tells me the footfall is doing the work, not enquiry chats. Roughly 20 orders a day is useful; how do new people usually find you — walk-ins, repeat customers, referrals, WhatsApp, signs, or something else?
<sub>read: partial · next: repeat · phase: interview · 3691 ms · OpenAI gpt-5.4-mini · 3979 tokens</sub>
<sub>Understood as: People asking a month: /about 600</sub>
<sub>Tap answers: [Walk-ins and referrals] [WhatsApp] [Repeat customers] [Not sure]</sub>

**Owner:** Walk-in mostly, people passing. Some call or WhatsApp to order. And the delivery apps.

**Nellovia:** That gives me the main paths in. Out of people who ask by call or WhatsApp, how many go on to buy — roughly, like 2 out of 5, about half, or most of them?
<sub>read: answer · next: closeRate · phase: interview · 3362 ms · OpenAI gpt-5.4-mini · 3846 tokens</sub>
<sub>Understood as: Found via: walk-in, calls/WhatsApp, apps</sub>
<sub>Tap answers: [2 out of 5] [About half] [Not sure]</sub>

**Owner:** Most of them. Maybe 2 out of 3.

**Nellovia:** That gives me a solid picture of the buying side. Roughly how much does one customer usually spend on a normal order there — even a range is fine, like ₦2,000 to ₦5,000?
<sub>read: answer · next: jobValue · phase: interview · 2497 ms · OpenAI gpt-5.4-mini · 3909 tokens</sub>
<sub>Understood as: How many pay: 2 out of 3</sub>
<sub>Tap answers: [₦2,000 to ₦5,000] [About ₦1,000] [About ₦10,000] [Not sure]</sub>

**Owner:** ₦2,000 to ₦5,000

**Nellovia:** That gives me the size of a normal order. How quickly do you usually reply when someone calls or messages, and do you ever check back with people who went quiet?
<sub>read: answer · next: followUp · phase: interview · 3091 ms · OpenAI gpt-5.4-mini · 3914 tokens</sub>
<sub>Understood as: Typical order: ₦2,000 to ₦5,000</sub>
<sub>Tap answers: [Right away] [Later the same day] [Sometimes I check back] [Not really]</sub>

**Owner:** Right away

**Nellovia:** Good, that helps. Do you usually send a second message or call back when someone goes quiet, or do you leave it there?
<sub>read: partial · next: capacity · phase: interview · 3755 ms · OpenAI gpt-5.4-mini · 4014 tokens</sub>
<sub>Understood as: Getting back to people: replies right away</sub>
<sub>Tap answers: [I do follow up] [No, I leave it] [Not sure] [Sometimes]</sub>

**Owner:** No, is food, if they don't order they don't order. Abeg my problem is the rent. Just tell me what to do.

**Nellovia:** Thank you — that's everything I need. Give me a few seconds to work out what's holding the business back, and what fixing it could be worth.
<sub>read: dodge · next: — · phase: done · 3587 ms · OpenAI gpt-5.4-mini · 4126 tokens</sub>
<sub>Understood as: No second chase for quiet people</sub>

## Business facts (extract)

<sub>7208 ms · OpenAI gpt-5.4-mini · 3049 tokens</sub>

```json
{
  "businessType": "ecommerce",
  "whatTheySell": "Restaurant food and takeaway meals",
  "primaryGoal": "Get through the rent payment due in 9 days without the business running short of cash",
  "customers": "Workers on lunch break, families, and people around Surulere",
  "channels": [
    "Walk-in mostly, people passing by",
    "Calls or WhatsApp",
    "Delivery apps"
  ],
  "journey": [
    "Sees the restaurant while passing by",
    "Calls or WhatsApps to order",
    "Chooses food",
    "Pays",
    "Collects or gets delivery"
  ],
  "trends": {
    "enquiries": "About the same",
    "customers": "About the same",
    "revenue": "About the same"
  },
  "bottleneck": "Growth is not the problem; the business is stuck on paying a large yearly rent in one lump sum.",
  "closeRate": "2 out of 3",
  "followUp": "They reply right away and do not follow up if the person does not order.",
  "jobValue": "₦2,000 to ₦5,000",
  "monthlyEnquiries": "About 600 a month",
  "pricePresentation": "They give the price when people ask by call or WhatsApp, or when they choose what to buy in person.",
  "lostReason": "If people do not order, they leave it there.",
  "capacity": "Yes, the owner did not say the business is full and said the main issue is rent timing, not demand.",
  "ownerTheory": "Nothing is wrong with the business; the problem is that the yearly rent is a big money payment all at once.",
  "otherChallenges": [],
  "recentChanges": [
    "Yearly rent is due in one big payment",
    "Cash is short because the rent falls at once"
  ],
  "chips": [
    "Yearly rent squeeze",
    "Walk-in sales",
    "WhatsApp orders",
    "Delivery apps",
    "Most enquiries buy",
    "No follow-up"
  ],
  "facts": [
    {
      "section": "Business",
      "value": "Funmi's Kitchen — a ecommerce business in Nigeria",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "What you sell",
      "value": "Restaurant food and takeaway meals",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "Primary goal",
      "value": "Get through the rent payment due in 9 days without the business running short of cash",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "Customers",
      "value": "Workers on lunch break, families, and people around Surulere",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "Customer journey",
      "value": "Sees the restaurant while passing by, calls or WhatsApps to order, chooses food, pays, then collects or gets delivery",
      "provenance": "ai-interpretation",
      "source": "Interpreted from your checkup conversation"
    },
    {
      "section": "How people find you",
      "value": "Walk-in mostly, people passing by, Calls or WhatsApp, Delivery apps",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "Known performance changes",
      "value": "Business is okay, and monthly sales are about ₦2.5m",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "Where growth feels stuck",
      "value": "The main problem is paying a large yearly rent in one lump sum",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "Enquiries that become customers",
      "value": "Most people who ask go on to buy, about 2 out of 3",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "How enquiries are handled",
      "value": "They reply right away and do not follow up if the person does not order",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "Typical job value",
      "value": "₦2,000 to ₦5,000",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "People asking each month",
      "value": "About 20 orders a day",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    },
    {
      "section": "What you think is causing it",
      "value": "Nothing is wrong with the business; the yearly rent is the issue because it is a big payment at once",
      "provenance": "user-supplied",
      "source": "Your checkup conversation"
    }
  ],
  "confidence": 80
}
```
