import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { C, MONO } from '../theme';
import { useStore } from '../store';
import { Btn, Help, LogRow } from '../ui';

export default function LogScreen() {
  const { sysLog, clearSysLog } = useStore();
  return (
    <View style={st.page}>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>📋  SYSTEM LOG</Text>
          <Help>All network activity, newest first.</Help>
        </View>
        <Btn kind="secondary" label="🗑  CLEAR" onPress={clearSysLog} />
      </View>
      <FlatList
        style={st.list}
        contentContainerStyle={{ padding: 10 }}
        data={sysLog}
        keyExtractor={(l) => String(l.key)}
        renderItem={({ item }) => <LogRow line={item} />}
        ListEmptyComponent={<Help>Nothing yet — scan for chambers on the Monitor tab.</Help>}
      />
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, padding: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: C.accent, fontFamily: MONO, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  list: {
    flex: 1,
    backgroundColor: C.sunk,
    borderWidth: 2,
    borderColor: C.borderHi,
    borderRadius: 5,
  },
});
