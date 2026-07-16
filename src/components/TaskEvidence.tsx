"use client";

import { useRef, useState } from "react";

import type { TaskEvidence as TaskEvidenceItem } from "@/lib/types";

const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_BYTES = 4_000_000;
const MAX_IMAGE_PIXELS = 16_000_000;
const MAX_EVIDENCE_CHARACTERS = 50_000;

function cleanOcrText(input: string) {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractImage(file: File, onProgress: (progress: number) => void): Promise<TaskEvidenceItem> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be smaller than 4 MB.");
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > MAX_IMAGE_PIXELS) throw new Error("Images are limited to 16 megapixels.");

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    cacheMethod: "none",
    logger: (message) => {
      if (message.status === "recognizing text" && typeof message.progress === "number") {
        onProgress(Math.round(message.progress * 100));
      }
    },
  });
  try {
    const result = await worker.recognize(file);
    const normalized = cleanOcrText(result.data.text);
    if (!normalized) throw new Error("No readable text was found in this image.");
    const text = normalized.slice(0, MAX_EVIDENCE_CHARACTERS);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      kind: "image",
      text,
      characters: text.length,
      truncated: normalized.length > MAX_EVIDENCE_CHARACTERS,
    };
  } finally {
    await worker.terminate();
  }
}

async function extractDocument(file: File): Promise<TaskEvidenceItem> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/attachments", { method: "POST", body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.attachment) {
    throw new Error(data?.error ?? "Could not read this attachment.");
  }
  return { ...data.attachment, id: crypto.randomUUID() } as TaskEvidenceItem;
}

export function TaskEvidence({
  evidence,
  onAdd,
  onRemove,
}: {
  evidence: TaskEvidenceItem[];
  onAdd: (item: TaskEvidenceItem) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(file?: File) {
    if (!file) return;
    if (evidence.length >= MAX_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    setError(null);
    setStatus(file.type.startsWith("image/") ? "Reading screenshot in your browser…" : "Extracting document text…");
    try {
      const item = file.type.startsWith("image/")
        ? await extractImage(file, (progress) => setStatus(`Reading screenshot in your browser… ${progress}%`))
        : await extractDocument(file);
      onAdd(item);
      setStatus(`Added ${item.name}`);
      window.setTimeout(() => setStatus(null), 1800);
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "Could not read this attachment.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id="task-evidence-input"
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => void choose(event.target.files?.[0])}
          disabled={Boolean(status) || evidence.length >= MAX_ATTACHMENTS}
        />
        <label
          htmlFor="task-evidence-input"
          aria-disabled={Boolean(status) || evidence.length >= MAX_ATTACHMENTS}
          className="cursor-pointer rounded-lg border border-line-strong px-3 py-2 text-[11px] font-medium text-muted-light transition hover:border-accent/40 hover:text-paper aria-disabled:pointer-events-none aria-disabled:opacity-40"
        >
          Attach screenshot or document
        </label>
        <span className="text-[11px] text-muted">PDF, DOCX, text, or image · up to 3</span>
      </div>

      {evidence.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Attached task evidence">
          {evidence.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-ink/70 px-3 py-2">
              <details className="min-w-0 flex-1">
                <summary className="cursor-pointer truncate text-[11px] text-paper">
                  {item.name} <span className="text-muted">· {item.kind.toUpperCase()} · {item.characters.toLocaleString()} characters</span>
                </summary>
                <p className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-muted-light">
                  {item.text.slice(0, 1_200)}{item.text.length > 1_200 ? "…" : ""}
                </p>
                {item.truncated && <p className="mt-2 text-[10px] text-recent">Long evidence was safely truncated.</p>}
              </details>
              <button type="button" onClick={() => onRemove(item.id)} className="shrink-0 text-[11px] text-muted transition hover:text-paper">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {(status || error) && (
        <p role={error ? "alert" : "status"} aria-live="polite" className={`mt-2 text-[11px] ${error ? "text-recent" : "text-muted-light"}`}>
          {error ?? status}
        </p>
      )}
      <p className="mt-2 text-[10px] leading-4 text-muted">
        Documents are processed in memory. Screenshot OCR runs in your browser. Attachments are not saved.
      </p>
    </div>
  );
}
