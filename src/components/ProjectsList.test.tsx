import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProjectsList } from "@/components/ProjectsList";

describe("ProjectsList", () => {
  it("renders a loading state rather than an empty page on first paint", () => {
    // Server-rendered, before the fetch effect runs. An empty render here would
    // read as "you have nothing saved" to anyone with a slow connection, which
    // is the one message this list must never show by accident.
    const html = renderToStaticMarkup(<ProjectsList />);
    expect(html).toContain("skeleton");
    expect(html).not.toContain("No saved analyses yet");
  });
});
