import { NextResponse, type NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const SESSION_COOKIE = "TODO_SESSION";

/** Ask the backend whether the session cookie on this request is still valid */
async function isSignedIn(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await isSignedIn(request);

  // Signed-out-only pages: if already signed in, there's nothing to do here
  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (pathname === "/forgot-password") {
    return signedIn ? NextResponse.redirect(new URL("/settings", request.url)) : NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL("/login", request.url);
    // Had a session cookie but it's no longer valid: it timed out or was ended
    if (request.cookies.has(SESSION_COOKIE)) login.searchParams.set("expired", "1");
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    const response = NextResponse.redirect(login);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Only real app pages; unknown URLs fall through to the 404 page
  matcher: ["/", "/settings", "/login", "/forgot-password"],
};
