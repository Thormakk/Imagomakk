const MAX_MENSAJE = 4e3, MAX_CORREO = 200, MAX_CORTO = 80, MAX_OPCIONES = 600;

let tablasListas = false;

async function tablas(db) {
  if (tablasListas) return;
  await db.batch([ db.prepare("CREATE TABLE IF NOT EXISTS mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, tipo TEXT NOT NULL, herramienta TEXT, causa TEXT, mensaje TEXT NOT NULL, correo TEXT)"), db.prepare("CREATE TABLE IF NOT EXISTS uso (dia TEXT NOT NULL, herramienta TEXT NOT NULL, accion TEXT NOT NULL, resultado TEXT NOT NULL, opciones TEXT NOT NULL, cantidad TEXT NOT NULL, tamano TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, herramienta, accion, resultado, opciones, cantidad, tamano))") ]);
  tablasListas = true;
}

const json = (o, estado = 200) => new Response(JSON.stringify(o), {
  status: estado,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

const corto = (v, max = MAX_CORTO) => typeof v === "string" ? v.trim().slice(0, max) : "";

const mismoSitio = req => {
  const o = req.headers.get("origin");
  return !o || o === new URL(req.url).origin;
};

const hoy = () => (new Date).toISOString().slice(0, 10);

async function leerJson(req) {
  if (+(req.headers.get("content-length") || 0) > 2e4) return null;
  try {
    return JSON.parse(await req.text());
  } catch (e) {
    return null;
  }
}

async function turnstileOk(env, token) {
  if (!env.TURNSTILE_SECRETO) return true;
  if (!token) return false;
  const f = new FormData;
  f.append("secret", env.TURNSTILE_SECRETO);
  f.append("response", token);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: f
    });
    return !!(await r.json()).success;
  } catch (e) {
    return false;
  }
}

async function mensaje(req, env) {
  const d = await leerJson(req);
  if (!d) return json({
    ok: false
  }, 400);
  const texto = typeof d.mensaje === "string" ? d.mensaje.trim().slice(0, MAX_MENSAJE) : "";
  const correo = corto(d.correo, MAX_CORREO);
  if (!texto) return json({
    ok: false,
    error: "vacio"
  }, 400);
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return json({
    ok: false,
    error: "correo"
  }, 400);
  if (!await turnstileOk(env, d.token)) return json({
    ok: false,
    error: "verificacion"
  }, 403);
  await tablas(env.DB);
  await env.DB.prepare("INSERT INTO mensajes (fecha, tipo, herramienta, causa, mensaje, correo) VALUES (?, ?, ?, ?, ?, ?)").bind((new Date).toISOString(), d.tipo === "te-sirvio" ? "te-sirvio" : "escribinos", corto(d.herramienta) || null, corto(d.causa) || null, texto, correo || null).run();
  return json({
    ok: true
  });
}

const RANGOS = [ "", "1", "2-5", "6-20", "21+", "<1 MB", "1-10 MB", "10-50 MB", "50 MB+" ];

async function contar(req, env) {
  const d = await leerJson(req);
  if (!d) return new Response(null, {
    status: 400
  });
  const h = corto(d.herramienta), a = corto(d.accion), r = corto(d.resultado);
  if (!/^[a-z0-9-]+$/.test(h) || !/^[a-z-]+$/.test(a) || !/^[a-z0-9:-]+$/.test(r)) return new Response(null, {
    status: 400
  });
  const c = RANGOS.includes(d.cantidad) ? d.cantidad : "", t = RANGOS.includes(d.tamano) ? d.tamano : "";
  await tablas(env.DB);
  await env.DB.prepare("INSERT INTO uso (dia, herramienta, accion, resultado, opciones, cantidad, tamano, n) VALUES (?, ?, ?, ?, ?, ?, ?, 1) " + "ON CONFLICT (dia, herramienta, accion, resultado, opciones, cantidad, tamano) DO UPDATE SET n = n + 1").bind(hoy(), h, a, r, corto(d.opciones, MAX_OPCIONES), c, t).run();
  return new Response(null, {
    status: 204
  });
}

const ADMIN_HORAS = 12, ADMIN_MIN = 16;

const enc = new TextEncoder;

const hex = b => [ ...new Uint8Array(b) ].map(x => x.toString(16).padStart(2, "0")).join("");

async function firma(env, texto) {
  const k = await crypto.subtle.importKey("raw", enc.encode(env.ADMIN_CLAVE), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [ "sign" ]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(texto)));
}

