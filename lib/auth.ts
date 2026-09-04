import { cookies } from "next/headers";
import crypto from "node:crypto";

export const SESSION_COOKIE = "linkponto_session";

function expectedToken() {
  const secret = process.env.AUTH_SECRET || "change-this-secret";
  return crypto.createHmac("sha256", secret).update("linkponto-admin").digest("hex");
}

export async function isAdmin() {
  return (await cookies()).get(SESSION_COOKIE)?.value === expectedToken();
}

export function sessionToken() { return expectedToken(); }

export async function requireAdminApi() {
  if (await isAdmin()) return null;
  return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
}
