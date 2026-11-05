import { MODE_QUESTION_POOL, QUESTIONS_PER_ATTEMPT } from "@/lib/measurement/quiz";
import type { MeasurementQuizModeKey } from "@/lib/measurement/modes";

/**
 * In-memory stand-in for the three measurement quiz RPCs. It follows the SQL in
 * supabase/migrations/20261025201614_jira_232_assignment_timers.sql: one
 * in-progress session per mode that start resumes, first gradable answer only,
 * and a completion that returns the same result row when replayed. Grading uses
 * the SQL's rules rather than the client's evaluateAnswer, so the client is
 * tested against an independent copy of the server contract.
 */

export const START_RPC = "student_measurement_quiz_start";
export const RECORD_RPC = "student_measurement_quiz_record_answer";
export const COMPLETE_RPC = "student_measurement_quiz_complete";
export type RpcName = typeof START_RPC | typeof RECORD_RPC | typeof COMPLETE_RPC;

export type RpcResponse = { data: unknown; error: { code: string; message: string } | null };

/**
 * How the next call to an RPC misbehaves:
 * - error: the database rejects the call and nothing is saved.
 * - throw: the request itself fails (a network error) and nothing is saved.
 * - lose: the call is saved, but its response never reaches the client.
 */
export type Fault = "error" | "throw" | "lose";

export type Deferred = {
  /** Runs the held call and delivers its response. */
  release: () => void;
};

type SavedQuestion = {
  questionIndex: number;
  reading: number;
  firstAnswer: string | null;
  isCorrect: boolean | null;
};

export type FakeSession = {
  id: string;
  studentId: string;
  assignmentId: string;
  mode: MeasurementQuizModeKey;
  attemptNumber: number;
  status: "in_progress" | "completed";
  questions: SavedQuestion[];
  resultId: string | null;
  startedAt: string;
};

export type FakeResult = {
  id: string;
  progress_id: string;
  attempt_number: number;
  quiz_key: string;
  question_total: number;
  score: number;
  percentage: number;
  passed: boolean;
  submission_key: string;
  instrument: "ruler" | "cylinder";
  precision_mode: "whole" | "tenths" | "hundredths";
  status: "completed";
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
};

const GRADING: Record<MeasurementQuizModeKey, { decimals: number; tolerance: number; max: number }> = {
  ruler_tenths: { decimals: 1, tolerance: 0.2, max: 10 },
  ruler_hundredths: { decimals: 2, tolerance: 0.02, max: 10 },
  cylinder_whole: { decimals: 0, tolerance: 2, max: 50 },
  cylinder_tenths: { decimals: 1, tolerance: 0.2, max: 50 },
};

const ANSWER_PATTERN = /^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$/;

function databaseError(code: string, message: string): RpcResponse {
  return { data: null, error: { code, message } };
}

/** Grades like the SQL: null when the answer isn't gradable. */
function grade(mode: MeasurementQuizModeKey, answer: string, reading: number): boolean | null {
  const { decimals, tolerance, max } = GRADING[mode];
  if (answer.length > 64 || !ANSWER_PATTERN.test(answer)) return null;
  const value = Number(answer);
  if (value < 0 || value > max) return null;
  const scale = 10 ** decimals;
  return (answer.split(".")[1] ?? "").length === decimals
    && Math.abs(Math.round(value * scale) - Math.round(reading * scale)) <= Math.round(tolerance * scale);
}

