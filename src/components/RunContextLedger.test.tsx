import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RunContextLedger } from "@/components/RunContextLedger";

describe("RunContextLedger", () => {
  it("shows every Included, Excluded, and Widened path", () => {
    const html = renderToStaticMarkup(
      <RunContextLedger
        included={["src/app/page.tsx"]}
        excluded={["src/lib/billing.ts", "src/lib/teams.ts"]}
        widened={["src/lib/shared.ts"]}
      />,
    );

    expect(html).toContain("Included");
    expect(html).toContain("src/app/page.tsx");
    expect(html).toContain("Excluded");
    expect(html).toContain("src/lib/billing.ts");
    expect(html).toContain("src/lib/teams.ts");
    expect(html).toContain("Widened");
    expect(html).toContain("src/lib/shared.ts");
  });

  it("makes an empty ledger explicit", () => {
    const html = renderToStaticMarkup(
      <RunContextLedger included={[]} excluded={[]} widened={[]} />,
    );

    expect(html.match(/None recorded/g)).toHaveLength(3);
  });
});
