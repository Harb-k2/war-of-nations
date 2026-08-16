import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import { STRATEGIC_INITIAL_STATE, tickStrategicGame, type StrategicState } from "@/lib/game/strategic-engine";

const STORAGE_KEY = "war-of-nations.strategic-state.v1";

export function useStrategicGame() {
  const [state, setState] = useState<StrategicState>(STRATEGIC_INITIAL_STATE);
  const [ready, setReady] = useState(false);
  const lastTick = useRef(Date.now());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && saved) setState(JSON.parse(saved) as StrategicState);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(1, Math.max(0, (now - lastTick.current) / 1000));
      lastTick.current = now;
      setState((current) => {
        const next = tickStrategicGame(current, delta);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [ready]);

  const update = useCallback((updater: (current: StrategicState) => StrategicState) => {
    setState((current) => {
      const next = updater(current);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(STRATEGIC_INITIAL_STATE);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  return { state, ready, update, reset };
}
