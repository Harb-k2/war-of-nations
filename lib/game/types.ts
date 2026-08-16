export type TerritoryOwner = "player" | "enemy" | "neutral";
export type GameView = "command" | "map" | "army" | "battle" | "report";
export type Tactic = "assault" | "armor" | "fortify";

export type Resources = {
  gold: number;
  fuel: number;
  supplies: number;
};

export type Army = {
  infantry: number;
  tanks: number;
  armored: number;
  air: number;
};

export type Territory = {
  id: string;
  name: string;
  shortName: string;
  owner: TerritoryOwner;
  defense: number;
  goldIncome: number;
  fuelIncome: number;
  adjacent: string[];
  terrain: string;
};

export type UnitType = keyof Army;

export type UnitDefinition = {
  type: UnitType;
  name: string;
  symbol: string;
  power: number;
  goldCost: number;
  fuelCost: number;
  description: string;
};

export type BattleState = {
  territoryId: string;
  playerHealth: number;
  enemyHealth: number;
  round: number;
  log: string[];
  status: "active" | "victory" | "defeat";
  lastTactic?: Tactic;
};

export type GameState = {
  resources: Resources;
  army: Army;
  territories: Territory[];
  turn: number;
  view: GameView;
  selectedTerritoryId: string | null;
  battle: BattleState | null;
  lastReport: string | null;
};
