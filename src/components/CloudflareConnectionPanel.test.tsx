// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudflareConnectionPanel } from "@/components/CloudflareConnectionPanel";

describe("Cloudflare connection setup", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("explains BYOK in plain language without exposing a token value", () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ configured: false }) });
    const { container } = render(<CloudflareConnectionPanel />);

    expect(screen.getByText(/one shared Agent Run per day across the beta/)).toBeTruthy();
    expect(screen.getByLabelText("Cloudflare Account ID")).toBeTruthy();
    expect(screen.getByLabelText("Workers AI API token")).toHaveProperty("type", "password");
    expect(container.textContent).toContain("Encrypted before storage");
    expect(container.textContent).not.toContain("secret-cloudflare");
  });

  it("loads, saves, clears, and removes a connection without rendering identifiers", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: false }) });
    const { container } = render(<CloudflareConnectionPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/provider-credential",
      expect.objectContaining({ cache: "no-store" }),
    ));

    fireEvent.change(screen.getByLabelText("Cloudflare Account ID"), {
      target: { value: "0123456789abcdef0123456789abcdef" },
    });
    fireEvent.change(screen.getByLabelText("Workers AI API token"), {
      target: { value: "cloudflare-token-that-is-long-enough" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect Cloudflare" }));

    await waitFor(() => expect(screen.getByText("Connected")).toBeTruthy());
    expect(screen.getByLabelText("Cloudflare Account ID")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Workers AI API token")).toHaveProperty("value", "");
    expect(container.textContent).not.toContain("0123456789abcdef0123456789abcdef");
    expect(container.textContent).not.toContain("cloudflare-token-that-is-long-enough");

    fireEvent.click(screen.getByRole("button", { name: "Remove connection" }));
    await waitFor(() => expect(screen.getByText("Not connected")).toBeTruthy());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/provider-credential", { method: "DELETE" });
  });
});
