import { JWT } from 'google-auth-library';

export type TokenSource = { getAccessToken(): Promise<{ token?: string | null }> };

/** One service account for both the sheet and the voice-note folder. */
export function createGoogleAuth(clientEmail: string, privateKey: string): JWT {
  return new JWT({
    email: clientEmail,
    key: privateKey,
    // drive.file: the app can only see files it uploaded itself, nothing else in Drive.
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
  });
}
