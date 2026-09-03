import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountEmailPanel } from "@/components/AccountEmailPanel";

describe("AccountEmailPanel", () => {
  it("tells an unverified account why Runs are unavailable and where to fix it", () => {
    const html = renderToStaticMarkup(
      <AccountEmailPanel email="dev@example.com" verified={false} />,
    );

    expect(html).toContain("Verify your email to start Agent Runs");
    expect(html).toContain("dev@example.com");
    expect(html).toContain('href="/settings/account"');
  });

  it("says localization still works, so the account knows what it has not lost", () => {
    const html = renderToStaticMarkup(<AccountEmailPanel email={null} verified={false} />);
    expect(html).toMatch(/localization works either way/i);
  });

  it("handles an account with no address at all", () => {
    const html = renderToStaticMarkup(<AccountEmailPanel email={null} verified={false} />);
    expect(html).toContain("no verified email address yet");
    expect(html).not.toContain("null");
  });

  it("confirms a verified address rather than saying nothing", () => {
    // Silence would leave a user hunting through settings for a cause that is
    // not here.
    const html = renderToStaticMarkup(
      <AccountEmailPanel email="dev@example.com" verified />,
    );
    expect(html).toContain("is verified");
    expect(html).not.toContain("Action needed");
  });
});
