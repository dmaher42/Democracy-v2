import type { sheets_v4 } from 'googleapis';
import type { Submission } from './schema';
import { safeString, withExponentialBackoff } from './utils';

export async function appendSubmissionRow(
  sheets: sheets_v4.Sheets,
  sheetId: string,
  submission: Submission,
  timestampIso: string,
  docUrl?: string | null,
): Promise<void> {
  const row = [
    timestampIso,
    submission.studentName,
    submission.assignmentId,
    safeString(submission.content),
    safeString(submission.score),
    docUrl ?? '',
  ];

  await withExponentialBackoff(async () => {
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
