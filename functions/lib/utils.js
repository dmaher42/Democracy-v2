"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.safeString = safeString;
exports.withExponentialBackoff = withExponentialBackoff;
exports.withIdempotency = withIdempotency;
exports.toErrorPayload = toErrorPayload;
const IDEMPOTENCY_EXISTS_ERROR = 'IDEMPOTENCY_ALREADY_PROCESSED';
/** Simple structured logger so logs are easy to search in Cloud Logging. */
exports.logger = {
    info(message, data) {
        console.log(JSON.stringify({ severity: 'INFO', message, ...formatData(data) }));
    },
    warn(message, data) {
        console.warn(JSON.stringify({ severity: 'WARNING', message, ...formatData(data) }));
    },
    error(message, data) {
        console.error(JSON.stringify({ severity: 'ERROR', message, ...formatData(data) }));
    },
};
function formatData(data) {
    return data ? { data } : {};
}
function safeString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value.trim();
    }
    try {
        return String(value).trim();
    }
    catch (err) {
        return '';
    }
}
async function withExponentialBackoff(fn, options) {
    const retries = options?.retries ?? 3;
    const baseDelayMs = options?.baseDelayMs ?? 500;
    let attempt = 0;
    for (;;) {
        try {
            return await fn();
        }
        catch (error) {
            attempt += 1;
            if (attempt > retries) {
                throw error;
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            await sleep(delay);
        }
    }
}
async function withIdempotency(firestore, key, work) {
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
    }
    catch (error) {
        if (error instanceof Error && error.message === IDEMPOTENCY_EXISTS_ERROR) {
            exports.logger.info('Skipping duplicate submission event.', { key });
            return;
        }
        throw error;
    }
    try {
        await work();
        await markerRef.set({
            status: 'COMPLETED',
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    }
    catch (error) {
        await markerRef.delete().catch(() => undefined);
        throw error;
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function toErrorPayload(error) {
    if (error instanceof Error) {
        return { message: error.message, stack: error.stack };
    }
    return { message: safeString(error) };
}
