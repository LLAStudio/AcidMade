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

## File association

`fileAssociations` in `electron-builder.yml` registers `.acm` as an AcidMade
project. The NSIS installer and the MSI write the Windows registry entry, macOS
puts a `CFBundleDocumentTypes` entry in the bundle, and the Linux packages ship
a desktop entry with the `application/x-acidmade-project` MIME type. With the
association in place, double-clicking a project, or passing its path on the
command line, opens it directly in the editor.

The portable `.exe` and an AppImage that was not integrated into the desktop do
not register the extension; use **Open project…** there.

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
   produced even when an optional format (Flatpak, MSI) fails. The macOS job is
   a matrix over `macos-15-intel` (x64 DMG) and `macos-15` (arm64 DMG);
   `macos-13` was retired in December 2025 and jobs on that label waited forever
   for a runner that no longer exists.
3. `publish` — runs with `if: always()`, attaches every collected artifact to the
   draft, and un-drafts the release once **Linux and Windows succeeded**.

macOS artifacts are included when that job passes; a failing or unavailable
macOS runner no longer holds the release back, and the run log says the release
was published without them. Linux or Windows failing keeps the release as a
draft with whatever the other platforms built. Build jobs time out after 30
minutes (40 for the macOS matrix), and a new push cancels the previous attempt so
a stuck job cannot block the next release.

Local tagging is still possible:

```bash
git tag v2.0.1
git push origin v2.0.1
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

The goal is a Developer ID signed DMG, with the hardened runtime, notarized by
Apple and stapled so Gatekeeper accepts it offline.

#### 1. Export the certificate

You need an active **Apple Developer Program** membership and a
**Developer ID Application** certificate (not “Apple Development”): create it in
developer.apple.com → Certificates, Identifiers & Profiles → Certificates, then
add it to the login keychain.

In **Keychain Access → My Certificates**, right-click the certificate → **Export
…**, choose **.p12**, and set a strong password. That password is
`MAC_CSC_KEY_PASSWORD`; the `.p12` file is `MAC_CSC_LINK`.

Check which identity and team you have:

```bash
security find-identity -v -p codesigning
# 1) ABCD1234... "Developer ID Application: LLAStudio (TEAMID1234)"
```

The value in parentheses is `APPLE_TEAM_ID` (10 characters).

#### 2. Base64 the certificate

```bash
# macOS
base64 -i DeveloperID.p12 | tr -d '\n' > developerid.p12.b64
# Linux
base64 -w0 DeveloperID.p12 > developerid.p12.b64
```

The file is one long line and usually 5–10 KB, well under the 48 KB secret limit.

#### 3. Create the repository secrets

**Settings → Secrets and variables → Actions → New repository secret**, exactly
these five names:

| Secret | What to paste | Where it comes from |
| --- | --- | --- |
| `MAC_CSC_LINK` | the whole content of `developerid.p12.b64`, one line, no quotes | step 2 |
| `MAC_CSC_KEY_PASSWORD` | the password chosen at export | step 1 |
| `APPLE_ID` | the Apple Developer account email | your account |
| `APPLE_APP_SPECIFIC_PASSWORD` | an app-specific password, e.g. `abcd-efgh-ijkl-mnop` | appleid.apple.com → Sign-In and Security → App-Specific Passwords |
| `APPLE_TEAM_ID` | the 10-character team identifier | step 1, or developer.apple.com → Membership |

Notes:

- The app-specific password is **not** the Apple ID password. It requires
two-factor authentication on the account and is shown once; regenerate it if lost.
- `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` are the Windows equivalents.
- Secrets cannot be read back from GitHub; to correct one, create it again with
the same name.

#### 4. What the workflow does

Before building, `scripts/check-mac-signing.mjs` validates the inputs and writes
`signed` / `notarize` outputs:

- a path (`/…`, `./…`, `~/…`, `file://…`) must exist and be a non-empty file;
- a base64 value must decode to at least 100 bytes and start with `0x30` (a
  PKCS#12 DER sequence), which rejects a `.cer`, a `.pem` or a placeholder;
- an `https://` URL is accepted and downloaded by Electron Builder;
- setting only some of `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
  `APPLE_TEAM_ID` fails with the names that are missing;
- Apple credentials without a usable certificate also fail, because notarization
  needs a signed app.

With a valid certificate the job signs with the hardened runtime and the
entitlements in `build/entitlements.mac.plist`, passes `-c.mac.notarize=true` when
the Apple trio is present, then verifies `codesign --verify --deep --strict`,
`spctl --assess` and `xcrun stapler validate` on every DMG.

Failure behaviour:

- **`MAC_CSC_LINK` absent** — unsigned build, warning, DMG still published. Users
  must right-click → Open (or `xattr -dr com.apple.quarantine`).
- **`MAC_CSC_LINK` present but invalid** — the macOS job stops at the signing
  check with an `::error::` annotation naming the problem. Linux and Windows still
  publish the release; the `publish` job warns that macOS is missing.

#### 5. Verify a local build on a Mac

```bash
codesign -dv --verbose=4 "release/mac-arm64/AcidMade.app"
spctl -a -vv "release/mac-arm64/AcidMade.app"
xcrun stapler validate release/*.dmg
```

Expected: a `Developer ID Application` authority, `accepted` with
`source=Notarized Developer ID`, and `The validate action worked`.

Run the same validation the workflow uses, without pushing:

```bash
MAC_CSC_LINK="$(cat developerid.p12.b64)" \
MAC_CSC_KEY_PASSWORD='…' \
APPLE_ID='…' APPLE_APP_SPECIFIC_PASSWORD='…' APPLE_TEAM_ID='…' \
node scripts/check-mac-signing.mjs
```

### Local builds

```bash
CSC_LINK="$(base64 -w0 certificate.pfx)" CSC_KEY_PASSWORD=... npm run package:win
```

Notarization is never triggered locally unless you pass
`-c.mac.notarize=true` yourself.