function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const claveLista = env => typeof env.ADMIN_CLAVE === "string" && env.ADMIN_CLAVE.length >= ADMIN_MIN;

async function sesionValida(req, env) {
  if (!claveLista(env)) return false;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)admin=(\d+)\.([0-9a-f]{64})/);
  if (!m || +m[1] < Date.now()) return false;
  return iguales(m[2], await firma(env, "admin:" + m[1]));
}

async function claveCorrecta(env, clave) {
  if (!claveLista(env) || typeof clave !== "string") return false;
  return iguales(await firma(env, "x:" + clave), await firma(env, "x:" + env.ADMIN_CLAVE));
}

const paginaEntrar = error => new Response(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">\n<title>Imagomakk</title><style>body{margin:0;background:#F2EFE8;color:#2A2723;font:15px/1.5 system-ui,sans-serif}main{max-width:360px;margin:15vh auto;padding:0 20px}\nlabel{display:block;font-size:13px;color:#6E685E;margin-bottom:6px}input{width:100%;box-sizing:border-box;font:inherit;padding:8px 0;border:0;border-bottom:1px solid #2A2723;background:none;color:inherit;outline:none}\nbutton{margin-top:20px;background:none;border:.5px solid #8A4F0C;color:#8A4F0C;border-radius:6px;padding:6px 16px;font:inherit;cursor:pointer}.error{color:#8A4F0C;font-size:13px}</style></head><body><main>\n<form method="post" action="/admin/entrar"><label for="clave">Clave</label><input id="clave" name="clave" type="password" autocomplete="current-password" autofocus required>\n${error ? '<p class="error">Clave incorrecta.</p>' : ""}<button>Entrar</button></form></main></body></html>`, {
  status: error ? 403 : 200,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex"
  }
});

const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[c]));

