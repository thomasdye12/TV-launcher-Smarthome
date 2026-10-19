# Android / Samsung coverage and completion plan

Assessment: 19 October 2026. Android reference: repository main at `96fd536`. Samsung public target: experimental 0.1.0, derived from the separately installed 1.2.4 prototype. Version numbers are separate; this commit is not a TV deployment.

“Feature complete” must mean complete against a defined Samsung scope, not unrestricted TV control. A standard Tizen app cannot reproduce Android's system-level launcher/accessibility services. Distinguish implemented web behaviour from observed hardware support.

| Feature | Android reference | Samsung target | Remaining work / acceptance |
| --- | --- | --- | --- |
| Shared tiles, artwork, wallpaper, order/hide | Implemented | Same UI compiled for old browser | Physical focus/rendering check on each supported TV |
| Configuration polling and web revision | Implemented | Implemented; bounded interval and per-TV cache | Network-loss/recovery test on hardware |
| HDMI discovery and selection | Android TvInputManager | Tizen VIDEOSOURCE + TVWindow | Precursor selection confirmed; test portable build and all ports/audio |
| Return from HDMI with Back | Vendor/native input behaviour | Handler implemented, hardware blocked by backgrounding | **P0:** resolve lifecycle/CEC/video embedding before stable release |
| Remote Select / arrows | Native/WebView | Direct action + focus/key forwarding | Precursor Select confirmed; regression test on portable build |
| Backend quick select / room commands | GET/POST plus native actions | Allowlisted GET/POST, aliases, request-first semantics | Test real device success/failure; request-after-input explicitly unsupported |
| Room live-state indicators | Same-origin adapter | Shared renderer retained | Supply a Samsung room adapter; verify poll/error UI on hardware |
| Local fallback | Native renderer / offline lock | Installed generic HDMI controls | Different semantics; no security lock, full wallpaper or web-asset cache |
| Rename/hide from Admin | Server patch / approval flow | Configure on server only | **P1:** authenticated configuration editor if required; never emulate Android approval with an unprotected menu |
| QR Admin approval / unlock | Native service-based flow | Not implemented | **P1:** design a Samsung-specific auth client and protected fallback; cannot enforce whole-TV lock |
| Idle clock / burn-in movement | Native settings | Basic clocks only | **P1:** foreground idle overlay and drift; reset on keys, suspend during HDMI and preserve focus |
| Device heartbeat / installed version | Native reporting | Not implemented | **P1:** scoped heartbeat while active, capability manifest and stale-status presentation; no background guarantee |
| Notification overlays / fMP4 camera video | Android overlay service | Not implemented | **P2:** foreground notification UI only; test media codecs and lifecycle; no promise of overlaying other apps |
| Remote key interception over external apps | Accessibility service | No equivalent implemented | Outside normal consumer-app scope; app-local keys only |
| TV-local HTTP API / injected keys | Native port 7980 service | Not implemented | Do not expose Android proxy routes as Samsung capabilities; use supported external automation separately |
| Settings / power / sleep / Home | Android intents / accessibility | Samsung system owns them | Use original remote; app-local controls are not system settings |
| Lock TV / block other apps | Android launcher policy | Cannot enforce globally | Explicitly excluded from Samsung release promises |
| CEC device switching | TV/device controlled | Settings unchanged | **P0:** test coexistence; any diagnostic change must be reversible and must not silently remove this requirement |
| Automatic startup / default Home | Android launcher | Not implemented | Firmware/user settings may differ; document verified device behaviour only |
| Updates / fleet rollout | APK metadata and installer | Signed WGT development deployment + hosted UI updates | **P2:** supported distribution/signing strategy, version reporting and staged hardware validation |

## P0 — make a dependable input launcher

1. Capture the current inset experiment's physical result. The precursor emitted watch then hidden roughly 0.78 seconds later with full-screen HDMI; that proves backgrounding, not its cause.
2. Compare inset/fullscreen with a persistent app marker, visibility events and key events. Change one variable at a time. Test more than one HDMI device and distinguish an input switch from a CEC active-source event. Do not keep changing Back handlers if the app is already suspended.
3. If the app can stay active, prove return-to-launcher, video/audio and repeat switching. Only then remove experimental chrome and make full-screen the default.
4. If public TVWindow cannot meet this TV's requirement, publish the limitation and settle on an explicit Home/reopen or separately controlled automation workflow. Do not promise a firmware takeover.
5. Verify hosted configuration/actions and offline fallback on the portable build. Android remains on its existing routes and source UI.

## P1 — complete the supported foreground experience

Build idle clock, heartbeat/capabilities, and an optional authenticated configuration editor as separate changes with acceptance tests. Admin authentication must cover local controls as well as the web UI if it is presented as a restriction; even then it cannot lock the TV's own Home or inputs. A configurable foreground shell is a realistic product; a whole-device security boundary is not.

Report unsupported capabilities to the backend/UI rather than drawing actionable tiles that silently do nothing. Until a capability protocol is added, administrators must curate Samsung-specific configuration. Keep separate records for Android and Samsung.

## Release gates

- Automated suites green for both backend/shared Android web UI and Samsung output.
- No private addresses, room IDs, credentials, certificate files, signed WGTs or generated per-device configuration in Git.
- Hardware checklist records model, firmware, shell version, hosted revision and network conditions.
- Each advertised capability has a successful physical result; unresolved Back is a release blocker for an in-app HDMI experience.
- Android features are not removed to achieve apparent parity. Native Android build/device checks remain a separate gate for Android changes.
- No claim of system takeover or hidden-app remote interception.
