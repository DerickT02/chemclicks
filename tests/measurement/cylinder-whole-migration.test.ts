import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getMeasurementQuizMode, type MeasurementQuizModeKey } from "@/lib/measurement/modes";
import { MODE_QUESTION_POOL } from "@/lib/measurement/quiz";

function readMigration(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)),
    "utf8",
  )
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const enumMigration = readMigration("20261025000000_cylinder_whole_activity_type.sql");
const quizMigration = readMigration("20261025000100_cylinder_whole_quiz.sql");

function functionBody(name: string): string {
  const start = quizMigration.indexOf(`create or replace function public.${name}(`);
  if (start < 0) return "";
  return quizMigration.slice(start, quizMigration.indexOf("$$;", start));
}

const MEASUREMENT_FUNCTIONS = [
  "student_measurement_quiz_start",
  "student_measurement_quiz_record_answer",
  "student_measurement_quiz_complete",
];

describe("cylinder whole activity type migration", () => {
  it("adds the activity type outside a transaction", () => {
    expect(enumMigration).toContain(
      "alter type public.activity_type add value if not exists 'measurement_graduated_cylinder_whole'",
    );
    expect(enumMigration).not.toContain("begin;");
  });
});

describe("cylinder whole quiz migration", () => {
  it("adds the whole-milliliter activity and renames the existing one to tenths", () => {
    expect(quizMigration).toContain("'graduated cylinder — whole milliliters'");
    expect(quizMigration).toContain("set title = 'graduated cylinder — tenths'");
  });

  it("allows cylinder_whole in every constraint that lists the modes", () => {
    expect(quizMigration.match(
      /mode in \('ruler_tenths', 'ruler_hundredths', 'cylinder_whole', 'cylinder_tenths'\)/g,
    )).toHaveLength(2);
    expect(quizMigration).toContain("when 'measurement_cylinder_whole' then 'whole'");
    expect(quizMigration).toContain("case when mode like 'cylinder_%' then 50 else 10 end");
  });

  it("seeds the same readings the client pool uses", () => {
    for (const reading of MODE_QUESTION_POOL.cylinder_whole) {
      expect(quizMigration).toMatch(new RegExp(`\\('cylinder_whole', 'cylinder_whole_\\d+', ${reading}\\)`));
    }
  });

  it.each(MEASUREMENT_FUNCTIONS)("maps every mode to its own activity type in %s", (name) => {
    const body = functionBody(name);
    expect(body).toContain("when 'cylinder_whole' then 'measurement_graduated_cylinder_whole'");
    expect(body).toContain("when 'cylinder_tenths' then 'measurement_graduated_cylinder'");
    expect(body).not.toContain("else 'measurement_graduated_cylinder'");
    expect(body).toContain("and ca.archived_at is null");
  });

  it("starts a quiz only for a known mode", () => {
    expect(functionBody("student_measurement_quiz_start")).toContain(
      "p_mode not in ( 'ruler_tenths', 'ruler_hundredths', 'cylinder_whole', 'cylinder_tenths' )",
    );
  });

  it.each<MeasurementQuizModeKey>(["ruler_tenths", "ruler_hundredths", "cylinder_whole", "cylinder_tenths"])(
    "grades %s on the server at the client's tolerance",
    (mode) => {
      const { tolerance } = getMeasurementQuizMode(mode).spec;
      expect(functionBody("student_measurement_quiz_record_answer"))
        .toContain(`when '${mode}' then ${tolerance}`);
    },
  );

  it("grades cylinder_whole answers as whole numbers up to 50 mL", () => {
    const body = functionBody("student_measurement_quiz_record_answer");
    expect(body).toContain("when 'cylinder_whole' then 0");
    expect(body).toContain("when 'cylinder_whole' then 1");
    expect(body).toContain("when v_mode like 'cylinder_%' then 50");
    expect(body).toContain("if v_existing_answer is null and v_gradable then");
  });

  it("saves cylinder_whole attempts with the whole precision", () => {
    const body = functionBody("student_measurement_quiz_complete");
    expect(body).toContain("when 'cylinder_whole' then 'whole'");
    expect(body.indexOf("if v_session.status = 'completed' then"))
      .toBeLessThan(body.indexOf("ca.archived_at is null"));
  });

  it("lets students open the whole-milliliter exploration", () => {
    expect(functionBody("student_attempt_transition")).toContain("'measurement_graduated_cylinder_whole'");
  });
});
