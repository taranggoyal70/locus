import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WaitlistForm } from "@/components/WaitlistForm";

describe("alpha access form", () => {
  it("requests design-partner access without paid capability promises", () => {
    const html = renderToStaticMarkup(<WaitlistForm onClose={vi.fn()} />);

    expect(html).toContain("Request alpha access");
    expect(html).toContain("public Repo");
    expect(html).toContain("Request access");
    expect(html).not.toContain("Pro waitlist");
    expect(html).not.toContain("Private repos");
    expect(html).not.toContain("higher throughput");
  });
});
