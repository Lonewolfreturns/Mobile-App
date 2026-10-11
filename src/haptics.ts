// Small taps and buzzes so a press feels like it landed, even with gloves
// on or the screen in bright sun. Never allowed to throw — a phone with
// vibration switched off must behave exactly the same otherwise.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const on = Platform.OS === 'ios' || Platform.OS === 'android';
const quiet = (p: Promise<void>) => p.catch(() => {});

export const tap = () => on && quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const thud = () => on && quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const tick = () => on && quiet(Haptics.selectionAsync());
export const buzzOk = () => on && quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const buzzWarn = () => on && quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const buzzFail = () => on && quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
