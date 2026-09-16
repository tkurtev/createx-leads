import path from 'node:path';
import { DriveAudioStore } from '@/lib/audio/drive-audio-store';
import { FileAudioStore } from '@/lib/audio/file-audio-store';
import { BlobActivityStore } from '@/lib/blob/blob-activity-store';
import { vercelBlobApi } from '@/lib/blob/blob-api';
import { BlobAudioStore } from '@/lib/blob/blob-audio-store';
import type { AudioStore } from '@/lib/audio/types';
import { getEnv } from '@/lib/env';
import { createGoogleAuth } from '@/lib/google/auth';
import { FileStore } from './file-store';
import { SheetsStore } from './sheets-store';
import type { LeadStore } from './types';

type Stores = { leads: LeadStore; audio: AudioStore | null };

let stores: Stores | null = null;

function build(): Stores {
  const env = getEnv();
  if (env.DATA_SOURCE === 'demo') {
    const fixture = new FileStore(path.resolve(env.LOCAL_LEADS_FILE), '/dev/null');
    return {
      leads: new BlobActivityStore(() => fixture.readLeadRows(), vercelBlobApi),
      audio: new BlobAudioStore(vercelBlobApi),
    };
  }
  if (env.DATA_SOURCE === 'file') {
    return {
      leads: new FileStore(path.resolve(env.LOCAL_LEADS_FILE), path.resolve(env.LOCAL_ACTIVITY_FILE)),
      audio: new FileAudioStore(path.resolve(env.LOCAL_AUDIO_DIR)),
    };
  }
  const clientEmail = env.GOOGLE_CLIENT_EMAIL!;
  const auth = createGoogleAuth(clientEmail, env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'));
  return {
    leads: new SheetsStore(auth, {
      spreadsheetId: env.SPREADSHEET_ID!,
      leadsTab: env.LEADS_TAB,
      activityTab: env.ACTIVITY_TAB,
      clientEmail,
    }),
    audio: env.VOICE_NOTES_FOLDER_ID
      ? new DriveAudioStore(auth, { folderId: env.VOICE_NOTES_FOLDER_ID, clientEmail })
      : null,
  };
}

export function getStore(): LeadStore {
  stores ??= build();
  return stores.leads;
}

/** Null when voice notes are not configured. */
export function getAudioStore(): AudioStore | null {
  stores ??= build();
  return stores.audio;
}
