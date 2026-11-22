import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAX_MARKS, repoColumns } from "@/components/FileField";
import { WorkspaceField } from "@/components/WorkspaceField";

const files = ["src/a.ts", "src/b.ts", "src/c.ts", "lib/d.ts", "lib/e.ts", "README.md"];

function render(props: Partial<React.ComponentProps<typeof WorkspaceField>> = {}) {
  return renderToStaticMarkup(
    <WorkspaceField
      files={files}
      slicePaths={[]}
      anchorPaths={[]}
      loading={false}
      repoName="owner/repo"
      includedShare={0}
      {...props}
    />,
  );
}

describe("the workspace file field", () => {
  it("shows the whole Repo under covers until a Slice exists", () => {
    const html = render();

    expect(html).toMatch(/class="aperture is-open/);
    expect(html.match(/class="aperture-mark"/g)).toHaveLength(files.length);
    expect(html).toContain("One mark per file");
  });

  it("opens onto the user's Slice, marking its Anchors", () => {
    const html = render({ slicePaths: ["src/a.ts", "lib/d.ts"], anchorPaths: ["src/a.ts"], includedShare: 31 });

    expect(html).not.toMatch(/class="aperture is-open/);
    expect(html.match(/data-kind="anchor"/g)).toHaveLength(1);
    expect(html.match(/data-kind="included"/g)).toHaveLength(1);
    expect(html).toContain("31% of Repo tokens in the Slice");
  });

  it("scans only while work is running", () => {
    expect(render({ loading: true })).toContain("is-scanning");
    expect(render({ loading: false })).not.toContain("is-scanning");
  });

  it("groups files into marks for a large Repo so the field stays drawable", () => {
    const many = Array.from({ length: MAX_MARKS * 3 }, (_, i) => `src/file-${i}.ts`);
    const html = render({ files: many, slicePaths: ["src/file-7.ts"] });

    expect(html.match(/class="aperture-mark"/g)?.length).toBeLessThanOrEqual(MAX_MARKS);
    expect(html).toContain("One mark per 3 files");
    expect(html.match(/data-kind="included"/g)).toHaveLength(1);
  });

  it("asks for a Repo when none is loaded", () => {
    expect(render({ files: null, repoName: null })).toContain("Load a public Repo to begin");
  });

  it("keeps the largest folders as columns and gathers the rest into other", () => {
    expect(repoColumns(files, 1).map(({ label }) => label)).toEqual(["src", "other"]);
  });
});
