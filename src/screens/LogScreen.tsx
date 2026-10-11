import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { C } from '../theme';
import { LogKind, useStore } from '../store';
import { tick } from '../haptics';
import { Btn, Help, LogRow, T } from '../ui';

const FILTERS: { key: string; label: string; kinds: LogKind[] | null }[] = [
  { key: 'all', label: 'ALL', kinds: null },
  { key: 'err', label: 'PROBLEMS', kinds: ['err'] },
  { key: 'cmd', label: 'COMMANDS', kinds: ['ok', 'sent', 'info'] },
  { key: 'read', label: 'READINGS', kinds: ['poll', 'scan'] },
];

export default function LogScreen() {
  const { sysLog, clearSysLog } = useStore();
  const [filter, setFilter] = useState('all');
  const shown = useMemo(() => {
    const kinds = FILTERS.find((f) => f.key === filter)?.kinds;
    return kinds ? sysLog.filter((l) => kinds.includes(l.kind)) : sysLog;
  }, [sysLog, filter]);

  return (
    <View style={st.page}>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <T style={st.title}>📋  SYSTEM LOG</T>
          <Help>All network activity, newest first.</Help>
        </View>
        <Btn kind="secondary" label="🗑  CLEAR" onPress={clearSysLog} />
      </View>
      <View style={st.chips}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                tick();
                setFilter(f.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[st.chip, on && st.chipOn]}
            >
              <T style={[st.chipText, on && { color: C.bg }]}>{f.label}</T>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        style={st.list}
        contentContainerStyle={{ padding: 10 }}
        data={shown}
        keyExtractor={(l) => String(l.key)}
        renderItem={({ item }) => <LogRow line={item} />}
        initialNumToRender={40}
        ListEmptyComponent={
          <Help>{sysLog.length ? 'Nothing of this kind yet.' : 'Nothing yet — scan for chambers on the Monitor tab.'}</Help>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: C.gold, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.soft, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  list: {
    flex: 1,
    backgroundColor: C.sunk,
    borderWidth: 1,
    borderColor: C.borderHi,
    borderRadius: 12,
  },
});
