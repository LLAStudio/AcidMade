#!/usr/bin/env node
/**
 * Decides which platforms a release run still has to build.
 *
 * `prepare` creates the tag and the draft release before anything else, so by
 * the time this runs the release exists and its assets are the source of truth.
 * A push on `main` for a version that is already published with every required
 * artifact rebuilds nothing; a missing DMG only rebuilds macOS, and so on.
 *
 * Tag pushes are explicit release intents and rebuild every platform.
 *
 * Env:
 *   VERSION, TAG       required, from prepare
 *   REF_TYPE           github.ref_type: "tag" forces a full rebuild
 *   RELEASE_JSON       optional JSON ({ assets: [{ name }], isDraft }) for tests
 *   GITHUB_OUTPUT      optional, receives build_linux/build_windows/build_macos/needs_publish
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const VERSION = (process.env.VERSION ?? "").trim();
const TAG = (process.env.TAG ?? "").trim();
const REF_TYPE = (process.env.REF_TYPE ?? "").trim();

if (!VERSION || !TAG) {
  console.log("::error::VERSION and TAG are required to plan a release.");
  process.exit(1);
}

function readRelease() {
  if (process.env.RELEASE_JSON) return JSON.parse(process.env.RELEASE_JSON);
  try {
    const raw = execFileSync("gh", ["release", "view", TAG, "--json", "assets,isDraft"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(raw);
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : String(error.message);
    console.log(`::warning::Could not read release ${TAG} (${detail}); rebuilding every platform.`);
    return { assets: [], isDraft: true, unreadable: true };
  }
}

const release = readRelease();
const assets = new Set((release.assets ?? []).map((asset) => asset.name));

// Required artifacts per platform. MSI, Flatpak and the .app zips are optional:
// their builds are allowed to fail, so their absence must not force a rebuild.
const required = {
  linux: [`AcidMade-${VERSION}-x86_64.AppImage`],
  windows: [`AcidMade-${VERSION}-Setup.exe`, `AcidMade-${VERSION}-Portable.exe`],
  macos: [`AcidMade-${VERSION}-x64.dmg`, `AcidMade-${VERSION}-arm64.dmg`],
};

const forced = REF_TYPE === "tag";
const build = {};
const missing = {};
for (const [platform, files] of Object.entries(required)) {
  missing[platform] = files.filter((file) => !assets.has(file));
  build[platform] = forced || missing[platform].length > 0;
}

// gh always returns a boolean; treat an unknown state as a draft so a release is
// never left unpublished because of a missing field.
const isDraft = release.isDraft !== false;
const needsPublish = isDraft || build.linux || build.windows || build.macos;

for (const [platform, files] of Object.entries(missing)) {
  if (files.length > 0) console.log(`${platform}: missing ${files.join(", ")}`);
}
if (forced) console.log("Tag push: rebuilding every platform.");
console.log(
  `Plan for ${TAG}: linux=${build.linux} windows=${build.windows} macos=${build.macos} ` +
    `draft=${isDraft} publish=${needsPublish}`,
);
if (!build.linux && !build.windows && !build.macos && !isDraft) {
  console.log(`${TAG} is already published with every required artifact; nothing to rebuild.`);
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `build_linux=${build.linux}`,
      `build_windows=${build.windows}`,
      `build_macos=${build.macos}`,
      `needs_publish=${needsPublish}`,
      "",
    ].join("\n"),
  );
}
