import type { TerritoryOwner } from "@/lib/game/types";

export type Strategy = "aggressive" | "defensive" | "balanced" | "opportunist";

export type StrategicTerritory = {
  id: string;
  name: string;
  owner: TerritoryOwner;
  troops: number;
  maxTroops: number;
  productionRate: number;
  defenseBonus: number;
  value: number;
  position: { x: number; y: number };
  neighbours: string[];
};

export type TroopGroup = {
  id: string;
  source: string;
  destination: string;
  owner: TerritoryOwner;
  count: number;
  speed: number;
  progress: number;
  state: "moving" | "arrived" | "engaged";
};

export type StrategicCombat = {
  id: string;
  attacker: TerritoryOwner;
  defender: TerritoryOwner;
  territoryId: string;
  attackerPower: number;
  defenderPower: number;
  startedAt: number;
  status: "active" | "attacker-won" | "defender-held";
};

export type StrategicState = {
  territories: StrategicTerritory[];
  groups: TroopGroup[];
  combats: StrategicCombat[];
  elapsed: number;
  aiStrategy: Strategy;
  aiIntervalSeconds?: number;
  levelId?: string;
};

export const STRATEGIC_INITIAL_STATE: StrategicState = {
  elapsed: 0,
  aiStrategy: "balanced",
  groups: [],
  combats: [],
  territories: [
    { id: "north", name: "الشمال", owner: "enemy", troops: 58, maxTroops: 130, productionRate: 1.6, defenseBonus: 0.12, value: 1.3, position: { x: 50, y: 13 }, neighbours: ["capital", "ridge"] },
    { id: "capital", name: "العاصمة", owner: "player", troops: 92, maxTroops: 180, productionRate: 2.7, defenseBonus: 0.15, value: 2.5, position: { x: 48, y: 37 }, neighbours: ["north", "ridge", "oasis", "delta"] },
    { id: "ridge", name: "الهضبة", owner: "neutral", troops: 28, maxTroops: 80, productionRate: 0, defenseBonus: 0.1, value: 1.1, position: { x: 19, y: 39 }, neighbours: ["north", "capital", "oasis"] },
    { id: "oasis", name: "الواحة", owner: "player", troops: 52, maxTroops: 100, productionRate: 1.8, defenseBonus: 0.08, value: 1.4, position: { x: 20, y: 68 }, neighbours: ["ridge", "capital", "delta", "coast"] },
    { id: "delta", name: "دلتا الحديد", owner: "enemy", troops: 76, maxTroops: 150, productionRate: 2.2, defenseBonus: 0.13, value: 2, position: { x: 78, y: 57 }, neighbours: ["capital", "oasis", "coast"] },
    { id: "coast", name: "الساحل", owner: "neutral", troops: 35, maxTroops: 90, productionRate: 0, defenseBonus: 0.05, value: 1.2, position: { x: 72, y: 83 }, neighbours: ["oasis", "delta"] },
  ],
};

export function strategicPower(territory: StrategicTerritory, attacking = false) {
  return territory.troops * (attacking ? 1 : 1 + territory.defenseBonus);
}

export function isConnected(source: StrategicTerritory, target: StrategicTerritory) {
  return source.neighbours.includes(target.id);
}

export function tickProduction(state: StrategicState, deltaSeconds: number): StrategicState {
  if (deltaSeconds <= 0) return state;
  const territories = state.territories.map((territory) => {
    if (territory.owner === "neutral") return territory;
    return { ...territory, troops: Math.min(territory.maxTroops, territory.troops + territory.productionRate * deltaSeconds) };
  });
  return { ...state, elapsed: state.elapsed + deltaSeconds, territories };
}

export function createTroopGroup(state: StrategicState, sourceId: string, targetId: string, fraction = 0.5): StrategicState {
  const source = state.territories.find((territory) => territory.id === sourceId);
  const target = state.territories.find((territory) => territory.id === targetId);
  if (!source || !target || source.owner !== "player" || !isConnected(source, target)) return state;
  const count = Math.floor(source.troops * Math.min(0.85, Math.max(0.1, fraction)));
  if (count < 1) return state;
  const group: TroopGroup = {
    id: `group-${state.elapsed}-${sourceId}-${targetId}`,
    source: sourceId,
    destination: targetId,
    owner: source.owner,
    count,
    speed: 0.28,
    progress: 0,
    state: "moving",
  };
  return {
    ...state,
    territories: state.territories.map((territory) => territory.id === sourceId ? { ...territory, troops: territory.troops - count } : territory),
    groups: [...state.groups, group],
  };
}

function resolveArrival(state: StrategicState, group: TroopGroup): StrategicState {
  const target = state.territories.find((territory) => territory.id === group.destination);
  if (!target) return state;
  if (target.owner === group.owner) {
    return { ...state, territories: state.territories.map((territory) => territory.id === target.id ? { ...territory, troops: Math.min(territory.maxTroops, territory.troops + group.count) } : territory) };
  }
  const attackerPower = group.count;
  const defenderPower = strategicPower(target);
  const combat: StrategicCombat = {
    id: `combat-${group.id}`,
    attacker: group.owner,
    defender: target.owner,
    territoryId: target.id,
    attackerPower,
    defenderPower,
    startedAt: state.elapsed,
    status: "active",
  };
  return { ...state, combats: [...state.combats, combat] };
}

