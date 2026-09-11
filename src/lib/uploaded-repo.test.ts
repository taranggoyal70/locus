import { describe, expect, it } from "vitest";

import {
  UPLOAD_MAX_FILES,
  UPLOAD_MAX_FILE_BYTES,
  UploadRejectedError,
  commonRoot,
  repoFromUpload,
} from "@/lib/uploaded-repo";

describe("repoFromUpload", () => {
  it("builds a repo whose root matches the shared prefix", () => {
    const { repo, analyzedFiles } = repoFromUpload({
      "src/lib/a.ts": "export const a = 1;",
      "src/lib/b.ts": "import { a } from './a';",
    });
    expect(repo.root).toBe("src/lib");
    expect(analyzedFiles).toBe(2);
    expect(Object.keys(repo.files)).toHaveLength(2);
  });

  it("reports the byte total it accepted", () => {
    const { sourceBytes } = repoFromUpload({ "a.ts": "abcd" });
    expect(sourceBytes).toBe(4);
  });

  it("counts bytes rather than characters, so multi-byte source cannot slip the cap", () => {
    // A naive `.length` check would read this as 1 unit instead of 4 bytes, and
    // the per-file limit would be four times larger than advertised for any
    // non-ASCII source file.
    const { sourceBytes } = repoFromUpload({ "a.ts": "𝑥" });
    expect(sourceBytes).toBe(4);
  });

  // Traversal is the reason this module exists as its own validated seam. An
  // uploaded map is caller-controlled, so each rejected shape is a test.
  it.each([
    ["../secrets.ts", "traversal"],
    ["/etc/passwd.ts", "absolute"],
    ["src/../../x.ts", "traversal mid-path"],
    ["src\\win.ts", "backslash"],
    ["./a.ts", "dot segment"],
  ])("rejects %s (%s)", (path) => {
    expect(() => repoFromUpload({ [path]: "x" })).toThrow(UploadRejectedError);
  });

  it("rejects a file type the localizer cannot parse", () => {
    expect(() => repoFromUpload({ "README.md": "# hi" })).toThrow(/Unsupported file type/);
  });

  it("rejects non-string contents", () => {
    expect(() => repoFromUpload({ "a.ts": 42 })).toThrow(/must be a string/);
  });

  it("rejects an empty map", () => {
    expect(() => repoFromUpload({})).toThrow(/at least one source file/);
  });

  it("rejects an array, which would otherwise index as numeric paths", () => {
    expect(() => repoFromUpload(["a.ts"])).toThrow(/must be a JSON object/);
  });

  it("rejects more files than the limit", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i <= UPLOAD_MAX_FILES; i++) files[`f${i}.ts`] = "x";
    expect(() => repoFromUpload(files)).toThrow(/Too many files/);
  });

  it("rejects a single file over the per-file limit", () => {
    expect(() => repoFromUpload({ "a.ts": "x".repeat(UPLOAD_MAX_FILE_BYTES + 1) }))
      .toThrow(/per-file limit/);
  });

  it("rejects a map whose total exceeds the budget", () => {
    const files: Record<string, string> = {};
    // 60 files just under the per-file cap clears every individual check and
    // only trips the aggregate one.
    for (let i = 0; i < 60; i++) files[`f${i}.ts`] = "x".repeat(UPLOAD_MAX_FILE_BYTES - 1);
    expect(() => repoFromUpload(files)).toThrow(/total limit/);
  });
});

describe("commonRoot", () => {
  it("is empty when files sit at the top level", () => {
    expect(commonRoot(["a.ts", "b.ts"])).toBe("");
  });

  it("stops at the last shared directory", () => {
    expect(commonRoot(["src/a/x.ts", "src/b/y.ts"])).toBe("src");
  });
});
