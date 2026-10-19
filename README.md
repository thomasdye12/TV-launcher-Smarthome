# Projector Launcher

An experimental [Samsung Tizen target](samsung/README.md) now reuses the hosted UI. See its [feature coverage and completion plan](samsung/FEATURES.md): HDMI selection was tested in the precursor, but Back after HDMI and full-screen app retention remain unresolved. Android instructions below remain unchanged.

A tiny Android TV launcher for projector-style setups.

The first version intentionally does very little:

- shows connected TV inputs discovered through Android's `TvInputManager`
- launches an input when selected
- hides, restores, and renames inputs from an admin page
- polls a JSON config server for config and wallpaper
- can lock the launcher from server config
- can require QR-based approval for Admin
- shows a QR code for Admin approval
- shows a large clock, including an idle full-screen clock

## Remote Controls

- D-pad: move between sources and the clock
- Select / OK on a source: open the selected input
- Select / OK on the clock: open Admin
- Menu: open Admin
- Admin Select / OK on an input: rename, hide/show, or open it
- Admin Select / OK on settings rows: open TV/input/projector settings, refresh config, or open update URL
- Admin Back: return to the launcher

## Server Config

The launcher uses this TV id format:

```text
{manufacturer}-{model}-{android_id}
```

It reads and creates config using the endpoints in `AuthValidationAndTVLauncherAPI.md`.

There is also a public-safe Express/MongoDB example in [backend/README.md](backend/README.md). It stores launcher config, accepts the TV's `deviceStatus` patches, and includes optional proxy routes for notifications, input selection, key/action requests, and reading the TV-local `/options` endpoint.

Supported JSON shape:

```json
{
  "name": "Kitchen TV",
  "subtitle": "Use the remote to choose an input",
  "room": "Kitchen",
  "uiVersion": 2,
  "webAppUrl": "/tvlauncher/v2/",
  "webAppRevision": "2026-10-18.1",
  "launcherVersion": "0.2.1",
  "inputs": {
    "input_Y29tLnRjbC50dmlucHV0Ly5UdlBhc3NUaHJvdWdoU2VydmljZS9IVzE2": {
      "inputId": "com.tcl.tvinput/.TvPassThroughService/HW16",
      "label": "Sky",
      "hidden": false,
      "order": 10,
      "icon": "tv",
      "iconImageUrl": "https://example.local/icons/sky.png",
      "fallbackIntentAction": "com.android.tv.action.VIEW_INPUTS"
    }
  },
  "projectorMenu": [
    {
      "id": "projector-settings",
      "label": "Projector",
      "icon": "tv",
      "order": 90,
      "action": "projectorSettings"
    },
    {
      "id": "picture-settings",
      "label": "Picture",
      "icon": "app",
      "order": 100,
      "intentAction": "android.settings.DISPLAY_SETTINGS"
    }
  ],
  "quickSelect": [
    {
      "id": "sky-sports",
      "label": "Sky Sports",
      "icon": "tv",
      "order": 10,
      "inputId": "android.tv.input/.Service/HW1",
      "url": "https://example.local/api/skyq/channel/401",
      "method": "POST",
      "body": {
        "room": "lounge"
      },
      "requestBeforeInput": true
    }
  ],
  "deviceCommands": [
    {
      "id": "projector-settings",
      "label": "Projector",
      "icon": "tv",
      "order": 10,
      "action": "projectorSettings"
    },
    {
      "id": "picture-settings",
      "label": "Picture",
      "icon": "app",
      "order": 20,
      "intentAction": "android.settings.DISPLAY_SETTINGS"
    },
    {
      "id": "sleep",
      "label": "Sleep",
      "icon": "lock",
      "order": 30,
      "url": "/api/tvlauncher/TV_ID/local/action/sleep",
      "method": "GET"
    }
  ],
  "update": {
    "versionCode": 6,
    "versionName": "0.3.0",
    "apkUrl": "https://example.local/projector-launcher-0.3.0.apk",
    "sha256": "optional-release-sha256",
    "required": false,
    "channel": "stable"
  },
  "remoteControl": {
    "enabled": true,
    "onlyWhenInputActive": true,
    "longPressMs": 650,
    "keys": {
      "KEYCODE_DPAD_LEFT": {
        "url": "https://example.local/api/skyq/remote/left",
        "method": "POST",
        "consume": true,
        "longPress": {
          "url": "https://example.local/api/skyq/remote/rewind",
          "method": "POST"
        }
      }
    }
  },
  "notificationServer": {
    "enabled": true,
    "duration": 8,
    "position": 1
  },
  "settings": {
    "requiredService": "example.tvlauncher.admin",
    "unlockRequiredService": "example.tvlauncher.unlock",
    "adminAuthRequired": true,
    "lockScreenEnabled": false,
    "configPollSeconds": 20,
    "screensaverSeconds": 300,
    "sleepWallpaperDimAlpha": 220,
    "homeClockYOffsetDp": 42,
    "sleepClockYOffsetDp": 120,
    "lockedClockYOffsetDp": 0,
    "unlockValidationSeconds": 14400,
    "activeInputSeconds": 21600,
    "burnInShiftDp": 28,
    "burnInPeriodSeconds": 240,
    "backgroundImageUrl": "https://example.local/wallpaper.jpg",
    "updateApkUrl": "https://example.local/projector-launcher.apk"
  }
}
```

