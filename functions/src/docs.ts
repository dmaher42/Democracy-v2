import type { docs_v1, drive_v3 } from 'googleapis';
import type { Submission } from './schema';
import { safeString, withExponentialBackoff } from './utils';

export interface DocTemplateData {
  submission: Submission;
  timestampIso: string;
}

export async function createDocFromTemplate(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  data: DocTemplateData,
): Promise<string | null> {
  const templateId = process.env.DOCS_TEMPLATE_ID;
  const folderId = process.env.DOCS_FOLDER_ID;

  if (!templateId || !folderId) {
    return null;
  }

  const fileName = `Submission - ${safeString(data.submission.studentName) || 'Unknown'} - ${
    safeString(data.submission.assignmentId) || 'Unknown'
  }`;

  const copyResponse = await withExponentialBackoff(() =>
    drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      fields: 'id, webViewLink',
    }),
  );

  const documentId = copyResponse.data.id;
  const docLink = copyResponse.data.webViewLink ?? null;

  if (!documentId) {
    return docLink;
  }

  const replacements: Array<{ placeholder: string; value: string }> = [
    { placeholder: '{{studentName}}', value: data.submission.studentName },
    { placeholder: '{{assignmentId}}', value: data.submission.assignmentId },
    { placeholder: '{{content}}', value: safeString(data.submission.content) },
    { placeholder: '{{score}}', value: safeString(data.submission.score) },
    { placeholder: '{{timestamp}}', value: data.timestampIso },
  ];

  await withExponentialBackoff(() =>
    docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: replacements.map((entry) => ({
          replaceAllText: {
            containsText: {
              text: entry.placeholder,
              matchCase: true,
            },
            replaceText: entry.value,
          },
        })),
      },
    }),
  );

  if (docLink) {
    return docLink;
  }

  const fileResponse = await withExponentialBackoff(() =>
    drive.files.get({ fileId: documentId, fields: 'webViewLink' }),
  );

  return fileResponse.data.webViewLink ?? null;
}
