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
