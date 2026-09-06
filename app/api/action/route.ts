import { serverEnv as env } from "@/lib/server-env";
import { getSessionUser, requireRoleApi } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

async function hashPin(pin: string) {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function distanceMeters(aLat:number,aLon:number,bLat:number,bLon:number) {
  const r=6371e3,rad=(n:number)=>n*Math.PI/180;
  const p1=rad(aLat),p2=rad(bLat),dp=rad(bLat-aLat),dl=rad(bLon-aLon);
  const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function scheduleFrom(body:Record<string,any>){const names=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],days=names.map((name,i)=>({day:i,name,enabled:body[`day${i}Enabled`]===true||body[`day${i}Enabled`]==="on",hasBreak:body[`day${i}HasBreak`]===true||body[`day${i}HasBreak`]==="on",start:body[`day${i}Start`]||"08:00",breakStart:body[`day${i}BreakStart`]||"",breakEnd:body[`day${i}BreakEnd`]||"",end:body[`day${i}End`]||"17:00"}));const minutes=days.reduce((sum,d)=>{if(!d.enabled)return sum;const m=(v:string)=>{const[h,n]=v.split(":").map(Number);return h*60+n};let total=Math.max(0,m(d.end)-m(d.start));if(d.hasBreak&&d.breakStart&&d.breakEnd)total-=Math.max(0,m(d.breakEnd)-m(d.breakStart));return sum+total},0);return{days,holiday:{enabled:body.holidayEnabled===true||body.holidayEnabled==="on",hasBreak:body.holidayHasBreak===true||body.holidayHasBreak==="on",start:body.holidayStart||"07:00",breakStart:body.holidayBreakStart||"",breakEnd:body.holidayBreakEnd||"",end:body.holidayEnd||"14:00"},weeklyMinutes:minutes,summary:days.filter(d=>d.enabled).map(d=>d.name).join(", ")||"Sem jornada"}}
function nationalHoliday(date:string){return["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25"].includes(date.slice(5))}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, any>;
    const now = new Date().toISOString();
    if(body.action!=="punch") { const denied=await requireRoleApi(["admin","manager"]); if(denied)return denied; }
    if(["save_company","create_user","update_user","toggle_user"].includes(body.action)){const denied=await requireRoleApi(["admin"]);if(denied)return denied}
    if(body.action==="create_user"){
      if(!body.name?.trim()||!body.username?.trim()||!body.password)return Response.json({error:"Preencha nome, usuário e senha."},{status:400});
      if(String(body.password).length<6)return Response.json({error:"A senha deve ter pelo menos 6 caracteres."},{status:400});
      if(!["admin","manager","employee"].includes(body.role))return Response.json({error:"Nível de acesso inválido."},{status:400});
      await env.DB.prepare("INSERT INTO users (name,username,password_hash,role,employee_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)").bind(body.name.trim(),body.username.trim(),hashPassword(String(body.password)),body.role,body.employeeId?Number(body.employeeId):null,now,now).run();return Response.json({ok:true,message:"Usuário cadastrado com sucesso."});
    }
    if(body.action==="update_user"){
      if(!body.id||!body.name?.trim()||!body.username?.trim())return Response.json({error:"Preencha os campos obrigatórios."},{status:400});const params:any[]=[body.name.trim(),body.username.trim(),body.role,body.employeeId?Number(body.employeeId):null,now];let sql="UPDATE users SET name=?,username=?,role=?,employee_id=?,updated_at=?";if(body.password){if(String(body.password).length<6)return Response.json({error:"A senha deve ter pelo menos 6 caracteres."},{status:400});sql+=",password_hash=?";params.push(hashPassword(String(body.password)))}sql+=" WHERE id=?";params.push(Number(body.id));await env.DB.prepare(sql).bind(...params).run();return Response.json({ok:true,message:"Usuário atualizado com sucesso."});
    }
    if(body.action==="toggle_user"){const current=await getSessionUser();if(Number(body.id)===current?.id)return Response.json({error:"Você não pode inativar seu próprio usuário."},{status:400});await env.DB.prepare("UPDATE users SET status=CASE WHEN status='active' THEN 'inactive' ELSE 'active' END,updated_at=? WHERE id=?").bind(now,Number(body.id)).run();return Response.json({ok:true,message:"Situação do usuário atualizada."});}
    if (body.action === "create_employee") {
      const required = ["name", "cpf", "role", "pin"];
      if (required.some(k => !String(body[k] ?? "").trim())) return Response.json({ error: "Preencha os campos obrigatórios." }, { status: 400 });
      if (!/^\d{4,6}$/.test(body.pin)) return Response.json({ error: "O PIN deve ter de 4 a 6 números." }, { status: 400 });
      const next = await env.DB.prepare("SELECT COALESCE(MAX(id),0)+1 AS n FROM employees").first<{n:number}>();
      const code = String(next?.n ?? 1).padStart(4, "0");
      const schedule=scheduleFrom(body),base=schedule.days.find(d=>d.enabled)||schedule.days[1];
      await env.DB.prepare(`INSERT INTO employees (name,cpf,code,pin_hash,role,department,workdays,start_time,break_start,break_end,end_time,weekly_minutes,schedule_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(body.name.trim(),body.cpf.trim(),code,await hashPin(body.pin),body.role.trim(),body.department?.trim()||"Geral",schedule.summary,base.start,base.breakStart,base.breakEnd,base.end,schedule.weeklyMinutes,JSON.stringify(schedule),"active",now).run();
      return Response.json({ ok: true, message: `Funcionário cadastrado. Matrícula ${code}.` });
    }
    if (body.action === "toggle_employee") {
      await env.DB.prepare("UPDATE employees SET status=CASE WHEN status='active' THEN 'inactive' ELSE 'active' END WHERE id=?").bind(Number(body.id)).run();
      return Response.json({ ok: true, message: "Situação atualizada." });
    }
    if (body.action === "update_employee") {
      const schedule=scheduleFrom(body),weekly=schedule.weeklyMinutes,base=schedule.days.find(d=>d.enabled)||schedule.days[1];
      if(!body.id||!body.name?.trim()||!body.role?.trim()||weekly<=0)return Response.json({error:"Preencha os campos obrigatórios."},{status:400});
      const params:any[]=[body.name.trim(),body.cpf.trim(),body.role.trim(),body.department?.trim()||"Geral",schedule.summary,base.start,base.breakStart,base.breakEnd,base.end,weekly,JSON.stringify(schedule)];
      let sql=`UPDATE employees SET name=?,cpf=?,role=?,department=?,workdays=?,start_time=?,break_start=?,break_end=?,end_time=?,weekly_minutes=?,schedule_json=?`;
      if(body.pin){if(!/^\d{4,6}$/.test(body.pin))return Response.json({error:"O PIN deve ter de 4 a 6 números."},{status:400});sql+=",pin_hash=?";params.push(await hashPin(body.pin))}
      sql+=" WHERE id=?";params.push(Number(body.id));await env.DB.prepare(sql).bind(...params).run();
      return Response.json({ok:true,message:"Cadastro e jornada atualizados."});
    }
    if (body.action === "punch") {
      const employee = await env.DB.prepare("SELECT id,name,pin_hash AS pinHash,status,schedule_json AS scheduleJson FROM employees WHERE code=?").bind(String(body.code || "").trim()).first<any>();
      if (!employee || employee.pinHash !== await hashPin(String(body.pin || ""))) return Response.json({ error: "Matrícula ou PIN inválido." }, { status: 401 });
      if (employee.status !== "active") return Response.json({ error: "Funcionário inativo. Procure o responsável." }, { status: 403 });
      const place=await env.DB.prepare("SELECT latitude,longitude,allowed_radius_meters AS radius,require_location AS required FROM company_settings WHERE id=1").first<any>();
      if(place?.required){
        if(body.latitude==null||body.longitude==null)return Response.json({error:"Não foi possível confirmar sua localização. Ative o GPS e tente novamente."},{status:400});
        if(place.latitude&&place.longitude){
          const distance=distanceMeters(Number(body.latitude),Number(body.longitude),Number(place.latitude),Number(place.longitude));
          if(distance>Number(place.radius||150))return Response.json({error:`Ponto fora do local autorizado (${Math.round(distance)} m de distância).`},{status:403});
        }
      }
      const day = localDate();
      const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM punches WHERE employee_id=? AND local_date=?").bind(employee.id, day).first<{n:number}>();
      let hasBreak=true;try{if(employee.scheduleJson){const schedule=JSON.parse(employee.scheduleJson),today=nationalHoliday(day)&&schedule.holiday?.enabled?schedule.holiday:schedule.days?.[new Date(`${day}T12:00:00`).getDay()];hasBreak=today?.hasBreak??Boolean(today?.breakStart&&today?.breakEnd)}}catch{}
      const kinds = hasBreak?["Entrada", "Início do intervalo", "Retorno do intervalo", "Saída"]:["Entrada","Saída"];
      const kind = kinds[(count?.n ?? 0) % 4];
      await env.DB.prepare(
        "INSERT INTO punches (employee_id,kind,occurred_at,local_date,source,latitude,longitude,device,created_at) VALUES (?,?,?,?,?,?,?,?,?)"
      ).bind(employee.id, kind, now, day, body.source || "totem", body.latitude || null, body.longitude || null, String(request.headers.get("user-agent") || "").slice(0,240), now).run();
      return Response.json({ ok: true, message: `${kind} registrada com sucesso!`, employee: employee.name, occurredAt: now });
    }
    if (body.action === "create_adjustment") {
      if (!body.employeeId || !body.punchDate || !body.requestedTime || !body.reason?.trim()) return Response.json({ error: "Preencha todos os campos." }, { status: 400 });
      await env.DB.prepare("INSERT INTO adjustments (employee_id,punch_date,requested_time,reason,status,created_at) VALUES (?,?,?,?,?,?)")
        .bind(Number(body.employeeId), body.punchDate, body.requestedTime, body.reason.trim(), "pending", now).run();
      return Response.json({ ok: true, message: "Solicitação enviada para análise." });
    }
    if (body.action === "review_adjustment") {
      if (!["approved","rejected"].includes(body.status)) return Response.json({ error: "Situação inválida." }, { status: 400 });
      await env.DB.prepare("UPDATE adjustments SET status=? WHERE id=?").bind(body.status, Number(body.id)).run();
      return Response.json({ ok: true, message: "Solicitação analisada." });
    }
    if (body.action === "save_company") {
      const values = [body.legalName||"",body.tradeName||"",body.document||"",body.address||"",body.city||"",body.state||"",body.phone||"",body.email||"",body.timezone||"America/Fortaleza",Number(body.toleranceMinutes||0),body.latitude||null,body.longitude||null,Number(body.allowedRadiusMeters||150),body.requireLocation==="on"?1:0,now];
      await env.DB.prepare(`INSERT INTO company_settings
        (id,legal_name,trade_name,document,address,city,state,phone,email,timezone,tolerance_minutes,latitude,longitude,allowed_radius_meters,require_location,updated_at)
        VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET legal_name=excluded.legal_name,trade_name=excluded.trade_name,
        document=excluded.document,address=excluded.address,city=excluded.city,state=excluded.state,
        phone=excluded.phone,email=excluded.email,timezone=excluded.timezone,
        tolerance_minutes=excluded.tolerance_minutes,latitude=excluded.latitude,longitude=excluded.longitude,
        allowed_radius_meters=excluded.allowed_radius_meters,require_location=excluded.require_location,
        updated_at=excluded.updated_at`).bind(...values).run();
      return Response.json({ ok:true, message:"Configurações salvas com sucesso." });
    }
    return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (error: any) {
    console.error("action_error", error);
    const duplicate = String(error?.message || "").includes("UNIQUE");
    return Response.json({ error: duplicate ? "CPF já cadastrado." : "Não foi possível concluir a operação." }, { status: 500 });
  }
}