async function admin(req, env) {
  const url = new URL(req.url);
  if (!claveLista(env)) return new Response("Falta configurar ADMIN_CLAVE (16 caracteres o más).", {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
  if (req.method === "POST" && url.pathname === "/admin/entrar") {
    if (!mismoSitio(req) || !req.headers.get("origin")) return new Response(null, {
      status: 403
    });
    const clave = (await req.formData()).get("clave");
    if (!await claveCorrecta(env, clave)) {
      await new Promise(r => setTimeout(r, 1e3));
      return paginaEntrar(true);
    }
    const vence = Date.now() + ADMIN_HORAS * 36e5;
    return new Response(null, {
      status: 303,
      headers: {
        location: url.origin + "/admin/",
        "set-cookie": `admin=${vence}.${await firma(env, "admin:" + vence)}; Path=/admin; Max-Age=${ADMIN_HORAS * 3600}; HttpOnly; Secure; SameSite=Strict`
      }
    });
  }
  if (url.pathname === "/admin/salir") return new Response(null, {
    status: 303,
    headers: {
      location: url.origin + "/admin/",
      "set-cookie": "admin=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
    }
  });
  if (!await sesionValida(req, env)) return paginaEntrar(false);
  await tablas(env.DB);
  if (req.method === "POST" && url.pathname === "/admin/borrar") {
    if (!mismoSitio(req) || !req.headers.get("origin")) return new Response(null, {
      status: 403
    });
    const id = +(await req.formData()).get("id");
    if (id) await env.DB.prepare("DELETE FROM mensajes WHERE id = ?").bind(id).run();
    return Response.redirect(url.origin + "/admin/", 303);
  }
  const msj = (await env.DB.prepare("SELECT * FROM mensajes ORDER BY id DESC LIMIT 500").all()).results;
  const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const uso = (await env.DB.prepare("SELECT herramienta, " + "SUM(CASE WHEN accion = 'procesar' AND resultado = 'ok' THEN n ELSE 0 END) AS bien, " + "SUM(CASE WHEN accion = 'procesar' AND resultado LIKE 'error%' THEN n ELSE 0 END) AS mal, " + "SUM(CASE WHEN accion = 'procesar' AND resultado = 'cancelado' THEN n ELSE 0 END) AS cancelados, " + "SUM(CASE WHEN accion = 'te-sirvio' AND resultado = 'si' THEN n ELSE 0 END) AS si, " + "SUM(CASE WHEN accion = 'te-sirvio' AND resultado = 'no' THEN n ELSE 0 END) AS no " + "FROM uso WHERE dia >= ? GROUP BY herramienta ORDER BY bien DESC").bind(desde).all()).results;
  const errores = (await env.DB.prepare("SELECT herramienta, resultado, SUM(n) AS n FROM uso WHERE dia >= ? AND resultado LIKE 'error%' GROUP BY herramienta, resultado ORDER BY n DESC LIMIT 50").bind(desde).all()).results;
  const filasMsj = msj.map(m => `<article><p class="meta">${esc(m.fecha.slice(0, 16).replace("T", " "))} UTC · ${m.tipo === "te-sirvio" ? "“¿Te sirvió?”: No" : "Escribinos"}${m.herramienta ? " · " + esc(m.herramienta) : ""}${m.causa ? " · " + esc(m.causa) : ""}</p>` + `<p class="texto">${esc(m.mensaje)}</p><p class="meta">${m.correo ? `<a href="mailto:${esc(m.correo)}">${esc(m.correo)}</a>` : "Sin correo"}</p>` + `<form method="post" action="/admin/borrar"><input type="hidden" name="id" value="${m.id}"><button>Borrar</button></form></article>`).join("") || "<p>No hay mensajes.</p>";
  const filasUso = uso.map(u => `<tr><td>${esc(u.herramienta)}</td><td>${u.bien}</td><td>${u.mal}</td><td>${u.cancelados}</td><td>${u.si}</td><td>${u.no}</td></tr>`).join("");
  const filasErr = errores.map(e => `<tr><td>${esc(e.herramienta)}</td><td>${esc(e.resultado)}</td><td>${e.n}</td></tr>`).join("");
  const avisos = [ !env.TURNSTILE_SECRETO && "Turnstile no está configurado: el formulario acepta mensajes sin verificación." ].filter(Boolean);
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">\n<title>Imagomakk — mensajes</title><style>body{margin:0;background:#F2EFE8;color:#2A2723;font:15px/1.5 system-ui,sans-serif}main{max-width:900px;margin:0 auto;padding:32px 20px}\nh1{font-weight:400;font-size:28px;margin:0 0 24px}h2{font-size:13px;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;margin:36px 0 12px;border-bottom:1px solid #2A2723;padding-bottom:8px}\narticle{border-bottom:1px solid #DCD6CA;padding:14px 0}.meta{color:#6E685E;font-size:13px;margin:0}.texto{white-space:pre-wrap;margin:6px 0}a{color:#8A4F0C}\nform{margin:6px 0 0}button{background:none;border:0;color:#8A4F0C;cursor:pointer;padding:0;font:inherit;font-size:13px}table{border-collapse:collapse;width:100%}\ntd,th{text-align:left;padding:6px 8px;border-bottom:1px solid #DCD6CA;font-size:14px}th{font-weight:500;color:#6E685E}.aviso{color:#8A4F0C}</style></head><body><main>\n<h1>Imagomakk — mensajes y uso</h1><p class="meta"><a href="/admin/salir">Salir</a></p>${avisos.map(a => `<p class="aviso">${esc(a)}</p>`).join("")}\n<h2>Mensajes (${msj.length})</h2>${filasMsj}\n<h2>Uso de los últimos 30 días</h2><table><tr><th>Herramienta</th><th>Bien</th><th>Con error</th><th>Cancelados</th><th>Te sirvió: sí</th><th>No</th></tr>${filasUso || '<tr><td colspan="6">Sin datos.</td></tr>'}</table>\n<h2>Errores de los últimos 30 días</h2><table><tr><th>Herramienta</th><th>Error</th><th>Veces</th></tr>${filasErr || '<tr><td colspan="3">Sin errores.</td></tr>'}</table>\n</main></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex"
    }
  });
}

function polarApi(env) {
  return (env.POLAR_API || "https://api.polar.sh").replace(/\/$/, "");
}

async function polar(env, ruta, datos) {
  const r = await fetch(polarApi(env) + ruta, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify(Object.assign({
      organization_id: env.POLAR_ORG
    }, datos))
  });
  let d = {};
  try {
    d = await r.json();
  } catch (e) {}
  return {
    status: r.status,
    d: d
  };
}

async function polarOrg(env, ruta) {
  const r = await fetch(polarApi(env) + ruta, {
    headers: {
      authorization: "Bearer " + env.POLAR_TOKEN,
      accept: "application/json"
    }
  });
  if (!r.ok) throw new Error("polar " + r.status);
  return r.json();
}

async function buscarClave(env, clave) {
  for (let pag = 1; pag <= 50; pag++) {
    const d = await polarOrg(env, "/v1/license-keys?organization_id=" + encodeURIComponent(env.POLAR_ORG) + "&limit=100&page=" + pag);
    const k = (d.items || []).find(x => x.key === clave);
    if (k) return k;
    const max = d.pagination && d.pagination.max_page;
    if (!d.items || !d.items.length || max && pag >= max) break;
  }
  return null;
}

