import { describe, expect, it } from "vitest";

import { advanceProgress, createLevelState, DEFAULT_LEVEL_PROGRESS, evaluateLevelOutcome, getLevel, LEVELS } from "../lib/game/levels";

describe("نظام المستويات التدريجي", () => {
  it("يبني المستوى التدريبي بخصم أضعف ولا يغير خريطة العقد", () => {
    const level = getLevel("l1");
    const state = createLevelState(level);
    expect(state.territories).toHaveLength(6);
    expect(state.aiIntervalSeconds).toBe(8);
    expect(state.territories.find((territory) => territory.id === "north")?.troops).toBeLessThan(58);
  });

  it("يفتح المستوى التالي عند تحقيق هدف السيطرة", () => {
    const level = getLevel("l1");
    const state = createLevelState(level);
    const wonState = { ...state, territories: state.territories.map((territory) => territory.id === "ridge" ? { ...territory, owner: "player" as const } : territory) };
    expect(evaluateLevelOutcome(wonState, level)).toBe("victory");
    const progress = advanceProgress(DEFAULT_LEVEL_PROGRESS, level, 2);
    expect(progress.unlockedThrough).toBe(2);
    expect(progress.bestStars.l1).toBe(2);
  });

  it("يعلن الخسارة عند فقدان كل مناطق اللاعب", () => {
    const level = getLevel("l2");
    const state = createLevelState(level);
    const lostState = { ...state, territories: state.territories.map((territory) => territory.owner === "player" ? { ...territory, owner: "enemy" as const } : territory) };
    expect(evaluateLevelOutcome(lostState, level)).toBe("defeat");
  });

  it("يرفع الصعوبة تدريجياً عبر سرعة الخصم وقوته", () => {
    const training = LEVELS[0];
    const elite = LEVELS[LEVELS.length - 1];
    expect(elite.aiIntervalSeconds).toBeLessThan(training.aiIntervalSeconds);
    expect(elite.enemyFactor).toBeGreaterThan(training.enemyFactor);
    expect(elite.playerFactor).toBeLessThan(training.playerFactor);
  });

  it("يقدم ست مهام مكتملة ومتنوعة مع هدف وجائزة وسلوك خصم", () => {
    expect(LEVELS).toHaveLength(6);
    expect(new Set(LEVELS.map((level) => level.aiStrategy)).size).toBeGreaterThan(2);
    for (const level of LEVELS) {
      expect(level.objectiveKind).toBeDefined();
      expect(level.objectiveTarget).toBeGreaterThanOrEqual(0);
      expect(level.reward).toBeGreaterThan(0);
      expect(level.briefing.length).toBeGreaterThan(10);
    }
  });
});
