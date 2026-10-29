# Portal Protocol

This document summarizes what was verified while investigating the Urja Meter Ops portal as a normal logged-in user. The investigation used browser DevTools, repeated HTTP requests, and the portal's JavaScript bundles. All data access remained read-only.

## Authentication

The portal uses an SvelteKit form login:

```http
POST /login
Content-Type: application/x-www-form-urlencoded
Origin: https://urja-ops.flockenergy.tech
Accept: application/json
```

The form fields are `email` and `password`. Requests without the required `Origin` header receive SvelteKit's cross-site form-submission error.

Successful login returns a redirect-style JSON response and sets an `__Secure-better-auth.session_token` cookie. The API stores the cookie name and value and retries with a fresh login if the portal rejects it.

Session expiry is returned differently by portal endpoints:

| Route family | Verified expiry response |
|---|---|
| `/portal/*` | HTTP 401 with an authorization error |
| SvelteKit meter page data | HTTP 200 redirect envelope |

The client therefore checks both HTTP status and response body.

## Portal endpoints

### Meter search

`GET /portal/meters/search?q=&page=` returns 20 meters per page. The search endpoint is not used for the main snapshot because the signed export supplies all records in one response.

Observed behavior includes:

- One-based pages
- A practical page size of 20
- Case-insensitive substring search over meter ID and serial number
- Empty pages after the final page
- Silent acceptance of invalid page values

### Transformer records

`GET /portal/dts?page=N` returns the distribution-transformer master list, with 20 records per page. It supplies transformer names, feeder codes, and capacity values.

### Meter page data

`GET /meters/{id}/__data.json` returns SvelteKit's flattened page-data format. Meter nameplate fields have two observed shapes:

1. A parameter-array shape containing labeled meter fields
2. A JSON-in-JSON shape under `classData`

The parser supports these shapes for investigation. The normal API snapshot comes from the export rather than fetching every meter page.

### Geography

`GET /portal/meters/{id}/geo` returns latitude and longitude as strings. Export geography values matched the tested geo endpoint values.

### Energy

`GET /portal/meters/{id}/energy` returns half-hour cumulative readings as strings. The tested timestamps use `DD/MM/YYYY HH:mm` with no timezone, and the investigated data ends in June 2026.

The portal accepts `from` and `to` for filtering, but ignores some invalid and unsupported parameters. This endpoint is not exposed by the current API.

### Signed export

The bulk export is `GET /portal/export`. It is signed as follows:

1. Get the signing secret with `GET /portal/keys`.
2. Create a Unix timestamp in seconds.
3. Build `GET\n/portal/export\npage=1\n<Timestamp>`.
4. Calculate HMAC-SHA256 with lowercase hexadecimal output.
5. Send the signature in `x-signature` and timestamp in `x-timestamp`.

The export includes 403 meter records and matches the search endpoint for the main tested fields. It ignores the `page` parameter, so the implementation fetches it once.

## Hierarchy findings

The hierarchy levels are Zone, Circle, Division, Subdivision, Substation, Feeder, and Distribution Transformer.

Codes are reused under different parents. A hierarchy node is therefore identified by its full code path rather than by code alone.

The export contained incomplete hierarchy values. The implementation repairs values from:

1. Transformer master data, when available
2. The majority value among other meters on the same DT
3. No source: leave the field incomplete and report it

Every repair is exposed through meter warnings and `/data-quality`; conflicting hierarchy values are not hidden.

## Design mapping

| Portal behavior | API behavior |
|---|---|
| Signed export supplies complete inventory | One export fetch plus transformer fetch per refresh |
| Export page parameter is ignored | One export request with `page=1` |
| Portal data contains gaps | Normalize and report repairs |
| Codes repeat below different parents | Tree keys use full code paths |
| Session expiry has two response forms | Re-login once after either form |
| Invalid portal parameters may be accepted | API validates query parameters and returns HTTP 400 |
