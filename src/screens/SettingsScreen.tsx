import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useWide } from '../theme';
import { Settings, useStore } from '../store';
import { Btn, Field, Help, Panel, SectionLabel, useConfirm } from '../ui';

const toForm = (s: Settings) => ({
  baseIp: s.deviceBaseIp,
  start: String(s.deviceIpStart),
  count: String(s.numDevices),
  interval: String(s.monitorInterval),
  timeout: String(s.httpTimeout),
});

export default function SettingsScreen() {
  const { settings, applySettings } = useStore();
  const confirm = useConfirm();
  const [f, setF] = useState(() => toForm(settings));
  const wide = useWide();

  // Saved settings arrive from storage a moment after the first render.
  useEffect(() => setF(toForm(settings)), [settings]);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    let base = f.baseIp.trim();
    if (base && !base.endsWith('.')) base += '.';
    const octets = base.split('.').slice(0, 3);
    const start = parseInt(f.start, 10);
    const count = parseInt(f.count, 10);
    const interval = parseInt(f.interval, 10);
    const timeout = parseInt(f.timeout, 10);

    const problems: string[] = [];
    if (!/^(\d{1,3}\.){3}$/.test(base) || octets.some((o) => +o > 255))
      problems.push('Base IP needs three numbers, like  192.168.8.');
    if (!(start >= 1 && start <= 254)) problems.push('First device number must be 1 – 254.');
    if (!(count >= 1 && count <= 100)) problems.push('Number of devices must be 1 – 100.');
    else if (start + count - 1 > 254) problems.push('That many devices runs past address .254.');
    if (!(interval >= 1 && interval <= 300)) problems.push('Poll interval must be 1 – 300 seconds.');
    if (!(timeout >= 1 && timeout <= 30)) problems.push('Request timeout must be 1 – 30 seconds.');
    if (problems.length) {
      confirm({ title: 'CHECK THE SETTINGS', message: problems.join('\n\n'), okOnly: true });
      return;
    }

    applySettings({
      deviceBaseIp: base,
      deviceIpStart: start,
      numDevices: count,
      monitorInterval: interval,
      httpTimeout: timeout,
    });
    confirm({
      title: 'SETTINGS SAVED',
      message: `Looking for ${count} chamber${count !== 1 ? 's' : ''} at\n\n     ${base}${start}  –  ${base}${start + count - 1}\n\nTap SCAN ALL on the Monitor tab to find them.`,
      okOnly: true,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={st.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[st.cols, !wide && { flexDirection: 'column' }]}>
        <View style={[st.col, wide && { flex: 1 }]}>
          <SectionLabel>📡  DEVICE NETWORK</SectionLabel>
          <Panel title="HOW TO REACH YOUR ESP32 DEVICES">
            <Help>
              {'Base IP: the first three numbers (e.g. 192.168.8.).\n' +
                'First device number: the last number for device #1 — use 101 for this firmware.\n' +
                'This phone or tablet must be joined to the same WiFi as the chambers.'}
            </Help>
            <Field label="Base IP address" value={f.baseIp} onChangeText={set('baseIp')} keyboardType="numbers-and-punctuation" />
            <Field label="First device number" value={f.start} onChangeText={set('start')} keyboardType="number-pad" />
            <Field label="Number of devices" value={f.count} onChangeText={set('count')} keyboardType="number-pad" />
          </Panel>
        </View>
        <View style={[st.col, wide && { flex: 1 }]}>
          <SectionLabel>⏱  TIMING & PERFORMANCE</SectionLabel>
          <Panel title="NETWORK POLLING">
            <Field label="Poll readings every (seconds)" value={f.interval} onChangeText={set('interval')} keyboardType="number-pad" />
            <Field label="Request timeout (seconds)" value={f.timeout} onChangeText={set('timeout')} keyboardType="number-pad" />
          </Panel>
        </View>
      </View>
      <Btn kind="success" label="✔  SAVE  &  APPLY SETTINGS" onPress={save} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 12, gap: 12, paddingBottom: 28 },
  cols: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col: { gap: 4 },
});
