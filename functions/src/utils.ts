import type { Firestore } from 'firebase-admin/firestore';

const IDEMPOTENCY_EXISTS_ERROR = 'IDEMPOTENCY_ALREADY_PROCESSED';

/** Simple structured logger so logs are easy to search in Cloud Logging. */
export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({ severity: 'INFO', message, ...formatData(data) }));
  },
  warn(message: string, data?: Record<string, unknown>) {
    console.warn(JSON.stringify({ severity: 'WARNING', message, ...formatData(data) }));
  },
  error(message: string, data?: Record<string, unknown>) {
    console.error(JSON.stringify({ severity: 'ERROR', message, ...formatData(data) }));
  },
};

function formatData(data?: Record<string, unknown>) {
  return data ? { data } : {};
}

export function safeString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  try {
    return String(value).trim();
  } catch (err) {
    return '';
  }
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

export async function withIdempotency(
  firestore: Firestore,
  key: string | undefined,
  work: () => Promise<void>,
): Promise<void> {
  if (!key) {
    await work();
    return;
  }
  const markerRef = firestore.collection('submissionProcessing').doc(key);
  try {
    await firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(markerRef);
      if (snapshot.exists) {
        throw new Error(IDEMPOTENCY_EXISTS_ERROR);
      }
      tx.set(markerRef, {
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === IDEMPOTENCY_EXISTS_ERROR) {
      logger.info('Skipping duplicate submission event.', { key });
      return;
    }
    throw error;
  }

  try {
    await work();
    await markerRef.set(
      {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    await markerRef.delete().catch(() => undefined);
    throw error;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function toErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: safeString(error) };
}
