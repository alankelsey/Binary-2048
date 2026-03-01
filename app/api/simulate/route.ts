import { NextResponse } from "next/server";
import { simulateBatch, type SimulateBatchRequest } from "@/lib/binary2048/simulate";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SimulateBatchRequest;
    const result = simulateBatch(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid simulation request" },
      { status: 400 }
    );
  }
}
