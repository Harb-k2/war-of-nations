import { describe, expect, it } from "vitest";

import {
  STRATEGIC_INITIAL_STATE,
  aiChooseMove,
  createTroopGroup,
  tickCombats,
  tickMovement,
  tickProduction,
} from "../lib/game/strategic-engine";

describe("المحرك الاستراتيجي", () => {
  it("ينتج قوات للمناطق المملوكة دون تجاوز الحد الأعلى", () => {
    const next = tickProduction({ ...STRATEGIC_INITIAL_STATE, territories: STRATEGIC_INITIAL_STATE.territories.map((item) => item.id === "capital" ? { ...item, troops: item.maxTroops - 1 } : item) }, 10);
    const capital = next.territories.find((item) => item.id === "capital");
    const neutral = next.territories.find((item) => item.id === "ridge");
    expect(capital?.troops).toBe(capital?.maxTroops);
    expect(neutral?.troops).toBe(28);
  });

  it("ينشئ مجموعة قوات فقط بين منطقتين متصلتين", () => {
    const valid = createTroopGroup(STRATEGIC_INITIAL_STATE, "capital", "delta");
    expect(valid.groups).toHaveLength(1);
    expect(valid.territories.find((item) => item.id === "capital")?.troops).toBeLessThan(92);
    const invalid = createTroopGroup(STRATEGIC_INITIAL_STATE, "capital", "coast");
    expect(invalid.groups).toHaveLength(0);
  });

  it("ينقل المجموعة ثم ينشئ قتالاً عند الوصول إلى خصم", () => {
    const started = createTroopGroup(STRATEGIC_INITIAL_STATE, "capital", "delta", 0.8);
    const arrived = tickMovement(started, 5);
    expect(arrived.groups).toHaveLength(0);
    expect(arrived.combats).toHaveLength(1);
    expect(arrived.combats[0].territoryId).toBe("delta");
  });

  it("يحسم القتال ويحوّل ملكية المنطقة عند انهيار الدفاع", () => {
    const state = { ...STRATEGIC_INITIAL_STATE, combats: [{ id: "test", attacker: "player" as const, defender: "enemy" as const, territoryId: "delta", attackerPower: 200, defenderPower: 1, startedAt: 0, status: "active" as const }] };
    const next = tickCombats(state, 2);
    expect(next.territories.find((item) => item.id === "delta")?.owner).toBe("player");
  });

  it("يختار الذكاء الاصطناعي هدفاً متصلاً بدلاً من هدف غير متصل", () => {
    const move = aiChooseMove(STRATEGIC_INITIAL_STATE);
    expect(move).not.toBeNull();
    expect(["capital", "ridge", "oasis", "coast"]).toContain(move?.targetId);
  });
});
