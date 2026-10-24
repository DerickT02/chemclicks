import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_ROUTES = ["/admin"];
const STUDENT_ROUTES = ["/student"];

function isAdminRoute(pathname: string): boolean {
    return ADMIN_ROUTES.some((adminRoute) => pathname.startsWith(adminRoute));
}

function isStudentRoute(pathname: string): boolean {
    return STUDENT_ROUTES.some((studentRoute) => pathname.startsWith(studentRoute));
}

// Student RLS is teacher-only, so student linking is read server-side.
function findStudent(userId: string) {
  return createAdminClient()
    .from("students")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
}

/**
 * Session refresh for Supabase (formerly `middleware.ts` in Next.js).
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export default async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (isStudentRoute(pathname)) {
    // Signed-out users and lookup failures fall through to the student layout,
    // which fails closed. Student linking takes precedence over a legacy
    // teacher profile, so only non-students are checked for a teacher record.
    if (!user) return response;
    const { data: student, error: studentError } = await findStudent(user.id);
    if (studentError || student) return response;

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (teacher) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (!isAdminRoute(pathname)) {
    return response;
  }

  // Next pathname is an admin route

  if (!user) {
    if (process.env.NODE_ENV === "development") {
      // Scaffold: teacher login does not set a session yet; allow /admin locally.
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login/teacher";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Students never reach /admin, even if a legacy signup trigger also created a
  // teacher profile for them.
  const { data: student, error: studentError } = await findStudent(user.id);

  if (studentError) {
    const url = request.nextUrl.clone();
    url.pathname = "/forbidden";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (student) {
    const url = request.nextUrl.clone();
    url.pathname = "/student";
    url.search = "";
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
