# @contractspec/app.web-colourmap-application

Next.js app shell for the **clarity** product.

## Product intent

Clarity is the productivity and mission-flow surface derived from `specs/alyn-strategy/`.

## Architecture

- routes and app wiring live here
- product logic is imported from `@contractspec/bundle.colourmap-product`
- shared UI is imported from the shared UI libs

## Security

- **Encryption in transit**: HTTPS via Vercel; Supabase uses TLS for DB connections.
- **Encryption at rest**: Supabase Postgres and Vercel KV (if used) encrypt data at rest by default.
- **Secrets**: `MISTRAL_API_KEY`, `ELEVENLABS_API_KEY` via env; never logged.

## Boundaries

- no business logic implementation in app routes/components
- no direct imports from `health` or `hcircle` bundle internals

## Scripts

```bash
bun run dev --filter @contractspec/app.web-colourmap-application
bun run build --filter @contractspec/app.web-colourmap-application
```

## Environment

Copy `.env.example` to `.env.local` and fill in required values. See `.env.example` for variable documentation.