export function createAiTroopGroup(state: StrategicState, sourceId: string, targetId: string): StrategicState {
  const source = state.territories.find((territory) => territory.id === sourceId);
  const target = state.territories.find((territory) => territory.id === targetId);
  if (!source || !target || source.owner !== "enemy" || !isConnected(source, target)) return state;
  const count = Math.floor(source.troops * 0.4);
  if (count < 1) return state;
  return {
    ...state,
    territories: state.territories.map((territory) => territory.id === sourceId ? { ...territory, troops: territory.troops - count } : territory),
    groups: [...state.groups, { id: `ai-${state.elapsed}-${sourceId}-${targetId}`, source: sourceId, destination: targetId, owner: "enemy", count, speed: 0.23, progress: 0, state: "moving" }],
  };
}

export function tickMovement(state: StrategicState, deltaSeconds: number) {
  if (deltaSeconds <= 0 || state.groups.length === 0) return state;
  const arrived: TroopGroup[] = [];
  const groups = state.groups.map((group) => {
    const progress = group.progress + deltaSeconds * group.speed;
    if (progress >= 1) {
      arrived.push({ ...group, progress: 1, state: "arrived" });
      return null;
    }
    return { ...group, progress };
  }).filter(Boolean) as TroopGroup[];
  let next = { ...state, groups };
  for (const group of arrived) next = resolveArrival(next, group);
  return next;
}

export function tickCombats(state: StrategicState, deltaSeconds: number): StrategicState {
  if (deltaSeconds <= 0 || state.combats.length === 0) return state;
  const completed: StrategicCombat[] = [];
  const active = state.combats.map((combat) => {
    const attackerDamage = combat.attackerPower * 0.08 * deltaSeconds;
    const defenderDamage = combat.defenderPower * 0.075 * deltaSeconds;
    const next = { ...combat, attackerPower: Math.max(0, combat.attackerPower - defenderDamage), defenderPower: Math.max(0, combat.defenderPower - attackerDamage) };
    if (next.attackerPower <= 0 || next.defenderPower <= 0) {
      completed.push({ ...next, status: next.defenderPower <= 0 ? "attacker-won" : "defender-held" });
      return null;
    }
    return next;
  }).filter(Boolean) as StrategicCombat[];
  let next = { ...state, combats: active };
  for (const combat of completed) {
    const territory = next.territories.find((candidate) => candidate.id === combat.territoryId);
    if (!territory) continue;
    const captured = combat.status === "attacker-won";
    next = {
      ...next,
      territories: next.territories.map((candidate) => candidate.id === territory.id ? { ...candidate, owner: captured ? combat.attacker : candidate.owner, troops: captured ? Math.max(1, Math.round(combat.attackerPower)) : Math.max(1, Math.round(combat.defenderPower)) } : candidate),
    };
  }
  return next;
}

export function scoreAiTarget(source: StrategicTerritory, target: StrategicTerritory, strategy: Strategy) {
  const weakness = Math.max(0, 100 - target.troops) / 100;
  const risk = target.troops / Math.max(1, source.troops);
  const profile = strategy === "aggressive" ? 1.3 : strategy === "defensive" ? 0.7 : strategy === "opportunist" ? 1.1 : 1;
  return weakness * 2 + target.value * profile - risk;
}

export function aiChooseMove(state: StrategicState): { sourceId: string; targetId: string } | null {
  const sources = state.territories.filter((territory) => territory.owner === "enemy" && territory.troops > 12);
  let best: { score: number; sourceId: string; targetId: string } | null = null;
  for (const source of sources) {
    for (const targetId of source.neighbours) {
      const target = state.territories.find((territory) => territory.id === targetId);
      if (!target || target.owner === "enemy") continue;
      const score = scoreAiTarget(source, target, state.aiStrategy);
      if (!best || score > best.score) best = { score, sourceId: source.id, targetId: target.id };
    }
  }
  return best ? { sourceId: best.sourceId, targetId: best.targetId } : null;
}

export function tickStrategicGame(state: StrategicState, deltaSeconds: number): StrategicState {
  let next = tickProduction(state, deltaSeconds);
  next = tickMovement(next, deltaSeconds);
  next = tickCombats(next, deltaSeconds);
  const aiInterval = state.aiIntervalSeconds ?? 4;
  const previousAiWindow = Math.floor(state.elapsed / aiInterval);
  const currentAiWindow = Math.floor(next.elapsed / aiInterval);
  if (currentAiWindow > previousAiWindow) {
    const move = aiChooseMove(next);
    if (move) next = createAiTroopGroup(next, move.sourceId, move.targetId);
  }
  return next;
}
