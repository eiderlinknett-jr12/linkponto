import Database from "better-sqlite3";
import http from "node:http";
import path from "node:path";

const db = new Database(path.join(process.env.CONTROL_DATA_DIR || "/app/control-data", "control.sqlite"));
db.pragma("journal_mode = WAL");
const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const image = process.env.LINKPONTO_TENANT_IMAGE || "linkponto:latest";
const authSecret = process.env.TENANT_AUTH_SECRET;
if (!authSecret) throw new Error("TENANT_AUTH_SECRET é obrigatório.");

function schemaReady() {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tenants'").get(),
  );
}

function docker(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : undefined;
    const req = http.request({ socketPath, path: `/v1.43${urlPath}`, method, headers: payload ? { "content-type": "application/json", "content-length": payload.length } : {} }, res => {
      let data = ""; res.on("data", chunk => data += chunk); res.on("end", () => {
        if ((res.statusCode || 500) >= 400 && res.statusCode !== 304) return reject(new Error(`Docker ${res.statusCode}: ${data}`));
        try { resolve(data ? JSON.parse(data) : null); } catch { resolve(data); }
      });
    });
    req.on("error", reject); if (payload) req.write(payload); req.end();
  });
}

async function exists(kind, name) { try { await docker("GET", `/${kind}/${encodeURIComponent(name)}/json`); return true; } catch (e) { if (String(e).includes("404")) return false; throw e; } }
async function removeContainer(name) { if (await exists("containers", name)) await docker("DELETE", `/containers/${encodeURIComponent(name)}?force=true`); }

async function reconcile(tenant, status) {
  const containerName = `linkponto-${tenant.slug}`;
  const volumeName = `linkponto_${tenant.slug}_data`;
  if (!(await exists("volumes", volumeName))) await docker("POST", "/volumes/create", { Name: volumeName, Labels: { "com.linknett.product": "linkponto", "com.linknett.tenant": tenant.slug } });
  await removeContainer(containerName);
  const labels = {
    "traefik.enable": "true",
    [`traefik.http.routers.linkponto-${tenant.slug}.entrypoints`]: "websecure",
    [`traefik.http.routers.linkponto-${tenant.slug}.rule`]: `Host(\`${tenant.domain}\`)`,
    [`traefik.http.routers.linkponto-${tenant.slug}.tls`]: "true",
    [`traefik.http.routers.linkponto-${tenant.slug}.tls.certresolver`]: "letsencrypt",
    [`traefik.http.services.linkponto-${tenant.slug}.loadbalancer.server.port`]: "3000",
    "com.linknett.product": "linkponto",
    "com.linknett.tenant": tenant.slug,
  };
  await docker("POST", `/containers/create?name=${encodeURIComponent(containerName)}`, {
    Image: image,
    Env: ["NODE_ENV=production", "DATA_DIR=/app/data", "ADMIN_USER=admin", `ADMIN_PASSWORD=${tenant.initial_admin_password}`, `AUTH_SECRET=${authSecret}`, `TENANT_SLUG=${tenant.slug}`, `TENANT_STATUS=${status}`],
    Labels: labels,
    ExposedPorts: { "3000/tcp": {} },
    HostConfig: { Binds: [`${volumeName}:/app/data`], RestartPolicy: { Name: "unless-stopped" } },
  });
  await docker("POST", `/containers/${encodeURIComponent(containerName)}/start`);
  db.prepare("UPDATE tenants SET container_name=?,volume_name=?,status=?,last_error=NULL,updated_at=? WHERE id=?")
    .run(containerName, volumeName, status, new Date().toISOString(), tenant.id);
}

async function processJob(job) {
  const tenant = db.prepare("SELECT * FROM tenants WHERE id=?").get(job.tenant_id);
  if (!tenant) throw new Error("Cliente não encontrado.");
  if (job.action === "remove") { await removeContainer(`linkponto-${tenant.slug}`); db.prepare("UPDATE tenants SET status='cancelled',updated_at=? WHERE id=?").run(new Date().toISOString(), tenant.id); return; }
  const status = job.action === "suspend" ? "suspended" : "active";
  await reconcile(tenant, status);
}

async function tick() {
  if (!schemaReady()) return;
  const job = db.prepare("SELECT * FROM provision_jobs WHERE status='queued' ORDER BY id LIMIT 1").get();
  if (!job) return;
  const now = new Date().toISOString();
  db.prepare("UPDATE provision_jobs SET status='running',attempts=attempts+1,started_at=? WHERE id=?").run(now, job.id);
  try { await processJob(job); db.prepare("UPDATE provision_jobs SET status='done',finished_at=?,error=NULL WHERE id=?").run(new Date().toISOString(), job.id); }
  catch (error) { const message = error instanceof Error ? error.message : String(error); db.prepare("UPDATE provision_jobs SET status='failed',finished_at=?,error=? WHERE id=?").run(new Date().toISOString(), message.slice(0, 2000), job.id); db.prepare("UPDATE tenants SET last_error=?,updated_at=? WHERE id=?").run(message.slice(0, 1000), new Date().toISOString(), job.tenant_id); }
}

function enqueueExpiredTenants() {
  if (!schemaReady()) return;
  const today = new Date().toISOString().slice(0, 10);
  const expired = db.prepare(`
    SELECT t.id FROM tenants t
    JOIN plans p ON p.id=t.plan_id
    WHERE t.status IN ('active','past_due')
      AND t.paid_until IS NOT NULL
      AND date(t.paid_until, '+' || p.grace_days || ' days') < date(?)
      AND NOT EXISTS (
        SELECT 1 FROM provision_jobs j
        WHERE j.tenant_id=t.id AND j.action='suspend' AND j.status IN ('queued','running')
      )
  `).all(today);
  const now = new Date().toISOString();
  const add = db.prepare("INSERT INTO provision_jobs (tenant_id,action,status,created_at) VALUES (?,'suspend','queued',?)");
  const mark = db.prepare("UPDATE tenants SET status='past_due',updated_at=? WHERE id=?");
  for (const tenant of expired) { mark.run(now, tenant.id); add.run(tenant.id, now); }
}

console.log("LinkPonto provisioner iniciado.");
setInterval(enqueueExpiredTenants, 60_000);
setInterval(() => void tick(), 3000);
enqueueExpiredTenants();
void tick();
