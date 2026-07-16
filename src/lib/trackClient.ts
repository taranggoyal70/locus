export function trackClient(event: string, properties?: Record<string, unknown>) {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
  }).catch(() => {});
}
