"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  ClipboardEdit,
  FileText,
  Fingerprint,
  ImageUp,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Printer,
  RefreshCw,
  Settings,
  ShieldCheck,
  TimerReset,
  UserRound,
  UsersRound,
  X,
  AlertCircle,
} from "lucide-react";

type DaySchedule = {
  day: number;
  name: string;
  enabled: boolean;
  hasBreak?: boolean;
  start: string;
  breakStart: string;
  breakEnd: string;
  end: string;
};
type WorkSchedule = {
  days: DaySchedule[];
  monthlySundayOff?: string;
  holiday: {
    enabled: boolean;
    hasBreak?: boolean;
    start: string;
    breakStart: string;
    breakEnd: string;
    end: string;
  };
  weeklyMinutes: number;
  summary: string;
};
type Employee = {
  id: number;
  name: string;
  cpf: string;
  code: string;
  role: string;
  department: string;
  workdays: string;
  startTime: string;
  breakStart: string;
  breakEnd: string;
  endTime: string;
  weeklyMinutes: number;
  scheduleJson?: string | null;
  calculationStartDate?: string | null;
  createdAt?: string;
  status: string;
};
type Punch = {
  id: number;
  employeeId: number;
  name: string;
  kind: string;
  occurredAt: string;
  localDate: string;
  source: string;
};
type Adjustment = {
  id: number;
  employeeId: number;
  name: string;
  punchDate: string;
  requestedTime: string;
  reason: string;
  status: string;
  createdAt: string;
};
type Company = {
  legalName?: string;
  tradeName?: string;
  document?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  toleranceMinutes?: number;
  latitude?: string;
  longitude?: string;
  allowedRadiusMeters?: number;
  requireLocation?: boolean;
  logoKey?: string | null;
  updatedAt?: string;
};
type AccessUser = {
  id: number;
  name: string;
  username: string;
  role: "admin" | "manager" | "employee";
  employeeId?: number | null;
  status: string;
  createdAt: string;
};
type CurrentUser = {
  id: number;
  name: string;
  username: string;
  role: "admin" | "manager" | "employee";
};
type ManualDay = {
  id: number;
  employeeId: number;
  localDate: string;
  status: string;
  note: string;
  createdBy: string;
  updatedAt: string;
};
type Data = {
  employees: Employee[];
  punches: Punch[];
  adjustments: Adjustment[];
  company: Company | null;
  users: AccessUser[];
  manualDays: ManualDay[];
  currentUser: CurrentUser | null;
};
const nav = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["punch", "Bater ponto", Fingerprint],
  ["employees", "Funcionários", UsersRound],
  ["journeys", "Jornadas", CalendarDays],
  ["adjustments", "Correções de ponto", TimerReset],
  ["reports", "Relatórios", FileText],
  ["manual", "Lançamento manual", ClipboardEdit],
  ["users", "Usuários e acessos", ShieldCheck],
  ["settings", "Configurações", Settings],
] as const;
const kindColors: Record<string, string> = {
  Entrada: "bg-emerald-50 text-emerald-700",
  "Início do intervalo": "bg-amber-50 text-amber-700",
  "Retorno do intervalo": "bg-sky-50 text-sky-700",
  Saída: "bg-slate-100 text-slate-700",
};
const fmtTime = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(v));
const timeMinutes = (v: string) => {
  if (!v) return 0;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};
function scheduleInfo(emp: Employee, date: string) {
  let schedule: WorkSchedule | null = null;
  try {
    if (emp.scheduleJson) schedule = JSON.parse(emp.scheduleJson);
  } catch {}
  if (!schedule) {
    const days =
      emp.workdays.includes("Sáb") || emp.workdays.includes("6x1") ? 6 : 5;
    return {
      expected: Math.round(emp.weeklyMinutes / days),
      off: false,
      label: "Jornada",
    };
  }
  const dt = new Date(`${date}T12:00:00`),
    day = dt.getDay();
  const choice = schedule.monthlySundayOff || "none";
  const week = Math.ceil(dt.getDate() / 7);
  const lastSunday =
    new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate() - dt.getDate() <
    7;
  if (
    day === 0 &&
    (choice === String(week) || (choice === "last" && lastSunday))
  )
    return { expected: 0, off: true, label: "Folga de domingo" };
  const md = date.slice(5),
    national = [
      "01-01",
      "04-21",
      "05-01",
      "09-07",
      "10-12",
      "11-02",
      "11-15",
      "11-20",
      "12-25",
    ].includes(md);
  const d =
    national && schedule.holiday.enabled
      ? schedule.holiday
      : schedule.days[day];
  if (!d?.enabled)
    return {
      expected: 0,
      off: true,
      label: national ? "Feriado" : "Folga semanal",
    };
  const hasBreak = d.hasBreak ?? Boolean(d.breakStart && d.breakEnd);
  const expected = Math.max(
    0,
    timeMinutes(d.end) -
      timeMinutes(d.start) -
      (hasBreak && d.breakStart && d.breakEnd
        ? Math.max(0, timeMinutes(d.breakEnd) - timeMinutes(d.breakStart))
        : 0),
  );
  return {
    expected,
    off: false,
    label: national ? "Feriado trabalhado" : "Jornada",
  };
}

