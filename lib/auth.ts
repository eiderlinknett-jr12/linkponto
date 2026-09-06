import { cookies } from "next/headers";
import crypto from "node:crypto";

export const SESSION_COOKIE="linkponto_session";
export type SessionUser={id:number;name:string;username:string;role:"admin"|"manager"|"employee";employeeId?:number|null};
function secret(){return process.env.AUTH_SECRET||"change-this-secret"}
function signature(payload:string){return crypto.createHmac("sha256",secret()).update(payload).digest("base64url")}
export function sessionToken(user:SessionUser){const payload=Buffer.from(JSON.stringify(user)).toString("base64url");return `${payload}.${signature(payload)}`}
export function verifySession(token?:string|null):SessionUser|null{try{if(!token)return null;const[payload,sig]=token.split(".");if(!payload||!sig)return null;const expected=signature(payload);if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;return JSON.parse(Buffer.from(payload,"base64url").toString("utf8"))}catch{return null}}
export async function getSessionUser(){return verifySession((await cookies()).get(SESSION_COOKIE)?.value)}
export async function requireAuthenticatedApi(){const user=await getSessionUser();return user?null:Response.json({error:"Sessão expirada. Entre novamente."},{status:401})}
export async function requireRoleApi(roles:SessionUser["role"][]){const user=await getSessionUser();if(!user)return Response.json({error:"Sessão expirada. Entre novamente."},{status:401});return roles.includes(user.role)?null:Response.json({error:"Seu usuário não possui permissão para esta operação."},{status:403})}
