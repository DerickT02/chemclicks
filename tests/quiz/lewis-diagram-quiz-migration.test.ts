import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = new URL("../../supabase/migrations/", import.meta.url);
const filename = "20261108000000_lewis_diagram_quiz.sql";

const readRaw = (name: string): string => readFileSync(new URL(name, directory), "utf8");
const normalize = (sql: string): string => sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const raw = readRaw(filename);
const migration = normalize(raw);
const migrationNames = readdirSync(fileURLToPath(directory));

type SeedRow = {
  key: string;
  question: string;
  options: string[];
  correctIndex: number;
  order: number;
};

function parseSeed(sql: string, quizKey: string): SeedRow[] {
  const rowPattern = new RegExp(
    `\\(\\s*'${quizKey}',\\s*'([^']+)',\\s*'((?:[^']|'')*)',\\s*'(\\[[\\s\\S]*?\\])'::jsonb,\\s*(\\d+),\\s*(\\d+)`,
    "g",
  );
  return [...sql.matchAll(rowPattern)].map((match) => ({
    key: match[1],
    question: match[2].replace(/''/g, "'"),
    options: JSON.parse(match[3].replace(/''/g, "'")) as string[],
    correctIndex: Number(match[4]),
    order: Number(match[5]),
  }));
}

const rows = parseSeed(raw, "lewis_diagram");
const promptKey = (question: string): string => question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

describe("Lewis dot diagram quiz migration (SCRUM-234)", () => {
  it("has its own version that sorts after dev's SCRUM-233 completion migration", () => {
    expect(migrationNames.filter((name) => name.startsWith("20261108000000_"))).toEqual([filename]);
    for (const old of ["20261104010000_lewis_diagram_quiz.sql", "20261106000000_lewis_diagram_quiz.sql"]) expect(migrationNames).not.toContain(old);
    const latestOther = migrationNames.filter((name) => name.endsWith(".sql") && name !== filename).sort().at(-1);
    expect(latestOther).toBeDefined();
    expect(filename > (latestOther as string)).toBe(true);
    expect(migration).toMatch(/^begin;/);
    expect(migration).toMatch(/commit;$/);
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("seeds a reviewed pool of 21 well-formed questions", () => {
    expect(rows).toHaveLength(21);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.every((row) => row.key.startsWith("ldq-"))).toBe(true);
    expect(rows.map((row) => row.order)).toEqual(rows.map((_, index) => index + 1));
    for (const row of rows) {
      expect(row.options).toHaveLength(4);
      expect(new Set(row.options).size).toBe(4);
      expect(row.correctIndex).toBeGreaterThanOrEqual(0);
      expect(row.correctIndex).toBeLessThan(row.options.length);
    }
    expect(new Set(rows.map((row) => promptKey(row.question))).size).toBe(rows.length);
    expect(migration).toContain("on conflict (quiz_key, question_key) do nothing");
  });

  it("does not repeat any lewis_covalent question, including SCRUM-131's diagram questions", () => {
    const covalentPrompts = new Set<string>();
    const covalentKeys = new Set<string>();
    for (const name of migrationNames.filter((entry) => entry.endsWith(".sql") && entry !== filename)) {
      for (const row of parseSeed(readRaw(name), "lewis_covalent")) {
        covalentPrompts.add(promptKey(row.question));
        covalentKeys.add(row.key);
      }
    }
    expect(covalentPrompts.size).toBeGreaterThan(0);
    for (const row of rows) {
      expect(covalentPrompts.has(promptKey(row.question))).toBe(false);
      expect(covalentKeys.has(row.key)).toBe(false);
    }
    expect(parseSeed(raw, "lewis_covalent")).toEqual([]);
  });

  it("binds lewis_diagram to lewis_diagram assignments in all three quiz RPCs and fails loudly otherwise", () => {
    expect(migration).toContain(
      "p.proname in ('student_quiz_start', 'student_quiz_retry_start', 'student_quiz_submit')",
    );
    expect(migration).toContain(
      "'(p_quiz_key = ''lewis_ionic'' and a.type::text = ''lewis_structures_ionic'')', "
      + "'(p_quiz_key = ''lewis_ionic'' and a.type::text = ''lewis_structures_ionic'') "
      + "or (p_quiz_key = ''lewis_diagram'' and a.type::text = ''lewis_diagram'')'",
    );
    expect(migration).toContain("raise exception 'lewis_diagram quiz binding was not added to: %'");
  });

  it("grades lewis_diagram by its quiz in the shared progress state", () => {
    // The replace target must still exist in the latest definition from dev.
    const latestHelper = migrationNames
      .filter((name) => name.endsWith(".sql") && name < filename)
      .filter((name) => /create (or replace )?function public\.assignment_progress_state\(/.test(normalize(readRaw(name))))
      .sort()
      .at(-1);
    expect(latestHelper).toBeDefined();
    expect(readRaw(latestHelper as string)).toContain("WHEN 'lewis_structures_ionic' THEN ARRAY['lewis_ionic']");
    expect(migration).toContain("when ''lewis_diagram'' then array[''lewis_diagram'']");
    expect(migration).toContain("raise exception 'assignment_progress_state: lewis_structures_ionic mapping not found'");
    expect(migration).toContain("raise exception 'assignment_progress_state does not map lewis_diagram to its quiz'");
  });

  it("hides the new pool from browsers and keeps every pool hidden before it", () => {
    const excludedKeys = (sql: string): string[] =>
      sql.match(/quiz_key not in \(([^)]+)\)/)?.[1].match(/'[^']+'/g) ?? [];
    const excluded = excludedKeys(migration);
    expect(excluded).toEqual([
      "'bohr_models'", "'bohr_model_intro'", "'bohr_model_stability'",
      "'lewis_bonding'", "'lewis_covalent'", "'lewis_ionic'", "'lewis_diagram'",
    ]);

    const previousPolicy = migrationNames
      .filter((name) => name.endsWith(".sql") && name < filename)
      .filter((name) => normalize(readRaw(name)).includes('create policy "chemclicks_quiz_questions_select_active"'))
      .sort()
      .at(-1);
    expect(previousPolicy).toBeDefined();
    const previouslyHidden = excludedKeys(normalize(readRaw(previousPolicy as string)));
    expect(previouslyHidden.length).toBeGreaterThan(0);
    for (const key of previouslyHidden) expect(excluded).toContain(key);
  });
});
