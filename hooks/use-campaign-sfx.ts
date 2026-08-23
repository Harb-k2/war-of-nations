import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect } from "react";

const starsSource = require("../assets/audio/stars-earned.wav");
const unlockSource = require("../assets/audio/level-unlock.wav");

function replay(player: ReturnType<typeof useAudioPlayer>) {
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // لا تسمح لفشل تشغيل الصوت أن يوقف نتيجة المستوى على أي منصة.
  }
}

/** مؤثرات قصيرة ومميزة لمكافآت الحملة، مستقلة عن أصوات المعارك. */
export function useCampaignSfx() {
  const stars = useAudioPlayer(starsSource);
  const unlock = useAudioPlayer(unlockSource);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const playStarsEarned = useCallback(() => replay(stars), [stars]);
  const playLevelUnlocked = useCallback(() => replay(unlock), [unlock]);

  return { playStarsEarned, playLevelUnlocked };
}
