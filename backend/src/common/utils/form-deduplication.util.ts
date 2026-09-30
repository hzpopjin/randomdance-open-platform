import { createHash } from 'crypto';

export function normalizeFormText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createFormFingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  const driverError =
    typeof candidate.driverError === 'object' && candidate.driverError !== null
      ? (candidate.driverError as Record<string, unknown>)
      : undefined;
  const code = candidate.code ?? driverError?.code;
  const errno = candidate.errno ?? driverError?.errno;
  return code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT' || errno === 1062;
}
