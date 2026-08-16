import { STRATEGIC_INITIAL_STATE, type Strategy, type StrategicState } from "./strategic-engine";
import type { TerritoryOwner } from "./types";

export type LevelObjectiveKind = "control" | "eliminate" | "survive";

export type LevelDefinition = {
  id: string;
  number: number;
  title: string;
  difficulty: string;
  briefing: string;
  objectiveKind: LevelObjectiveKind;
  objectiveTarget: number;
  reward: number;
  aiStrategy: Strategy;
  aiIntervalSeconds: number;
  playerFactor: number;
  enemyFactor: number;
  neutralFactor: number;
  parTime: number;
  ownerOverrides?: Record<string, TerritoryOwner>;
};

export type LevelProgress = {
  unlockedThrough: number;
  completedIds: string[];
  bestStars: Record<string, number>;
  selectedLevelId: string;
};

export type LevelOutcome = "playing" | "victory" | "defeat";

export const LEVELS: LevelDefinition[] = [
  { id: "l1", number: 1, title: "أول تحرك", difficulty: "تدريب", briefing: "أمّن ممراً واحداً لتتعلم الإرسال والاستيلاء.", objectiveKind: "control", objectiveTarget: 3, reward: 100, aiStrategy: "defensive", aiIntervalSeconds: 8, playerFactor: 1.18, enemyFactor: 0.58, neutralFactor: 0.75, parTime: 42 },
  { id: "l2", number: 2, title: "ممر الهضبة", difficulty: "سهل", briefing: "حرّر منطقة ثانية قبل أن يبني الخصم خطوطه.", objectiveKind: "control", objectiveTarget: 4, reward: 140, aiStrategy: "balanced", aiIntervalSeconds: 6.5, playerFactor: 1.08, enemyFactor: 0.82, neutralFactor: 0.9, parTime: 58 },
  { id: "l3", number: 3, title: "حصار الدلتا", difficulty: "متوسط", briefing: "استغل المناطق المحايدة قبل أن يحاصر العدو العاصمة.", objectiveKind: "control", objectiveTarget: 5, reward: 190, aiStrategy: "opportunist", aiIntervalSeconds: 5.2, playerFactor: 1, enemyFactor: 1, neutralFactor: 1, parTime: 76, ownerOverrides: { ridge: "enemy" } },
  { id: "l4", number: 4, title: "تطويق الساحل", difficulty: "متوسط", briefing: "اعزل خصمك واقطع إنتاجه من الساحل.", objectiveKind: "eliminate", objectiveTarget: 0, reward: 250, aiStrategy: "aggressive", aiIntervalSeconds: 4.3, playerFactor: 0.98, enemyFactor: 1.14, neutralFactor: 1, parTime: 96, ownerOverrides: { coast: "enemy" } },
  { id: "l5", number: 5, title: "مفترق الحديد", difficulty: "صعب", briefing: "الخصم أسرع الآن؛ حافظ على تدفق قواتك ولا تترك جبهة مكشوفة.", objectiveKind: "control", objectiveTarget: 5, reward: 320, aiStrategy: "aggressive", aiIntervalSeconds: 3.7, playerFactor: 0.94, enemyFactor: 1.32, neutralFactor: 1.08, parTime: 110, ownerOverrides: { ridge: "enemy", coast: "enemy" } },
  { id: "l6", number: 6, title: "الهيمنة", difficulty: "النخبة", briefing: "سيطر على كامل المسرح الاستراتيجي أمام خصم انتهازي سريع.", objectiveKind: "control", objectiveTarget: 6, reward: 450, aiStrategy: "opportunist", aiIntervalSeconds: 3.1, playerFactor: 0.92, enemyFactor: 1.5, neutralFactor: 1.18, parTime: 135, ownerOverrides: { ridge: "enemy", coast: "enemy" } },
];

export const DEFAULT_LEVEL_PROGRESS: LevelProgress = {
  unlockedThrough: 1,
  completedIds: [],
  bestStars: {},
  selectedLevelId: "l1",
};

export function getLevel(levelId: string) {
  return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0];
}

export function isLevelUnlocked(level: LevelDefinition, progress: LevelProgress) {
  return level.number <= progress.unlockedThrough;
}

export function createLevelState(level: LevelDefinition): StrategicState {
  return {
    elapsed: 0,
    aiStrategy: level.aiStrategy,
    aiIntervalSeconds: level.aiIntervalSeconds,
    levelId: level.id,
    groups: [],
    combats: [],
    territories: STRATEGIC_INITIAL_STATE.territories.map((territory) => {
      const owner = level.ownerOverrides?.[territory.id] ?? territory.owner;
      const factor = owner === "player" ? level.playerFactor : owner === "enemy" ? level.enemyFactor : level.neutralFactor;
      const productionRate = owner === "neutral" ? 0 : territory.productionRate * factor;
      return { ...territory, owner, troops: Math.max(8, Math.round(territory.troops * factor)), maxTroops: Math.max(45, Math.round(territory.maxTroops * factor)), productionRate };
    }),
  };
}

export function playerTerritoryCount(state: StrategicState) {
  return state.territories.filter((territory) => territory.owner === "player").length;
}

export function evaluateLevelOutcome(state: StrategicState, level: LevelDefinition): LevelOutcome {
  const playerCount = playerTerritoryCount(state);
  const enemyCount = state.territories.filter((territory) => territory.owner === "enemy").length;
  if (playerCount === 0) return "defeat";
  if (level.objectiveKind === "control" && playerCount >= level.objectiveTarget) return "victory";
  if (level.objectiveKind === "eliminate" && enemyCount === 0) return "victory";
  if (level.objectiveKind === "survive" && state.elapsed >= level.objectiveTarget) return "victory";
  return "playing";
}

export function getObjectiveText(level: LevelDefinition, state?: StrategicState) {
  if (level.objectiveKind === "eliminate") return "اهزم كل مناطق الخصم";
  if (level.objectiveKind === "survive") return `اصمد ${level.objectiveTarget} ثانية`;
  const current = state ? playerTerritoryCount(state) : 0;
  return `سيطر على ${level.objectiveTarget} مناطق (${current}/${level.objectiveTarget})`;
}

export function calculateLevelStars(level: LevelDefinition, state: StrategicState) {
  let stars = 1;
  if (state.elapsed <= level.parTime) stars += 1;
  if (playerTerritoryCount(state) >= Math.min(6, level.objectiveKind === "control" ? level.objectiveTarget + 1 : 4)) stars += 1;
  return Math.min(3, stars);
}

export function advanceProgress(progress: LevelProgress, level: LevelDefinition, stars: number): LevelProgress {
  return {
    unlockedThrough: Math.min(LEVELS.length, Math.max(progress.unlockedThrough, level.number + 1)),
    selectedLevelId: level.id,
    completedIds: progress.completedIds.includes(level.id) ? progress.completedIds : [...progress.completedIds, level.id],
    bestStars: { ...progress.bestStars, [level.id]: Math.max(progress.bestStars[level.id] ?? 0, stars) },
  };
}
