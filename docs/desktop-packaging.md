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

`.github/workflows/release.yml` runs on every push to `main` (and on a `v*` tag
or a manual dispatch). The `prepare` job creates the tag `v<package.json version>`
and a **draft** release before anything is built, so a broken platform can no
longer stop the release from existing:

1. `prepare` — tag + draft release with generated notes.
2. `linux`, `windows`, `macos` — build in parallel, uploading whatever they
   produced even when an optional format (Flatpak, MSI) fails.
3. `publish` — runs with `if: always()`, attaches every collected artifact to the
   draft, and un-drafts the release **only when all three platforms succeeded**.

If a platform fails, the release stays a draft with the artifacts from the
successful platforms, and the run summary lists each platform's result. Publish
it manually from the Releases page once the failure is fixed, or re-run the
failed jobs and let the next run attach the rest.

Local tagging is still possible:

```bash
git tag v1.0.2
git push origin v1.0.2
```

## Signing and notarization

Signing is wired but optional: without certificates the workflow still builds and
warns in the run log, and with certificates it signs automatically. Nothing is
committed to the repository — the values below are GitHub Actions secrets
(**Settings → Secrets and variables → Actions**).

### Windows

| Secret | Content |
| --- | --- |
| `WIN_CSC_LINK` | Base64 of your `.pfx` code-signing certificate |
| `WIN_CSC_KEY_PASSWORD` | Password for that `.pfx` |

`CSC_LINK` and `CSC_KEY_PASSWORD` are mapped from those two secrets for the
Windows job, which is what Electron Builder reads. Any OV/EV code-signing
certificate works. EV certificates shipped on hardware tokens cannot be exported
for CI; use an OV certificate or Azure Trusted Signing instead.

Generate the value:

```bash
base64 -w0 certificate.pfx > certificate.pfx.b64
# paste the file content into WIN_CSC_LINK
```

### macOS

| Secret | Content |
| --- | --- |
| `MAC_CSC_LINK` | Base64 of a Developer ID Application `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Password for that `.p12` |
| `APPLE_ID` | Apple account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Team identifier from the Apple Developer account |

Export the certificate from Keychain Access as `.p12`, then:

```bash
base64 -w0 DeveloperID.p12 > developerid.p12.b64
```

With those secrets present the macOS job runs Electron Builder with
`-c.mac.notarize=true`, which signs with the hardened runtime, the entitlements
in `build/entitlements.mac.plist`, and notarizes the DMG through Apple's service.
A `codesign --verify` and `spctl --assess` check runs afterwards, and the DMG is
validated with `xcrun stapler validate`.

If the Apple secrets are missing, the job logs a warning and produces an unsigned
or signed-but-not-notarized build instead of failing. Users can still open it with
right-click → Open (or `xattr -dr com.apple.quarantine`).

### Local builds

```bash
CSC_LINK="$(base64 -w0 certificate.pfx)" CSC_KEY_PASSWORD=... npm run package:win
```

Notarization is never triggered locally unless you pass
`-c.mac.notarize=true` yourself.
