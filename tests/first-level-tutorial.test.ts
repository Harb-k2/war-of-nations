import { describe, expect, it } from "vitest";

import { FIRST_LEVEL_TUTORIAL_STEP_COUNT, getTutorialProgress, shouldShowFirstLevelTutorial } from "../lib/game/first-level-tutorial";

describe("تدريب المستوى الأول", () => {
  it("يظهر للاعب الجديد في المستوى الأول فقط", () => {
    expect(shouldShowFirstLevelTutorial("l1", false)).toBe(true);
    expect(shouldShowFirstLevelTutorial("l1", true)).toBe(false);
    expect(shouldShowFirstLevelTutorial("l2", false)).toBe(false);
  });

  it("يتتبع خطوات التدريب الثلاث بترتيب واضح", () => {
    expect(FIRST_LEVEL_TUTORIAL_STEP_COUNT).toBe(3);
    expect(getTutorialProgress("intro")).toBe(0);
    expect(getTutorialProgress("select-source")).toBe(1);
    expect(getTutorialProgress("select-target")).toBe(2);
    expect(getTutorialProgress("complete")).toBe(3);
  });
});
