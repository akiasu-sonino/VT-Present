# CLAUDE.md - Hono (Vite/Vercel) Project Rules

## Commands
- **Run Dev**: `npm run dev` (Runs `vite` dev server)
- **Build**: `npm run build` (Runs `vite build` for Vercel)
- **Deploy**: `vercel` or `vercel --prod`
- **Lint**: `npm run lint`
  - Since builds and lint checks are performed by humans, there is no need to suggest them.
  
## Tech Stack
- **Framework**: Hono (v4+)
- **Build Tool**: Vite
- **Platform**: Vercel
- **Language**: TypeScript

## Architecture & Configuration
- **Entry Point**: `src/index.ts` (or similar).
- **Vercel Adapter**: MUST use `handle` from `hono/vercel` for production exports.
  - *Example*: `export const GET = handle(app); export const POST = handle(app);`
- **Vite Config**: Uses `@hono/vite-dev-server` for local development.
  - Ensures fast HMR (Hot Module Replacement) and consistent environment variables.

## Coding Standards
- **Routing**: Chained route definitions (e.g., `app.get('/', ...)`).
- **Context**: Use `c` for context. Access query/body via `c.req`.
- **Response**: Return `c.json()` or `c.html()`.
- **Environment Vars**: Access via `c.env` (Cloudflare style) or `process.env` (Node style), depending on the adapter setup. Prioritize `c.env` for Hono portability.

## Behavior
- **Concise**: Output code directly.
- **Config Awareness**: Check `vite.config.ts` if server startup fails.
- **Vercel Specifics**: When writing new routes, ensure they are compatible with Vercel Edge/Serverless limits (e.g., execution time).