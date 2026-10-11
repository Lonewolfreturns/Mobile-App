// Publisher details and the privacy policy shown in Settings → About.
// docs/PRIVACY_POLICY.md carries the same text for hosting on the web —
// both app stores ask for a public link to it. Keep the two in step.
import app from '../app.json';

export const APP_NAME = app.expo.name;
export const APP_VERSION = app.expo.version;
export const PUBLISHER = 'Innovative Waste Management (IWM)';
// Both stores expect a way to reach you about privacy. Fill this in before
// submitting; the contact line stays hidden while it is empty.
export const PRIVACY_CONTACT = '';
export const POLICY_DATE = '10 October 2026';

export const PRIVACY_SUMMARY = [
  'No account, no sign-in, no advertising, no analytics, no tracking.',
  'The app only talks to chambers on your own WiFi network — never to the internet.',
  'Your settings and copied data files stay on this device unless you share them yourself.',
];

export const PRIVACY_POLICY: { heading: string; body: string }[] = [
  {
    heading: 'What this app does',
    body:
      `${APP_NAME} is a control panel for flux chamber instruments. It connects over your local WiFi ` +
      'network to the chambers at the addresses you enter in Settings, shows their sensor readings, ' +
      'sends them the commands you choose, and copies their measurement files onto your device.',
  },
  {
    heading: 'Information we collect',
    body:
      'None. The app has no accounts and no sign-in. It contains no advertising, analytics, crash ' +
      'reporting or tracking software, and it does not send any information to us or to anyone else.',
  },
  {
    heading: 'Information kept on your device',
    body:
      'The app stores your settings (the chamber address range and timing values) and the measurement ' +
      'files you copy from your chambers. These stay on your device. A file only leaves the device when ' +
      'you choose to share it using your phone or tablet’s own share menu.',
  },
  {
    heading: 'Network use',
    body:
      'The app communicates only with devices on your local network, using private network addresses. ' +
      'It refuses to contact any other address and makes no connections to the internet. The chambers ' +
      'speak plain (unencrypted) HTTP, so use the app on a WiFi network you trust.',
  },
  {
    heading: 'Permissions',
    body:
      'Local network access (iOS) and network access (Android) are used only to reach your chambers. ' +
      'Vibration is used only for touch feedback. The app does not ask for your location, contacts, ' +
      'camera, microphone, photos or any other personal information.',
  },
  {
    heading: 'Demo mode',
    body:
      'Demo mode shows simulated chambers so the app can be tried without hardware. In demo mode the ' +
      'app does not use the network at all.',
  },
  {
    heading: 'Children',
    body: 'The app is a professional instrument tool and is not directed at children. It collects no information from anyone.',
  },
  {
    heading: 'Deleting your data',
    body:
      'You can delete any copied data file inside the app. Uninstalling the app removes its settings and ' +
      'every file it saved.',
  },
  {
    heading: 'Changes to this policy',
    body: 'If this policy changes, the new version will be published with a new effective date.',
  },
];
