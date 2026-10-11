import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { C, MONO, useWide } from '../theme';
import { useStore } from '../store';
import { deleteSaved, SavedFile, shareSaved } from '../files';
import { tick } from '../haptics';
import { ActionTile, Btn, Field, Help, LogRow, Panel, ProgressBar, s as ui, SectionLabel, T, useConfirm } from '../ui';
import { fmtDateTime, humanizeSeconds, parseDateTime, rtcTimestamp, useNow } from '../util';

const MAX_SECONDS = 999999;
const toSeconds = (t: string) => Math.min(MAX_SECONDS, Math.max(1, parseInt(t, 10) || 1));

/** A finger-sized −/+ that repeats while it is held down. */
function StepBtn({ sign, onStep }: { sign: '+' | '−'; onStep: () => void }) {
  const step = useRef(onStep);
  step.current = onStep;
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (delay.current) clearTimeout(delay.current);
    if (repeat.current) clearInterval(repeat.current);
    delay.current = repeat.current = null;
  };
  const start = () => {
    stop();
    tick();
    step.current();
    delay.current = setTimeout(() => {
      repeat.current = setInterval(() => step.current(), 70);
    }, 400);
  };
  useEffect(() => stop, []);
  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={sign === '+' ? 'Add 5 seconds' : 'Take off 5 seconds'}
      style={({ pressed }) => [st.step, pressed && { backgroundColor: '#1f3050', borderColor: C.accent }]}
    >
      <T style={st.stepText}>{sign}</T>
    </Pressable>
  );
}

/** A caption, a −/+ number box, and a plain-words readout of what it means. */
function DurationRow({
  caption,
  value,
  onChange,
}: {
  caption: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const step = (by: number) => onChange(String(Math.min(MAX_SECONDS, Math.max(1, toSeconds(value) + by))));
  return (
    <View style={{ gap: 4 }}>
      <T style={ui.fieldLabel}>{caption}</T>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <StepBtn sign="−" onStep={() => step(-5)} />
        <TextInput
          style={[ui.input, { flex: 1, textAlign: 'center' }]}
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 6))}
          onBlur={() => onChange(String(toSeconds(value)))}
          keyboardType="number-pad"
          accessibilityLabel={`${caption}, seconds`}
          maxLength={6}
          selectTextOnFocus
        />
        <StepBtn sign="+" onStep={() => step(5)} />
      </View>
      <T style={st.readout}>= {humanizeSeconds(toSeconds(value))}</T>
    </View>
  );
}

function PhoneClock() {
  const now = useNow();
  return <T style={st.clock}>{fmtDateTime(now)}</T>;
}

