import type { CallFact, CallTurn } from '@/lib/leads/types';

/** The lead as a calling agent needs it: who to ring and what it should know. */
export type CallTarget = {
  leadId: string;
  name: string;
  /** E.164, always. */
  phone: string;
  email: string | null;
  interest: string;
  message: string;
  source: string;
};

export type PlacedCall = {
  provider: string;
  callId?: string;
  /**
   * Only the local test provider sets this: the call it pretends to have made,
   * so the rest of the flow can be exercised without a phone line.
   */
  simulated?: CallEnded;
};

export interface CallProvider {
  readonly name: string;
  /** Hands the lead over. Resolves once the call is accepted for dialling, not when it ends. */
  placeCall(target: CallTarget): Promise<PlacedCall>;
}

/** What a finished call tells us, before anyone makes sense of it. */
export type CallEnded = {
  provider: string;
  callId?: string;
  /** Null when the provider sent back no lead reference; the phone is then the only way to match. */
  leadId: string | null;
  leadName?: string;
  /** The number as it was dialled, for matching a call that lost its metadata. */
  phone?: string;
  /** True only when a person actually spoke. */
  reached: boolean;
  /** The provider's own wording, kept as is for debugging. */
  endedReason?: string;
  /** Plain Bulgarian for the reason above, when it is one we recognise. */
  endedExplanation?: string;
  durationSec?: number;
  recordingUrl?: string;
  transcript: CallTurn[];
  /** Set when the call was too long to keep in full. */
  transcriptTrimmed?: boolean;
  /** Whatever the provider itself concluded, when it was configured to. */
  providerSummary?: string;
  /** Fields the provider was configured to extract, as label and value. */
  providerFacts: CallFact[];
};

export type ParsedWebhook =
  | { kind: 'call-ended'; call: CallEnded }
  | { kind: 'ignored'; reason: string };
