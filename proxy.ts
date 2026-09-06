import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export function proxy(request: NextRequest) {
  const path=request.nextUrl.pathname;
  if(path.startsWith("/login")||path.startsWith("/ponto")||path.startsWith("/api/auth")||path.startsWith("/_next")||path==="/favicon.svg")return NextResponse.next();
  if(path.startsWith("/api/"))return NextResponse.next();
  const token=request.cookies.get("linkponto_session")?.value;
  if(token){const[payload,sig]=token.split(".");if(payload&&sig){const expected=crypto.createHmac("sha256",process.env.AUTH_SECRET||"change-this-secret").update(payload).digest("base64url");if(sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return NextResponse.next()}}
  return NextResponse.redirect(new URL("/login",request.url));
}

export const config={matcher:["/((?!_next/static|_next/image).*)"]};
