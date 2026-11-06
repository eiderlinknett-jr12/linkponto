import { getSessionUser } from "@/lib/auth";
import {
  controlDb,
  enqueue,
  extendPaidUntil,
  randomPassword,
  requireControlPlane,
  slugify,
  snapshot,
} from "@/lib/control-db";

async function requireAdmin() {
  requireControlPlane();
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("Acesso administrativo necessário.");
}

export async function GET() {
  try {
    await requireAdmin();
    return Response.json(snapshot());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    const now = new Date().toISOString();

    if (action === "createPlan") {
      const name = String(body.name || "").trim();
      const code = slugify(String(body.code || name));
      if (!name || !code) throw new Error("Informe o nome do plano.");
      controlDb.prepare(`
        INSERT INTO plans (name,code,price_cents,billing_days,grace_days,employee_limit,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        name,
        code,
        Math.max(0, Number(body.priceCents || 0)),
        Math.max(1, Number(body.billingDays || 30)),
        Math.max(0, Number(body.graceDays || 0)),
        body.employeeLimit ? Number(body.employeeLimit) : null,
        now,
        now,
      );
    } else if (action === "createTenant") {
      const companyName = String(body.companyName || "").trim();
      const slug = slugify(String(body.slug || companyName));
      const email = String(body.email || "").trim().toLowerCase();
      if (!companyName || !slug || !email) throw new Error("Informe empresa, identificador e e-mail.");
      const password = randomPassword();
      const domain = `${slug}.${process.env.TENANT_BASE_DOMAIN || "linkponto.linknett.com.br"}`;
      const result = controlDb.prepare(`
        INSERT INTO tenants
        (company_name,document,contact_name,email,phone,slug,domain,plan_id,status,initial_admin_password,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        companyName,
        String(body.document || "").trim(),
        String(body.contactName || companyName).trim(),
        email,
        String(body.phone || "").trim(),
        slug,
        domain,
        Number(body.planId) || null,
        "pending",
        password,
        now,
        now,
      );
      enqueue(Number(result.lastInsertRowid), "provision");
      return Response.json({ ok: true, credentials: { domain, username: "admin", password }, data: snapshot() });
    } else if (["activate", "suspend", "remove", "provision"].includes(action)) {
      const tenantId = Number(body.tenantId);
      if (!tenantId) throw new Error("Cliente inválido.");
      enqueue(tenantId, action as "activate" | "suspend" | "remove" | "provision");
    } else if (action === "recordPayment") {
      const tenantId = Number(body.tenantId);
      const row = controlDb.prepare(`
        SELECT t.paid_until,p.billing_days FROM tenants t JOIN plans p ON p.id=t.plan_id WHERE t.id=?
      `).get(tenantId) as { paid_until: string | null; billing_days: number } | undefined;
      if (!row) throw new Error("Cliente ou plano não encontrado.");
      const paidUntil = extendPaidUntil(row.paid_until, row.billing_days);
      controlDb.prepare("UPDATE tenants SET paid_until=?,status='active',updated_at=? WHERE id=?")
        .run(paidUntil, now, tenantId);
      controlDb.prepare(`
        INSERT INTO payments (tenant_id,provider,external_id,status,amount_cents,occurred_at,created_at)
        VALUES (?,?,?,?,?,?,?)
      `).run(tenantId, "manual", `manual-${crypto.randomUUID()}`, "approved", Number(body.amountCents || 0), now, now);
      enqueue(tenantId, "activate");
    } else {
      throw new Error("Ação não reconhecida.");
    }

    return Response.json({ ok: true, data: snapshot() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
    const conflict = /UNIQUE constraint/i.test(message);
    return Response.json({ error: conflict ? "Já existe um cadastro com esse código, domínio ou produto." : message }, { status: conflict ? 409 : 400 });
  }
}
