import crypto from "node:crypto";
export function hashPassword(password:string){const salt=crypto.randomBytes(16).toString("hex");const hash=crypto.scryptSync(password,salt,64).toString("hex");return `${salt}:${hash}`}
export function verifyPassword(password:string,stored:string){const[salt,hash]=stored.split(":");if(!salt||!hash)return false;const actual=crypto.scryptSync(password,salt,64),expected=Buffer.from(hash,"hex");return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)}
