import { Pressable, StyleSheet, Text, View } from "react-native";

import { FIRST_LEVEL_TUTORIAL_STEP_COUNT, getTutorialProgress, type FirstLevelTutorialStep } from "@/lib/game/first-level-tutorial";

type FirstLevelTutorialProps = {
  step: FirstLevelTutorialStep;
  sourceName?: string;
  targetName?: string;
  onBegin: () => void;
  onRevealSource: () => void;
  onSkip: () => void;
  onComplete: () => void;
};

export function FirstLevelTutorial({ step, sourceName, targetName, onBegin, onRevealSource, onSkip, onComplete }: FirstLevelTutorialProps) {
  const progress = getTutorialProgress(step);
  const copy = step === "intro"
    ? { eyebrow: "تدريب البداية", title: "تحرك مرة واحدة لتعرف الخريطة", body: "سنتدرب على اختيار إقليمك ثم إرسال نصف قواته إلى إقليم متصل. اللعبة متوقفة حتى تنتهي.", action: "ابدأ التدريب" }
    : step === "select-source"
      ? { eyebrow: `الخطوة ${progress} من ${FIRST_LEVEL_TUTORIAL_STEP_COUNT}`, title: "اختر إقليماً أخضر", body: "الأقاليم الخضراء تحت قيادتك. اضغط أي إقليم أخضر لتحديده وإظهار الطرق المتصلة.", action: "إظهار إقليم مقترح" }
      : step === "select-target"
        ? { eyebrow: `الخطوة ${progress} من ${FIRST_LEVEL_TUTORIAL_STEP_COUNT}`, title: "أرسل القوات إلى الهدف الذهبي", body: `${sourceName ?? "إقليمك"} محدد الآن. اضغط إقليماً متصلاً ومضاءً لإرسال نصف القوات.`, action: "اتبع الإضاءة الذهبية" }
        : { eyebrow: `الخطوة ${progress} من ${FIRST_LEVEL_TUTORIAL_STEP_COUNT}`, title: "أحسنت، تم إصدار أمر الحركة", body: `ستتحرك القوات من ${sourceName ?? "إقليمك"} نحو ${targetName ?? "الهدف"}. راقب الدائرة الذهبية ثم وسّع سيطرتك.`, action: "ابدأ المستوى" };

  const handleAction = () => {
    if (step === "intro") onBegin();
    else if (step === "select-source") onRevealSource();
    else if (step === "complete") onComplete();
  };

  return (
    <View accessibilityLiveRegion="polite" style={styles.card}>
      <View style={styles.header}><View style={styles.badge}><Text style={styles.badgeText}>{progress}/{FIRST_LEVEL_TUTORIAL_STEP_COUNT || "تمهيد"}</Text></View><View style={styles.headerCopy}><Text style={styles.eyebrow}>{copy.eyebrow}</Text><Text style={styles.title}>{copy.title}</Text></View></View>
      <View style={styles.progressTrack}>{Array.from({ length: FIRST_LEVEL_TUTORIAL_STEP_COUNT }).map((_, index) => <View key={index} style={[styles.progressSegment, progress > index && styles.progressSegmentComplete]} />)}</View>
      <Text style={styles.body}>{copy.body}</Text>
      <View style={styles.actions}>{step !== "complete" ? <Pressable accessibilityRole="button" onPress={onSkip} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>تجاوز</Text></Pressable> : null}{step !== "select-target" ? <Pressable accessibilityRole="button" onPress={handleAction} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>{copy.action}</Text></Pressable> : <Text style={styles.tapHint}>اضغط الهدف المضيء على الخريطة لإكمال هذه الخطوة.</Text>}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#132A43", borderWidth: 1, borderColor: "#E7B34B", borderRadius: 18, padding: 14, gap: 9, shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 8, elevation: 5 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E7B34B", alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#0B1F35", fontSize: 10, fontWeight: "900" },
  eyebrow: { color: "#D2E8C6", fontSize: 9, fontWeight: "900", letterSpacing: 1, textAlign: "right" },
  title: { color: "#F7F2E4", fontSize: 16, lineHeight: 22, fontWeight: "900", textAlign: "right" },
  progressTrack: { flexDirection: "row", gap: 5 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: "#29465D" },
  progressSegmentComplete: { backgroundColor: "#E7B34B" },
  body: { color: "#DDE5E9", fontSize: 12, lineHeight: 19, textAlign: "right" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 8 },
  primaryButton: { backgroundColor: "#E7B34B", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  primaryText: { color: "#0B1F35", fontSize: 11, fontWeight: "900" },
  secondaryButton: { paddingHorizontal: 9, paddingVertical: 8 },
  secondaryText: { color: "#B7C2CE", fontSize: 11, fontWeight: "800", textDecorationLine: "underline" },
  tapHint: { flex: 1, color: "#F0C45A", fontSize: 11, lineHeight: 16, fontWeight: "800", textAlign: "right" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
