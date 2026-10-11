import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { C, MONO, Tone, TONES } from './theme';
import { LogLine } from './store';
import { fmtTime } from './util';

type BtnKind = 'primary' | 'secondary' | 'success' | 'danger';
const BTN: Record<BtnKind, [string, string, string]> = {
  primary: ['#003d5e', '#0078b4', '#66d4ff'],
  secondary: ['transparent', '#00d4aa66', C.accent],
  success: ['#003d2a', '#00a870', '#00ffaa'],
  danger: ['#8b0000', '#cc2222', '#ffcccc'],
};

export function Btn({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const [bg, border, fg] = BTN[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Text style={[s.btnText, { color: fg }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One large, unmistakable command button: big symbol over one or two words. */
export function ActionTile({
  glyph,
  line1,
  line2,
  tone,
  tall = true,
  disabled,
  onPress,
}: {
  glyph: string;
  line1: string;
  line2?: string;
  tone: Tone;
  tall?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [bg, pressedBg, border, fg] = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={line2 ? `${line1} ${line2}` : line1}
      style={({ pressed }) => [
        s.tile,
        { minHeight: tall ? 116 : 60, backgroundColor: pressed ? pressedBg : bg, borderColor: border },
        disabled && { opacity: 0.4 },
      ]}
    >
      {tall ? (
        <>
          <Text style={{ color: fg, fontSize: 38, lineHeight: 44 }}>{glyph}</Text>
          <Text style={[s.tileText, { color: fg, fontSize: 16 }]}>
            {line2 ? `${line1}\n${line2}` : line1}
          </Text>
        </>
      ) : (
        <Text style={[s.tileText, { color: fg, fontSize: 14 }]}>{`${glyph}   ${line1}`}</Text>
      )}
    </Pressable>
  );
}

export function Panel({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.panel, style]}>
      {title ? <Text style={s.panelTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={s.section}>{children}</Text>;
}

export function Help({ children }: { children: string }) {
  return <Text style={s.help}>{children}</Text>;
}

export function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        autoCapitalize="none"
        autoCorrect={false}
        selectTextOnFocus
      />
    </View>
  );
}

const LOG_COLOR: Record<LogLine['kind'], string> = {
  ok: C.greenDim,
  err: C.redDim,
  info: C.dim,
  poll: C.purple,
  scan: '#cc8800',
  sent: C.blue,
  hint: C.amber,
};

export function LogRow({ line }: { line: LogLine }) {
  return (
    <Text style={[s.logLine, line.kind === 'hint' && { paddingLeft: 24 }]}>
      {line.kind !== 'hint' && <Text style={{ color: C.faint }}>[{fmtTime(line.ts)}] </Text>}
      <Text style={{ color: LOG_COLOR[line.kind] }}>{line.text}</Text>
    </Text>
  );
}

/** Lays children out in as many equal columns as fit `minWidth`. */
export function Grid<T>({
  items,
  minWidth,
  gap = 8,
  keyOf,
  render,
}: {
  items: T[];
  minWidth: number;
  gap?: number;
  keyOf: (item: T) => string;
  render: (item: T) => React.ReactNode;
}) {
  const [w, setW] = useState(0);
  const cols = Math.max(1, Math.floor((w + gap) / (minWidth + gap)));
  const itemW = Math.floor((w - gap * (cols - 1)) / cols);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {w > 0 &&
        items.map((it) => (
          <View key={keyOf(it)} style={{ width: itemW }}>
            {render(it)}
          </View>
        ))}
    </View>
  );
}

// ── confirm / notice dialog ───────────────────────────────────
type Ask = { title: string; message: string; okOnly?: boolean; yes?: string };
const ConfirmCtx = createContext<(a: Ask) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (a: Ask) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setAsk(a);
      }),
    [],
  );
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setAsk(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal visible={!!ask} transparent animationType="fade" onRequestClose={() => close(false)}>
        <View style={s.backdrop}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>{ask?.title}</Text>
            <Text style={s.dialogMsg}>{ask?.message}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {!ask?.okOnly && (
                <Btn label="CANCEL" kind="secondary" onPress={() => close(false)} style={{ flex: 1 }} />
              )}
              <Btn label={ask?.okOnly ? 'OK' : ask?.yes ?? 'YES'} onPress={() => close(true)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const s = StyleSheet.create({
  btn: {
    minHeight: 44,
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 4 },
  btnText: { fontFamily: MONO, fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  tile: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileText: { fontFamily: MONO, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  panel: {
    backgroundColor: C.panel,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  panelTitle: { color: C.accent, fontFamily: MONO, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  section: {
    color: C.accent,
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingVertical: 6,
  },
  help: { color: C.dim, fontFamily: MONO, fontSize: 12, lineHeight: 17 },
  fieldLabel: { color: C.soft, fontFamily: MONO, fontSize: 13 },
  input: {
    backgroundColor: C.card,
    color: C.text,
    borderWidth: 2,
    borderColor: C.borderHi,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    fontFamily: MONO,
    fontSize: 15,
  },
  logLine: { fontFamily: MONO, fontSize: 12, lineHeight: 18, color: C.soft },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000aa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: C.panel,
    borderWidth: 2,
    borderColor: C.borderHi,
    borderRadius: 10,
    padding: 18,
    gap: 14,
  },
  dialogTitle: { color: C.accent, fontFamily: MONO, fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },
  dialogMsg: { color: C.text, fontFamily: MONO, fontSize: 14, lineHeight: 21 },
});
