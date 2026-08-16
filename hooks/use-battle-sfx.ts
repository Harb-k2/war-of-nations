import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useState } from "react";

const strikeSource = require("../assets/audio/battle-strike.wav");
const hitSource = require("../assets/audio/battle-hit.wav");
const victorySource = require("../assets/audio/battle-victory.wav");
const retreatSource = require("../assets/audio/battle-retreat.wav");

function replay(player: ReturnType<typeof useAudioPlayer>) {
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // يمنع فشل الصوت من تعطيل حلقة المعركة على أي منصة.
  }
}

export function useBattleSfx() {
  const strike = useAudioPlayer(strikeSource);
  const hit = useAudioPlayer(hitSource);
  const victory = useAudioPlayer(victorySource);
  const retreat = useAudioPlayer(retreatSource);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const playRound = useCallback(() => {
    if (!soundEnabled) return;
    replay(strike);
    const timer = setTimeout(() => replay(hit), 130);
    return () => clearTimeout(timer);
  }, [hit, soundEnabled, strike]);

  const playOutcome = useCallback(
    (won: boolean) => {
      if (!soundEnabled) return;
      replay(won ? victory : retreat);
    },
    [retreat, soundEnabled, victory],
  );

  return {
    soundEnabled,
    toggleSound: () => setSoundEnabled((current) => !current),
    playRound,
    playOutcome,
  };
}
