import { NextResponse } from "next/server";
import { trackMarketingEvent, type MarketingEventType } from "@/lib/binary2048/marketing";

type TrackBody = {
  type?: MarketingEventType;
  channel?: "x" | "linkedin" | "copy" | "replay" | "resume" | "mobile" | "ux";
  referralCode?: string;
  campaign?: string;
  metadata?: Record<string, string>;
};

function isType(value: unknown): value is MarketingEventType {
  return (
    value === "share_click" ||
    value === "copy_share" ||
    value === "copy_replay_link" ||
    value === "landing_visit" ||
    value === "session_resume_success" ||
    value === "session_resume_miss" ||
    value === "session_reset_after_resume" ||
    value === "mobile_controls_toggle" ||
    value === "ux_accidental_tap" ||
    value === "ux_mobile_mis_tap" ||
    value === "ux_dead_click" ||
    value === "ux_rage_tap"
  );
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) as TrackBody);
    if (!isType(body.type)) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }
    const event = trackMarketingEvent({
      type: body.type,
      channel: body.channel,
      referralCode: body.referralCode,
      campaign: body.campaign,
      metadata: body.metadata
    });
    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid marketing payload" },
      { status: 400 }
    );
  }
}
