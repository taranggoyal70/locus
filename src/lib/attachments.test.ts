import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { extractAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

describe("task attachment extraction", () => {
  it("extracts and normalizes plain-text evidence", async () => {
    const file = new File(["Checkout\r\n\r\n\r\n  button   fails"], "ticket.md", { type: "text/markdown" });
    const result = await extractAttachment(file);

    expect(result.kind).toBe("text");
    expect(result.text).toBe("Checkout\n\n button fails");
    expect(result.truncated).toBe(false);
  });

  it("rejects unsupported and oversized attachments", async () => {
    await expect(extractAttachment(new File(["data"], "archive.zip", { type: "application/zip" })))
      .rejects.toThrow("Upload a PDF, DOCX, Markdown, or text document.");
    await expect(extractAttachment(new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], "large.txt", { type: "text/plain" })))
      .rejects.toThrow("Attachments must be smaller than 4 MB.");
  });

  it("checks file signatures instead of trusting the extension", async () => {
    await expect(extractAttachment(new File(["not a pdf"], "ticket.pdf", { type: "application/pdf" })))
      .rejects.toThrow("This file is not a valid PDF.");
  });

  // R9: a DOCX is a ZIP, and the ZIP index is attacker-controlled input that
  // decides how much work the parser will do. These fixtures are structurally
  // real archives, because the validator now walks the End of Central
  // Directory record rather than scanning the file for signatures.
  type ZipEntry = { name: string; compressed: number; uncompressed: number };

  function buildZip(
    entries: ZipEntry[],
    overrides: { entryCount?: number } = {},
  ): Uint8Array<ArrayBuffer> {
    const CD_ENTRY = 46;
    const names = entries.map((entry) => new TextEncoder().encode(entry.name));
    const cdSize = entries.reduce((total, _entry, i) => total + CD_ENTRY + names[i].length, 0);
    // A local header is not parsed by the validator, but a real archive has one.
    const localSize = 30;
    const bytes = new Uint8Array(localSize + cdSize + 22);
    const view = new DataView(bytes.buffer);

    view.setUint32(0, 0x04034b50, true);

    let cursor = localSize;
    entries.forEach((entry, index) => {
      view.setUint32(cursor, 0x02014b50, true);
      view.setUint32(cursor + 20, entry.compressed, true);
      view.setUint32(cursor + 24, entry.uncompressed, true);
      view.setUint16(cursor + 28, names[index].length, true);
      bytes.set(names[index], cursor + CD_ENTRY);
      cursor += CD_ENTRY + names[index].length;
    });

    view.setUint32(cursor, 0x06054b50, true);
    view.setUint16(cursor + 10, overrides.entryCount ?? entries.length, true);
    view.setUint32(cursor + 12, cdSize, true);
    view.setUint32(cursor + 16, localSize, true);
    return bytes;
  }

  // Uint8Array<ArrayBufferLike> is not a BlobPart, because the backing store
  // could in principle be a SharedArrayBuffer. Narrowing here keeps every
  // caller free of the cast.
  function docx(bytes: Uint8Array<ArrayBuffer>, name = "evidence.docx") {
    return new File([bytes], name, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  // The regression that matters most: tightening ZIP validation must not start
  // rejecting real documents. This fixture is a genuine deflate-compressed
  // DOCX produced by a standard zip writer.
  it("still extracts text from a real DOCX", async () => {
    // Copy into a plain ArrayBuffer: readFileSync returns a Buffer whose
    // backing store is typed ArrayBufferLike, which is not a BlobPart.
    const file = readFileSync(new URL("../../test/fixtures/sample.docx", import.meta.url));
    const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(file.byteLength));
    bytes.set(file);

    const result = await extractAttachment(docx(bytes, "ticket.docx"));

    expect(result.kind).toBe("docx");
    expect(result.text).toContain("Checkout total is wrong");
    expect(result.truncated).toBe(false);
  });

  it("rejects an archive whose parts expand beyond the total ceiling", async () => {
    const bytes = buildZip([
      { name: "word/document.xml", compressed: 900_000, uncompressed: 15_000_000 },
      { name: "word/styles.xml", compressed: 900_000, uncompressed: 15_000_000 },
    ]);

    await expect(extractAttachment(docx(bytes))).rejects.toThrow("expanded content is too large");
  });

  // The total-size check alone would admit this: one small entry that expands
  // by six orders of magnitude is the classic bomb shape.
  it("rejects a single entry with an absurd compression ratio", async () => {
    const bytes = buildZip([
      { name: "word/document.xml", compressed: 10, uncompressed: 19_000_000 },
    ]);

    await expect(extractAttachment(docx(bytes))).rejects.toThrow("expanded content is too large");
  });

  // ZIP64 puts 0xFFFFFFFF in the 32-bit field and the real size in an extra
  // field, which is exactly how a bomb hides from a 32-bit read.
  it("refuses ZIP64 rather than reading a sentinel as a size", async () => {
    const bytes = buildZip([
      { name: "word/document.xml", compressed: 0xffffffff, uncompressed: 0xffffffff },
    ]);

    await expect(extractAttachment(docx(bytes))).rejects.toThrow("ZIP64");
  });

  it("rejects an entry claiming to be empty while declaring expanded content", async () => {
    const bytes = buildZip([
      { name: "word/document.xml", compressed: 0, uncompressed: 5_000_000 },
    ]);

    await expect(extractAttachment(docx(bytes))).rejects.toThrow("not a valid DOCX");
  });

  it("rejects an archive with too many parts", async () => {
    const entries = Array.from({ length: 600 }, (_, n) => ({
      name: `word/part-${n}.xml`,
      compressed: 10,
      uncompressed: 20,
    }));

    await expect(extractAttachment(docx(buildZip(entries)))).rejects.toThrow("too many parts");
  });

  it("rejects a central directory that does not agree with its declared count", async () => {
    const bytes = buildZip(
      [{ name: "word/document.xml", compressed: 100, uncompressed: 1_000 }],
      { entryCount: 5 },
    );

    await expect(extractAttachment(docx(bytes))).rejects.toThrow("not a valid DOCX");
  });

  it("rejects a file with no end of central directory record at all", async () => {
    const bytes = new Uint8Array(64);
    bytes.set([0x50, 0x4b, 0x03, 0x04], 0);

    await expect(extractAttachment(docx(bytes))).rejects.toThrow("not a valid DOCX");
  });
});
