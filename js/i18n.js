(function() {
  var IDIOMAS = [ "cs", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "sk", "sv", "tr", "uk", "zh" ];
  var RAIZ = window.IM_RAIZ || "en";
  var m = location.pathname.match(/^\/([a-z]{2})(\/|$)/);
  var L = m && IDIOMAS.indexOf(m[1]) >= 0 && m[1] !== RAIZ ? m[1] : RAIZ;
  var PRE = L === RAIZ ? "" : "/" + L;
  window.IM_IDIOMAS = IDIOMAS;
  window.IM_RAIZ = RAIZ;
  window.IM_LANG = L;
  window.IM_PRE = PRE;
  var RUTAS = window.IM_RUTAS || {};
  function aEs(l, slug) {
    var m = RUTAS[l] || {};
    for (var k in m) if (m[k] === slug) return k;
    return slug;
  }
  function urlDe(l, ruta) {
    var mm = ruta.match(/^\/([a-z0-9-]*)\/?(.*)$/), slug = mm ? mm[1] : "", resto = mm ? mm[2] : "";
    var loc = slug && RUTAS[l] && RUTAS[l][slug] != null ? RUTAS[l][slug] : slug;
    return (l === RAIZ ? "" : "/" + l) + "/" + (loc ? loc + "/" : "") + resto;
  }
  window.IM_RUTA = function() {
    var p = PRE && location.pathname.indexOf(PRE + "/") === 0 ? location.pathname.slice(PRE.length) : location.pathname;
    var mm = p.match(/^\/([^/]*)\/?(.*)$/);
    if (!mm || !mm[1]) return p;
    return "/" + aEs(L, decodeURIComponent(mm[1])) + "/" + mm[2];
  };
  window.IM_URL = function(ruta) {
    return urlDe(L, ruta);
  };
  window.IM_URL_DE = urlDe;
  var D = window.IM_DIC || {}, MOLDES = [];
  Object.keys(D).forEach(function(k) {
    if (k.indexOf("{0}") < 0) return;
    var partes = k.split(/\{(\d)\}/), re = "^";
    for (var i = 0; i < partes.length; i++) re += i % 2 ? "([\\d.,]+|\\S+?\\.[A-Za-z0-9]{2,5})" : partes[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    MOLDES.push({
      re: new RegExp(re + "$"),
      orden: k.match(/\{\d\}/g).map(function(x) {
        return +x[1];
      }),
      t: D[k]
    });
  });
  function TR(s) {
    if (L === "es" || !s) return s;
    if (Object.prototype.hasOwnProperty.call(D, s)) return D[s];
    for (var i = 0; i < MOLDES.length; i++) {
      var r = s.match(MOLDES[i].re);
      if (!r) continue;
      var t = MOLDES[i].t;
      MOLDES[i].orden.forEach(function(n, j) {
        t = t.split("{" + n + "}").join(r[j + 1]);
      });
      return t;
    }
    return s;
  }
  window.TR = TR;
  window.IM_ES = function(el) {
    if (!el) return "";
    return el.dataset && el.dataset.es != null && el.__trVisto === el.textContent ? el.dataset.es : el.textContent;
  };
  var GRABAR = /[?&]grabar=1/.test(location.search) || window.IM_GRABAR;
  function anotar(s) {
    if (GRABAR && s && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(s) && (L === "es" || TR(s) === s)) (window.__textos = window.__textos || {})[s] = 1;
  }
  var NO = {
    SCRIPT: 1,
    STYLE: 1,
    TEXTAREA: 1,
    CODE: 1,
    SVG: 1,
    CANVAS: 1
  };
  var ATR = [ "placeholder", "title", "aria-label", "alt" ];
  function enlace(a) {
    var h = a.getAttribute("href");
    if (a.__enl === h || !h || h.charAt(0) !== "/" || h.charAt(1) === "/" || /^\/(js|css|img|fuentes|vendor|admin|api)\//.test(h) || a.hasAttribute("hreflang")) return;
    if (/^\/[a-z]{2}(\/|$)/.test(h) && IDIOMAS.indexOf(h.slice(1, 3)) >= 0) return;
    var mm = h.match(/^\/([a-z0-9-]*)\/?(#.*)?$/);
    if (!mm || mm[1] && !(RUTAS.es && mm[1] in RUTAS.es)) return;
    var nuevo = urlDe(L, "/" + (mm[1] ? mm[1] + "/" : "")) + (mm[2] || "");
    a.__enl = nuevo;
    if (nuevo !== h) a.setAttribute("href", nuevo);
  }
  function traducirTexto(n) {
    var p = n.parentNode;
    if (!p || NO[p.nodeName] || p.closest && p.closest("[data-no-traducir], svg, textarea, .texto-caja")) return;
    var raw = n.nodeValue, s = raw.trim();
    if (!s) return;
    anotar(s);
    if (L === "es") return;
    if (n.__tr === raw) return;
    if (p.childNodes.length === 1 && p.dataset) p.dataset.es = s;
    var t = TR(s);
    if (t === s) {
      p.__trVisto = p.textContent;
      return;
    }
    var nuevo = raw.replace(s, t);
    n.__tr = nuevo;
    n.nodeValue = nuevo;
    p.__trVisto = p.textContent;
  }
  function traducirEl(el) {
    if (el.nodeType !== 1 || NO[el.nodeName]) return;
    if (el.closest && el.closest("[data-no-traducir]")) return;
    for (var i = 0; i < ATR.length; i++) {
      var v = el.getAttribute(ATR[i]);
      if (!v) continue;
      anotar(v);
      if (L !== "es" && el["__a" + i] !== v) {
        var t = TR(v);
        if (t !== v) {
          el["__a" + i] = t;
          el.setAttribute(ATR[i], t);
        }
      }
    }
    if (el.nodeName === "INPUT" && /^(button|submit)$/.test(el.type) && el.value) {
      anotar(el.value);
      if (L !== "es") el.value = TR(el.value);
    }
    if (el.nodeName === "A") enlace(el);
  }
  function recorrer(raiz) {
    if (raiz.nodeType === 3) {
      traducirTexto(raiz);
      return;
    }
    if (raiz.nodeType !== 1 || NO[raiz.nodeName]) return;
    traducirEl(raiz);
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function(x) {
        return x.nodeType === 1 && NO[x.nodeName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var x;
    while (x = w.nextNode()) {
      if (x.nodeType === 3) traducirTexto(x); else traducirEl(x);
    }
  }
  var NOMBRES = {
    cs: "Čeština",
    de: "Deutsch",
    en: "English",
    es: "Español",
    fr: "Français",
    hi: "हिन्दी",
    id: "Bahasa Indonesia",
    it: "Italiano",
    ja: "日本語",
    ko: "한국어",
    nl: "Nederlands",
    pl: "Polski",
    pt: "Português",
    ru: "Русский",
    sk: "Slovenčina",
    sv: "Svenska",
    tr: "Türkçe",
    uk: "Українська",
    zh: "中文"
  };
  function selector() {
    var b = document.getElementById("boton-idioma"), lista = document.getElementById("lista-idiomas"), caja = document.getElementById("idioma-sel");
    if (!b || !lista) return;
    var ruta = window.IM_RUTA();
    b.innerHTML = '<img class="bandera" src="/img/banderas/' + L + '.svg" alt="" width="18" height="18"><span class="idioma-cod">' + L.toUpperCase() + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    b.setAttribute("aria-label", NOMBRES[L]);
    lista.innerHTML = IDIOMAS.map(function(l) {
      var href = urlDe(l, ruta);
      return '<a href="' + href + '" hreflang="' + l + '" lang="' + l + '"' + (l === L ? ' aria-current="true" class="actual"' : "") + '><img class="bandera" src="/img/banderas/' + l + '.svg" alt="" width="18" height="18"><span>' + NOMBRES[l] + "</span></a>";
    }).join("");
    lista.querySelectorAll("a").forEach(function(a) {
      a.addEventListener("click", function() {
        try {
          localStorage.setItem("imagomakk-idioma", a.getAttribute("hreflang"));
        } catch (e) {}
      });
    });
    var abrir = function(si) {
      b.setAttribute("aria-expanded", String(si));
      if (si) {
        lista.hidden = false;
        requestAnimationFrame(function() {
          caja.classList.add("abierto");
        });
      } else {
        caja.classList.remove("abierto");
        setTimeout(function() {
          if (!caja.classList.contains("abierto")) lista.hidden = true;
        }, 460);
      }
    };
    b.addEventListener("click", function(e) {
      e.stopPropagation();
      abrir(!caja.classList.contains("abierto"));
    });
    document.addEventListener("click", function(e) {
      if (!caja.contains(e.target) && caja.classList.contains("abierto")) abrir(false);
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && caja.classList.contains("abierto")) {
        abrir(false);
        b.focus();
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", selector); else selector();
  window.IM_TRADUCIR = recorrer;
  if (L === "es" && !GRABAR && !Object.keys(RUTAS).length) return;
  var obs = new MutationObserver(function(lista) {
    lista.forEach(function(mu) {
      if (mu.type === "characterData") traducirTexto(mu.target); else if (mu.type === "attributes") traducirEl(mu.target); else mu.addedNodes.forEach(recorrer);
    });
  });
  function empezar() {
    recorrer(document.body);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATR.concat([ "href" ])
    });
  }
  if (document.body) empezar(); else document.addEventListener("DOMContentLoaded", empezar);
  if (L !== "es") document.addEventListener("DOMContentLoaded", function() {
    document.title = document.title.split(" — ").map(TR).join(" — ");
  });
})();