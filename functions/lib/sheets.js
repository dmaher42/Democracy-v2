"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendSubmissionRow = appendSubmissionRow;
const utils_1 = require("./utils");
async function appendSubmissionRow(sheets, sheetId, submission, timestampIso, docUrl) {
    const row = [
        timestampIso,
        submission.studentName,
        submission.assignmentId,
        (0, utils_1.safeString)(submission.content),
        (0, utils_1.safeString)(submission.score),
        docUrl ?? '',
    ];
    await (0, utils_1.withExponentialBackoff)(async () => {
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1!A1:F1',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                majorDimension: 'ROWS',
                values: [row],
            },
        });
    });
}
