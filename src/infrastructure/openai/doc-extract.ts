/**
 * Minimal Word 97-2003 (.doc) text extractor.
 *
 * Prozorro buyers overwhelmingly publish tender documentation as binary
 * .doc files. Gemini cannot ingest them natively and the previous pipeline
 * silently dropped them, so paid reports were built without the main
 * bidding document. This module parses the OLE2/CFB container and the
 * WordDocument piece table in pure TypeScript (Workers-compatible) and
 * returns the document text, or null when the file cannot be parsed.
 */

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

type DirectoryEntry = { name: string; type: number; start: number; size: number };

class CfbReader {
  private readonly bytes: Uint8Array;
  private readonly sectorSize: number;
  private readonly miniSectorSize: number;
  private readonly miniCutoff: number;
  private readonly fat: number[] = [];
  private readonly miniFat: number[] = [];
  private readonly miniStream: Uint8Array;
  private readonly entries: DirectoryEntry[] = [];

  constructor(buffer: ArrayBuffer) {
    this.bytes = new Uint8Array(buffer);
    if (this.bytes.length < 512 || !OLE_MAGIC.every((b, i) => this.bytes[i] === b)) {
      throw new Error("not-an-ole-file");
    }
    this.sectorSize = 1 << u16(this.bytes, 30);
    this.miniSectorSize = 1 << u16(this.bytes, 32);
    this.miniCutoff = u32(this.bytes, 56) || 4096;
    this.readFat();
    this.readDirectory();
    const root = this.entries[0];
    if (!root) throw new Error("missing-root-entry");
    this.miniStream = this.readChain(root.start, root.size);
    this.readMiniFat();
  }

  private sectorOffset(sector: number): number {
    return (sector + 1) * this.sectorSize;
  }

  private readFat(): void {
    const numFatSectors = u32(this.bytes, 44);
    const difat: number[] = [];
    for (let i = 0; i < 109; i += 1) difat.push(u32(this.bytes, 76 + i * 4));
    let difatSector = u32(this.bytes, 68);
    let hops = 0;
    while (difatSector < 0xfffffffa && hops < 1000) {
      const base = this.sectorOffset(difatSector);
      const entriesPerSector = Math.floor(this.sectorSize / 4) - 1;
      for (let i = 0; i < entriesPerSector; i += 1) difat.push(u32(this.bytes, base + i * 4));
      difatSector = u32(this.bytes, base + entriesPerSector * 4);
      hops += 1;
    }
    for (const fatSector of difat.slice(0, numFatSectors)) {
      if (fatSector >= 0xfffffffa) continue;
      const base = this.sectorOffset(fatSector);
      for (let i = 0; i < this.sectorSize / 4; i += 1) this.fat.push(u32(this.bytes, base + i * 4));
    }
  }

  private readChain(start: number, size?: number): Uint8Array {
    const chunks: Uint8Array[] = [];
    let sector = start;
    let total = 0;
    let hops = 0;
    while (sector !== ENDOFCHAIN && sector !== FREESECT && sector < 0xfffffffa && hops < 200_000) {
      const offset = this.sectorOffset(sector);
      if (offset + this.sectorSize > this.bytes.length) break;
      chunks.push(this.bytes.subarray(offset, offset + this.sectorSize));
      total += this.sectorSize;
      sector = this.fat[sector] ?? ENDOFCHAIN;
      hops += 1;
    }
    const out = new Uint8Array(size ?? total);
    let position = 0;
    for (const chunk of chunks) {
      if (position >= out.length) break;
      out.set(chunk.subarray(0, Math.min(chunk.length, out.length - position)), position);
      position += chunk.length;
    }
    return out;
  }

  private readDirectory(): void {
    const dirData = this.readChain(u32(this.bytes, 48));
    for (let offset = 0; offset + 128 <= dirData.length; offset += 128) {
      const nameLength = u16(dirData, offset + 64);
      if (nameLength < 2) {
        this.entries.push({ name: "", type: 0, start: 0, size: 0 });
        continue;
      }
      let name = "";
      for (let i = 0; i < nameLength - 2; i += 2) name += String.fromCharCode(u16(dirData, offset + i));
      this.entries.push({
        name,
        type: dirData[offset + 66] ?? 0,
        start: u32(dirData, offset + 116),
        size: u32(dirData, offset + 120),
      });
    }
  }

  private readMiniFat(): void {
    let sector = u32(this.bytes, 60);
    let hops = 0;
    while (sector !== ENDOFCHAIN && sector !== FREESECT && sector < 0xfffffffa && hops < 10_000) {
      const base = this.sectorOffset(sector);
      for (let i = 0; i < this.sectorSize / 4; i += 1) this.miniFat.push(u32(this.bytes, base + i * 4));
      sector = this.fat[sector] ?? ENDOFCHAIN;
      hops += 1;
    }
  }

  readStream(entry: DirectoryEntry): Uint8Array {
    if (entry.size >= this.miniCutoff) return this.readChain(entry.start, entry.size);
    const out = new Uint8Array(entry.size);
    let sector = entry.start;
    let position = 0;
    let hops = 0;
    while (sector !== ENDOFCHAIN && sector !== FREESECT && sector < 0xfffffffa && hops < 100_000) {
      const offset = sector * this.miniSectorSize;
      if (offset + this.miniSectorSize > this.miniStream.length) break;
      out.set(this.miniStream.subarray(offset, Math.min(offset + this.miniSectorSize, out.length - position + offset)) as Uint8Array, position);
      position += this.miniSectorSize;
      if (position >= out.length) break;
      sector = this.miniFat[sector] ?? ENDOFCHAIN;
      hops += 1;
    }
    return out;
  }

