import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { StrategicMapView } from "@/components/game/StrategicMapView";
import { useBattleSfx } from "@/hooks/use-battle-sfx";
import { haptic } from "@/lib/haptics";
import {
  UNIT_DEFINITIONS,
  calculateArmyPower,
  collectTurnIncome,
  concludeBattle,
  controlledTerritories,
  recruitUnit,
  resolveBattleRound,
} from "@/lib/game/engine";
import type { GameView, Tactic, Territory, UnitType } from "@/lib/game/types";
import { useWarGame } from "@/hooks/use-war-game";

function TapButton({ label, onPress, tone = "gold", disabled = false, compact = false }: { label: string; onPress: () => void; tone?: "gold" | "blue" | "danger" | "ghost"; disabled?: boolean; compact?: boolean }) {
  const toneStyle = tone === "gold" ? styles.goldButton : tone === "danger" ? styles.dangerButton : tone === "ghost" ? styles.ghostButton : styles.blueButton;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, compact && styles.compactButton, toneStyle, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}
    >
      <Text style={[styles.buttonText, tone === "ghost" && styles.ghostText, compact && styles.compactText]}>{label}</Text>
    </Pressable>
  );
}

function ResourceStrip({ gold, fuel, supplies }: { gold: number; fuel: number; supplies: number }) {
  const entries = [
    ["ذهب", gold, "◆", "#E7B34B"],
    ["وقود", fuel, "◈", "#83A66C"],
    ["مؤن", supplies, "✦", "#B7C2CE"],
  ];
  return (
    <View style={styles.resourceStrip}>
      {entries.map(([label, value, symbol, color]) => (
        <View key={String(label)} style={styles.resourceItem}>
          <Text style={[styles.resourceSymbol, { color: String(color) }]}>{symbol}</Text>
          <View>
            <Text style={styles.resourceValue}>{value}</Text>
            <Text style={styles.resourceLabel}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function NavBar({ active, change }: { active: GameView; change: (view: GameView) => void }) {
  const items: { id: GameView; label: string; symbol: string }[] = [
    { id: "command", label: "القيادة", symbol: "⌂" },
    { id: "map", label: "الخريطة", symbol: "◉" },
    { id: "army", label: "الجيش", symbol: "▰" },
  ];
  return (
    <View style={styles.navBar}>
      {items.map((item) => {
        const selected = active === item.id;
        return (
          <Pressable key={item.id} onPress={() => { haptic.light(); change(item.id); }} style={({ pressed }) => [styles.navItem, selected && styles.navItemActive, pressed && styles.pressed]}>
            <Text style={[styles.navSymbol, selected && styles.navTextActive]}>{item.symbol}</Text>
            <Text style={[styles.navText, selected && styles.navTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const { state, update, reset, ready } = useWarGame();
  const { soundEnabled, toggleSound, playRound: playBattleSfx, playOutcome } = useBattleSfx();
  const territoryCount = controlledTerritories(state.territories).length;
  const power = calculateArmyPower(state.army);

  const changeView = (view: GameView) => update((current) => ({ ...current, view }));
  const collectIncome = () => {
    haptic.success();
    update(collectTurnIncome);
  };
  const recruit = (type: UnitType) => {
    haptic.medium();
    update((current) => recruitUnit(current, type));
  };
  const playRound = (tactic: Tactic) => {
    haptic.medium();
    playBattleSfx();
    update((current) => resolveBattleRound(current, tactic));
  };
  const finishBattle = () => {
    const won = state.battle?.status === "victory";
    if (won) {
      haptic.success();
    } else {
      haptic.error();
    }
    playOutcome(won);
    update(concludeBattle);
  };
  const startFresh = () => {
    Alert.alert("بدء حملة جديدة", "سيتم حذف التقدم المحفوظ على هذا الجهاز.", [
      { text: "إلغاء", style: "cancel" },
      { text: "بدء جديد", style: "destructive", onPress: () => { haptic.medium(); reset(); } },
    ]);
  };

  if (!ready) {
    return (
      <ScreenContainer className="items-center justify-center" edges={["top", "bottom", "left", "right"]}>
        <ActivityIndicator color="#E7B34B" size="large" />
        <Text style={styles.loadingText}>يتم تحميل غرفة القيادة...</Text>
      </ScreenContainer>
    );
  }

  const selected = state.territories.find((territory) => territory.id === state.selectedTerritoryId) ?? null;
  const activeNav = ["command", "map", "army"].includes(state.view) ? state.view : "map";

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandKicker}>قيادة الحملة</Text>
            <Text style={styles.brandName}>حرب الدول</Text>
          </View>
          <View style={styles.turnBadge}>
            <Text style={styles.turnText}>الجولة {state.turn}</Text>
          </View>
        </View>

        <ResourceStrip {...state.resources} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {state.view === "command" ? (
            <CommandView power={power} territoryCount={territoryCount} lastReport={state.lastReport} onMap={() => changeView("map")} onArmy={() => changeView("army")} onIncome={collectIncome} onReset={startFresh} />
          ) : null}
          {state.view === "map" ? <StrategicMapView /> : null}
          {state.view === "army" ? (
            <ArmyView army={state.army} gold={state.resources.gold} fuel={state.resources.fuel} power={power} onRecruit={recruit} />
          ) : null}
          {state.view === "battle" && state.battle ? (
            <BattleView battle={state.battle} territory={selected} soundEnabled={soundEnabled} onToggleSound={toggleSound} onPlay={playRound} onFinish={finishBattle} />
          ) : null}
          {state.view === "report" ? (
            <ReportView report={state.lastReport} onMap={() => changeView("map")} onCommand={() => changeView("command")} />
          ) : null}
        </ScrollView>

        <NavBar active={activeNav as GameView} change={changeView} />
      </View>
    </ScreenContainer>
  );
}

function CommandView({ power, territoryCount, lastReport, onMap, onArmy, onIncome, onReset }: { power: number; territoryCount: number; lastReport: string | null; onMap: () => void; onArmy: () => void; onIncome: () => void; onReset: () => void }) {
  return (
    <View style={styles.screenGap}>
      <View style={styles.heroCard}>
        <View style={styles.heroOrb}><Text style={styles.heroOrbText}>✦</Text></View>
        <Text style={styles.heroEyebrow}>العملية التالية</Text>
        <Text style={styles.heroTitle}>وسّع حدودك بحساب</Text>
        <Text style={styles.heroCopy}>استثمر في القوات، حرّر المناطق المتاخمة، ثم ثبّت سيطرتك بالموارد الجديدة.</Text>
        <TapButton label="فتح خريطة العمليات" onPress={onMap} />
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricCard}><Text style={styles.metricValue}>{power}</Text><Text style={styles.metricLabel}>قوة الجيش</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricValue}>{territoryCount}/6</Text><Text style={styles.metricLabel}>مناطق مسيطَر عليها</Text></View>
      </View>

      <SectionTitle eyebrow="إدارة سريعة" title="مركز القيادة" />
      <View style={styles.commandGrid}>
        <Pressable onPress={onArmy} style={({ pressed }) => [styles.commandCard, pressed && styles.pressed]}>
          <Text style={styles.commandSymbol}>▰</Text>
          <Text style={styles.commandTitle}>تشكيل الجيش</Text>
          <Text style={styles.commandCopy}>تجنيد مشاة وآليات وطيران</Text>
        </Pressable>
        <Pressable onPress={onIncome} style={({ pressed }) => [styles.commandCard, pressed && styles.pressed]}>
          <Text style={styles.commandSymbol}>◆</Text>
          <Text style={styles.commandTitle}>تحصيل الدخل</Text>
          <Text style={styles.commandCopy}>استلم دخل المناطق المسيطر عليها</Text>
        </Pressable>
      </View>

      {lastReport ? <View style={styles.noticeCard}><Text style={styles.noticeTitle}>آخر تقرير</Text><Text style={styles.noticeText}>{lastReport}</Text></View> : null}
      <Pressable onPress={onReset} style={({ pressed }) => [styles.resetLink, pressed && styles.pressed]}><Text style={styles.resetText}>بدء حملة جديدة</Text></Pressable>
    </View>
  );
}

function ArmyView({ army, gold, fuel, power, onRecruit }: { army: { infantry: number; tanks: number; armored: number; air: number }; gold: number; fuel: number; power: number; onRecruit: (type: UnitType) => void }) {
  return (
    <View style={styles.screenGap}>
      <SectionTitle eyebrow="القوات والآليات" title="تشكيل الجيش" action={`قوة ${power}`} />
      <View style={styles.armyBanner}><Text style={styles.armyBannerText}>ابنِ قوة متوازنة. الدبابات والطيران يرفعان أثر الهجوم المباشر، بينما يحافظ المشاة على السيطرة.</Text></View>
      {UNIT_DEFINITIONS.map((unit) => {
        const allowed = gold >= unit.goldCost && fuel >= unit.fuelCost;
        return (
          <View key={unit.type} style={styles.unitCard}>
            <View style={styles.unitSymbolBox}><Text style={styles.unitSymbol}>{unit.symbol}</Text></View>
            <View style={styles.unitContent}>
              <View style={styles.unitHeader}><Text style={styles.unitName}>{unit.name}</Text><Text style={styles.unitCount}>× {army[unit.type]}</Text></View>
              <Text style={styles.unitCopy}>{unit.description}</Text>
              <View style={styles.costRow}><Text style={styles.costText}>◆ {unit.goldCost}</Text><Text style={styles.costText}>◈ {unit.fuelCost}</Text><Text style={styles.powerText}>قوة +{unit.power}</Text></View>
              <TapButton label="بناء وحدة" compact disabled={!allowed} onPress={() => onRecruit(unit.type)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function BattleView({ battle, territory, soundEnabled, onToggleSound, onPlay, onFinish }: { battle: { playerHealth: number; enemyHealth: number; round: number; log: string[]; status: "active" | "victory" | "defeat" }; territory: Territory | null; soundEnabled: boolean; onToggleSound: () => void; onPlay: (tactic: Tactic) => void; onFinish: () => void }) {
  const active = battle.status === "active";
  const [reduceMotion, setReduceMotion] = useState(false);
  const lastRound = useRef(battle.round);
  const strike = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const outcomePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const isNewRound = battle.round > lastRound.current;
    lastRound.current = battle.round;
    if (reduceMotion) {
      strike.setValue(0);
      flash.setValue(0);
      burst.setValue(0);
      outcomePulse.setValue(0);
      return;
    }
    if (isNewRound) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(strike, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(strike, { toValue: 0, duration: 210, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(flash, { toValue: 0.72, duration: 90, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(burst, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(burst, { toValue: 0, duration: 430, useNativeDriver: true }),
        ]),
      ]).start();
    }
    if (!active) {
      Animated.sequence([
        Animated.timing(outcomePulse, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(outcomePulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]).start();
    }
  }, [active, battle.round, burst, flash, outcomePulse, reduceMotion, strike]);

  const tactics: { id: Tactic; title: string; copy: string }[] = [
    { id: "assault", title: "هجوم مركز", copy: "ضربة متوازنة" },
    { id: "armor", title: "اندفاع مدرع", copy: "ضرر أعلى ومخاطرة" },
    { id: "fortify", title: "تحصين وتمهيد", copy: "خفض ضرر الخصم" },
  ];
  const shotTranslate = strike.interpolate({ inputRange: [0, 1], outputRange: [-120, 108] });
  const shake = strike.interpolate({ inputRange: [0, 0.32, 0.58, 1], outputRange: [0, -8, 7, 0] });
  const burstLift = burst.interpolate({ inputRange: [0, 1], outputRange: [10, -28] });
  const outcomeScale = outcomePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  return (
    <View style={styles.screenGap}>
      <View style={styles.battleHeadingRow}>
        <SectionTitle eyebrow="اشتباك مباشر" title={territory ? `معركة ${territory.name}` : "ساحة المعركة"} action={`جولة ${battle.round}`} />
        <Pressable accessibilityRole="button" accessibilityLabel={soundEnabled ? "كتم مؤثرات المعركة" : "تشغيل مؤثرات المعركة"} onPress={onToggleSound} style={({ pressed }) => [styles.soundToggle, pressed && styles.pressed]}>
          <Text style={styles.soundToggleText}>{soundEnabled ? "◖ صوت" : "◌ صامت"}</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.battleArena, { transform: [{ translateX: shake }] }]}>
        <Animated.View pointerEvents="none" style={[styles.battleFlash, { opacity: flash }]} />
        <Animated.View pointerEvents="none" style={[styles.projectile, { opacity: flash, transform: [{ translateX: shotTranslate }, { rotate: "-18deg" }] }]}><Text style={styles.projectileText}>✦</Text></Animated.View>
        <Animated.View pointerEvents="none" style={[styles.damageBurst, { opacity: burst, transform: [{ translateY: burstLift }, { scale: burst }] }]}><Text style={styles.damageBurstText}>ضرر</Text></Animated.View>
        <View style={styles.forceHeader}><Text style={styles.forceLabel}>قواتك</Text><Text style={styles.forceHealth}>{battle.playerHealth}</Text></View>
        <View style={styles.healthTrack}><View style={[styles.healthFill, styles.playerHealth, { width: `${Math.min(100, battle.playerHealth)}%` }]} /></View>
        <View style={styles.battleDivider}><Text style={styles.vsText}>VS</Text></View>
        <View style={styles.forceHeader}><Text style={styles.forceLabel}>دفاع العدو</Text><Text style={styles.forceHealth}>{battle.enemyHealth}</Text></View>
        <View style={styles.healthTrack}><View style={[styles.healthFill, styles.enemyHealth, { width: `${Math.min(100, battle.enemyHealth)}%` }]} /></View>
      </Animated.View>

      {active ? (
        <View style={styles.tacticsGroup}>
          <Text style={styles.tacticsLabel}>اختر أمر الجولة</Text>
          {tactics.map((tactic) => <Pressable key={tactic.id} onPress={() => onPlay(tactic.id)} style={({ pressed }) => [styles.tacticCard, pressed && styles.pressed]}><View><Text style={styles.tacticTitle}>{tactic.title}</Text><Text style={styles.tacticCopy}>{tactic.copy}</Text></View><Text style={styles.tacticChevron}>‹</Text></Pressable>)}
        </View>
      ) : (
        <Animated.View style={[styles.outcomeCard, battle.status === "victory" ? styles.outcomeVictory : styles.outcomeDefeat, { transform: [{ scale: outcomeScale }] }]}><Text style={styles.outcomeMark}>{battle.status === "victory" ? "✦" : "!"}</Text><Text style={styles.outcomeTitle}>{battle.status === "victory" ? "تم كسر الدفاع" : "انتهت العملية"}</Text><Text style={styles.outcomeCopy}>{battle.status === "victory" ? "ثبّت السيطرة واستلم مكافآت المنطقة." : "تحتاج قواتك إلى إعادة تنظيم قبل المحاولة المقبلة."}</Text><TapButton label="فتح التقرير" onPress={onFinish} tone={battle.status === "victory" ? "gold" : "danger"} /></Animated.View>
      )}

      <View style={styles.logCard}><Text style={styles.logTitle}>سجل الميدان</Text>{battle.log.slice(-3).reverse().map((entry, index) => <Text key={`${entry}-${index}`} style={styles.logEntry}>• {entry}</Text>)}</View>
    </View>
  );
}

function ReportView({ report, onMap, onCommand }: { report: string | null; onMap: () => void; onCommand: () => void }) {
  return (
    <View style={styles.screenGap}>
      <View style={styles.reportHero}><Text style={styles.reportSeal}>✦</Text><Text style={styles.reportEyebrow}>تقرير القيادة</Text><Text style={styles.reportTitle}>تم تحديث الحملة</Text><Text style={styles.reportCopy}>{report ?? "عُد إلى الخريطة لتحديد مهمتك التالية."}</Text></View>
      <TapButton label="العودة إلى الخريطة" onPress={onMap} />
      <TapButton label="مركز القيادة" onPress={onCommand} tone="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: "#0B1F35" },
  topBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandKicker: { color: "#B7C2CE", fontSize: 11, letterSpacing: 1.5, lineHeight: 16 },
  brandName: { color: "#F7F2E4", fontSize: 27, fontWeight: "800", lineHeight: 34 },
  turnBadge: { borderWidth: 1, borderColor: "#4D6880", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#132A43" },
  turnText: { color: "#E7B34B", fontSize: 12, fontWeight: "800" },
  resourceStrip: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "#132A43", borderWidth: 1, borderColor: "#2D4C67", borderRadius: 16, paddingVertical: 10, justifyContent: "space-around" },
  resourceItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  resourceSymbol: { fontSize: 16, fontWeight: "800" },
  resourceValue: { color: "#F7F2E4", fontSize: 16, fontWeight: "800", textAlign: "right", lineHeight: 19 },
  resourceLabel: { color: "#B7C2CE", fontSize: 10, textAlign: "right", lineHeight: 13 },
  scrollContent: { padding: 16, paddingBottom: 92 },
  screenGap: { gap: 16 },
  heroCard: { backgroundColor: "#193B54", borderRadius: 24, borderWidth: 1, borderColor: "#41637A", padding: 22, overflow: "hidden" },
  heroOrb: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#E7B34B", alignItems: "center", justifyContent: "center", marginBottom: 17 },
  heroOrbText: { color: "#0B1F35", fontSize: 22, fontWeight: "900" },
  heroEyebrow: { color: "#B7C2CE", fontWeight: "700", fontSize: 11, letterSpacing: 1.1, lineHeight: 16 },
  heroTitle: { color: "#F7F2E4", fontSize: 29, fontWeight: "800", lineHeight: 37, marginTop: 3 },
  heroCopy: { color: "#D8E0E6", fontSize: 14, lineHeight: 22, marginTop: 9, marginBottom: 18 },
  metricRow: { flexDirection: "row", gap: 12 },
  metricCard: { flex: 1, borderRadius: 18, backgroundColor: "#132A43", padding: 16, borderWidth: 1, borderColor: "#2D4C67" },
  metricValue: { color: "#E7B34B", fontSize: 25, fontWeight: "800", textAlign: "right", lineHeight: 31 },
  metricLabel: { color: "#B7C2CE", fontSize: 11, lineHeight: 16, textAlign: "right", marginTop: 3 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 5 },
  eyebrow: { color: "#83A66C", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, lineHeight: 15 },
  sectionTitle: { color: "#F7F2E4", fontSize: 21, fontWeight: "800", lineHeight: 28 },
  sectionAction: { color: "#E7B34B", fontSize: 12, fontWeight: "700", paddingBottom: 3 },
  commandGrid: { flexDirection: "row", gap: 12 },
  commandCard: { flex: 1, borderRadius: 18, padding: 16, minHeight: 155, backgroundColor: "#172F49", borderWidth: 1, borderColor: "#33516C", justifyContent: "space-between" },
  commandSymbol: { color: "#E7B34B", fontSize: 25, fontWeight: "900" },
  commandTitle: { color: "#F7F2E4", fontSize: 16, fontWeight: "800", textAlign: "right" },
  commandCopy: { color: "#B7C2CE", fontSize: 11, lineHeight: 16, textAlign: "right" },
  noticeCard: { borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#496275", backgroundColor: "#163145" },
  noticeTitle: { color: "#E7B34B", fontSize: 12, fontWeight: "800", marginBottom: 5, textAlign: "right" },
  noticeText: { color: "#E5EDF1", fontSize: 13, lineHeight: 20, textAlign: "right" },
  resetLink: { alignSelf: "center", paddingVertical: 5 },
  resetText: { color: "#8CA1B1", fontSize: 12, textDecorationLine: "underline" },
  navBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 10, backgroundColor: "#0A1A2B", borderTopWidth: 1, borderTopColor: "#29445B", gap: 8 },
  navItem: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 13 },
  navItemActive: { backgroundColor: "#1B3851" },
  navSymbol: { color: "#8CA1B1", fontSize: 18, lineHeight: 20 },
  navText: { color: "#8CA1B1", fontSize: 10, fontWeight: "700", lineHeight: 15 },
  navTextActive: { color: "#E7B34B" },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  compactButton: { minHeight: 36, borderRadius: 10, paddingHorizontal: 12, alignSelf: "flex-end", marginTop: 11 },
  goldButton: { backgroundColor: "#E7B34B" },
  blueButton: { backgroundColor: "#2C5876" },
  dangerButton: { backgroundColor: "#B8474D" },
  ghostButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#4B667B" },
  disabledButton: { opacity: 0.52 },
  buttonText: { color: "#0B1F35", fontSize: 14, fontWeight: "900" },
  ghostText: { color: "#DDE5E9" },
  compactText: { fontSize: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  mapIntro: { color: "#B7C2CE", fontSize: 13, lineHeight: 20, textAlign: "right" },
  mapBoard: { backgroundColor: "#10273C", padding: 10, borderRadius: 23, borderWidth: 1, borderColor: "#36556D", flexDirection: "row", flexWrap: "wrap", gap: 9 },
  territoryTile: { width: "31%", minHeight: 109, borderRadius: 15, borderWidth: 1, borderColor: "#718191", padding: 8, justifyContent: "space-between" },
  territorySelected: { borderWidth: 3, borderColor: "#E7B34B" },
  territoryShort: { color: "#F7F2E4", fontSize: 14, fontWeight: "900", textAlign: "right" },
  territoryName: { color: "#F7F2E4", fontSize: 10, fontWeight: "800", textAlign: "right", lineHeight: 14 },
  ownerPill: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 4 },
  ownerText: { color: "#0B1F35", fontWeight: "900", fontSize: 7, textAlign: "center" },
  targetCard: { backgroundColor: "#172F49", borderRadius: 20, borderWidth: 1, borderColor: "#406079", padding: 17, gap: 12 },
  targetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  targetName: { color: "#F7F2E4", fontSize: 19, fontWeight: "800", textAlign: "right" },
  targetTerrain: { color: "#B7C2CE", fontSize: 12, lineHeight: 18, textAlign: "right" },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  targetStats: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#33516C", paddingVertical: 10 },
  targetStat: { color: "#D8E0E6", fontSize: 11, fontWeight: "700" },
  ownedMessage: { color: "#A7C897", fontSize: 13, fontWeight: "700", textAlign: "right" },
  armyBanner: { borderLeftWidth: 3, borderLeftColor: "#E7B34B", backgroundColor: "#142D45", borderRadius: 14, padding: 14 },
  armyBannerText: { color: "#DDE5E9", fontSize: 13, lineHeight: 20, textAlign: "right" },
  unitCard: { flexDirection: "row", gap: 13, borderRadius: 19, padding: 14, backgroundColor: "#172F49", borderWidth: 1, borderColor: "#33516C", alignItems: "flex-start" },
  unitSymbolBox: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#29465D", alignItems: "center", justifyContent: "center" },
  unitSymbol: { color: "#E7B34B", fontWeight: "900", fontSize: 22 },
  unitContent: { flex: 1 },
  unitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  unitName: { color: "#F7F2E4", fontSize: 17, fontWeight: "800" },
  unitCount: { color: "#E7B34B", fontSize: 15, fontWeight: "900" },
  unitCopy: { color: "#B7C2CE", fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 4 },
  costRow: { flexDirection: "row", gap: 12, marginTop: 9 },
  costText: { color: "#D7C89B", fontSize: 10, fontWeight: "800" },
  powerText: { color: "#A7C897", fontSize: 10, fontWeight: "800" },
  battleArena: { padding: 18, borderRadius: 22, backgroundColor: "#172F49", borderWidth: 1, borderColor: "#406079", gap: 9 },
  battleHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  soundToggle: { borderRadius: 99, borderWidth: 1, borderColor: "#42637A", backgroundColor: "#132A43", paddingHorizontal: 10, paddingVertical: 7, marginBottom: 2 },
  soundToggleText: { color: "#DDE5E9", fontSize: 10, fontWeight: "800" },
  battleFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#E7B34B", borderRadius: 22 },
  projectile: { position: "absolute", top: "46%", right: 112, zIndex: 4 },
  projectileText: { color: "#F7D479", fontSize: 30, fontWeight: "900", textShadowColor: "#E87E43", textShadowRadius: 14 },
  damageBurst: { position: "absolute", top: "42%", right: 34, zIndex: 5, backgroundColor: "#B8474D", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  damageBurstText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  forceHeader: { flexDirection: "row", justifyContent: "space-between" },
  forceLabel: { color: "#DCE6EA", fontSize: 13, fontWeight: "800" },
  forceHealth: { color: "#F7F2E4", fontSize: 15, fontWeight: "900" },
  healthTrack: { height: 12, borderRadius: 99, backgroundColor: "#0A1929", overflow: "hidden" },
  healthFill: { height: "100%", borderRadius: 99 },
  playerHealth: { backgroundColor: "#83A66C" },
  enemyHealth: { backgroundColor: "#D66565" },
  battleDivider: { alignItems: "center", marginVertical: 2 },
  vsText: { color: "#E7B34B", fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  tacticsGroup: { gap: 9 },
  tacticsLabel: { color: "#B7C2CE", fontSize: 12, fontWeight: "800", textAlign: "right" },
  tacticCard: { padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#183650", borderRadius: 16, borderWidth: 1, borderColor: "#42637A" },
  tacticTitle: { color: "#F7F2E4", fontSize: 15, fontWeight: "800", textAlign: "right" },
  tacticCopy: { color: "#B7C2CE", fontSize: 11, marginTop: 2, lineHeight: 16, textAlign: "right" },
  tacticChevron: { color: "#E7B34B", fontSize: 26, lineHeight: 28 },
  outcomeCard: { borderRadius: 20, padding: 20, gap: 8, alignItems: "center" },
  outcomeVictory: { backgroundColor: "#315842", borderWidth: 1, borderColor: "#83A66C" },
  outcomeDefeat: { backgroundColor: "#5A3540", borderWidth: 1, borderColor: "#D66565" },
  outcomeTitle: { color: "#F7F2E4", fontSize: 22, fontWeight: "900" },
  outcomeMark: { color: "#F7F2E4", fontSize: 29, fontWeight: "900", lineHeight: 33 },
  outcomeCopy: { color: "#E8ECE7", fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 5 },
  logCard: { backgroundColor: "#10273C", padding: 15, borderRadius: 16, borderWidth: 1, borderColor: "#2D4C67", gap: 7 },
  logTitle: { color: "#E7B34B", fontSize: 12, fontWeight: "800", textAlign: "right" },
  logEntry: { color: "#B7C2CE", fontSize: 11, lineHeight: 17, textAlign: "right" },
  reportHero: { backgroundColor: "#193B54", borderWidth: 1, borderColor: "#4B6D84", borderRadius: 23, padding: 26, alignItems: "center" },
  reportSeal: { color: "#E7B34B", fontSize: 36, lineHeight: 42 },
  reportEyebrow: { color: "#B7C2CE", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 7 },
  reportTitle: { color: "#F7F2E4", fontSize: 25, fontWeight: "900", marginTop: 5 },
  reportCopy: { color: "#DDE5E9", fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 9 },
  loadingText: { color: "#B7C2CE", marginTop: 12, fontSize: 13 },
});
