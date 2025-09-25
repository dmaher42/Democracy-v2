/**
 * Setup checklist
 * 1. Store required secrets:
 *    firebase functions:secrets:set SHEET_ID
 *    firebase functions:secrets:set DOCS_TEMPLATE_ID
 *    firebase functions:secrets:set DOCS_FOLDER_ID
 * 2. In Google Cloud Console → IAM, find the Firebase service account email
 *    (something like <project-id>@appspot.gserviceaccount.com) and share the
 *    target Google Sheet + destination Drive folder with that address.
 * 3. Deploy: npm --prefix functions install && npm --prefix functions run build && firebase deploy --only functions
 * 4. Test: firebase firestore:documents:create submissions/myTest --data '{"studentName":"Jane","assignmentId":"math-1","content":"Hello","score":95}'
 *    Cleanup tip: firebase firestore:delete submissions/myTest
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { getDocsClient, getDriveClient, getSheetsClient } from './googleClients';
import { createDocFromTemplate } from './docs';
import { appendSubmissionRow } from './sheets';
import { parseSubmission } from './schema';
import { logger, toErrorPayload, withIdempotency } from './utils';

admin.initializeApp();

const firestore = admin.firestore();

export const mirrorSubmission = onDocumentCreated('submissions/{submissionId}', async (event) => {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) {
    logger.error('Missing SHEET_ID secret. Unable to mirror submission.');
    return;
  }

  const snapshot = event.data;
  if (!snapshot) {
    logger.warn('No Firestore snapshot received for submission create event.', {
      eventId: event.id,
    });
    return;
  }

  let submission;
  try {
    submission = parseSubmission(snapshot.data());
  } catch (error) {
    logger.error('Invalid submission payload.', {
      eventId: event.id,
      ...toErrorPayload(error),
    });
    return;
  }

  const timestampIso = new Date().toISOString();
  const idempotencyKey = submission.dedupeKey ?? event.id ?? snapshot.id;

  try {
    await withIdempotency(firestore, idempotencyKey, async () => {
      let docUrl: string | null = null;
      if (process.env.DOCS_TEMPLATE_ID && process.env.DOCS_FOLDER_ID) {
        try {
          const [drive, docs] = await Promise.all([getDriveClient(), getDocsClient()]);
          docUrl = await createDocFromTemplate(drive, docs, {
            submission,
            timestampIso,
          });
        } catch (error) {
          logger.error('Failed to generate Google Doc from template.', {
            eventId: event.id,
            ...toErrorPayload(error),
          });
        }
      } else {
        logger.info('Docs integration disabled (missing template or folder secret).');
      }

      try {
        const sheets = await getSheetsClient();
        await appendSubmissionRow(sheets, sheetId, submission, timestampIso, docUrl);
      } catch (error) {
        logger.error('Failed to append submission to Google Sheet.', {
          eventId: event.id,
          ...toErrorPayload(error),
        });
        throw error;
      }

      logger.info('Submission mirrored successfully.', {
        eventId: event.id,
        submissionId: event.params?.submissionId,
        docUrl,
      });
    });
  } catch (error) {
    logger.error('Submission processing failed. Function will retry.', {
      eventId: event.id,
      ...toErrorPayload(error),
    });
    throw error;
  }
});
