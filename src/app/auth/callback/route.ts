import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * PKCE / email-confirm / OAuth redirect target. Exchanges `?code=` for a session cookie.
 * Configure the same URL in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to");

  const safePath =
    redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safePath}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
