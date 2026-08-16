import type { Army, GameState, Territory, Tactic, UnitDefinition, UnitType } from "./types";

export const UNIT_DEFINITIONS: UnitDefinition[] = [
  {
    type: "infantry",
    name: "المشاة",
    symbol: "✦",
    power: 1,
    goldCost: 30,
    fuelCost: 0,
    description: "قوة مرنة لحماية المناطق ورفع الكتلة القتالية.",
  },
  {
    type: "tanks",
    name: "الدبابات",
    symbol: "▰",
    power: 12,
    goldCost: 120,
    fuelCost: 24,
    description: "قوة اقتحام فعالة ضد الدفاعات الأرضية.",
  },
  {
    type: "armored",
    name: "مدرعات",
    symbol: "◇",
    power: 8,
    goldCost: 80,
    fuelCost: 14,
    description: "وحدة دعم سريعة تعزز الهجوم وحماية الصفوف.",
  },
  {
    type: "air",
    name: "طيران",
    symbol: "△",
    power: 18,
    goldCost: 200,
    fuelCost: 48,
    description: "ضربات دقيقة بقدرة عالية على إنهاء المعارك.",
  },
];

export const INITIAL_STATE: GameState = {
  resources: { gold: 760, fuel: 340, supplies: 500 },
  army: { infantry: 70, tanks: 6, armored: 8, air: 2 },
  turn: 1,
  view: "command",
  selectedTerritoryId: null,
  battle: null,
  lastReport: null,
  territories: [
    {
      id: "capital",
      name: "العاصمة",
      shortName: "عص",
      owner: "player",
      defense: 20,
      goldIncome: 90,
      fuelIncome: 20,
      adjacent: ["oasis", "ridge", "delta"],
      terrain: "قيادة مركزية",
    },
    {
      id: "oasis",
      name: "الواحة",
      shortName: "وه",
      owner: "player",
      defense: 26,
      goldIncome: 45,
      fuelIncome: 45,
      adjacent: ["capital", "ridge", "highlands"],
      terrain: "حقل وقود",
    },
    {
      id: "ridge",
      name: "الهضبة",
      shortName: "هـ",
      owner: "neutral",
      defense: 58,
      goldIncome: 70,
      fuelIncome: 10,
      adjacent: ["capital", "oasis", "delta", "highlands"],
      terrain: "مرتفعات دفاعية",
    },
    {
      id: "delta",
      name: "دلتا الحديد",
      shortName: "دل",
      owner: "enemy",
      defense: 84,
      goldIncome: 110,
      fuelIncome: 20,
      adjacent: ["capital", "ridge", "coast"],
      terrain: "مركز صناعي",
    },
    {
      id: "highlands",
      name: "المرتفعات",
      shortName: "مر",
      owner: "neutral",
      defense: 70,
      goldIncome: 35,
      fuelIncome: 35,
      adjacent: ["oasis", "ridge", "coast"],
      terrain: "ممر جبلي",
    },
    {
      id: "coast",
      name: "الساحل الشرقي",
      shortName: "سح",
      owner: "enemy",
      defense: 98,
      goldIncome: 135,
      fuelIncome: 55,
      adjacent: ["delta", "highlands"],
      terrain: "مرفأ محصن",
    },
  ],
};

export function calculateArmyPower(army: Army) {
  return army.infantry + army.tanks * 12 + army.armored * 8 + army.air * 18;
}

export function controlledTerritories(territories: Territory[]) {
  return territories.filter((territory) => territory.owner === "player");
}

export function canAttack(territory: Territory, territories: Territory[]) {
  if (territory.owner === "player") return false;
  return territory.adjacent.some(
    (id) => territories.find((candidate) => candidate.id === id)?.owner === "player",
  );
}

export function recruitUnit(state: GameState, type: UnitType): GameState {
  const unit = UNIT_DEFINITIONS.find((definition) => definition.type === type);
  if (!unit) return state;
  if (state.resources.gold < unit.goldCost || state.resources.fuel < unit.fuelCost) {
    return { ...state, lastReport: "الموارد غير كافية لبناء هذه الوحدة." };
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold - unit.goldCost,
      fuel: state.resources.fuel - unit.fuelCost,
    },
    army: { ...state.army, [type]: state.army[type] + 1 },
    lastReport: `تمت إضافة وحدة ${unit.name} إلى الجيش.`,
  };
}

