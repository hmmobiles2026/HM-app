import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicRoutes = ["/login"];
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

async function verifyAccessToken(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const validSession = await verifyAccessToken(req);
  const hasRefreshToken = req.cookies.has("refresh_token");

  // Block protected routes only when no tokens at all
  if (!isPublicRoute && !validSession && !hasRefreshToken) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Redirect away from login only when access token is confirmed valid
  if (isPublicRoute && validSession) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|.*\\.ico$).*)"],
};
