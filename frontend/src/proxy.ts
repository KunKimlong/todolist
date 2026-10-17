import { NextResponse, type NextRequest } from "next/server";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const SESSION_COOKIE = "TODO_SESSION";

/**
 * "unknown" means the backend couldn't answer (asleep, starting up, down). That says
 * nothing about the session, so the cookie must not be treated as expired.
 */
type SessionState = "signed-in" | "signed-out" | "unknown";

/** Ask the backend whether the session cookie on this request is still valid */
async function sessionState(request: NextRequest): Promise<SessionState> {
  if (!request.cookies.has(SESSION_COOKIE)) return "signed-out";
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "signed-in";
    if (res.status === 401 || res.status === 403) return "signed-out";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const state = await sessionState(request);
  const signedIn = state === "signed-in";

  // Signed-out-only pages: if already signed in, there's nothing to do here
  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (pathname === "/forgot-password") {
    return signedIn ? NextResponse.redirect(new URL("/settings", request.url)) : NextResponse.next();
  }

  // Backend unreachable: let the page load with the cookie intact. Its API calls retry
  // while the backend wakes up and only a real 401 sends the user to the login page.
  if (state === "unknown") return NextResponse.next();

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
