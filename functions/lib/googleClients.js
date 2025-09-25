"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSheetsClient = getSheetsClient;
exports.getDocsClient = getDocsClient;
exports.getDriveClient = getDriveClient;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
];
let auth = null;
let sheetsClient = null;
let docsClient = null;
let driveClient = null;
async function getAuth() {
    if (!auth) {
        auth = new google_auth_library_1.GoogleAuth({ scopes: SCOPES });
    }
    return auth;
}
async function getSheetsClient() {
    if (!sheetsClient) {
        const authClient = await getAuth();
        sheetsClient = googleapis_1.google.sheets({ version: 'v4', auth: authClient });
    }
    return sheetsClient;
}
async function getDocsClient() {
    if (!docsClient) {
        const authClient = await getAuth();
        docsClient = googleapis_1.google.docs({ version: 'v1', auth: authClient });
    }
    return docsClient;
}
async function getDriveClient() {
    if (!driveClient) {
        const authClient = await getAuth();
        driveClient = googleapis_1.google.drive({ version: 'v3', auth: authClient });
    }
    return driveClient;
}
