import { describe, expect, test } from "bun:test";
import { MARKET_CATEGORIES, MARKET_LANGUAGES, MARKET_SKILLS, skillsForCategory } from "./market-taxonomy";

describe("marketplace skill taxonomy", () => {
  test("every category has a useful, duplicate-free skill catalogue", () => {
    for (const category of MARKET_CATEGORIES) {
      const skills = MARKET_SKILLS[category.id];
      expect(skills.length).toBeGreaterThanOrEqual(10);
      expect(new Set(skills.map((skill) => skill.toLowerCase())).size).toBe(skills.length);
      expect(skills.every((skill) => skill.trim() === skill && skill.length > 1)).toBe(true);
    }
  });

  test("unknown categories do not expose unrelated suggestions", () => {
    expect(skillsForCategory("unknown")).toEqual([]);
  });

  test("language suggestions are clean and duplicate-free", () => {
    expect(MARKET_LANGUAGES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(MARKET_LANGUAGES.map((language) => language.toLowerCase())).size).toBe(MARKET_LANGUAGES.length);
    expect(MARKET_LANGUAGES.every((language) => language.trim() === language && language.length > 1)).toBe(true);
  });
});
