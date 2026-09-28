export const GENERIC_RETRY_MESSAGE = "Something went wrong. Please try again.";
export const DATABASE_RETRY_MESSAGE =
  "We could not complete that request. Please try again.";
export const SESSION_RETRY_MESSAGE =
  "Your session could not be created. Please try again.";

export const CLASS_CODE_NOT_FOUND_MESSAGE =
  "That classroom code was not found or is inactive. Check the code and try again.";
export const CLASS_CODE_LOOKUP_MESSAGE =
  "We could not verify that classroom code. Check the code and try again.";

export const INVALID_CREDENTIALS_MESSAGE =
  "The email or password is incorrect. Check both and try again.";
export const INVALID_STUDENT_ID_MESSAGE =
  "That Student ID was not found in this classroom. Check the ID and try again.";

export function isDuplicateAuthError(error: {
  code?: string;
  message?: string;
} | null | undefined): boolean {
  const code = (error?.code ?? "").toLowerCase();
  const message = (error?.message ?? "").toLowerCase();

  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already exists")
  );
}
