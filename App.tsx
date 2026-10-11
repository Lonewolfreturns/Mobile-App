import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { C, MONO, RAIL_MIN, RAIL_W } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import { Btn, ConfirmProvider, T, ToastView } from './src/ui';
import { tick } from './src/haptics';
import { fmtTime, useNow } from './src/util';
import MonitorScreen from './src/screens/MonitorScreen';
import ControlScreen from './src/screens/ControlScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LogScreen from './src/screens/LogScreen';
import DeviceSheet from './src/screens/DeviceSheet';

const TABS = [
  { key: 'monitor', icon: '📡', label: 'MONITOR', Screen: MonitorScreen },
  { key: 'control', icon: '🎛', label: 'CONTROL', Screen: ControlScreen },
  { key: 'settings', icon: '⚙', label: 'SETTINGS', Screen: SettingsScreen },
  { key: 'log', icon: '📋', label: 'LOG', Screen: LogScreen },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function Clock() {
  return <T style={st.clock}>{fmtTime(useNow())}</T>;
}

function Shell() {
  const [tab, setTab] = useState<TabKey>('monitor');
  const { width } = useWindowDimensions();
  const { onlineIps, devices, settings, toast, dismissToast, selectedIp } = useStore();
  // Phones and upright tablets get tabs along the bottom; a wide screen
  // (tablet on its side) gets them down the left edge instead.
  const rail = width >= RAIL_MIN;
  const n = onlineIps.length;

  // Android back: step back to Monitor first, and only leave the app from there.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tabRef.current === 'monitor') return false;
      setTab('monitor');
      return true;
    });
    return () => sub.remove();
  }, []);

  const tabs = (
    <View style={rail ? st.rail : st.tabBar} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              if (!on) tick();
              setTab(t.key);
            }}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            style={[rail ? st.railTab : st.tab, on && (rail ? st.railTabOn : st.tabOn)]}
          >
            <Text style={{ fontSize: 20, color: on ? C.accent : C.dim, opacity: on ? 1 : 0.75 }}>{t.icon}</Text>
            <T style={[st.tabText, { color: on ? C.accent : C.dim }]}>{t.label}</T>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={st.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={st.topBar}>
        <Image source={require('./assets/logo-badge.png')} style={st.logo} accessibilityLabel="IWM logo" />
        <T style={st.title} numberOfLines={1}>
          {width < 380 ? 'FLUX HUB' : 'FLUX CHAMBER HUB'}
        </T>
        {settings.demoMode && <T style={st.demo}>DEMO</T>}
        <T style={[st.count, { color: n > 0 ? C.green : C.faint }]}>
          ● {n}/{devices.length}
        </T>
        {width >= 480 && <Clock />}
      </View>
      {settings.demoMode && (
        <View style={st.demoBar}>
          <T style={st.demoBarText}>Demo mode — these chambers are simulated. Turn it off in Settings.</T>
        </View>
      )}
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
          {toast && <ToastView key={toast.key} toast={toast} onDone={dismissToast} />}
        </View>
      </KeyboardAvoidingView>
      {!rail && tabs}
      {selectedIp && <DeviceSheet />}
    </SafeAreaView>
  );
}

/** A crash in any screen lands here instead of on a blank page. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean; round: number }> {
  state = { failed: false, round: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return <React.Fragment key={this.state.round}>{this.props.children}</React.Fragment>;
    return (
      <View style={st.crash}>
        <T style={st.crashTitle}>Something went wrong</T>
        <T style={st.crashText}>
          The app hit an unexpected problem. Your chambers are not affected — they keep running on their own.
        </T>
        <Btn label="START AGAIN" onPress={() => this.setState((s) => ({ failed: false, round: s.round + 1 }))} />
      </View>
    );
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <StoreProvider>
          <ConfirmProvider>
            <Shell />
          </ConfirmProvider>
        </StoreProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bar },
  body: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 54,
    backgroundColor: C.bar,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logo: { width: 36, height: 36, borderRadius: 18 },
  title: { flex: 1, color: C.text, fontSize: 16, fontWeight: '800', letterSpacing: 1.2 },
  demo: {
    color: C.bg,
    backgroundColor: C.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  demoBar: { backgroundColor: '#3a2c0c', paddingHorizontal: 12, paddingVertical: 6 },
  demoBarText: { color: C.gold, fontSize: 12, fontWeight: '600' },
  count: { fontFamily: MONO, fontSize: 13, fontWeight: '700' },
  clock: { color: C.dim, fontFamily: MONO, fontSize: 13 },
  tabBar: { flexDirection: 'row', backgroundColor: C.bar, borderTopWidth: 1, borderTopColor: C.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, borderTopWidth: 3, borderTopColor: 'transparent', minHeight: 56 },
  tabOn: { borderTopColor: C.accent, backgroundColor: C.bg },
  rail: { width: RAIL_W, backgroundColor: C.bar, borderRightWidth: 1, borderRightColor: C.border, paddingTop: 8 },
  railTab: { alignItems: 'center', paddingVertical: 16, gap: 4, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  railTabOn: { borderLeftColor: C.accent, backgroundColor: C.bg },
  tabText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  crash: { flex: 1, backgroundColor: C.bg, alignItems: 'stretch', justifyContent: 'center', padding: 28, gap: 14 },
  crashTitle: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  crashText: { color: C.dim, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
