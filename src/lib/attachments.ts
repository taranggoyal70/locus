export const MAX_ATTACHMENT_BYTES = 4_000_000;
export const MAX_EVIDENCE_CHARACTERS = 50_000;
export const MAX_PDF_PAGES = 40;
const MAX_DOCX_EXPANDED_BYTES = 20_000_000;

export type ExtractedEvidence = {
  name: string;
  kind: "pdf" | "docx" | "text";
  text: string;
  characters: number;
  truncated: boolean;
};

function cleanText(input: string): { text: string; truncated: boolean } {
  const normalized = input
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const truncated = normalized.length > MAX_EVIDENCE_CHARACTERS;
  return { text: normalized.slice(0, MAX_EVIDENCE_CHARACTERS), truncated };
}

function extension(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

function startsWith(bytes: Uint8Array, expected: number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

// R9: a DOCX is a ZIP, and a ZIP is an attacker-controlled index into work the
// parser will do. The previous check scanned the whole file for central
// directory signatures and summed the uncompressed sizes it found. That reads
// compressed payload bytes as if they were headers, so a valid document could
// be rejected by coincidence, and it never looked at how many entries there
// were or how far any single one expanded.
//
// This walks the real central directory, located from the End of Central
// Directory record, and refuses anything whose structure is a bad bargain
// before mammoth is asked to expand it.
const MAX_DOCX_ENTRIES = 512;
// XML compresses extremely well, so the ceiling has to sit far above ordinary
// document ratios. A zip bomb is several orders of magnitude beyond this.
const MAX_ENTRY_COMPRESSION_RATIO = 1_000;
// ZIP64 stores this sentinel in the 32-bit size fields and the real size in an
// extra field, which is exactly how a bomb hides its expanded size from a
// 32-bit read.
const ZIP64_SENTINEL = 0xffffffff;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
// Signature plus the largest possible trailing comment.
const MAX_EOCD_SEARCH = 22 + 0xffff;

function findEndOfCentralDirectory(view: DataView, length: number): number {
  const earliest = Math.max(0, length - MAX_EOCD_SEARCH);
  // Scan backwards: the EOCD is at the end, and the last match is the real one.
  for (let offset = length - 22; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("This file is not a valid DOCX document.");
}

function assertSafeDocxArchive(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 22) throw new Error("This file is not a valid DOCX document.");

  const eocd = findEndOfCentralDirectory(view, bytes.byteLength);
  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);

  if (entryCount > MAX_DOCX_ENTRIES) {
    throw new Error("This DOCX document contains too many parts.");
  }
  if (cursor === ZIP64_SENTINEL) {
    throw new Error("ZIP64 DOCX documents are not supported.");
  }

  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.byteLength) {
      throw new Error("This file is not a valid DOCX document.");
    }
    if (view.getUint32(cursor, true) !== CENTRAL_FILE_SIGNATURE) {
      throw new Error("This file is not a valid DOCX document.");
    }

    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    if (compressed === ZIP64_SENTINEL || uncompressed === ZIP64_SENTINEL) {
      throw new Error("ZIP64 DOCX documents are not supported.");
    }

    // A single entry that expands enormously is the bomb, whatever the total.
    if (compressed > 0 && uncompressed / compressed > MAX_ENTRY_COMPRESSION_RATIO) {
      throw new Error("This DOCX document's expanded content is too large.");
    }
    // A declared-empty compressed size with real expanded content is a lie the
    // total-size check would otherwise accept.
    if (compressed === 0 && uncompressed > 0) {
      throw new Error("This file is not a valid DOCX document.");
    }

    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_DOCX_EXPANDED_BYTES) {
      throw new Error("This DOCX document's expanded content is too large.");
    }

    cursor += 46
      + view.getUint16(cursor + 28, true)
      + view.getUint16(cursor + 30, true)
      + view.getUint16(cursor + 32, true);
  }
}

export async function extractAttachment(file: File): Promise<ExtractedEvidence> {
  if (!file.name || file.name.length > 180) throw new Error("Use a shorter attachment filename.");
  if (file.size === 0) throw new Error("The attachment is empty.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachments must be smaller than 4 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extension(file.name);
  let kind: ExtractedEvidence["kind"];
  let rawText: string;

  if (ext === "pdf" || file.type === "application/pdf") {
    if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) throw new Error("This file is not a valid PDF.");
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`PDFs are limited to ${MAX_PDF_PAGES} pages.`);
    const result = await extractText(pdf, { mergePages: true });
    rawText = result.text;
    kind = "pdf";
  } else if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) throw new Error("This file is not a valid DOCX document.");
    assertSafeDocxArchive(bytes);
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    rawText = result.value;
    kind = "docx";
  } else if (["txt", "md", "markdown"].includes(ext) || file.type.startsWith("text/")) {
    rawText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if ((rawText.match(/\0/g)?.length ?? 0) > 0) throw new Error("This text file contains unsupported binary data.");
    kind = "text";
  } else {
    throw new Error("Upload a PDF, DOCX, Markdown, or text document.");
  }

  const cleaned = cleanText(rawText);
  if (!cleaned.text) throw new Error("No readable text was found in this attachment.");
  return {
    name: file.name,
    kind,
    text: cleaned.text,
    characters: cleaned.text.length,
    truncated: cleaned.truncated,
  };
}
