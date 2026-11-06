# BrewLite Web - Next.js

Requires Node **24.x** and npm. Run in `apps/web`:

```powershell
npm ci
npm run lint
npm test
npm run build
npm start
```

For development: `npm run dev`, then open http://localhost:3000.
For a separate type check: `npm run typecheck` (build also checks TypeScript).

The minimal menu fetches `GET /api/v1/products`, displays name/description/price,
and handles loading, empty, failure and retry. The default API base is
`http://localhost:3001/api/v1`. Set `NEXT_PUBLIC_API_BASE_URL` in
`apps/web/.env.local` **before building** to change it. Public variables are
embedded into the client bundle; never put secrets there.

Build does not fetch the API or remote fonts, and needs no running database.
Unit tests cover API envelopes, invalid products, VND formatting, empty menus,
HTTP/network errors and abort signal forwarding. Browser E2E is not covered.

Cart/auth/checkout, advanced menu and PWA remain separate PRs/issues
(#22/#26/#14). This minimal runtime does not implement those features.
Do not commit `.next`, `node_modules` or `.env.local`.
See [PR CI](../../docs/ci-pull-request.md).
