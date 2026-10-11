import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { C, MONO, RAIL_MIN, RAIL_W } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import { ConfirmProvider } from './src/ui';
import { fmtTime, useNow } from './src/util';
import MonitorScreen from './src/screens/MonitorScreen';
import ControlScreen from './src/screens/ControlScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LogScreen from './src/screens/LogScreen';

const TABS = [
  { key: 'monitor', icon: '📡', label: 'MONITOR', Screen: MonitorScreen },
  { key: 'control', icon: '🎛', label: 'CONTROL', Screen: ControlScreen },
  { key: 'settings', icon: '⚙', label: 'SETTINGS', Screen: SettingsScreen },
  { key: 'log', icon: '📋', label: 'LOG', Screen: LogScreen },
] as const;

function Clock() {
  return <Text style={st.clock}>{fmtTime(useNow())}</Text>;
}

function Shell() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('monitor');
  const { width } = useWindowDimensions();
  const { onlineIps, devices } = useStore();
  // Phones and upright tablets get tabs along the bottom; a wide screen
  // (tablet on its side) gets them down the left edge instead.
  const rail = width >= RAIL_MIN;
  const n = onlineIps.length;

  const tabs = (
    <View style={rail ? st.rail : st.tabBar}>
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[rail ? st.railTab : st.tab, on && (rail ? st.railTabOn : st.tabOn)]}
          >
            <Text style={{ fontSize: 20, color: on ? C.accent : C.dim }}>{t.icon}</Text>
            <Text style={[st.tabText, { color: on ? C.accent : C.dim }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={st.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={st.topBar}>
        <Text style={st.title} numberOfLines={1}>
          {width < 420 ? 'FLUX CHAMBER HUB' : 'ESP32  FLUX  CHAMBER  HUB'}
        </Text>
        <Text style={[st.count, { color: n > 0 ? C.accent : C.faint }]}>
          ● {n} / {devices.length}
        </Text>
        {width >= 420 && <Clock />}
      </View>
      <KeyboardAvoidingView
        style={[st.body, rail && { flexDirection: 'row' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {rail && tabs}
        <View style={{ flex: 1 }}>
          {/* Every screen stays mounted so typed-in values survive a tab switch. */}
          {TABS.map(({ key, Screen }) => (
            <View key={key} style={[{ flex: 1 }, key !== tab && { display: 'none' }]}>
              <Screen />
            </View>
          ))}
        </View>
      </KeyboardAvoidingView>
      {!rail && tabs}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ConfirmProvider>
          <StatusBar style="light" />
          <Shell />
        </ConfirmProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bar },
  body: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: C.bar,
    borderBottomWidth: 2,
    borderBottomColor: '#00d4aa44',
  },
  title: { flex: 1, color: C.accent, fontFamily: MONO, fontSize: 15, fontWeight: '700', letterSpacing: 2 },
  count: { fontFamily: MONO, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  clock: { color: '#6a8080', fontFamily: MONO, fontSize: 13, letterSpacing: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: C.bar, borderTopWidth: 2, borderTopColor: C.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, borderTopWidth: 3, borderTopColor: 'transparent' },
  tabOn: { borderTopColor: C.accent, backgroundColor: C.bg },
  rail: { width: RAIL_W, backgroundColor: C.bar, borderRightWidth: 2, borderRightColor: C.border, paddingTop: 8 },
  railTab: { alignItems: 'center', paddingVertical: 16, gap: 4, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  railTabOn: { borderLeftColor: C.accent, backgroundColor: C.bg },
  tabText: { fontFamily: MONO, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
