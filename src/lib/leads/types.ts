export type Answer = { question: string; answer: string };

export type Lead = {
  id: string;
  /** 1-based row in the source sheet, for "open in sheet" links */
  row: number;
  createdAt: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  /** Phone exactly as it appears in the sheet, shown when normalisation fails */
  rawPhone: string;
  answers: Answer[];
  /** Free-text notes already typed into the sheet, oldest column first */
  sheetNotes: string[];
};

export const ACTIVITY_TYPES = ['comment', 'call', 'email', 'status', 'voice'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const STATUSES = [
  'new',
  'in_progress',
  'no_answer',
  'call_back',
  'interested',
  'booked',
  'lost',
] as const;
export type LeadStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Не е търсен',
  in_progress: 'В процес',
  no_answer: 'Не вдига',
  call_back: 'Да звъннем пак',
  interested: 'Има интерес',
  booked: 'Записан',
  lost: 'Отказал',
};

export type Activity = {
  id: string;
  leadId: string;
  at: string;
  author: string;
  type: ActivityType;
  text: string;
  /** Only set for type "status" (and optionally "call", as the call outcome) */
  status?: LeadStatus;
  /** Only set for type "voice" */
  audio?: AudioRef;
};

/** Author of notes the app writes itself, e.g. when a notification could not be sent. */
export const SYSTEM_AUTHOR = 'Система';

export type AudioRef = { id: string; durationSec: number; mime: string };
