/* Expected, user-facing failures from server actions.
 *
 * Next.js strips thrown Error messages from server actions in production
 * ("The specific message is omitted in production builds..."), so any reason
 * the USER must read has to cross the boundary as data. Pattern:
 *   - inside the action, throw UserFacingError("reason") at the failure site
 *   - at the action boundary, catch and `return { ok: false, error: msg }`
 *     via userErrorMessage(); rethrow everything else (real bugs stay loud).
 */
export class UserFacingError extends Error {}

export function userErrorMessage(err: unknown): string | null {
  return err instanceof UserFacingError ? err.message : null;
}
