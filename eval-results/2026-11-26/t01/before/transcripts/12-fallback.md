# Fallback check

## #38 fallback-http500-checkup-chat — 3746 ms · z.ai glm-5.3 · 3386 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 5,
        "error": "HTTP 500: injected failure for the AI quality test"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": true,
        "latencyMs": 3164
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 3746
}
```

## #39 fallback-http500-ask — 9935 ms · z.ai glm-5.3 · 4964 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 1,
        "error": "HTTP 500: injected failure for the AI quality test"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": true,
        "latencyMs": 9141
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 9935
}
```

## #40 fallback-timeout-checkup-chat — 3526 ms · z.ai glm-5.3 · 3482 tokens

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
        "latencyMs": 3266
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 3526
}
```

## #41 fallback-timeout-ask — 10739 ms · z.ai glm-5.3 · 4924 tokens

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
        "latencyMs": 9588
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 10739
}
```

## #42 fallback-timeout-checkup-chat — 26114 ms · z.ai glm-5.3 · 3374 tokens

```json
{
  "attempts": [
    [
      {
        "routeLabel": "OpenAI",
        "model": "gpt-5.4-mini",
        "ok": false,
        "latencyMs": 20017,
        "error": "This operation was aborted (injected timeout for the AI quality test)"
      },
      {
        "routeLabel": "z.ai",
        "model": "glm-5.3",
        "ok": true,
        "latencyMs": 3355
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 26114
}
```

## #43 fallback-timeout-ask — 12703 ms · z.ai glm-5.3 · 5177 tokens

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
        "latencyMs": 11140
      }
    ]
  ],
  "servedBy": [
    "z.ai"
  ],
  "ms": 12703
}
```
