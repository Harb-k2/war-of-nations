import { describe, expect, it } from "vitest";

import {
  INITIAL_STATE,
  calculateArmyPower,
  canAttack,
  concludeBattle,
  recruitUnit,
  resolveBattleRound,
  startBattle,
} from "../lib/game/engine";

describe("محرك حرب الدول", () => {
  it("يحسب قوة الجيش من جميع الوحدات", () => {
    expect(calculateArmyPower({ infantry: 10, tanks: 2, armored: 3, air: 1 })).toBe(76);
  });

  it("يسمح بالهجوم على منطقة مجاورة فقط", () => {
    const delta = INITIAL_STATE.territories.find((territory) => territory.id === "delta");
    const coast = INITIAL_STATE.territories.find((territory) => territory.id === "coast");
    expect(delta && canAttack(delta, INITIAL_STATE.territories)).toBe(true);
    expect(coast && canAttack(coast, INITIAL_STATE.territories)).toBe(false);
  });

  it("يخصم تكلفة التجنيد ويزيد عدد الوحدة", () => {
    const next = recruitUnit(INITIAL_STATE, "tanks");
    expect(next.army.tanks).toBe(INITIAL_STATE.army.tanks + 1);
    expect(next.resources.gold).toBe(INITIAL_STATE.resources.gold - 120);
    expect(next.resources.fuel).toBe(INITIAL_STATE.resources.fuel - 24);
  });

  it("لا يجند عند نقص الموارد", () => {
    const empty = { ...INITIAL_STATE, resources: { gold: 0, fuel: 0, supplies: 0 } };
    const next = recruitUnit(empty, "air");
    expect(next.army.air).toBe(empty.army.air);
    expect(next.lastReport).toContain("الموارد غير كافية");
  });

  it("يبدأ اشتباكاً على الهدف المتصل ثم ينهيه مع تغيير الملكية عند الفوز", () => {
    const started = startBattle(INITIAL_STATE, "delta");
    expect(started.battle?.status).toBe("active");
    expect(started.view).toBe("battle");

    const won = {
      ...started,
      battle: { ...started.battle!, enemyHealth: 0, playerHealth: 100, status: "victory" as const },
    };
    const finished = concludeBattle(won);
    expect(finished.territories.find((territory) => territory.id === "delta")?.owner).toBe("player");
    expect(finished.view).toBe("report");
  });

  it("تتقدم جولة المعركة وتحتفظ بسجل الأمر", () => {
    const started = startBattle(INITIAL_STATE, "delta");
    const next = resolveBattleRound(started, "assault");
    expect(next.battle?.round).toBe(2);
    expect(next.battle?.log).toHaveLength(2);
    expect(next.battle?.enemyHealth).toBeLessThan(started.battle!.enemyHealth);
  });

  it("ينهي المعركة بالخسارة إذا استنفدت آخر جولة دون حسم الهدف", () => {
    const started = startBattle(INITIAL_STATE, "delta");
    const closingRound = {
      ...started,
      battle: { ...started.battle!, round: 5, enemyHealth: 200, playerHealth: 100 },
    };
    const next = resolveBattleRound(closingRound, "fortify");
    expect(next.battle?.status).toBe("defeat");
  });
});
