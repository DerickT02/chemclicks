## Getting Started

First, download the necessary packages:

```bash
npm install
```

- **Environment**: copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project (**Settings → API**).

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in the browser.

### Supabase auth (backend)

- **Code layout**: `src/lib/supabase/server.ts` and `client.ts` (cookie-aware clients), `src/lib/supabase/middleware.ts` (`updateSession` helper), `src/proxy.ts` (Next.js 16 session refresh — runs before routes; [docs](https://nextjs.org/docs/messages/middleware-to-proxy)), `src/lib/auth/server.ts` (`getAuthClaims` / `getAuthUser` for protected server code), `src/app/auth/callback/route.ts` (PKCE / email-confirm redirect).
- **Dashboard**: Under **Authentication → URL Configuration**, set **Site URL** (e.g. `http://localhost:3000`) and add **Redirect URLs** including `http://localhost:3000/auth/callback` (and your production URL + `/auth/callback` when you deploy).

## Contributing

- **main** - stable branch
- **dev** - active integration branch
- **feat/\<feature name\>** - atomic branches off of dev

- Feature branches should be smaller than a full story point to avoid merge conflicts.
- Create a pull request to dev whenever a feature is complete.

**Example Workflow in Git**
- We will use the creation of a student-login feature as an example.

1. Create a new branch for the feature you are creating
```bash
git checkout dev
git pull origin dev
git checkout -b feat/student-login
```

2. Commit often in the following form \<type\>:\<short description\>
```bash
git add .
git commit -m "feat: add student login button"
git push
```
For the first push you will have to set the upstream branch so do ```bash git push -u origin feat/student-login``` or whatever your branch is.

3. Merge with dev
```bash
git checkout dev
git pull origin dev
git checkout feat/student-login
git merge dev
```

4. Send a pull request
```bash
git push origin feat/student-login
```

5. Go to github and creat the pull request.

## Resources

- [DevDocs (aggregated docs)](https://devdocs.io/)
- [JavaScript](https://javascript.info/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [React](https://react.dev/)
- [Next.js](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase](https://supabase.com/docs)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
