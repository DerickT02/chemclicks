# Chemclicks — agent instructions

## Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript 5 with `strict` mode (`tsconfig.json`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`, `globals.css`)
- **Backend / auth (planned or in use)**: Supabase (`@supabase/supabase-js`, `@supabase/ssr` for Next.js cookie/session patterns)
- **Lint**: ESLint 9 + `eslint-config-next`

## Conventions

- **Paths**: Use the `@/*` alias mapped to `./src/*` (not deep relative imports across packages).
- **App Router**: Routes and layouts live under `src/app/`. Use `layout.tsx`, `page.tsx`, and route groups as Next.js documents.
- **Components**: Shared UI under `src/components/`. Add `"use client"` only when the module needs hooks, browser APIs, or client-only libraries.
- **Data & secrets**: Environment variables via Next.js conventions (`NEXT_PUBLIC_*` for client-exposed values). Do not commit secrets; use `.env.local` locally.
- **Supabase in Next.js**: Prefer `@supabase/ssr` helpers for server components, route handlers, and middleware; keep cookie handling server-side. Use the JS client for client components only when appropriate.

## Code style

- Match existing formatting and naming in the file you edit.
- Prefer functional components and explicit TypeScript types for exported APIs and props.
- Run `npm run lint` after substantive edits; fix new issues in touched files.

## Best practices

### Next.js (App Router)

- **Default to Server Components** — add `"use client"` only at boundaries that need interactivity or browser-only APIs; keeps bundles smaller and data on the server.
- **Colocate route concerns** — `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` in the route segment; use `generateMetadata` for SEO where pages are public.
- **Fetching** — in Server Components, prefer `fetch` with Next.js caching semantics; use `cache: 'no-store'` or `revalidate` when data must be fresh or ISR-tagged.
- **Navigation** — use `next/link` and `useRouter` from `next/navigation` (App Router), not legacy `next/router`.
- **Assets** — use `next/image` for images with explicit `width`/`height` or `fill` where appropriate.

### React

- **Stable lists** — use stable, unique `key` values (not array index) for repeated UI.
- **Effects** — avoid unnecessary `useEffect`; derive state when possible; sync with external systems when effects are required.
- **Accessibility** — prefer semantic HTML, labels for inputs, and keyboard-navigable controls.

### TypeScript

- Rely on **strict** types; avoid `any`; use `unknown` and narrow when handling untyped data.
- **Props** — type component props explicitly (`type Props` or `interface`); export types only when reused or part of the public API.

### Tailwind CSS

- Prefer **design tokens** from the theme (e.g. `bg-background`, spacing scale) over one-off arbitrary values unless the design calls for it.
- Keep **class order** consistent with surrounding files; extract repeated clusters into components or small helpers when it improves clarity.

### Supabase

- **Row Level Security (RLS)** — enable and test policies for any table exposed to the client; never rely on the client alone for authorization.
- **Clients** — server-side session/cookie flows via `@supabase/ssr`; avoid exposing service-role keys to the browser.
- **Keys** — `NEXT_PUBLIC_*` is visible to users; only put anon-safe values there.

### Security & configuration

- Validate **server-side** for mutations (forms, Server Actions, Route Handlers); treat client validation as UX only.
- Document required **env vars** in README or `.env.example`; never commit `.env.local` or real secrets.

## What not to do

- Do not introduce alternate frameworks, CSS solutions, or state libraries unless the task explicitly requires it.
- Avoid drive-by refactors outside the scope of the request.
