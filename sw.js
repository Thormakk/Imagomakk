var VERSION = "imagomakk-2026-11-26-105";

var BASE = "imagomakk-base-" + VERSION, PESADO = "imagomakk-pesado-22";

var ESENCIAL = [ "./", "css/imagomakk.css", "js/i18n.js", "js/contenido.js", "js/motor.js", "js/herramientas.js", "js/sobre-foto.js", "js/herramientas2.js", "js/hojas.js", "js/abrir.js", "js/app.js", "vendor/fflate.min.js", "img/icono.svg", "img/tema-sol.png", "img/tema-luna.png", "img/thormakk.png", "fuentes/instrument-serif-latin-400-normal.woff2", "fuentes/instrument-serif-latin-400-italic.woff2", "fuentes/inter-latin-400-normal.woff2", "fuentes/inter-latin-500-normal.woff2", "fuentes/inter-latin-600-normal.woff2" ];

var LIVIANOS = [ "js/trabajador/trabajador.js", "js/trabajador/chunk-3RNHDNP5.js", "js/trabajador/mozjpeg_enc.wasm", "js/trabajador/squoosh_oxipng-4SQ6MJFO.js", "js/trabajador/squoosh_oxipng-5KT2FHQF.js", "js/trabajador/squoosh_oxipng_bg.wasm", "js/trabajador/webp_enc-OSX2N4A3.js", "js/trabajador/webp_enc.wasm", "js/trabajador/webp_enc_simd-P2UFCFTW.js", "js/trabajador/webp_enc_simd.wasm", "js/trabajador/UTIF-KMRCYNQB.js", "js/trabajador/imagetracer_v1.2.6-BEI7K4DL.js" ];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(BASE).then(function(c) {
    return c.addAll(ESENCIAL);
  }).then(function() {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) {
      return k.indexOf("imagomakk-base-") === 0 && k !== BASE || k.indexOf("imagomakk-pesado-") === 0 && k !== PESADO;
    }).map(function(k) {
      return caches.delete(k);
    }));
  }).then(function() {
    return self.clients.claim();
  }));
});

var entregas = {};

self.addEventListener("message", function(e) {
  var d = e.data || {}, p = e.ports && e.ports[0];
  if (d.tipo === "imagomakk-livianos") {
    e.waitUntil(caches.open(PESADO).then(function(c) {
      return Promise.all(LIVIANOS.map(function(u) {
        return c.match(u).then(function(g) {
          return g || c.add(u).catch(function() {});
        });
      }));
    }).then(function() {
      if (p) p.postMessage({
        ok: true
      });
    }));
  } else if (d.tipo === "imagomakk-guardar") {
    var fin, espera = new Promise(function(r) {
      fin = r;
    });
    entregas[d.clave] = {
      archivos: d.archivos || [],
      fin: fin
    };
    setTimeout(function() {
      if (entregas[d.clave]) {
        delete entregas[d.clave];
        fin();
      }
    }, 3e4);
    if (p) p.postMessage({
      ok: true
    });
    e.waitUntil(espera);
  } else if (d.tipo === "imagomakk-pedir" || d.tipo === "imagomakk-soltar") {
    var x = entregas[d.clave];
    delete entregas[d.clave];
    if (p) p.postMessage({
      archivos: d.tipo === "imagomakk-pedir" && x ? x.archivos : []
    });
    if (x) x.fin();
  }
});

self.addEventListener("fetch", function(e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  var ruta = u.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (/^(api|admin)(\/|$)/.test(ruta)) return;
  if (/^(vendor|js\/trabajador)\//.test(ruta)) {
    e.respondWith(caches.open(PESADO).then(function(c) {
      return c.match(r).then(function(g) {
        return g || fetch(r).then(function(resp) {
          if (resp.ok && resp.status === 200) c.put(r, resp.clone());
          return resp;
        });
      });
    }));
    return;
  }
  e.respondWith(fetch(r).then(function(resp) {
    if (resp.ok && resp.status === 200) {
      var copia = resp.clone();
      caches.open(BASE).then(function(c) {
        c.put(r, copia);
      });
    }
    return resp;
  }, function() {
    return caches.match(r, {
      ignoreSearch: true
    }).then(function(g) {
      return g || (r.mode === "navigate" ? caches.match(new URL("./", self.registration.scope).href) : undefined);
    });
  }));
});