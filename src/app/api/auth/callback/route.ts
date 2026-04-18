import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  } else if (type) {
    const tokenHash = searchParams.get("token_hash");
    if (tokenHash) {
      const supabase = createClient();
      await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    }
  }

  return NextResponse.redirect(new URL("/", request.url));
}