  findStream(name: string): DirectoryEntry | undefined {
    return this.entries.find((entry) => entry.type === 2 && entry.name === name && entry.size > 0);
  }
}

/** cp1252 high-byte mapping used by compressed Word 97 text pieces. */
const CP1252_HIGH: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰",
  0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
  0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

function decodeAnsiPiece(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const code = bytes[i]!;
    if (code < 0x80) out += String.fromCharCode(code);
    else out += CP1252_HIGH[code] ?? String.fromCharCode(code);
  }
  return out;
}

function decodeUtf16Piece(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode(u16(bytes, i));
  return out;
}

/** Field/paragraph control characters → readable whitespace or removal. */
function cleanupText(raw: string): string {
  return raw
    .replace(/[\r\u000b\u000c]/g, "\n")
    .replace(/\u0007/g, "\t")
    .replace(/[\u0001\u0002\u0008\u000e\u000f\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a]/g, "")
    .replace(/\u001e/g, "-")
    .replace(/\u001f/g, "_")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTextFromWordDoc(buffer: ArrayBuffer): string | null {
  try {
    const cfb = new CfbReader(buffer);
    const wordDoc = cfb.findStream("WordDocument");
    if (!wordDoc) return null;
    const wordBytes = cfb.readStream(wordDoc);
    if (wordBytes.length < 512 || u16(wordBytes, 0) !== 0xa5ec) return null;

    const flags = u16(wordBytes, 0x0a);
    const tableEntry = cfb.findStream((flags & 0x0200) !== 0 ? "1Table" : "0Table");
    if (!tableEntry) return null;
    const tableBytes = cfb.readStream(tableEntry);

    // FibRgFcLcb97 starts at 0x9A; fcClx/lcbClx is field pair #33.
    const fcClx = u32(wordBytes, 0x9a + 33 * 8);
    const lcbClx = u32(wordBytes, 0x9a + 33 * 8 + 4);
    if (lcbClx === 0 || fcClx >= tableBytes.length) return fallbackUtf16Scan(wordBytes);

    // CLX = Prc blocks (0x01) followed by the Pcdt (0x02) with the piece table.
    let pos = fcClx;
    const clxEnd = Math.min(fcClx + lcbClx, tableBytes.length);
    let plcPcd: Uint8Array | null = null;
    while (pos < clxEnd) {
      const clxt = tableBytes[pos]!;
      if (clxt === 1) {
        pos += 1 + 2 + u16(tableBytes, pos + 1);
      } else if (clxt === 2) {
        const lcb = u32(tableBytes, pos + 1);
        plcPcd = tableBytes.subarray(pos + 5, Math.min(pos + 5 + lcb, clxEnd));
        break;
      } else {
        break;
      }
    }
    if (!plcPcd || plcPcd.length < 16) return fallbackUtf16Scan(wordBytes);

    const pieceCount = Math.floor((plcPcd.length - 4) / 12);
    if (pieceCount < 1) return fallbackUtf16Scan(wordBytes);

    let text = "";
    for (let i = 0; i < pieceCount; i += 1) {
      const cpStart = u32(plcPcd, i * 4);
      const cpEnd = u32(plcPcd, (i + 1) * 4);
      const charCount = cpEnd - cpStart;
      if (charCount <= 0 || charCount > 5_000_000) continue;
      const pcdOffset = (pieceCount + 1) * 4 + i * 8;
      const fcRaw = u32(plcPcd, pcdOffset + 2);
      const compressed = (fcRaw & 0x40000000) !== 0;
      const fc = fcRaw & 0x3fffffff;
      if (compressed) {
        const start = Math.floor(fc / 2);
        text += decodeAnsiPiece(wordBytes.subarray(start, start + charCount));
      } else {
        const start = fc;
        text += decodeUtf16Piece(wordBytes.subarray(start, start + charCount * 2));
      }
    }
    const cleaned = cleanupText(text);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

/**
 * Fallback for damaged or non-standard files: scan the WordDocument stream
 * for long runs of UTF-16LE text. Cyrillic documents are almost never
 * compressed, so this recovers most real-world Prozorro files.
 */
function fallbackUtf16Scan(wordBytes: Uint8Array): string | null {
  let text = "";
  let run = "";
  for (let i = 0; i + 1 < wordBytes.length; i += 2) {
    const code = u16(wordBytes, i);
    const isPrintable = (code >= 0x20 && code < 0xfffd) || code === 0x0a || code === 0x0d || code === 0x09;
    if (isPrintable && code !== 0xfffe) {
      run += String.fromCharCode(code);
    } else {
      if (run.length >= 40) text += run + "\n";
      run = "";
    }
  }
  if (run.length >= 40) text += run;
  const cleaned = cleanupText(text);
  return cleaned.length > 200 ? cleaned : null;
}

export function isWordBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 8) return false;
  const head = new Uint8Array(buffer, 0, 8);
  return OLE_MAGIC.every((b, i) => head[i] === b);
}
