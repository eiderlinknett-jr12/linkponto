import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export function proxy(request: NextRequest) {
  const path=request.nextUrl.pathname;
  if(path.startsWith("/login")||path.startsWith("/ponto")||path.startsWith("/api/auth")||path.startsWith("/_next")||path==="/favicon.svg")return NextResponse.next();
  if(path.startsWith("/api/"))return NextResponse.next();
  const expected=crypto.createHmac("sha256",process.env.AUTH_SECRET||"change-this-secret").update("linkponto-admin").digest("hex");
  if(request.cookies.get("linkponto_session")?.value===expected)return NextResponse.next();
  return NextResponse.redirect(new URL("/login",request.url));
}

export const config={matcher:["/((?!_next/static|_next/image).*)"]};
