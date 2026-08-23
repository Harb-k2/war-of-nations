export const FIRST_LEVEL_TUTORIAL_STORAGE_KEY = "war-of-nations.first-level-tutorial.v1";

export type FirstLevelTutorialStep = "intro" | "select-source" | "select-target" | "complete";

export const FIRST_LEVEL_TUTORIAL_STEP_COUNT = 3;

export function shouldShowFirstLevelTutorial(levelId: string, completed: boolean) {
  return levelId === "l1" && !completed;
}

export function getTutorialProgress(step: FirstLevelTutorialStep) {
  if (step === "intro") return 0;
  if (step === "select-source") return 1;
  if (step === "select-target") return 2;
  return 3;
}
