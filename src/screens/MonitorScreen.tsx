import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, MONO } from '../theme';
import { Device, useStore } from '../store';
import { Btn, Grid } from '../ui';
import { useNow } from '../util';

function Age({ lastOk }: { lastOk?: number }) {
  const now = useNow();
  if (!lastOk) return null;
  const age = Math.max(0, Math.round((now.getTime() - lastOk) / 1000));
  return <Text style={[st.age, { color: age < 30 ? '#4a7a5a' : '#aa3333' }]}>{age}s</Text>;
}

function Tag({ text, color }: { text: string; color: string }) {
  return <Text style={[st.tag, { color, backgroundColor: color + '22' }]}>{text}</Text>;
}

function SensorTile({ d }: { d: Device }) {
  const r = d.reading;
  const lid = r?.lid ?? '—';
  const shut = lid === 'close' || lid === 'closed';
  const logging = r?.log === 'log';
  return (
    <View style={st.sensor}>
      <View style={st.row}>
        <Text style={{ color: C.green, fontSize: 11 }}>● </Text>
        <Text style={st.devId}>{d.id}</Text>
        <View style={{ flex: 1 }} />
        <Age lastOk={d.lastOk} />
      </View>
      <Text style={st.uid}>{d.uid || 'UID: —'}</Text>
      <Text style={st.ip}>{d.ip}</Text>
      <View style={[st.row, { marginTop: 4 }]}>
        {(
          [
            [r ? r.co2.toFixed(0) : '—', 'CO₂ ppm', '#4488cc'],
            [r ? r.temp.toFixed(1) : '—', 'TEMP °C', '#cc6644'],
            [r ? r.humid.toFixed(0) : '—', 'RH %', '#44aa77'],
          ] as const
        ).map(([val, unit, color]) => (
          <View key={unit} style={{ flex: 1 }}>
            <Text style={[st.val, { color }]} numberOfLines={1} adjustsFontSizeToFit>
              {val}
            </Text>
            <Text style={[st.unit, { color: color + '99' }]}>{unit}</Text>
          </View>
        ))}
      </View>
      <View style={[st.row, { flexWrap: 'wrap', gap: 4, marginTop: 6 }]}>
        <Tag
          text={lid === 'open' ? '▲ OPEN' : shut ? '▼ CLOSED' : `LID: ${lid}`}
          color={lid === 'open' ? C.greenDim : shut ? '#cc6644' : '#666688'}
        />
        <Tag text={logging ? '● LOGGING' : '■ LOG OFF'} color={logging ? C.green : '#888899'} />
        {r && r.cycle > 0 ? <Tag text={`CYCLE ${r.cycle}`} color="#aaaacc" /> : null}
      </View>
    </View>
  );
}

function OfflineChip({ d }: { d: Device }) {
  const badge = d.status === 'scanning' ? 'SCANNING' : d.status === 'offline' ? 'OFFLINE' : 'WAITING';
  const color = d.status === 'scanning' ? '#5a7888' : d.status === 'offline' ? '#aa4444' : '#5a5f7a';
  return (
    <View style={[st.chip, d.status === 'offline' && { borderColor: '#3a1a1a', backgroundColor: '#0d0909' }]}>
      <View style={st.row}>
        <Text style={st.devId}>{d.id}</Text>
        <View style={{ flex: 1 }} />
        <Tag text={badge} color={color} />
      </View>
      <Text style={[st.uid, { fontSize: 12, color: d.uid ? '#3a7a5a' : C.faint }]}>{d.uid || 'UID: —'}</Text>
      <Text style={st.ip}>{d.ip}</Text>
    </View>
  );
}

export default function MonitorScreen() {
  const { devices, scan, scanning } = useStore();
  const online = devices.filter((d) => d.status === 'online');
  const rest = devices.filter((d) => d.status !== 'online');

  return (
    <ScrollView contentContainerStyle={st.page}>
      <View style={st.banner}>
        <View style={{ flex: 1, minWidth: 150, gap: 2 }}>
          <Text style={[st.count, { color: C.green }]}>ONLINE: {online.length}</Text>
          <Text style={[st.count, { color: C.dim }]}>
            OFFLINE: {rest.length}   TOTAL: {devices.length}
          </Text>
        </View>
        {scanning && <ActivityIndicator color={C.accent} />}
        <Btn label={scanning ? '⏳  SCANNING...' : '🔍  SCAN ALL'} onPress={scan} disabled={scanning} />
      </View>

      {online.length > 0 && (
        <>
          <Text style={[st.header, { color: C.green }]}>LIVE SENSOR READINGS</Text>
          <Grid items={online} minWidth={160} keyOf={(d) => d.ip} render={(d) => <SensorTile d={d} />} />
        </>
      )}

      {rest.length > 0 && (
        <>
          <Text style={[st.header, { color: '#aa5555' }]}>
            {online.length === 0 && !scanning && rest.every((d) => d.status === 'waiting')
              ? 'NOT SCANNED YET — TAP SCAN ALL'
              : 'OFFLINE / NOT RESPONDING'}
          </Text>
          <Grid items={rest} minWidth={150} keyOf={(d) => d.ip} render={(d) => <OfflineChip d={d} />} />
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 12, gap: 8, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0d1f1c',
    borderWidth: 2,
    borderColor: '#00d4aa44',
    borderRadius: 8,
    padding: 12,
  },
  count: { fontFamily: MONO, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  header: { fontFamily: MONO, fontSize: 12, fontWeight: '700', letterSpacing: 2, paddingTop: 8 },
  sensor: {
    backgroundColor: '#0a1410',
    borderWidth: 2,
    borderColor: C.greenDim,
    borderRadius: 8,
    padding: 10,
  },
  chip: {
    backgroundColor: '#0c0e15',
    borderWidth: 1,
    borderColor: '#232738',
    borderRadius: 6,
    padding: 9,
    gap: 2,
  },
  devId: { color: C.dim, fontFamily: MONO, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  uid: { color: C.accent, fontFamily: MONO, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  ip: { color: '#4a7a6a', fontFamily: MONO, fontSize: 11 },
  age: { fontFamily: MONO, fontSize: 10 },
  val: { fontFamily: MONO, fontSize: 19, fontWeight: '700' },
  unit: { fontFamily: MONO, fontSize: 9, letterSpacing: 0.5 },
  tag: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
});
