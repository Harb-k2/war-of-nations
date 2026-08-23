import { Animated, Easing, StyleSheet, Text } from "react-native";
import { useEffect, useRef } from "react";

export type CampaignCelebration = {
  id: number;
  stars: number;
  unlockedLevel: number | null;
};

const STAR_PARTICLES = [
  { left: "50%", top: "46%", x: -108, y: -92, rotate: "-24deg" },
  { left: "50%", top: "46%", x: 104, y: -76, rotate: "26deg" },
  { left: "50%", top: "46%", x: -132, y: 32, rotate: "-42deg" },
  { left: "50%", top: "46%", x: 128, y: 43, rotate: "40deg" },
  { left: "50%", top: "46%", x: -38, y: 112, rotate: "-12deg" },
  { left: "50%", top: "46%", x: 42, y: 116, rotate: "14deg" },
] as const;

export function CampaignCelebrationLayer({ celebration, reduceMotion }: { celebration: CampaignCelebration | null; reduceMotion: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!celebration) {
      opacity.setValue(0);
      return;
    }

    opacity.setValue(0);
    scale.setValue(reduceMotion ? 1 : 0.94);
    burst.setValue(0);
    const animation = reduceMotion
      ? Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true })
      : Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 170, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(burst, { toValue: 1, duration: 860, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]);
    animation.start();
    return () => animation.stop();
  }, [burst, celebration, opacity, reduceMotion, scale]);

  if (!celebration) return null;

  const particles = STAR_PARTICLES.slice(0, Math.max(3, celebration.stars + 2));
  return (
    <Animated.View pointerEvents="none" accessibilityLabel={`حصلت على ${celebration.stars} من 3 نجوم`} style={[styles.layer, { opacity }]}>
      {celebration.unlockedLevel ? <Animated.View style={[styles.unlockBanner, { transform: [{ scale }] }]}><Text style={styles.unlockKicker}>تقدم الحملة</Text><Text style={styles.unlockTitle}>فتح المستوى {celebration.unlockedLevel}</Text><Text style={styles.unlockCopy}>تحدٍ جديد أصبح جاهزاً للقيادة</Text></Animated.View> : null}
      {!reduceMotion ? particles.map((particle, index) => <Animated.Text key={`${celebration.id}-${index}`} style={[styles.starParticle, { left: particle.left, top: particle.top, opacity: burst.interpolate({ inputRange: [0, 0.76, 1], outputRange: [0, 1, 0] }), transform: [{ translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x] }) }, { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y] }) }, { rotate: particle.rotate }] }]}>{index % 2 === 0 ? "✦" : "•"}</Animated.Text>) : null}
      <Animated.View style={[styles.starAward, { transform: [{ scale }] }]}><Text style={styles.starAwardKicker}>مكافأة المهمة</Text><Text style={styles.starAwardStars}>{"★".repeat(celebration.stars)}{"☆".repeat(3 - celebration.stars)}</Text><Text style={styles.starAwardCopy}>حصلت على {celebration.stars} من 3 نجوم</Text></Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 12, alignItems: "center", justifyContent: "center" },
  unlockBanner: { position: "absolute", top: 16, minWidth: 220, alignItems: "center", borderRadius: 15, backgroundColor: "#F0C45A", borderWidth: 1, borderColor: "#FFF2BE", paddingHorizontal: 15, paddingVertical: 9, shadowColor: "#E7B34B", shadowOpacity: 0.9, shadowRadius: 13, elevation: 9 },
  unlockKicker: { color: "#315842", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  unlockTitle: { color: "#0B1F35", fontSize: 18, fontWeight: "900", lineHeight: 24 },
  unlockCopy: { color: "#315842", fontSize: 10, fontWeight: "800", lineHeight: 14 },
  starAward: { minWidth: 190, alignItems: "center", borderRadius: 20, backgroundColor: "#102B40", borderWidth: 1, borderColor: "#F0C45A", paddingHorizontal: 17, paddingVertical: 12, shadowColor: "#E7B34B", shadowOpacity: 0.85, shadowRadius: 16, elevation: 9 },
  starAwardKicker: { color: "#D2E8C6", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  starAwardStars: { color: "#F0C45A", fontSize: 27, letterSpacing: 4, fontWeight: "900", lineHeight: 35 },
  starAwardCopy: { color: "#F7F2E4", fontSize: 11, fontWeight: "800" },
  starParticle: { position: "absolute", color: "#FFF3B7", fontSize: 25, fontWeight: "900", textShadowColor: "#E7B34B", textShadowRadius: 7 },
});
