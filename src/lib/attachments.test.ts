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
});
