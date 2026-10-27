<p align="center">
  <img src="assets/icon.png" alt="Flux Chamber Hub icon" width="96" />
</p>

<h1 align="center">Flux Chamber Hub</h1>

<p align="center">
  A phone and tablet control panel for ESP32 flux chamber instruments used in soil gas research.<br />
  Built with Expo and React Native for Android and iOS.
</p>

---

Flux Chamber Hub finds the chambers on your WiFi network, shows their live CO₂, temperature and humidity readings, sends them commands, and copies their measurement files onto your device. It talks only to devices on the local network and never connects to the internet.

## Features

- **Monitor**: scans a range of IP addresses, shows each chamber as a tile with its latest readings and a CO₂ trend, and keeps polling the ones that are online. Tap a tile for a detail sheet with a larger trend chart and controls for just that chamber.
- **Control**: sends a command to every online chamber, one chamber at a time, in order:
  - open or close the lids
  - start or stop recording
  - set the chamber clocks to now, or to a specific time
  - save the logging interval and lid open/close times
  - apply a CO₂ sensor calibration
  - copy each chamber's data file (CSV) to the device
- **Data files**: on Android you pick a folder once (for example Documents). Files then go into `Flux Chamber Hub/<date>/` there, with no storage permission needed. On iOS they appear in the Files app under *On My iPhone/iPad*. Saved files can be shared or deleted from inside the app.
- **Log**: a full record of scans, polls and HTTP requests. The Control tab also has a short "What happened" log with a hint for each failure.
- **Demo mode**: simulated chambers that don't use the network, so you can try every screen without hardware (useful for new operators and app store reviewers).
- **Adaptive layout**: phones get a bottom tab bar, and wide screens (tablets in landscape) get a side rail.

## Chamber protocol

The app expects chambers running the `WiFi_Function.ino` firmware, which uses the same wire format as the desktop dashboard (v3.6). All requests are plain HTTP; POST bodies are `application/x-www-form-urlencoded`.

| Method | Path | Fields | Purpose |
| --- | --- | --- | --- |
| GET | `/monitor` | | Live sensor data (CO₂, temperature, humidity, UID, lid, log state, cycle) |
| POST | `/lid` | `LidAction` = `open` \| `close` | Manual lid control |
| POST | `/logging` | `LoggingAction` = `start` \| `stop` | Start or stop data logging |
| POST | `/config` | `LogInterval`, `LidOpenT`, `LidCloseT` | Chamber timing |
| POST | `/submit` | `CalCO2`, `CalALT`, `CalTemp` | SCD30 sensor calibration |
| POST | `/set_time` | `Timestamp` | Set the real-time clock |
| GET | `/download` | | Fetch `<UID>_data.csv` |

See [src/api.ts](src/api.ts) for the client and response parsing.

### Network safety

Every request goes through `assertLocal()` in [src/net.ts](src/net.ts), which only allows private (RFC 1918) and link-local addresses. Loopback is allowed only while developing (`__DEV__`). Chamber responses are size-capped (64 KB for pages, 50 MB for CSVs), redirects are refused, and downloaded file names are sanitised before anything is written to disk.

## Default settings

These can all be changed in the **Settings** tab.

| Setting | Default | Range |
| --- | --- | --- |
| Base IP address | `192.168.8.` | private ranges only |
| First device number | `101` | 1–254 |
| Number of devices | `16` | 1–100 |
| Refresh readings every | `5` s | 1–300 s |
| Give up on a chamber after | `4` s | 1–30 s |

With the defaults, the app looks for chambers at `192.168.8.101` to `192.168.8.116`.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- An Android or iOS device, or an emulator/simulator
- An [Expo account](https://expo.dev/signup) if you want to build with EAS

### Install and run

```bash
npm install
```

```bash
npm start
```

This starts the Expo dev server. Press `a` for Android or `i` for iOS, or scan the QR code with your device.

> **Note:** The app's network settings (cleartext HTTP on Android, local-network access on iOS) and its file-saving setup come from `app.json` and config plugins. They only take effect in builds made from this project, not in Expo Go. Demo mode works anywhere. To talk to real chambers, use a development or preview build (see below).

### Checks

```bash
npx tsc --noEmit
```

```bash
npx expo-doctor
```

## Building with EAS

Build profiles are defined in [eas.json](eas.json).

| Profile | Output | Use |
| --- | --- | --- |
| `preview` | Android `.apk`, internal distribution | Side-loading onto test devices |
| `production` | Android `.aab` / iOS archive, auto-incremented build number | Store submission |

```bash
npx eas-cli@latest build -p android --profile preview
```

```bash
npx eas-cli@latest build -p android --profile production
```

```bash
npx eas-cli@latest build -p ios --profile production
```

```bash
npx eas-cli@latest submit -p ios
```

The `ios/` and `android/` folders are generated at build time (Continuous Native Generation) and are git-ignored. Change native behaviour through `app.json` and config plugins, not by editing those folders.

For the full store checklist (Google Play data safety, App Store review notes, upcoming platform deadlines), see [docs/STORE_SUBMISSION.md](docs/STORE_SUBMISSION.md).

## Project structure

```
.
├── App.tsx                 # App shell: top bar, tabs/rail, error boundary
├── index.ts                # Entry point
├── app.json                # Expo config (bundle IDs, permissions, plugins)
├── eas.json                # EAS Build profiles
├── assets/                 # App icon, splash, adaptive icon, logo
├── store-assets/           # Store listing graphics
├── docs/
│   ├── PRIVACY_POLICY.md   # Privacy policy to host publicly
│   └── STORE_SUBMISSION.md # Google Play / App Store checklist
└── src/
    ├── api.ts              # Chamber HTTP protocol and response parsing
    ├── net.ts              # Local-network-only address checks
    ├── demo.ts             # Simulated chambers for demo mode
    ├── files.ts            # Saving, listing, sharing and moving CSV files
    ├── store.tsx           # App state: settings, devices, scan/poll, commands, logs
    ├── legal.ts            # Publisher info and in-app privacy policy
    ├── haptics.ts          # Haptic feedback helpers
    ├── theme.ts            # Colours and layout constants
    ├── ui.tsx              # Shared UI components
    ├── util.ts             # Formatting and helpers
    └── screens/
        ├── MonitorScreen.tsx
        ├── ControlScreen.tsx
        ├── SettingsScreen.tsx
        ├── LogScreen.tsx
        └── DeviceSheet.tsx # Per-chamber detail sheet
```

## Privacy

The app has no accounts, analytics, ads or tracking, and collects no data. Settings and copied data files stay on the device unless you share them. The full policy is in [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md) and inside the app under **Settings → About & Privacy**. Keep the two copies in step with [src/legal.ts](src/legal.ts).

## License

See [LICENSE](LICENSE).