`name`, `subtitle`, `backgroundImageUrl`, labels, hidden states, projector menu items, lock state, auth requirement, unlock auth requirement, poll interval, screensaver timeout, and update URL are polled from the server. Rename/hide changes made in Admin patch the top-level `inputs` key through `/api/tvlauncher/{tvId}/keys`, so the server remains the source of truth.

UI versions:

- Omit `uiVersion` or set it to `1` to retain the original launcher on existing TVs.
- Set top-level `uiVersion` (or `settings.uiVersion`) to `2` to enable V2 for an individual TV.
- Set `webAppUrl` (top-level or under `settings`) to load V2 from the server. Relative paths beginning with `/` resolve against `tvLauncherBaseUrl`.
- When `webAppUrl` is absent, V2 uses the APK's native V2 renderer. When the hosted page cannot load, the APK falls back to that native renderer automatically.
- V2 reads its right-hand buttons from `deviceCommands`. If that key is absent, existing `projectorMenu` items are used as a compatibility fallback.

Hosted V2:

- The buildless HTML/CSS/JavaScript app lives in `backend/public/v2` and the example Express server publishes it at `/tvlauncher/v2/`.
- The native shell supplies `tvId` and its installed version as query parameters, then injects the configuration it already polls from the launcher API. This allows the static UI to live on a separate HTTPS origin without weakening API CORS policy.
- Static web assets are served with revalidation. Increment `webAppRevision` after publishing HTML/CSS/JavaScript to make each open V2 launcher reload itself on its next config poll.
- Input selection, quick actions, device commands, and Admin use a restricted `tvlauncher://` navigation bridge. No general JavaScript interface is exposed to the page.
- The WebView only permits top-level navigation within the configured web-app origin; Android safe browsing and mixed-content blocking remain enabled.
- Keep lock/auth enforcement, input discovery, notifications, remote-control interception, and offline behavior native. The hosted page should remain a presentation and interaction layer.
- Optional `roomStateUrl` must be on the hosted page's origin. Return `{"states":{"lights":{"state":"on","active":true,"label":"On"}}}` and bind tiles using `stateKey`. Each installation supplies its own state adapter; private room integrations and deployment configs are not part of this repository.
- The hosted UI supports `iconType` values `sky`, `apple`, `bulb`, `speaker`, `guide`, `controls`, `f1`, and `tv`, or a custom `iconImageUrl`. Navigation preserves tile focus across state/config polls.

Wallpaper images are cached on the TV after the first successful download. On the next launcher start, the cached image is shown immediately while the launcher polls the server for config and checks whether the image has changed.

Sleep clock options:

- `screensaverSeconds`: seconds of home-screen inactivity before the large clock appears. `0` disables it.
- `sleepWallpaperDimAlpha`: black overlay during idle/locked clock mode. `0` leaves the wallpaper bright, `255` makes it fully black.
- `homeClockYOffsetDp`: moves the normal top-right home clock down. Increase for lower placement, decrease or use a negative value to move it back up.
- `sleepClockYOffsetDp`: moves the large idle clock down. Increase for lower placement, decrease or use a negative value to move it back up.
- `lockedClockYOffsetDp`: moves the large locked-screen clock separately so it does not cover the lock message.
- `burnInShiftDp`: maximum clock drift in density-independent pixels. `0` disables movement.
- `burnInPeriodSeconds`: how long the horizontal drift takes to complete a full cycle.

