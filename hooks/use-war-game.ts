import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { INITIAL_STATE } from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";

const STORAGE_KEY = "war-of-nations.game-state.v1";

export function useWarGame() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && active) {
          setState(JSON.parse(saved) as GameState);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((updater: (current: GameState) => GameState) => {
    setState((current) => {
      const next = updater(current);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  return { state, update, reset, ready };
}
