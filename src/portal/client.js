import { PortalError } from "../errors.js";

export class PortalClient {
  constructor({ baseUrl, email, password, timeoutMs = 10_000 }) {
    this.baseUrl = baseUrl;
    this.email = email;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.cookie = null;
    this.loginPromise = null; // shared so concurrent requests trigger ONE login
  }

  async login() {
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = this.#doLogin().finally(() => {
      this.loginPromise = null;
    });
    return this.loginPromise;
  }

  async #doLogin() {
    let res;
    try {
      res = await fetch(`${this.baseUrl}/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: this.baseUrl, // SvelteKit CSRF check
        },
        body: new URLSearchParams({ email: this.email, password: this.password }),
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw this.#networkError(err);
    }
    if (res.status !== 200) {
      throw new PortalError(`Portal login failed (${res.status})`, {
        status: 502, code: "portal_login_failed",
      });
    }
    const setCookie = res.headers
      .getSetCookie()
      .find((c) => c.startsWith("__Secure-better-auth.session_token="));
    if (!setCookie) {
      throw new PortalError("Portal login returned no session cookie", {
        status: 502, code: "portal_no_session",
      });
    }
    this.cookie = setCookie.split(";")[0];
  }

  /**
   * GET a portal path and return parsed JSON. Re-logs in once if the session has expired.
   * Expiry looks different per route: /portal/* gives HTTP 401, while SvelteKit
   * __data.json gives HTTP 200 with {"type":"redirect","location":"/login"}.
   */
  async getJson(path, { retried = false, headers = {} } = {}) {
    if (!this.cookie) await this.login();

    let res, text;
    try {
      res = await fetch(this.baseUrl + path, {
        headers: { Accept: "application/json", Cookie: this.cookie, ...headers },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      text = await res.text();
    } catch (err) {
      throw this.#networkError(err);
    }

    let body = null;
    try { body = JSON.parse(text); } catch { /* handled below */ }

    const expired =
      res.status === 401 ||
      (body?.type === "redirect" && String(body.location ?? "").startsWith("/login"));

    if (expired) {
      if (retried) {
        throw new PortalError("Portal rejected a fresh session", {
          status: 502, code: "portal_session_rejected",
        });
      }
      this.cookie = null;
      await this.login();
      return this.getJson(path, { retried: true, headers });
    }
    if (res.status === 404) {
      throw new PortalError("Not found in portal", { status: 404, code: "not_found" });
    }
    if (!res.ok) {
      throw new PortalError(`Portal responded ${res.status}`, {
        status: 502, code: "portal_bad_response",
      });
    }
    if (body === null) {
      throw new PortalError("Portal returned non-JSON", {
        status: 502, code: "portal_bad_payload",
      });
    }
    return body;
  }

  #networkError(err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    return new PortalError(timedOut ? "Portal timed out" : "Portal unreachable", {
      status: timedOut ? 504 : 502,
      code: timedOut ? "portal_timeout" : "portal_unreachable",
    });
  }
}