Lock behavior:

- `requiredService` controls Admin approval. Default: `example.tvlauncher.admin`.
- `unlockRequiredService` controls unlocking a locked TV. Default: `example.tvlauncher.unlock`.
- `unlockValidationSeconds` controls how long an approved unlock lasts. Default: `14400` seconds / 4 hours.
- When `lockScreenEnabled` is true, OK opens the unlock QR flow.
- Admin includes a `Lock TV now` row that sets server `lockScreenEnabled` to true.
- Menu still opens the Admin QR flow.
- Admin includes logout rows to clear cached Admin approval and cached TV unlock approval.
- If the launcher cannot connect to the server during boot/config refresh, it enters an offline lock state. OK/Up opens network or Wi-Fi settings, Menu opens TV settings, and Down retries the server connection.

Input icon options:

- `icon`: preset name. Current presets are `tv`, `hdmi`, `camera`, `game`, and `app`.
- `iconImageUrl`: custom PNG/JPG/WebP image URL. This takes priority over the preset.
- `order`: lower numbers appear first. Inputs with `order` appear before inputs without `order`; unordered inputs then stay in the TV's detected order.
- `fallbackIntentAction`: optional action to open when the standard Android passthrough input launch is not supported by the device. XGIMI projectors can use `com.android.tv.action.VIEW_INPUTS` to open the projector's source chooser.

When an input is launched, the launcher sends the custom `label` as the intent title and shows it briefly as an overlay toast. The vendor Live TV/input app may still show its own built-in HDMI name because Android does not expose a standard way for a launcher app to rename the TV firmware's input overlay.

Projectivy's bundled icons are not directly available to this launcher, but any exported or hosted icon image can be used through `iconImageUrl`.

Projector menu options:

- Put menu items in top-level `projectorMenu` or `settings.projectorMenu`.
- `action` can be `projectorSettings`, `inputSettings`, `tvSettings`, `refreshConfig`, or `update`.
- `intentAction` can be used instead of `action` for a device/vendor settings intent.
- Menu items support the same `icon` and `iconImageUrl` fields as inputs.
- Menu items also support `order`; lower numbers appear first in the menu group after the inputs.

Quick select options:

- Put quick actions in top-level `quickSelect` or `settings.quickSelect`.
- `inputId` is the Android TV input to open after selecting the tile.
- `url` / `requestUrl` is called when the tile is selected. Absolute URLs are used directly; paths starting with `/` are resolved against `tvLauncherBaseUrl`.
- `method` / `requestMethod` supports `GET` or `POST`. Non-GET requests send `body` / `requestBody` as JSON.
- `requestBeforeInput` defaults to `true`. Set it to `false` if the input should open before the backend request is sent.
- Quick-select tiles support `icon`, `iconImageUrl`, and `order`.

Device command options:

- Put V2 command buttons in top-level `deviceCommands` or `settings.deviceCommands`.
- A command can use a launcher `action`, an Android `intentAction`, or a backend `url` / `requestUrl` with `method` and optional JSON `body`.
- Built-in actions are `projectorSettings`, `inputSettings`, `tvSettings`, `refreshConfig`, `update`, `lock`, and `controlPanel`.
- Relative URLs beginning with `/` resolve against `tvLauncherBaseUrl`, so a command can call the existing per-TV local proxy routes.
- `hidden`, `order`, `icon`, and `iconImageUrl` behave the same way as other server-driven tiles.

Fleet updates:

- Prefer the top-level `update` object over the legacy `settings.updateApkUrl` string. The legacy field remains supported.
- `versionCode` is the authoritative comparison value; `versionName` is display text. `apkUrl` is opened by the Admin update row.
- `required` marks a release as mandatory in the UI; it does not bypass Android's package-installer confirmation.
- `channel` and `sha256` are reserved for server-side rollout selection and verified downloading. See [FLEET_UPDATES.md](FLEET_UPDATES.md) for the recommended staged rollout model.
- Device status now reports the real Gradle `launcherVersion`, `launcherVersionCode`, and active `uiVersion`, avoiding drift from a hard-coded version string.

Remote bridge options:

