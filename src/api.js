const api = {
  async request(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        credentials: "include",
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new Error("Can't reach MoveMate. Start the app with npm run dev and try again.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("The server returned an unexpected response. Restart MoveMate with npm run dev.");
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
    return payload;
  },
  currentUser() { return this.request("/api/me"); },
  register(details) { return this.request("/api/register", { method: "POST", body: JSON.stringify(details) }); },
  login(details) { return this.request("/api/login", { method: "POST", body: JSON.stringify(details) }); },
  logout() { return this.request("/api/logout", { method: "POST" }); },
  quote(details) { return this.request("/api/quotes", { method: "POST", body: JSON.stringify(details) }); },
  shipments() { return this.request("/api/shipments"); },
  shipment(id) { return this.request(`/api/shipments/${encodeURIComponent(id)}`); },
  track(code) { return this.request(`/api/track/${encodeURIComponent(code)}`); },
  book(details) { return this.request("/api/shipments", { method: "POST", body: JSON.stringify(details) }); },
};

export default api;
