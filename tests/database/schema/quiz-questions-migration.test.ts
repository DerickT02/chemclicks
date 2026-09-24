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
const seedMigration = readMigration("20260924150100_seed_bohr_quiz_questions.sql");

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

describe("Bohr quiz seed migration", () => {
  const rows = [
    ...seedMigration.matchAll(
      /^\s*\('bohr_models', '((?:[^']|'')+)', '((?:[^']|'')+)', '(\[.*\])'::jsonb, (\d+), (\d+)\),?$/gm,
    ),
  ].map(([, key, question, options, correctIndex, order]) => ({
    key,
    question: question.replaceAll("''", "'"),
    options: JSON.parse(options.replaceAll("''", "'")) as string[],
    correctIndex: Number(correctIndex),
    order: Number(order),
  }));

  it("moves all 36 questions from the old config file", () => {
    expect(rows).toHaveLength(36);
  });

  it("keeps every question well formed and in the original order", () => {
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.map((row) => row.order)).toEqual(rows.map((_, index) => index + 1));
    for (const row of rows) {
      expect(row.options.length).toBeGreaterThanOrEqual(2);
      expect(row.correctIndex).toBeGreaterThanOrEqual(0);
      expect(row.correctIndex).toBeLessThan(row.options.length);
    }
  });

  it("preserves the correct answers of known questions", () => {
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const answer = (key: string) => {
      const row = byKey.get(key);
      return row?.options[row.correctIndex];
    };

    expect(answer("bohr-beryllium-shells")).toBe("2, 2");
    expect(answer("bohr-identify-silicon")).toBe("Silicon");
    expect(answer("bohr-calcium-shells")).toBe("2, 8, 8, 2");
    expect(answer("bohr-which-fills-first")).toBe("The shell closest to the nucleus");
  });

  it("is safe to re-run", () => {
    expect(seedMigration).toContain("on conflict (quiz_key, question_key) do nothing");
  });
});
