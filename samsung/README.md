# Samsung Tizen launcher (experimental)

This target reuses `backend/public/v2` for a Samsung TV web application. A signed Tizen shell owns the HDMI API and loads a compiled, server-hosted UI in an iframe. It does **not** replace Samsung Home or provide Android accessibility/overlay services.

**Status:** the precursor was installed on a 2018 QE65Q7FNA running Tizen 4.0. HDMI selection and Select/OK were confirmed on hardware. After HDMI selection the TV backgrounds the app, so Back does not reliably return. The inset-video experiment has no confirmed hardware result. This portable repository target and new Express adapter have automated coverage but have not yet been deployed to that TV. Do not call this feature-complete or use it as a security lock.

See [feature coverage and completion plan](FEATURES.md) for the Android comparison and release gates.

## Build the shared UI

Node.js 18+ is required; CI runs Node 22. From the repository root:

```sh
npm --prefix backend ci
npm --prefix samsung ci
npm --prefix samsung run build
npm --prefix backend test
npm --prefix samsung test
```

The Samsung build compiles the current shared UI with esbuild's Chrome 56 target, supplies compatibility helpers, and overlays a flex layout. It copies symbols into `samsung/dist/web/symbols/`; no private server snapshot is required. Shared UI changes require rebuilding Samsung. Generated files are ignored.

The build adapter exports the shared key handler and calls the Samsung action handler directly, avoiding old-TV synthetic click/custom URL parsing issues. Compiler guards fail if the expected handler changes; review the adapter instead of removing the guard blindly.

## Host the UI and configuration

The existing example backend mounts `/samsung/`, with `/samsung/api/config?tvId=...` and `/samsung/api/action?tvId=...`. It reads the same MongoDB `TVLauncher` records as Android. Build Samsung before starting the backend; follow [backend setup](../backend/README.md), including its network/authentication boundaries. Serve through HTTPS reachable from the TV.

Create a separate Samsung record using the existing `/api/tvlauncher/{tvId}/create` API. Never overwrite an Android TV record. Example data:

```json
{
  "name": "Example room",
  "platform": "samsung-tizen",
  "webAppRevision": "samsung-1",
  "inputs": {
    "HDMI1": {"inputId":"HDMI1","hdmiPort":1,"label":"Streaming box","order":1},
    "HDMI2": {"inputId":"HDMI2","hdmiPort":2,"label":"Receiver","order":2}
  },
  "settings": {"configPollSeconds":20},
  "quickSelect": [],
  "deviceCommands": []
}
```

HDMI mappings use integer `hdmiPort` values 1–4, or IDs `HDMI1`–`HDMI4`. Never reuse Android's opaque input IDs without explicit port mappings. The installed fallback exposes generic ports 1–3; port 4 is available through a configured hosted tile. Inputs can be ordered/hidden and use shared artwork/wallpaper. Hiding a hosted tile is not an access restriction on the local fallback or Samsung itself.

The shell pins its URL at build time; `webAppUrl` in server config does not retarget it. `webAppRevision` reloads the hosted page. Poll intervals are clamped to 5–300 seconds. Last configuration is cached separately per TV ID. Cached config is not a full offline asset cache, and polling pauses when the TV suspends the app.

### Backend actions

Commands are disabled by default. Explicitly configure a trusted HTTPS API base and allowed path prefixes when starting the example backend:

```sh
SAMSUNG_COMMAND_BASE_URL=https://api.example.com/Brain \
SAMSUNG_COMMAND_PREFIXES=/api/devices/ \
npm --prefix backend start
```

These are illustrative values. Keep actual URLs, room IDs and credentials outside committed source. Prefixes must begin and end with `/`; use the narrowest practical paths. No credentials are embedded in the URL. The adapter only forwards configured paths, not browser-supplied destinations, and rejects redirects, encoded/traversal paths, query strings and absolute URLs. Protect both the configuration write API and command endpoints at your deployment boundary; TV IDs and the custom request header are not authentication.

Example quick action:

```json
{"id":"watch","label":"Watch channel","inputId":"HDMI2","url":"/api/devices/7/channel/401","method":"POST","body":{},"requestBeforeInput":true}
```

