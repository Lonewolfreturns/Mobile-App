import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { C, MONO } from '../theme';
import { Device, useStore } from '../store';
import { Btn, Grid, Help, Panel, ProgressBar, PulseDot, Sparkline, T, Tag } from '../ui';
import { tap } from '../haptics';
import { useNow } from '../util';

function Age({ lastOk }: { lastOk?: number }) {
  const now = useNow();
  if (!lastOk) return null;
  const age = Math.max(0, Math.round((now.getTime() - lastOk) / 1000));
  return <T style={[st.age, { color: age < 30 ? C.greenDim : C.redDim }]}>{age}s</T>;
}

function SensorTile({ d, onPress }: { d: Device; onPress: () => void }) {
  const r = d.reading;
  const lid = r?.lid ?? '—';
  const shut = lid === 'close' || lid === 'closed';
  const logging = r?.log === 'log';
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${d.id}, CO2 ${r ? r.co2.toFixed(0) : 'unknown'} parts per million. Open details.`}
      style={({ pressed }) => [st.sensor, pressed && st.sensorPressed]}
    >
      <View style={st.row}>
        <PulseDot />
        <T style={[st.devId, { marginLeft: 6 }]}>{d.id}</T>
        <View style={{ flex: 1 }} />
        <Age lastOk={d.lastOk} />
      </View>
      <T style={st.uid}>{d.uid || 'UID: —'}</T>
      <T style={st.ip}>{d.ip}</T>
      <View style={[st.row, { marginTop: 6 }]}>
        {(
          [
            [r ? r.co2.toFixed(0) : '—', 'CO₂ ppm', C.co2],
            [r ? r.temp.toFixed(1) : '—', 'TEMP °C', C.temp],
            [r ? r.humid.toFixed(0) : '—', 'RH %', C.humid],
          ] as const
        ).map(([val, unit, color]) => (
          <View key={unit} style={{ flex: 1 }}>
            <T style={[st.val, { color }]} numberOfLines={1} adjustsFontSizeToFit>
              {val}
            </T>
            <T style={[st.unit, { color: color + 'aa' }]}>{unit}</T>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 8 }}>
        <Sparkline data={d.trend} height={18} />
      </View>
      <View style={[st.row, { flexWrap: 'wrap', gap: 4, marginTop: 8 }]}>
        <Tag
          text={lid === 'open' ? '▲ OPEN' : shut ? '▼ CLOSED' : `LID: ${lid}`}
          color={lid === 'open' ? C.greenDim : shut ? C.temp : C.faint}
        />
        <Tag text={logging ? '● LOGGING' : '■ LOG OFF'} color={logging ? C.green : C.dim} />
        {r && r.cycle > 0 ? <Tag text={`CYCLE ${r.cycle}`} color={C.soft} /> : null}
      </View>
    </Pressable>
  );
}

function OfflineChip({ d, onPress }: { d: Device; onPress: () => void }) {
  const off = d.status === 'offline';
  const badge = d.status === 'scanning' ? 'CHECKING' : off ? 'OFFLINE' : 'WAITING';
  const color = d.status === 'scanning' ? C.blue : off ? C.redDim : C.faint;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={d.status === 'scanning'}
      accessibilityRole="button"
      accessibilityLabel={`${d.id} ${badge.toLowerCase()}. Check again.`}
      style={({ pressed }) => [st.chip, off && st.chipOff, pressed && { opacity: 0.6 }]}
    >
      <View style={st.row}>
        <T style={st.devId}>{d.id}</T>
        <View style={{ flex: 1 }} />
        <Tag text={badge} color={color} />
      </View>
      <T style={[st.uid, { fontSize: 12, color: d.uid ? C.greenDim : C.faint }]}>{d.uid || 'UID: —'}</T>
      <View style={st.row}>
        <T style={[st.ip, { flex: 1 }]}>{d.ip}</T>
        {d.status !== 'scanning' && <T style={st.retry}>↻ CHECK</T>}
      </View>
    </Pressable>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T style={[st.statN, { color }]}>{n}</T>
      <T style={st.statLabel}>{label}</T>
    </View>
  );
}

export default function MonitorScreen() {
  const { devices, scan, scanning, progress, settings, select, retry, setDemo } = useStore();
  const online = devices.filter((d) => d.status === 'online');
  const rest = devices.filter((d) => d.status !== 'online');
  const untouched = !scanning && devices.every((d) => d.status === 'waiting');

  return (
    <ScrollView
      contentContainerStyle={st.page}
      refreshControl={
        <RefreshControl refreshing={scanning} onRefresh={scan} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.panel} />
      }
    >
      <Panel>
        <View style={st.row}>
          <Stat n={online.length} label="ONLINE" color={C.green} />
          <View style={st.divider} />
          <Stat
            n={rest.length}
            label={untouched ? 'NOT SCANNED' : 'NOT ANSWERING'}
            color={rest.length && !untouched ? C.redDim : C.faint}
          />
          <View style={st.divider} />
          <Stat n={devices.length} label="TOTAL" color={C.soft} />
        </View>
        {scanning && progress ? (
          <>
            <ProgressBar value={progress.done / Math.max(1, progress.total)} />
            <Help>
              {progress.label} — {progress.done} of {progress.total} checked
            </Help>
          </>
        ) : (
          <ProgressBar value={devices.length ? online.length / devices.length : 0} color={C.green} />
        )}
        <Btn label={scanning ? '⏳  SCANNING...' : '🔍  SCAN ALL'} onPress={scan} disabled={scanning} />
      </Panel>

      {untouched && (
        <Panel title="GETTING STARTED">
          <Help>
            {'1.  Join this phone or tablet to the same WiFi as the chambers.\n' +
              '2.  Tap SCAN ALL (or pull down) to find them.\n' +
              '3.  Tap any chamber to see its trend and control it on its own.'}
          </Help>
          {!settings.demoMode && (
            <>
              <Help>No chambers nearby? Demo mode shows simulated ones so you can look around.</Help>
              <Btn kind="secondary" label="TRY DEMO MODE" onPress={() => setDemo(true)} />
            </>
          )}
        </Panel>
      )}

      {online.length > 0 && (
        <>
          <T style={[st.header, { color: C.green }]}>LIVE READINGS  ·  TAP A CHAMBER FOR MORE</T>
          <Grid items={online} minWidth={160} keyOf={(d) => d.ip} render={(d) => <SensorTile d={d} onPress={() => select(d.ip)} />} />
        </>
      )}

      {rest.length > 0 && !untouched && (
        <>
          <T style={[st.header, { color: C.redDim }]}>NOT ANSWERING  ·  TAP TO CHECK AGAIN</T>
          <Grid items={rest} minWidth={150} keyOf={(d) => d.ip} render={(d) => <OfflineChip d={d} onPress={() => retry(d.ip)} />} />
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 12, gap: 10, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: C.border },
  statN: { fontFamily: MONO, fontSize: 30, fontWeight: '700' },
  statLabel: { color: C.dim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' },
  header: { fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingTop: 6 },
  sensor: {
    backgroundColor: '#0c1a26',
    borderWidth: 1.5,
    borderColor: '#2fae6688',
    borderRadius: 14,
    padding: 11,
  },
  sensorPressed: { backgroundColor: '#12283a', borderColor: C.green },
  chip: {
    backgroundColor: C.sunk,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    gap: 3,
    minHeight: 76,
  },
  chipOff: { borderColor: '#5a2428', backgroundColor: '#140b10' },
  devId: { color: C.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  uid: { color: C.accent, fontFamily: MONO, fontSize: 14, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },
  ip: { color: C.faint, fontFamily: MONO, fontSize: 11 },
  retry: { color: C.blue, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  age: { fontFamily: MONO, fontSize: 10 },
  val: { fontFamily: MONO, fontSize: 20, fontWeight: '700' },
  unit: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
});
