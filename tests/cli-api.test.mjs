import { describe, expect, it } from "vitest";

import {
  LocusApiError,
  MAX_FILE_BYTES,
  MAX_FILES,
  adaptResponse,
  locateRemote,
  uploadableFiles,
} from "../cli/api.mjs";

function repo(files, extra = {}) {
  return { name: "demo", slug: "demo", description: "demo", root: "", recentlyChanged: [], files, ...extra };
}

describe("uploadableFiles", () => {
  it("sends source and drops the manifests the server would reject", () => {
    const upload = uploadableFiles(repo({
      "src/a.ts": "export const a = 1;",
      "package.json": "{}",
      "tsconfig.json": "{}",
    }));
    expect(Object.keys(upload.files)).toEqual(["src/a.ts"]);
    expect(upload.sentFiles).toBe(1);
  });

  it("skips a single oversized file rather than failing the whole run", () => {
    const upload = uploadableFiles(repo({
      "big.ts": "x".repeat(MAX_FILE_BYTES + 1),
      "small.ts": "export const a = 1;",
    }));
    expect(Object.keys(upload.files)).toEqual(["small.ts"]);
    expect(upload.skippedLarge).toBe(1);
  });

  it("stops at the file-count limit and says it truncated", () => {
    const files = {};
    for (let i = 0; i < MAX_FILES + 10; i++) files[`f${String(i).padStart(4, "0")}.ts`] = "export const a = 1;";
    const upload = uploadableFiles(repo(files));
    expect(upload.sentFiles).toBe(MAX_FILES);
    expect(upload.truncated).toBe(true);
  });

  it("refuses a tree with no supported source", () => {
    expect(() => uploadableFiles(repo({ "README.md": "# hi" }))).toThrow(LocusApiError);
  });

  it("refuses when every candidate is oversized, which is not the same as empty", () => {
    expect(() => uploadableFiles(repo({ "big.ts": "x".repeat(MAX_FILE_BYTES + 1) })))
      .toThrow(/over the .* limit/);
  });
});

describe("adaptResponse", () => {
  // fileContent() looks a file up by `rel` under repo.root, so a slice entry
  // without a correct `rel` silently renders as empty context downstream.
  it("derives rel by stripping the source root", () => {
    const result = adaptResponse(
      { slice: [{ path: "src/lib/a.ts", tokens: 10, distance: 0, recent: false }] },
      repo({}, { root: "src/lib" }),
    );
    expect(result.slice[0].rel).toBe("a.ts");
    expect(result.slice[0].path).toBe("src/lib/a.ts");
  });

  it("leaves rel alone when the repo has no root", () => {
    const result = adaptResponse(
      { slice: [{ path: "a.ts", tokens: 10, distance: 0, recent: false }] },
      repo({}),
    );
    expect(result.slice[0].rel).toBe("a.ts");
  });

  it("renames the server's field names back to the local result shape", () => {
    const result = adaptResponse({
      task: "t",
      widened: true,
      anchors: ["a.ts"],
      excluded: ["b.ts"],
      tokens: { included: 5, total: 50 },
      graph: { edgeDensity: 1.25, sparse: true },
      slice: [{ path: "a.ts", tokens: 5, distance: 2, recent: true }],
    }, repo({}));

    expect(result.anchorPaths).toEqual(["a.ts"]);
    expect(result.excludedPaths).toEqual(["b.ts"]);
    expect(result.sliceTokens).toBe(5);
    expect(result.totalTokens).toBe(50);
    expect(result.edgeDensity).toBe(1.25);
    expect(result.sparse).toBe(true);
    expect(result.slice[0].dist).toBe(2);
  });

  it("tolerates a response with no optional sections", () => {
    const result = adaptResponse({}, repo({}));
    expect(result.slice).toEqual([]);
    expect(result.anchorPaths).toEqual([]);
    expect(result.sliceTokens).toBe(0);
  });
});

describe("locateRemote", () => {
  const source = repo({ "a.ts": "export const a = 1;" });

  it("refuses to run without a key rather than sending source unauthenticated", async () => {
    await expect(locateRemote("task", source, { key: "", fetchImpl: async () => {
      throw new Error("must not be called");
    } })).rejects.toThrow(/No API key/);
  });

  it("posts the file map to the locate endpoint with the key", async () => {
    let seen;
    await locateRemote("fix the total", source, {
      key: "lk_test",
      url: "https://example.test/",
      fetchImpl: async (endpoint, init) => {
        seen = { endpoint, init };
        return { ok: true, status: 200, json: async () => ({ slice: [], tokens: { included: 0, total: 0 } }) };
      },
    });

    expect(seen.endpoint).toBe("https://example.test/api/v1/locate");
    expect(seen.init.headers.authorization).toBe("Bearer lk_test");
    const body = JSON.parse(seen.init.body);
    expect(body.task).toBe("fix the total");
    expect(body.files).toEqual({ "a.ts": "export const a = 1;" });
  });

  it("surfaces a rejected key as a key problem, not a generic failure", async () => {
    await expect(locateRemote("t", source, {
      key: "lk_bad",
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: "Invalid key" }) }),
    })).rejects.toThrow(/API key rejected: Invalid key/);
  });

  it("reports the retry window when throttled", async () => {
    await expect(locateRemote("t", source, {
      key: "lk_test",
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => "18" },
        json: async () => ({ error: "Rate limit exceeded." }),
      }),
    })).rejects.toThrow(/retry in 18s/);
  });

  it("names the endpoint when the network fails, since that is the actionable part", async () => {
    await expect(locateRemote("t", source, {
      key: "lk_test",
      url: "https://offline.test",
      fetchImpl: async () => { throw new Error("ECONNREFUSED"); },
    })).rejects.toThrow(/Could not reach the Locus API at https:\/\/offline.test\/api\/v1\/locate/);
  });

  it("reports what it actually uploaded", async () => {
    const result = await locateRemote("t", source, {
      key: "lk_test",
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ slice: [] }) }),
    });
    expect(result.upload.sentFiles).toBe(1);
    expect(result.upload.truncated).toBe(false);
  });
});
