## Getting Started

First, download the necessary packages:

```bash
npm install
```

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

- [Best place for general documentation](https://devdocs.io/)
- [Javascript Basics](https://javascript.info/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind Docs](https://tailwindcss.com/docs/installation/using-vite)
- [Supabase Docs](https://supabase.com/docs)
