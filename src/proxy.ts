import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { User } from "@supabase/supabase-js";

const ADMIN_ROUTES = ["/admin"];

function isAdminRoute(pathname: string): boolean {
    return ADMIN_ROUTES.some((adminRoute) => pathname.startsWith(adminRoute));
}

function getUserRole(user: User): string {
    // TODO: we do not yet have role set up in JWT. after we do, connect this up
    // OR, if we decide a DB call is fine here instead of JWT, implement
    return "user";
}

/**
 * Session refresh for Supabase (formerly `middleware.ts` in Next.js).
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

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

  const role = getUserRole(user);

  if (role !== "admin") { // TODO: or "teacher", see getUserRole()
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