export default function ControlScreen() {
  const store = useStore();
  const confirm = useConfirm();
  const { onlineIps, busy, files, progress } = store;
  const n = onlineIps.length;
  const wide = useWide();

  const [logEvery, setLogEvery] = useState('30');
  const [lidOpen, setLidOpen] = useState('60');
  const [lidShut, setLidShut] = useState('120');
  const [advOpen, setAdvOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const [calCo2, setCalCo2] = useState('415.0');
  const [calAlt, setCalAlt] = useState('0');
  const [calTemp, setCalTemp] = useState('0.0');
  const [customTime, setCustomTime] = useState(() => fmtDateTime(new Date()).replace('  ', ' '));

  const notice = (title: string, message: string) => confirm({ title, message, okOnly: true });

  /** Guard, confirm, then send — every command goes through here. */
  const send = async (message: string, run: () => Promise<void>) => {
    if (busy) return;
    if (n === 0) {
      await notice(
        'NO CHAMBERS ONLINE',
        'No chambers are online right now.\n\nGo to the Monitor tab and tap  🔍 SCAN ALL  first.',
      );
      return;
    }
    const ok = await confirm({
      title: 'CONFIRM ACTION',
      message: `${message}\n\nThis will affect all  ${n}  online chamber${n !== 1 ? 's' : ''}.`,
    });
    if (ok) await run();
  };

  const lid = (action: 'open' | 'close') =>
    send(`${action === 'open' ? 'OPEN' : 'CLOSE'} the lid on every chamber?`, () =>
      store.broadcast('/lid', { LidAction: action }),
    );

  const logging = (action: 'start' | 'stop') =>
    send(`${action === 'start' ? 'START' : 'STOP'} recording on every chamber?`, () =>
      store.broadcast('/logging', { LoggingAction: action }),
    );

  const setClocks = (when?: Date) => {
    const dt = when ?? new Date();
    return send(`Set the clock on every chamber to:\n\n     ${fmtDateTime(dt)}`, () =>
      // "Now" means the moment YES is tapped, not the moment the dialog opened.
      store.broadcast('/set_time', { Timestamp: rtcTimestamp(when ?? new Date()) }),
    );
  };

  const sendCustomTime = () => {
    const dt = parseDateTime(customTime);
    if (!dt) {
      notice('CHECK THE TIME', 'Write the time as\n\n     YYYY-MM-DD HH:MM:SS\n\nfor example  2026-05-14 09:30:00');
      return;
    }
    setClocks(dt);
  };

  const saveTimes = () => {
    const [a, b, c] = [toSeconds(logEvery), toSeconds(lidOpen), toSeconds(lidShut)];
    send(
      'Save these times to every chamber?\n\n' +
        `Save a reading every   ${humanizeSeconds(a)}\n` +
        `Lid stays OPEN for     ${humanizeSeconds(b)}\n` +
        `Lid stays SHUT for     ${humanizeSeconds(c)}`,
      () => store.broadcast('/config', { LogInterval: String(a), LidOpenT: String(b), LidCloseT: String(c) }),
    );
  };

  const calibrate = () => {
    const co2 = Number(calCo2);
    const alt = Number(calAlt);
    const temp = Number(calTemp);
    if (
      !(co2 >= 400 && co2 <= 2000) ||
      !(Number.isInteger(alt) && alt >= 0 && alt <= 5000) ||
      !(temp >= -10 && temp <= 10)
    ) {
      notice(
        'CHECK THE NUMBERS',
        'True CO₂ must be 400 – 2000 ppm.\nHeight must be a whole number, 0 – 5000 m.\nTemperature nudge must be −10 – 10 °C.',
      );
      return;
    }
    send(
      'Re-calibrate the CO₂ sensor on every chamber?\n\n' +
        'This permanently changes what each sensor treats as correct.',
      () => store.broadcast('/submit', { CalCO2: String(co2), CalALT: String(alt), CalTemp: String(temp) }),
    );
  };

  const copyData = () =>
    send('Copy the data file from every chamber onto this device?', async () => {
      await store.downloadAll();
      setFilesOpen(true);
    });

  const share = async (f: SavedFile) => {
    try {
      await shareSaved(f);
    } catch (e: any) {
      notice('CANNOT SHARE', String(e?.message ?? e));
    }
  };

  const remove = async (f: SavedFile) => {
    const ok = await confirm({
      title: 'DELETE FILE',
      message: `Delete this copy from this device?\n\n     ${f.name}\n\nThe data on the chamber's SD card is not touched.`,
      yes: 'DELETE',
      danger: true,
    });
    if (!ok) return;
    try {
      deleteSaved(f);
    } catch (e: any) {
      notice('CANNOT DELETE', String(e?.message ?? e));
    }
    store.refreshFiles();
  };

  const cycle = toSeconds(lidOpen) + toSeconds(lidShut);

  const actions = (
    <View style={{ gap: 8 }}>
      <SectionLabel>EVERY CHAMBER AT ONCE</SectionLabel>
      <View style={st.tileRow}>
        <ActionTile glyph="▲" line1="OPEN" line2="THE LIDS" tone="green" disabled={busy} onPress={() => lid('open')} />
        <ActionTile glyph="▼" line1="CLOSE" line2="THE LIDS" tone="steel" disabled={busy} onPress={() => lid('close')} />
      </View>
      <View style={st.tileRow}>
        <ActionTile glyph="●" line1="START" line2="RECORDING" tone="green" disabled={busy} onPress={() => logging('start')} />
        <ActionTile glyph="■" line1="STOP" line2="RECORDING" tone="red" disabled={busy} onPress={() => logging('stop')} />
      </View>
      <View style={[st.tileRow, !wide && { flexDirection: 'column' }]}>
        <ActionTile glyph="⬇" line1="COPY THE DATA TO THIS DEVICE" tone="blue" tall={false} disabled={busy} onPress={copyData} />
        <ActionTile glyph="🕐" line1="SET THE CLOCKS TO NOW" tone="blue" tall={false} disabled={busy} onPress={() => setClocks()} />
      </View>

      <Panel>
        <View style={st.head}>
          <Help style={{ flex: 1 }}>
            📁  {files.length === 0 ? 'No data files copied yet' : `${files.length} data file${files.length !== 1 ? 's' : ''} on this device`}
          </Help>
          {files.length > 0 && (
            <Btn small kind="secondary" label={filesOpen ? '▴  HIDE' : '▾  SHOW'} onPress={() => setFilesOpen(!filesOpen)} />
          )}
        </View>
        {filesOpen &&
          files.map((f) => (
            <View key={f.uri} style={st.fileRow}>
              <View style={{ flex: 1, minWidth: 140 }}>
                <T style={st.fileName}>{f.name}</T>
                <Help>
                  {f.size.toLocaleString()} B{f.modified ? `  ·  ${fmtDateTime(new Date(f.modified))}` : ''}
                </Help>
              </View>
              <Btn small label="SHARE" onPress={() => share(f)} />
              <Btn small kind="danger" label="DELETE" onPress={() => remove(f)} />
            </View>
          ))}
      </Panel>
    </View>
  );

  const timings = (
    <Panel title="HOW OFTEN / HOW LONG">
      <DurationRow caption="Save a reading every" value={logEvery} onChange={setLogEvery} />
      <DurationRow caption="Keep the lid OPEN for" value={lidOpen} onChange={setLidOpen} />
      <DurationRow caption="Keep the lid SHUT for" value={lidShut} onChange={setLidShut} />
      <Help>{`One open-then-shut cycle takes ${humanizeSeconds(cycle)}.`}</Help>
      <Btn label="💾  SAVE THESE TIMES TO ALL CHAMBERS" onPress={saveTimes} disabled={busy} />
    </Panel>
  );

  const advanced = (
    <View style={[st.cols, !wide && { flexDirection: 'column', alignItems: 'stretch' }]}>
      <Panel title="CO₂ SENSOR CALIBRATION" style={wide && { flex: 1 }}>
        <Help>Only when a sensor drifts. Outdoor air ≈ 415 ppm.</Help>
        <Field label="True CO₂ now (ppm)" value={calCo2} onChangeText={setCalCo2} keyboardType="decimal-pad" maxLength={7} />
        <Field label="Height above sea (m)" value={calAlt} onChangeText={setCalAlt} keyboardType="number-pad" maxLength={4} />
        <Field label="Temperature nudge (°C)" value={calTemp} onChangeText={setCalTemp} keyboardType="numbers-and-punctuation" maxLength={6} />
        <Btn label="✔  APPLY CALIBRATION TO ALL" onPress={calibrate} disabled={busy} />
      </Panel>
      <Panel title="SET A SPECIFIC CLOCK TIME" style={wide && { flex: 1 }}>
        <Help>
          The big button already sets every clock to this device's time. Use this only to set a different time on purpose.
        </Help>
        <Field
          label="Time to send (YYYY-MM-DD HH:MM:SS)"
          value={customTime}
          onChangeText={setCustomTime}
          keyboardType="numbers-and-punctuation"
          maxLength={19}
        />
        <View style={st.clockBox}>
          <T style={st.clockCap}>THIS DEVICE'S CLOCK RIGHT NOW</T>
          <PhoneClock />
          <Help style={{ textAlign: 'center' }}>the big SET THE CLOCKS TO NOW button sends this</Help>
        </View>
        <Btn label="🔄  SEND THIS TIME TO ALL" onPress={sendCustomTime} disabled={busy} />
      </Panel>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <View style={[st.banner, n > 0 && st.bannerOk]}>
        <T style={[st.bannerText, { color: n > 0 ? C.accent : C.amber }]}>
          {busy && progress
            ? `⏳  ${progress.label} — ${progress.done} of ${progress.total} answered`
            : n > 0
              ? `✅  Ready — ${n} chamber${n !== 1 ? 's' : ''} online`
              : '⚠  No chambers online — run a Scan on the Monitor tab first'}
        </T>
        {busy && progress ? <ProgressBar value={progress.done / Math.max(1, progress.total)} /> : null}
      </View>

      {wide ? (
        <View style={st.cols}>
          <View style={{ flex: 3 }}>{actions}</View>
          <View style={{ flex: 2 }}>{timings}</View>
        </View>
      ) : (
        <>
          {actions}
          {timings}
        </>
      )}

      <Btn
        kind="secondary"
        label={advOpen ? '▴  HIDE ADVANCED SETTINGS' : '▸  SHOW ADVANCED SETTINGS'}
        onPress={() => setAdvOpen(!advOpen)}
      />
      {advOpen && advanced}

      <View style={st.head}>
        <Btn
          kind="secondary"
          label={logOpen ? '▾  WHAT HAPPENED' : '▸  WHAT HAPPENED'}
          onPress={() => setLogOpen(!logOpen)}
        />
        <View style={{ flex: 1 }} />
        <Btn kind="secondary" label="🗑  CLEAR" onPress={store.clearActionLog} />
      </View>
      {logOpen && (
        <View style={st.log}>
          {store.actionLog.length === 0 ? (
            <Help style={{ color: C.faint }}>Each chamber answers here after you press a button...</Help>
          ) : (
            store.actionLog.slice(0, 60).map((l) => <LogRow key={l.key} line={l} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 12, gap: 10, paddingBottom: 28 },
  cols: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tileRow: { flexDirection: 'row', gap: 8 },
  banner: {
    backgroundColor: '#2a2010',
    borderWidth: 1,
    borderColor: '#e0a03066',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  bannerOk: { backgroundColor: '#10261a', borderColor: '#6cc24a55' },
  bannerText: { fontSize: 14, fontWeight: '700' },
  readout: { color: C.accent, fontSize: 12, fontWeight: '700' },
  step: {
    width: 50,
    minHeight: 46,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.borderHi,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: C.accent, fontSize: 24, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  fileName: { color: C.accent, fontFamily: MONO, fontSize: 13, fontWeight: '700' },
  clockBox: {
    backgroundColor: C.sunk,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  clockCap: { color: C.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' },
  clock: {
    color: C.accent,
    fontFamily: MONO,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  log: {
    backgroundColor: C.sunk,
    borderWidth: 1,
    borderColor: C.borderHi,
    borderRadius: 12,
    padding: 10,
    minHeight: 60,
  },
});