export default function Home() {
  const [active, setActive] = useState("dashboard"),
    [menu, setMenu] = useState(false),
    [data, setData] = useState<Data>({
      employees: [],
      punches: [],
      adjustments: [],
      company: null,
      users: [],
      manualDays: [],
      currentUser: null,
    }),
    [loading, setLoading] = useState(true),
    [modal, setModal] = useState<"employee" | "adjustment" | "user" | null>(
      null,
    ),
    [editEmployee, setEditEmployee] = useState<Employee | null>(null),
    [editUser, setEditUser] = useState<AccessUser | null>(null),
    [toast, setToast] = useState<{ type: "ok" | "error"; text: string } | null>(
      null,
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
  }).format(new Date());
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/data", { cache: "no-store" }),
        j = await r.json();
      if (!r.ok) throw 0;
      setData(j);
    } catch {
      setToast({ type: "error", text: "Não foi possível carregar os dados." });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (data.currentUser?.role === "employee") setActive("punch");
  }, [data.currentUser?.role]);
  async function action(payload: Record<string, unknown>) {
    const r = await fetch("/api/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      j = await r.json();
    if (!r.ok) {
      setToast({ type: "error", text: j.error });
      return false;
    }
    setToast({ type: "ok", text: j.message });
    await load();
    return j;
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  const todayPunches = data.punches.filter((p) => p.localDate === today),
    activeEmployees = data.employees.filter((e) => e.status === "active"),
    present = new Set(todayPunches.map((p) => p.employeeId)).size,
    pending = data.adjustments.filter((a) => a.status === "pending").length,
    title = nav.find((n) => n[0] === active)?.[1];
  const visibleNav = nav
    .filter(
      ([id]) =>
        data.currentUser?.role === "admin" ||
        !(["users", "settings"] as string[]).includes(id),
    )
    .filter(([id]) => data.currentUser?.role !== "employee" || id === "punch");
  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#09271d] text-white transition-transform lg:static lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <button
            onClick={() => setActive("dashboard")}
            className="flex items-center gap-3 text-left"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-[#18bb82]">
              <Clock3 size={23} />
            </div>
            <div>
              <div className="text-xl font-extrabold">
                Link<span className="text-[#24d495]">Ponto</span>
              </div>
              <div className="text-[11px] uppercase tracking-[.18em] text-white/45">
                by LinkNett
              </div>
            </div>
          </button>
          <button className="lg:hidden" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <nav className="space-y-1 p-4 pt-6">
          {visibleNav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setActive(id);
                setMenu(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition ${active === id ? "bg-[#18aa78]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon size={20} />
              {label}
              {id === "adjustments" && pending > 0 && (
                <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full space-y-2 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {data.currentUser?.name || "Usuário"}
                </p>
                <p className="text-xs text-white/45">
                  {data.currentUser?.role === "admin"
                    ? "Administrador"
                    : data.currentUser?.role === "manager"
                      ? "Gestor / RH"
                      : "Funcionário"}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} />
            Sair do sistema
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenu(true)}
              className="rounded-lg p-2 lg:hidden"
            >
              <Menu />
            </button>
            <div>
              <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
              <p className="hidden text-sm capitalize text-slate-500 sm:block">
                {new Intl.DateTimeFormat("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "America/Fortaleza",
                }).format(new Date())}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-600"
            title="Atualizar"
          >
            <RefreshCw size={19} className={loading ? "animate-spin" : ""} />
          </button>
        </header>
        <div className="mx-auto max-w-[1500px] p-4 md:p-8">
          {active === "dashboard" && (
            <Dashboard
              employees={activeEmployees}
              punches={todayPunches}
              present={present}
              pending={pending}
              setActive={setActive}
              loading={loading}
            />
          )}
          {active === "punch" && <PunchClock action={action} />}
          {active === "employees" && (
            <Employees
              employees={data.employees}
              onNew={() => {
                setEditEmployee(null);
                setModal("employee");
              }}
              onEdit={(e) => {
                setEditEmployee(e);
                setModal("employee");
              }}
              action={action}
            />
          )}
          {active === "journeys" && (
            <Journeys
              employees={activeEmployees}
              onEdit={(e) => {
                setEditEmployee(e);
                setModal("employee");
              }}
            />
          )}
          {active === "adjustments" && (
            <Adjustments
              items={data.adjustments}
              employees={activeEmployees}
              onNew={() => setModal("adjustment")}
              action={action}
            />
          )}
          {active === "reports" && (
            <Reports
              employees={activeEmployees}
              punches={data.punches}
              manualDays={data.manualDays}
              company={data.company}
            />
          )}
          {active === "manual" && (
            <ManualEntries
              employees={activeEmployees}
              punches={data.punches}
              manualDays={data.manualDays}
              action={action}
            />
          )}
          {active === "users" && (
            <UsersAccess
              users={data.users}
              employees={data.employees}
              currentUser={data.currentUser}
              onNew={() => {
                setEditUser(null);
                setModal("user");
              }}
              onEdit={(u) => {
                setEditUser(u);
                setModal("user");
              }}
              action={action}
            />
          )}
          {active === "settings" && (
            <SettingsPage
              company={data.company}
              action={action}
              reload={load}
              notify={setToast}
            />
          )}
        </div>
      </main>
      {modal === "employee" && (
        <EmployeeModal
          employee={editEmployee}
          close={() => setModal(null)}
          submit={async (p) => {
            if (await action(p)) setModal(null);
          }}
        />
      )}
      {modal === "adjustment" && (
        <AdjustmentModal
          employees={activeEmployees}
          close={() => setModal(null)}
          submit={async (p) => {
            if (await action(p)) setModal(null);
          }}
        />
      )}
      {modal === "user" && (
        <UserModal
          user={editUser}
          employees={data.employees}
          close={() => setModal(null)}
          submit={async (p) => {
            if (await action(p)) setModal(null);
          }}
        />
      )}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm animate-pop items-center gap-3 rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-2xl ${toast.type === "ok" ? "bg-[#087f5b]" : "bg-red-600"}`}
        >
          {toast.type === "ok" ? <Check /> : <AlertCircle />}
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  employees,
  punches,
  present,
  pending,
  setActive,
  loading,
}: {
  employees: Employee[];
  punches: Punch[];
  present: number;
  pending: number;
  setActive: (s: string) => void;
  loading: boolean;
}) {
  const cards = [
    [
      "Funcionários ativos",
      employees.length,
      UsersRound,
      "text-emerald-700 bg-emerald-50",
    ],
    ["Presentes hoje", present, UserRound, "text-sky-700 bg-sky-50"],
    [
      "Marcações hoje",
      punches.length,
      Fingerprint,
      "text-violet-700 bg-violet-50",
    ],
    ["Ajustes pendentes", pending, TimerReset, "text-amber-700 bg-amber-50"],
  ] as const;
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b523c] to-[#087f5b] p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="mb-2 text-sm font-semibold text-emerald-200">
              RESUMO DA JORNADA
            </p>
            <h2 className="text-2xl font-bold md:text-3xl">
              Bom trabalho! Tudo sob controle.
            </h2>
            <p className="mt-2 text-emerald-100/75">
              Acompanhe a equipe em tempo real e trate rapidamente qualquer
              pendência.
            </p>
          </div>
          <button
            onClick={() => setActive("punch")}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-[#087f5b]"
          >
            <Fingerprint />
            Abrir relógio de ponto
          </button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, color]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-extrabold">
                  {loading ? "—" : value}
                </p>
              </div>
              <div
                className={`grid size-12 place-items-center rounded-2xl ${color}`}
              >
                <Icon size={23} />
              </div>
            </div>
          </article>
        ))}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 md:px-6">
          <div>
            <h3 className="font-bold">Últimas marcações</h3>
            <p className="text-sm text-slate-500">
              Movimentação registrada hoje
            </p>
          </div>
          <button
            onClick={() => setActive("reports")}
            className="text-sm font-bold text-[#087f5b]"
          >
            Ver relatório
          </button>
        </div>
        {punches.length === 0 ? (
          <Empty
            icon={Fingerprint}
            title="Nenhuma marcação hoje"
            text="Os registros aparecerão aqui assim que os funcionários baterem o ponto."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {punches.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-4 md:px-6"
              >
                <div className="grid size-10 place-items-center rounded-full bg-slate-100 font-bold">
                  {p.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.source === "totem" ? "Totem da empresa" : "Celular"}
                  </p>
                </div>
                <span
                  className={`hidden rounded-full px-3 py-1 text-xs font-bold sm:block ${kindColors[p.kind]}`}
                >
                  {p.kind}
                </span>
                <time className="font-mono text-lg font-bold">
                  {fmtTime(p.occurredAt)}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PunchClock({
  action,
}: {
  action: (p: Record<string, unknown>) => Promise<any>;
}) {
  const [clock, setClock] = useState(new Date()),
    [code, setCode] = useState(""),
    [pin, setPin] = useState(""),
    [source, setSource] = useState("mobile"),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState<any>(null);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  async function punch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let coords: any = {};
    try {
      coords = await new Promise((r) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(
              (p) =>
                r({
                  latitude: String(p.coords.latitude),
                  longitude: String(p.coords.longitude),
                }),
              () => r({}),
              { enableHighAccuracy: true, timeout: 8000 },
            )
          : r({}),
      );
    } catch {}
    const res = await action({ action: "punch", code, pin, source, ...coords });
    setBusy(false);
    if (res) {
      setSuccess(res);
      setCode("");
      setPin("");
      setTimeout(() => setSuccess(null), 5000);
    }
  }
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(clock);
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-[.9fr_1.1fr]">
      <div className="flex min-h-[310px] flex-col items-center justify-center bg-[#09271d] p-8 text-white md:min-h-[580px]">
        <div className="mb-7 grid size-16 place-items-center rounded-2xl bg-[#17b67e]">
          <Clock3 size={34} />
        </div>
        <p className="text-sm font-bold uppercase tracking-[.22em] text-emerald-300">
          Horário oficial
        </p>
        <div className="my-4 font-mono text-5xl font-black sm:text-6xl">
          {time}
        </div>
        <p className="capitalize text-white/60">
          {new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            timeZone: "America/Fortaleza",
          }).format(clock)}
        </p>
        <div className="mt-9 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/60">
          <ShieldCheck size={15} />
          Horário registrado pelo servidor
        </div>
      </div>
      <div className="flex items-center p-6 md:p-12">
        {success ? (
          <div className="w-full animate-pop text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Check size={40} />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold">{success.message}</h2>
            <p className="mt-2 text-slate-500">
              {success.employee} · {fmtTime(success.occurredAt)}
            </p>
          </div>
        ) : (
          <form onSubmit={punch} className="w-full">
            <p className="text-sm font-bold text-[#087f5b]">
              REGISTRO DE PONTO
            </p>
            <h2 className="mt-2 text-3xl font-extrabold">
              Olá! Vamos registrar?
            </h2>
            <p className="mt-2 text-slate-500">
              Informe sua matrícula e seu PIN pessoal.
            </p>
            <Label text="Matrícula">
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex.: 0001"
                className="input text-lg"
                required
              />
            </Label>
            <Label text="PIN">
              <input
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                type="password"
                inputMode="numeric"
                placeholder="••••"
                className="input text-lg tracking-[.35em]"
                required
              />
            </Label>
            <button
              disabled={busy}
              className="mt-7 flex h-15 w-full items-center justify-center gap-3 rounded-xl bg-[#087f5b] text-lg font-bold text-white disabled:opacity-60"
            >
              <Fingerprint />
              {busy ? "Registrando..." : "Registrar ponto"}
            </button>
            <p className="mt-5 text-center text-xs text-slate-400">
              Ao registrar, você confirma a data e o horário apresentados.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Employees({
  employees,
  onNew,
  onEdit,
  action,
}: {
  employees: Employee[];
  onNew: () => void;
  onEdit: (e: Employee) => void;
  action: (p: Record<string, unknown>) => Promise<any>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <SectionHeader
        title="Funcionários"
        subtitle="Cadastre e gerencie sua equipe."
        action="Novo funcionário"
        onClick={onNew}
      />
      {employees.length === 0 ? (
        <Empty
          icon={UsersRound}
          title="Nenhum funcionário cadastrado"
          text="Cadastre o primeiro funcionário para começar a usar o relógio de ponto."
          button="Cadastrar funcionário"
          onClick={onNew}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Funcionário",
                  "Matrícula",
                  "Cargo / Setor",
                  "Jornada",
                  "Situação",
                  "",
                ].map((x) => (
                  <th key={x} className="px-6 py-4">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="px-6 py-4">
                    <b>{e.name}</b>
                    <div className="text-sm text-slate-500">{e.cpf}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold">{e.code}</td>
                  <td className="px-6 py-4">
                    {e.role}
                    <div className="text-sm text-slate-500">{e.department}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {e.startTime}–{e.endTime}
                    <div className="text-slate-500">
                      {e.workdays} · {Math.floor(e.weeklyMinutes / 60)}h
                      {e.weeklyMinutes % 60
                        ? String(e.weeklyMinutes % 60).padStart(2, "0")
                        : ""}{" "}
                      semanais
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${e.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {e.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(e)}
                        className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() =>
                          action({ action: "toggle_employee", id: e.id })
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                      >
                        {e.status === "active" ? "Inativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Journeys({
  employees,
  onEdit,
}: {
  employees: Employee[];
  onEdit: (e: Employee) => void;
}) {
  const groups = useMemo(
    () =>
      Object.values(
        employees.reduce(
          (a, e) => {
            const k = `${e.workdays}|${e.startTime}|${e.breakStart}|${e.breakEnd}|${e.endTime}`;
            a[k] ??= { key: k, employees: [] as Employee[] };
            a[k].employees.push(e);
            return a;
          },
          {} as Record<string, { key: string; employees: Employee[] }>,
        ),
      ),
    [employees],
  );
  return (
    <div>
      {groups.length === 0 ? (
        <div className="rounded-2xl border bg-white">
          <Empty
            icon={CalendarDays}
            title="Nenhuma jornada cadastrada"
            text="As jornadas aparecerão após o primeiro funcionário ser cadastrado."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => {
            const e = g.employees[0];
            return (
              <article
                key={g.key}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex justify-between">
                  <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-[#087f5b]">
                    <CalendarDays />
                  </div>
                  <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                    {g.employees.length} funcionário(s)
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold">{e.workdays}</h3>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <Time label="Entrada" value={e.startTime} />
                  <Time label="Intervalo" value={e.breakStart} />
                  <Time label="Retorno" value={e.breakEnd} />
                  <Time label="Saída" value={e.endTime} />
                </div>
                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="truncate text-sm text-slate-500">
                    {g.employees.map((x) => x.name).join(", ")}
                  </p>
                  {g.employees.length === 1 && (
                    <button
                      onClick={() => onEdit(e)}
                      className="ml-3 shrink-0 text-sm font-bold text-[#087f5b]"
                    >
                      Editar jornada
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Adjustments({
  items,
  employees,
  onNew,
  action,
}: {
  items: Adjustment[];
  employees: Employee[];
  onNew: () => void;
  action: (p: Record<string, unknown>) => Promise<any>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <SectionHeader
        title="Solicitações de ajuste"
        subtitle="Correções sem alterar o registro original."
        action="Solicitar ajuste"
        onClick={onNew}
        disabled={!employees.length}
      />
      {!items.length ? (
        <Empty
          icon={TimerReset}
          title="Nenhuma solicitação"
          text="As solicitações de correção aparecerão aqui."
        />
      ) : (
        <div className="divide-y">
          {items.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:px-6"
            >
              <div className="flex-1">
                <div className="flex gap-2">
                  <b>{a.name}</b>
                  <Status status={a.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {a.punchDate.split("-").reverse().join("/")} às{" "}
                  {a.requestedTime} · {a.reason}
                </p>
              </div>
              {a.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      action({
                        action: "review_adjustment",
                        id: a.id,
                        status: "rejected",
                      })
                    }
                    className="rounded-xl border px-4 py-2 text-sm font-bold"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={() =>
                      action({
                        action: "review_adjustment",
                        id: a.id,
                        status: "approved",
                      })
                    }
                    className="rounded-xl bg-[#087f5b] px-4 py-2 text-sm font-bold text-white"
                  >
                    Aprovar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ManualEntries({
  employees,
  punches,
  manualDays,
  action,
}: {
  employees: Employee[];
  punches: Punch[];
  manualDays: ManualDay[];
  action: (p: Record<string, unknown>) => Promise<any>;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
    }).format(new Date()),
    [employeeId, setEmployeeId] = useState(
      employees[0] ? String(employees[0].id) : "",
    ),
    [date, setDate] = useState(today),
    [status, setStatus] = useState("worked"),
    [entry, setEntry] = useState(""),
    [breakStart, setBreakStart] = useState(""),
    [breakEnd, setBreakEnd] = useState(""),
    [exit, setExit] = useState(""),
    [note, setNote] = useState("");
  useEffect(() => {
    const id = Number(employeeId),
      day = manualDays.find((x) => x.employeeId === id && x.localDate === date),
      marks = punches
        .filter(
          (p) =>
            p.employeeId === id &&
            p.localDate === date &&
            p.source === "manual",
        )
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    setStatus(day?.status || "worked");
    setNote(day?.note || "");
    const times = marks.map((m) =>
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(m.occurredAt)),
    );
    setEntry(times[0] || "");
    if (times.length === 4) {
      setBreakStart(times[1]);
      setBreakEnd(times[2]);
      setExit(times[3]);
    } else {
      setBreakStart("");
      setBreakEnd("");
      setExit(times[1] || "");
    }
  }, [employeeId, date, manualDays, punches]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action({
      action: "save_manual_day",
      employeeId,
      localDate: date,
      status,
      entry,
      breakStart,
      breakEnd,
      exit,
      note,
    });
    if (ok) {
      const next = new Date(`${date}T12:00:00`);
      next.setDate(next.getDate() + 1);
      const value = next.toISOString().slice(0, 10);
      if (value <= today) setDate(value);
    }
  }
  const existing = manualDays.some(
      (x) => x.employeeId === Number(employeeId) && x.localDate === date,
    ),
    worked = status === "worked";
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-lg font-bold">Lançamento manual do ponto</h2>
          <p className="text-sm text-slate-500">
            Transcreva livros de ponto ou faça lançamentos autorizados pelo RH.
          </p>
        </div>
        <form onSubmit={save} className="grid gap-4 p-6 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Funcionário
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
            >
              <option value="">Selecione</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.code}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Data
            <input
              required
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border px-3"
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Situação
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
            >
              <option value="worked">Trabalhou</option>
              <option value="absence">Falta</option>
              <option value="off">Folga informada</option>
              <option value="medical">Atestado</option>
              <option value="vacation">Férias</option>
            </select>
          </label>
          {worked && (
            <>
              <Field
                label="Entrada *"
                type="time"
                value={entry}
                onChange={(e: any) => setEntry(e.target.value)}
              />
              <Field
                label="Início do intervalo"
                type="time"
                value={breakStart}
                onChange={(e: any) => setBreakStart(e.target.value)}
              />
              <Field
                label="Retorno do intervalo"
                type="time"
                value={breakEnd}
                onChange={(e: any) => setBreakEnd(e.target.value)}
              />
              <Field
                label="Saída *"
                type="time"
                value={exit}
                onChange={(e: any) => setExit(e.target.value)}
              />
            </>
          )}
          <label className="sm:col-span-2 text-sm font-bold">
            Justificativa / observação
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border p-3"
              placeholder="Ex.: Transcrição do livro físico de ponto"
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <button className="rounded-xl bg-[#087f5b] px-6 py-3 font-bold text-white">
              Salvar e avançar
            </button>
            {existing && (
              <button
                type="button"
                onClick={() =>
                  action({
                    action: "delete_manual_day",
                    employeeId,
                    localDate: date,
                  })
                }
                className="rounded-xl border border-red-200 px-5 py-3 font-bold text-red-600"
              >
                Remover lançamento
              </button>
            )}
          </div>
        </form>
      </section>
      <aside className="h-fit rounded-2xl border bg-white p-6 shadow-sm">
        <ClipboardEdit className="text-[#087f5b]" size={30} />
        <h3 className="mt-4 font-bold">Importação segura</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Os pontos são identificados como <b>manual/RH</b>. Alterações e
          exclusões ficam registradas para auditoria.
        </p>
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Cadastre primeiro os funcionários e depois transcreva cada dia do
          livro físico, de 01/09 até hoje.
        </p>
      </aside>
    </div>
  );
}

function Reports({
  employees,
  punches,
  manualDays,
  company,
}: {
  employees: Employee[];
  punches: Punch[];
  manualDays: ManualDay[];
  company: Company | null;
}) {
  const now = new Date(),
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
    }).format(now),
    first = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    last = today;
  const [employee, setEmployee] = useState("all"),
    [department, setDepartment] = useState("all"),
    [start, setStart] = useState(first),
    [end, setEnd] = useState(last),
    [mode, setMode] = useState("detailed");
  const effectiveEnd = end < today ? end : today;
  const departments = [...new Set(employees.map((e) => e.department))];
  const selected = employees.filter(
    (e) =>
      (employee === "all" || String(e.id) === employee) &&
      (department === "all" || e.department === department),
  );
  const ids = new Set(selected.map((e) => e.id)),
    filtered = punches.filter(
      (p) =>
        ids.has(p.employeeId) &&
        p.localDate >= start &&
        p.localDate <= effectiveEnd,
    );
  const daily = useMemo(() => {
    const groups: Record<string, Punch[]> = {};
    filtered.forEach((p) =>
      (groups[`${p.employeeId}|${p.localDate}`] ??= []).push(p),
    );
    const dates: string[] = [];
    for (
      let d = new Date(`${start}T12:00:00`),
        limit = new Date(`${effectiveEnd}T12:00:00`);
      d <= limit;
      d.setDate(d.getDate() + 1)
    )
      dates.push(d.toISOString().slice(0, 10));
    return selected.flatMap((emp) =>
      dates
        .filter((date) => {
          const configured =
              emp.calculationStartDate || emp.createdAt?.slice(0, 10) || date,
            records = [
              ...punches
                .filter((p) => p.employeeId === emp.id)
                .map((p) => p.localDate),
              ...manualDays
                .filter((m) => m.employeeId === emp.id)
                .map((m) => m.localDate),
            ],
            effective = records.length
              ? [configured, ...records].sort()[0]
              : configured;
          return date >= effective;
        })
        .map((date) => {
          const key = `${emp.id}|${date}`,
            list = groups[key] || [];
          list.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
          let minutes = 0;
          for (let i = 0; i + 1 < list.length; i += 2)
            minutes +=
              (new Date(list[i + 1].occurredAt).getTime() -
                new Date(list[i].occurredAt).getTime()) /
              60000;
          const info = scheduleInfo(emp, date),
            manual = manualDays.find(
              (x) => x.employeeId === emp.id && x.localDate === date,
            ),
            manualLabels: Record<string, string> = {
              worked: "Lançamento manual",
              absence: "Falta",
              off: "Folga informada",
              medical: "Atestado",
              vacation: "Férias",
            },
            manualOff = Boolean(
              manual && ["off", "medical", "vacation"].includes(manual.status),
            ),
            finalExpected = manualOff ? 0 : info.expected,
            workedMinutes = Math.max(0, Math.round(minutes));
          return {
            key,
            name: emp.name,
            date,
            marks: list.length
              ? list.map((x) => fmtTime(x.occurredAt)).join(" · ")
              : manual?.status === "absence"
                ? "FALTA"
                : manualOff
                  ? manualLabels[manual!.status].toUpperCase()
                  : info.off
                    ? "FOLGA"
                    : "Sem registro",
            minutes: workedMinutes,
            expected: finalExpected,
            balance: workedMinutes - finalExpected,
            incomplete:
              !manual &&
              !info.off &&
              (list.length === 0 || list.length % 2 !== 0),
            status: manual ? manualLabels[manual.status] : info.label,
            off: manualOff || info.off,
          };
        }),
    );
  }, [filtered, selected, start, effectiveEnd, manualDays, punches]);
  const worked = daily.reduce((s, d) => s + d.minutes, 0),
    expected = daily.reduce((s, d) => s + d.expected, 0),
    balance = worked - expected,
    hm = (n: number) =>
      `${n < 0 ? "-" : ""}${Math.floor(Math.abs(n) / 60)}h ${String(Math.abs(n) % 60).padStart(2, "0")}min`;
  const employeeSummary = selected.map((emp) => {
    const rows = daily.filter((d) => d.name === emp.name),
      worked = rows.reduce((s, d) => s + d.minutes, 0),
      expected = rows.reduce((s, d) => s + d.expected, 0),
      balance = worked - expected;
    return {
      id: emp.id,
      name: emp.name,
      worked,
      expected,
      balance,
      absences: rows.filter(
        (d) =>
          d.status === "Falta" || (d.incomplete && d.marks === "Sem registro"),
      ).length,
    };
  });
  function csv() {
    const rows = [
        ["Empresa", company?.tradeName || company?.legalName || ""],
        ["Período", `${start} a ${effectiveEnd}`],
        [],
        [
          "Funcionário",
          "Data",
          "Marcações",
          "Situação",
          "Horas trabalhadas",
          "Carga prevista",
          "Saldo",
        ],
        ...daily.map((d) => [
          d.name,
          d.date,
          d.marks,
          d.status,
          hm(d.minutes),
          hm(d.expected),
          hm(d.balance),
        ]),
        [],
        ["Total trabalhado", hm(worked)],
        ["Total previsto", hm(expected)],
        ["Saldo", hm(balance)],
      ],
      text = rows
        .map((r) =>
          r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";"),
        )
        .join("\n"),
      a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + text], { type: "text/csv" }),
    );
    a.download = `linkponto-${start}-${effectiveEnd}.csv`;
    a.click();
  }
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Filter label="Funcionário">
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
            >
              <option value="all">Todos</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Setor">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="all">Todos</option>
              {departments.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Filter>
          <Filter label="Data inicial">
            <input
              type="date"
              value={start}
              max={today}
              onChange={(e) => setStart(e.target.value)}
            />
          </Filter>
          <Filter label="Data final">
            <input
              type="date"
              value={end}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Filter>
          <Filter label="Modelo">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="detailed">Detalhado</option>
              <option value="summary">Somente resumo</option>
            </select>
          </Filter>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={csv}
            disabled={!daily.length}
            className="rounded-xl border px-4 py-2.5 font-bold disabled:opacity-40"
          >
            Exportar CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!daily.length}
            className="flex items-center gap-2 rounded-xl bg-[#087f5b] px-4 py-2.5 font-bold text-white disabled:opacity-40"
          >
            <Printer size={18} />
            Imprimir / PDF
          </button>
        </div>
      </section>
      <section
        id="report"
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      >
        <div className="h-2 bg-gradient-to-r from-[#087f5b] via-emerald-500 to-teal-300" />
        <div className="flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-center">
          <div className="grid h-16 w-28 place-items-center overflow-hidden rounded-xl border bg-slate-50">
            {company?.logoKey ? (
              <img
                src="/api/logo"
                alt="Logo da empresa"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Building2 className="text-slate-300" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-extrabold">
              {company?.tradeName ||
                company?.legalName ||
                "Empresa não configurada"}
            </h2>
            <p className="text-sm text-slate-500">
              {company?.document && `CNPJ/CPF: ${company.document} · `}
              {company?.city}
              {company?.state && `/${company.state}`}
            </p>
            <p className="mt-1 text-sm font-semibold">
              Relatório de horas · {start.split("-").reverse().join("/")} a{" "}
              {effectiveEnd.split("-").reverse().join("/")}
            </p>
          </div>
        </div>
        <div className="grid gap-3 border-b bg-slate-50 p-5 sm:grid-cols-3">
          <ReportTotal label="Horas trabalhadas" value={hm(worked)} />
          <ReportTotal label="Carga prevista" value={hm(expected)} />
          <ReportTotal
            label="Saldo do período"
            value={hm(balance)}
            color={balance >= 0 ? "text-emerald-700" : "text-red-600"}
          />
        </div>
        {!!daily.length && (
          <div className="border-b p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800">
                Resumo por funcionário
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                {employeeSummary.length} funcionário(s)
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {employeeSummary.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 truncate font-extrabold text-slate-800">
                    {item.name}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-slate-500">Trabalhadas</span>
                    <b className="text-right">{hm(item.worked)}</b>
                    <span className="text-slate-500">Horas extras</span>
                    <b className="text-right text-emerald-700">
                      {hm(Math.max(0, item.balance))}
                    </b>
                    <span className="text-slate-500">Horas devedoras</span>
                    <b className="text-right text-red-600">
                      {hm(Math.max(0, -item.balance))}
                    </b>
                    <span className="text-slate-500">Faltas</span>
                    <b
                      className={`text-right ${item.absences ? "text-red-600" : "text-slate-700"}`}
                    >
                      {item.absences}
                    </b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!daily.length ? (
          <Empty
            icon={BarChart3}
            title="Nenhuma marcação no período"
            text="Altere os filtros ou aguarde os primeiros registros."
          />
        ) : mode === "summary" ? (
          <div className="p-6 text-center text-sm text-slate-500">
            O detalhamento diário foi ocultado. Os totais acima consideram{" "}
            {daily.length} jornada(s).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Funcionário",
                    "Data",
                    "Marcações",
                    "Situação",
                    "Trabalhado",
                    "Previsto",
                    "Saldo",
                  ].map((x) => (
                    <th key={x} className="px-5 py-4">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {daily.map((d) => (
                  <tr
                    key={d.key}
                    className={
                      d.status === "Falta" ||
                      (d.incomplete && d.marks === "Sem registro")
                        ? "bg-red-50/60"
                        : d.off
                          ? "bg-sky-50/50"
                          : d.status === "Lançamento manual"
                            ? "bg-emerald-50/40"
                            : "hover:bg-slate-50/70"
                    }
                  >
                    <td className="px-5 py-4 font-bold">{d.name}</td>
                    <td className="px-5 py-4">
                      {d.date.split("-").reverse().join("/")}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm">
                      {d.marks}
                      {d.incomplete && (
                        <span className="ml-2 text-xs font-bold text-amber-600">
                          Incompleto
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          d.status === "Falta"
                            ? "bg-red-100 text-red-700"
                            : d.status === "Atestado"
                              ? "bg-amber-100 text-amber-700"
                              : d.status === "Férias"
                                ? "bg-violet-100 text-violet-700"
                                : d.off
                                  ? "bg-sky-100 text-sky-700"
                                  : d.status === "Lançamento manual"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold">{hm(d.minutes)}</td>
                    <td className="px-5 py-4">{hm(d.expected)}</td>
                    <td
                      className={`px-5 py-4 font-bold ${d.balance >= 0 ? "text-emerald-700" : "text-red-600"}`}
                    >
                      {hm(d.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function UsersAccess({
  users,
  employees,
  currentUser,
  onNew,
  onEdit,
  action,
}: {
  users: AccessUser[];
  employees: Employee[];
  currentUser: CurrentUser | null;
  onNew: () => void;
  onEdit: (u: AccessUser) => void;
  action: (p: Record<string, unknown>) => Promise<any>;
}) {
  const labels = {
    admin: "Administrador",
    manager: "Gestor / RH",
    employee: "Funcionário / Operador",
  };
  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <SectionHeader
        title="Usuários e níveis de acesso"
        subtitle="Controle quem pode acessar cada área."
        action="Novo usuário"
        onClick={onNew}
      />
      <div className="border-b bg-slate-50 px-6 py-4 text-sm text-slate-600">
        <b>Administrador:</b> acesso completo · <b>Gestor/RH:</b> equipe e
        relatórios · <b>Funcionário:</b> somente ponto.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Nome", "Usuário", "Nível", "Vínculo", "Situação", ""].map(
                (x) => (
                  <th key={x} className="px-6 py-4">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-4 font-bold">
                  {u.name}
                  {u.id === currentUser?.id && (
                    <small className="ml-2 text-emerald-700">Você</small>
                  )}
                </td>
                <td className="px-6 py-4 font-mono">{u.username}</td>
                <td className="px-6 py-4">{labels[u.role]}</td>
                <td className="px-6 py-4">
                  {employees.find((e) => e.id === u.employeeId)?.name || "—"}
                </td>
                <td className="px-6 py-4">
                  {u.status === "active" ? "Ativo" : "Inativo"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(u)}
                      className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
                    >
                      Editar
                    </button>
                    <button
                      disabled={u.id === currentUser?.id}
                      onClick={() =>
                        action({ action: "toggle_user", id: u.id })
                      }
                      className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      {u.status === "active" ? "Inativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsPage({
  company,
  action,
  reload,
  notify,
}: {
  company: Company | null;
  action: (p: Record<string, unknown>) => Promise<any>;
  reload: () => Promise<void>;
  notify: (t: any) => void;
}) {
  const [uploading, setUploading] = useState(false),
    [lat, setLat] = useState(company?.latitude || ""),
    [lon, setLon] = useState(company?.longitude || "");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await action({
      action: "save_company",
      ...Object.fromEntries(new FormData(e.currentTarget)),
    });
  }
  async function logo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const f = new FormData();
    f.append("logo", file);
    const r = await fetch("/api/logo", { method: "POST", body: f }),
      j = await r.json();
    notify({ type: r.ok ? "ok" : "error", text: r.ok ? j.message : j.error });
    if (r.ok) await reload();
    setUploading(false);
  }
  function locate() {
    if (!navigator.geolocation)
      return notify({
        type: "error",
        text: "Localização indisponível neste dispositivo.",
      });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(String(p.coords.latitude));
        setLon(String(p.coords.longitude));
        notify({ type: "ok", text: "Localização atual preenchida." });
      },
      () =>
        notify({
          type: "error",
          text: "Autorize o acesso à localização para continuar.",
        }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-lg font-bold">
            Dados da empresa e local do ponto
          </h2>
          <p className="text-sm text-slate-500">
            Defina os dados dos relatórios e a área autorizada para marcação.
          </p>
        </div>
        <form onSubmit={save} className="grid gap-4 p-6 sm:grid-cols-2">
          <Field
            label="Razão social *"
            name="legalName"
            defaultValue={company?.legalName || ""}
          />
          <Field
            label="Nome fantasia"
            name="tradeName"
            defaultValue={company?.tradeName || ""}
          />
          <Field
            label="CNPJ ou CPF"
            name="document"
            defaultValue={company?.document || ""}
          />
          <Field
            label="Telefone"
            name="phone"
            defaultValue={company?.phone || ""}
          />
          <Field
            label="E-mail"
            name="email"
            type="email"
            defaultValue={company?.email || ""}
          />
          <Field
            label="Endereço"
            name="address"
            defaultValue={company?.address || ""}
          />
          <Field
            label="Cidade"
            name="city"
            defaultValue={company?.city || ""}
          />
          <Field
            label="Estado"
            name="state"
            maxLength={2}
            defaultValue={company?.state || ""}
          />
          <Select
            label="Fuso horário"
            name="timezone"
            options={[
              "America/Fortaleza",
              "America/Recife",
              "America/Sao_Paulo",
              "America/Manaus",
              "America/Rio_Branco",
            ]}
          />
          <Field
            label="Tolerância de horário (minutos)"
            name="toleranceMinutes"
            type="number"
            min="0"
            max="60"
            defaultValue={company?.toleranceMinutes ?? 10}
          />
          <div className="sm:col-span-2 mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold">Localização autorizada</h3>
                <p className="text-sm text-slate-600">
                  Use o celular no local da empresa para capturar a posição
                  correta.
                </p>
              </div>
              <button
                type="button"
                onClick={locate}
                className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700"
              >
                Usar localização atual
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-bold">
                Latitude
                <input
                  name="latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border bg-white px-3"
                />
              </label>
              <label className="text-sm font-bold">
                Longitude
                <input
                  name="longitude"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border bg-white px-3"
                />
              </label>
              <Field
                label="Raio permitido (metros)"
                name="allowedRadiusMeters"
                type="number"
                min="20"
                max="10000"
                defaultValue={company?.allowedRadiusMeters ?? 150}
              />
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                name="requireLocation"
                defaultChecked={company?.requireLocation !== false}
                className="size-5 accent-[#087f5b]"
              />
              Exigir localização para registrar o ponto
            </label>
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-xl bg-[#087f5b] px-6 py-3 font-bold text-white">
              Salvar configurações
            </button>
          </div>
        </form>
      </section>
      <aside className="h-fit rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="font-bold">Logo da empresa</h3>
        <p className="mt-1 text-sm text-slate-500">
          PNG, JPG ou WEBP, até 2 MB.
        </p>
        <div className="mt-5 grid h-40 place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-slate-50">
          {company?.logoKey ? (
            <img
              src={`/api/logo?v=${company.updatedAt || ""}`}
              className="max-h-full max-w-full object-contain p-3"
              alt="Logo"
            />
          ) : (
            <ImageUp className="text-slate-300" size={42} />
          )}
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold">
          <ImageUp size={18} />
          {uploading ? "Enviando..." : "Escolher logo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={logo}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </aside>
    </div>
  );
}

function EmployeeModal({
  employee,
  close,
  submit,
}: {
  employee: Employee | null;
  close: () => void;
  submit: (p: Record<string, unknown>) => Promise<void>;
}) {
  const fallback: WorkSchedule = {
    days: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
      (name, day) => ({
        day,
        name,
        enabled: day >= 1 && day <= 5,
        hasBreak: true,
        start: "08:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        end: "17:00",
      }),
    ),
    monthlySundayOff: "none",
    holiday: {
      enabled: true,
      hasBreak: false,
      start: "07:00",
      breakStart: "",
      breakEnd: "",
      end: "14:00",
    },
    weeklyMinutes: 2400,
    summary: "Seg, Ter, Qua, Qui, Sex",
  };
  let initial = fallback;
  try {
    if (employee?.scheduleJson) {
      initial = JSON.parse(employee.scheduleJson);
      initial.days = initial.days.map((d) => ({
        ...d,
        hasBreak: d.hasBreak ?? Boolean(d.breakStart && d.breakEnd),
      }));
      initial.holiday = {
        ...initial.holiday,
        hasBreak:
          initial.holiday.hasBreak ??
          Boolean(initial.holiday.breakStart && initial.holiday.breakEnd),
      };
    }
  } catch {}
  const [busy, setBusy] = useState(false),
    [schedule, setSchedule] = useState(initial),
    [holidayHasBreak, setHolidayHasBreak] = useState(
      Boolean(initial.holiday.hasBreak),
    ),
    editing = !!employee;
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    await submit({
      action: editing ? "update_employee" : "create_employee",
      id: employee?.id,
      ...Object.fromEntries(new FormData(e.currentTarget)),
    });
    setBusy(false);
  }
  function dayChange(i: number, key: keyof DaySchedule, value: any) {
    setSchedule((s) => ({
      ...s,
      days: s.days.map((d, n) => (n === i ? { ...d, [key]: value } : d)),
    }));
  }
  return (
    <Modal
      title={editing ? "Editar funcionário e jornada" : "Novo funcionário"}
      close={close}
    >
      <form onSubmit={go} className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome completo *"
          name="name"
          className="sm:col-span-2"
          defaultValue={employee?.name || ""}
        />
        <Field label="CPF *" name="cpf" defaultValue={employee?.cpf || ""} />
        <Field
          label="Início da apuração *"
          name="calculationStartDate"
          type="date"
          defaultValue={
            employee?.calculationStartDate ||
            employee?.createdAt?.slice(0, 10) ||
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Fortaleza",
            }).format(new Date())
          }
        />
        <Field
          label="Cargo *"
          name="role"
          defaultValue={employee?.role || ""}
        />
        <Field
          label="Setor"
          name="department"
          defaultValue={employee?.department || ""}
        />
        <Field
          label={
            editing ? "Novo PIN (deixe vazio para manter)" : "PIN de acesso *"
          }
          name="pin"
          type="password"
          inputMode="numeric"
          maxLength={6}
        />
        <div className="sm:col-span-2 mt-2">
          <h3 className="font-bold">Jornada por dia da semana</h3>
          <p className="mb-3 text-sm text-slate-500">
            Marque os dias trabalhados. Desmarque o dia da folga semanal.
          </p>
          <div className="space-y-2">
            {schedule.days.map((d, i) => (
              <div
                key={d.day}
                className={`grid items-center gap-2 rounded-xl border p-3 ${d.enabled ? "bg-emerald-50/50" : "bg-slate-50 opacity-70"} sm:grid-cols-[70px_95px_repeat(4,1fr)]`}
              >
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    name={`day${i}Enabled`}
                    checked={d.enabled}
                    onChange={(e) => dayChange(i, "enabled", e.target.checked)}
                    className="size-5 accent-[#087f5b]"
                  />
                  {d.name}
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    name={`day${i}HasBreak`}
                    checked={Boolean(d.hasBreak)}
                    onChange={(e) => dayChange(i, "hasBreak", e.target.checked)}
                    disabled={!d.enabled}
                    className="size-4 accent-[#087f5b]"
                  />
                  Intervalo
                </label>
                {(["start", "breakStart", "breakEnd", "end"] as const).map(
                  (k, n) => (
                    <label key={k} className="text-[11px] text-slate-500">
                      {["Entrada", "Intervalo", "Retorno", "Saída"][n]}
                      <input
                        type="time"
                        name={`day${i}${k[0].toUpperCase() + k.slice(1)}`}
                        value={d[k]}
                        onChange={(e) => dayChange(i, k, e.target.value)}
                        disabled={
                          !d.enabled ||
                          ((k === "breakStart" || k === "breakEnd") &&
                            !d.hasBreak)
                        }
                        className="mt-1 h-10 w-full rounded-lg border bg-white px-2 text-sm disabled:bg-slate-100"
                      />
                    </label>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <label className="sm:col-span-2 block text-sm font-bold">
          Domingo de folga mensal
          <select
            name="monthlySundayOff"
            defaultValue={initial.monthlySundayOff || "none"}
            className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
          >
            <option value="none">Sem folga dominical automática</option>
            <option value="1">1º domingo do mês</option>
            <option value="2">2º domingo do mês</option>
            <option value="3">3º domingo do mês</option>
            <option value="4">4º domingo do mês</option>
            <option value="last">Último domingo do mês</option>
          </select>
          <span className="mt-1 block font-normal text-slate-500">
            Escolha domingos diferentes para distribuir as folgas entre a
            equipe.
          </span>
        </label>
        <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <label className="flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              name="holidayEnabled"
              defaultChecked={initial.holiday.enabled}
              className="size-5 accent-[#087f5b]"
            />
            Usar jornada especial em feriados nacionais
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="holidayHasBreak"
              checked={holidayHasBreak}
              onChange={(e) => setHolidayHasBreak(e.target.checked)}
              className="size-4 accent-[#087f5b]"
            />
            Feriado possui intervalo
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field
              label="Entrada"
              name="holidayStart"
              type="time"
              defaultValue={initial.holiday.start}
            />
            <Field
              label="Intervalo"
              name="holidayBreakStart"
              type="time"
              defaultValue={initial.holiday.breakStart}
              disabled={!holidayHasBreak}
            />
            <Field
              label="Retorno"
              name="holidayBreakEnd"
              type="time"
              defaultValue={initial.holiday.breakEnd}
              disabled={!holidayHasBreak}
            />
            <Field
              label="Saída"
              name="holidayEnd"
              type="time"
              defaultValue={initial.holiday.end}
            />
          </div>
        </div>
        <div className="mt-2 flex gap-3 sm:col-span-2">
          <button
            type="button"
            onClick={close}
            className="h-12 flex-1 rounded-xl border font-bold"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            className="h-12 flex-1 rounded-xl bg-[#087f5b] font-bold text-white"
          >
            {busy ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function UserModal({
  user,
  employees,
  close,
  submit,
}: {
  user: AccessUser | null;
  employees: Employee[];
  close: () => void;
  submit: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    editing = !!user;
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    await submit({
      action: editing ? "update_user" : "create_user",
      id: user?.id,
      ...Object.fromEntries(new FormData(e.currentTarget)),
    });
    setBusy(false);
  }
  return (
    <Modal title={editing ? "Editar usuário" : "Novo usuário"} close={close}>
      <form onSubmit={go} className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome completo *"
          name="name"
          className="sm:col-span-2"
          defaultValue={user?.name || ""}
        />
        <Field
          label="Nome de usuário *"
          name="username"
          defaultValue={user?.username || ""}
        />
        <Field
          label={editing ? "Nova senha (vazio para manter)" : "Senha *"}
          name="password"
          type="password"
          minLength={6}
        />
        <label className="block text-sm font-bold">
          Nível
          <select
            name="role"
            defaultValue={user?.role || "employee"}
            className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
          >
            <option value="admin">Administrador</option>
            <option value="manager">Gestor / RH</option>
            <option value="employee">Funcionário / Operador</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          Funcionário vinculado
          <select
            name="employeeId"
            defaultValue={user?.employeeId || ""}
            className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
          >
            <option value="">Sem vínculo</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <button
            type="button"
            onClick={close}
            className="h-12 flex-1 rounded-xl border font-bold"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            className="h-12 flex-1 rounded-xl bg-[#087f5b] font-bold text-white"
          >
            {busy ? "Salvando..." : "Salvar usuário"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AdjustmentModal({
  employees,
  close,
  submit,
}: {
  employees: Employee[];
  close: () => void;
  submit: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    await submit({
      action: "create_adjustment",
      ...Object.fromEntries(new FormData(e.currentTarget)),
    });
    setBusy(false);
  }
  return (
    <Modal title="Solicitar ajuste" close={close}>
      <form onSubmit={go} className="space-y-4">
        <label className="block text-sm font-bold">
          Funcionário
          <select
            name="employeeId"
            required
            className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
          >
            <option value="">Selecione</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data" name="punchDate" type="date" />
          <Field label="Horário" name="requestedTime" type="time" />
        </div>
        <label className="block text-sm font-bold">
          Motivo
          <textarea
            name="reason"
            required
            rows={3}
            className="mt-2 w-full rounded-xl border p-3"
            placeholder="Explique o motivo"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={close}
            className="h-12 flex-1 rounded-xl border font-bold"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            className="h-12 flex-1 rounded-xl bg-[#087f5b] font-bold text-white"
          >
            Enviar
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-5">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button onClick={close} className="rounded-lg p-2">
            <X />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
function Field({ label, className, ...props }: any) {
  return (
    <label className={`block text-sm font-bold ${className || ""}`}>
      {label}
      <input
        {...props}
        className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-[#10a777] focus:ring-4 focus:ring-emerald-100"
        required={label.includes("*")}
      />
    </label>
  );
}
function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-6 block text-sm font-bold">
      {text}
      {children}
    </label>
  );
}
function Filter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="report-filter text-sm font-bold">
      {label}
      <div className="mt-2 [&>*]:h-11 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:bg-white [&>*]:px-3 [&>*]:font-normal">
        {children}
      </div>
    </label>
  );
}
function ReportTotal({
  label,
  value,
  color = "",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <select
        name={name}
        className="mt-2 h-12 w-full rounded-xl border bg-white px-3"
      >
        {options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}
function SectionHeader({
  title,
  subtitle,
  action,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <button
        disabled={disabled}
        onClick={onClick}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#087f5b] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        <Plus size={18} />
        {action}
      </button>
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
  button,
  onClick,
}: {
  icon: any;
  title: string;
  text: string;
  button?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon />
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>
      {button && (
        <button
          onClick={onClick}
          className="mt-5 flex items-center gap-2 rounded-xl bg-[#087f5b] px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus size={17} />
          {button}
        </button>
      )}
    </div>
  );
}
function Time({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-mono font-bold">{value}</p>
    </div>
  );
}
function Status({ status }: { status: string }) {
  const m: any = {
    pending: ["Pendente", "bg-amber-50 text-amber-700"],
    approved: ["Aprovado", "bg-emerald-50 text-emerald-700"],
    rejected: ["Recusado", "bg-red-50 text-red-700"],
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${m[status]?.[1]}`}
    >
      {m[status]?.[0]}
    </span>
  );
}
