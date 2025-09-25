"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorSubmission = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const googleClients_1 = require("./googleClients");
const docs_1 = require("./docs");
const sheets_1 = require("./sheets");
const schema_1 = require("./schema");
const utils_1 = require("./utils");
admin.initializeApp();
const firestore = admin.firestore();
exports.mirrorSubmission = (0, firestore_1.onDocumentCreated)('submissions/{submissionId}', async (event) => {
    const sheetId = process.env.SHEET_ID;
    if (!sheetId) {
        utils_1.logger.error('Missing SHEET_ID secret. Unable to mirror submission.');
        return;
    }
    const snapshot = event.data;
    if (!snapshot) {
        utils_1.logger.warn('No Firestore snapshot received for submission create event.', {
            eventId: event.id,
        });
        return;
    }
    let submission;
    try {
        submission = (0, schema_1.parseSubmission)(snapshot.data());
    }
    catch (error) {
        utils_1.logger.error('Invalid submission payload.', {
            eventId: event.id,
            ...(0, utils_1.toErrorPayload)(error),
        });
        return;
    }
    const timestampIso = new Date().toISOString();
    const idempotencyKey = submission.dedupeKey ?? event.id ?? snapshot.id;
    try {
        await (0, utils_1.withIdempotency)(firestore, idempotencyKey, async () => {
            let docUrl = null;
            if (process.env.DOCS_TEMPLATE_ID && process.env.DOCS_FOLDER_ID) {
                try {
                    const [drive, docs] = await Promise.all([(0, googleClients_1.getDriveClient)(), (0, googleClients_1.getDocsClient)()]);
                    docUrl = await (0, docs_1.createDocFromTemplate)(drive, docs, {
                        submission,
                        timestampIso,
                    });
                }
                catch (error) {
                    utils_1.logger.error('Failed to generate Google Doc from template.', {
                        eventId: event.id,
                        ...(0, utils_1.toErrorPayload)(error),
                    });
                }
            }
            else {
                utils_1.logger.info('Docs integration disabled (missing template or folder secret).');
            }
            try {
                const sheets = await (0, googleClients_1.getSheetsClient)();
                await (0, sheets_1.appendSubmissionRow)(sheets, sheetId, submission, timestampIso, docUrl);
            }
            catch (error) {
                utils_1.logger.error('Failed to append submission to Google Sheet.', {
                    eventId: event.id,
                    ...(0, utils_1.toErrorPayload)(error),
                });
                throw error;
            }
            utils_1.logger.info('Submission mirrored successfully.', {
                eventId: event.id,
                submissionId: event.params?.submissionId,
                docUrl,
            });
        });
    }
    catch (error) {
        utils_1.logger.error('Submission processing failed. Function will retry.', {
            eventId: event.id,
            ...(0, utils_1.toErrorPayload)(error),
        });
        throw error;
    }
});
