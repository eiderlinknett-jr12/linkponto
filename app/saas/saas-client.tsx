"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Plan = { id: number; name: string; price_cents: number; billing_days: number; grace_days: number; active: number };
type Tenant = { id: number; company_name: string; email: string; domain: string; status: string; paid_until?: string; plan_name?: string; last_error?: string };
type Job = { id: number; company_name: string; action: string; status: string; error?: string };
type Data = { plans: Plan[]; tenants: Tenant[]; jobs: Job[] };

export default function SaasClient() {
  const [data, setData] = useState<Data>({ plans: [], tenants: [], jobs: [] });
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/saas", { cache: "no-store" });
    const json = await response.json();
    if (response.ok) setData(json);
    else setMessage(json.error || "Falha ao carregar o painel.");
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function send(payload: Record<string, unknown>) {
    setMessage("Processando...");
    const response = await fetch("/api/saas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Não foi possível concluir.");
    if (json.credentials) setMessage(`Ambiente enfileirado. Acesso inicial: https://${json.credentials.domain} | usuário ${json.credentials.username} | senha ${json.credentials.password}`);
    else setMessage("Operação enfileirada com sucesso.");
    setData(json.data);
  }

  function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send({ action: "createPlan", name: form.get("name"), priceCents: Math.round(Number(form.get("price")) * 100), billingDays: form.get("days"), graceDays: form.get("grace"), employeeLimit: form.get("limit") });
    event.currentTarget.reset();
  }

  function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send({ action: "createTenant", companyName: form.get("company"), contactName: form.get("contact"), email: form.get("email"), phone: form.get("phone"), document: form.get("document"), slug: form.get("slug"), planId: form.get("planId") });
    event.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div><p className="text-emerald-400 font-semibold">LinkNett</p><h1 className="text-3xl font-bold">Painel SaaS LinkPonto</h1><p className="text-slate-400">Clientes, planos, pagamentos e ambientes isolados.</p></div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={logout} className="self-end rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-red-400 hover:bg-red-500/10 hover:text-red-300">Sair</button>
            <div className="grid grid-cols-3 gap-3 text-center"><Kpi label="Clientes" value={data.tenants.length}/><Kpi label="Ativos" value={data.tenants.filter(t=>t.status==="active").length}/><Kpi label="Planos" value={data.plans.length}/></div>
          </div>
        </header>
        {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm break-all">{message}</div>}
        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={createTenant} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h2 className="text-xl font-semibold">Novo cliente</h2>
            <div className="grid gap-3 sm:grid-cols-2"><Input name="company" label="Empresa" required/><Input name="document" label="CPF/CNPJ"/><Input name="contact" label="Responsável"/><Input name="email" label="E-mail" type="email" required/><Input name="phone" label="Telefone"/><Input name="slug" label="Subdomínio desejado"/></div>
            <label className="block text-sm text-slate-300">Plano<select name="planId" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{data.plans.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
            <button className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-400">Criar e provisionar</button>
          </form>
          <form onSubmit={createPlan} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h2 className="text-xl font-semibold">Novo plano</h2>
            <div className="grid gap-3 sm:grid-cols-2"><Input name="name" label="Nome" required/><Input name="price" label="Valor (R$)" type="number" step="0.01" required/><Input name="days" label="Ciclo em dias" type="number" defaultValue="30"/><Input name="grace" label="Carência em dias" type="number" defaultValue="3"/><Input name="limit" label="Limite de funcionários" type="number"/></div>
            <button className="w-full rounded-lg bg-blue-500 px-4 py-3 font-bold text-white hover:bg-blue-400">Salvar plano</button>
          </form>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="p-6"><h2 className="text-xl font-semibold">Clientes</h2></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-800/60 text-left text-slate-400"><tr><th className="p-4">Empresa</th><th className="p-4">Plano</th><th className="p-4">Status</th><th className="p-4">Pago até</th><th className="p-4">Ambiente</th><th className="p-4">Ações</th></tr></thead><tbody>{data.tenants.map(t=><tr key={t.id} className="border-t border-slate-800"><td className="p-4"><strong>{t.company_name}</strong><br/><span className="text-slate-500">{t.email}</span></td><td className="p-4">{t.plan_name||"—"}</td><td className="p-4"><Status value={t.status}/></td><td className="p-4">{t.paid_until||"—"}</td><td className="p-4"><a className="text-blue-400" href={`https://${t.domain}`} target="_blank">{t.domain}</a>{t.last_error&&<p className="text-red-400">{t.last_error}</p>}</td><td className="p-4"><div className="flex flex-wrap gap-2"><Action onClick={()=>send({action:"recordPayment",tenantId:t.id})}>Pagamento</Action>{t.status==="suspended"?<Action onClick={()=>send({action:"activate",tenantId:t.id})}>Reativar</Action>:<Action onClick={()=>send({action:"suspend",tenantId:t.id})}>Suspender</Action>}<Action onClick={()=>send({action:"provision",tenantId:t.id})}>Reprocessar</Action></div></td></tr>)}</tbody></table></div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-xl font-semibold mb-4">Fila de provisionamento</h2><div className="grid gap-2">{data.jobs.map(j=><div key={j.id} className="flex justify-between rounded-lg bg-slate-950 p-3"><span>#{j.id} · {j.company_name} · {j.action}</span><Status value={j.status}/></div>)}</div></section>
      </div>
    </main>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const {label,...rest}=props; return <label className="block text-sm text-slate-300">{label}<input {...rest} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 outline-none focus:border-emerald-500"/></label>; }
function Kpi({label,value}:{label:string;value:number}) { return <div className="min-w-20 rounded-xl bg-slate-900 px-4 py-3"><strong className="text-xl">{value}</strong><p className="text-xs text-slate-500">{label}</p></div>; }
function Status({value}:{value:string}) { const good=["active","done"].includes(value); const wait=["pending","queued","running"].includes(value); return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${good?"bg-emerald-500/15 text-emerald-400":wait?"bg-amber-500/15 text-amber-400":"bg-red-500/15 text-red-400"}`}>{value}</span>; }
function Action({children,onClick}:{children:React.ReactNode;onClick:()=>void}) { return <button onClick={onClick} className="rounded-md border border-slate-700 px-2.5 py-1.5 hover:bg-slate-800">{children}</button>; }
