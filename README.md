# Urja Meter API

`urja-api` is a read-only REST service in front of the Urja Meter Ops portal. It authenticates with a portal account, loads the portal's signed export and transformer records, normalizes meter data, and serves consistent JSON.

## Current status

- Meter listing, filtering, search, pagination, and detail lookup
- Nearby-meter queries using latitude and longitude
- Transformer records and the Zone-to-DT hierarchy
- Data-quality reporting for repairs and hierarchy conflicts
- In-memory snapshot caching with stale-on-error behavior
- OpenAPI 3.0 documentation and interactive docs at `/docs`
- Offline unit and HTTP tests

Consumption energy data has been investigated but is not exposed by the API.

## Requirements

- Node.js 20.6 or newer
- A valid Urja Meter Ops account
- Network access to the portal

## Setup and run

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
URJA_BASE_URL=https://urja-ops.flockenergy.tech
URJA_EMAIL=your-account-email
URJA_PASSWORD=your-password
PORT=3000
```

Do not commit `.env`; it is excluded by `.gitignore`.

```powershell
npm start
```

The API runs at `http://localhost:3000`. Open `http://localhost:3000/docs` for interactive documentation.

## Test

```powershell
npm test
```

Tests use saved fixtures and do not require portal credentials.

## API endpoints

| Method and path | Purpose |
|---|---|
| `GET /health` | Liveness check; does not call the portal |
| `GET /meters` | Paginated meter list with filters, search, and proximity search |
| `GET /meters/{id}` | One normalized meter |
| `GET /transformers` | Transformer master records |
| `GET /hierarchy` | Zone-to-DT network tree |
| `GET /data-quality` | Repaired meter values and hierarchy conflicts |
| `GET /openapi.json` | OpenAPI document |
| `GET /docs` | Interactive API documentation |

`/meters` supports `page`, `pageSize`, `make`, `installStatus`, `phaseType`, `transformer`, `q`, `near=lat,lng`, and `radiusKm`.

Example requests:

```powershell
Invoke-RestMethod "http://localhost:3000/meters?make=HPL&pageSize=10"
Invoke-RestMethod "http://localhost:3000/meters?near=26.9124,75.7873&radiusKm=3"
```

List and detail responses include `meta.fetchedAt` and `meta.stale`. API errors use a JSON `error` object with `code`, `message`, and an appropriate HTTP status.

## How it works

The service loads all meter records from `GET /portal/export` and transformer records from `GET /portal/dts`. The export request is signed with HMAC-SHA256 using a signing secret obtained from `GET /portal/keys`.

The meter snapshot is cached in memory for 10 minutes. Concurrent refreshes and logins are shared, while a failed refresh can return the previous snapshot marked as stale.

Hierarchy repairs are visible rather than silent. Missing values are filled first from transformer master data and then from the most common value among meters on the same DT. Unrepairable fields remain `null` and appear in `/data-quality`.

## Project structure

- `src/portal/` - login, HTTP client, signed export, and portal decoding
- `src/parsers/` - meter-page parsing and investigation support
- `src/normalize.js` - export normalization and repair warnings
- `src/hierarchy.js` - hierarchy tree and conflict detection
- `src/store.js` - snapshot cache and refresh behavior
- `src/routes.js` - REST routes
- `test/` - unit and HTTP tests
- `fixtures/` - saved portal data for offline tests
- `scripts/` - investigation utilities

## Limits

- The snapshot is process-local and starts cold after a restart.
- Meter filtering and `near` queries use linear scans.
- The API uses one service account and has no API authentication or rate limiting.
- Tests verify offline behavior and the saved fixture, not the live portal continuously.

See [PROTOCOL.md](./PROTOCOL.md) for the portal investigation and [REFLECTION.md](./REFLECTION.md) for the project reflection.
