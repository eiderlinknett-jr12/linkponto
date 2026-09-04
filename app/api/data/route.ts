import { serverEnv as env } from "@/lib/server-env";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied=await requireAdminApi(); if(denied)return denied;
  try {
    const employees = await env.DB.prepare(
      `SELECT id,name,cpf,code,role,department,workdays,start_time AS startTime,
      break_start AS breakStart,break_end AS breakEnd,end_time AS endTime,
      weekly_minutes AS weeklyMinutes,status,created_at AS createdAt
      FROM employees ORDER BY name`
    ).all();
    const punches = await env.DB.prepare(
      `SELECT p.id,p.employee_id AS employeeId,e.name,p.kind,p.occurred_at AS occurredAt,
      p.local_date AS localDate,p.source FROM punches p JOIN employees e ON e.id=p.employee_id
      ORDER BY p.occurred_at DESC LIMIT 5000`
    ).all();
    const adjustments = await env.DB.prepare(
      `SELECT a.id,a.employee_id AS employeeId,e.name,a.punch_date AS punchDate,
      a.requested_time AS requestedTime,a.reason,a.status,a.created_at AS createdAt
      FROM adjustments a JOIN employees e ON e.id=a.employee_id ORDER BY a.created_at DESC`
    ).all();
    const company = await env.DB.prepare(
      `SELECT id,legal_name AS legalName,trade_name AS tradeName,document,address,city,state,phone,email,
      timezone,tolerance_minutes AS toleranceMinutes,latitude,longitude,
      allowed_radius_meters AS allowedRadiusMeters,require_location AS requireLocation,
      logo_key AS logoKey,updated_at AS updatedAt
      FROM company_settings WHERE id=1`
    ).first();
    return Response.json({ employees: employees.results, punches: punches.results, adjustments: adjustments.results, company });
  } catch (error) {
    console.error("data_error", error);
    return Response.json({ error: "Não foi possível carregar os dados." }, { status: 500 });
  }
}
