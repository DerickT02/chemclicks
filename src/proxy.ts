import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_ROUTES = ["/admin"];

function isAdminRoute(pathname: string): boolean {
    return ADMIN_ROUTES.some((adminRoute) => pathname.startsWith(adminRoute));
}

/**
 * Session refresh for Supabase (formerly `middleware.ts` in Next.js).
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export default async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (!isAdminRoute(pathname)) {
    return response;
  }

  // Next pathname is an admin route

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/teacher";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Check if the logged-in user has an approved teacher record
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!teacher) {
    const url = request.nextUrl.clone();
    url.pathname = "/forbidden";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
