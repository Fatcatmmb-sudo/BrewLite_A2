# BrewLite API - NestJS / PostgreSQL

Requires Node **24.x** and npm. Run in `apps/api`:

```powershell
npm ci
npm run lint
npm test
npm run build
```

`npm ci` generates Prisma Client into ignored `src/generated/prisma`. These CI
commands do not connect to a database or run migrations. `npm run typecheck`
also checks unit test types. Unit tests mock the repository; they do not prove
PostgreSQL transactions, migration correctness or browser E2E behavior.

## Local runtime

Create `apps/api/.env` using the root sample. Set `DATABASE_URL` to your own
local PostgreSQL database, `PORT=3001`, `CORS_ORIGIN=http://localhost:3000`.
Both Prisma CLI and API load `.env` from the working directory `apps/api`.

```powershell
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Migrate and seed write to the database. Use only your local/test database;
these commands have not been verified against PostgreSQL in this CI task.
The existing schema/seed still need their separate acceptance under #35.

Routes: `GET /api/v1/products`, `GET /api/v1/products/:id`. Invalid UUIDs
return 400; a missing product returns 404. Startup requires a valid DATABASE_URL,
but PostgreSQL connection is lazy so the API can start while the database is
unavailable and report 503 from readiness. Rebuild after source changes before
starting again.

Catalog, auth and readiness modules are enabled. Auth provides register/login/me,
bcrypt password hashing, short-lived HS256 JWTs with issuer/audience checks, and
role claims. Public registration always creates `CUSTOMER`; validation rejects
extra properties. `GET /api/v1/health` probes PostgreSQL and returns 200 or a
generic 503. Each response includes `X-Request-Id`; request logs are JSON and do
not include request bodies, headers, credentials, or database URLs. Startup
validates required environment variables and exits with a redacted error record.

Orders and payment services are present in the repository but are not wired into
the running API yet. Ownership checks, refresh-token/session UX and production
readiness evidence remain open. See [PR CI](../../docs/ci-pull-request.md).

## Catalog test suites

`npm test` discovers unit tests in both `src/**/*.spec.ts` and `test/**/*.spec.ts`.
`npm run test:integration` explicitly runs `test/**/*.integration-spec.ts`. It
requires `SMOKE_DATABASE_URL` pointing to a disposable database whose name starts
with `brewlite_foundation_smoke`. The seed suite writes test fixtures and refuses
other database names. Never use production or a shared DB. The integration suite
is not part of unit CI and has not been executed in this maintenance task.
