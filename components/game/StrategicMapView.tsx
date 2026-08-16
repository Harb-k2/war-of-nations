import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Svg, { Polygon } from "react-native-svg";

import { haptic } from "@/lib/haptics";
import { createTroopGroup, type StrategicTerritory } from "@/lib/game/strategic-engine";
import { getObjectiveText, isLevelUnlocked, LEVELS } from "@/lib/game/levels";
import { useStrategicGame } from "@/hooks/use-strategic-game";

const COLORS = {
  player: { fill: "#315842", ring: "#A7C897", label: "قواتك", marker: "▰" },
  enemy: { fill: "#663A42", ring: "#E88A84", label: "خصم", marker: "◆" },
  neutral: { fill: "#56513F", ring: "#D8CB9B", label: "محايد", marker: "○" },
};

const REGION_POLYGONS: Record<string, string> = {
  north: "37,0 62,0 71,10 67,26 57,31 42,29 33,17",
  capital: "35,26 57,29 68,38 63,53 46,57 31,48",
  ridge: "0,23 32,17 35,40 29,55 8,53 0,42",
  oasis: "8,53 31,49 46,57 46,78 28,93 4,84",
  delta: "63,35 96,29 100,62 88,77 65,71 59,53",
  coast: "46,73 65,69 88,77 96,100 31,100 27,92",
};

function RegionalBackdrop({ territories }: { territories: StrategicTerritory[] }) {
  return (
    <Svg pointerEvents="none" style={styles.regionalBackdrop} viewBox="0 0 100 100" preserveAspectRatio="none">
      {territories.map((territory) => {
        const tone = COLORS[territory.owner];
        const points = REGION_POLYGONS[territory.id];
        return points ? <Polygon key={territory.id} points={points} fill={tone.fill} fillOpacity={0.82} stroke={tone.ring} strokeOpacity={0.78} strokeWidth="0.8" /> : null;
      })}
    </Svg>
  );
}

function MapLine({ from, to, width, height, active = false }: { from: StrategicTerritory; to: StrategicTerritory; width: number; height: number; active?: boolean }) {
  const x1 = from.position.x * width / 100;
  const y1 = from.position.y * height / 100;
  const x2 = to.position.x * width / 100;
  const y2 = to.position.y * height / 100;
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const angle = `${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}deg`;
  return <View pointerEvents="none" style={[styles.mapLine, active && styles.mapLineActive, { left: x1, top: y1, width: length, transform: [{ rotate: angle }] }]} />;
}

