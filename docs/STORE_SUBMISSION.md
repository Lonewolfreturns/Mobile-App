# Submitting Flux Chamber Hub to Google Play and the App Store

What the app already does for review, what only you can do, and the text to
paste into each store's forms.

## Do these first

1. **Privacy contact.** Put a contact email in `src/legal.ts`
   (`PRIVACY_CONTACT`) and at the bottom of `docs/PRIVACY_POLICY.md`.
2. **Host the privacy policy** at a public web address (GitHub Pages is
   enough). Both stores require the link.
3. **Confirm the names.** Publisher is shown as "Innovative Waste Management
   (IWM)" (`src/legal.ts`). The app ID is `com.fieldops.fluxchamberhub` on both
   platforms (`app.json`). The ID is permanent once the app is published.

## Already handled in the app

| Store concern | How it is met |
| --- | --- |
| Reviewer has no chambers | **Demo mode** (Settings, or "Try demo mode" on first launch) runs every screen on simulated chambers |
| Plain HTTP traffic | iOS allows local-network HTTP only (`NSAllowsLocalNetworking`); the app itself refuses any address outside private ranges (`src/net.ts`) |
| iOS local network prompt | Purpose string explains why (`NSLocalNetworkUsageDescription`) |
| iOS privacy manifest | Required-reason APIs declared; tracking off; no data collected |
| iOS export compliance | Declared as using no encryption |
| Android permissions | Internet and Vibrate only; storage and overlay permissions removed |
| Android backups | App data excluded from cloud backup |
| Privacy policy in the app | Settings → About & Privacy |
| Crashes | A failed screen shows a recovery page instead of closing |
| Tablets | Layout adapts to phone, tablet, portrait and landscape |

## Google Play

- **Build:** `npx eas-cli build -p android --profile production` (makes the
  `.aab` Play wants; the `preview` profile makes an `.apk` for testing).
- **Data safety form:** the app collects no data and shares no data.
- **App access:** all features are available without login. Add the note:
  "The app controls instruments on the local network. To review without
  hardware, open Settings and turn on Demo mode."
- **Ads:** none. **Target audience:** adults / professional users.
- **Listing graphics:** icon is `store-assets/play-store-icon-512.png`. You
  still need a 1024 × 500 feature graphic and screenshots (phone, and 7" and
  10" tablet if you list tablet support).
- New personal developer accounts must run a closed test before going to
  production; Play Console shows the current tester and duration requirement.

## App Store

- **Build and upload:** `npx eas-cli build -p ios --profile production`, then
  `npx eas-cli submit -p ios`. Needs an Apple Developer Program membership.
- **App Privacy:** choose "Data Not Collected".
- **Age rating:** 4+.
- **Screenshots:** one iPhone set and one iPad set.
- **App Review notes** (paste this):

  > Flux Chamber Hub is a companion app for ESP32-based flux chamber
  > instruments used in soil gas research. It talks to the instruments over
  > the local WiFi network using plain HTTP, which is why it asks for Local
  > Network access; it makes no internet connections and collects no data.
  >
  > To review without the hardware: launch the app, tap "TRY DEMO MODE" on
  > the first screen (or Settings → Demo mode). The Monitor tab then shows
  > simulated chambers; tap one for its detail sheet, and use the Control tab
  > to send commands. Demo mode does not use the network.

## Things that will need attention later

- **Android 17 (target SDK 37).** Android will block local-network traffic
  unless the app declares and requests `ACCESS_LOCAL_NETWORK`. The app
  currently targets SDK 36, where Google says not to add it. When you upgrade
  to an Expo SDK that targets 37, add the permission to `app.json` and request
  it before the first scan — otherwise scans will time out on new phones.
- **Google Play target API deadline.** Play raises the minimum target SDK each
  year (usually 31 August). Upgrading the Expo SDK once a year keeps up.
- **Apple SDK deadline.** Apple requires builds made with the current Xcode
  each spring; EAS Build picks this up when the Expo SDK is upgraded.
