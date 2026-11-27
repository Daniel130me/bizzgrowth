# Timings, providers and tokens

Times are the whole route call as the owner waits for it (ms). Fast-profile features must stay well under 20 s, quality ones under 45 s.

| Feature | Calls | AI calls | Profile | Typical | Slowest | Over limit | Calls with failed attempts | Served by | Tokens | Est. USD |
|---|---|---|---|---|---|---|---|---|---|---|
| checkup-chat | 13 | 13 | fast | 2.9 s | 5.5 s | 0 | 0 | OpenAI gpt-5.4-mini | 58548 | 0.0196 |
| checkup-extract | 1 | 1 | fast | 8.4 s | 8.4 s | 0 | 0 | OpenAI gpt-5.4-mini | 3915 | 0.0038 |
| diagnosis | 1 | 1 | quality | 11.8 s | 11.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 7728 | 0.0053 |
| improve | 1 | 1 | quality | 5.4 s | 5.4 s | 0 | 0 | OpenAI gpt-5.4-mini | 2333 | 0.0014 |
| ask | 4 | 4 | quality | 7.0 s | 8.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 25719 | 0.0113 |
| draft | 1 | 1 | fast | 3.0 s | 3.0 s | 0 | 0 | OpenAI gpt-5.4-mini | 1425 | 0.0007 |
| brief | 1 | 1 | quality | 7.8 s | 7.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 4361 | 0.0029 |
| insights | 1 | 1 | quality | 9.6 s | 9.6 s | 0 | 0 | OpenAI gpt-5.4-mini | 6313 | 0.0043 |
| coach-checkin | 1 | 1 | fast | 8.8 s | 8.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 5037 | 0.0023 |
| challenges-chat | 9 | 7 | fast | 2.0 s | 4.9 s | 0 | 0 | OpenAI gpt-5.4-mini | 16680 | 0.0058 |
| challenge-diagnosis | 1 | 1 | quality | 7.8 s | 7.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 7377 | 0.0042 |
| specialist-match | 1 | 1 | quality | 6.4 s | 6.4 s | 0 | 0 | OpenAI gpt-5.4-mini | 1796 | 0.0010 |
| probe-ask | 4 | 4 | quality | 5.8 s | 7.3 s | 0 | 0 | OpenAI gpt-5.4-mini | 25715 | 0.0116 |
| probe-anon | 1 | 0 | - | 0.1 s | 0.1 s | 0 | 0 |  | 0 | 0.0000 |
| probe-double-fault-checkup-chat | 1 | 1 | fast | 3.4 s | 3.4 s | 0 | 1 | OpenRouter @preset/node71-chat | 4378 | 0.0000 |
| fallback-timeout-checkup-chat | 2 | 2 | fast | 18.3 s | 19.6 s | 0 | 2 | NONE, z.ai glm-5.3 | 4351 | 0.0007 |
| probe-all-down-checkup-chat | 1 | 1 | fast | 5.6 s | 5.6 s | 0 | 1 | NONE | 0 | 0.0000 |
| fallback-timeout-ask | 1 | 1 | quality | 37.8 s | 37.8 s | 0 | 1 | z.ai glm-5.3 | 6551 | 0.0017 |
| fallback-http500-checkup-chat | 1 | 1 | fast | 8.3 s | 8.3 s | 0 | 1 | z.ai glm-5.3 | 4156 | 0.0004 |
| fallback-http500-ask | 1 | 1 | quality | 13.0 s | 13.0 s | 0 | 1 | z.ai glm-5.3 | 6371 | 0.0014 |
| recheck-ask | 1 | 1 | quality | 9.5 s | 9.5 s | 0 | 0 | OpenAI gpt-5.4-mini | 6574 | 0.0027 |
| recheck-draft | 1 | 1 | fast | 3.8 s | 3.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 1583 | 0.0008 |
| recheck-checkup-chat | 3 | 3 | fast | 3.7 s | 4.2 s | 0 | 0 | OpenAI gpt-5.4-mini | 13791 | 0.0049 |
| recheck-diagnosis | 1 | 1 | quality | 8.6 s | 8.6 s | 0 | 0 | OpenAI gpt-5.4-mini | 7622 | 0.0049 |
| recheck-coach-checkin | 1 | 1 | fast | 4.8 s | 4.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 4787 | 0.0018 |
| recheck-challenge-diagnosis | 2 | 2 | quality | 6.8 s | 7.1 s | 0 | 0 | OpenAI gpt-5.4-mini | 14862 | 0.0081 |
| recheck-specialist-match | 2 | 2 | quality | 2.7 s | 2.8 s | 0 | 0 | OpenAI gpt-5.4-mini | 3579 | 0.0020 |

**Total:** 245552 tokens, about $0.104 (prices: gpt-5.4-mini $0.25/$2 per M — assumed from OpenAI's gpt-5-mini list price; confirm on the OpenAI pricing page; glm-5.3 $0.07/$1.4 per M — OpenRouter list price quoted in the test plan; z.ai's own price may differ). Free-tier providers count as $0.

Fast features: checkup-chat, checkup-extract, coach-checkin, challenges-chat, draft.
