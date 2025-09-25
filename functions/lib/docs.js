"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocFromTemplate = createDocFromTemplate;
const utils_1 = require("./utils");
async function createDocFromTemplate(drive, docs, data) {
    const templateId = process.env.DOCS_TEMPLATE_ID;
    const folderId = process.env.DOCS_FOLDER_ID;
    if (!templateId || !folderId) {
        return null;
    }
    const fileName = `Submission - ${(0, utils_1.safeString)(data.submission.studentName) || 'Unknown'} - ${(0, utils_1.safeString)(data.submission.assignmentId) || 'Unknown'}`;
    const copyResponse = await (0, utils_1.withExponentialBackoff)(() => drive.files.copy({
        fileId: templateId,
        requestBody: {
            name: fileName,
            parents: [folderId],
        },
        fields: 'id, webViewLink',
    }));
    const documentId = copyResponse.data.id;
    const docLink = copyResponse.data.webViewLink ?? null;
    if (!documentId) {
        return docLink;
    }
    const replacements = [
        { placeholder: '{{studentName}}', value: data.submission.studentName },
        { placeholder: '{{assignmentId}}', value: data.submission.assignmentId },
        { placeholder: '{{content}}', value: (0, utils_1.safeString)(data.submission.content) },
        { placeholder: '{{score}}', value: (0, utils_1.safeString)(data.submission.score) },
        { placeholder: '{{timestamp}}', value: data.timestampIso },
    ];
    await (0, utils_1.withExponentialBackoff)(() => docs.documents.batchUpdate({
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
    }));
    if (docLink) {
        return docLink;
    }
    const fileResponse = await (0, utils_1.withExponentialBackoff)(() => drive.files.get({ fileId: documentId, fields: 'webViewLink' }));
    return fileResponse.data.webViewLink ?? null;
}
