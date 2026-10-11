import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { C, MONO, NATIVE_DRIVER, TABLET_MIN, Tone, TONES } from './theme';
import { LogLine, Toast } from './store';
import { tap, thud } from './haptics';
import { fmtTime } from './util';

/** Text that follows the phone's font-size setting, up to a point that still fits. */
export function T(props: TextProps) {
  return <Text maxFontSizeMultiplier={1.35} {...props} />;
}

/** Springs a control down a touch while it is held. */
function usePressScale(to = 0.96) {
  const v = useRef(new Animated.Value(1)).current;
  const go = (x: number) =>
    Animated.spring(v, { toValue: x, useNativeDriver: NATIVE_DRIVER, speed: 40, bounciness: 6 }).start();
  return { scale: { transform: [{ scale: v }] }, onPressIn: () => go(to), onPressOut: () => go(1) };
}

type BtnKind = 'primary' | 'secondary' | 'success' | 'danger';
const BTN: Record<BtnKind, [string, string, string]> = {
  primary: ['#123763', '#2f7fd6', '#a9d2ff'],
  secondary: ['transparent', '#6cc24a77', C.accent],
  success: ['#12482d', C.greenDim, '#7dffb5'],
  danger: ['#551419', '#d64545', '#ffb3b3'],
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
  const p = usePressScale(0.97);
  return (
    <Animated.View style={[p.scale, style]}>
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        onPressIn={p.onPressIn}
        onPressOut={p.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        style={[s.btn, small && s.btnSmall, { backgroundColor: bg, borderColor: border }, disabled && s.off]}
      >
        <T style={[s.btnText, { color: fg }]} numberOfLines={2}>
          {label}
        </T>
      </Pressable>
    </Animated.View>
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
  const p = usePressScale(0.95);
  return (
    <Animated.View style={[{ flex: 1 }, p.scale]}>
      <Pressable
        onPress={() => {
          thud();
          onPress();
        }}
        onPressIn={p.onPressIn}
        onPressOut={p.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={line2 ? `${line1} ${line2}` : line1}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [
          s.tile,
          { minHeight: tall ? 112 : 58, backgroundColor: pressed ? pressedBg : bg, borderColor: border },
          disabled && s.off,
        ]}
      >
        {tall ? (
          <>
            <Text style={{ color: fg, fontSize: 36, lineHeight: 42 }}>{glyph}</Text>
            <T style={[s.tileText, { color: fg, fontSize: 15 }]}>{line2 ? `${line1}\n${line2}` : line1}</T>
          </>
        ) : (
          <T style={[s.tileText, { color: fg, fontSize: 14 }]}>{`${glyph}   ${line1}`}</T>
        )}
      </Pressable>
    </Animated.View>
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
      {title ? <T style={s.panelTitle}>{title}</T> : null}
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <T style={s.section}>{children}</T>;
}

export function Help({ children, style }: { children: React.ReactNode; style?: TextProps['style'] }) {
  return <T style={[s.help, style]}>{children}</T>;
}

export function Tag({ text, color }: { text: string; color: string }) {
  return <T style={[s.tag, { color, backgroundColor: color + '22' }]}>{text}</T>;
}

export function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  placeholder,
  maxLength = 40,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  maxLength?: number;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <T style={s.fieldLabel}>{label}</T>
      <TextInput
        style={[s.input, focus && s.inputFocus]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={maxLength}
        selectTextOnFocus
      />
    </View>
  );
}

/** A bar that fills as work completes. `value` runs 0 – 1. */
export function ProgressBar({ value, color = C.accent }: { value: number; color?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: Math.max(0, Math.min(1, value)),
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [value, v]);
  return (
    <View style={s.track} accessibilityRole="progressbar">
      <Animated.View
        style={[
          s.fill,
          { backgroundColor: color, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

/** The slow blink that says a chamber is alive and answering. */
export function PulseDot({ color = C.green, size = 8 }: { color?: string; size?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.25, duration: 900, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: v }} />
  );
}

/** A tiny bar chart of recent readings, scaled to its own low and high. */
export function Sparkline({ data, height = 22, color = C.co2 }: { data: number[]; height?: number; color?: string }) {
  if (data.length < 2) return <View style={{ height }} />;
  const lo = Math.min(...data);
  const span = Math.max(1, Math.max(...data) - lo);
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {data.map((d, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            // A handful of readings should look like bars, not slabs.
            maxWidth: 10,
            height: Math.max(2, ((d - lo) / span) * height),
            backgroundColor: color,
            opacity: 0.35 + 0.65 * ((i + 1) / data.length),
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

const LOG_COLOR: Record<LogLine['kind'], string> = {
  ok: C.greenDim,
  err: C.redDim,
  info: C.dim,
  poll: C.purple,
  scan: C.gold,
  sent: C.blue,
  hint: C.amber,
};

export function LogRow({ line }: { line: LogLine }) {
  return (
    <T style={[s.logLine, line.kind === 'hint' && { paddingLeft: 24 }]}>
      {line.kind !== 'hint' && <Text style={{ color: C.faint }}>[{fmtTime(line.ts)}] </Text>}
      <Text style={{ color: LOG_COLOR[line.kind] }}>{line.text}</Text>
    </T>
  );
}

/** Lays children out in as many equal columns as fit `minWidth`. */
export function Grid<Item>({
  items,
  minWidth,
  gap = 8,
  keyOf,
  render,
}: {
  items: Item[];
  minWidth: number;
  gap?: number;
  keyOf: (item: Item) => string;
  render: (item: Item) => React.ReactNode;
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

// ── overlays ──────────────────────────────────────────────────
// Dialogs and sheets are drawn as layers inside the app rather than as
// separate system windows, so one can sit on top of another on every platform.

function useFadeIn() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 180, useNativeDriver: NATIVE_DRIVER }).start();
  }, [v]);
  return v;
}

/** Runs `onBack` for the Android back button while mounted. */
function useBack(onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ref.current();
      return true;
    });
    return () => sub.remove();
  }, []);
}

/** A panel that rises from the bottom on phones and floats centred on tablets. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width >= TABLET_MIN;
  const v = useFadeIn();
  useBack(onClose);
  return (
    <Animated.View style={[s.backdrop, !wide && { justifyContent: 'flex-end', padding: 0 }, { opacity: v }]} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View
        style={[
          s.sheet,
          wide ? s.sheetWide : s.sheetPhone,
          { maxHeight: height * 0.86 },
          { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
        ]}
      >
        <View style={s.sheetHead}>
          <View style={{ flex: 1 }}>
            <T style={s.sheetTitle}>{title}</T>
            {subtitle ? <T style={s.sheetSub}>{subtitle}</T> : null}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={s.close} hitSlop={8}>
            <Text style={{ color: C.soft, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

type Ask = { title: string; message: string; okOnly?: boolean; yes?: string; danger?: boolean };
const ConfirmCtx = createContext<(a: Ask) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

function Dialog({ ask, close }: { ask: Ask; close: (v: boolean) => void }) {
  const v = useFadeIn();
  useBack(() => close(false));
  return (
    <Animated.View style={[s.backdrop, { opacity: v }]} accessibilityViewIsModal>
      <Animated.View
        accessibilityRole="alert"
        style={[s.dialog, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}
      >
        <T style={s.dialogTitle}>{ask.title}</T>
        <T style={s.dialogMsg}>{ask.message}</T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!ask.okOnly && <Btn label="CANCEL" kind="secondary" onPress={() => close(false)} style={{ flex: 1 }} />}
          <Btn
            label={ask.okOnly ? 'OK' : ask.yes ?? 'YES'}
            kind={ask.danger ? 'danger' : 'primary'}
            onPress={() => close(true)}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

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
      {ask && <Dialog ask={ask} close={close} />}
    </ConfirmCtx.Provider>
  );
}

const TOAST_COLOR = { ok: C.greenDim, warn: C.amber, err: C.redDim } as const;
const TOAST_ICON = { ok: '✓', warn: '⚠', err: '✗' } as const;

/** A short result line that slides in, then clears itself. Tap to dismiss. */
export function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const v = useFadeIn();
  useEffect(() => {
    const t = setTimeout(onDone, toast.kind === 'ok' ? 3200 : 5500);
    return () => clearTimeout(t);
  }, [toast.key, toast.kind, onDone]);
  const color = TOAST_COLOR[toast.kind];
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        s.toastWrap,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
      ]}
    >
      <Pressable onPress={onDone} accessibilityRole="alert" style={[s.toast, { borderColor: color }]}>
        <Text style={{ color, fontSize: 16, fontWeight: '700' }}>{TOAST_ICON[toast.kind]}</Text>
        <T style={s.toastText}>{toast.text}</T>
      </Pressable>
    </Animated.View>
  );
}