- Put remote bridge config in top-level `remoteControl` or `settings.remoteControl`.
- The user must enable `Projector Launcher Remote Bridge` in Android Accessibility settings on each TV.
- `enabled` must be `true` before the service sends requests.
- `onlyWhenInputActive` defaults to `true`; this keeps key interception limited to the period after the launcher opens an input.
- Set `alwaysActive: true` on an individual key action when that key must work everywhere. It overrides `onlyWhenInputActive` for that key only.
- `settings.activeInputSeconds` controls how long an opened input is treated as active. Default: `21600` seconds / 6 hours.
- `keys` maps Android key names or numeric key codes to request actions.
- `inputs` can hold per-input key maps. Use the launcher input object key (or its raw Android `inputId`) and put mappings under `keys`. An active input's mapping wins; missing keys fall back to the global `remoteControl.keys` map.
- Add a `longPress` request action to a key to send it once when the button is held. Releasing before the threshold sends only the normal key action; releasing after it does not send the normal action again.
- `longPressMs` sets the remote-wide hold threshold and defaults to `650` milliseconds. A key-level `longPressMs` overrides it. Values are limited to `200`–`5000` milliseconds.
- Long-press actions accept the same `url` / `requestUrl`, `method` / `requestMethod`, and `body` / `requestBody` fields as normal actions. Missing fields inherit from the normal action.
- `consume` defaults to `true`. Active-input keys are consumed while an input is marked active; an `alwaysActive` key can be consumed everywhere. Set `consume: false` to send the backend request while still allowing the foreground app to receive the key.
- The TCL numbers button (vendor keycode `4056`) is sent on key-down because this firmware does not emit its key-up event. Duplicate down events are debounced. Other unusual vendor buttons can opt into the same behaviour with `sendOnDown: true`.

Device status:

- The launcher patches a top-level `deviceStatus` object back to the server when the IP changes and periodically while online.
- `deviceStatus` includes `ipAddress`, `notificationUrl`, `notificationStatusUrl`, `notificationServerEnabled`, `launcherVersion`, `manufacturer`, `model`, and `lastSeen`.

Notification server:

- Put notification settings in top-level `notificationServer` or `settings.notificationServer`.
- The built-in local TV API listens on port `7980`.
- `GET /status` returns a JSON status payload.
- `GET /config` and `GET /options` return the TV status, last server config, detected inputs, remote-control config, notification config, supported endpoints, and common keycode options.
- `GET /inputs` returns just the detected TV input IDs and labels.
- `POST /notify` accepts JSON with `title`, `message`, `duration`, `position`, `backgroundColor`, `titleColor`, `titleSize`, `messageColor`, `messageSize`, PiPup-style `media.image.uri` / `media.image.width`, and live fMP4 WebSocket video through `media.video.uri`.
- `GET /panel` opens a focusable quick-control panel over the bottom quarter of the current picture. `GET /panel/hide` closes it. Use `/panel`, `http://127.0.0.1:7980/panel`, or `tds://panel` as a remote key's custom URL and set that key to `alwaysActive: true`. These URLs are dispatched internally when used by the remote bridge, avoiding URL rewriting and a cleartext loopback HTTP request.
- Configure the panel with top-level `controlPanel` or `settings.controlPanel`, using `title`, `duration`, `heightDp`, `backgroundColor`, and a `buttons` array. Each button accepts `label`, `icon`, `url`, `method`, and `body`. An unconfigured panel shows an empty state and sends no device commands. When upgrading from a custom build with built-in buttons, move those buttons into per-TV configuration first.
- Direct `imageurl` / `imagewidth` fields are also accepted.
- Video fields include `uri`, `width`, `height`, `aspectRatio` (default `16:9`), `muted` (default `true`), and `resizeMode` (`zoom` or `fit`). Direct `videourl` / `videowidth` / `videoheight` fields are also accepted.
- `POST /input` with `{ "inputId": "..." }` opens a connected TV input by Android input ID.
- `GET /input/{url-encoded-input-id}` also opens an input.
- `POST /key` with `{ "keyCode": "KEYCODE_BACK" }` or `{ "keyCode": 4 }` sends an Android keycode.
- `GET /key/KEYCODE_BACK` and `GET /key?keyCode=4` are also supported.
- Android TV firmware may block injected keys from non-system apps when another app/input is focused. The API returns `ok:false` with the Android error if that happens.
- `POST /action` with `{ "action": "sleep" }` or `GET /action/sleep` runs an Accessibility global action. Supported names include `back`, `home`, `recents`, `notifications`, `quick-settings`, `power-dialog`, `sleep`, `lock-screen`, and `screenshot` where Android supports them.
- `GET /action/input-settings` opens the TV input settings/input picker when the firmware exposes one.
- If `/key` is blocked by Android, known system keys fall back automatically: `KEYCODE_BACK`, `KEYCODE_HOME`, `KEYCODE_SLEEP`, `KEYCODE_POWER`, and `KEYCODE_TV_INPUT`.
- `GET /sleep` is a shortcut for the `sleep` Accessibility action. The Accessibility service must be enabled.
- To show over HDMI/input apps, Android must allow overlay windows for the launcher. On many Android TVs this needs ADB:

```sh
adb shell appops set com.tds.projectorlauncher SYSTEM_ALERT_WINDOW allow
```

Example:

```sh
curl -X POST http://TV_IP:7980/notify \
  -H 'Content-Type: application/json' \
  -d '{
    "duration":45,
    "title":"Front door",
    "message":"Someone is at the door",
    "backgroundColor":"#ffffff",
    "titleColor":"#0066cc",
    "titleSize":"20",
    "messageColor":"#000000",
    "messageSize":14,
    "media":{"image":{"uri":"https://example.local/snapshot.jpg","width":800}}
  }'
```

Live UniFi-style fMP4 WebSocket example:

```sh
curl -X POST http://TV_IP:7980/notify \
  -H 'Content-Type: application/json' \
  -d '{
    "duration":45,
    "title":"Front door",
    "media":{"video":{
      "uri":"wss://cctv.example.com/api/2.0/ws/camera/CAMERA_ID/live?TDSAuthorization=SHORT_LIVED_TOKEN",
      "aspectRatio":"16:9",
      "muted":true,
      "resizeMode":"zoom"
    }}
  }'
```

Use a short-lived camera URL or token because the TV-local notification endpoint uses HTTP on the LAN.

Input and key examples:

```sh
curl http://TV_IP:7980/config
curl http://TV_IP:7980/inputs

curl -X POST http://TV_IP:7980/input \
  -H 'Content-Type: application/json' \
  -d '{"inputId":"android.tv.input/.Service/HW1","label":"Sky Q"}'

curl -X POST http://TV_IP:7980/key \
  -H 'Content-Type: application/json' \
  -d '{"keyCode":"KEYCODE_DPAD_CENTER"}'

curl http://TV_IP:7980/action/sleep
```

## Building

This is a standard Android Gradle project. Open the folder in Android Studio, let it install the Android Gradle plugin if needed, then run the `app` configuration.

Private server settings are supplied through Gradle properties. Copy the example file and edit it for your environment:

```sh
cp gradle.properties.example gradle.properties
```

```properties
tvLauncherBaseUrl=https://example.com/Brain
tvLauncherAdminService=example.tvlauncher.admin
tvLauncherUnlockService=example.tvlauncher.unlock
```

`gradle.properties` is ignored by Git so a public repository can keep real internal URLs and access keys out of source control.

From a configured command line:

```sh
./gradlew assembleDebug
```

## Device Notes

Android TV input launching is vendor-sensitive. The app uses the standard passthrough-input URI:

```java
TvContract.buildChannelUriForPassthroughInput(inputId)
```

That works on many Android TV devices, but some projector firmware may route HDMI/input switching through private activities or settings panels. If your device lists inputs but does not switch to them, the launcher can be adapted once we inspect the projector's installed packages and intents with ADB.

## Target Devices

The first devices to validate are:

- TCL TV
- XGIMI projector
- Sharp TV

For each device, check:

- The device/status line shows the expected manufacturer and model.
- The detected input count matches the connected HDMI/TV inputs.
- Selecting each visible input switches to the correct source.
- Hiding an input removes it from the main screen.
- Opening hidden inputs and restoring one returns it to the main screen.

If a device shows no inputs, or shows inputs but cannot launch them, capture this from ADB:

```sh
adb shell dumpsys tv_input
adb shell pm list packages | grep -i -E 'input|tv|hdmi|source|xgimi|tcl|sharp'
```

Those two outputs will tell us whether the device supports the standard Android TV input path or needs a vendor-specific fallback.