export function createFakeMeasurementRpc(options: {
  studentId: string;
  classId: string;
  assignmentId: string;
  mode: MeasurementQuizModeKey;
}) {
  let nextId = 1;
  const uuid = () => `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, "0")}`;
  const progressId = uuid();
  const sessions: FakeSession[] = [];
  const results: FakeResult[] = [];
  const calls: { name: RpcName; params: Record<string, unknown> }[] = [];
  const faults = new Map<RpcName, Fault[]>();
  const deferrals = new Map<RpcName, ((run: () => void) => void)[]>();

  function readingsFor(attemptNumber: number): number[] {
    const pool = MODE_QUESTION_POOL[options.mode];
    const offset = ((attemptNumber - 1) * QUESTIONS_PER_ATTEMPT) % pool.length;
    return Array.from(
      { length: QUESTIONS_PER_ATTEMPT },
      (_, index) => pool[(offset + index) % pool.length],
    );
  }

  function isCaller(params: Record<string, unknown>): boolean {
    return params.p_student_id === options.studentId
      && params.p_class_id === options.classId
      && params.p_assignment_id === options.assignmentId;
  }

  function start(params: Record<string, unknown>): RpcResponse {
    if (!isCaller(params) || params.p_mode !== options.mode) {
      return databaseError("42501", "Measurement quiz assignment unavailable");
    }
    let session = sessions.find((s) => s.mode === options.mode && s.status === "in_progress");
    if (!session) {
      const attemptNumber = sessions.filter((s) => s.mode === options.mode).length + 1;
      session = {
        id: uuid(),
        studentId: options.studentId,
        assignmentId: options.assignmentId,
        mode: options.mode,
        attemptNumber,
        status: "in_progress",
        questions: readingsFor(attemptNumber).map((reading, questionIndex) => ({
          questionIndex, reading, firstAnswer: null, isCorrect: null,
        })),
        resultId: null,
        startedAt: new Date(Date.UTC(2026, 10, 4, 12, attemptNumber)).toISOString(),
      };
      sessions.push(session);
    }
    return {
      data: {
        attempt_id: session.id,
        attempt_number: session.attemptNumber,
        mode: session.mode,
        questions: session.questions.map((q) => ({
          question_index: q.questionIndex,
          reading: q.reading,
          first_answer: q.firstAnswer,
          is_correct: q.isCorrect,
        })),
      },
      error: null,
    };
  }

  function ownSession(params: Record<string, unknown>): FakeSession | undefined {
    if (!isCaller(params)) return undefined;
    return sessions.find((s) => s.id === params.p_attempt_id);
  }

  function record(params: Record<string, unknown>): RpcResponse {
    const session = ownSession(params);
    if (!session || session.status !== "in_progress") {
      return databaseError("42501", "Measurement attempt unavailable");
    }
    const question = session.questions.find((q) => q.questionIndex === params.p_question_index);
    if (!question) return databaseError("22023", "Measurement question unavailable");

    const answer = String(params.p_answer);
    const correct = grade(session.mode, answer, question.reading);
    let counted = false;
    if (question.firstAnswer === null && correct !== null) {
      question.firstAnswer = answer;
      question.isCorrect = correct;
      counted = true;
    }
    return {
      data: {
        mode: session.mode,
        reading: question.reading,
        counted,
        first_try_correct: question.isCorrect,
      },
      error: null,
    };
  }

  function complete(params: Record<string, unknown>): RpcResponse {
    const session = ownSession(params);
    if (!session) return databaseError("42501", "Measurement attempt unavailable");
    if (session.status === "completed") {
      return { data: results.filter((r) => r.id === session.resultId), error: null };
    }

    // Like the SQL, every question counts toward the total; unanswered ones score nothing.
    const total = session.questions.length;
    const score = session.questions.filter((q) => q.isCorrect === true).length;
    const percentage = Math.round((score * 10000) / total) / 100;
    const completedAt = new Date(Date.UTC(2026, 10, 4, 13, session.attemptNumber)).toISOString();
    const result: FakeResult = {
      id: uuid(),
      progress_id: progressId,
      attempt_number: session.attemptNumber,
      quiz_key: `measurement_${session.mode}`,
      question_total: total,
      score,
      percentage,
      passed: percentage >= 80,
      submission_key: session.id,
      instrument: session.mode.startsWith("ruler_") ? "ruler" : "cylinder",
      precision_mode: session.mode === "ruler_hundredths"
        ? "hundredths"
        : session.mode === "cylinder_whole" ? "whole" : "tenths",
      status: "completed",
      started_at: session.startedAt,
      completed_at: completedAt,
      created_at: completedAt,
      updated_at: completedAt,
    };
    results.push(result);
    session.status = "completed";
    session.resultId = result.id;
    return { data: [result], error: null };
  }

  const handlers: Record<RpcName, (params: Record<string, unknown>) => RpcResponse> = {
    [START_RPC]: start,
    [RECORD_RPC]: record,
    [COMPLETE_RPC]: complete,
  };

  function run(name: RpcName, params: Record<string, unknown>): Promise<RpcResponse> {
    const fault = faults.get(name)?.shift();
    if (fault === "throw") return Promise.reject(new TypeError("fetch failed"));
    if (fault === "error") return Promise.resolve(databaseError("57014", "canceling statement"));
    const response = handlers[name](params);
    if (fault === "lose") return Promise.resolve(databaseError("08006", "connection lost"));
    return Promise.resolve(response);
  }

  return {
    sessions,
    results,
    calls,
    callsTo(name: RpcName) {
      return calls.filter((call) => call.name === name);
    },
    /** Makes the next call to an RPC misbehave; queued faults apply in order. */
    failNext(name: RpcName, fault: Fault) {
      faults.set(name, [...(faults.get(name) ?? []), fault]);
    },
    /** Holds the next call to an RPC, unrun, until it is released. */
    deferNext(name: RpcName): Deferred {
      let held: (() => void) | null = null;
      let released = false;
      deferrals.set(name, [...(deferrals.get(name) ?? []), (go) => {
        if (released) go();
        else held = go;
      }]);
      return {
        release() {
          released = true;
          held?.();
        },
      };
    },
    rpc(name: string, params: Record<string, unknown>): Promise<RpcResponse> {
      if (name !== START_RPC && name !== RECORD_RPC && name !== COMPLETE_RPC) {
        return Promise.resolve(databaseError("42883", `Unknown RPC ${name}`));
      }
      calls.push({ name, params });
      const hold = deferrals.get(name)?.shift();
      if (!hold) return run(name, params);
      return new Promise((resolve, reject) => {
        hold(() => { run(name, params).then(resolve, reject); });
      });
    },
  };
}

export type FakeMeasurementRpc = ReturnType<typeof createFakeMeasurementRpc>;
