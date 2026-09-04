import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ApiKeysPanel } from "@/components/ApiKeysPanel";

describe("ApiKeysPanel", () => {
  it("shows a loading state rather than an empty list on first paint", () => {
    // Server-rendered, before the keys request resolves. Rendering "no API keys
    // yet" here would tell a user with keys that they have none.
    const html = renderToStaticMarkup(<ApiKeysPanel />);
    expect(html).toContain("skeleton");
    expect(html).not.toContain("No API keys yet");
  });
});
