(function() {
  "use strict";
  var C = window.IMAGOMAKK;
  var raiz = document.documentElement;
  var $ = function(s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function(s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function(c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      }[c];
    });
  }
  $("#boton-tema").addEventListener("click", function() {
    var t = raiz.dataset.tema === "tinta" ? "papel" : "tinta";
    raiz.dataset.tema = t;
    try {
      localStorage.setItem("imagomakk-tema", t);
    } catch (e) {}
  });
  var archivos = [], siguienteId = 1;
  var zona = $("#zona"), lista = $("#lista"), selector = $("#selector"), estado = $("#estado"), nota = $("#nota");
  var IMAGEN = /\.(jpe?g|jfif|png|webp|gif|bmp|avif|svg|heic|heif|tiff?|ico|dng|cr2|cr3|crw|nef|nrw|arw|srf|sr2|orf|rw2|raf|pef|srw|3fr|erf|kdc|mrw|x3f|iiq|rwl|mos|dcr)$/i;
  var VIDEO = /\.(mp4|m4v|mov|webm|mkv|ogv)$/i;
  function tipoDe(f) {
    return /^image\//.test(f.type) || IMAGEN.test(f.name) ? "img" : /^video\//.test(f.type) || VIDEO.test(f.name) ? "video" : "otro";
  }
  var NOMBRE_TIPO = {
    img: "imágenes",
    video: "videos",
    otro: "otros archivos"
  };
  function peso(b) {
    var mb = b / 1048576;
    if (b < 1024) return b + " bytes";
    if (b < 10240) return (b / 1024).toLocaleString("es-AR", {
      maximumFractionDigits: 1
    }) + " KB";
    if (mb < 1) return Math.round(b / 1024) + " KB";
    return mb.toLocaleString("es-AR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1
    }) + " MB";
  }
  function agregarArchivo(f) {
    var t = tipoDe(f), raro = t === "img" && IMMotor.formatoRaro(f);
    archivos.push({
      id: siguienteId++,
      file: f,
      tipo: t,
      raro: raro || t === "video",
      url: t === "img" && !raro ? URL.createObjectURL(f) : null
    });
  }
  function agregar(files) {
    files = Array.prototype.slice.call(files);
    var raws = files.filter(function(f) {
      return IMMotor.esRaw(f);
    });
    if (raws.length) {
      var capa = capaEspera(), cancel = false, hechas = [], malas = [];
      capa.alCancelar(function() {
        cancel = true;
      });
      var cad = Promise.resolve();
      raws.forEach(function(f, i) {
        cad = cad.then(function() {
          if (cancel) return;
          capa.texto(raws.length > 1 ? "Abriendo las fotos RAW… " + (i + 1) + " de " + raws.length + "." : "Abriendo la foto RAW…");
          return IMMotor.abrirRaw(f).then(function(j) {
            if (!cancel) hechas.push([ f, j ]);
          }, function() {
            malas.push(f.name);
          });
        });
      });
      cad.then(function() {
        capa.cerrar();
        var fin = files.map(function(f) {
          if (!IMMotor.esRaw(f)) return f;
          var x = hechas.filter(function(h) {
            return h[0] === f;
          })[0];
          return x ? x[1] : null;
        }).filter(Boolean);
        if (fin.length) agregarYa(fin);
        if (malas.length) aviso(malas.join(", ") + ": este navegador no puede abrir ese formato de imagen.");
      });
      return;
    }
    agregarYa(files);
  }
  var esperas = null, juntar = null;
  function esperarPrevia(p) {
    if (esperas) esperas.push(p);
  }
  function junto(fn) {
    if (juntar) juntar.push(fn); else fn();
  }
  function agregarYa(files) {
    var vacia = !archivos.length;
    if (!(herrActual && herrActual.conPrevia)) {
      altoSuave(zona, function() {
        Array.prototype.forEach.call(files, agregarArchivo);
        pintar();
        lista.scrollTop = lista.scrollHeight;
      }, vacia);
      miniaturasRaras();
      return;
    }
    esperas = [];
    juntar = juntar || [];
    Array.prototype.forEach.call(files, agregarArchivo);
    try {
      avisarArchivos();
    } finally {
      var ps = esperas;
      esperas = null;
    }
    var tope = new Promise(function(r) {
      setTimeout(r, 2e3);
    });
    Promise.race([ Promise.all(ps.map(function(p) {
      return Promise.resolve(p).catch(function() {});
    })), tope ]).then(function() {
      var cola = juntar || [];
      juntar = null;
      altoSuave(zona, function() {
        sinAvisar = true;
        try {
          pintar();
        } finally {
          sinAvisar = false;
        }
        lista.scrollTop = lista.scrollHeight;
        cola.forEach(function(f) {
          f();
        });
      }, vacia);
      miniaturasRaras();
    });
  }
  var abriendo = false;
  function miniaturasRaras() {
    if (abriendo) return;
    var pend = archivos.filter(function(a) {
      return a.raro && !a.url && !a.fallo;
    });
    if (!pend.length) return;
    abriendo = true;
    var cadena = Promise.resolve();
    pend.forEach(function(a) {
      cadena = cadena.then(function() {
        if (archivos.indexOf(a) < 0) return;
        if (a.tipo === "video") return miniaturaVideo(a.file, 96).then(function(url) {
          a.url = url;
        }, function() {
          a.fallo = true;
          aviso(a.file.name + ": este navegador no puede abrir ese video.");
        });
        return IMMotor.miniatura(a.file, 96).then(function(url) {
          a.url = url;
        }, function() {
          a.fallo = true;
          aviso(a.file.name + ": este navegador no puede abrir ese formato de imagen.");
        });
      });
    });
    cadena.then(function() {
      abriendo = false;
      pintar();
    });
  }
  function miniaturaVideo(f, lado) {
    return new Promise(function(ok, mal) {
      var v = document.createElement("video"), url = URL.createObjectURL(f), listo = false;
      var fin = function(r, e) {
        if (listo) return;
        listo = true;
        URL.revokeObjectURL(url);
        v.removeAttribute("src");
        v.load();
        if (e) mal(e); else ok(r);
      };
      v.muted = true;
      v.preload = "auto";
      v.playsInline = true;
      v.onerror = function() {
        fin(null, {
          codigo: "video"
        });
      };
      v.onloadedmetadata = function() {
        v.currentTime = Math.min(.5, (v.duration || 1) / 3);
      };
      v.onseeked = function() {
        var e = Math.min(1, lado * 2 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(v.videoWidth * e));
        c.height = Math.max(1, Math.round(v.videoHeight * e));
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(function(b) {
          fin(b ? URL.createObjectURL(b) : null, b ? null : {
            codigo: "video"
          });
        }, "image/jpeg", .8);
      };
      setTimeout(function() {
        fin(null, {
          codigo: "video"
        });
      }, 15e3);
      v.src = url;
    });
  }
  window.IM_MINIATURA_VIDEO = miniaturaVideo;
  function capaEspera(conCancelar) {
    var capa = document.createElement("div");
    capa.className = "procesando";
    capa.setAttribute("role", "alertdialog");
    capa.setAttribute("aria-live", "polite");
    capa.innerHTML = '<div class="proc-caja"><span class="spinner" aria-hidden="true"></span><p class="proc-texto"></p>' + (conCancelar === false ? "" : '<button type="button" class="boton-borde">Cancelar</button>') + "</div>";
    document.body.appendChild(capa);
    requestAnimationFrame(function() {
      capa.classList.add("visible");
    });
    return {
      texto: function(t) {
        $(".proc-texto", capa).textContent = t;
      },
      alCancelar: function(f) {
        var b = $("button", capa);
        if (b) b.addEventListener("click", f);
      },
      cerrar: function() {
        capa.classList.remove("visible");
        setTimeout(function() {
          capa.remove();
        }, QUIETO ? 0 : DUR);
      }
    };
  }
  function quitar(id) {
    var fin = function() {
      archivos = archivos.filter(function(a) {
        if (a.id === id && a.url) URL.revokeObjectURL(a.url);
        return a.id !== id;
      });
      soltarCopiaOrig(id);
    };
    var li = $('li[data-id="' + id + '"]', lista);
    if (archivos.length > 1 && li) {
      var sig = li.nextElementSibling ? li.nextElementSibling.dataset.id : null, copia = li.cloneNode(true);
      fin();
      pintar();
      var antes = sig != null ? $('li[data-id="' + sig + '"]', lista) : null;
      copia.removeAttribute("data-id");
      copia.style.pointerEvents = "none";
      lista.insertBefore(copia, antes);
      contraer(copia, function() {
        copia.remove();
      });
      return;
    }
    altoSuave(zona, function() {
      fin();
      pintar();
    }, true);
  }
  var MANIJA = '<svg viewBox="0 0 14 18" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.5"/><circle cx="10" cy="4" r="1.5"/><circle cx="4" cy="9" r="1.5"/><circle cx="10" cy="9" r="1.5"/><circle cx="4" cy="14" r="1.5"/><circle cx="10" cy="14" r="1.5"/></svg>';
  function mini(a) {
    var m;
    if (a.url) {
      m = document.createElement("img");
      m.src = a.url;
      m.alt = "";
    } else {
      m = document.createElement("span");
      m.textContent = (a.file.name.split(".").pop() || "").slice(0, 4).toUpperCase();
    }
    m.className = "mini";
    return m;
  }
  var elegidoId = null, conVisor = false, oyentesElegir = [];
  function marcarElegido() {
    var marcar = conVisor && archivos.length > 1;
    $$("li", lista).forEach(function(li) {
      var si = marcar && +li.dataset.id === elegidoId;
      li.classList.toggle("elegido", si);
      li.classList.toggle("elegible", marcar);
      if (marcar) {
        li.tabIndex = 0;
        if (si) li.setAttribute("aria-current", "true"); else li.removeAttribute("aria-current");
      } else {
        li.removeAttribute("tabindex");
        li.removeAttribute("aria-current");
      }
    });
  }
  function verRenglon(id) {
    var li = $$("li", lista).filter(function(x) {
      return +x.dataset.id === id;
    })[0];
    if (!li) return;
    var arriba = li.offsetTop, abajo = arriba + li.offsetHeight;
    if (arriba < lista.scrollTop) lista.scrollTo({
      top: arriba,
      behavior: QUIETO ? "auto" : "smooth"
    }); else if (abajo > lista.scrollTop + lista.clientHeight) lista.scrollTo({
      top: abajo - lista.clientHeight,
      behavior: QUIETO ? "auto" : "smooth"
    });
  }
  function elegirArchivo(id) {
    if (elegidoId === id) return;
    elegidoId = id;
    marcarElegido();
    verRenglon(id);
    if (tanda) {
      var k = tanda.findIndex(function(x) {
        return x.origen === id;
      });
      if (k >= 0) {
        var n = nPosible(tanda.length);
        tandaUno = k;
        tandaLote = Math.floor(k / n) * n;
        cambiarAlto($("#galeria"), pintarTanda);
      }
    }
    oyentesElegir.forEach(function(f) {
      f();
    });
  }
  var etiquetaFn = null;
  function pintarEtiquetas() {
    $$("li", lista).forEach(function(li) {
      var a = archivos.filter(function(x) {
        return x.id === +li.dataset.id;
      })[0], et = $(".etiqueta", li);
      var e = a && etiquetaFn ? etiquetaFn(a) : null;
      et.innerHTML = e ? esc(e.texto) + (e.accion ? ' · <button type="button" class="volver-general">' + esc(e.accion) + "</button>" : "") : "";
      if (e && e.accion) $(".volver-general", et).addEventListener("click", function(ev) {
        ev.stopPropagation();
        e.alTocar();
      });
    });
  }
  lista.addEventListener("click", function(e) {
    if (!conVisor || e.target.closest(".quitar, .manija, .etiqueta")) return;
    var li = e.target.closest("li");
    if (li) elegirArchivo(+li.dataset.id);
  });
  lista.addEventListener("keydown", function(e) {
    if (!conVisor || e.key !== "Enter" && e.key !== " ") return;
    var li = e.target.closest("li");
    if (li && e.target === li) {
      e.preventDefault();
      elegirArchivo(+li.dataset.id);
    }
  });
  function pintar() {
    var previo = lista.scrollTop;
    if (!archivos.some(function(a) {
      return a.id === elegidoId;
    })) elegidoId = archivos.length ? archivos[0].id : null;
    lista.innerHTML = "";
    archivos.forEach(function(a, i) {
      var li = document.createElement("li");
      li.draggable = true;
      li.dataset.id = a.id;
      li.innerHTML = '<span class="manija" title="Arrastrar para cambiar el orden">' + MANIJA + '<span class="num">' + (i + 1) + "</span></span>";
      li.appendChild(mini(a));
      var nom = document.createElement("span");
      nom.className = "nombre";
      nom.textContent = a.file.name;
      li.appendChild(nom);
      var et = document.createElement("span");
      et.className = "etiqueta";
      li.appendChild(et);
      var pe = document.createElement("span");
      pe.className = "peso";
      pe.textContent = peso(a.file.size);
      li.appendChild(pe);
      var q = document.createElement("button");
      q.type = "button";
      q.className = "quitar";
      q.textContent = "Quitar";
      q.setAttribute("aria-label", "Quitar " + a.file.name);
      q.addEventListener("click", function() {
        quitar(a.id);
      });
      li.appendChild(q);
      lista.appendChild(li);
    });
    zona.classList.toggle("con-archivos", archivos.length > 0);
    var qt = $("#quitar-todos"), uno = archivos.length < 2;
    qt.classList.toggle("oculto", uno);
    qt.tabIndex = uno ? -1 : 0;
    if (uno) qt.setAttribute("aria-hidden", "true"); else qt.removeAttribute("aria-hidden");
    marcarElegido();
    pintarEtiquetas();
    if (herrActual && herrActual.marcarLista) herrActual.marcarLista(lista);
    lista.classList.toggle("desborda", lista.scrollHeight > lista.clientHeight);
    lista.scrollTop = previo;
    actualizarEstado();
    marcarGrilla();
    ubicarAnuncio();
    if (!sinAvisar) avisarArchivos();
  }
  var sinAvisar = false;
  var arrastrandoId = null;
  lista.addEventListener("dragstart", function(e) {
    var li = e.target.closest("li");
    if (!li) return;
    arrastrandoId = +li.dataset.id;
    li.classList.add("arrastrado");
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", "imagomakk-orden");
    } catch (x) {}
  });
  lista.addEventListener("dragover", function(e) {
    if (arrastrandoId === null) return;
    e.preventDefault();
    var li = e.target.closest("li");
    $$("li", lista).forEach(function(x) {
      x.classList.toggle("destino", x === li);
    });
  });
  lista.addEventListener("drop", function(e) {
    if (arrastrandoId === null) return;
    e.preventDefault();
    e.stopPropagation();
    var li = e.target.closest("li");
    if (li) {
      var desde = archivos.findIndex(function(a) {
        return a.id === arrastrandoId;
      });
      var hacia = archivos.findIndex(function(a) {
        return a.id === +li.dataset.id;
      });
      archivos.splice(hacia, 0, archivos.splice(desde, 1)[0]);
    }
    arrastrandoId = null;
    pintar();
  });
  lista.addEventListener("dragend", function() {
    arrastrandoId = null;
    pintar();
  });
  function esArchivos(e) {
    return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0;
  }
  [ "dragenter", "dragover" ].forEach(function(ev) {
    document.addEventListener(ev, function(e) {
      if (!esArchivos(e)) return;
      e.preventDefault();
      zona.classList.add("arrastrando");
    });
  });
  document.addEventListener("dragleave", function(e) {
    if (!e.relatedTarget) zona.classList.remove("arrastrando");
  });
  document.addEventListener("drop", function(e) {
    if (!esArchivos(e)) return;
    e.preventDefault();
    zona.classList.remove("arrastrando");
    var items = e.dataTransfer.items, entradas = [];
    if (items && items.length && items[0].webkitGetAsEntry) for (var i = 0; i < items.length; i++) {
      var en = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
      if (en) entradas.push(en);
    }
    if (!entradas.some(function(x) {
      return x.isDirectory;
    })) {
      agregar(e.dataTransfer.files);
      return;
    }
    Promise.all(entradas.map(leerEntrada)).then(function(l) {
      agregar([].concat.apply([], l));
    });
  });
  var porNombre = new Intl.Collator("es", {
    numeric: true,
    sensitivity: "base"
  });
  function leerEntrada(en) {
    if (en.isFile) return new Promise(function(ok) {
      en.file(function(f) {
        ok([ f ]);
      }, function() {
        ok([]);
      });
    });
    if (!en.isDirectory) return Promise.resolve([]);
    var lector = en.createReader(), todas = [];
    return new Promise(function(ok) {
      (function leer() {
        lector.readEntries(function(t) {
          if (!t.length) {
            todas.sort(function(a, b) {
              return porNombre.compare(a.name, b.name);
            });
            Promise.all(todas.map(leerEntrada)).then(function(l) {
              ok([].concat.apply([], l));
            });
          } else {
            todas = todas.concat(Array.prototype.slice.call(t));
            leer();
          }
        }, function() {
          ok([]);
        });
      })();
    });
  }
  document.addEventListener("paste", function(e) {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    var fs = Array.prototype.filter.call(e.clipboardData && e.clipboardData.files || [], function(f) {
      return tipoDe(f) === "img";
    });
    if (!fs.length) return;
    e.preventDefault();
    agregar(fs.map(function(f, i) {
      return f.name && f.name !== "image.png" ? f : new File([ f ], "pegada-" + (i + 1) + "." + (f.type.split("/")[1] || "png").replace("jpeg", "jpg"), {
        type: f.type
      });
    }));
  });
  $$("[data-elegir]").forEach(function(b) {
    b.addEventListener("click", function() {
      selector.click();
    });
  });
  selector.addEventListener("change", function() {
    agregar(selector.files);
    selector.value = "";
  });
  $("#quitar-todos").addEventListener("click", function() {
    altoSuave(zona, function() {
      archivos.forEach(function(a) {
        if (a.url) URL.revokeObjectURL(a.url);
        soltarCopiaOrig(a.id);
      });
      archivos = [];
      pintar();
    }, true);
  });
  function motivo(slug) {
    var h = C.herramientas[slug];
    if (!h || h.externa || !archivos.length) return "";
    var fuera = archivos.filter(function(a) {
      return h.acepta.indexOf(a.tipo) < 0;
    });
    if (fuera.length) return h.nombre + " recibe solo " + h.acepta.map(function(t) {
      return NOMBRE_TIPO[t];
    }).join(", ") + ": " + fuera.map(function(a) {
      return a.file.name;
    }).join(", ") + (fuera.length > 1 ? " no entran." : " no entra.");
    if (h.minimo && archivos.length < h.minimo) return h.nombre + " trabaja con " + h.minimo + " imágenes o más. Soltaste " + archivos.length + ".";
    return "";
  }
  function aptos(slug) {
    var h = C.herramientas[slug];
    if (!h || !h.acepta) return archivos.slice();
    return archivos.filter(function(a) {
      return h.acepta.indexOf(a.tipo) >= 0;
    });
  }
  function aptosAlcanzan(slug) {
    var h = C.herramientas[slug] || {}, n = aptos(slug).length;
    return n > 0 && (!h.minimo || n >= h.minimo);
  }
  var botonQuiere = true, soloAptos = false;
  function ponerBoton() {
    var b = $("#procesar");
    if (b && ruta.tipo === "herramienta") b.disabled = !(botonQuiere && archivos.length && aptosAlcanzan(ruta.slug));
    botonNumero();
  }
  var PLURALES = {
    "foto-carnet-y-pasaporte": {
      "Preparar foto": "Preparar fotos"
    },
    "crear-meme": {
      "Crear meme": "Crear memes"
    },
    "video-a-gif": {
      "Crear GIF": "Crear GIFs"
    },
    "tomar-colores-de-una-imagen": {
      "Descargar la paleta": "Descargar las paletas"
    },
    "crear-favicon": {
      "Crear favicon": "Crear favicons"
    }
  };
  function botonNumero() {
    var b = $("#procesar");
    if (!b || ruta.tipo !== "herramienta") return;
    var PLURAL = PLURALES[ruta.slug] || {}, SINGULAR = {};
    Object.keys(PLURAL).forEach(function(k) {
      SINGULAR[PLURAL[k]] = k;
    });
    var ahora = IM_ES(b), sing = SINGULAR[ahora] || ahora;
    if (!PLURAL[sing]) return;
    if (window.TR && TR(PLURAL[sing]) === PLURAL[sing] && TR(sing) !== sing) return;
    var quiere = aptos(ruta.slug).length > 1 ? PLURAL[sing] : sing;
    if (quiere !== ahora) IM.botonTexto(quiere);
  }
  function marcarGrilla() {
    if (usando) return marcarParaUsar();
    $("#nota-usar").hidden = true;
    var hay = archivos.length > 0;
    nota.hidden = !hay;
    $$(".motivo", $("#grilla")).forEach(function(m) {
      m.remove();
    });
    $$("#grilla .herr").forEach(function(a) {
      if (a.classList.contains("externa")) return;
      var m = hay ? motivo(a.dataset.slug) : "";
      a.classList.toggle("marcada", hay && !m);
      a.classList.toggle("gris", hay && !!m);
      a.dataset.motivo = m;
      if (m) a.setAttribute("aria-disabled", "true"); else a.removeAttribute("aria-disabled");
    });
    marcarActual();
    pintarSugeridas();
  }
  var sugeridas = $("#sugeridas");
  function pintarSugeridas() {
    var ver = ruta.tipo === "portada" && archivos.length > 0;
    var html = ver ? $$("#grilla .herr.marcada").concat($$("#grilla .herr.externa"), $$("#grilla .herr.gris")).map(function(a) {
      return a.outerHTML;
    }).join("") : "";
    if (!ver) {
      if (!sugeridas.hidden) contraer(sugeridas, function() {
        sugeridas.hidden = true;
        sugeridas.innerHTML = "";
        sugeridas.style.overflow = "";
      });
      return;
    }
    if (sugeridas.innerHTML === html) return;
    var nuevo = sugeridas.hidden;
    if (nuevo) {
      sugeridas.innerHTML = html;
      sugeridas.hidden = false;
      expandir(sugeridas);
    } else cambiarAlto(sugeridas, function() {
      sugeridas.innerHTML = html;
    });
  }
  sugeridas.addEventListener("click", function(e) {
    var a = e.target.closest(".herr");
    if (!a || !a.dataset.motivo) return;
    e.preventDefault();
    var previo = $(".motivo", sugeridas);
    $$(".motivo", sugeridas).forEach(function(m) {
      quitarSuave(m);
    });
    if (previo && previo.dataset.de === a.dataset.slug) return;
    var todas = $$(".herr", sugeridas), fin = todas[todas.length - 1];
    var p = document.createElement("p");
    p.className = "motivo";
    p.dataset.de = a.dataset.slug;
    p.setAttribute("role", "status");
    p.textContent = a.dataset.motivo;
    fin.insertAdjacentElement("afterend", p);
  });
  var usando = null, pendientesUsar = [];
  (function() {
    var ruta_ = IM_RUTA(), el = null;
    if (ruta_ === "/" || ruta_ === "/index.html") el = $(".cabecera .nav-inicio"); else if (/^\/preguntas-frecuentes\//.test(ruta_)) el = $(".cabecera .nav-faq"); else if (/^\/sin-anuncios\//.test(ruta_)) el = $(".cabecera .nav-sa"); else if (window.IMAGOMAKK && IMAGOMAKK.herramientas[ruta_.replace(/^\/|\/$/g, "")]) el = $("#boton-herr");
    if (el) {
      el.classList.add("nav-actual");
      if (el.tagName === "A") el.setAttribute("aria-current", "page");
    }
  })();
  function marcarActual() {
    $$("#grilla .herr").forEach(function(a) {
      var h = ruta.tipo === "herramienta" && window.IMAGOMAKK.herramientas[ruta.slug], base = h ? h.base || ruta.slug : null;
      var es = !!base && a.dataset.slug === base;
      a.classList.toggle("actual", es);
      if (es) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function marcarParaUsar() {
    nota.hidden = true;
    var nu = $("#nota-usar");
    nu.hidden = false;
    nu.textContent = "Elegí la herramienta para seguir con " + usando.name + ". Se abre en otra pestaña, con ese archivo cargado.";
    $$(".motivo", $("#grilla")).forEach(function(m) {
      m.remove();
    });
    $$("#grilla .herr").forEach(function(a) {
      var m = a.classList.contains("externa") ? "Imagen a PDF está en Foliomakk: descargá el resultado y soltalo allá." : "";
      a.classList.remove("marcada");
      a.classList.toggle("gris", !!m);
      a.dataset.motivo = m;
      if (m) a.setAttribute("aria-disabled", "true"); else a.removeAttribute("aria-disabled");
    });
    marcarActual();
  }
  var reabrirCon = null;
  function usarEnOtra(f) {
    if (panel.dataset.cerrando) {
      reabrirCon = f;
      return;
    }
    usando = f;
    marcarGrilla();
    if (panel.hidden) abrirPanel();
    window.scrollTo({
      top: 0,
      behavior: QUIETO ? "auto" : "smooth"
    });
  }
  document.addEventListener("click", function(e) {
    if (!usando) return;
    var a = e.target.closest && e.target.closest("#grilla .herr");
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    if (a.dataset.motivo) {
      var previo = a.nextElementSibling;
      if (previo && previo.classList.contains("motivo")) {
        quitarSuave(previo);
        return;
      }
      var p = document.createElement("p");
      p.className = "motivo";
      p.setAttribute("role", "status");
      p.textContent = a.dataset.motivo;
      a.insertAdjacentElement("afterend", p);
      return;
    }
    var w = window.open(a.getAttribute("href"), "_blank");
    if (w) pendientesUsar.push({
      w: w,
      archivos: [ usando ]
    });
    cerrarPanel();
  }, true);
  window.addEventListener("message", function(e) {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.tipo === "imagomakk-pido") {
      var k = pendientesUsar.findIndex(function(x) {
        return x.w === e.source;
      });
      if (k < 0) return;
      e.source.postMessage({
        tipo: "imagomakk-entrega",
        archivos: pendientesUsar[k].archivos
      }, location.origin);
      pendientesUsar.splice(k, 1);
    } else if (e.data.tipo === "imagomakk-entrega" && e.source === window.opener && e.data.archivos) agregar(e.data.archivos);
  });
  function pedirAlQueAbrio() {
    try {
      if (!window.opener || window.opener.location.origin !== location.origin) return;
    } catch (e) {
      return;
    }
    window.opener.postMessage({
      tipo: "imagomakk-pido"
    }, location.origin);
  }
  var botonHerr = $("#boton-herr"), panel = $("#panel-herr");
  function abrirPanel() {
    if (!panel.hidden) return;
    panel.hidden = false;
    botonHerr.setAttribute("aria-expanded", "true");
    expandir(panel);
  }
  function cerrarPanel() {
    if (panel.hidden || panel.dataset.cerrando) return;
    botonHerr.setAttribute("aria-expanded", "false");
    panel.dataset.cerrando = "1";
    contraer(panel, function() {
      panel.hidden = true;
      panel.style.overflow = "";
      delete panel.dataset.cerrando;
      $$(".motivo", panel).forEach(function(m) {
        m.remove();
      });
      if (usando) {
        usando = null;
        marcarGrilla();
      }
      if (reabrirCon) {
        var f = reabrirCon;
        reabrirCon = null;
        usarEnOtra(f);
      }
    });
  }
  botonHerr.addEventListener("click", function() {
    if (panel.hidden) abrirPanel(); else cerrarPanel();
  });
  panel.addEventListener("click", function(e) {
    var a = e.target.closest(".herr");
    if (a && !a.dataset.motivo) cerrarPanel();
  });
  document.addEventListener("click", function(e) {
    if (e.target.closest("[data-abrir-herr]")) {
      e.preventDefault();
      e.stopPropagation();
      abrirPanel();
      window.scrollTo({
        top: 0,
        behavior: QUIETO ? "auto" : "smooth"
      });
      return;
    }
    if (!panel.hidden && !panel.contains(e.target) && !botonHerr.contains(e.target)) cerrarPanel();
  }, true);
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && !panel.hidden) {
      cerrarPanel();
      botonHerr.focus();
    }
  });
  $$("#grilla .herr").forEach(function(a) {
    a.addEventListener("click", function(e) {
      if (!a.dataset.motivo && a.classList.contains("actual") && !usando) {
        e.preventDefault();
        cerrarPanel();
        return;
      }
      if (!a.dataset.motivo) return;
      e.preventDefault();
      var previo = a.nextElementSibling;
      if (previo && previo.classList.contains("motivo")) {
        quitarSuave(previo);
        return;
      }
      var p = document.createElement("p");
      p.className = "motivo";
      p.setAttribute("role", "status");
      p.textContent = a.dataset.motivo;
      a.insertAdjacentElement("afterend", p);
    });
  });
  function actualizarEstado() {
    var n = archivos.length;
    if (ruta.tipo === "herramienta") {
      var m = motivo(ruta.slug);
      estado.innerHTML = m ? esc(m) : "";
      estado.classList.toggle("estado-aviso", !!m);
      ponerBoton();
      avisoPeso();
      return;
    }
    estado.classList.remove("estado-aviso");
    estado.innerHTML = n === 0 ? "" : n === 1 ? "<b>1 archivo listo.</b> Elegí abajo la herramienta con la que querés procesarlo." : "<b>" + n + " archivos listos.</b> Elegí abajo la herramienta con la que querés procesarlos.";
  }
  var ESCRITORIO = !!window.IMAGOMAKK_ESCRITORIO;
  var VISTA = !!window.IMAGOMAKK_VISTA || ESCRITORIO;
  var ruta = {
    tipo: "portada"
  };
  var vistas = {
    portada: $("#vista-portada"),
    herramienta: $("#vista-herramienta"),
    texto: $("#vista-texto")
  };
  var cargasAnuncio = 1;
  var textoZonaPortada = [ $("#zona .zona-titulo").textContent, $("#zona .boton-elegir").textContent ];
  var destino = null;
  function leerRuta() {
    var h = destino !== null ? destino : VISTA ? (location.hash || "").replace(/^#\/?/, "") : IM_RUTA().replace(/^\/+|\/+$/g, "");
    if (!h) return {
      tipo: "portada"
    };
    if (C.herramientas[h] && !C.herramientas[h].externa) return {
      tipo: "herramienta",
      slug: h
    };
    if (C.paginas[h] || h === "preguntas-frecuentes" || h === "escribinos") return {
      tipo: "texto",
      slug: h
    };
    return {
      tipo: "portada"
    };
  }
  function mostrar() {
    var anterior = ruta;
    ruta = leerRuta();
    Object.keys(vistas).forEach(function(k) {
      vistas[k].hidden = k !== ruta.tipo;
    });
    if (ruta.tipo !== "herramienta" && herrActual) {
      if (herrActual.desmontar) herrActual.desmontar();
      herrActual = null;
      oyentesArchivos = [];
      oyentesOpcion = [];
    }
    if (ruta.tipo === "portada") {
      $("#lugar-zona-portada").insertBefore(zona, sugeridas);
      $("#lugar-zona-portada").insertBefore(estado, sugeridas);
      $("#zona .zona-titulo").textContent = textoZonaPortada[0];
      $("#zona .boton-elegir").textContent = textoZonaPortada[1];
      document.title = "Imagomakk — Tus imágenes, resueltas en tu propio equipo";
    } else if (ruta.tipo === "herramienta") {
      pintarHerramienta(C.herramientas[ruta.slug]);
      document.title = C.herramientas[ruta.slug].titulo + " — Imagomakk";
    } else {
      pintarTexto(ruta.slug);
    }
    if (primeraCarga || anterior.tipo !== ruta.tipo || anterior.slug !== ruta.slug) renovarAnuncio(); else pintarCargas();
    cerrarPanel();
    actualizarEstado();
    marcarGrilla();
    ubicarAnuncio();
    var anclaDestino = !VISTA && location.hash && !/^#\//.test(location.hash) && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (anclaDestino) anclaDestino.scrollIntoView(); else window.scrollTo(0, 0);
  }
  var angosta = window.matchMedia("(max-width:779px)");
  function ubicarOpciones() {
    var o = $(".h-opciones"), r = $("#resultados"), cuerpo = $(".h-cuerpo");
    if (!o || !r || !cuerpo) return;
    if (angosta.matches) {
      if (o.previousElementSibling !== r) r.parentNode.insertBefore(o, r.nextSibling);
    } else if (o.parentNode !== cuerpo) cuerpo.appendChild(o);
  }
  if (angosta.addEventListener) angosta.addEventListener("change", ubicarOpciones);
  function ubicarAnuncio() {
    var capa = $("#capa-anuncio");
    if (!capa || ruta.tipo !== "portada") return;
    var env = capa.parentNode, anc = $(".anuncio-columna", capa);
    env.style.minHeight = "";
    if (getComputedStyle(capa).display !== "none") {
      var b0 = env.getBoundingClientRect(), t0 = $("#vista-portada .bajada").getBoundingClientRect();
      env.style.minHeight = Math.ceil(t0.top - b0.top + (anc.offsetHeight || 600) + 24 - (parseFloat(getComputedStyle($(".pie")).marginTop) || 0)) + "px";
    }
    var base = capa.parentNode.getBoundingClientRect(), t = $("#vista-portada .bajada").getBoundingClientRect(), pie = $(".pie").getBoundingClientRect();
    capa.style.top = Math.round(t.top - base.top) + "px";
    capa.style.bottom = Math.round(base.bottom - pie.top + 24) + "px";
    var anuncio = $(".anuncio-columna", capa), alto = anuncio.offsetHeight || 600;
    var nace = Math.round(t.top + window.scrollY);
    anuncio.style.top = Math.max(16, Math.min(nace, Math.round(window.innerHeight / 2 - alto / 2))) + "px";
  }
  window.addEventListener("resize", ubicarAnuncio);
  window.addEventListener("load", ubicarAnuncio);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ubicarAnuncio);
  function renovarAnuncio() {
    if (!primeraCarga) cargasAnuncio++;
    pintarCargas();
  }
  function pintarCargas() {
    $$("[data-anuncio-carga]").forEach(function(e) {
      e.textContent = "Carga " + cargasAnuncio;
    });
  }
  var primeraCarga = true;
  function slugDe(a) {
    return a.getAttribute("href").replace(/^\/+|\/+$/g, "");
  }
  function enlaceInterno(e) {
    var a = e.target.closest && e.target.closest('a[href^="/"]');
    if (!a || e.defaultPrevented || a.target || /^\/\//.test(a.getAttribute("href")) || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return null;
    return a;
  }
  if (VISTA) {
    var ir = function(slug) {
      destino = slug;
      try {
        history.pushState({
          r: slug
        }, "", "#/" + slug);
      } catch (e) {}
      mostrar();
    };
    window.addEventListener("popstate", function() {
      destino = null;
      mostrar();
    });
    window.addEventListener("hashchange", function() {
      destino = null;
      mostrar();
    });
    document.addEventListener("click", function(e) {
      var a = enlaceInterno(e);
      if (!a) return;
      e.preventDefault();
      ir(slugDe(a));
    });
  } else {
    var deHashViejo = function() {
      var v = (location.hash || "").match(/^#\/([a-z0-9-]*)$/);
      if (v) location.replace(IM_URL("/" + (v[1] ? v[1] + "/" : "")));
    };
    deHashViejo();
    window.addEventListener("hashchange", deHashViejo);
    document.addEventListener("click", function(e) {
      var a = enlaceInterno(e);
      if (!a || !archivos.length) return;
      e.preventDefault();
      irConArchivos(a.getAttribute("href"));
    });
  }
  var CLAVE_ENTREGA = "imagomakk-entrega", saliendoConArchivos = false;
  function trabajadorListo() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    if (navigator.serviceWorker.controller) return Promise.resolve(navigator.serviceWorker.controller);
    return Promise.race([ navigator.serviceWorker.ready.then(function() {
      return navigator.serviceWorker.controller;
    }), new Promise(function(r) {
      setTimeout(function() {
        r(null);
      }, 1500);
    }) ]);
  }
  function hablarConTrabajador(sw, msj) {
    return new Promise(function(ok) {
      var c = new MessageChannel, t = setTimeout(function() {
        ok(null);
      }, 3e3);
      c.port1.onmessage = function(ev) {
        clearTimeout(t);
        ok(ev.data);
      };
      try {
        sw.postMessage(msj, [ c.port2 ]);
      } catch (e) {
        clearTimeout(t);
        ok(null);
      }
    });
  }
  function irConArchivos(href) {
    var clave = Date.now().toString(36) + Math.random().toString(36).slice(2);
    trabajadorListo().then(function(sw) {
      if (!sw) return null;
      return hablarConTrabajador(sw, {
        tipo: "imagomakk-guardar",
        clave: clave,
        archivos: archivos.map(function(a) {
          return a.file;
        })
      });
    }).then(function(r) {
      if (r && r.ok) {
        try {
          sessionStorage.setItem(CLAVE_ENTREGA, clave);
        } catch (e) {}
      }
      saliendoConArchivos = true;
      setTimeout(function() {
        saliendoConArchivos = false;
        try {
          if (sessionStorage.getItem(CLAVE_ENTREGA) === clave) sessionStorage.removeItem(CLAVE_ENTREGA);
        } catch (e) {}
        trabajadorListo().then(function(sw) {
          if (sw) hablarConTrabajador(sw, {
            tipo: "imagomakk-soltar",
            clave: clave
          });
        });
      }, 1500);
      location.href = href;
    });
  }
  function soltarEntrega(clave) {
    var sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (clave && sw) hablarConTrabajador(sw, {
      tipo: "imagomakk-soltar",
      clave: clave
    });
  }
  function recibirEntrega() {
    var clave = null;
    try {
      clave = sessionStorage.getItem(CLAVE_ENTREGA);
      sessionStorage.removeItem(CLAVE_ENTREGA);
    } catch (e) {}
    if (!clave || VISTA || !("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
    var tipoNav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0] || {}).type;
    if (tipoNav === "reload") {
      soltarEntrega(clave);
      return;
    }
    hablarConTrabajador(navigator.serviceWorker.controller, {
      tipo: "imagomakk-pedir",
      clave: clave
    }).then(function(r) {
      if (r && r.archivos && r.archivos.length) agregar(r.archivos);
    });
  }
  window.addEventListener("pageshow", function(e) {
    if (!e.persisted) return;
    saliendoConArchivos = false;
    var clave = null;
    try {
      clave = sessionStorage.getItem(CLAVE_ENTREGA);
      sessionStorage.removeItem(CLAVE_ENTREGA);
    } catch (x) {}
    soltarEntrega(clave);
  });
  window.addEventListener("pagehide", function() {
    if (VISTA || saliendoConArchivos || !archivos.length) return;
    var sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return;
    var clave = Date.now().toString(36) + Math.random().toString(36).slice(2);
    try {
      sw.postMessage({
        tipo: "imagomakk-guardar",
        clave: clave,
        archivos: archivos.map(function(a) {
          return a.file;
        })
      });
      sessionStorage.setItem(CLAVE_ENTREGA, clave);
    } catch (e) {}
  });
  function boton(h) {
    var l = (sec(h, "Cómo se hace") || {
      l: []
    }).l, m = null;
    l.some(function(p) {
      return m = p.match(/^\d+\. Tocá "([^"]+)"/);
    });
    if (!m) m = l.join(" ").match(/[Tt]ocá "([^"]+)"/);
    return m ? m[1] : "Procesar";
  }
  function sec(h, t) {
    return h.secciones.filter(function(s) {
      return s.t === t;
    })[0];
  }
  function hooks() {
    var h = C.herramientas[ruta.slug];
    return window.IMHerramientas && IMHerramientas[h.base || ruta.slug];
  }
  function lineaOpcion(l, i, todas) {
    var mg = l.match(/^([^:]{2,160}):\s*(.*)$/), gancho = hooks() && hooks().opcion;
    if (mg && gancho) {
      var propio = gancho(mg[1], mg[2], {
        grupo: function(r, items, tal) {
          return grupo(r, items, false, false, tal);
        },
        varias: function(r, items, todas) {
          return grupo(r, items, true, !todas);
        }
      });
      if (propio === "") return {
        html: "",
        saltar: 0
      };
      if (propio) return {
        html: propio,
        saltar: 0
      };
    }
    var m = l.match(/^([^:]{2,60}):\s*(.*)$/);
    if (m && m[2].indexOf(" · ") > 0 && !/\([^)]*·/.test(m[2])) {
      var resto = m[2].replace(/\.$/, ""), multi = /Elegí (los|las) que quieras/.test(resto), ninguna = /o ningun[ao]/.test(resto);
      resto = resto.replace(/\.?\s*Elegí (los|las) que quieras[^.]*\.?$/, "");
      return {
        html: grupo(m[1], resto.split(" · "), multi, ninguna),
        saltar: 0
      };
    }
    if (m) return {
      html: '<p class="opc-texto"><span class="opc-rotulo">' + esc(m[1]) + ":</span> " + esc(m[2]) + "</p>",
      saltar: 0
    };
    return {
      html: '<p class="opc-texto">' + esc(l) + "</p>",
      saltar: 0
    };
  }
  var nGrupo = 0;
  function grupo(rotulo, items, multi, ninguna, tal) {
    nGrupo++;
    var id = "op" + nGrupo, h = C.herramientas[ruta.slug];
    if (!tal) items = items.map(function(it) {
      return it.charAt(0).toUpperCase() + it.slice(1);
    });
    var inicial = rotulo === "Convertir a" && h.salida ? Math.max(0, items.indexOf(h.salida)) : 0;
    if (h.elegidas && h.elegidas[rotulo] != null) {
      var qq = h.elegidas[rotulo].toLowerCase();
      inicial = Math.max(0, items.map(function(x) {
        return x.toLowerCase();
      }).indexOf(qq));
    }
    var valor = multi ? ninguna ? "Ninguna" : "Todas" : items[inicial];
    return '<div class="desp" data-multi="' + (multi ? 1 : 0) + '">' + '<button type="button" class="desp-boton" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '">' + '<span class="desp-texto"><span class="desp-rotulo">' + esc(rotulo) + '</span> <span class="desp-valor">' + esc(valor) + "</span></span>" + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' + '<ul class="desp-lista" id="' + id + '" role="listbox"' + (multi ? ' aria-multiselectable="true"' : "") + ' aria-label="' + esc(rotulo) + '" hidden>' + items.map(function(it, k) {
      var sel = multi ? !ninguna : k === inicial;
      return '<li role="option" tabindex="-1" aria-selected="' + sel + '"' + (!multi && k === inicial ? " data-inicial" : "") + ">" + esc(it) + "</li>";
    }).join("") + "</ul></div>";
  }
  var QUIETO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RESORTE = "linear(0.000 0.0%, 0.057 4.2%, 0.179 8.3%, 0.319 12.5%, 0.453 16.7%, 0.571 20.8%, 0.669 25.0%, 0.748 29.2%, 0.811 33.3%, 0.859 37.5%, 0.895 41.7%, 0.923 45.8%, 0.944 50.0%, 0.959 54.2%, 0.970 58.3%, 0.979 62.5%, 0.985 66.7%, 0.989 70.8%, 0.992 75.0%, 0.994 79.2%, 0.996 83.3%, 0.997 87.5%, 0.998 91.7%, 0.999 95.8%, 1 100%)", DUR = 460;
  if (!(window.CSS && CSS.supports && CSS.supports("transition-timing-function", RESORTE))) RESORTE = "cubic-bezier(.22,.8,.25,1)";
  function medidasCaja(el) {
    var c = getComputedStyle(el);
    return {
      height: el.offsetHeight + "px",
      opacity: 1,
      marginTop: c.marginTop,
      marginBottom: c.marginBottom,
      paddingTop: c.paddingTop,
      paddingBottom: c.paddingBottom,
      borderTopWidth: c.borderTopWidth,
      borderBottomWidth: c.borderBottomWidth
    };
  }
  var CERO = {
    height: "0px",
    opacity: 0,
    marginTop: "0px",
    marginBottom: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",
    borderTopWidth: "0px",
    borderBottomWidth: "0px"
  };
  function cero(el) {
    var z = Object.assign({}, CERO), p = el.parentElement;
    if (!p) return z;
    var c = getComputedStyle(p), g = 0;
    if (/grid/.test(c.display) || /flex/.test(c.display) && /column/.test(c.flexDirection)) g = parseFloat(c.rowGap) || 0;
    if (!g) return z;
    var otros = Array.prototype.filter.call(p.children, function(x) {
      return x !== el && !x.hidden && getComputedStyle(x).display !== "none";
    });
    if (!otros.length) return z;
    var ultimo = !Array.prototype.some.call(p.children, function(x) {
      return x !== el && !x.hidden && getComputedStyle(x).display !== "none" && el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    if (ultimo) z.marginTop = -g + "px"; else z.marginBottom = -g + "px";
    return z;
  }
  function visible(el) {
    return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
  }
  function relojAtrasado() {
    return document.timeline && document.timeline.currentTime != null && performance.now() - document.timeline.currentTime > 60;
  }
  function expandir(el) {
    if (QUIETO || !el.animate || !visible(el)) return;
    var lleno = medidasCaja(el), bs = el.style.boxSizing;
    el.style.overflow = "hidden";
    el.style.boxSizing = "border-box";
    var animar = function() {
      el.animate([ cero(el), lleno ], {
        duration: DUR,
        easing: RESORTE
      }).onfinish = function() {
        el.style.overflow = "";
        el.style.boxSizing = bs;
      };
    };
    if (!relojAtrasado()) {
      animar();
      return;
    }
    var espera = el.animate([ cero(el), cero(el) ], {
      duration: 1e5
    }), n = 0;
    (function aguardar() {
      if (relojAtrasado() && n++ < 30) {
        requestAnimationFrame(aguardar);
        return;
      }
      espera.cancel();
      animar();
    })();
  }
  function contraer(el, alTerminar) {
    if (QUIETO || !el.animate || !visible(el)) {
      if (alTerminar) alTerminar();
      return;
    }
    var lleno = medidasCaja(el), bs = el.style.boxSizing;
    el.style.overflow = "hidden";
    el.style.boxSizing = "border-box";
    el.animate([ lleno, cero(el) ], {
      duration: DUR,
      easing: RESORTE
    }).onfinish = function() {
      el.style.boxSizing = bs;
      if (alTerminar) alTerminar();
    };
  }
  function cambiarAlto(el, cambio) {
    if (QUIETO || !el.animate) {
      cambio();
      return;
    }
    var h0 = el.offsetHeight;
    cambio();
    var h1 = el.offsetHeight;
    el.style.overflow = "hidden";
    el.animate([ {
      height: h0 + "px"
    }, {
      height: h1 + "px"
    } ], {
      duration: DUR,
      easing: RESORTE
    }).onfinish = function() {
      el.style.overflow = "";
    };
    Array.prototype.forEach.call(el.children, function(c) {
      c.animate([ {
        opacity: 0
      }, {
        opacity: 1
      } ], {
        duration: DUR,
        easing: RESORTE
      });
    });
  }
  function enFlujo(el) {
    var p = getComputedStyle(el).position;
    return p !== "absolute" && p !== "fixed";
  }
  function mostrarSuave(el) {
    if (el.dataset.saliendoAlto) {
      delete el.dataset.saliendoAlto;
      el.getAnimations().forEach(function(x) {
        x.cancel();
      });
      el.style.overflow = "";
      el.style.boxSizing = "";
      el.hidden = false;
      return;
    }
    if (!el.hidden && !el.classList.contains("saliendo")) return;
    el.classList.remove("saliendo");
    el.hidden = false;
    if (enFlujo(el)) {
      expandir(el);
      return;
    }
    el.classList.add("entrando");
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        el.classList.remove("entrando");
      });
    });
  }
  function ocultarSuave(el, alTerminar) {
    if (el.hidden || el.dataset.saliendoAlto) {
      if (alTerminar) alTerminar();
      return;
    }
    if (QUIETO) {
      el.hidden = true;
      if (alTerminar) alTerminar();
      return;
    }
    if (enFlujo(el) && el.animate) {
      el.dataset.saliendoAlto = "1";
      contraer(el, function() {
        if (!el.dataset.saliendoAlto) return;
        delete el.dataset.saliendoAlto;
        el.hidden = true;
        el.style.overflow = "";
        if (alTerminar) alTerminar();
      });
      return;
    }
    el.classList.add("saliendo");
    setTimeout(function() {
      if (el.classList.contains("saliendo")) {
        el.hidden = true;
        el.classList.remove("saliendo");
      }
      if (alTerminar) alTerminar();
    }, DUR);
  }
  function suavizarAlto(el) {
    if (!el || el._suave || QUIETO || !window.MutationObserver) return;
    el._suave = true;
    requestAnimationFrame(function() {
      if (el._h == null) el._h = el.offsetHeight;
    });
    new MutationObserver(function() {
      if (el._h == null) {
        el._h = el.offsetHeight;
        return;
      }
      var antes = el.getAnimations().length ? el.getBoundingClientRect().height : el._h;
      el.getAnimations().forEach(function(x) {
        x.cancel();
      });
      var h1 = el.offsetHeight;
      el._h = h1;
      if (Math.abs(h1 - antes) < 1 || !el.offsetParent) return;
      var bs = el.style.boxSizing;
      el.style.overflow = "hidden";
      el.style.boxSizing = "border-box";
      el.animate([ {
        height: antes + "px"
      }, {
        height: h1 + "px"
      } ], {
        duration: DUR,
        easing: RESORTE
      }).onfinish = function() {
        el.style.overflow = "";
        el.style.boxSizing = bs;
      };
    }).observe(el, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  suavizarAlto(estado);
  function altoSuave(el, cambio, conContenido) {
    if (QUIETO || !el.animate) {
      cambio();
      return;
    }
    el.getAnimations().forEach(function(x) {
      x.cancel();
    });
    var h0 = el.offsetHeight;
    cambio();
    var h1 = el.offsetHeight;
    if (Math.abs(h1 - h0) < 1) return;
    var bs = el.style.boxSizing;
    el.style.overflow = "hidden";
    el.style.boxSizing = "border-box";
    el.animate([ {
      height: h0 + "px"
    }, {
      height: h1 + "px"
    } ], {
      duration: DUR,
      easing: RESORTE
    }).onfinish = function() {
      el.style.overflow = "";
      el.style.boxSizing = bs;
    };
    if (conContenido) Array.prototype.forEach.call(el.children, function(c) {
      if (!c.hidden) c.animate([ {
        opacity: 0
      }, {
        opacity: 1
      } ], {
        duration: DUR,
        easing: RESORTE
      });
    });
  }
  function cruzar(de, a) {
    if (!a) return;
    var esc = a.parentNode;
    if (!de || de.hidden || QUIETO || !esc.animate) {
      if (de) {
        de.hidden = true;
        de.classList.remove("saliendo");
      }
      a.classList.remove("saliendo", "entrando");
      a.hidden = false;
      return;
    }
    if (!a.hidden && !a.classList.contains("saliendo")) return;
    var h0 = esc.offsetHeight;
    a.classList.remove("saliendo");
    a.hidden = false;
    var h1 = a.offsetHeight + (parseFloat(getComputedStyle(a).marginTop) || 0);
    esc.getAnimations().forEach(function(x) {
      x.cancel();
    });
    esc.style.overflow = "hidden";
    esc.animate([ {
      height: h0 + "px"
    }, {
      height: h1 + "px"
    } ], {
      duration: DUR,
      easing: RESORTE
    }).onfinish = function() {
      esc.style.overflow = "";
    };
    a.animate([ {
      opacity: 0
    }, {
      opacity: 1
    } ], {
      duration: DUR,
      easing: RESORTE
    });
    de.animate([ {
      opacity: 1
    }, {
      opacity: 0
    } ], {
      duration: DUR,
      easing: RESORTE
    }).onfinish = function() {
      if (!a.hidden) de.hidden = true;
    };
  }
  function quitarSuave(el) {
    contraer(el, function() {
      el.remove();
    });
  }
  function cerrarDesplegables(excepto) {
    $$(".desp").forEach(function(d) {
      if (d === excepto) return;
      var ul = $(".desp-lista", d);
      if (!ul.hidden) ocultarSuave(ul);
      $(".desp-boton", d).setAttribute("aria-expanded", "false");
    });
  }
  function valorMulti(d) {
    var n = $$('li[aria-selected="true"]', d).length, tot = $$("li", d).length;
    return n === tot ? "Todas" : n === 0 ? "Ninguna" : n + " de " + tot;
  }
  document.addEventListener("click", function(e) {
    var b = e.target.closest && e.target.closest(".desp-boton");
    var li = e.target.closest && e.target.closest(".desp-lista li");
    if (b) {
      var d = b.parentNode, ul = $(".desp-lista", d), abrir = ul.hidden || ul.classList.contains("saliendo");
      cerrarDesplegables(d);
      if (abrir) mostrarSuave(ul); else ocultarSuave(ul);
      b.setAttribute("aria-expanded", abrir ? "true" : "false");
      if (abrir) {
        var s = $('li[aria-selected="true"]', ul) || $("li", ul);
        s.focus();
      }
      return;
    }
    if (li) {
      elegir(li);
      return;
    }
    if (!(e.target.closest && e.target.closest(".desp"))) cerrarDesplegables();
  });
  function elegir(li) {
    var d = li.closest(".desp"), multi = d.dataset.multi === "1";
    if (multi) {
      li.setAttribute("aria-selected", li.getAttribute("aria-selected") === "true" ? "false" : "true");
      ponerValor(d, d.dataset.valorPropio ? IMHerramientas._valorMulti(d) : valorMulti(d));
      oyentesOpcion.forEach(function(f) {
        f();
      });
      cerrarTanda();
      return;
    }
    $$("li", d).forEach(function(o) {
      o.setAttribute("aria-selected", o === li ? "true" : "false");
    });
    ponerValor(d, IM_ES(li));
    ocultarSuave($(".desp-lista", d));
    var b = $(".desp-boton", d);
    b.setAttribute("aria-expanded", "false");
    b.focus();
    oyentesOpcion.forEach(function(f) {
      f();
    });
    cerrarTanda();
  }
  document.addEventListener("keydown", function(e) {
    var li = e.target.closest && e.target.closest(".desp-lista li");
    if (e.key === "Escape") {
      var d = e.target.closest && e.target.closest(".desp");
      cerrarDesplegables();
      if (d) $(".desp-boton", d).focus();
      return;
    }
    if (!li) return;
    if (e.key === "ArrowDown" && li.nextElementSibling) {
      e.preventDefault();
      li.nextElementSibling.focus();
    }
    if (e.key === "ArrowUp" && li.previousElementSibling) {
      e.preventDefault();
      li.previousElementSibling.focus();
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      elegir(li);
    }
  });
  function lista_(l) {
    var html = "", enLista = false, ol = false;
    l.forEach(function(x) {
      if (/^\d+\.\s/.test(x)) {
        if (!enLista) {
          html += "<ol>";
          enLista = true;
          ol = true;
        }
        html += "<li>" + esc(x.replace(/^\d+\.\s*/, "")) + "</li>";
        return;
      }
      if (/^·\s/.test(x)) {
        if (!enLista) {
          html += "<ul>";
          enLista = true;
          ol = false;
        }
        html += "<li>" + esc(x.replace(/^·\s*/, "")) + "</li>";
        return;
      }
      if (enLista) {
        html += ol ? "</ol>" : "</ul>";
        enLista = false;
      }
      var m = x.match(/^([^:]{2,50}):\s(.+)$/);
      html += m ? '<p><span class="opc-rotulo">' + esc(m[1]) + ":</span> " + esc(m[2]) + "</p>" : "<p>" + esc(x) + "</p>";
    });
    if (enLista) html += ol ? "</ol>" : "</ul>";
    return html;
  }
  function comun(p) {
    return C.comunes.filter(function(q) {
      return q.p === p;
    })[0];
  }
  function faqHtml(lista) {
    return lista.map(function(q) {
      return "<details><summary>" + esc(q.p) + "</summary>" + q.r.map(function(r) {
        return "<p>" + esc(r) + "</p>";
      }).join("") + "</details>";
    }).join("");
  }
  function pintarHerramienta(h) {
    var v = vistas.herramienta;
    var opciones = sec(h, "Opciones"), como = sec(h, "Cómo se hace");
    var otras = h.secciones.filter(function(s) {
      return s.t !== "Opciones" && s.t !== "Cómo se hace" && s.t !== "Herramientas sobre la foto";
    });
    oyentesArchivos = [];
    oyentesOpcion = [];
    if (herrActual && herrActual.desmontar) herrActual.desmontar();
    herrActual = null;
    var opHtml = "";
    if (opciones) for (var i = 0; i < opciones.l.length; i++) {
      var r = lineaOpcion(opciones.l[i], i, opciones.l);
      opHtml += r.html;
      i += r.saltar;
    }
    var faq = h.faq.slice();
    (h.comunes || []).forEach(function(p) {
      var q = comun(p);
      if (q && p === "¿Funciona sin conexión?" && h.sinConexion && !(window.TR && TR(h.sinConexion) === h.sinConexion && TR(q.r[0]) !== q.r[0])) q = {
        p: q.p,
        r: [ h.sinConexion ]
      };
      if (q && !faq.some(function(f) {
        return f.p === q.p;
      })) faq.push(q);
    });
    v.innerHTML = '<div class="envoltura h-cuerpo">' + '<header class="h-cabeza">' + '<div class="h-linea"><p class="volver"><a href="/">← Todas las herramientas</a></p>' + "<h1>" + esc(h.titulo) + "</h1><span></span></div>" + '<p class="bajada">' + esc(h.bajada) + "</p>" + "</header>" + '<div class="h-principal">' + '<div id="lugar-zona-herr"></div>' + '<div class="escena"><div class="trabajo-img" id="trabajo"></div>' + '<div class="galeria" id="galeria" hidden></div></div>' + '<div id="resultados"></div>' + '<aside class="anuncio anuncio-franja-herr" aria-label="Publicidad"><div>Espacio fijo 728 × 90<small data-anuncio-carga></small></div></aside>' + otras.map(function(s) {
      return '<section class="h-sec"><h2>' + esc(s.t) + "</h2>" + lista_(s.l) + "</section>";
    }).join("") + (como ? '<section class="h-sec"><h2>Cómo se hace</h2>' + lista_(como.l) + "</section>" : "") + '<section class="te-sirvio" id="te-sirvio"><p>Gracias por usar Imagomakk. ¿Te sirvió? <button type="button" data-ts="si">Sí</button> · <button type="button" data-ts="no">No</button></p><div id="ts-respuesta"></div></section>' + (faq.length ? '<section class="h-sec faq"><h2>Preguntas frecuentes</h2>' + faqHtml(faq) + "</section>" : "") + "</div>" + '<aside class="h-opciones" aria-label="Opciones">' + opHtml + '<p class="aviso-peso" id="aviso-peso" hidden></p>' + '<p class="aviso-herr" id="aviso-herr" role="status" hidden></p>' + '<button type="button" class="boton-principal" id="procesar">' + esc(boton(h)) + "</button>" + '<div class="anuncio anuncio-herr"><div>Espacio fijo 300 × 250<small data-anuncio-carga></small></div></div>' + "</aside></div>";
    $("#lugar-zona-herr").appendChild(zona);
    $("#lugar-zona-herr").appendChild(estado);
    ubicarOpciones();
    $("#zona .zona-titulo").textContent = h.zona[0];
    $("#zona .boton-elegir").textContent = h.zona[1];
    $$("[data-anuncio-carga]").forEach(function(e) {
      e.textContent = "Carga " + cargasAnuncio;
    });
    $("#procesar").addEventListener("click", procesarHerramienta);
    conVisor = false;
    oyentesElegir = [];
    oyentesVer = [];
    etiquetaFn = null;
    tanda = null;
    marcarElegido();
    pintarEtiquetas();
    montando = true;
    condicionarOpciones(true);
    botonQuiere = true;
    try {
      if (hooks()) {
        herrActual = hooks();
        herrActual.montar($("#trabajo"), h);
      }
    } finally {
      montando = false;
    }
    ponerBoton();
    teSirvio();
    pintarResultados();
  }
  function avisoPeso() {
    var a = $("#aviso-peso");
    if (!a) return;
    var grande = archivos.filter(function(x) {
      return x.file.size > 150 * 1048576;
    })[0];
    a.hidden = !grande;
    if (grande) a.textContent = "Este archivo pesa " + Math.round(grande.file.size / 1048576) + " MB. En equipos con 8 GB de memoria, con archivos de más de 150 MB el navegador puede cerrarse por falta de memoria.";
  }
  var resultados = [], avisoResultados = "";
  var herrActual = null, oyentesArchivos = [], oyentesOpcion = [], enCurso = null;
  function avisarArchivos() {
    condicionarOpciones();
    cerrarTanda();
    oyentesArchivos.forEach(function(f) {
      f();
    });
  }
  var montando = false;
  function despDe(rotulo) {
    return $$(".h-opciones .desp").filter(function(x) {
      var r = IM_ES($(".desp-rotulo", x)).replace(/:$/, "");
      return rotulo instanceof RegExp ? rotulo.test(r) : r === rotulo;
    })[0];
  }
  function elegirValor(d, li) {
    $$("li", d).forEach(function(x) {
      x.setAttribute("aria-selected", x === li ? "true" : "false");
    });
    ponerValor(d, IM_ES(li));
  }
  function ponerValor(d, texto) {
    var v = $(".desp-valor", d), b = $(".desp-boton", d);
    if (IM_ES(v) === texto && v.textContent === texto) return;
    if (b && b.offsetHeight) altoSuave(b, function() {
      v.textContent = texto;
    }); else v.textContent = texto;
  }
  function mostrarOpcion(rotulo, si, ya) {
    var d = despDe(rotulo);
    if (!d) return;
    d._quiere = si;
    if (!si && d.dataset.multi !== "1") {
      var primero = $$("li", d).filter(function(x) {
        return !x.hidden;
      })[0];
      if (primero && IM_ES($(".desp-valor", d)) !== IM_ES(primero)) elegirValor(d, primero);
    }
    if (ya || montando) {
      d.hidden = !si;
      return;
    }
    if (si) {
      if (d.dataset.saliendo) {
        d.getAnimations().forEach(function(a) {
          a.cancel();
        });
        delete d.dataset.saliendo;
        d.style.overflow = "";
      }
      if (d.hidden) {
        d.hidden = false;
        expandir(d);
      }
    } else if (!d.hidden && !d.dataset.saliendo) {
      d.dataset.saliendo = "1";
      cerrarDesplegables();
      contraer(d, function() {
        delete d.dataset.saliendo;
        d.style.overflow = "";
        if (d._quiere === false) d.hidden = true;
      });
    }
  }
  function ocultarValores(rotulo, fuera) {
    var d = despDe(rotulo);
    if (!d) return false;
    var lis = $$("li", d), cambio = false;
    lis.forEach(function(li) {
      li.hidden = fuera.some(function(f) {
        return f instanceof RegExp ? f.test(IM_ES(li)) : IM_ES(li) === f;
      });
    });
    var actual = lis.filter(function(li) {
      return li.getAttribute("aria-selected") === "true";
    })[0];
    if (actual && actual.hidden) {
      var otro = lis.filter(function(li) {
        return !li.hidden;
      })[0];
      if (otro) {
        elegirValor(d, otro);
        cambio = true;
      }
    }
    return cambio;
  }
  function condicionarOpciones(ya) {
    if (ruta.tipo !== "herramienta") return;
    var d = despDe("Resultado");
    if (d && /ZIP/.test(IM_ES(d.querySelector(".desp-lista")) + $$("li", d).map(IM_ES).join(" ")) && /por (imagen|GIF|foto)/.test($$("li", d).map(IM_ES).join(" "))) mostrarOpcion("Resultado", archivos.length > 1, ya);
  }
  function procesarHerramienta() {
    if (!archivos.length) {
      selector.click();
      return;
    }
    if (window.IMAGOMAKK_VISTA) {
      aviso("Esta copia de un solo archivo es para mirar el diseño: no trae los motores. Las herramientas funcionan en la web publicada.");
      return;
    }
    if (enCurso || !aptosAlcanzan(ruta.slug)) return;
    avisoAntes = avisoTok;
    if (herrActual) {
      soloAptos = true;
      try {
        herrActual.procesar();
      } finally {
        soloAptos = false;
      }
    }
  }
  var avisoTok = 0, avisoAntes = -1;
  function aviso(texto) {
    var a = $("#aviso-herr");
    if (!a) return;
    var tok = ++avisoTok;
    if (!texto) {
      if (!a.hidden) contraer(a, function() {
        if (tok === avisoTok) {
          a.hidden = true;
          a.textContent = "";
        }
      });
      return;
    }
    var nuevo = a.hidden;
    a.textContent = texto;
    a.hidden = false;
    if (nuevo) expandir(a);
  }
  var TEXTO_ERROR = {
    imagen: function(e) {
      return (e.archivo ? e.archivo + ": " : "") + "este navegador no puede abrir ese formato de imagen.";
    },
    peso: function(e) {
      return (e.archivo ? e.archivo + ": " : "") + "no se pudo llegar a ese peso.";
    },
    modelo: function() {
      return "No se pudo cargar el modelo de inteligencia artificial.";
    },
    "ancho-ia": function(e) {
      return e.archivo + ": el ancho tiene que estar entre " + e.min + " y " + e.max + " píxeles.";
    },
    "memoria-ia": function(e) {
      return e.archivo + ": agrandada mediría " + e.ancho + " × " + e.alto + " píxeles, más de lo que entra en la memoria del navegador.";
    },
    memoria: function(e) {
      return (e.archivo ? e.archivo + ": " : "") + "la imagen es demasiado grande para la memoria de este equipo.";
    },
    "idioma-ocr": function(e) {
      return "No se pudo cargar el reconocedor de texto en " + (e.idioma || "ese idioma") + ".";
    },
    video: function(e) {
      return (e.archivo ? e.archivo + ": " : "") + "este navegador no puede abrir ese video.";
    },
    "video-codificar": function() {
      return "Este navegador no puede armar videos. Funciona en Chrome, Edge, Firefox y Safari actualizados.";
    },
    "solo-gif": function(e) {
      return (e.archivo ? e.archivo + ": " : "") + "no es un GIF.";
    },
    error: function() {
      return "No se pudo terminar. Tus archivos siguen cargados.";
    }
  };
  var MIME_EXT = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    svg: "image/svg+xml",
    zip: "application/zip",
    txt: "text/plain",
    mp4: "video/mp4",
    webm: "video/webm",
    ico: "image/x-icon",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };
  function procesar(op) {
    op = op || {};
    var capa = capaEspera();
    capa.texto(op.textoInicial || "Procesando…");
    var cancelado = false, viejo = false;
    enCurso = {
      cancelar: function() {
        cancelado = true;
        if (op.alCancelar) op.alCancelar();
      }
    };
    capa.alCancelar(function() {
      if (enCurso) enCurso.cancelar();
    });
    var alAvanzar = function(t) {
      capa.texto(t);
    };
    return Promise.resolve().then(function() {
      return op.preparar(alAvanzar, function() {
        return cancelado;
      });
    }).then(function(prep) {
      if (cancelado) throw {
        codigo: "cancelado"
      };
      capa.cerrar();
      enCurso = null;
      viejo = avisoTok === avisoAntes;
      if (!prep || !prep.listos || !prep.listos.length) return prep;
      var l = prep.listos;
      var cruce = abrirTanda(l);
      if (op.zip && l.length > 1) {
        var m = {}, usados = {};
        return Promise.all([ Promise.all(l.map(function(x) {
          return x.blob.arrayBuffer();
        })), cruce ]).then(function(rr) {
          return rr[0];
        }).then(function(bufs) {
          l.forEach(function(x, i) {
            var n = x.nombre, k = 2;
            while (usados[n]) n = x.nombre.replace(/(\.\w+)$/, "-" + k++ + "$1");
            usados[n] = 1;
            m[n] = [ new Uint8Array(bufs[i]), {
              level: 0
            } ];
          });
          entregar([ {
            nombre: op.nombreZip,
            blob: new Blob([ fflate.zipSync(m) ], {
              type: "application/zip"
            })
          } ], prep);
          return prep;
        });
      }
      return cruce.then(function() {
        entregar(l, prep, op.nombreZip);
        return prep;
      });
    }).then(function(prep) {
      contar({
        accion: "procesar",
        resultado: "ok"
      });
      if (viejo) {
        var t0 = avisoTok;
        setTimeout(function() {
          if (avisoTok === t0) aviso("");
        }, 0);
      }
      return prep;
    }).catch(function(e) {
      capa.cerrar();
      enCurso = null;
      e = e || {};
      contar({
        accion: "procesar",
        resultado: e.codigo === "cancelado" ? "cancelado" : "error-" + String(e.codigo || "general").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40)
      });
      aviso(e.codigo === "cancelado" ? "Cancelado. Tus archivos siguen cargados." : (TEXTO_ERROR[e.codigo] || TEXTO_ERROR.error)(e));
      if (window.console) console.warn("Imagomakk:", e);
    });
  }
  var verN = 1;
  function htmlBarraVer(titulo, total, n, lote) {
    var b = function(k, min) {
      return total >= min ? '<button type="button" data-ver="' + k + '" aria-pressed="' + (n === k) + '">' + k + "</button>" : "";
    };
    var nav = total > n ? '<span class="ver-lote"><button type="button" data-lote="-1" aria-label="' + (n > 1 ? "Anteriores" : "Anterior") + '"' + (lote <= 0 ? " disabled" : "") + ">‹</button><span>" + (n > 1 ? lote + 1 + "–" + Math.min(total, lote + n) : lote + 1) + " de " + total + '</span><button type="button" data-lote="1" aria-label="' + (n > 1 ? "Siguientes" : "Siguiente") + '"' + (lote + n >= total ? " disabled" : "") + ">›</button></span>" : "";
    return '<div class="ver-barra">' + (titulo ? '<span class="ver-titulo">' + esc(titulo) + "</span>" : "") + (total > 1 ? '<span class="ver-n"><span>Ver:</span>' + b(1, 1) + b(3, 2) + b(6, 4) + "</span>" : "") + nav + "</div>";
  }
  function nPosible(total) {
    return verN === 6 && total < 4 ? total >= 2 ? 3 : 1 : verN === 3 && total < 2 ? 1 : verN;
  }
  var tanda = null, tandaLote = 0, tandaUno = 0;
  function esImagen(x) {
    return /^image\//.test(x.blob.type) || /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(x.nombre);
  }
  var LADO_VISTA = 1600;
  function copiaParaVer(blob) {
    if (/svg/.test(blob.type) || !window.createImageBitmap) return Promise.resolve({
      url: URL.createObjectURL(blob)
    });
    if (/gif/.test(blob.type)) return createImageBitmap(blob).then(function(b) {
      var r = {
        url: URL.createObjectURL(blob),
        w: b.width,
        h: b.height
      };
      b.close();
      return r;
    }, function() {
      return {
        url: URL.createObjectURL(blob)
      };
    });
    return createImageBitmap(blob).catch(function() {
      return blob.arrayBuffer().then(function(ab) {
        return createImageBitmap(new Blob([ ab ], {
          type: blob.type
        }));
      });
    }).then(function(b) {
      var W = b.width, H = b.height, e = Math.min(1, LADO_VISTA / Math.max(W, H));
      if (e === 1 && blob.size < 3 * 1048576) {
        b.close();
        return {
          url: URL.createObjectURL(blob),
          w: W,
          h: H
        };
      }
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(W * e));
      c.height = Math.max(1, Math.round(H * e));
      c.getContext("2d").drawImage(b, 0, 0, c.width, c.height);
      b.close();
      return new Promise(function(ok) {
        c.toBlob(function(r) {
          ok({
            url: URL.createObjectURL(r || blob),
            w: W,
            h: H
          });
        }, "image/webp", .88);
      });
    }).catch(function() {
      return {
        url: URL.createObjectURL(blob)
      };
    });
  }
  var copiasOrig = {};
  function soltarCopiaOrig(id) {
    var c = copiasOrig[id];
    if (!c) return;
    delete copiasOrig[id];
    c.then(function(x) {
      if (x) setTimeout(function() {
        URL.revokeObjectURL(x.url);
      }, 2e3);
    });
  }
  function copiaOriginal(id) {
    var a = archivos.filter(function(x) {
      return x.id === id;
    })[0];
    if (!a || a.tipo !== "img") return Promise.resolve(null);
    if (copiasOrig[id]) return copiasOrig[id];
    if (/\.gif$/i.test(a.file.name) || a.file.type === "image/gif") return copiasOrig[id] = IMMotor.bitmap(a.file).then(function(b) {
      return {
        url: URL.createObjectURL(a.file),
        w: b.width,
        h: b.height
      };
    });
    return copiasOrig[id] = IMMotor.bitmap(a.file).then(function(b) {
      var e = Math.min(1, LADO_VISTA / Math.max(b.width, b.height)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(b.width * e));
      c.height = Math.max(1, Math.round(b.height * e));
      c.getContext("2d").drawImage(b, 0, 0, c.width, c.height);
      return new Promise(function(ok) {
        c.toBlob(function(r) {
          ok(r ? {
            url: URL.createObjectURL(r),
            w: b.width,
            h: b.height
          } : null);
        }, "image/webp", .9);
      });
    }).catch(function() {
      delete copiasOrig[id];
      return null;
    });
  }
  function abrirTanda(l) {
    var imgs = l.filter(esImagen);
    var g0 = $("#galeria");
    if (!imgs.length || !g0) return Promise.resolve();
    var enVista = !!tanda && !g0.hidden && !g0.classList.contains("saliendo"), vieja = tanda;
    var esta = imgs.map(function(x) {
      return {
        url: null,
        nombre: x.nombre,
        origen: x.origen,
        listo: false,
        blob: x.blob,
        nota: x.nota || ""
      };
    });
    var pendiente = false;
    if (enVista) {
      tanda = esta;
      tandaUno = Math.min(tandaUno, esta.length - 1);
      pendiente = true;
      vieja.forEach(function(x) {
        [ x.url, x.urlReal ].forEach(function(u) {
          if (u) setTimeout(function() {
            URL.revokeObjectURL(u);
          }, 4e3);
        });
      });
    } else {
      cerrarTanda(true);
      tanda = esta;
      tandaLote = 0;
      tandaUno = 0;
      pintarTanda();
    }
    var visiblesListas = function() {
      var n = nPosible(esta.length);
      if (n === 1) return esta[Math.min(tandaUno, esta.length - 1)].listo;
      var desde = Math.max(0, Math.min(tandaLote, Math.floor((esta.length - 1) / n) * n));
      return esta.slice(desde, desde + n).every(function(x) {
        return x.listo;
      });
    };
    var avisarCruce, cruce = new Promise(function(r) {
      avisarCruce = r;
    });
    var cruzado = enVista, aCruzar = function() {
      if (cruzado || tanda !== esta) {
        avisarCruce();
        return;
      }
      cruzado = true;
      cruzar($("#trabajo"), $("#galeria"));
      avisarCruce();
    };
    if (enVista) avisarCruce(); else setTimeout(aCruzar, 1500);
    var blobs = imgs.map(function(x) {
      return x.blob;
    }), k = 0;
    (function siguiente() {
      if (tanda !== esta || k >= blobs.length) return;
      var i = k++, b = blobs[i];
      blobs[i] = null;
      Promise.all([ copiaParaVer(b), esta[i].origen != null ? copiaOriginal(esta[i].origen) : null ]).then(function(r) {
        var c = r[0];
        if (tanda !== esta) {
          URL.revokeObjectURL(c.url);
          return;
        }
        var x = esta[i];
        x.url = c.url;
        x.w = c.w;
        x.h = c.h;
        x.orig = r[1];
        x.listo = true;
        if (pendiente) {
          if (visiblesListas()) {
            pendiente = false;
            conVisibles(pintarTanda);
          }
          siguiente();
          return;
        }
        if (i === tandaUno && nPosible(esta.length) === 1) pintarTanda();
        var ims = $$('#galeria [data-img="' + i + '"]');
        ims.forEach(function(im) {
          if (!im.dataset.real) im.src = c.url;
          im.hidden = false;
        });
        if (!cruzado) {
          var faltan = $$("#galeria .gal-uno img, #galeria .gal-marco img").filter(function(im) {
            return !im.hidden && !im.complete;
          });
          if (faltan.length) {
            var n = faltan.length;
            faltan.forEach(function(im) {
              im.onload = im.onerror = function() {
                if (! --n) aCruzar();
              };
            });
          } else aCruzar();
        }
        siguiente();
      });
    })();
    return cruce;
  }
  function cerrarTanda(sinAnimar) {
    if (!tanda) return;
    tanda.forEach(function(x) {
      [ x.url, x.urlReal ].forEach(function(u) {
        if (u) setTimeout(function() {
          URL.revokeObjectURL(u);
        }, 2e3);
      });
    });
    tanda = null;
    var g = $("#galeria"), t = $("#trabajo");
    if (!g) return;
    if (sinAnimar) {
      g.hidden = true;
      g.innerHTML = "";
      if (t) t.hidden = false;
      return;
    }
    cruzar(g, t);
  }
  function medidas(w, h) {
    return w ? w + " × " + h : "";
  }
  function htmlUno(u, x) {
    var o = x.orig, nombre = "";
    if (x.listo && x.w && (/queda igual/.test(x.nota) || /^\/ver-y-borrar-datos-de-la-foto\//.test(IM_RUTA()))) return '<div class="gal-uno"><img alt="" data-img="' + u + '" src="' + x.url + '"><p class="cmp-medidas">' + medidas(x.w, x.h) + "</p></div>";
    if (!x.listo || !o || !x.w) return '<div class="gal-uno"><img alt="" data-img="' + u + '"' + (x.url ? ' src="' + x.url + '"' : " hidden") + ">" + nombre + "</div>";
    var igual = Math.abs(x.w / x.h - o.w / o.h) / (o.w / o.h) < .01;
    var real = /^\/(agrandar-imagen|comprimir-imagen)\//.test(IM_RUTA()), ancho = real ? Math.round(x.w / (window.devicePixelRatio || 1)) : 0;
    var uRes = x.url, uOrig = o.url;
    if (real) {
      if (x.blob && /image\/(jpeg|png|webp|gif|avif)/.test(x.blob.type)) uRes = x.urlReal || (x.urlReal = URL.createObjectURL(x.blob));
      var ao = archivos.filter(function(a) {
        return a.id === x.origen;
      })[0];
      if (ao && ao.url && /image\/(jpeg|png|webp|gif|avif)/.test(ao.file.type)) uOrig = ao.url;
      if (uRes === x.url) ancho = Math.round(Math.min(x.w, LADO_VISTA) / (window.devicePixelRatio || 1));
    }
    if (igual) return '<div class="gal-uno">' + (real ? '<div class="cmp-marco">' : "") + '<div class="cmp-desliza' + (real ? " real" : "") + '" style="--p:50%' + (real ? ";width:" + ancho + "px" : "") + '" role="group" aria-label="Comparar el original con el resultado">' + '<img alt="Resultado" data-img="' + u + '"' + (uRes !== x.url ? ' data-real="1"' : "") + ' src="' + uRes + '"><img class="cmp-orig" alt="Original" src="' + uOrig + '">' + '<span class="cmp-et izq">Original</span><span class="cmp-et der">Resultado</span>' + '<span class="cmp-linea" role="slider" tabindex="0" aria-label="Línea entre el original y el resultado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span class="cmp-tirador"></span></span></div>' + (real ? "</div>" : "") + '<p class="cmp-medidas">' + medidas(o.w, o.h) + (o.w !== x.w || o.h !== x.h ? " → " + medidas(x.w, x.h) : "") + (real ? " · a tamaño real" : "") + "</p>" + (o.w !== x.w || o.h !== x.h ? '<p class="cmp-aviso">La línea compara la definición, no el tamaño: el original se ve estirado.</p>' : "") + nombre + "</div>";
    return '<div class="gal-uno"><div class="cmp-lado">' + '<figure><div class="cmp-cuadro"><img alt="Original" src="' + o.url + '"></div><figcaption>Original · ' + medidas(o.w, o.h) + "</figcaption></figure>" + '<figure><div class="cmp-cuadro"><img alt="Resultado" data-img="' + u + '" src="' + x.url + '"></div><figcaption>Resultado · ' + medidas(x.w, x.h) + "</figcaption></figure>" + "</div>" + nombre + "</div>";
  }
  function moverLinea(caja, p) {
    p = Math.max(0, Math.min(100, p));
    caja.style.setProperty("--p", p + "%");
    var l = $(".cmp-linea", caja);
    if (l) l.setAttribute("aria-valuenow", Math.round(p));
  }
  document.addEventListener("pointerdown", function(e) {
    var caja = e.target.closest && e.target.closest(".cmp-desliza");
    if (!caja) return;
    e.preventDefault();
    var mover = function(ev) {
      var r = caja.getBoundingClientRect();
      moverLinea(caja, (ev.clientX - r.left) / r.width * 100);
    };
    mover(e);
    caja.setPointerCapture(e.pointerId);
    var fin = function() {
      caja.removeEventListener("pointermove", mover);
      caja.removeEventListener("pointerup", fin);
      caja.removeEventListener("pointercancel", fin);
    };
    caja.addEventListener("pointermove", mover);
    caja.addEventListener("pointerup", fin);
    caja.addEventListener("pointercancel", fin);
  });
  document.addEventListener("keydown", function(e) {
    var l = e.target.closest && e.target.closest(".cmp-linea");
    if (!l || e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    var caja = l.parentNode;
    moverLinea(caja, parseFloat(caja.style.getPropertyValue("--p")) + (e.key === "ArrowLeft" ? -5 : 5));
  });
  document.addEventListener("scroll", function(e) {
    var m = e.target;
    if (!m.classList || !m.classList.contains("cmp-marco")) return;
    var d = m.firstElementChild;
    d.style.setProperty("--arriba", m.scrollTop + "px");
    d.style.setProperty("--medio", m.scrollTop + m.clientHeight / 2 + "px");
  }, true);
  function conVisibles(fn) {
    if (!tanda) return fn();
    var n = nPosible(tanda.length), desde = n === 1 ? Math.min(tandaUno, tanda.length - 1) : Math.max(0, Math.min(tandaLote, Math.floor((tanda.length - 1) / n) * n));
    var urls = [];
    tanda.slice(desde, desde + n).forEach(function(y) {
      [ y.url, y.urlReal, y.orig && y.orig.url ].forEach(function(u) {
        if (u) urls.push(u);
      });
    });
    var real = /^\/(agrandar-imagen|comprimir-imagen)\//.test(IM_RUTA());
    if (real && n === 1) {
      var y = tanda[desde];
      if (y && y.blob && !y.urlReal && /image\/(jpeg|png|webp|gif|avif)/.test(y.blob.type)) {
        y.urlReal = URL.createObjectURL(y.blob);
        urls.push(y.urlReal);
      }
    }
    if (real && n === 1) {
      var y0 = tanda[desde], ao = y0 && archivos.filter(function(a) {
        return a.id === y0.origen;
      })[0];
      if (ao && ao.url) urls.push(ao.url);
    }
    var esta = tanda;
    Promise.all(urls.map(function(u) {
      var im = new Image;
      im.src = u;
      return im.decode ? im.decode().catch(function() {}) : Promise.resolve();
    })).then(function() {
      if (tanda === esta) fn();
    });
  }
  function pintarTanda() {
    var g = $("#galeria");
    if (!g || !tanda) return;
    var total = tanda.length, n = nPosible(total);
    tandaLote = Math.max(0, Math.min(tandaLote, Math.floor((total - 1) / n) * n));
    var cuerpo;
    if (n === 1) {
      var u = Math.min(tandaUno, total - 1);
      cuerpo = htmlUno(u, tanda[u]);
    } else {
      cuerpo = '<div class="gal-grilla n' + n + '">' + tanda.slice(tandaLote, tandaLote + n).map(function(x, k) {
        var i = tandaLote + k;
        return '<button type="button" class="gal-cuadro' + (i === tandaUno ? " elegido" : "") + '" data-i="' + i + '"><span class="gal-marco"><img alt="" data-img="' + i + '"' + (x.url ? ' src="' + x.url + '"' : " hidden") + '></span><span class="gal-nombre">' + esc(x.nombre) + "</span></button>";
      }).join("") + "</div>";
    }
    var hayRest = !!$("#trabajo .restablecer");
    g.innerHTML = (hayRest ? '<p class="res-rotulo visor-rotulo"><button type="button" class="restablecer" data-desde-resultados="1">Restablecer</button></p>' : '<p class="res-rotulo visor-rotulo" aria-hidden="true" style="visibility:hidden">·</p>') + (total === 1 && archivos.length > 1 ? htmlBarraVer("", 2, 1, 0).replace('class="ver-barra"', 'class="ver-barra" style="visibility:hidden" aria-hidden="true"') : htmlBarraVer("", total, n, n === 1 ? Math.min(tandaUno, total - 1) : tandaLote)) + cuerpo;
  }
  document.addEventListener("click", function(e) {
    var g = $("#galeria");
    if (!g || !g.contains(e.target) || !tanda) return;
    if (e.target.closest("[data-desde-resultados]")) {
      cerrarTanda();
      var rb = $("#trabajo .restablecer");
      if (rb) rb.click();
      return;
    }
    var b = e.target.closest("[data-ver]"), l = e.target.closest("[data-lote]"), c = e.target.closest(".gal-cuadro");
    if (b) {
      verN = +b.dataset.ver;
      tandaLote = Math.floor(tandaUno / nPosible(tanda.length)) * nPosible(tanda.length);
      conVisibles(function() {
        cambiarAlto(g, pintarTanda);
      });
      oyentesVer.forEach(function(f) {
        f();
      });
    } else if (l) {
      var nn = nPosible(tanda.length);
      if (nn === 1) {
        tandaUno = Math.max(0, Math.min(tanda.length - 1, tandaUno + +l.dataset.lote));
        tandaLote = tandaUno;
      } else tandaLote += +l.dataset.lote * nn;
      conVisibles(function() {
        cambiarAlto(g, pintarTanda);
      });
    } else if (c) {
      tandaUno = +c.dataset.i;
      verN = 1;
      var o = tanda[tandaUno].origen;
      if (o != null && archivos.some(function(a) {
        return a.id === o;
      })) {
        elegidoId = o;
        marcarElegido();
        verRenglon(o);
      }
      conVisibles(function() {
        cambiarAlto(g, pintarTanda);
      });
      oyentesVer.forEach(function(f) {
        f();
      });
    }
  });
  var oyentesVer = [];
  var MAX_MB = 500;
  function pesoDe(x) {
    return x.files.reduce(function(t, f) {
      return t + f.size;
    }, 0);
  }
  function pesoGuardado() {
    return resultados.reduce(function(t, x) {
      return t + pesoDe(x);
    }, 0);
  }
  function zipDe(files, nombre) {
    var m = {}, usados = {};
    return Promise.all(files.map(function(f) {
      return f.arrayBuffer();
    })).then(function(bufs) {
      files.forEach(function(f, i) {
        var n = f.name, k = 2;
        while (usados[n]) n = f.name.replace(/(\.\w+)$/, "-" + k++ + "$1");
        usados[n] = 1;
        m[n] = [ new Uint8Array(bufs[i]), {
          level: 0
        } ];
      });
      return new File([ fflate.zipSync(m) ], nombre || "resultados.zip", {
        type: "application/zip"
      });
    });
  }
  function bajarBloque(x) {
    if (x.files.length === 1) descargar(x.files[0]); else zipDe(x.files, x.nombreZip).then(descargar);
  }
  function entregar(l, prep, nombreZip) {
    var files = l.map(function(r) {
      var ext = (r.nombre.match(/\.(\w+)$/) || [ , "" ])[1].toLowerCase();
      var f = new File([ r.blob ], r.nombre, {
        type: r.blob.type || MIME_EXT[ext] || "application/octet-stream"
      });
      f._nota = r.nota || "";
      return f;
    });
    var x = {
      files: files,
      nota: files.length === 1 ? files[0]._nota : "",
      nombreZip: nombreZip || "resultados.zip",
      nuevo: true
    };
    var n = files.length, pe = peso(pesoDe(x)), zip = x.nombreZip;
    if (resultados.length >= MAX_RES) {
      bajarBloque(x);
      avisoResultados = "Se guardan hasta " + MAX_RES + " resultados o " + MAX_MB + " MB, y ya no hay lugar: " + (n === 1 ? files[0].name + " se descargó y no quedó guardado acá." : "los " + n + " archivos de este resultado se descargaron juntos en " + zip + " y no quedaron guardados acá.");
    } else if (pesoGuardado() + pesoDe(x) > MAX_MB * 1048576) {
      bajarBloque(x);
      avisoResultados = n === 1 ? files[0].name + " pesa " + pe + ": se descargó y no quedó guardado acá." : "Este resultado pesa " + pe + ": se descargaron los " + n + " archivos juntos en " + zip + " y no quedaron guardados acá.";
    } else {
      resultados = [ x ].concat(resultados);
      var lleno = resultados.length >= MAX_RES || pesoGuardado() >= MAX_MB * 1048576 * .98;
      avisoResultados = lleno ? "Se guardan hasta " + MAX_RES + " resultados o " + MAX_MB + " MB: el próximo se descarga solo (si son varios archivos, en un ZIP)." : "";
    }
    pintarResultados();
  }
  function descargar(f) {
    if (ESCRITORIO && window.__TAURI__) {
      f.arrayBuffer().then(function(b) {
        return window.__TAURI__.core.invoke("guardar", new Uint8Array(b), {
          headers: {
            nombre: encodeURIComponent(f.name)
          }
        });
      }).catch(function(e) {
        aviso("No se pudo guardar " + f.name + ".");
        console.error(e);
      });
      return;
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() {
      URL.revokeObjectURL(a.href);
    }, 6e4);
  }
  function miniResultado(f) {
    if (/^image\/(jpeg|png|webp|gif|avif|svg)/.test(f.type)) return '<img class="mini" alt="" src="' + URL.createObjectURL(f) + '">';
    return '<span class="mini">' + (f.name.match(/\.(\w+)$/) || [ , "" ])[1].toUpperCase().slice(0, 4) + "</span>";
  }
  var MAX_RES = 5, VISIBLES_RES = 5;
  function filaResultado(x, i) {
    if (x.files.length > 1) {
      return '<li class="res-fila res-grupo" data-i="' + i + '">' + miniResultado(x.files[0]) + '<span class="nombre">' + x.files.length + " archivos · " + peso(pesoDe(x)) + "</span>" + '<span class="res-acc"><button type="button" class="boton-borde" data-r="bajar" data-i="' + i + '">Descargar todos (ZIP)</button>' + '<button type="button" class="quitar ver-uno" data-r="ver" data-i="' + i + '" aria-expanded="false">Ver uno por uno<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' + '<button type="button" class="quitar" data-r="quitar" data-i="' + i + '">Quitar</button></span>' + '<ul class="res-sub" hidden>' + x.files.map(function(f, j) {
        return "<li>" + miniResultado(f) + '<span class="nombre">' + esc(f.name) + (f._nota ? '<small class="res-nota">' + esc(f._nota) + "</small>" : "") + '</span><span class="peso">' + peso(f.size) + "</span>" + '<button type="button" class="boton-borde" data-r="bajar1" data-i="' + i + '" data-j="' + j + '">Descargar</button></li>';
      }).join("") + "</ul></li>";
    }
    var f = x.files[0];
    return '<li class="res-fila" data-i="' + i + '">' + miniResultado(f) + '<span class="nombre">' + esc(f.name) + (x.nota ? '<small class="res-nota">' + esc(x.nota) + "</small>" : "") + '</span><span class="peso">' + peso(f.size) + "</span>" + '<span class="res-acc"><button type="button" class="boton-borde" data-r="bajar" data-i="' + i + '">Descargar</button>' + '<button type="button" class="quitar" data-r="quitar" data-i="' + i + '">Quitar</button>' + (/^image\//.test(f.type) ? '<button type="button" class="quitar" data-r="agregar" data-i="' + i + '">Agregar a la lista</button>' + (VISTA ? "" : '<button type="button" class="quitar" data-r="usar" data-i="' + i + '">Usar en otra herramienta</button>') : "") + "</span></li>";
  }
  function pintarResultados() {
    var r = $("#resultados");
    if (!r) return;
    var habia = !!$(".res-caja", r);
    if (!resultados.length) {
      var caja0 = $(".res-caja", r);
      if (caja0) {
        var nb = $(".res-nota-borrado", r);
        if (nb) contraer(nb);
        contraer(caja0, function() {
          r.innerHTML = avisoHtml();
        });
      } else r.innerHTML = avisoHtml();
      return;
    }
    r.innerHTML = avisoHtml() + '<div class="res-caja"><p class="res-rotulo">Resultados</p><ul class="res-lista">' + resultados.map(filaResultado).join("") + "</ul>" + '<div class="res-pie' + (resultados.length < 2 ? " uno" : "") + '"><button type="button" class="quitar-todos" data-r="todos"' + (resultados.length < 2 ? ' tabindex="-1" aria-hidden="true"' : "") + ">Quitar todos</button>" + '<button type="button" class="boton-principal bajar-todos" data-r="bajartodos"' + (resultados.length < 2 ? ' tabindex="-1" aria-hidden="true"' : "") + ">Descargar todos</button></div></div>" + '<p class="res-nota-borrado">Tus archivos y resultados se borran al cerrar o recargar la pestaña.</p>';
    var caja = $(".res-caja", r), ul = $(".res-lista", r), filas = $$(".res-fila", r);
    if (filas.length > VISIBLES_RES) {
      ul.style.maxHeight = filas[VISIBLES_RES].offsetTop - filas[0].offsetTop + "px";
      ul.classList.add("desborda");
    }
    if (!habia) {
      expandir(caja);
      expandir($(".res-nota-borrado", r));
    } else resultados.forEach(function(x, i) {
      if (x.nuevo) expandir(filas[i]);
    });
    if (habia && pieAntes < 2 && resultados.length > 1) expandir($(".res-pie", r));
    pieAntes = resultados.length;
    resultados.forEach(function(x) {
      x.nuevo = false;
    });
    var av = $(".aviso-res", r);
    if (av && avisoResultados) expandir(av);
    $$("button[data-r]", r).forEach(function(b) {
      b.addEventListener("click", function() {
        var i = +b.dataset.i, x = resultados[i];
        if (b.dataset.r === "todos") {
          avisoResultados = "";
          var nb2 = $(".res-nota-borrado", r);
          if (nb2) contraer(nb2);
          contraer(caja, function() {
            resultados = [];
            r.innerHTML = "";
          });
        }
        var ultimo = resultados.length === 1 && (b.dataset.r === "quitar" || b.dataset.r === "agregar");
        if (ultimo) {
          avisoResultados = "";
          if (b.dataset.r === "agregar") agregarArchivo(x.files[0]);
          var nb3 = $(".res-nota-borrado", r);
          if (nb3) contraer(nb3);
          contraer(caja, function() {
            resultados = [];
            r.innerHTML = avisoHtml();
            if (b.dataset.r === "agregar") pintar();
          });
          return;
        }
        if (b.dataset.r === "quitar") {
          avisoResultados = "";
          if (resultados.length === 2) {
            var pie = $(".res-pie", r);
            contraer(pie, function() {
              pie.classList.add("uno");
              pie.style.overflow = "";
            });
          }
          contraer(filas[i], function() {
            resultados.splice(i, 1);
            pintarResultados();
          });
        }
        if (b.dataset.r === "agregar") {
          agregarArchivo(x.files[0]);
          avisoResultados = "";
          contraer(filas[i], function() {
            resultados.splice(i, 1);
            pintar();
            pintarResultados();
          });
        }
        if (b.dataset.r === "bajar") bajarBloque(x);
        if (b.dataset.r === "bajar1") descargar(x.files[+b.dataset.j]);
        if (b.dataset.r === "ver") {
          var sub = $(".res-sub", filas[i]), abre = sub.hidden;
          b.setAttribute("aria-expanded", abre ? "true" : "false");
          if (abre) {
            sub.hidden = false;
            expandir(sub);
          } else contraer(sub, function() {
            sub.hidden = true;
            sub.style.overflow = "";
          });
        }
        if (b.dataset.r === "usar") usarEnOtra(x.files[0]);
        if (b.dataset.r === "bajartodos") resultados.slice().reverse().forEach(function(y, k) {
          setTimeout(function() {
            bajarBloque(y);
          }, k * 250);
        });
      });
    });
  }
  var pieAntes = 0;
  window.addEventListener("beforeunload", function(e) {
    if (!archivos.length && !resultados.length) return;
    if (saliendoConArchivos && !resultados.length) return;
    e.preventDefault();
    e.returnValue = "";
  });
  function avisoHtml() {
    return avisoResultados ? '<p class="aviso-res">' + esc(avisoResultados) + "</p>" : "";
  }
  window.IM = {
    archivos: function() {
      return soloAptos ? aptos(ruta.slug) : archivos.slice();
    },
    alCambiarArchivos: function(f) {
      oyentesArchivos.push(f);
    },
    alCambiarOpcion: function(f) {
      oyentesOpcion.push(f);
    },
    opcion: function(rotulo) {
      var d = $$(".h-opciones .desp").filter(function(x) {
        return IM_ES($(".desp-rotulo", x)).replace(/:$/, "") === rotulo;
      })[0];
      return d ? IM_ES($(".desp-valor", d)) : null;
    },
    multi: function(rotulo) {
      var d = $$(".h-opciones .desp").filter(function(x) {
        return IM_ES($(".desp-rotulo", x)).replace(/:$/, "") === rotulo;
      })[0];
      return d ? $$('li[aria-selected="true"]', d).map(function(li) {
        return IM_ES(li);
      }) : [];
    },
    botonHabilitado: function(si) {
      botonQuiere = !!si;
      ponerBoton();
    },
    botonTexto: function(t) {
      var b = $("#procesar");
      if (!b || !t) return;
      var antes = IM_ES(b);
      b.textContent = t;
      if (antes !== t) $$(".h-sec li").forEach(function(li) {
        var es = IM_ES(li);
        if (es.indexOf('"' + antes + '"') >= 0) li.textContent = es.split('"' + antes + '"').join('"' + t + '"');
      });
    },
    descargar: descargar,
    repintarLista: function() {
      sinAvisar = true;
      try {
        pintar();
      } finally {
        sinAvisar = false;
      }
    },
    aviso: aviso,
    procesar: procesar,
    capaEspera: capaEspera,
    peso: peso,
    textoError: function(e) {
      return (TEXTO_ERROR[e.codigo] || TEXTO_ERROR.error)(e);
    },
    expandir: expandir,
    contraer: contraer,
    cambiarAlto: cambiarAlto,
    altoSuave: function(el, c, cc) {
      junto(function() {
        altoSuave(el, c, cc);
      });
    },
    suavizarAlto: suavizarAlto,
    mostrarSuave: function(el) {
      junto(function() {
        mostrarSuave(el);
      });
    },
    esperarPrevia: esperarPrevia,
    junto: junto,
    ocultarSuave: ocultarSuave,
    mostrarOpcion: mostrarOpcion,
    ocultarValores: ocultarValores,
    ponerOpcion: function(rotulo, valor) {
      var d = despDe(rotulo);
      if (!d) return;
      var li = $$("li", d).filter(function(x) {
        return IM_ES(x).toLowerCase() === String(valor).toLowerCase();
      })[0];
      if (li && IM_ES($(".desp-valor", d)) !== IM_ES(li)) elegirValor(d, li);
    },
    usarEleccion: function() {
      conVisor = true;
      marcarElegido();
    },
    elegirIndice: function(i) {
      if (archivos[i]) elegirArchivo(archivos[i].id);
    },
    etiquetas: function(fn) {
      etiquetaFn = fn;
      pintarEtiquetas();
    },
    pintarEtiquetas: function() {
      pintarEtiquetas();
    },
    ver: function() {
      return verN;
    },
    ponerVer: function(n) {
      verN = n;
      oyentesVer.forEach(function(f) {
        f();
      });
    },
    alCambiarVer: function(f) {
      oyentesVer.push(f);
    },
    nVer: nPosible,
    htmlBarraVer: htmlBarraVer,
    alElegirArchivo: function(f) {
      oyentesElegir.push(f);
    },
    elegido: function() {
      var i = archivos.findIndex(function(a) {
        return a.id === elegidoId;
      });
      return i < 0 ? 0 : i;
    }
  };
  var FORM = '<form class="escribinos" onsubmit="return false"><h3>Escribinos</h3><p>Contanos qué pasó, qué mejorarías o lo que quieras preguntar.</p>' + '<label>Tu mensaje<textarea rows="4"></textarea></label><label>Tu correo (opcional: dejalo solo si querés que te respondamos)<input type="email"></label>' + '<button type="submit" class="boton-principal">Enviar</button><p class="enviado" hidden>Recibido. Gracias por escribirnos.</p><p class="form-error" role="alert" hidden></p></form>';
  var configSitio = null;
  function config() {
    return configSitio || (configSitio = (VISTA ? Promise.resolve({}) : fetch("/api/config").then(function(r) {
      return r.ok ? r.json() : {};
    })).catch(function() {
      return {};
    }));
  }
  var scriptTurnstile = null;
  function cargarTurnstile() {
    return scriptTurnstile || (scriptTurnstile = new Promise(function(ok, mal) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = function() {
        ok();
      };
      s.onerror = function() {
        scriptTurnstile = null;
        mal();
      };
      document.head.appendChild(s);
    }));
  }
  function prepararVerificacion(f) {
    if (f._prep) return f._prep;
    return f._prep = config().then(function(c) {
      if (!c.turnstile) return null;
      return cargarTurnstile().then(function() {
        var caja = document.createElement("div");
        caja.className = "verificacion";
        $("button[type=submit]", f).insertAdjacentElement("beforebegin", caja);
        f._tsId = window.turnstile.render(caja, {
          sitekey: c.turnstile,
          appearance: "interaction-only",
          execution: "execute",
          language: "es",
          callback: function(tk) {
            var cb = f._alToken;
            f._alToken = null;
            if (cb) cb(tk);
          },
          "error-callback": function() {
            var cb = f._alToken;
            f._alToken = null;
            if (cb) cb("");
          }
        });
        return f._tsId;
      });
    });
  }
  function tokenNuevo(f) {
    return prepararVerificacion(f).then(function(id) {
      if (id === null || id === undefined) return null;
      return new Promise(function(ok) {
        f._alToken = ok;
        if (f._usado) window.turnstile.reset(id);
        f._usado = true;
        window.turnstile.execute(id);
      });
    });
  }
  function activarForm(r) {
    var f = $("form.escribinos", r);
    if (!f) return;
    var boton = $("button[type=submit]", f), err = $(".form-error", f), ok = $(".enviado", f);
    f.addEventListener("focusin", function() {
      prepararVerificacion(f).catch(function() {});
    });
    function mostrarError(t) {
      err.textContent = t;
      if (err.hidden) {
        err.hidden = false;
        expandir(err);
      }
    }
    f.addEventListener("submit", function() {
      if (boton.disabled) return;
      var texto = $("textarea", f).value.trim(), correo = $("input[type=email]", f).value.trim();
      if (!texto) {
        mostrarError("Escribí tu mensaje.");
        return;
      }
      if (!err.hidden) contraer(err, function() {
        err.hidden = true;
        err.style.overflow = "";
      });
      boton.disabled = true;
      boton.textContent = "Enviando…";
      var ts = f.closest("#ts-respuesta"), causa = ts && $(".ts-causas button[aria-pressed=true]", ts);
      tokenNuevo(f).then(function(tk) {
        if (tk === "") throw 0;
        return fetch("/api/mensaje", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            tipo: ts ? "te-sirvio" : "escribinos",
            herramienta: ruta.tipo === "herramienta" ? ruta.slug : "",
            causa: causa ? IM_ES(causa) : "",
            mensaje: texto,
            correo: correo,
            token: tk
          })
        });
      }).then(function(r) {
        if (!r.ok) throw 0;
        return r.json();
      }).then(function(d) {
        if (!d || !d.ok) throw 0;
        $("textarea", f).value = "";
        $("input[type=email]", f).value = "";
        if (ok.hidden) {
          ok.hidden = false;
          expandir(ok);
        }
      }).catch(function() {
        mostrarError("No se pudo enviar. Probá de nuevo en un rato.");
      }).then(function() {
        boton.disabled = false;
        boton.textContent = "Enviar";
      });
    });
  }
  function rango(n, cortes, nombres) {
    for (var i = 0; i < cortes.length; i++) if (n <= cortes[i]) return nombres[i];
    return nombres[nombres.length - 1];
  }
  function contar(d) {
    if (VISTA || navigator.onLine === false) return;
    d.herramienta = ruta.tipo === "herramienta" ? ruta.slug : "portada";
    var tot = archivos.reduce(function(s, a) {
      return s + a.file.size;
    }, 0);
    d.cantidad = archivos.length ? rango(archivos.length, [ 1, 5, 20 ], [ "1", "2-5", "6-20", "21+" ]) : "";
    d.tamano = archivos.length ? rango(tot / 1048576, [ 1, 10, 50 ], [ "<1 MB", "1-10 MB", "10-50 MB", "50 MB+" ]) : "";
    d.opciones = $$(".h-opciones .desp").filter(function(x) {
      return !x.closest("[hidden]");
    }).map(function(x) {
      return IM_ES($(".desp-rotulo", x)).replace(/:$/, "") + ": " + IM_ES($(".desp-valor", x));
    }).join(" · ").slice(0, 600);
    try {
      var cuerpo = JSON.stringify(d);
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/contar", new Blob([ cuerpo ], {
        type: "application/json"
      })))) fetch("/api/contar", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: cuerpo,
        keepalive: true
      }).catch(function() {});
    } catch (e) {}
  }
  function teSirvio() {
    var r = $("#ts-respuesta");
    $$("[data-ts]").forEach(function(b) {
      b.addEventListener("click", function() {
        if (!r.dataset.contado) {
          r.dataset.contado = "1";
          contar({
            accion: "te-sirvio",
            resultado: b.dataset.ts === "si" ? "si" : "no"
          });
        }
        if (b.dataset.ts === "si") {
          cambiarAlto(r, function() {
            var f = (window.TR || String)("Nos alegra. Si creés que podemos mejorar algo, <a>podés escribirnos</a>.");
            r.innerHTML = "<p>" + f.replace("<a>", '<a href="' + (window.IM_URL ? IM_URL("/escribinos/") : "/escribinos/") + '">') + "</p>";
          });
          return;
        }
        cambiarAlto(r, function() {
          r.innerHTML = '<p>Lamentamos que no te haya servido. ¿Qué pasó?</p><div class="ts-causas">' + [ "Dio un error", "El resultado no fue el que esperaba", "Le faltó algo que necesitaba", "Otra cosa" ].map(function(c) {
            return '<button type="button">' + c + "</button>";
          }).join("") + "</div>";
        });
        $$(".ts-causas button", r).forEach(function(c) {
          c.addEventListener("click", function() {
            $$(".ts-causas button", r).forEach(function(o) {
              o.setAttribute("aria-pressed", o === c);
            });
            if (!$("form", r)) {
              r.insertAdjacentHTML("beforeend", FORM);
              activarForm(r);
              expandir($("form", r));
            }
          });
        });
      });
    });
  }
  document.addEventListener("click", function(e) {
    var sum = e.target.closest && e.target.closest("details > summary");
    if (!sum || QUIETO || !sum.parentNode.animate) return;
    var det = sum.parentNode;
    e.preventDefault();
    if (det.dataset.animando) return;
    det.dataset.animando = "1";
    var inicio = det.offsetHeight, fin, anim;
    det.style.overflow = "hidden";
    if (!det.open) {
      det.open = true;
      fin = det.offsetHeight;
      anim = det.animate([ {
        height: inicio + "px"
      }, {
        height: fin + "px"
      } ], {
        duration: DUR,
        easing: RESORTE
      });
      $$("p", det).forEach(function(p) {
        p.animate([ {
          opacity: 0
        }, {
          opacity: 1
        } ], {
          duration: DUR,
          easing: RESORTE
        });
      });
      anim.onfinish = function() {
        det.style.overflow = "";
        delete det.dataset.animando;
      };
    } else {
      fin = sum.offsetHeight + parseFloat(getComputedStyle(det).paddingTop) + parseFloat(getComputedStyle(det).paddingBottom);
      anim = det.animate([ {
        height: inicio + "px"
      }, {
        height: fin + "px"
      } ], {
        duration: DUR,
        easing: RESORTE
      });
      $$("p", det).forEach(function(p) {
        p.animate([ {
          opacity: 1
        }, {
          opacity: 0
        } ], {
          duration: DUR,
          easing: RESORTE,
          fill: "forwards"
        }).onfinish = function() {
          this.cancel();
        };
      });
      anim.onfinish = function() {
        det.open = false;
        det.style.overflow = "";
        delete det.dataset.animando;
      };
    }
  });
  $$("[data-cripto]").forEach(function(a) {
    a.addEventListener("click", function(e) {
      e.preventDefault();
      var ok = function() {
        var t = a.textContent;
        a.textContent = "Dirección copiada";
        setTimeout(function() {
          a.textContent = t;
        }, 2200);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(a.dataset.cripto).then(ok, function() {});
    });
  });
  function pintarTexto(slug) {
    var v = vistas.texto, html = "";
    if (slug === "preguntas-frecuentes") {
      html = "<h1>Preguntas frecuentes</h1>" + faqHtml(C.comunes) + FORM;
      document.title = "Preguntas frecuentes — Imagomakk";
    } else if (slug === "escribinos") {
      html = FORM.replace("<h3>Escribinos</h3>", "<h1>Escribinos</h1>");
      document.title = "Escribinos — Imagomakk";
    } else {
      var enLista = false, enPasos = false;
      C.paginas[slug].forEach(function(b) {
        if (b[0] !== "li" && enLista) {
          html += "</ul>";
          enLista = false;
        }
        if (b[0] !== "ol" && enPasos) {
          html += "</ol>";
          enPasos = false;
        }
        if (b[0] === "li" && !enLista) {
          html += "<ul>";
          enLista = true;
        }
        if (b[0] === "ol" && !enPasos) {
          html += "<ol>";
          enPasos = true;
        }
        if (b[0] === "ol") {
          html += "<li>" + esc(b[1]) + "</li>";
          return;
        }
        if (b[0] === "widget") {
          html += '<div class="sa-caja" id="sa-caja"></div>';
          return;
        }
        if (b[0] === "q") {
          html += "<details><summary>" + esc(b[1]) + "</summary><p>" + esc(b[2]).replace(/support@thormakk\.dev/g, '<a href="mailto:support@thormakk.dev">support@thormakk.dev</a>') + "</p></details>";
          return;
        }
        var t = esc(b[1]).replace(/(https?:\/\/[^\s]+?)([.,]?)(\s|$)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>$2$3').replace(/support@thormakk\.dev/g, '<a href="mailto:support@thormakk.dev">support@thormakk.dev</a>');
        var ancla = b[0] === "h2" ? ' id="' + b[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + '"' : "";
        html += "<" + b[0] + ancla + ">" + t + "</" + b[0] + ">";
        if (b[0] === "h1") document.title = b[1] + " — Imagomakk";
      });
      if (enLista) html += "</ul>";
      if (enPasos) html += "</ol>";
    }
    v.innerHTML = '<div class="envoltura texto-cuerpo"><div class="texto-legal"><p class="volver"><a href="/">← Inicio</a></p>' + html + '<aside class="anuncio anuncio-franja-herr" aria-label="Publicidad"><div>Espacio fijo 728 × 90<small data-anuncio-carga></small></div></aside></div>' + '<aside class="texto-lado" aria-label="Publicidad"><div class="anuncio anuncio-herr"><div>Espacio fijo 300 × 250<small data-anuncio-carga></small></div></div></aside></div>';
    activarForm(v);
    if ($("#sa-caja", v)) pintarSinAnuncios();
  }
  var SA = "imagomakk-sin-anuncios", SA_VISTA = "imagomakk-sin-anuncios-confirmada";
  function claveGuardada() {
    try {
      return JSON.parse(localStorage.getItem(SA) || "null");
    } catch (e) {
      return null;
    }
  }
  function guardarClave(c) {
    try {
      if (c) localStorage.setItem(SA, JSON.stringify(c)); else {
        localStorage.removeItem(SA);
        sessionStorage.removeItem(SA_VISTA);
      }
    } catch (e) {}
    document.documentElement.classList.toggle("sin-anuncios", !!c);
    document.documentElement.dataset.anuncio = c ? "ninguno" : "columna";
  }
  function fechaLarga(iso) {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }
  function nombreNavegador() {
    var u = navigator.userAgent, n = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Navegador";
    var s = /Windows/.test(u) ? "Windows" : /iPhone|iPad/.test(u) ? "iPhone o iPad" : /Mac OS X|Macintosh/.test(u) ? "Mac" : /Android/.test(u) ? "Android" : /Linux/.test(u) ? "Linux" : "otro sistema";
    return n + " en " + s;
  }
  function pedirClave(ruta, datos) {
    return fetch("/api/clave/" + ruta, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(datos)
    }).then(function(r) {
      return r.json().catch(function() {
        return {};
      }).then(function(d) {
        d._http = r.status;
        return d;
      });
    });
  }
  function confirmarClave() {
    var c = claveGuardada();
    if (!c || VISTA) return;
    try {
      if (sessionStorage.getItem(SA_VISTA)) return;
    } catch (e) {}
    if (c.vence && new Date(c.vence) <= new Date) {
      guardarClave(null);
      return;
    }
    pedirClave("validar", {
      clave: c.clave,
      activacion: c.activacion
    }).then(function(d) {
      if (d.vigente) {
        try {
          sessionStorage.setItem(SA_VISTA, "1");
        } catch (e) {}
        if (d.vence && d.vence !== c.vence) {
          c.vence = d.vence;
          guardarClave(c);
        }
      } else if (d.vigente === false) {
        guardarClave(null);
        if ($("#sa-caja")) pintarSinAnuncios();
      }
    }, function() {});
  }
  function pintarSinAnuncios(mensaje, lista) {
    var caja = $("#sa-caja");
    if (!caja) return;
    var c = claveGuardada(), h = "";
    if (c) {
      h = '<p class="sa-estado">' + esc(mensaje && mensaje.ok ? mensaje.ok : "Imagomakk no mostrará anuncios en este navegador hasta el " + fechaLarga(c.vence) + ".") + "</p>" + '<button type="button" class="boton-borde" id="sa-liberar-propio">Liberar este navegador</button>';
    } else {
      h = '<a class="boton-principal sa-comprar" id="sa-comprar" href="#" target="_blank" rel="noopener">Comprar</a>' + '<form class="sa-form" id="sa-form" onsubmit="return false"><label>Tu clave<input type="text" id="sa-clave" autocomplete="off" spellcheck="false"></label>' + '<button type="submit" class="boton-borde" id="sa-activar">Activar</button></form>' + (mensaje && mensaje.error ? '<p class="sa-error" role="alert">' + esc(mensaje.error) + "</p>" : "") + (lista ? '<ul class="sa-lista">' + lista.map(function(a) {
        return "<li><span>" + esc(a.etiqueta) + " · activada el " + esc(fechaLarga(a.fecha)) + '</span><button type="button" class="quitar" data-liberar="' + esc(a.id) + '">Liberar</button></li>';
      }).join("") + "</ul>" : "");
    }
    caja.innerHTML = h;
    var comprar = $("#sa-comprar", caja);
    if (comprar) config().then(function(cf) {
      if (cf.comprar) comprar.href = cf.comprar; else comprar.removeAttribute("href");
    });
    var lp = $("#sa-liberar-propio", caja);
    if (lp) lp.addEventListener("click", function() {
      lp.disabled = true;
      pedirClave("liberar", {
        clave: c.clave,
        activacion: c.activacion
      }).then(function(d) {
        if (d.ok) {
          guardarClave(null);
          pintarSinAnuncios();
        } else {
          lp.disabled = false;
        }
      }, function() {
        lp.disabled = false;
        pintarSinAnuncios({
          error: "No se pudo conectar. Probá de nuevo en un rato."
        });
      });
    });
    var f = $("#sa-form", caja);
    if (f) f.addEventListener("submit", function() {
      activarClave($("#sa-clave", caja).value.trim());
    });
    $$("[data-liberar]", caja).forEach(function(b) {
      b.addEventListener("click", function() {
        var clave = caja.dataset.clave;
        b.disabled = true;
        pedirClave("liberar", {
          clave: clave,
          activacion: b.dataset.liberar
        }).then(function(d) {
          if (d.ok) activarClave(clave); else {
            b.disabled = false;
            pintarSinAnuncios({
              error: "No se pudo conectar. Probá de nuevo en un rato."
            });
          }
        }, function() {
          b.disabled = false;
          pintarSinAnuncios({
            error: "No se pudo conectar. Probá de nuevo en un rato."
          });
        });
      });
    });
  }
  function activarClave(clave) {
    var caja = $("#sa-caja");
    if (!clave || !caja) return;
    var b = $("#sa-activar", caja);
    if (b) {
      b.disabled = true;
      b.textContent = "Activando…";
    }
    pedirClave("activar", {
      clave: clave,
      etiqueta: nombreNavegador()
    }).then(function(d) {
      if (d.estado === "activa") {
        guardarClave({
          clave: clave,
          activacion: d.activacion,
          vence: d.vence
        });
        try {
          sessionStorage.setItem(SA_VISTA, "1");
        } catch (e) {}
        pintarSinAnuncios({
          ok: "Listo. Imagomakk no mostrará anuncios en este navegador hasta el " + fechaLarga(d.vence) + "."
        });
        return;
      }
      var m = d.estado === "invalida" ? "Esa clave no es válida. Revisá que esté completa, tal como llegó en el correo de Polar." : d.estado === "vencida" ? d.vence ? "Esa clave venció el " + fechaLarga(d.vence) + "." : "Esa clave ya no está activa." : d.estado === "inactiva" ? "Esa clave ya no está activa." : d.estado === "sin-lugar" ? "Esta clave ya está activa en 3 navegadores. Para activarla acá, liberá uno:" : "No se pudo conectar. Probá de nuevo en un rato.";
      caja.dataset.clave = clave;
      pintarSinAnuncios({
        error: m
      }, d.estado === "sin-lugar" ? d.activaciones : null);
      var i = $("#sa-clave", caja);
      if (i) i.value = clave;
    }, function() {
      pintarSinAnuncios({
        error: "No se pudo conectar. Probá de nuevo en un rato."
      });
      var i = $("#sa-clave", caja);
      if (i) i.value = clave;
    });
  }
  mostrar();
  primeraCarga = false;
  document.documentElement.classList.add("armada");
  recibirEntrega();
  confirmarClave();
  if (!VISTA) pedirAlQueAbrio();
  if (!ESCRITORIO && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function() {
      navigator.serviceWorker.register("/sw.js").catch(function() {});
      var c = navigator.connection;
      if (c && c.saveData) return;
      navigator.serviceWorker.ready.then(function(reg) {
        setTimeout(function() {
          var pedir = function() {
            if (reg.active) reg.active.postMessage({
              tipo: "imagomakk-livianos"
            });
          };
          if (window.requestIdleCallback) requestIdleCallback(pedir, {
            timeout: 1e4
          }); else pedir();
        }, 8e3);
      });
    });
  }
})();