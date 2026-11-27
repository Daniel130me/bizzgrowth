# Fallback check

## #42 fallback-timeout-checkup-chat — 19554 ms · NONE  · 0 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 14012,
        "error": "This operation was aborted (injected timeout for the AI quality test)"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": false,
        "latencyMs": 3001,
        "error": "This operation was aborted"
      },
      {
        "routeLabel": "OpenRouter",
        "model": "@preset/node71-chat",
        "ok": false,
        "latencyMs": 2015,
        "error": "This operation was aborted"
      },
      {
        "routeLabel": "Google Gemini · gemini#1",
        "model": "gemini-3.5-flash-lite",
        "ok": false,
        "latencyMs": 0,
        "error": "skipped — the time for this request ran out"
      }
    ]
  ],
  "servedBy": [
    null
  ],
  "ms": 19554
}
```

## #44 fallback-timeout-checkup-chat — 17000 ms · z.ai glm-5.3 · 4351 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 10032,
        "error": "This operation was aborted (injected timeout for the AI quality test)"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": true,
        "latencyMs": 5244
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 17000
}
```

## #45 fallback-timeout-ask — 37818 ms · z.ai glm-5.3 · 6551 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 22514,
        "error": "This operation was aborted (injected timeout for the AI quality test)"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": true,
        "latencyMs": 13263
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 37818
}
```

## #46 fallback-http500-checkup-chat — 8295 ms · z.ai glm-5.3 · 4156 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 6,
        "error": "HTTP 500: injected failure for the AI quality test"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": true,
        "latencyMs": 3571
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 8295
}
```

## #47 fallback-http500-ask — 13017 ms · z.ai glm-5.3 · 6371 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 0,
        "error": "skipped — cooling down after earlier failures"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": true,
        "latencyMs": 10715
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 13017
}
```
