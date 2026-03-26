export type MarketingEventType =
  | "share_click"
  | "copy_share"
  | "copy_replay_link"
  | "landing_visit"
  | "session_resume_success"
  | "session_resume_miss"
  | "session_reset_after_resume"
  | "mobile_controls_toggle";

export type MarketingEvent = {
  id: string;
  type: MarketingEventType;
  channel?: "x" | "linkedin" | "copy" | "replay" | "resume" | "mobile";
  referralCode?: string;
  campaign?: string;
  metadata?: Record<string, string>;
  createdAtISO: string;
};

type TrackMarketingInput = {
  type: MarketingEventType;
  channel?: MarketingEvent["channel"];
  referralCode?: string;
  campaign?: string;
  metadata?: Record<string, string>;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_marketing_events?: MarketingEvent[];
};

const eventStore = globalStore.__binary2048_marketing_events ?? [];
globalStore.__binary2048_marketing_events = eventStore;

export function createReferralCode(seed = Date.now()): string {
  const core = Math.abs(Math.floor(seed)).toString(36).slice(-8).padStart(8, "0");
  return `b2k-${core}`;
}

export function trackMarketingEvent(input: TrackMarketingInput): MarketingEvent {
  const event: MarketingEvent = {
    id: `mkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    channel: input.channel,
    referralCode: input.referralCode,
    campaign: input.campaign,
    metadata: input.metadata,
    createdAtISO: new Date().toISOString()
  };
  eventStore.push(event);
  return event;
}

export function listMarketingEvents(limit = 50): MarketingEvent[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 50;
  const copy = [...eventStore];
  copy.sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
  return copy.slice(0, safeLimit);
}

export function resetMarketingEvents() {
  eventStore.length = 0;
}