export const s = StyleSheet.create({
  off: { opacity: 0.4 },
  btn: {
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 4 },
  btnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center' },
  tile: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileText: { fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' },
  panel: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  panelTitle: { color: C.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  section: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, paddingVertical: 4 },
  help: { color: C.dim, fontSize: 13, lineHeight: 19 },
  tag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  fieldLabel: { color: C.soft, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: C.card,
    color: C.text,
    borderWidth: 1.5,
    borderColor: C.borderHi,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 46,
    fontFamily: MONO,
    fontSize: 16,
  },
  inputFocus: { borderColor: C.accent, backgroundColor: '#1a2644' },
  track: { height: 6, borderRadius: 3, backgroundColor: C.card, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  logLine: { fontFamily: MONO, fontSize: 12, lineHeight: 18, color: C.soft },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000b3',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 50,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.borderHi,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  dialogTitle: { color: C.gold, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  dialogMsg: { color: C.text, fontSize: 15, lineHeight: 22 },
  sheet: { backgroundColor: C.panel, borderColor: C.borderHi, borderWidth: 1, overflow: 'hidden' },
  sheetPhone: { width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 0 },
  sheetWide: { width: '100%', maxWidth: 560, borderRadius: 18 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sheetTitle: { color: C.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  sheetSub: { color: C.dim, fontFamily: MONO, fontSize: 12, marginTop: 2 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastWrap: { position: 'absolute', top: 8, left: 12, right: 12, alignItems: 'center', zIndex: 40 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 520,
    backgroundColor: '#101a33f2',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: { color: C.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
