#!/usr/bin/env node
/**
 * Validates the macOS signing and notarization inputs before the build.
 *
 * A wrong `MAC_CSC_LINK` used to be downgraded to an unsigned build, which
 * shipped a DMG that Gatekeeper blocks without saying why. This script fails
 * loudly instead, and keeps the one legitimate case unsigned: no certificate
 * secret at all.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const link = (process.env.MAC_CSC_LINK ?? "").trim();
const password = process.env.MAC_CSC_KEY_PASSWORD ?? "";
const appleId = (process.env.APPLE_ID ?? "").trim();
const applePassword = (process.env.APPLE_APP_SPECIFIC_PASSWORD ?? "").trim();
const teamId = (process.env.APPLE_TEAM_ID ?? "").trim();

const errors = [];
const warnings = [];
let certificate = null;

function asFile(candidate, label) {
  let expanded = candidate;
  if (candidate === "~") expanded = os.homedir();
  else if (candidate.startsWith("~/")) expanded = path.join(os.homedir(), candidate.slice(2));
  const resolved = path.resolve(expanded);
  try {
    const stats = fs.statSync(resolved);
    if (!stats.isFile()) {
      errors.push(`${label} points at "${resolved}", which is not a file.`);
      return null;
    }
    if (stats.size === 0) {
      errors.push(`${label} points at "${resolved}", which is empty.`);
      return null;
    }
    return { kind: "file", path: resolved, bytes: stats.size };
  } catch {
    errors.push(`${label} points at "${resolved}", which does not exist.`);
    return null;
  }
}

function decodeBase64(value) {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 8 || compact.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  const buffer = Buffer.from(compact, "base64");
  return buffer.length > 0 ? buffer : null;
}

function acceptBase64(value, label) {
  const buffer = decodeBase64(value);
  if (!buffer) {
    errors.push(
      `${label} is neither a path, an https URL nor base64. Copy the .p12 as base64 ` +
        "(base64 -i certificate.p12 | tr -d '\\n') or point at an existing file.",
    );
    return null;
  }
  if (buffer.length < 100) {
    errors.push(`${label} decodes to only ${buffer.length} bytes, which is too small for a .p12.`);
    return null;
  }
  if (buffer[0] !== 0x30) {
    errors.push(
      `${label} does not decode to a PKCS#12 (.p12) file: expected a DER sequence. ` +
        "Export the certificate as .p12, not as .cer or .pem.",
    );
    return null;
  }
  return { kind: "base64", bytes: buffer.length };
}

if (link) {
  if (link.startsWith("file://")) certificate = asFile(link.slice("file://".length), "MAC_CSC_LINK");
  else if (/^(https?:)\/\//i.test(link)) certificate = { kind: "url", bytes: null };
  else if (/^data:/i.test(link)) {
    const comma = link.indexOf(",");
    const header = comma >= 0 ? link.slice(0, comma) : "";
    certificate =
      comma >= 0 && /;base64/i.test(header)
        ? acceptBase64(link.slice(comma + 1), "MAC_CSC_LINK (data: URL)")
        : null;
    if (!certificate) errors.push("MAC_CSC_LINK is a data: URL without base64 certificate bytes.");
  } else if (
    /^(\/|\.{1,2}\/|~\/)/.test(link) ||
    (/[\\/]/.test(link) && link.length < 512)
  ) {
    certificate = asFile(link, "MAC_CSC_LINK");
  } else {
    certificate = acceptBase64(link, "MAC_CSC_LINK");
  }
} else {
  warnings.push(
    "MAC_CSC_LINK is not set: macOS builds stay unsigned and Gatekeeper will block them. " +
      "Add the certificate secret to sign and notarize.",
  );
}

const appleMissing = [
  !appleId && "APPLE_ID",
  !applePassword && "APPLE_APP_SPECIFIC_PASSWORD",
  !teamId && "APPLE_TEAM_ID",
].filter(Boolean);
const appleSet = 3 - appleMissing.length;
let notarize = false;

if (appleSet > 0 && appleSet < 3) {
  errors.push(
    `Notarization needs all three secrets; missing ${appleMissing.join(", ")}. ` +
      "Set them together, or remove them to build a signed but un-notarized DMG.",
  );
} else if (appleSet === 3) {
  if (!certificate) {
    errors.push(
      "APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID are set but MAC_CSC_LINK " +
        "is not a usable certificate; notarization requires a signed app.",
    );
  } else {
    notarize = true;
  }
}

if (certificate && !password) {
  warnings.push(
    "MAC_CSC_KEY_PASSWORD is empty: the .p12 must then have an empty password, " +
      "otherwise the certificate import fails.",
  );
}

const signed = Boolean(certificate);
const certificateKind = certificate?.kind ?? "none";
const escape = (value) => String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

for (const warning of warnings) console.log("::warning::" + escape(warning));
for (const error of errors) console.log("::error::" + escape(error));
console.log(
  "macOS signing: " +
    JSON.stringify({
      signed,
      notarize,
      certificateKind,
      certificateBytes: certificate?.bytes ?? null,
    }),
);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `signed=${signed}\nnotarize=${notarize}\ncertificate_kind=${certificateKind}\n`,
  );
}

process.exit(errors.length > 0 ? 1 : 0);
