import { NextResponse } from "next/server";

export function GET() {
  throw new Error("Sentry server test error — delete me");
  return NextResponse.json({ ok: true });
}