`url/requestUrl`, `method/requestMethod`, `body/requestBody`, nested settings and `projectorMenu` fallback are supported. Only GET and POST are forwarded. An HTTP error or JSON `error`, `ok:false` or `success:false` prevents switching. Upstream responses must be empty or JSON. If `requestBeforeInput` is omitted it defaults to request-first. Explicit request-after-input is rejected: HDMI can suspend the app before it sends the request.

`refreshConfig` refreshes the hosted configuration. `inputSettings` and `tvSettings` open the app's local controls, **not** Samsung system settings. Other Android actions/intents and `tds:` panels display an unsupported message. `roomStateUrl` uses the shared UI's same-origin state contract; supply an appropriate adapter at the same HTTPS origin.

The hosted Samsung page must be embeddable by its packaged shell; do not inherit the Android route's `frame-ancestors 'none'` header or an upstream `X-Frame-Options: DENY`. The shell checks the exact remote origin and iframe source window before allowing HDMI/menu operations. The remote page never gets direct Tizen APIs.

## Configure and install the shell

Install the official Tizen Studio CLI and Samsung TV/certificate tooling. Enable Developer Mode on the TV, set the current developer-machine IP, restart as required, and create a Samsung certificate profile authorised for that TV.

```sh
cd samsung
cp deployment.example.json deployment.local.json
# Edit remoteUrl and tvId for your server; keep the trailing slash in remoteUrl.
npm run build:shell
TIZEN_SDK_ROOT=/path/to/tizen-studio bash scripts/install.sh TV_IP CERT_PROFILE
```

`deployment.local.json` and generated output are ignored. The generator requires an HTTPS directory URL without credentials/query/fragment, a safe TV ID, and `videoMode` of `inset` (default) or `fullscreen`. Neither mode has a guarantee of keeping the app active on your firmware. The inset mode is a diagnostic experiment. The persistent border/label intentionally makes app visibility obvious; it is not a finished viewing experience.

Output is `dist/tv-app`; the install script builds, signs, permits installation, installs and launches it. Package ID is `HelloTV001`, app ID `HelloTV001.Test`, retained for continuity with the prototype; display name is TV Launcher. If another app already uses that identity, change it consistently in config.xml and install.sh. Signing profiles and keys remain in the SDK/user certificate store, never in Git. The package is copied to `TVLauncher.wgt` because old Samsung installers fail on filenames containing spaces.

The script explicitly deploys to the supplied TV. Building or publishing this repository does not update any installed device. WGT files, SDK downloads, private deployment files and credentials are not GitHub artifacts.

## Controls and failure handling

- Arrows move; Select activates the tile. The outer shell forwards navigation if it receives the key instead of the iframe.
- Clock/Back in the hosted UI opens local controls: generic HDMI, Return to launcher, Reload launcher and Exit app.
- Back while HDMI is embedded calls TVWindow.hide and restores the UI **only while the app is active**.
- If the server does not become ready within 12 seconds, local controls remain available. A late timeout does not interrupt active HDMI viewing.
- Use Samsung Home to reopen the app if the TV has taken control. Home/power/system navigation are not overridden.

Console diagnostics report startup, key events, view state and errors locally. The private prototype's access-log telemetry endpoint has deliberately not been published. CEC settings are left untouched.

## Validation and release

Tests cover compiled shared UI focus/navigation under repeated config updates, direct and forwarded Select, shell origin/source/port checks, offline/source errors, configuration generation, action ordering/failure, aliases, and HTTP action-policy enforcement. These are not a TV emulator and cannot prove firmware behaviour. No claim of native Android compilation is made by the web/Samsung workflow.

Before a usable Samsung release: test each source and audio, short Back, repeated source changes, network loss/recovery, cached config, CEC switches, power/resume, unsupported actions, and a second TV/firmware. Record actual model/firmware and results. See FEATURES.md for details and priorities.

## References

- [Samsung TVWindow API](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/tvwindow-api.html)
- [PiP overlays](https://developer.samsung.com/smarttv/develop/guides/pip-picture-in-picture/showing-pip-overlays.html)
- [Multitasking](https://developer.samsung.com/smarttv/develop/guides/fundamentals/multitasking.html)
- [Return/Exit behaviour](https://developer.samsung.com/smarttv/develop/guides/fundamentals/terminating-applications.html)
