import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { serverEnv as env } from "@/lib/server-env";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await request.json() as { user?: string; password?: string };
  const user=await env.DB.prepare("SELECT id,name,username,password_hash AS passwordHash,role,employee_id AS employeeId,status FROM users WHERE username=?").bind(String(body.user||"").trim()).first<any>();
  if(!user||user.status!=="active"||!verifyPassword(String(body.password||""),user.passwordHash)){
    return Response.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE,sessionToken({id:user.id,name:user.name,username:user.username,role:user.role,employeeId:user.employeeId}),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:60*60*12,path:"/"});
  return response;
}
