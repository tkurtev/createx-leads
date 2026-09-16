import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api';
import { getEnv } from '@/lib/env';
import { parseLeads } from '@/lib/leads/parse';
import { attachActivity } from '@/lib/leads/status';
import { getAudioStore, getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const env = getEnv();
    const store = getStore();
    const [rows, activity] = await Promise.all([store.readLeadRows(), store.readActivity()]);
    return NextResponse.json({
      leads: attachActivity(parseLeads(rows), activity),
      emailEnabled: env.EMAIL_TRANSPORT !== 'off',
      emailTestMode: env.EMAIL_TRANSPORT === 'log',
      demo: env.DATA_SOURCE !== 'sheets',
      voiceEnabled: getAudioStore() !== null,
      sheetUrl: env.SPREADSHEET_ID ? `https://docs.google.com/spreadsheets/d/${env.SPREADSHEET_ID}/edit` : null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
