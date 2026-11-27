import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("@/lib/auth/session", () => ({ getSession: async () => null }));

const { aiRateLimited } = await import("./ai-route-guard");

describe("AI routes: per-account limit", () => {
  test("allows normal use and stops a runaway script", () => {
    const map = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 40; i++) expect(aiRateLimited("user-1:ask", 40, 60_000, now + i, map)).toBe(false);
    expect(aiRateLimited("user-1:ask", 40, 60_000, now + 41, map)).toBe(true);
  });
  test("each account and feature has its own limit", () => {
    const map = new Map();
    for (let i = 0; i < 41; i++) aiRateLimited("user-1:ask", 40, 60_000, 0, map);
    expect(aiRateLimited("user-2:ask", 40, 60_000, 0, map)).toBe(false);
    expect(aiRateLimited("user-1:draft", 40, 60_000, 0, map)).toBe(false);
  });
  test("the limit resets after the window", () => {
    const map = new Map();
    for (let i = 0; i < 41; i++) aiRateLimited("user-1:ask", 40, 60_000, 0, map);
    expect(aiRateLimited("user-1:ask", 40, 60_000, 60_001, map)).toBe(false);
  });
});

describe("AI routes: signed out", () => {
  test("a call without a session gets 401", async () => {
    const { requireAiSession } = await import("./ai-route-guard");
    const guard = await requireAiSession("ask");
    expect(guard.response?.status).toBe(401);
  });
});
