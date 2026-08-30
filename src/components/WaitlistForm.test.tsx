import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { nextDialogFocusIndex, WaitlistForm } from "@/components/WaitlistForm";

describe("Agent Run access form", () => {
  it("requests design-partner access without paid capability promises", () => {
    const html = renderToStaticMarkup(<WaitlistForm onClose={vi.fn()} />);

    expect(html).toContain("Request Agent Run access");
    expect(html).toContain("Repo localization is already open");
    expect(html).toContain("public Repo");
    expect(html).toContain("Request access");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="alpha-access-title"');
    expect(html).toContain('aria-label="Close alpha access form"');
    expect(html).toContain('for="alpha-access-email"');
    expect(html).toContain('for="alpha-access-use-case"');
    expect(html).toContain(">Email address</label>");
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain("For example: fix a failing CI check");
    expect(html).not.toContain("Pro waitlist");
    expect(html).not.toContain("Private repos");
    expect(html).not.toContain("higher throughput");
  });

  it("keeps keyboard focus inside the dialog", () => {
    expect(nextDialogFocusIndex(3, 4, false)).toBe(0);
    expect(nextDialogFocusIndex(0, 4, true)).toBe(3);
    expect(nextDialogFocusIndex(1, 4, false)).toBe(2);
  });
});
