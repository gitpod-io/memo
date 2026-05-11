// Barrel re-exports — all existing `import { … } from "@/lib/sentry"` paths
// continue to work without changes.

export { lazyCaptureException } from "@/lib/capture";

export { isE2ETestSession, isE2ETestRequest } from "./e2e-detection";

export {
  isPostgrestError,
  isSchemaNotFoundError,
  isInsufficientPrivilegeError,
  isForeignKeyViolationError,
  isDuplicateKeyError,
  isStatementTimeoutError,
  isEmptyResultError,
  isPostgrestServerError,
} from "./postgrest-errors";

export {
  isTransientNetworkError,
  isTransientStorageError,
  isSupabaseAuthLockError,
} from "./network-errors";

export {
  isNextjsInternalNoise,
  isReactLexicalDomConflict,
  isTransientSupabaseNetworkEvent,
  isSupabaseAuthLockContention,
} from "./event-filters";

export { captureApiError, captureSupabaseError } from "./capture";
