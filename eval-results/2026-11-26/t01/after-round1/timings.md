# Timings, providers and tokens

Times are the whole route call as the owner waits for it (ms). Fast-profile features must stay well under 20 s, quality ones under 45 s.

| Feature | Calls | AI calls | Profile | Typical | Slowest | Over limit | Calls with failed attempts | Served by | Tokens | Est. USD |
|---|---|---|---|---|---|---|---|---|---|---|
| checkup-chat | 12 | 12 | fast | 2.8 s | 3.6 s | 0 | 0 | OpenAI gpt-5.4-mini | 53275 | 0.0181 |
| checkup-extract | 1 | 1 | fast | 6.5 s | 6.5 s | 0 | 0 | OpenAI gpt-5.4-mini | 3650 | 0.0034 |
| diagnosis | 1 | 1 | quality | 10.3 s | 10.3 s | 0 | 0 | OpenAI gpt-5.4-mini | 7416 | 0.0050 |

**Total:** 64341 tokens, about $0.027 (prices: gpt-5.4-mini $0.25/$2 per M — assumed from OpenAI's gpt-5-mini list price; confirm on the OpenAI pricing page; glm-5.3 $0.07/$1.4 per M — OpenRouter list price quoted in the test plan; z.ai's own price may differ). Free-tier providers count as $0.

Fast features: checkup-chat, checkup-extract, coach-checkin, challenges-chat, draft.