export function startBattle(state: GameState, territoryId: string): GameState {
  const territory = state.territories.find((item) => item.id === territoryId);
  if (!territory || !canAttack(territory, state.territories)) {
    return { ...state, lastReport: "لا يمكن الهجوم على هذه المنطقة قبل السيطرة على منطقة مجاورة." };
  }

  const playerHealth = Math.max(95, Math.min(180, Math.round(calculateArmyPower(state.army) * 0.72)));
  return {
    ...state,
    view: "battle",
    selectedTerritoryId: territoryId,
    battle: {
      territoryId,
      playerHealth,
      enemyHealth: territory.defense,
      round: 1,
      log: [`بدأت عملية تحرير ${territory.name}.`],
      status: "active",
    },
  };
}

function tacticModifiers(tactic: Tactic) {
  if (tactic === "armor") return { player: 1.34, enemy: 1.05, label: "اندفاع مدرع" };
  if (tactic === "fortify") return { player: 0.72, enemy: 0.48, label: "تحصين وتمهيد" };
  return { player: 1.04, enemy: 0.86, label: "هجوم مركز" };
}

export function resolveBattleRound(state: GameState, tactic: Tactic): GameState {
  const battle = state.battle;
  const territory = state.territories.find((item) => item.id === battle?.territoryId);
  if (!battle || !territory || battle.status !== "active") return state;

  const modifiers = tacticModifiers(tactic);
  const power = calculateArmyPower(state.army);
  const tempo = 0.88 + ((battle.round * 17 + territory.defense) % 16) / 100;
  const attackDamage = Math.max(9, Math.round((power / 12) * modifiers.player * tempo));
  const defenseDamage = Math.max(5, Math.round((territory.defense / 9) * modifiers.enemy * (1.05 - tempo / 8)));
  const enemyHealth = Math.max(0, battle.enemyHealth - attackDamage);
  const playerHealth = Math.max(0, battle.playerHealth - defenseDamage);
  const victory = enemyHealth === 0;
  const defeat = playerHealth === 0 || battle.round >= 5;
  const status = victory ? "victory" : defeat ? "defeat" : "active";
  const log = [
    ...battle.log,
    `${modifiers.label}: ألحقت ${attackDamage} ضرراً، وتلقت قواتك ${defenseDamage} ضرراً.`,
  ];

  return {
    ...state,
    battle: { ...battle, playerHealth, enemyHealth, round: battle.round + 1, log, status, lastTactic: tactic },
  };
}

export function concludeBattle(state: GameState): GameState {
  const battle = state.battle;
  if (!battle || battle.status === "active") return state;
  const territory = state.territories.find((item) => item.id === battle.territoryId);
  if (!territory) return state;

  if (battle.status === "victory") {
    const losses = Math.max(1, Math.round((1 - battle.playerHealth / Math.max(1, calculateArmyPower(state.army) * 0.72)) * 8));
    const territories = state.territories.map((item) =>
      item.id === territory.id ? { ...item, owner: "player" as const, defense: Math.max(34, Math.round(item.defense * 0.68)) } : item,
    );
    return {
      ...state,
      territories,
      resources: {
        gold: state.resources.gold + territory.goldIncome,
        fuel: state.resources.fuel + territory.fuelIncome,
        supplies: state.resources.supplies + 40,
      },
      army: { ...state.army, infantry: Math.max(0, state.army.infantry - losses) },
      turn: state.turn + 1,
      view: "report",
      lastReport: `تم تحرير ${territory.name}. حصلت على دخلها وخسرت ${losses} من المشاة.`,
    };
  }

  const losses = Math.max(3, Math.min(state.army.infantry, Math.round(state.army.infantry * 0.12)));
  return {
    ...state,
    army: { ...state.army, infantry: state.army.infantry - losses },
    turn: state.turn + 1,
    view: "report",
    lastReport: `تراجعت القوات من ${territory.name}. خسرت ${losses} من المشاة ويُستحسن تعزيز الجيش.`,
  };
}

export function collectTurnIncome(state: GameState): GameState {
  const controlled = controlledTerritories(state.territories);
  const gold = controlled.reduce((total, territory) => total + territory.goldIncome, 0);
  const fuel = controlled.reduce((total, territory) => total + territory.fuelIncome, 0);
  return {
    ...state,
    resources: { gold: state.resources.gold + gold, fuel: state.resources.fuel + fuel, supplies: state.resources.supplies + 25 },
    turn: state.turn + 1,
    lastReport: `وصل دخل الجولة: ${gold} ذهب و${fuel} وقود.`,
  };
}
