# ⚗️ ChemClicks

> *Chemistry education, one click at a time.*

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat-square&logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## 📖 Synopsis

**ChemClicks** is an interactive chemistry education web application built for students and instructors at the college level. The platform allows students to explore chemical concepts through click-driven modules — bridging the gap between passive reading and hands-on lab work. Instructors can assign modules, track progress, and assess understanding through built-in quizzes and simulations.

ChemClicks is developed as a senior capstone project at **California State University, Sacramento** for **CSC 190/191**.

---

## 🖼️ Screenshots & Prototypes

> *Prototype images and wireframes will be added here upon completion of the UI design phase.*

| View | Preview |
|------|---------|
| Landing Page | `public/mockups/landing.png` *(placeholder)* |
| Student Dashboard | `public/mockups/dashboard.png` *(placeholder)* |
| Quiz Module | `public/mockups/quiz.png` *(placeholder)* |
| Instructor View | `public/mockups/instructor.png` *(placeholder)* |

---

## 🗂️ Entity Relationship Diagram

![ChemClicks ERD](public/ERD.png)

**Tables:** `STUDENTS` · `TEACHERS` · `CLASSES` · `CLASS_ACTIVITIES` · `ACTIVITES` · `QUESTIONS` · `ANSWERS` · `STUDENT_ATTEMPTS` · `ATTEMPT_RESPONSES` · `STUDENT_PROGRESS`

Key relationships:
- **Teachers** teach **Classes**, which have **Class Activities** linked to **Activities**
- **Students** belong to **Classes** and track progress via **Student Progress**
- **Student Attempts** log each quiz attempt and link to **Attempt Responses**
- **Questions** have **Answers** (supporting multiple correct answers via `allow_multiple_correct`)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Linting | ESLint |
| Package Manager | npm |

---

## 🚀 Developer Instructions

### Prerequisites

- **Node.js** v18+
- **npm** v9+
- A [Supabase](https://supabase.com) project (free tier works)

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/DerickT02/chemclicks.git
cd chemclicks

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your Supabase URL and anon key in .env.local

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready code |
| `dev` | Active integration branch |
| `feat/<name>` | Feature branches off `dev` |

#### Workflow

```bash
# Start a new feature
git checkout dev
git pull origin dev
git checkout -b feat/your-feature-name

# Commit often with semantic messages
git add .
git commit -m "feat: add quiz submission handler"
git push -u origin feat/your-feature-name

# Keep your branch up to date with dev
git fetch origin
git merge origin/dev

# Open a pull request → dev when complete
```

**Commit message format:** `<type>: <short description>`
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

---

## 🧪 Testing

> *This section will be completed in CSC 191.*

Planned testing strategy:

- **Unit Tests** — Component-level logic using [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/)
- **Integration Tests** — API routes and Supabase interactions
- **End-to-End Tests** — Full user flows using [Playwright](https://playwright.dev/)

```bash
# Run unit tests (CSC 191)
npm run test

# Run e2e tests (CSC 191)
npm run test:e2e
```

---

## 📦 Deployment

> *This section will be completed in CSC 191.*

Planned deployment pipeline:

- **Hosting:** [Vercel](https://vercel.com) (Next.js native)
- **Database:** Supabase hosted PostgreSQL
- **CI/CD:** GitHub Actions → auto-deploy on merge to `main`

```bash
# Build for production (CSC 191)
npm run build
npm run start
```

---

## 📅 Project Timeline & Milestones

> Managed via JIRA — Scrum methodology with 2-week sprints.

### 🏁 Sprint 1 — Foundation
**Status:** ✅ Complete

| Story | Description |
|-------|-------------|
| Project scaffolding | Initialize Next.js + Tailwind + Supabase |
| Repo setup | Branch strategy, ESLint config, `.gitignore` |
| Database schema v1 | Users, modules, progress tables |
| Auth flow | Supabase Auth: student & instructor login |
| Landing page | Basic homepage and routing |

---

### 🔨 Sprint 2 — Boilerplate & Project Setup
**Status:** ✅ Complete

| Story | Description |
|-------|-------------|
| Next.js scaffolding | Initialized app with TypeScript, Tailwind, ESLint configs |
| Supabase integration | Connected Supabase client, set up environment variables |
| Folder structure | Established `src/`, `database/`, `public/` directory layout |
| Config files | Set up `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` |
| Git hygiene | `.gitignore`, `.hintrc`, initial branch strategy enforced |

---

### 🏠 Sprint 3 — Homepage
**Status:** ✅ Complete

| Story | Description |
|-------|-------------|
| Homepage design | Built and styled the landing/homepage UI |
| Navigation | Header, routing, and page layout structure |
| Static content | Initial copy, layout components, and visual polish |

---

### 🔲 Sprint 4
**Status:** *(placeholder — update with JIRA milestones)*

| Story | Description | Status |
|-------|-------------|--------|
| *(Sprint 4 story)* | *(Description)* | 🔲 To Do |

---

### 🔐 Sprint 5 — Authentication & Teacher Dashboard
**Status:** ✅ Complete

| Story | Description |
|-------|-------------|
| Authentication | Supabase Auth integration — student & instructor login/signup |
| Role-based access | Route protection based on user role (student vs. instructor) |
| Teacher dashboard | Instructor-facing dashboard UI — class overview and management |

---

## 📚 Resources

| Resource | Link |
|----------|------|
| General Docs | [devdocs.io](https://devdocs.io/) |
| JavaScript Basics | [javascript.info](https://javascript.info/) |
| TypeScript Docs | [typescriptlang.org/docs](https://www.typescriptlang.org/docs/) |
| Next.js Docs | [nextjs.org/docs](https://nextjs.org/docs) |
| Tailwind Docs | [tailwindcss.com/docs](https://tailwindcss.com/docs) |
| Supabase Docs | [supabase.com/docs](https://supabase.com/docs) |

---


## 📄 License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE) for details.

---

<p align="center">
  Built with ☕ and too many chemistry puns at Sacramento State
</p>
