import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";

export async function GET() {
  const row=await env.DB.prepare("SELECT logo_key AS logoKey FROM company_settings WHERE id=1").first<{logoKey:string|null}>();
  if(!row?.logoKey)return new Response(null,{status:404});
  const object=await env.BUCKET.get(row.logoKey);
  if(!object)return new Response(null,{status:404});
  return new Response(object.body,{headers:{"content-type":object.httpMetadata?.contentType||"image/png","cache-control":"public, max-age=3600"}});
}

export async function POST(request:Request) {
  try{
    const form=await request.formData(),file=form.get("logo");
    if(!(file instanceof File))return Response.json({error:"Selecione uma imagem."},{status:400});
    if(file.size>2*1024*1024)return Response.json({error:"A logo deve ter no máximo 2 MB."},{status:400});
    if(!["image/png","image/jpeg","image/webp"].includes(file.type))return Response.json({error:"Envie uma imagem PNG, JPG ou WEBP."},{status:400});
    const key=`company/logo-${Date.now()}`;
    await env.BUCKET.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
    const now=new Date().toISOString();
    await env.DB.prepare(`INSERT INTO company_settings (id,updated_at,logo_key) VALUES (1,?,?)
      ON CONFLICT(id) DO UPDATE SET logo_key=excluded.logo_key,updated_at=excluded.updated_at`).bind(now,key).run();
    return Response.json({ok:true,message:"Logo atualizada."});
  }catch(error){console.error("logo_error",error);return Response.json({error:"Não foi possível salvar a logo."},{status:500})}
}
