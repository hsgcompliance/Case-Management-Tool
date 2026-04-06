//tollbelt/lib/http.mjs
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function createHttp(cfg) {
  const H = {
    "Authorization": `Bearer ${cfg.tokens.id}`,
    "X-Firebase-AppCheck": cfg.tokens.app,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };
  const errLog = path.join(cfg.OUT, "harvest", "logs", `http-errors-${Date.now()}.log`);

  async function logError(record) {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n";
    await fs.mkdir(path.dirname(errLog), { recursive: true });
    await fs.appendFile(errLog, line).catch(()=>{});
  }

  function urlFor(pathname, query) {
    const u = new URL(`${cfg.base}/${pathname}`);
    if (query) Object.entries(query).forEach(([k,v]) => v!=null && u.searchParams.set(k, String(v)));
    return u;
  }

  async function http(method, pathname, { query, body, headers } = {}) {
    const url = urlFor(pathname, query);
    const init = { method, headers: { ...H, ...(headers||{}) } };
    if (body !== undefined) init.body = JSON.stringify(body);

    try {
      const resp = await fetch(url, init);
      const text = await resp.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }

      if (!resp.ok) {
        const rec = { ok:false, status:resp.status, method, url:String(url), payload:body, response:data };
        await logError(rec);
        return rec;
      }
      return data;
    } catch (e) {
      const rec = { ok:false, status:-1, method, url:String(url), error:String(e) };
      await logError(rec);
      return rec;
    }
  }

  async function postIdem(pathname, body, opts={}) {
    const key = `cli-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    return http("POST", pathname, { ...opts, body, headers: { ...(opts.headers||{}), "idempotency-key": key } });
  }

  return { http, postIdem };
}
