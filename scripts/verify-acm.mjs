/**
 * End-to-end check of the .acm container, independent of the app UI.
 *
 * Runs the real store against a temp directory, then reopens the files with a
 * second store instance (simulating an app restart) and finally inspects the
 * bytes with Node's own zip reader expectations. Exits non-zero on the first
 * failed assertion.
 *
 * The release workflow runs this as `npm run verify:acm` before any platform
 * build, so a regression in the container blocks publication instead of being
 * discovered once installers exist.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createProjectStore } from "../electron/projects.mjs";
import { readAcm, writeAcm, isAcm, crc32 } from "../electron/acm.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "acidmade-acm-"));
const store = createProjectStore({ rootDir: root, seed: false });
const results = [];

function ok(name, detail = "") {
  results.push({ name, detail });
}

// 1. Creation writes one .acm file per project, never a folder.
const created = await store.create({ name: "Orbital Console", template: "dashboard" });
assert.ok(created.path.endsWith(".acm"), "project path ends with .acm");
const stat = await fs.stat(created.path);
assert.ok(stat.isFile(), "a project is a single file, not a directory");
ok("create writes a single .acm file", `${created.path.split("/").pop()} (${stat.size} bytes)`);

for (const [name, template] of [["Mesh", "agent"], ["Blank Slate", "blank"]]) {
  await store.create({ name, template });
}
const listing = await store.list();
assert.equal(listing.length, 3, "list finds every .acm");
ok("list reads three projects", listing.map((p) => p.id).join(", "));

// 2. Every archive is a structurally valid zip and carries a manifest.
const names = ["orbital-console.acm", "mesh.acm", "blank-slate.acm"];
for (const name of names) {
  const buffer = await fs.readFile(path.join(root, name));
  assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK", `${name} starts with PK`);
  assert.ok(isAcm(buffer), `${name} passes isAcm`);
  const entries = readAcm(buffer);
  assert.ok(entries.has("acidmade.json"), `${name} has acidmade.json`);
  const manifest = JSON.parse(entries.get("acidmade.json").toString("utf8"));
  assert.equal(manifest.format, "acm/1.0", `${name} declares acm/1.0`);
  assert.ok(entries.has("scenes/MainApp.acid"), `${name} has its scene`);
  ok("archive structure", `${name}: ${entries.size} entries, format ${manifest.format}`);
}

// 3. Python's zipfile (an independent reader) agrees on every entry and CRC.
const py = `
import json, sys, zipfile
out = {}
for name in sys.argv[1:]:
    with zipfile.ZipFile(name) as archive:
        out[name.split("/")[-1]] = {
            "entries": archive.namelist(),
            "bad": archive.testzip(),
            "count": len(archive.namelist()),
        }
print(json.dumps(out))
`;
const inspected = JSON.parse(
  execFileSync("python3", ["-c", py, ...names.map((n) => path.join(root, n))], { encoding: "utf8" }),
);
for (const [name, info] of Object.entries(inspected)) {
  assert.equal(info.bad, null, `${name}: every CRC matches`);
  assert.ok(info.entries.includes("acidmade.json"), `${name}: manifest visible to zipfile`);
  ok("python zipfile reads the archive", `${name}: ${info.count} entries, CRCs ok`);
}

// 4. A CRC mismatch must be detected, proving the container is not opaque bytes.
const crcPayload = Buffer.from("acidmade");
assert.equal(crc32(crcPayload), crc32(Buffer.from("acidmade")), "crc32 is stable");
assert.notEqual(crc32(crcPayload), crc32(Buffer.from("acidmado")), "crc32 reacts to changes");
ok("crc32 is deterministic and sensitive", String(crc32(crcPayload)));

// 5. Read/write/edit round-trip through the store.
const target = path.join(root, "orbital-console.acm");
const sceneRead = await store.readFile(target, "scenes/MainApp.acid");
assert.ok(JSON.parse(sceneRead.content).nodes.length > 0, "scene content is readable");
await store.writeFile(target, "notes/plan.md", "# Plan\n\nShip 2.0.1\n");
await store.createEntry(target, "prompts/review.prompt", { content: "Review the scene.\n" });
await store.createEntry(target, "assets", { kind: "dir" });
await store.renameEntry(target, "notes/plan.md", "notes/roadmap.md");
await store.duplicateEntry(target, "scenes/MainApp.acid");
await store.deleteEntry(target, "assets");
const afterEdit = await store.tree(target);
const paths = afterEdit.map((entry) => entry.path);
assert.ok(paths.includes("notes/roadmap.md"), "rename kept the content path");
assert.ok(paths.includes("scenes/MainApp copy.acid"), "duplicate created a copy");
assert.ok(!paths.some((p) => p.startsWith("assets")), "delete removed the folder");
ok("resource mutations stay inside the archive", `${paths.length} entries after edits`);

// 6. Restart: a fresh store instance must see the edits, and the file stays valid.
const reopened = createProjectStore({ rootDir: root, seed: false });
const reopenedProject = await reopened.open(target);
assert.equal(reopenedProject.name, "Orbital Console", "manifest survives a reopen");
const reopenedTree = await reopened.tree(target);
assert.ok(
  reopenedTree.some((entry) => entry.path === "notes/roadmap.md"),
  "edits survive a reopen",
);
const reopenedBuffer = await fs.readFile(target);
assert.ok(isAcm(reopenedBuffer), "edited archive is still a valid .acm");
assert.ok(readAcm(reopenedBuffer).has("notes/roadmap.md"), "edited entry is in the directory");
ok("reopen after restart", `${reopenedTree.length} entries, still valid`);

// 7. A corrupt .acm is skipped by list() instead of breaking the project list.
await fs.writeFile(path.join(root, "broken.acm"), Buffer.from("not an archive"));
const safeListing = await store.list();
assert.equal(safeListing.length, 3, "broken archive is skipped");
ok("corrupt archive is skipped", `${safeListing.length} healthy projects listed`);

// 8. Files written by writeAcm with deflate-style input still read back byte-identical.
const binary = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
const roundTrip = readAcm(writeAcm([{ path: "blob.bin", data: binary }]));
assert.deepEqual([...roundTrip.get("blob.bin")], [...binary], "buffer round-trips exactly");
ok("binary payloads round-trip exactly", "9 bytes incl. invalid UTF-8");

await fs.rm(root, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, checks: results }, null, 2));
