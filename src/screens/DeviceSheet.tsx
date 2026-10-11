import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { C, MONO } from '../theme';
import { useStore } from '../store';
import { ActionTile, Btn, Help, ProgressBar, Sheet, Sparkline, T, Tag, useConfirm } from '../ui';
import { useNow } from '../util';

function Updated({ lastOk }: { lastOk?: number }) {
  const now = useNow();
  if (!lastOk) return null;
  const age = Math.max(0, Math.round((now.getTime() - lastOk) / 1000));
  return <Tag text={age < 2 ? 'UPDATED JUST NOW' : `UPDATED ${age}s AGO`} color={age < 30 ? C.greenDim : C.redDim} />;
}

/** Everything about one chamber, with commands that go to that chamber only. */
export default function DeviceSheet() {
  const store = useStore();
  const confirm = useConfirm();
  const { selectedIp, select, busy, progress } = store;
  const d = store.devices.find((x) => x.ip === selectedIp);

  // The chamber can drop out of the list (settings changed) while this is open.
  useEffect(() => {
    if (selectedIp && !d) select(null);
  }, [selectedIp, d, select]);
  if (!d) return null;

  const r = d.reading;
  const online = d.status === 'online';
  const lid = r?.lid ?? '—';
  const shut = lid === 'close' || lid === 'closed';
  const logging = r?.log === 'log';
  const lo = d.trend.length ? Math.min(...d.trend) : 0;
  const hi = d.trend.length ? Math.max(...d.trend) : 0;

  const send = async (question: string, run: () => Promise<void>) => {
    if (busy || !online) return;
    const ok = await confirm({
      title: 'CONFIRM ACTION',
      message: `${question}\n\nThis goes to  ${d.id}  (${d.ip})  only.`,
    });
    if (ok) await run();
  };
  const lidCmd = (action: 'open' | 'close') =>
    send(`${action === 'open' ? 'OPEN' : 'CLOSE'} the lid on this chamber?`, () =>
      store.broadcast('/lid', { LidAction: action }, [d.ip]),
    );
  const logCmd = (action: 'start' | 'stop') =>
    send(`${action === 'start' ? 'START' : 'STOP'} recording on this chamber?`, () =>
      store.broadcast('/logging', { LoggingAction: action }, [d.ip]),
    );

  return (
    <Sheet title={d.uid ? `${d.id}  ·  ${d.uid}` : d.id} subtitle={d.ip} onClose={() => select(null)}>
      {!online && (
        <View style={st.offline}>
          <T style={st.offlineText}>⚠  This chamber stopped answering.</T>
          <Btn small kind="secondary" label="TRY AGAIN" onPress={() => store.retry(d.ip)} />
        </View>
      )}

      <View style={st.readings}>
        {(
          [
            [r ? r.co2.toFixed(0) : '—', 'CO₂', 'ppm', C.co2],
            [r ? r.temp.toFixed(1) : '—', 'TEMPERATURE', '°C', C.temp],
            [r ? r.humid.toFixed(0) : '—', 'HUMIDITY', '%', C.humid],
          ] as const
        ).map(([val, name, unit, color]) => (
          <View key={name} style={st.reading}>
            <T style={[st.readingName, { color }]}>{name}</T>
            <T style={[st.readingVal, { color }]} numberOfLines={1} adjustsFontSizeToFit>
              {val}
            </T>
            <T style={st.readingUnit}>{unit}</T>
          </View>
        ))}
      </View>

      <View style={st.tags}>
        <Tag
          text={lid === 'open' ? '▲ LID OPEN' : shut ? '▼ LID CLOSED' : `LID: ${lid}`}
          color={lid === 'open' ? C.greenDim : shut ? C.temp : C.faint}
        />
        <Tag text={logging ? '● RECORDING' : '■ NOT RECORDING'} color={logging ? C.green : C.dim} />
        {r && r.cycle > 0 ? <Tag text={`CYCLE ${r.cycle}`} color={C.soft} /> : null}
        {online ? <Updated lastOk={d.lastOk} /> : <Tag text="OFFLINE" color={C.redDim} />}
      </View>

      <View style={st.chart}>
        <T style={st.chartTitle}>CO₂ SINCE YOU OPENED THE APP</T>
        {d.trend.length >= 2 ? (
          <>
            <Sparkline data={d.trend} height={72} />
            <T style={st.chartMeta}>
              last {d.trend.length} readings   ·   low {lo.toFixed(0)}   ·   high {hi.toFixed(0)} ppm
            </T>
          </>
        ) : (
          <Help>The trend appears after a couple of readings.</Help>
        )}
      </View>

      <T style={st.only}>THIS CHAMBER ONLY</T>
      <View style={st.row}>
        <ActionTile glyph="▲" line1="OPEN LID" tone="green" tall={false} disabled={busy || !online} onPress={() => lidCmd('open')} />
        <ActionTile glyph="▼" line1="CLOSE LID" tone="steel" tall={false} disabled={busy || !online} onPress={() => lidCmd('close')} />
      </View>
      <View style={st.row}>
        <ActionTile glyph="●" line1="START REC" tone="green" tall={false} disabled={busy || !online} onPress={() => logCmd('start')} />
        <ActionTile glyph="■" line1="STOP REC" tone="red" tall={false} disabled={busy || !online} onPress={() => logCmd('stop')} />
      </View>
      <View style={st.row}>
        <ActionTile
          glyph="⬇"
          line1="COPY THIS CHAMBER'S DATA"
          tone="blue"
          tall={false}
          disabled={busy || !online}
          onPress={() => send('Copy the data file from this chamber onto this device?', () => store.downloadAll([d.ip]))}
        />
      </View>
      {busy && progress ? <ProgressBar value={progress.done / Math.max(1, progress.total)} /> : null}
      <Help>To command every chamber at once, use the Control tab.</Help>
    </Sheet>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2a1114',
    borderColor: '#d6454566',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  offlineText: { flex: 1, color: '#ffb3b3', fontSize: 13, fontWeight: '600' },
  readings: { flexDirection: 'row', gap: 8 },
  reading: {
    flex: 1,
    backgroundColor: C.sunk,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  readingName: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  readingVal: { fontFamily: MONO, fontSize: 30, fontWeight: '700', marginTop: 2 },
  readingUnit: { color: C.dim, fontSize: 11 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chart: {
    backgroundColor: C.sunk,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  chartTitle: { color: C.co2, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  chartMeta: { color: C.dim, fontFamily: MONO, fontSize: 11 },
  only: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
});
