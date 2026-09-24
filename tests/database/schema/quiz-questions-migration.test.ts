import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../supabase/migrations/${name}`, import.meta.url)),
    "utf8",
  );
}

const tableMigration = readMigration("20260924150000_quiz_questions.sql")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("quiz_questions table migration", () => {
  it("creates the table with integrity constraints", () => {
    expect(tableMigration).toContain("create table if not exists public.quiz_questions");
    expect(tableMigration).toContain("unique (quiz_key, question_key)");
    expect(tableMigration).toContain("quiz_questions_options_is_array");
    expect(tableMigration).toContain("quiz_questions_correct_index_in_range");
  });

  it("enables RLS and denies anonymous access", () => {
    expect(tableMigration).toContain(
      "alter table public.quiz_questions enable row level security",
    );
    expect(tableMigration).toContain(
      "revoke all privileges on table public.quiz_questions from anon",
    );
  });

  it("lets signed-in users read active questions but never write", () => {
    expect(tableMigration).toContain(
      "grant select on table public.quiz_questions to authenticated",
    );
    expect(tableMigration).toContain(
      "revoke insert, update, delete, truncate, references, trigger on table public.quiz_questions from authenticated",
    );
    expect(tableMigration).toContain("for select to authenticated using (is_active)");
    expect(tableMigration).not.toMatch(
      /create policy .* for (insert|update|delete|all) /,
    );
  });
});

type SeedRow = {
  key: string;
  question: string;
  options: string[];
  correctIndex: number;
  order: number;
};

function parseSeed(file: string, quizKey: string): { sql: string; rows: SeedRow[] } {
  const sql = readMigration(file);
  const rowPattern = new RegExp(
    `^\\s*\\('${quizKey}', '((?:[^']|'')+)', '((?:[^']|'')+)', '(\\[.*\\])'::jsonb, (\\d+), (\\d+)\\),?$`,
    "gm",
  );
  const rows = [...sql.matchAll(rowPattern)].map(
    ([, key, question, options, correctIndex, order]) => ({
      key,
      question: question.replaceAll("''", "'"),
      options: JSON.parse(options.replaceAll("''", "'")) as string[],
      correctIndex: Number(correctIndex),
      order: Number(order),
    }),
  );
  return { sql, rows };
}

const QUESTIONS_PER_ATTEMPT = 12;

const SEEDS = [
  {
    name: "Bohr Models",
    file: "20260924150100_seed_bohr_quiz_questions.sql",
    quizKey: "bohr_models",
    expectedCount: 36,
    knownAnswers: [
      ["bohr-beryllium-shells", "2, 2"],
      ["bohr-identify-silicon", "Silicon"],
      ["bohr-calcium-shells", "2, 8, 8, 2"],
      ["bohr-which-fills-first", "The shell closest to the nucleus"],
    ],
  },
  {
    name: "Lewis Structures & Bonding",
    file: "20260924150200_seed_lewis_quiz_questions.sql",
    quizKey: "lewis_bonding",
    expectedCount: 38,
    knownAnswers: [
      ["lewis-valence-nitrogen", "5"],
      ["lewis-n2-bond", "Triple bond"],
      ["lewis-water-lone-pairs", "2"],
      ["lewis-formula-caf2", "CaF₂"],
      ["lewis-formula-al2o3", "Al₂O₃"],
    ],
  },
] as const;

describe.each(SEEDS)("$name quiz seed migration", (seed) => {
  const { sql, rows } = parseSeed(seed.file, seed.quizKey);

  it(`moves all ${seed.expectedCount} questions from the old config file`, () => {
    expect(rows).toHaveLength(seed.expectedCount);
  });

  it("keeps every question well formed and in the original order", () => {
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.map((row) => row.order)).toEqual(rows.map((_, index) => index + 1));
    for (const row of rows) {
      expect(row.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(row.options).size).toBe(row.options.length);
      expect(row.correctIndex).toBeGreaterThanOrEqual(0);
      expect(row.correctIndex).toBeLessThan(row.options.length);
    }
  });

  it("has more questions than one attempt draws", () => {
    expect(rows.length).toBeGreaterThan(QUESTIONS_PER_ATTEMPT);
  });

  it("preserves the correct answers of known questions", () => {
    const byKey = new Map(rows.map((row) => [row.key, row]));
    for (const [key, expected] of seed.knownAnswers) {
      const row = byKey.get(key);
      expect(row?.options[row.correctIndex]).toBe(expected);
    }
  });

  it("only touches its own quiz and is safe to re-run", () => {
    const keys = [...sql.matchAll(/^\s*\('([a-z0-9_]+)', /gm)].map((match) => match[1]);
    expect(new Set(keys)).toEqual(new Set([seed.quizKey]));
    expect(sql).toContain("on conflict (quiz_key, question_key) do nothing");
  });
});
