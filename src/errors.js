export class PortalError extends Error {
  constructor(message, { status = 502, code = "portal_error" } = {}) {
    super(message);
    this.name = "PortalError";
    this.status = status;   // HTTP status OUR API should return
    this.code = code;
  }
}

/** The caller sent something invalid (400) or asked for something that doesn't exist (404). */
export class ApiError extends Error {
  constructor(message, { status = 400, code = "bad_request" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
