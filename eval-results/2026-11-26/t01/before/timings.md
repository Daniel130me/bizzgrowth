# Timings, providers and tokens

Times are the whole route call as the owner waits for it (ms). Fast-profile features must stay well under 20 s, quality ones under 45 s.

| Feature | Calls | AI calls | Profile | Typical | Slowest | Over limit | Calls with failed attempts | Served by | Tokens | Est. USD |
|---|---|---|---|---|---|---|---|---|---|---|
| checkup-chat | 10 | 10 | fast | 3.2 s | 6.4 s | 0 | 0 | OpenAI gpt-5.4-mini | 38701 | 0.0143 |
| checkup-extract | 1 | 1 | fast | 7.2 s | 7.2 s | 0 | 0 | OpenAI gpt-5.4-mini | 3049 | 0.0031 |
| diagnosis | 1 | 1 | quality | 12.6 s | 12.6 s | 0 | 0 | OpenAI gpt-5.4-mini | 5787 | 0.0038 |
| improve | 1 | 1 | quality | 6.0 s | 6.0 s | 0 | 0 | OpenAI gpt-5.4-mini | 1856 | 0.0012 |
| ask | 4 | 4 | quality | 6.1 s | 7.5 s | 0 | 0 | OpenAI gpt-5.4-mini | 19739 | 0.0086 |
| draft | 2 | 2 | fast | 3.8 s | 3.9 s | 0 | 0 | OpenAI gpt-5.4-mini | 2358 | 0.0011 |
| brief | 1 | 1 | quality | 6.6 s | 6.6 s | 0 | 0 | OpenAI gpt-5.4-mini | 3175 | 0.0023 |
| insights | 1 | 1 | quality | 12.2 s | 12.2 s | 0 | 0 | OpenAI gpt-5.4-mini | 5311 | 0.0043 |
| coach-checkin | 1 | 1 | fast | 9.2 s | 9.2 s | 0 | 0 | OpenAI gpt-5.4-mini | 3966 | 0.0016 |
| challenges-chat | 9 | 7 | fast | 2.8 s | 5.0 s | 0 | 0 | OpenAI gpt-5.4-mini | 14859 | 0.0057 |
| challenge-diagnosis | 1 | 1 | quality | 7.9 s | 7.9 s | 0 | 0 | OpenAI gpt-5.4-mini | 6084 | 0.0039 |
| specialist-match | 1 | 1 | quality | 6.4 s | 6.4 s | 0 | 0 | OpenAI gpt-5.4-mini | 1810 | 0.0010 |
| plain-ai-diagnosis | 1 | 1 | plain | 7.9 s | 7.9 s | 0 | 0 | OpenAI gpt-5.4-mini | 1959 | 0.0035 |
| plain-ai-ask | 3 | 3 | plain | 2.9 s | 3.2 s | 0 | 0 | OpenAI gpt-5.4-mini | 8486 | 0.0048 |
| fallback-http500-checkup-chat | 1 | 1 | fast | 3.7 s | 3.7 s | 0 | 1 | z.ai glm-5.3 | 3386 | 0.0003 |
| fallback-http500-ask | 1 | 1 | quality | 9.9 s | 9.9 s | 0 | 1 | z.ai glm-5.3 | 4964 | 0.0012 |
| fallback-timeout-checkup-chat | 2 | 2 | fast | 14.8 s | 26.1 s | 1 | 2 | z.ai glm-5.3 | 6856 | 0.0008 |
| fallback-timeout-ask | 2 | 2 | quality | 11.7 s | 12.7 s | 0 | 2 | z.ai glm-5.3 | 10101 | 0.0027 |

**Total:** 142447 tokens, about $0.064 (prices: gpt-5.4-mini $0.25/$2 per M — assumed from OpenAI's gpt-5-mini list price; confirm on the OpenAI pricing page; glm-5.3 $0.07/$1.4 per M — OpenRouter list price quoted in the test plan; z.ai's own price may differ). Free-tier providers count as $0.

Fast features: checkup-chat, checkup-extract, coach-checkin, challenges-chat, draft.
