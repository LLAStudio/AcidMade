/**
 * `.acm` project container.
 *
 * A project is a single zip archive holding `acidmade.json` plus every resource
 * (scenes, agents, prompts, config). Entries are written uncompressed so the
 * format stays easy to inspect and repair; the reader accepts deflated entries
 * too, so archives produced by other tools open fine.
 */
import { inflateRawSync } from "node:zlib";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function dosDateTime(input) {
  const date = input instanceof Date ? input : new Date(input ?? Date.now());
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function normalizePath(value) {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.(\/|$)/g, "");
}

/** entries: [{ path, data: string|Buffer, mtime?: Date|string }] */
export function writeAcm(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));

  for (const entry of sorted) {
    const name = Buffer.from(normalizePath(entry.path), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8");
    const crc = crc32(data);
    const stamp = dosDateTime(entry.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIG, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIG, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    localParts.push(local, name, data);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(sorted.length, 8);
  eocd.writeUInt16LE(sorted.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function findEndOfCentralDirectory(buffer) {
  const maxBack = Math.min(buffer.length, 65557);
  for (let offset = buffer.length - 22; offset >= buffer.length - maxBack; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIG) return offset;
  }
  throw new Error("not an AcidMade project: missing archive directory");
}

/** Returns Map<path, Buffer>. */
export function readAcm(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  let pointer = centralOffset;

  for (let index = 0; index < count; index += 1) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== CENTRAL_SIG) {
      throw new Error("corrupt AcidMade project: bad central directory");
    }
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const size = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.slice(pointer + 46, pointer + 46 + nameLength).toString("utf8");

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_SIG) {
      throw new Error("corrupt AcidMade project: bad local header for " + name);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.slice(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw);
    else throw new Error("unsupported compression in " + name);

    if (size !== 0 && data.length !== size) {
      throw new Error("corrupt AcidMade project: size mismatch in " + name);
    }
    entries.set(name, data);
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function isAcm(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) return false;
  if (buffer.readUInt32LE(0) !== LOCAL_SIG) return false;
  try {
    findEndOfCentralDirectory(buffer);
    return true;
  } catch {
    return false;
  }
}

export function text(entries, name) {
  const value = entries.get(name);
  return value ? value.toString("utf8") : null;
}
