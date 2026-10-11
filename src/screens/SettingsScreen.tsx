import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { C, useWide } from '../theme';
import { DEFAULT_SETTINGS, LIMITS, Settings, useStore } from '../store';
import { isLocalBase } from '../net';
import { APP_NAME, APP_VERSION, POLICY_DATE, PRIVACY_CONTACT, PRIVACY_POLICY, PRIVACY_SUMMARY, PUBLISHER } from '../legal';
import { Btn, Field, Help, Panel, SectionLabel, T, useConfirm } from '../ui';

const toForm = (s: Settings) => ({
  baseIp: s.deviceBaseIp,
  start: String(s.deviceIpStart),
  count: String(s.numDevices),
  interval: String(s.monitorInterval),
  timeout: String(s.httpTimeout),
});

const whole = (t: string) => (/^\d+$/.test(t.trim()) ? parseInt(t, 10) : NaN);
const within = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;

export default function SettingsScreen() {
  const { settings, applySettings, setDemo } = useStore();
  const confirm = useConfirm();
  const [f, setF] = useState(() => toForm(settings));
  const [policyOpen, setPolicyOpen] = useState(false);
  const wide = useWide();

  // Saved settings arrive from storage a moment after the first render.
  useEffect(() => setF(toForm(settings)), [settings]);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    let base = f.baseIp.trim();
    if (base && !base.endsWith('.')) base += '.';
    const start = whole(f.start);
    const count = whole(f.count);
    const interval = whole(f.interval);
    const timeout = whole(f.timeout);

    const problems: string[] = [];
    if (!/^(\d{1,3}\.){3}$/.test(base) || base.split('.').slice(0, 3).some((o) => +o > 255))
      problems.push('Base IP needs three numbers, like  192.168.8.');
    else if (!isLocalBase(base))
      problems.push(
        'Base IP must be a local network address:\n192.168.x.x,  10.x.x.x  or  172.16 – 31.x.x.\nThe app does not connect to addresses on the internet.',
      );
    if (!within(start, LIMITS.deviceIpStart)) problems.push('First device number must be 1 – 254.');
    if (!within(count, LIMITS.numDevices)) problems.push('Number of devices must be 1 – 100.');
    else if (start + count - 1 > 254) problems.push('That many devices runs past address .254.');
    if (!within(interval, LIMITS.monitorInterval)) problems.push('Poll interval must be 1 – 300 seconds.');
    if (!within(timeout, LIMITS.httpTimeout)) problems.push('Request timeout must be 1 – 30 seconds.');
    if (problems.length) {
      confirm({ title: 'CHECK THE SETTINGS', message: problems.join('\n\n'), okOnly: true });
      return;
    }

    applySettings({
      ...settings,
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

  const reset = async () => {
    const ok = await confirm({
      title: 'RESET SETTINGS',
      message: 'Put every setting back to how the app came?\n\nCopied data files are kept.',
      yes: 'RESET',
      danger: true,
    });
    if (ok) applySettings(DEFAULT_SETTINGS);
  };

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <View style={[st.cols, !wide && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={[st.col, wide && { flex: 1 }]}>
          <SectionLabel>📡  CHAMBER NETWORK</SectionLabel>
          <Panel>
            <Help>
              {'Base IP: the first three numbers (e.g. 192.168.8.).\n' +
                'First device number: the last number for device #1 — use 101 for this firmware.\n' +
                'This phone or tablet must be joined to the same WiFi as the chambers.'}
            </Help>
            <Field label="Base IP address" value={f.baseIp} onChangeText={set('baseIp')} keyboardType="numbers-and-punctuation" maxLength={12} />
            <Field label="First device number" value={f.start} onChangeText={set('start')} keyboardType="number-pad" maxLength={3} />
            <Field label="Number of devices" value={f.count} onChangeText={set('count')} keyboardType="number-pad" maxLength={3} />
          </Panel>
        </View>
        <View style={[st.col, wide && { flex: 1 }]}>
          <SectionLabel>⏱  TIMING</SectionLabel>
          <Panel>
            <Field label="Refresh readings every (seconds)" value={f.interval} onChangeText={set('interval')} keyboardType="number-pad" maxLength={3} />
            <Field label="Give up on a chamber after (seconds)" value={f.timeout} onChangeText={set('timeout')} keyboardType="number-pad" maxLength={2} />
          </Panel>
          <Btn kind="success" label="✔  SAVE  &  APPLY SETTINGS" onPress={save} />
          <Btn kind="secondary" label="RESET TO DEFAULTS" onPress={reset} />
        </View>
      </View>

      <SectionLabel>🧪  DEMO MODE</SectionLabel>
      <Panel>
        <View style={st.switchRow}>
          <View style={{ flex: 1 }}>
            <T style={st.switchLabel}>Show simulated chambers</T>
            <Help>
              For trying the app without hardware. Nothing is sent to real chambers and the network is not used while this is on.
            </Help>
          </View>
          <Switch
            value={settings.demoMode}
            onValueChange={setDemo}
            trackColor={{ false: C.borderHi, true: C.greenDim }}
            thumbColor={C.text}
            accessibilityLabel="Demo mode"
          />
        </View>
      </Panel>

      <SectionLabel>ℹ  ABOUT  &  PRIVACY</SectionLabel>
      <Panel>
        <View style={st.about}>
          <Image source={require('../../assets/logo-badge.png')} style={st.logo} accessibilityLabel="IWM logo" />
          <View style={{ flex: 1 }}>
            <T style={st.appName}>{APP_NAME}</T>
            <Help>
              Version {APP_VERSION}
              {'\n'}
              {PUBLISHER}
            </Help>
          </View>
        </View>
        {PRIVACY_SUMMARY.map((line) => (
          <View key={line} style={st.bullet}>
            <T style={st.tickMark}>✓</T>
            <Help style={{ flex: 1, color: C.soft }}>{line}</Help>
          </View>
        ))}
        <Btn
          kind="secondary"
          label={policyOpen ? '▴  HIDE PRIVACY POLICY' : '▾  READ THE PRIVACY POLICY'}
          onPress={() => setPolicyOpen(!policyOpen)}
        />
        {policyOpen && (
          <View style={{ gap: 10 }}>
            <Help>Effective {POLICY_DATE}</Help>
            {PRIVACY_POLICY.map((sec) => (
              <View key={sec.heading} style={{ gap: 3 }}>
                <T style={st.policyHead}>{sec.heading}</T>
                <Help style={{ color: C.soft }}>{sec.body}</Help>
              </View>
            ))}
            {PRIVACY_CONTACT ? (
              <View style={{ gap: 3 }}>
                <T style={st.policyHead}>Contact</T>
                <Help style={{ color: C.soft }}>
                  Questions about this policy: {PRIVACY_CONTACT}
                </Help>
              </View>
            ) : null}
          </View>
        )}
      </Panel>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 12, gap: 10, paddingBottom: 28 },
  cols: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col: { gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  about: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64, borderRadius: 32 },
  appName: { color: C.text, fontSize: 18, fontWeight: '800' },
  bullet: { flexDirection: 'row', gap: 8 },
  tickMark: { color: C.accent, fontSize: 14, fontWeight: '800' },
  policyHead: { color: C.gold, fontSize: 13, fontWeight: '800' },
});
