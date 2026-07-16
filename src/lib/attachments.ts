export const MAX_ATTACHMENT_BYTES = 4_000_000;
export const MAX_EVIDENCE_CHARACTERS = 50_000;
export const MAX_PDF_PAGES = 40;

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