export function StrategicMapView() {
  const { state, progress, outcome, level, update, ready, reset, selectLevel, retryLevel, nextLevel } = useStrategicGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [notice, setNotice] = useState("ابدأ باختيار منطقة خضراء، ثم اختر منطقة متصلة لإرسال نصف قواتك.");
  const [showGuide, setShowGuide] = useState(true);
  const [showLevels, setShowLevels] = useState(false);
  const mapSize = useRef({ width: 1, height: 1 });

  useEffect(() => {
    AsyncStorage.getItem("war-of-nations.strategic-guide.v1")
      .then((value) => setShowGuide(value !== "seen"))
      .catch(() => undefined);
  }, []);

  const dismissGuide = useCallback(() => {
    setShowGuide(false);
    AsyncStorage.setItem("war-of-nations.strategic-guide.v1", "seen").catch(() => undefined);
  }, []);

  const selected = state.territories.find((territory) => territory.id === selectedId) ?? null;
  const selectedSource = selected?.owner === "player" ? selected : null;
  const validTargetIds = selectedSource?.neighbours ?? [];
  const objectiveSource = state.territories.find((territory) => territory.owner === "player" && territory.neighbours.some((id) => state.territories.find((candidate) => candidate.id === id)?.owner !== "player"));
  const objectiveTarget = objectiveSource?.neighbours.map((id) => state.territories.find((territory) => territory.id === id)).find((territory) => territory?.owner !== "player") ?? null;

  const lines = useMemo(() => {
    const seen = new Set<string>();
    return state.territories.flatMap((territory) => territory.neighbours.map((neighbourId) => {
      const key = [territory.id, neighbourId].sort().join(":");
      if (seen.has(key)) return null;
      seen.add(key);
      const neighbour = state.territories.find((candidate) => candidate.id === neighbourId);
      const active = territory.id === selectedSource?.id && selectedSource.neighbours.includes(neighbourId);
      return neighbour ? <MapLine key={key} from={territory} to={neighbour} width={mapSize.current.width} height={mapSize.current.height} active={active} /> : null;
    })).filter(Boolean);
  }, [selectedSource, state.territories]);

  const sendTroops = useCallback((sourceId: string, targetId: string) => {
    if (outcome !== "playing") return;
    const source = state.territories.find((territory) => territory.id === sourceId);
    const target = state.territories.find((territory) => territory.id === targetId);
    if (!source || !target || source.owner !== "player" || !source.neighbours.includes(targetId)) {
      haptic.error();
      setNotice("اختر منطقة خضراء ومنطقة متصلة بها فقط.");
      return;
    }
    haptic.medium();
    update((current) => createTroopGroup(current, sourceId, targetId, 0.5));
    setNotice(`تم إرسال نصف قوات ${source.name} نحو ${target.name}. تابع الدائرة الذهبية أثناء الحركة.`);
    setSelectedId(null);
  }, [outcome, state.territories, update]);

  const finishDrag = useCallback((x: number, y: number) => {
    if (!dragSource) return;
    const target = state.territories.reduce<{ territory: StrategicTerritory | null; distance: number }>((best, territory) => {
      const tx = territory.position.x * mapSize.current.width / 100;
      const ty = territory.position.y * mapSize.current.height / 100;
      const distance = Math.hypot(tx - x, ty - y);
      return distance < best.distance ? { territory, distance } : best;
    }, { territory: null, distance: 70 }).territory;
    if (target) {
      const source = state.territories.find((territory) => territory.id === dragSource);
      if (source?.neighbours.includes(target.id)) {
        sendTroops(dragSource, target.id);
      } else {
        haptic.error();
        setNotice("هذه المنطقة ليست متصلة بالمصدر. اتبع الخطوط الذهبية فقط.");
      }
    } else {
      setNotice("حرّك الإصبع حتى يصل إلى دائرة منطقة متصلة.");
    }
    setDragSource(null);
    setDragPoint(null);
  }, [dragSource, sendTroops, state.territories]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      const source = state.territories.reduce<{ territory: StrategicTerritory | null; distance: number }>((best, territory) => {
        const x = territory.position.x * mapSize.current.width / 100;
        const y = territory.position.y * mapSize.current.height / 100;
        const distance = Math.hypot(x - locationX, y - locationY);
        return distance < best.distance ? { territory, distance } : best;
      }, { territory: null, distance: 62 }).territory;
      if (source?.owner === "player") {
        haptic.light();
        setDragSource(source.id);
        setSelectedId(source.id);
        setDragPoint({ x: locationX, y: locationY });
        setNotice("ممتاز. اسحب الآن إلى منطقة متصلة ومضيئة، أو اخترها بلمسة واحدة.");
      } else {
        setNotice("ابدأ دائماً من منطقة خضراء؛ فهي مناطقك القابلة للتحكم.");
      }
    },
    onPanResponderMove: (event) => {
      if (dragSource) setDragPoint({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
    },
    onPanResponderRelease: (event) => finishDrag(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderTerminate: () => { setDragSource(null); setDragPoint(null); },
  }), [dragSource, finishDrag, state.territories]);

  if (!ready) return <View style={styles.loading}><Text style={styles.loadingText}>يتم تجهيز الحملة...</Text></View>;
  const activeCombats = state.combats.length;
  const movingGroups = state.groups.length;
  const objectiveText = getObjectiveText(level, state);
  const bestStars = progress.bestStars[level.id] ?? 0;

  const openLevel = (levelId: string) => {
    const target = LEVELS.find((candidate) => candidate.id === levelId);
    if (!target || !isLevelUnlocked(target, progress)) return;
    haptic.medium();
    selectLevel(levelId);
    setSelectedId(null);
    setShowLevels(false);
    setNotice(`بدأ المستوى ${target.number}: ${target.briefing}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>المسرح الاستراتيجي</Text><Text style={styles.title}>خريطة التوسع الحي</Text></View>
        <Pressable accessibilityRole="button" onPress={() => setShowLevels((visible) => !visible)} style={({ pressed }) => [styles.levelButton, pressed && styles.pressed]}><Text style={styles.levelButtonText}>مستوى {level.number} · {level.difficulty}</Text></Pressable>
      </View>
      {showLevels ? <View style={styles.levelPanel}><View style={styles.levelPanelHeader}><View><Text style={styles.levelPanelTitle}>مسار الحملة</Text><Text style={styles.levelPanelCopy}>افتح المستوى التالي بالفوز في المهمة الحالية.</Text></View><Text style={styles.levelProgressText}>{progress.unlockedThrough}/{LEVELS.length}</Text></View>{LEVELS.map((candidate) => { const unlocked = isLevelUnlocked(candidate, progress); const stars = progress.bestStars[candidate.id] ?? 0; const active = candidate.id === level.id; return <Pressable key={candidate.id} disabled={!unlocked} onPress={() => openLevel(candidate.id)} style={({ pressed }) => [styles.levelCard, active && styles.levelCardActive, !unlocked && styles.levelCardLocked, pressed && unlocked && styles.pressed]}><View style={styles.levelNumber}><Text style={styles.levelNumberText}>{unlocked ? candidate.number : "🔒"}</Text></View><View style={styles.levelCardBody}><Text style={styles.levelCardTitle}>{candidate.title}</Text><Text style={styles.levelCardCopy}>{candidate.difficulty} · {candidate.reward} مكافأة</Text></View><Text style={styles.levelStars}>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</Text></Pressable>; })}</View> : null}
      {showGuide ? <View style={styles.guideCard}><View style={styles.guideHeader}><Text style={styles.guideTitle}>كيف تلعب؟</Text><Pressable onPress={dismissGuide}><Text style={styles.guideDismiss}>فهمت</Text></Pressable></View><Text style={styles.guideCopy}>1. اختر منطقة خضراء.  2. اتبع الخط الذهبي إلى منطقة متصلة.  3. اسحب إليها أو استخدم زر الإرسال. القوات والإنتاج يعملان تلقائياً.</Text></View> : null}
      <View style={styles.missionCard}><Text style={styles.missionEyebrow}>المستوى {level.number} · {level.title}</Text><Text style={styles.missionTitle}>{objectiveText}</Text><Text style={styles.missionBrief}>{level.briefing}</Text><Pressable onPress={() => { if (objectiveSource) { setSelectedId(objectiveSource.id); setNotice(`اختر ${objectiveTarget?.name ?? "منطقة متصلة"} لإرسال القوات.`); } }} style={({ pressed }) => [styles.missionButton, pressed && styles.pressed]}><Text style={styles.missionButtonText}>إظهار الخطوة التالية</Text></Pressable></View>
      <Text style={styles.help}>{notice}</Text>
      <View style={styles.statRow}><Text style={styles.stat}>قوات متحركة {movingGroups}</Text><Text style={styles.stat}>معارك {activeCombats}</Text><Text style={styles.stat}>زمن {Math.floor(state.elapsed)}ث</Text></View>
      <View style={styles.map} onLayout={(event) => { mapSize.current = event.nativeEvent.layout; }} {...(outcome === "playing" ? panResponder.panHandlers : {})}>
        <RegionalBackdrop territories={state.territories} />
        <View pointerEvents="none" style={styles.mapTexture} />
        {lines}
        {dragPoint && dragSource ? <View pointerEvents="none" style={[styles.dragLine, { left: dragPoint.x - 1, top: dragPoint.y - 1 }]} /> : null}
        {state.groups.map((group) => {
          const source = state.territories.find((territory) => territory.id === group.source);
          const target = state.territories.find((territory) => territory.id === group.destination);
          if (!source || !target) return null;
          const x = (source.position.x + (target.position.x - source.position.x) * group.progress) * mapSize.current.width / 100;
          const y = (source.position.y + (target.position.y - source.position.y) * group.progress) * mapSize.current.height / 100;
          return <View key={group.id} pointerEvents="none" style={[styles.troopToken, { left: x - 10, top: y - 10 }]}><Text style={styles.troopTokenText}>{Math.max(1, Math.round(group.count))}</Text></View>;
        })}
        {state.territories.map((territory) => {
          const tone = COLORS[territory.owner];
          const selectedTerritory = selectedId === territory.id;
          const isValidTarget = validTargetIds.includes(territory.id) && territory.id !== selectedSource?.id;
          return <Pressable key={territory.id} accessibilityRole="button" accessibilityLabel={`${territory.name}، ${Math.floor(territory.troops)} قوات، ${COLORS[territory.owner].label}`} onPress={() => { if (isValidTarget && selectedSource) { sendTroops(selectedSource.id, territory.id); return; } setSelectedId(territory.id); setNotice(territory.owner === "player" ? `تم اختيار ${territory.name}. اضغط منطقة متصلة مضيئة أو اسحب إليها.` : "اختر منطقة خضراء أولاً، ثم ستضيء الأهداف المتصلة." ); }} style={[styles.territory, { left: `${territory.position.x}%`, top: `${territory.position.y}%`, backgroundColor: tone.fill, borderColor: selectedTerritory || isValidTarget ? "#E7B34B" : tone.ring }, selectedTerritory && styles.territorySelected, isValidTarget && styles.territoryValidTarget]}><View style={[styles.markerFlag, { borderColor: tone.ring }]}><Text style={[styles.markerText, { color: tone.ring }]}>{tone.marker}</Text></View><Text style={styles.territoryTroops}>{Math.floor(territory.troops)}</Text><Text style={styles.territoryName}>{territory.name}</Text><Text style={[styles.production, { color: tone.ring }]}>+{territory.productionRate.toFixed(1)}/ث</Text></Pressable>;
        })}
      </View>
      <View style={styles.legend}><Text style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.player.ring }]} /> قواتك</Text><Text style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.enemy.ring }]} /> خصم</Text><Text style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.neutral.ring }]} /> محايد</Text></View>
      {outcome !== "playing" ? <View style={[styles.outcomePanel, outcome === "victory" ? styles.outcomeVictory : styles.outcomeDefeat]}><Text style={styles.outcomeSymbol}>{outcome === "victory" ? "✦" : "!"}</Text><Text style={styles.outcomeTitle}>{outcome === "victory" ? "اكتمل المستوى" : "انتهت المهمة"}</Text><Text style={styles.outcomeCopy}>{outcome === "victory" ? `حصلت على ${bestStars || 1} نجوم وفتحت تحدياً جديداً.` : "استعد ترتيب قواتك ثم حاول من جديد."}</Text><View style={styles.outcomeActions}>{outcome === "victory" && level.number < LEVELS.length ? <Pressable onPress={nextLevel} style={({ pressed }) => [styles.outcomePrimary, pressed && styles.pressed]}><Text style={styles.outcomePrimaryText}>المستوى التالي</Text></Pressable> : null}<Pressable onPress={retryLevel} style={({ pressed }) => [styles.outcomeSecondary, pressed && styles.pressed]}><Text style={styles.outcomeSecondaryText}>{outcome === "victory" ? "إعادة المستوى" : "حاول مجدداً"}</Text></Pressable></View></View> : null}
      {selected ? <View style={styles.detailCard}><View style={styles.detailText}><Text style={styles.detailTitle}>{selected.name}</Text><Text style={styles.detailCopy}>{COLORS[selected.owner].label} · {Math.floor(selected.troops)} / {selected.maxTroops} قوات</Text>{selectedSource ? <Text style={styles.detailAction}>اختر هدفاً متصلاً أدناه لإرسال 50% من القوات.</Text> : null}</View><View style={styles.detailSide}><Text style={styles.detailValue}>+{selected.productionRate.toFixed(1)} / ث</Text>{selectedSource && validTargetIds.length > 0 ? <View style={styles.quickTargets}>{validTargetIds.map((targetId) => { const target = state.territories.find((territory) => territory.id === targetId); return target ? <Pressable key={target.id} onPress={() => sendTroops(selectedSource.id, target.id)} style={({ pressed }) => [styles.quickTarget, pressed && styles.pressed]}><Text style={styles.quickTargetText}>إرسال إلى {target.name}</Text></Pressable> : null; })}</View> : null}</View></View> : null}
      <Pressable onPress={reset} style={({ pressed }) => [styles.reset, pressed && { opacity: 0.7 }]}><Text style={styles.resetText}>إعادة حملة الخريطة</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  eyebrow: { color: "#83A66C", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, lineHeight: 15 },
  title: { color: "#F7F2E4", fontSize: 22, fontWeight: "900", lineHeight: 29 },
  levelButton: { borderRadius: 99, backgroundColor: "#193B54", borderWidth: 1, borderColor: "#4D7188", paddingHorizontal: 10, paddingVertical: 7, marginBottom: 2 },
  levelButtonText: { color: "#E7B34B", fontSize: 10, fontWeight: "900" },
  levelPanel: { backgroundColor: "#132A43", borderRadius: 18, borderWidth: 1, borderColor: "#42637A", padding: 12, gap: 8 },
  levelPanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 3 },
  levelPanelTitle: { color: "#F7F2E4", fontSize: 15, fontWeight: "900", textAlign: "right" },
  levelPanelCopy: { color: "#B7C2CE", fontSize: 10, lineHeight: 15, textAlign: "right", marginTop: 2 },
  levelProgressText: { color: "#E7B34B", fontSize: 12, fontWeight: "900" },
  levelCard: { flexDirection: "row", gap: 9, alignItems: "center", borderRadius: 13, padding: 9, backgroundColor: "#1A3851", borderWidth: 1, borderColor: "#33516C" },
  levelCardActive: { borderColor: "#E7B34B", backgroundColor: "#29465D" },
  levelCardLocked: { opacity: 0.45 },
  levelNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1F35" },
  levelNumberText: { color: "#E7B34B", fontSize: 11, fontWeight: "900" },
  levelCardBody: { flex: 1 },
  levelCardTitle: { color: "#F7F2E4", fontSize: 13, fontWeight: "900", textAlign: "right" },
  levelCardCopy: { color: "#B7C2CE", fontSize: 10, lineHeight: 15, textAlign: "right" },
  levelStars: { color: "#E7B34B", fontSize: 13, letterSpacing: 1 },
  guideCard: { backgroundColor: "#193B54", borderRadius: 17, borderWidth: 1, borderColor: "#4D7188", padding: 14, gap: 7 },
  guideHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  guideTitle: { color: "#F7F2E4", fontSize: 14, fontWeight: "900" },
  guideDismiss: { color: "#E7B34B", fontSize: 12, fontWeight: "800", padding: 3 },
  guideCopy: { color: "#DDE5E9", fontSize: 12, lineHeight: 20, textAlign: "right" },
  missionCard: { backgroundColor: "#315842", borderRadius: 17, padding: 15, borderWidth: 1, borderColor: "#83A66C", gap: 5 },
  missionEyebrow: { color: "#D2E8C6", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  missionTitle: { color: "#F7F2E4", fontSize: 16, lineHeight: 22, fontWeight: "900", textAlign: "right" },
  missionBrief: { color: "#DDE5E9", fontSize: 11, lineHeight: 17, textAlign: "right" },
  missionButton: { alignSelf: "flex-end", backgroundColor: "#E7B34B", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, marginTop: 3 },
  missionButtonText: { color: "#0B1F35", fontSize: 11, fontWeight: "900" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, borderWidth: 1, borderColor: "#3D6A51", backgroundColor: "#173A32", paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#A7C897" },
  liveText: { color: "#A7C897", fontSize: 10, fontWeight: "800" },
  help: { color: "#B7C2CE", fontSize: 12, lineHeight: 19, textAlign: "right" },
  statRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#132A43", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: "#2D4C67" },
  stat: { color: "#DDE5E9", fontSize: 10, fontWeight: "800" },
  map: { height: 445, borderRadius: 24, backgroundColor: "#11263A", borderWidth: 1, borderColor: "#3A5A72", overflow: "hidden", position: "relative" },
  regionalBackdrop: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  mapTexture: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0A1929", opacity: 0.16 },
  mapLine: { position: "absolute", height: 2, backgroundColor: "#BBC8CB", opacity: 0.78, transformOrigin: "left center", zIndex: 2 },
  mapLineActive: { height: 3, backgroundColor: "#E7B34B", shadowColor: "#E7B34B", shadowOpacity: 0.75, shadowRadius: 5 },
  dragLine: { position: "absolute", width: 3, height: 3, backgroundColor: "#E7B34B", borderRadius: 2 },
  territory: { position: "absolute", width: 82, minHeight: 76, marginLeft: -41, marginTop: -38, borderRadius: 17, borderWidth: 2, paddingVertical: 6, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 7, elevation: 4, zIndex: 4 },
  territorySelected: { transform: [{ scale: 1.08 }], shadowColor: "#E7B34B", shadowOpacity: 0.55, shadowRadius: 10 },
  territoryValidTarget: { transform: [{ scale: 1.06 }], shadowColor: "#E7B34B", shadowOpacity: 0.8, shadowRadius: 11, elevation: 6 },
  markerFlag: { position: "absolute", top: -7, right: 5, minWidth: 18, height: 16, borderRadius: 4, borderWidth: 1, backgroundColor: "#10273C", alignItems: "center", justifyContent: "center" },
  markerText: { fontSize: 9, fontWeight: "900", lineHeight: 12 },
  territoryTroops: { color: "#F7F2E4", fontSize: 21, fontWeight: "900", lineHeight: 24 },
  territoryName: { color: "#F7F2E4", fontSize: 9, fontWeight: "800", lineHeight: 13 },
  production: { fontSize: 8, fontWeight: "800", lineHeight: 11 },
  troopToken: { position: "absolute", minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#E7B34B", borderWidth: 2, borderColor: "#F7F2E4", alignItems: "center", justifyContent: "center", zIndex: 6 },
  troopTokenText: { color: "#0B1F35", fontSize: 8, fontWeight: "900" },
  legend: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 5 },
  legendItem: { color: "#B7C2CE", fontSize: 10, fontWeight: "700" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 3 },
  outcomePanel: { borderRadius: 19, padding: 17, alignItems: "center", gap: 7, borderWidth: 1 },
  outcomeVictory: { backgroundColor: "#315842", borderColor: "#83A66C" },
  outcomeDefeat: { backgroundColor: "#5A3540", borderColor: "#D66565" },
  outcomeSymbol: { color: "#F7F2E4", fontSize: 29, fontWeight: "900", lineHeight: 33 },
  outcomeTitle: { color: "#F7F2E4", fontSize: 21, fontWeight: "900" },
  outcomeCopy: { color: "#E8ECE7", fontSize: 12, lineHeight: 19, textAlign: "center" },
  outcomeActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  outcomePrimary: { backgroundColor: "#E7B34B", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  outcomePrimaryText: { color: "#0B1F35", fontSize: 11, fontWeight: "900" },
  outcomeSecondary: { backgroundColor: "#193B54", borderRadius: 10, borderWidth: 1, borderColor: "#7890A0", paddingHorizontal: 13, paddingVertical: 9 },
  outcomeSecondaryText: { color: "#F7F2E4", fontSize: 11, fontWeight: "900" },
  detailCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 15, borderRadius: 17, backgroundColor: "#172F49", borderWidth: 1, borderColor: "#41637A" },
  detailText: { flex: 1, paddingRight: 10 },
  detailSide: { alignItems: "flex-end", gap: 7, maxWidth: "53%" },
  detailTitle: { color: "#F7F2E4", fontSize: 16, fontWeight: "900", textAlign: "right" },
  detailCopy: { color: "#B7C2CE", fontSize: 11, lineHeight: 17, textAlign: "right" },
  detailAction: { color: "#E7B34B", fontSize: 10, lineHeight: 15, textAlign: "right", marginTop: 4, fontWeight: "800" },
  detailValue: { color: "#E7B34B", fontSize: 13, fontWeight: "900" },
  quickTargets: { gap: 5, alignItems: "flex-end" },
  quickTarget: { backgroundColor: "#E7B34B", borderRadius: 9, paddingVertical: 6, paddingHorizontal: 8 },
  quickTargetText: { color: "#0B1F35", fontSize: 10, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  reset: { alignSelf: "center", paddingVertical: 3 },
  resetText: { color: "#8CA1B1", fontSize: 11, textDecorationLine: "underline" },
  loading: { minHeight: 260, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#B7C2CE", fontSize: 13 },
});
