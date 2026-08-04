import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Release1EvidencePage from "@/app/evidence/release-1/page";

describe("Release 1 public evidence", () => {
  it("publishes the frozen method without claiming an incomplete result", () => {
    const html = renderToStaticMarkup(<Release1EvidencePage />);

    expect(html).toContain("The claim stays locked until the evidence is complete");
    expect(html).toContain("0<span class=\"text-xl text-muted\">/40");
    expect(html).toContain("Outcome metrics are withheld while evidence is incomplete");
    expect(html).not.toContain("locus-origin-cookie");
    expect(html.match(/>Frozen<\/span>/g)).toHaveLength(20);
    expect(html).toContain(">Locked</span>");
    expect(html).not.toContain("Verified token savings");
  });
});
