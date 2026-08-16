import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import { createTroopGroup, tickStrategicGame, type StrategicState } from "@/lib/game/strategic-engine";
import { advanceProgress, calculateLevelStars, createLevelState, DEFAULT_LEVEL_PROGRESS, evaluateLevelOutcome, getLevel, type LevelOutcome, type LevelProgress } from "@/lib/game/levels";

const STORAGE_KEY = "war-of-nations.strategic-campaign.v2";
const LEGACY_STORAGE_KEY = "war-of-nations.strategic-state.v1";

type CampaignData = { state: StrategicState; progress: LevelProgress; outcome: LevelOutcome };

const initialCampaign = (): CampaignData => ({ state: createLevelState(getLevel(DEFAULT_LEVEL_PROGRESS.selectedLevelId)), progress: DEFAULT_LEVEL_PROGRESS, outcome: "playing" });

export function useStrategicGame() {
  const [campaign, setCampaign] = useState<CampaignData>(initialCampaign);
  const [ready, setReady] = useState(false);
  const lastTick = useRef(Date.now());

  const persist = useCallback((next: CampaignData) => { AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined); }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then(async (saved) => {
      if (!active) return;
      if (saved) { setCampaign(JSON.parse(saved) as CampaignData); return; }
      const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (active && legacy) { const migrated = { ...initialCampaign(), state: JSON.parse(legacy) as StrategicState }; setCampaign(migrated); persist(migrated); }
    }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [persist]);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(1, Math.max(0, (now - lastTick.current) / 1000));
      lastTick.current = now;
      setCampaign((current) => {
        if (current.outcome !== "playing") return current;
        const state = tickStrategicGame(current.state, delta);
        const level = getLevel(current.progress.selectedLevelId);
        const outcome = evaluateLevelOutcome(state, level);
        const next: CampaignData = outcome === "victory" ? { state, outcome, progress: advanceProgress(current.progress, level, calculateLevelStars(level, state)) } : { ...current, state, outcome };
        persist(next);
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [persist, ready]);

  const update = useCallback((updater: (current: StrategicState) => StrategicState) => {
    setCampaign((current) => {
      if (current.outcome !== "playing") return current;
      const state = updater(current.state);
      const level = getLevel(current.progress.selectedLevelId);
      const outcome = evaluateLevelOutcome(state, level);
      const next: CampaignData = outcome === "victory" ? { state, outcome, progress: advanceProgress(current.progress, level, calculateLevelStars(level, state)) } : { ...current, state, outcome };
      persist(next);
      return next;
    });
  }, [persist]);

  const selectLevel = useCallback((levelId: string) => {
    setCampaign((current) => {
      const level = getLevel(levelId);
      if (level.number > current.progress.unlockedThrough) return current;
      const next: CampaignData = { state: createLevelState(level), progress: { ...current.progress, selectedLevelId: level.id }, outcome: "playing" };
      persist(next);
      lastTick.current = Date.now();
      return next;
    });
  }, [persist]);

  const retryLevel = useCallback(() => selectLevel(campaign.progress.selectedLevelId), [campaign.progress.selectedLevelId, selectLevel]);
  const nextLevel = useCallback(() => { const currentLevel = getLevel(campaign.progress.selectedLevelId); selectLevel(`l${Math.min(6, currentLevel.number + 1)}`); }, [campaign.progress.selectedLevelId, selectLevel]);
  const sendTroops = useCallback((sourceId: string, targetId: string) => update((state) => createTroopGroup(state, sourceId, targetId, 0.5)), [update]);
  const reset = useCallback(() => {
    setCampaign((current) => { const next = { ...current, state: createLevelState(getLevel(current.progress.selectedLevelId)), outcome: "playing" as LevelOutcome }; persist(next); lastTick.current = Date.now(); return next; });
  }, [persist]);

  return { state: campaign.state, progress: campaign.progress, outcome: campaign.outcome, level: getLevel(campaign.progress.selectedLevelId), ready, update, reset, selectLevel, retryLevel, nextLevel, sendTroops };
}

