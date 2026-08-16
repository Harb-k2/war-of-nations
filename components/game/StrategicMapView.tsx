import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";

import { haptic } from "@/lib/haptics";
import { createTroopGroup, type StrategicTerritory } from "@/lib/game/strategic-engine";
import { useStrategicGame } from "@/hooks/use-strategic-game";

const COLORS = {
  player: { fill: "#315842", ring: "#A7C897", label: "قواتك" },
  enemy: { fill: "#663A42", ring: "#E88A84", label: "خصم" },
  neutral: { fill: "#56513F", ring: "#D8CB9B", label: "محايد" },
};

function MapLine({ from, to, width, height }: { from: StrategicTerritory; to: StrategicTerritory; width: number; height: number }) {
  const x1 = from.position.x * width / 100;
  const y1 = from.position.y * height / 100;
  const x2 = to.position.x * width / 100;
  const y2 = to.position.y * height / 100;
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const angle = `${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}deg`;
  return <View pointerEvents="none" style={[styles.mapLine, { left: x1, top: y1, width: length, transform: [{ rotate: angle }] }]} />;
}

export function StrategicMapView() {
  const { state, update, ready, reset } = useStrategicGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const mapSize = useRef({ width: 1, height: 1 });

  const lines = useMemo(() => {
    const seen = new Set<string>();
    return state.territories.flatMap((territory) => territory.neighbours.map((neighbourId) => {
      const key = [territory.id, neighbourId].sort().join(":");
      if (seen.has(key)) return null;
      seen.add(key);
      const neighbour = state.territories.find((candidate) => candidate.id === neighbourId);
      return neighbour ? <MapLine key={key} from={territory} to={neighbour} width={mapSize.current.width} height={mapSize.current.height} /> : null;
    })).filter(Boolean);
  }, [state.territories]);

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
        haptic.medium();
        update((current) => createTroopGroup(current, dragSource, target.id, 0.5));
      } else {
        haptic.error();
      }
    }
    setDragSource(null);
    setDragPoint(null);
  }, [dragSource, state.territories, update]);

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
      }
    },
    onPanResponderMove: (event) => {
      if (dragSource) setDragPoint({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
    },
    onPanResponderRelease: (event) => finishDrag(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderTerminate: () => { setDragSource(null); setDragPoint(null); },
  }), [dragSource, finishDrag, state.territories]);

  if (!ready) return <View style={styles.loading}><Text style={styles.loadingText}>يتم تجهيز الخريطة الحية...</Text></View>;
  const selected = state.territories.find((territory) => territory.id === selectedId) ?? null;
  const activeCombats = state.combats.length;
  const movingGroups = state.groups.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>المسرح الاستراتيجي</Text><Text style={styles.title}>خريطة التوسع الحي</Text></View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>زمن حي</Text></View>
      </View>
      <Text style={styles.help}>اسحب من منطقة خضراء إلى منطقة متصلة لإرسال نصف قواتها. الإنتاج والقتال يستمران تلقائياً.</Text>
      <View style={styles.statRow}><Text style={styles.stat}>قوات متحركة {movingGroups}</Text><Text style={styles.stat}>معارك {activeCombats}</Text><Text style={styles.stat}>زمن {Math.floor(state.elapsed)}ث</Text></View>
      <View style={styles.map} onLayout={(event) => { mapSize.current = event.nativeEvent.layout; }} {...panResponder.panHandlers}>
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
          return <Pressable key={territory.id} onPress={() => setSelectedId(territory.id)} style={[styles.territory, { left: `${territory.position.x}%`, top: `${territory.position.y}%`, backgroundColor: tone.fill, borderColor: selectedTerritory ? "#E7B34B" : tone.ring }, selectedTerritory && styles.territorySelected]}><Text style={styles.territoryTroops}>{Math.floor(territory.troops)}</Text><Text style={styles.territoryName}>{territory.name}</Text><Text style={[styles.production, { color: tone.ring }]}>+{territory.productionRate.toFixed(1)}/ث</Text></Pressable>;
        })}
      </View>
      <View style={styles.legend}><Text style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.player.ring }]} /> قواتك</Text><Text style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.enemy.ring }]} /> خصم</Text><Text style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.neutral.ring }]} /> محايد</Text></View>
      {selected ? <View style={styles.detailCard}><View><Text style={styles.detailTitle}>{selected.name}</Text><Text style={styles.detailCopy}>{COLORS[selected.owner].label} · {Math.floor(selected.troops)} / {selected.maxTroops} قوات</Text></View><Text style={styles.detailValue}>+{selected.productionRate.toFixed(1)} / ث</Text></View> : null}
      <Pressable onPress={reset} style={({ pressed }) => [styles.reset, pressed && { opacity: 0.7 }]}><Text style={styles.resetText}>إعادة حملة الخريطة</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  eyebrow: { color: "#83A66C", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, lineHeight: 15 },
  title: { color: "#F7F2E4", fontSize: 22, fontWeight: "900", lineHeight: 29 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, borderWidth: 1, borderColor: "#3D6A51", backgroundColor: "#173A32", paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#A7C897" },
  liveText: { color: "#A7C897", fontSize: 10, fontWeight: "800" },
  help: { color: "#B7C2CE", fontSize: 12, lineHeight: 19, textAlign: "right" },
  statRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#132A43", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: "#2D4C67" },
  stat: { color: "#DDE5E9", fontSize: 10, fontWeight: "800" },
  map: { height: 445, borderRadius: 24, backgroundColor: "#10273C", borderWidth: 1, borderColor: "#3A5A72", overflow: "hidden", position: "relative" },
  mapLine: { position: "absolute", height: 2, backgroundColor: "#49657A", transformOrigin: "left center" },
  dragLine: { position: "absolute", width: 3, height: 3, backgroundColor: "#E7B34B", borderRadius: 2 },
  territory: { position: "absolute", width: 78, minHeight: 64, marginLeft: -39, marginTop: -32, borderRadius: 17, borderWidth: 2, paddingVertical: 7, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  territorySelected: { transform: [{ scale: 1.08 }], shadowColor: "#E7B34B", shadowOpacity: 0.55, shadowRadius: 10 },
  territoryTroops: { color: "#F7F2E4", fontSize: 20, fontWeight: "900", lineHeight: 22 },
  territoryName: { color: "#F7F2E4", fontSize: 9, fontWeight: "800", lineHeight: 13 },
  production: { fontSize: 8, fontWeight: "800", lineHeight: 11 },
  troopToken: { position: "absolute", minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#E7B34B", borderWidth: 2, borderColor: "#F7F2E4", alignItems: "center", justifyContent: "center", zIndex: 6 },
  troopTokenText: { color: "#0B1F35", fontSize: 8, fontWeight: "900" },
  legend: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 5 },
  legendItem: { color: "#B7C2CE", fontSize: 10, fontWeight: "700" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 3 },
  detailCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 15, borderRadius: 17, backgroundColor: "#172F49", borderWidth: 1, borderColor: "#41637A" },
  detailTitle: { color: "#F7F2E4", fontSize: 16, fontWeight: "900", textAlign: "right" },
  detailCopy: { color: "#B7C2CE", fontSize: 11, lineHeight: 17, textAlign: "right" },
  detailValue: { color: "#E7B34B", fontSize: 13, fontWeight: "900" },
  reset: { alignSelf: "center", paddingVertical: 3 },
  resetText: { color: "#8CA1B1", fontSize: 11, textDecorationLine: "underline" },
  loading: { minHeight: 260, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#B7C2CE", fontSize: 13 },
});