function esNuestra(env, lk) {
  return !env.POLAR_BENEFICIO || lk && lk.benefit_id === env.POLAR_BENEFICIO;
}

function textoClave(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function clave(req, env, accion) {
  if (!env.POLAR_ORG) return json({
    ok: false,
    error: "sin-polar"
  }, 503);
  const b = await leerJson(req);
  const k = textoClave(b && b.clave, 200), act = textoClave(b && b.activacion, 100);
  if (accion === "activar") {
    if (!k) return json({
      estado: "invalida"
    });
    const r = await polar(env, "/v1/customer-portal/license-keys/activate", {
      key: k,
      label: textoClave(b.etiqueta, 60) || "Navegador"
    });
    if (r.status === 200) {
      if (!esNuestra(env, r.d.license_key)) {
        await polar(env, "/v1/customer-portal/license-keys/deactivate", {
          key: k,
          activation_id: r.d.id
        });
        return json({
          estado: "invalida"
        });
      }
      return json({
        estado: "activa",
        activacion: r.d.id,
        vence: r.d.license_key && r.d.license_key.expires_at
      });
    }
    if (r.status === 404 || r.status === 422) return json({
      estado: "invalida"
    });
    if (r.status === 403) {
      let lk0 = null;
      try {
        lk0 = await buscarClave(env, k);
      } catch (e) {}
      if (env.POLAR_BENEFICIO && lk0 && !esNuestra(env, lk0)) return json({
        estado: "invalida"
      });
      const det = String(r.d.detail || "");
      if (/expired/i.test(det)) {
        const vence = lk0 && lk0.expires_at;
        return json({
          estado: "vencida",
          vence: vence
        });
      }
      if (/no longer active/i.test(det)) return json({
        estado: "inactiva"
      });
      if (/limit/i.test(det)) {
        const lk = lk0;
        if (!lk) return json({
          estado: "error"
        }, 502);
        const full = await polarOrg(env, "/v1/license-keys/" + encodeURIComponent(lk.id));
        const lista = (full.activations || []).map(a => ({
          id: a.id,
          etiqueta: a.label,
          fecha: a.created_at
        }));
        return json({
          estado: "sin-lugar",
          activaciones: lista
        });
      }
    }
    return json({
      estado: "error"
    }, 502);
  }
  if (!k || !act) return json({
    ok: false,
    vigente: false
  });
  if (accion === "validar") {
    const r = await polar(env, "/v1/customer-portal/license-keys/validate", {
      key: k,
      activation_id: act
    });
    if (r.status === 200) {
      const vence = r.d.expires_at || null;
      const vigente = (r.d.status === undefined || r.d.status === "granted") && esNuestra(env, r.d);
      return json({
        vigente: vigente && !(vence && new Date(vence) <= new Date),
        vence: vence
      });
    }
    if (r.status === 404 || r.status === 422) return json({
      vigente: false
    });
    return json({
      error: "polar"
    }, 502);
  }
  if (accion === "liberar") {
    const r = await polar(env, "/v1/customer-portal/license-keys/deactivate", {
      key: k,
      activation_id: act
    });
    if (r.status === 204 || r.status === 200 || r.status === 404) return json({
      ok: true
    });
    return json({
      ok: false
    }, 502);
  }
  return new Response(null, {
    status: 404
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/admin")) return await admin(req, env);
      if (url.pathname === "/api/config" && req.method === "GET") return json({
        turnstile: env.TURNSTILE_SITIO || null,
        comprar: env.POLAR_COMPRAR || null
      });
      if (url.pathname.startsWith("/api/")) {
        if (req.method !== "POST" || !mismoSitio(req)) return new Response(null, {
          status: 405
        });
        const mc = url.pathname.match(/^\/api\/clave\/(activar|validar|liberar)$/);
        if (mc) return await clave(req, env, mc[1]);
        if (!env.DB) return json({
          ok: false,
          error: "sin-base"
        }, 503);
        if (url.pathname === "/api/mensaje") return await mensaje(req, env);
        if (url.pathname === "/api/contar") return await contar(req, env);
        return new Response(null, {
          status: 404
        });
      }
    } catch (e) {
      return json({
        ok: false,
        error: "servidor"
      }, 500);
    }
    return env.ASSETS.fetch(req);
  }
};