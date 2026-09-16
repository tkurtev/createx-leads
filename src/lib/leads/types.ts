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

/** One side of the conversation, as it was spoken. `at` is seconds from the start of the call. */
export type CallTurn = { role: 'agent' | 'lead'; text: string; at?: number };

/**
 * Something the agent learned, as a label and a value. Deliberately free form:
 * the same field works for "Бюджет", "Брой служители" or "Кога му е удобно",
 * whatever the business on the other end of the form actually sells.
 */
export type CallFact = { label: string; value: string };

export const QUALIFICATIONS = ['hot', 'warm', 'cold', 'unqualified', 'unknown'] as const;
export type CallQualification = (typeof QUALIFICATIONS)[number];

/** How close the lead is to buying, in words a salesperson uses whatever the product is. */
export const QUALIFICATION_LABELS: Record<CallQualification, string> = {
  hot: 'Горещ',
  warm: 'Топъл',
  cold: 'Студен',
  unqualified: 'Неподходящ',
  unknown: 'Неясен',
};

export const QUALIFICATION_HINTS: Record<CallQualification, string> = {
  hot: 'Готов е да продължи сега — обадете се първо на него.',
  warm: 'Има интерес, но не веднага.',
  cold: 'Слаб интерес засега.',
  unqualified: 'Не отговаря на това, което предлагате.',
  unknown: 'Разговорът не стигна далеч, за да се прецени.',
};

export type CallState = 'queued' | 'ended' | 'failed';

/** Everything an AI phone call left behind. Only set on activities of type "call". */
export type CallDetails = {
  /** Which system placed the call: "vapi", "log" (local test) or "external". */
  provider: string;
  callId?: string;
  state: CallState;
  /** True only when a person actually talked with the agent. */
  reached?: boolean;
  /** The provider's own wording, e.g. "customer-did-not-answer". Kept for debugging. */
  endedReason?: string;
  durationSec?: number;
  recordingUrl?: string;
  summary?: string;
  qualification?: CallQualification;
  /** What someone from the team should do next, one line each. */
  nextSteps?: string[];
  /** When the lead asked to be called back, ISO. */
  callbackAt?: string;
  facts?: CallFact[];
  transcript?: CallTurn[];
  /** Set when the transcript was too long to store in full. */
  transcriptTrimmed?: boolean;
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
  /** Only set for type "call", when an AI agent made the call */
  call?: CallDetails;
};

/** Author of notes the app writes itself, e.g. when a notification could not be sent. */
export const SYSTEM_AUTHOR = 'Система';

export type AudioRef = { id: string; durationSec: number; mime: string };
