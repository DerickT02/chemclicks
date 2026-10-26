import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COVALENT_COMPOUNDS } from "@/lib/chemistry/covalent-compounds";

function readMigration(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)),
    "utf8",
  );
}

const diagramSchema = readMigration("20261021000000_quiz_question_diagrams.sql")
  .replace(/\s+/g, " ")
  .toLowerCase();
const diagramSeed = readMigration("20261021010000_seed_lewis_covalent_diagram_quiz_questions.sql");

type DiagramSeedRow = {
  key: string;
  options: string[];
  correctIndex: number;
  order: number;
  diagramKey: string;
};

function parseDiagramSeed(): DiagramSeedRow[] {
  const rowPattern = /\(\s*'lewis_covalent',\s*'([^']+)',\s*'(?:[^']|'')*',\s*'(\[[\s\S]*?\])'::jsonb,\s*(\d+),\s*(\d+),\s*'([^']+)'\s*\)/g;

  return [...diagramSeed.matchAll(rowPattern)].map((match) => ({
    key: match[1],
    options: JSON.parse(match[2]) as string[],
    correctIndex: Number(match[3]),
    order: Number(match[4]),
    diagramKey: match[5],
  }));
}

describe("quiz question diagram schema migration", () => {
  it("adds an optional diagram key without changing legacy questions", () => {
    expect(diagramSchema).toContain(
      "alter table public.quiz_questions add column if not exists diagram_key text",
    );
    expect(diagramSchema).toContain(
      "check (diagram_key is null or diagram_key ~ '^[a-z0-9]+$')",
    );
  });
});

describe("covalent diagram quiz seed migration", () => {
  const rows = parseDiagramSeed();
  const compounds = new Map(COVALENT_COMPOUNDS.map((compound) => [compound.id, compound]));

  it("seeds the expected diagram question set", () => {
    expect(rows).toHaveLength(8);
  });

  it("uses unique keys, authored order, valid options, and one correct choice", () => {
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.map((row) => row.order)).toEqual([29, 30, 31, 32, 33, 34, 35, 36]);

    for (const row of rows) {
      expect(row.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(row.options).size).toBe(row.options.length);
      expect(row.correctIndex).toBeGreaterThanOrEqual(0);
      expect(row.correctIndex).toBeLessThan(row.options.length);
    }
  });

  it("references real compounds and includes single, double, and triple bonds", () => {
    const bondOrders = new Set(
      rows.map((row) => compounds.get(row.diagramKey)?.bondOrder),
    );

    expect(rows.every((row) => compounds.has(row.diagramKey))).toBe(true);
    expect(bondOrders).toEqual(new Set([1, 2, 3]));
  });

  it("only seeds the covalent quiz and is safe to re-run", () => {
    const quizKeys = [...diagramSeed.matchAll(/^\s*'([a-z0-9_]+)',\s*$/gm)].map(
      (match) => match[1],
    );

    expect(new Set(quizKeys)).toEqual(new Set(["lewis_covalent"]));
    expect(diagramSeed).toContain(
      "on conflict (quiz_key, question_key) do update",
    );
    expect(diagramSeed).toContain("is_active = true");
  });
});
