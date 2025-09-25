import { google, sheets_v4, docs_v1, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
];

let auth: GoogleAuth | null = null;
let sheetsClient: sheets_v4.Sheets | null = null;
let docsClient: docs_v1.Docs | null = null;
let driveClient: drive_v3.Drive | null = null;

async function getAuth(): Promise<GoogleAuth> {
  if (!auth) {
    auth = new GoogleAuth({ scopes: SCOPES });
  }
  return auth;
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!sheetsClient) {
    const authClient = await getAuth();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  }
  return sheetsClient;
}

export async function getDocsClient(): Promise<docs_v1.Docs> {
  if (!docsClient) {
    const authClient = await getAuth();
    docsClient = google.docs({ version: 'v1', auth: authClient });
  }
  return docsClient;
}

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (!driveClient) {
    const authClient = await getAuth();
    driveClient = google.drive({ version: 'v3', auth: authClient });
  }
  return driveClient;
}
