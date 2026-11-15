# Desktop packaging

AcidMade ships as an Electron application. The renderer is the same Vite build
used on the web; the main process starts the local agent runtime and loads the
editor from disk.

## Targets

| Platform | Formats | Builder target |
| --- | --- | --- |
| Windows | `AcidMade-<version>-Setup.exe` | `nsis` |
| Windows | `AcidMade-<version>-<arch>.msi` | `msi` |
| Windows | `AcidMade-<version>-Portable.exe` | `portable` |
| macOS | `AcidMade-<version>-<arch>.dmg` | `dmg` |
| macOS | `AcidMade.app` (also zipped as `AcidMade-<arch>-app.zip`) | `dir` + `zip` |
| Linux | `AcidMade-<version>-<arch>.AppImage` | `AppImage` |
| Linux | `AcidMade-<version>-<arch>.flatpak` | `flatpak` |

All targets are declared in `electron-builder.yml`.

## Build locally

```bash
npm install
npm run icon                  # regenerates build/icon.png + build/icons/*
npm run build                 # tsc -b && vite build
npm run package               # current platform, every configured target
```

Platform specific:

```bash
npm run package:linux         # AppImage + Flatpak
npm run package:win           # Setup.exe + MSI + portable .exe
npm run package:mac           # DMG + zip (+ .app in release/mac*/)
```

Artifacts land in `release/`.

### Host requirements

- **Windows targets** build on Windows natively. Cross-building from Linux needs
  Wine; MSI additionally needs the WiX toolset that Electron Builder downloads.
- **macOS targets** require macOS. `dmg` uses `hdiutil` and cannot be produced on
  Linux or Windows.
- **Flatpak** requires `flatpak`, `flatpak-builder`, and the runtimes listed in
  `electron-builder.yml`:

```bash
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.electronjs.Electron2.BaseApp//24.08
```

## Run the desktop shell in development

```bash
npm run dev                   # Vite on :3000 + runtime on :4317
npm run desktop:dev           # Electron window pointed at the dev server
```

`npm run desktop` builds the renderer first and then opens the packaged-style
window from `dist/`.

## How the desktop app is wired

- `electron/main.mjs` creates the window, enforces a single instance, opens
  external links in the default browser, and starts the runtime as a child
  process with `ELECTRON_RUN_AS_NODE`.
- The runtime runs with its working directory set to the app's `userData` folder
  so `res://` writes never land in a read-only install directory.
- `electron/preload.mjs` exposes only `runtimeUrl`, `platform` and version
  numbers through `contextBridge`. Node integration stays disabled and context
  isolation stays on.
- Because the packaged renderer loads over `file://`, the client uses the
  injected loopback URL for `/api` calls instead of relative paths.

## Release

Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds every
format on its native runner and publishes a GitHub release with the artifacts:

```bash
git tag v1.0.2
git push origin v1.0.2
```

## Signing

Builds are unsigned by default, so Windows SmartScreen and macOS Gatekeeper will
warn on first launch. To sign and notarize, provide the usual credentials
(`CSC_LINK`/`CSC_KEY_PASSWORD` for Windows and macOS, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization) as CI secrets
and remove `identity: null` from `electron-builder.yml`.
