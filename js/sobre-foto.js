(function() {
  "use strict";
  var H = window.IMHerramientas, U = H._util;
  var Visor = U.Visor, $ = U.$, $$ = U.$$, esc = U.esc, base = U.base, num = U.num, debounce = U.debounce, campo = U.campo, mostrarSi = U.mostrarSi;
  var LETRAS = {
    "Clásica de memes": {
      fam: "IM Anton",
      url: "/fuentes/anton-latin-400-normal.woff2",
      peso: "400"
    },
    Moderna: {
      fam: "IM Inter",
      url: "/fuentes/inter-latin-700-normal.woff2",
      peso: "700"
    },
    Elegante: {
      fam: "IM Instrument",
      url: "/fuentes/instrument-serif-latin-400-normal.woff2",
      peso: "400"
    },
    Manuscrita: {
      fam: "IM Caveat",
      url: "/fuentes/caveat-latin-700-normal.woff2",
      peso: "700"
    },
    Marcador: {
      fam: "IM Marker",
      url: "/fuentes/permanent-marker-latin-400-normal.woff2",
      peso: "400"
    }
  };
  var NOMBRES_LETRA = Object.keys(LETRAS);
  var cargadas = {};
  function letra(nombre) {
    var L = LETRAS[nombre] || LETRAS.Moderna;
    if (!cargadas[L.fam]) {
      cargadas[L.fam] = (window.FontFace ? new FontFace(L.fam, "url(" + L.url + ")", {
        weight: L.peso
      }).load().then(function(f) {
        document.fonts.add(f);
        return L;
      }) : Promise.resolve(L)).catch(function() {
        return L;
      });
    }
    return cargadas[L.fam];
  }
  function fuente(L, px) {
    return L.peso + " " + Math.max(1, px) + 'px "' + L.fam + '", Arial, sans-serif';
  }
  function colorDe(valor, campoId, porDefecto) {
    var v = (valor || "").toLowerCase();
    if (/blanco/.test(v)) return "#ffffff";
    if (/negro/.test(v)) return "#111111";
    if (/gris/.test(v)) return "#8a8a8a";
    if (/rojo/.test(v)) return "#e0281e";
    if (/amarillo/.test(v)) return "#ffd21f";
    var c = $("#" + campoId + " input");
    return c ? c.value : porDefecto;
  }
  function campoTexto(id, rotulo, extra) {
    return campo(id, rotulo, '<input type="text" ' + (extra || "") + ">").replace('class="opc-campo"', 'class="opc-campo apilado"');
  }
  function campoRango(id, rotulo, min, max, val, unidad) {
    return campo(id, rotulo, '<input type="range" min="' + min + '" max="' + max + '" step="1" value="' + val + '"><output>' + val + (unidad || "") + "</output>");
  }
  function rango(id) {
    var i = $("#" + id + " input");
    return i ? num(i.value) : 0;
  }
  function atarRango(id, unidad, alCambiar) {
    var i = $("#" + id + " input");
    if (!i) return;
    i.addEventListener("input", function() {
      i.nextElementSibling.textContent = i.value + (unidad || "");
      alCambiar();
    });
  }
  function capaDibujo(v) {
    var c = $(".sf-capa", v.lienzo.parentNode);
    if (!c) {
      c = document.createElement("canvas");
      c.className = "sf-capa";
      v.lienzo.parentNode.insertBefore(c, v.capa);
    }
    if (c.width !== v.lienzo.width || c.height !== v.lienzo.height) {
      c.width = v.lienzo.width;
      c.height = v.lienzo.height;
    }
    return c;
  }
  function puntero(capa, e) {
    var b = capa.getBoundingClientRect();
    return {
      x: (e.clientX - b.left) / b.width,
      y: (e.clientY - b.top) / b.height
    };
  }
  function lim(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }
  function componer(f, fmt, dibujar) {
    return IMMotor.bitmap(f).then(function(img) {
      var c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      return Promise.resolve(dibujar(g, c.width, c.height, f)).then(function() {
        return createImageBitmap(c);
      });
    }).then(function(b) {
      return U.codificar(b, [], {
        formato: fmt,
        calidad: 92
      }, [ b ]);
    });
  }
  var TAM = {
    Chico: 0,
    Mediano: 1,
    Grande: 2
  };
  function cfgMarca(st) {
    var t = TAM[IM.opcion("Tamaño")];
    if (t == null) t = 1;
    return {
      imagen: /imagen/i.test(IM.opcion("Qué poner") || ""),
      texto: ($("#campo-marca-texto input") || {}).value || "",
      logo: st.logo,
      donde: (IM.opcion("Dónde") || "").toLowerCase(),
      esquina: (IM.opcion("Esquina") || "").toLowerCase(),
      tam: t,
      color: colorDe(IM.opcion("Color"), "campo-marca-color", "#ffffff"),
      alfa: 1 - rango("campo-transparencia") / 100,
      pos: st.pos
    };
  }
  function geomMarca(g, W, H, k) {
    var m = Math.min(W, H), diag = Math.sqrt(W * W + H * H), L = LETRAS.Moderna, ew, eh, fs = 0;
    var rep = /repetida/.test(k.donde), dg = /diagonal/.test(k.donde);
    if (k.imagen) {
      if (!k.logo) return null;
      ew = dg ? diag * [ .3, .45, .6 ][k.tam] : m * (rep ? [ .12, .18, .26 ] : [ .15, .24, .36 ])[k.tam];
      eh = ew * k.logo.height / k.logo.width;
    } else {
      if (!k.texto.trim()) return null;
      fs = m * (rep ? [ .03, .045, .065 ] : [ .035, .055, .085 ])[k.tam];
      g.font = fuente(L, fs);
      if (dg) {
        var w0 = g.measureText(k.texto).width || 1;
        fs = fs * diag * [ .4, .6, .8 ][k.tam] / w0;
        g.font = fuente(L, fs);
      }
      ew = g.measureText(k.texto).width;
      eh = fs * 1.2;
    }
    var mg = m * .03, cx = W / 2, cy = H / 2, rot = 0;
    if (dg) rot = -Math.atan2(H, W); else if (/esquina/.test(k.donde)) {
      cx = /izquierda/.test(k.esquina) ? mg + ew / 2 : W - mg - ew / 2;
      cy = /arriba/.test(k.esquina) ? mg + eh / 2 : H - mg - eh / 2;
    }
    if (k.pos && !rep) {
      cx = k.pos.x * W;
      cy = k.pos.y * H;
    }
    return {
      cx: cx,
      cy: cy,
      ew: ew,
      eh: eh,
      fs: fs,
      rot: rot,
      rep: rep,
      L: L
    };
  }
  function dibujarUna(g, k, q) {
    if (k.imagen) g.drawImage(k.logo, -q.ew / 2, -q.eh / 2, q.ew, q.eh); else {
      g.font = fuente(q.L, q.fs);
      g.fillStyle = k.color;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(k.texto, 0, 0);
    }
  }
  function dibujarMarca(g, W, H, k) {
    var q = geomMarca(g, W, H, k);
    if (!q) return null;
    g.save();
    g.globalAlpha = lim(k.alfa, .05, 1);
    if (q.rep) {
      var m = Math.min(W, H), sx = q.ew + m * .12, sy = q.eh + m * .12, R = Math.sqrt(W * W + H * H) / 2 + Math.max(sx, sy);
      g.translate(W / 2, H / 2);
      g.rotate(-Math.PI / 6);
      for (var fila = 0, y = -R; y <= R; y += sy, fila++) for (var x = -R + (fila % 2 ? sx / 2 : 0); x <= R; x += sx) {
        g.save();
        g.translate(x, y);
        dibujarUna(g, k, q);
        g.restore();
      }
    } else {
      g.translate(q.cx, q.cy);
      g.rotate(q.rot);
      dibujarUna(g, k, q);
    }
    g.restore();
    return q;
  }
  H["marca-de-agua"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo === "Qué poner") return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + '<div class="opc-campo sf-logo" id="campo-marca-logo" hidden><span>Imagen</span><button type="button" class="boton-borde" id="elegir-logo">Elegir imagen</button><small id="nombre-logo">Ninguna imagen elegida</small><input type="file" accept="image/*,.heic,.heif,.svg" hidden></div>';
      if (rotulo === "Texto") return campoTexto("campo-marca-texto", "Texto", 'maxlength="80" placeholder="Tu nombre o tu marca"');
      if (rotulo === "Color") return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + campo("campo-marca-color", "Color", '<input type="color" value="#e0281e">', true);
      if (rotulo === "Transparencia") return campoRango("campo-transparencia", "Transparencia", 0, 90, 50, " %");
      return null;
    },
    montar: function(cont) {
      var st = {
        pos: null,
        logo: null
      }, v, self = this;
      this._st = st;
      var pintar = function() {
        if (!v || !v.img) return;
        var c = capaDibujo(v), g = c.getContext("2d"), k = cfgMarca(st);
        letra("Moderna").then(function() {
          g.clearRect(0, 0, c.width, c.height);
          st.ultima = dibujarMarca(g, c.width, c.height, k);
        });
      };
      var todo = function() {
        pintar();
        v.refrescar();
        IM.aviso("");
      };
      v = new Visor(cont, {
        nota: "Podés arrastrar la marca sobre la foto: queda en el mismo lugar en todas, en proporción.",
        alCambiar: pintar,
        grilla: function(marco, f, img, c) {
          letra("Moderna").then(function() {
            dibujarMarca(c.getContext("2d"), c.width, c.height, cfgMarca(st));
          });
        }
      });
      var act = function() {
        var imagen = /imagen/i.test(IM.opcion("Qué poner") || ""), donde = IM.opcion("Dónde") || "";
        mostrarSi($("#campo-marca-logo"), imagen);
        mostrarSi($("#campo-marca-texto"), !imagen);
        IM.mostrarOpcion("Color", !imagen);
        mostrarSi($("#campo-marca-color"), !imagen && /elecci/.test(IM.opcion("Color") || ""));
        IM.mostrarOpcion("Esquina", /esquina/i.test(donde));
        v.capa.classList.toggle("sf-mover", !/repetida/i.test(donde));
      };
      var ultimoDonde = null;
      IM.alCambiarOpcion(function() {
        var d = (IM.opcion("Dónde") || "") + "|" + (IM.opcion("Esquina") || "");
        if (d !== ultimoDonde) {
          ultimoDonde = d;
          st.pos = null;
        }
        act();
        todo();
      });
      ultimoDonde = (IM.opcion("Dónde") || "") + "|" + (IM.opcion("Esquina") || "");
      act();
      document.addEventListener("im-restablecer", function() {
        st.pos = null;
        ultimoDonde = (IM.opcion("Dónde") || "") + "|" + (IM.opcion("Esquina") || "");
        act();
        todo();
      });
      $("#campo-marca-texto input").addEventListener("input", debounce(todo, 60));
      $("#campo-marca-color input").addEventListener("input", debounce(todo, 60));
      atarRango("campo-transparencia", " %", debounce(todo, 30));
      var fi = $("#campo-marca-logo input");
      $("#elegir-logo").addEventListener("click", function() {
        fi.click();
      });
      fi.addEventListener("change", function() {
        var f = fi.files[0];
        fi.value = "";
        if (!f) return;
        IMMotor.bitmap(f).then(function(b) {
          st.logo = b;
          $("#nombre-logo").textContent = f.name;
          todo();
        }, function(e) {
          IM.aviso(IM.textoError(e));
        });
      });
      var arr = null;
      v.capa.addEventListener("pointerdown", function(e) {
        var q = st.ultima;
        if (!q || q.rep || !v.img) return;
        var p = puntero(v.capa, e), W = v.lienzo.width, Hh = v.lienzo.height, cx = q.cx / W, cy = q.cy / Hh;
        var dentro = Math.abs(p.x - cx) * W < q.ew / 2 + 8 && Math.abs(p.y - cy) * Hh < q.eh / 2 + 8;
        arr = dentro ? {
          dx: cx - p.x,
          dy: cy - p.y
        } : {
          dx: 0,
          dy: 0
        };
        v.capa.setPointerCapture(e.pointerId);
        mover(e);
      });
      var mover = function(e) {
        if (!arr) return;
        var p = puntero(v.capa, e);
        st.pos = {
          x: lim(p.x + arr.dx, 0, 1),
          y: lim(p.y + arr.dy, 0, 1)
        };
        pintar();
      };
      v.capa.addEventListener("pointermove", mover);
      v.capa.addEventListener("pointerup", function() {
        if (arr) {
          arr = null;
          v.refrescar();
        }
      });
    },
    procesar: function() {
      var st = this._st, k = cfgMarca(st);
      if (k.imagen && !k.logo) {
        IM.aviso("Elegí la imagen de tu marca.");
        return;
      }
      if (!k.imagen && !k.texto.trim()) {
        IM.aviso("Escribí el texto de la marca.");
        return;
      }
      U.cadaImagen("Poniendo la marca de agua", function(f) {
        var fmt = U.formatoElegido("Formato", f);
        return letra("Moderna").then(function() {
          return componer(f, fmt, function(g, W, Hh) {
            dibujarMarca(g, W, Hh, k);
          });
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-marca." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "con-marca.zip"
      });
    }
  };
  function cfgMeme(st) {
    var lista = /lista/.test(IM.opcion("Letra") || "");
    return {
      arriba: ($("#campo-meme-arriba input") || {}).value || "",
      abajo: ($("#campo-meme-abajo input") || {}).value || "",
      letra: lista ? IM.opcion("Lista de letras") || "Moderna" : "Clásica de memes",
      auto: !/ajustable/i.test(IM.opcion("Tamaño de letra") || ""),
      tam: rango("campo-meme-tam"),
      mayus: /todo/i.test(IM.opcion("Mayúsculas") || ""),
      pos: st.pos
    };
  }
  function renglones(g, texto, maxW) {
    var out = [];
    String(texto).split("\n").forEach(function(par) {
      var pal = par.split(/\s+/).filter(Boolean), r = "";
      pal.forEach(function(p) {
        var prueba = r ? r + " " + p : p;
        if (!r || g.measureText(prueba).width <= maxW) r = prueba; else {
          out.push(r);
          r = p;
        }
      });
      if (r) out.push(r);
    });
    return out;
  }
  function bloqueMeme(g, W, H, k, texto) {
    var L = LETRAS[k.letra] || LETRAS["Clásica de memes"], m = Math.min(W, H), maxW = W * .92, fs, lin;
    if (k.mayus) texto = texto.toLocaleUpperCase("es");
    if (!k.auto) {
      fs = m * k.tam / 100;
      g.font = fuente(L, fs);
      lin = renglones(g, texto, maxW);
    } else {
      for (fs = m * .14; fs > m * .045; fs *= .92) {
        g.font = fuente(L, fs);
        lin = renglones(g, texto, maxW);
        if (lin.length <= 3 && lin.every(function(r) {
          return g.measureText(r).width <= maxW;
        })) break;
      }
      g.font = fuente(L, fs);
      lin = renglones(g, texto, maxW);
    }
    return {
      L: L,
      fs: fs,
      lin: lin,
      alto: lin.length * fs * 1.1
    };
  }
  function dibujarMeme(g, W, H, k) {
    var out = {}, m = Math.min(W, H);
    [ [ "arriba", k.arriba ], [ "abajo", k.abajo ] ].forEach(function(par) {
      if (!par[1].trim()) return;
      var b = bloqueMeme(g, W, H, k, par[1]), mg = m * .03;
      var cx = W / 2, cy = par[0] === "arriba" ? mg + b.alto / 2 : H - mg - b.alto / 2;
      var p = k.pos && k.pos[par[0]];
      if (p) {
        cx = p.x * W;
        cy = p.y * H;
      }
      g.save();
      g.font = fuente(b.L, b.fs);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.miterLimit = 2;
      g.lineWidth = Math.max(2, b.fs * .12);
      g.strokeStyle = "#000";
      g.fillStyle = "#fff";
      b.lin.forEach(function(r, i) {
        var y = cy - b.alto / 2 + b.fs * 1.1 * (i + .5);
        g.strokeText(r, cx, y);
        g.fillText(r, cx, y);
      });
      g.restore();
      var anch = Math.max.apply(null, b.lin.map(function(r) {
        g.font = fuente(b.L, b.fs);
        return g.measureText(r).width;
      }).concat([ 0 ]));
      out[par[0]] = {
        cx: cx,
        cy: cy,
        ew: anch,
        eh: b.alto
      };
    });
    return out;
  }
  H["crear-meme"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo === "Texto de arriba") return campoTexto("campo-meme-arriba", "Texto de arriba", 'maxlength="140"');
      if (rotulo === "Texto de abajo") return campoTexto("campo-meme-abajo", "Texto de abajo", 'maxlength="140"');
      if (rotulo === "Letra") return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + ui.grupo("Lista de letras", NOMBRES_LETRA, true);
      if (rotulo === "Tamaño de letra") return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + '<div id="campo-meme-tam-caja" hidden>' + campoRango("campo-meme-tam", "Tamaño", 4, 20, 10, " %") + "</div>";
      return null;
    },
    montar: function(cont) {
      var st = {
        pos: null
      }, v;
      this._st = st;
      var pintar = function() {
        if (!v || !v.img) return;
        var c = capaDibujo(v), g = c.getContext("2d"), k = cfgMeme(st);
        letra(k.letra).then(function() {
          g.clearRect(0, 0, c.width, c.height);
          st.ultima = dibujarMeme(g, c.width, c.height, k);
        });
      };
      var todo = function() {
        pintar();
        v.refrescar();
        IM.aviso("");
      };
      v = new Visor(cont, {
        nota: "Podés arrastrar cada texto a otro lugar de la foto.",
        alCambiar: pintar,
        grilla: function(marco, f, img, c) {
          var k = cfgMeme(st);
          letra(k.letra).then(function() {
            dibujarMeme(c.getContext("2d"), c.width, c.height, k);
          });
        }
      });
      v.capa.classList.add("sf-mover");
      var act = function() {
        IM.mostrarOpcion("Lista de letras", /lista/.test(IM.opcion("Letra") || ""));
        mostrarSi($("#campo-meme-tam-caja"), /ajustable/i.test(IM.opcion("Tamaño de letra") || ""));
      };
      IM.alCambiarOpcion(function() {
        act();
        todo();
      });
      act();
      [ "campo-meme-arriba", "campo-meme-abajo" ].forEach(function(id) {
        $("#" + id + " input").addEventListener("input", debounce(todo, 60));
      });
      atarRango("campo-meme-tam", " %", debounce(todo, 30));
      document.addEventListener("im-restablecer", function() {
        st.pos = null;
        act();
        todo();
      });
      var arr = null;
      v.capa.addEventListener("pointerdown", function(e) {
        var u = st.ultima || {}, p = puntero(v.capa, e), W = v.lienzo.width, Hh = v.lienzo.height;
        [ "arriba", "abajo" ].forEach(function(cual) {
          var q = u[cual];
          if (!q || arr) return;
          if (Math.abs(p.x * W - q.cx) < q.ew / 2 + 10 && Math.abs(p.y * Hh - q.cy) < q.eh / 2 + 10) arr = {
            cual: cual,
            dx: q.cx / W - p.x,
            dy: q.cy / Hh - p.y
          };
        });
        if (arr) v.capa.setPointerCapture(e.pointerId);
      });
      v.capa.addEventListener("pointermove", function(e) {
        if (!arr) return;
        var p = puntero(v.capa, e);
        st.pos = st.pos || {};
        st.pos[arr.cual] = {
          x: lim(p.x + arr.dx, 0, 1),
          y: lim(p.y + arr.dy, 0, 1)
        };
        pintar();
      });
      v.capa.addEventListener("pointerup", function() {
        if (arr) {
          arr = null;
          v.refrescar();
        }
      });
    },
    procesar: function() {
      var k = cfgMeme(this._st);
      if (!k.arriba.trim() && !k.abajo.trim()) {
        IM.aviso("Escribí el texto de arriba o el de abajo.");
        return;
      }
      U.cadaImagen("Creando el meme", function(f) {
        var fmt = U.formatoElegido("Formato", f);
        return letra(k.letra).then(function() {
          return componer(f, fmt, function(g, W, Hh) {
            dibujarMeme(g, W, Hh, k);
          });
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-meme." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "memes.zip"
      });
    }
  };
  var ICONOS = {
    elegir: '<path d="M6 3l12 9-5.2 1.1L15.5 19l-2.4 1.1-2.7-5.9L6 18z"/>',
    texto: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    mano: '<path d="M3 17c2.5-4 4.5-9 7-9 2.8 0-1.5 9 1.5 9 2.6 0 3.6-6 6-6 1.6 0 2.2 2 3.5 3"/>',
    flecha: '<path d="M5 19L19 5M10 5h9v9"/>',
    linea: '<path d="M5 19L19 5"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
    circulo: '<ellipse cx="12" cy="12" rx="8.5" ry="7"/>',
    resaltador: '<path d="M14 4l6 6-8.5 8.5H6v-5.5z"/><path d="M4 21h9"/>',
    deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    rehacer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    borrar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
  };
  var NOMBRE_HERR = {
    elegir: "Elegir y mover",
    texto: "Texto",
    mano: "A mano alzada",
    flecha: "Flecha",
    linea: "Línea",
    rect: "Rectángulo",
    circulo: "Círculo",
    resaltador: "Resaltador"
  };
  var LETRAS_ED = [ "Moderna", "Clásica de memes", "Elegante", "Manuscrita", "Marcador" ];
  function cfgEd() {
    return {
      color: colorDe(IM.opcion("Color"), "campo-ed-color", "#ffffff"),
      grosor: {
        Fino: .004,
        Mediano: .008,
        Grueso: .016
      }[IM.opcion("Grosor")] || .008,
      letra: IM.opcion("Letra") || "Moderna",
      fs: rango("campo-ed-tam") / 100,
      contorno: /con contorno/i.test(IM.opcion("Contorno de la letra") || ""),
      relleno: /con relleno/i.test(IM.opcion("Relleno de rectángulos y círculos") || "")
    };
  }
  function cajaObj(g, o, W, H) {
    var m = Math.min(W, H);
    if (o.tipo === "texto") {
      var L = LETRAS[o.letra] || LETRAS.Moderna, fs = o.fs * m;
      g.font = fuente(L, fs);
      var lin = String(o.texto).split("\n"), w = Math.max.apply(null, lin.map(function(r) {
        return g.measureText(r).width;
      }).concat([ fs * .5 ]));
      var h = lin.length * fs * 1.2;
      return {
        x: o.x * W - w / 2,
        y: o.y * H - h / 2,
        w: w,
        h: h
      };
    }
    var xs, ys;
    if (o.pts) {
      xs = o.pts.map(function(p) {
        return p[0] * W;
      });
      ys = o.pts.map(function(p) {
        return p[1] * H;
      });
    } else {
      xs = [ o.x1 * W, o.x2 * W ];
      ys = [ o.y1 * H, o.y2 * H ];
    }
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (o.grosor || 0) * m / 2;
    if (o.tipo === "flecha") pad += Math.max(o.grosor * m * 4, m * .02);
    return {
      x: x0 - pad,
      y: y0 - pad,
      w: x1 - x0 + 2 * pad,
      h: y1 - y0 + 2 * pad
    };
  }
  function transformar(g, o, W, H, c) {
    var t = o.t || {
      dx: 0,
      dy: 0,
      s: 1,
      r: 0
    }, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    g.translate(cx + t.dx * W, cy + t.dy * H);
    g.rotate(t.r);
    g.scale(t.s, t.s);
    g.translate(-cx, -cy);
  }
  function dibujarObj(g, o, W, H) {
    var m = Math.min(W, H), c = cajaObj(g, o, W, H);
    g.save();
    transformar(g, o, W, H, c);
    g.strokeStyle = o.color;
    g.fillStyle = o.color;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = Math.max(1, (o.grosor || 0) * m);
    if (o.tipo === "texto") {
      var L = LETRAS[o.letra] || LETRAS.Moderna, fs = o.fs * m, lin = String(o.texto).split("\n");
      g.font = fuente(L, fs);
      g.textAlign = "center";
      g.textBaseline = "middle";
      if (o.contorno) {
        g.lineWidth = Math.max(2, fs * .12);
        g.strokeStyle = /^#(f|e|d)/i.test(o.color) ? "#000" : "#fff";
      }
      lin.forEach(function(r, i) {
        var y = o.y * H - lin.length * fs * .6 + fs * 1.2 * (i + .5);
        if (o.contorno) g.strokeText(r, o.x * W, y);
        g.fillText(r, o.x * W, y);
      });
    } else if (o.pts) {
      if (o.tipo === "resaltador") {
        g.globalAlpha = .42;
        g.globalCompositeOperation = "multiply";
        g.lineCap = "butt";
      }
      g.beginPath();
      o.pts.forEach(function(p, i) {
        if (i) g.lineTo(p[0] * W, p[1] * H); else g.moveTo(p[0] * W, p[1] * H);
      });
      if (o.pts.length === 1) g.lineTo(o.pts[0][0] * W + .1, o.pts[0][1] * H);
      g.stroke();
    } else {
      var x1 = o.x1 * W, y1 = o.y1 * H, x2 = o.x2 * W, y2 = o.y2 * H;
      if (o.tipo === "linea" || o.tipo === "flecha") {
        var ang = Math.atan2(y2 - y1, x2 - x1), cab = Math.max(o.grosor * m * 4, m * .02);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(o.tipo === "flecha" ? x2 - Math.cos(ang) * cab * .6 : x2, o.tipo === "flecha" ? y2 - Math.sin(ang) * cab * .6 : y2);
        g.stroke();
        if (o.tipo === "flecha") {
          g.beginPath();
          g.moveTo(x2, y2);
          g.lineTo(x2 - Math.cos(ang - .45) * cab, y2 - Math.sin(ang - .45) * cab);
          g.lineTo(x2 - Math.cos(ang + .45) * cab, y2 - Math.sin(ang + .45) * cab);
          g.closePath();
          g.fill();
        }
      } else {
        var rx = Math.min(x1, x2), ry = Math.min(y1, y2), rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
        g.beginPath();
        if (o.tipo === "rect") g.rect(rx, ry, rw, rh); else g.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        if (o.relleno) g.fill(); else g.stroke();
      }
    }
    g.restore();
  }
  function dibujarObjs(g, objs, W, H) {
    (objs || []).forEach(function(o) {
      if (!o.oculto) dibujarObj(g, o, W, H);
    });
  }
  function letrasDe(objs) {
    return Promise.all((objs || []).filter(function(o) {
      return o.tipo === "texto";
    }).map(function(o) {
      return letra(o.letra);
    }));
  }
  function aLocal(o, W, H, c, px, py) {
    var t = o.t || {
      dx: 0,
      dy: 0,
      s: 1,
      r: 0
    }, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    var x = px - (cx + t.dx * W), y = py - (cy + t.dy * H), cs = Math.cos(-t.r), sn = Math.sin(-t.r);
    return {
      x: (x * cs - y * sn) / t.s + cx,
      y: (x * sn + y * cs) / t.s + cy
    };
  }
  function esquinas(o, W, H, c) {
    var t = o.t || {
      dx: 0,
      dy: 0,
      s: 1,
      r: 0
    }, cx = c.x + c.w / 2, cy = c.y + c.h / 2, cs = Math.cos(t.r), sn = Math.sin(t.r);
    return [ [ c.x, c.y ], [ c.x + c.w, c.y ], [ c.x + c.w, c.y + c.h ], [ c.x, c.y + c.h ] ].map(function(p) {
      var x = (p[0] - cx) * t.s, y = (p[1] - cy) * t.s;
      return [ cx + t.dx * W + x * cs - y * sn, cy + t.dy * H + x * sn + y * cs ];
    });
  }
  H["agregar-texto-y-dibujos"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo === "Color") return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + campo("campo-ed-color", "Color", '<input type="color" value="#2b7de9">', true);
      if (rotulo === "Letra") return ui.grupo(rotulo, LETRAS_ED, true);
      if (rotulo === "Tamaño de letra") return campoRango("campo-ed-tam", "Tamaño de letra", 2, 30, 8, " %");
      return null;
    },
    montar: function(cont) {
      var objs = {}, hist = {}, v, herr = "elegir", sel = null, self = this;
      var clave = function(f) {
        return f.name + "|" + f.size + "|" + f.lastModified;
      };
      var lista = function() {
        return v && v.actual ? objs[clave(v.actual)] = objs[clave(v.actual)] || [] : [];
      };
      var H0 = function() {
        var k = v && v.actual && clave(v.actual);
        return k ? hist[k] = hist[k] || {
          atras: [],
          adelante: []
        } : {
          atras: [],
          adelante: []
        };
      };
      var guardarPaso = function() {
        var h = H0();
        h.atras.push(JSON.stringify(lista()));
        if (h.atras.length > 100) h.atras.shift();
        h.adelante = [];
        botones();
      };
      this._objs = objs;
      this._clave = clave;
      var barra = document.createElement("div");
      barra.className = "ed-barra";
      barra.setAttribute("role", "toolbar");
      barra.setAttribute("aria-label", "Herramientas sobre la foto");
      var bt = function(id, rot, extra) {
        return '<button type="button" data-ed="' + id + '" title="' + esc(rot) + '" aria-label="' + esc(rot) + '"' + (extra || "") + '><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[id] + "</svg></button>";
      };
      barra.innerHTML = Object.keys(NOMBRE_HERR).map(function(k) {
        return bt(k, NOMBRE_HERR[k], ' aria-pressed="' + (k === herr) + '"');
      }).join("") + '<span class="ed-sep"></span>' + bt("deshacer", "Deshacer (Ctrl+Z)") + bt("rehacer", "Rehacer (Ctrl+Y)") + bt("borrar", "Borrar lo elegido (Supr)");
      var pintar = function() {
        if (!v || !v.img) return;
        var c = capaDibujo(v), g = c.getContext("2d"), ob = lista();
        letrasDe(ob).then(function() {
          g.clearRect(0, 0, c.width, c.height);
          dibujarObjs(g, ob, c.width, c.height);
          if (sel && ob.indexOf(sel) >= 0) {
            var cj = cajaObj(g, sel, c.width, c.height), e = esquinas(sel, c.width, c.height, cj), k = c.width / v.capa.getBoundingClientRect().width;
            g.save();
            g.strokeStyle = "#8A4F0C";
            g.lineWidth = 1.2 * k;
            g.setLineDash([ 5 * k, 4 * k ]);
            g.beginPath();
            e.forEach(function(p, i) {
              if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
            });
            g.closePath();
            g.stroke();
            g.setLineDash([]);
            var tope = asas();
            g.fillStyle = "#fff";
            g.lineWidth = 1.6 * k;
            [ tope.escala, tope.giro ].forEach(function(p) {
              g.beginPath();
              g.arc(p[0], p[1], 6 * k, 0, Math.PI * 2);
              g.fill();
              g.stroke();
            });
            g.beginPath();
            g.moveTo((e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2);
            g.lineTo(tope.giro[0], tope.giro[1]);
            g.stroke();
            g.restore();
          }
        });
      };
      var asas = function() {
        var c = capaDibujo(v), g = c.getContext("2d"), cj = cajaObj(g, sel, c.width, c.height), e = esquinas(sel, c.width, c.height, cj);
        var k = c.width / v.capa.getBoundingClientRect().width, mx = (e[0][0] + e[1][0]) / 2, my = (e[0][1] + e[1][1]) / 2, r = (sel.t || {}).r || 0;
        return {
          escala: e[2],
          giro: [ mx + Math.sin(r) * 22 * k, my - Math.cos(r) * 22 * k ],
          k: k,
          centro: [ (e[0][0] + e[2][0]) / 2, (e[0][1] + e[2][1]) / 2 ]
        };
      };
      var botones = function() {
        var h = H0();
        $('[data-ed="deshacer"]', barra).disabled = !h.atras.length;
        $('[data-ed="rehacer"]', barra).disabled = !h.adelante.length;
        $('[data-ed="borrar"]', barra).disabled = !sel;
      };
      var todo = function() {
        pintar();
        v.refrescar();
        botones();
        if (lista().length) IM.aviso("");
      };
      v = new Visor(cont, {
        nota: "Elegí una herramienta y usala sobre la foto. Con «Elegir y mover» tocás lo agregado para moverlo, agrandarlo o girarlo; dos toques en un texto para cambiarlo.",
        alCambiar: function() {
          sel = null;
          cerrarEdicion(true);
          pintar();
          botones();
        },
        grilla: function(marco, f, img, c) {
          var ob = objs[clave(f)];
          if (ob && ob.length) letrasDe(ob).then(function() {
            dibujarObjs(c.getContext("2d"), ob, c.width, c.height);
          });
        }
      });
      v.uno.insertBefore(barra, v.uno.firstChild);
      v.capa.dataset.herr = herr;
      v.capa.classList.add("ed-fondo");
      IM.etiquetas(function(a) {
        var ob = objs[clave(a.file)];
        return ob && ob.length ? {
          texto: ob.length === 1 ? "1 agregado" : ob.length + " agregados"
        } : null;
      });
      barra.addEventListener("click", function(e) {
        var b = e.target.closest("[data-ed]");
        if (!b || b.disabled) return;
        var id = b.dataset.ed;
        if (NOMBRE_HERR[id]) {
          herr = id;
          $$("[aria-pressed]", barra).forEach(function(x) {
            x.setAttribute("aria-pressed", String(x === b));
          });
          v.capa.dataset.herr = id;
          if (id !== "elegir") {
            sel = null;
            pintar();
            botones();
          }
          return;
        }
        if (id === "deshacer") deshacer(); else if (id === "rehacer") rehacer(); else if (id === "borrar") borrarSel();
      });
      var deshacer = function() {
        var h = H0();
        if (!h.atras.length) return;
        h.adelante.push(JSON.stringify(lista()));
        objs[clave(v.actual)] = JSON.parse(h.atras.pop());
        sel = null;
        todo();
        IM.pintarEtiquetas();
      };
      var rehacer = function() {
        var h = H0();
        if (!h.adelante.length) return;
        h.atras.push(JSON.stringify(lista()));
        objs[clave(v.actual)] = JSON.parse(h.adelante.pop());
        sel = null;
        todo();
        IM.pintarEtiquetas();
      };
      var borrarSel = function() {
        if (!sel) return;
        guardarPaso();
        var l = lista(), i = l.indexOf(sel);
        if (i >= 0) l.splice(i, 1);
        sel = null;
        todo();
        IM.pintarEtiquetas();
      };
      var teclas = function(e) {
        if (!v.img || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) return;
        var k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) {
          e.preventDefault();
          deshacer();
        } else if ((e.ctrlKey || e.metaKey) && (k === "y" || k === "z" && e.shiftKey)) {
          e.preventDefault();
          rehacer();
        } else if ((k === "delete" || k === "backspace") && sel) {
          e.preventDefault();
          borrarSel();
        }
      };
      document.addEventListener("keydown", teclas);
      document.addEventListener("im-restablecer", function() {
        cerrarEdicion(true);
        if (lista().length) guardarPaso();
        Object.keys(objs).forEach(function(k) {
          delete objs[k];
        });
        sel = null;
        todo();
        IM.pintarEtiquetas();
      });
      this.desmontar = function() {
        document.removeEventListener("keydown", teclas);
      };
      var act = function() {
        mostrarSi($("#campo-ed-color"), /elecci/.test(IM.opcion("Color") || ""));
      };
      var mostrarTam = function() {
        if (!sel || sel.tipo !== "texto") return;
        if (sel.t && sel.t.s && sel.t.s !== 1) {
          sel.fs = sel.fs * sel.t.s;
          sel.t = Object.assign({}, sel.t, {
            s: 1
          });
        }
        var i = $("#campo-ed-tam input");
        if (!i) return;
        var val = Math.round(sel.fs * 100);
        i.max = Math.max(30, val);
        i.min = Math.min(2, val);
        i.value = val;
        i.nextElementSibling.textContent = val + " %";
      };
      self._mostrarTam = mostrarTam;
      var aplicarASel = function() {
        if (!sel) return;
        var k = cfgEd();
        guardarPaso();
        sel.color = k.color;
        if (sel.tipo === "texto") {
          sel.letra = k.letra;
          sel.fs = k.fs;
          sel.contorno = k.contorno;
        } else if (sel.tipo === "rect" || sel.tipo === "circulo") {
          sel.relleno = k.relleno;
          sel.grosor = k.grosor;
        } else if (sel.tipo !== "resaltador") sel.grosor = k.grosor;
        todo();
      };
      IM.alCambiarOpcion(function() {
        act();
        aplicarASel();
      });
      act();
      $("#campo-ed-color input").addEventListener("change", aplicarASel);
      atarRango("campo-ed-tam", " %", debounce(function() {
        if (sel && sel.tipo === "texto") aplicarASel();
      }, 120));
      var edic = null;
      var cerrarEdicion = function(descartar) {
        if (!edic) return;
        var e = edic;
        edic = null;
        var t = e.area.value.replace(/\s+$/, "");
        e.area.remove();
        if (descartar) {
          if (e.nuevo) {
            var l0 = lista(), j = l0.indexOf(e.obj);
            if (j >= 0) l0.splice(j, 1);
          }
          todo();
          return;
        }
        var l = lista();
        if (!t.trim()) {
          var i = l.indexOf(e.obj);
          if (i >= 0) {
            if (!e.nuevo) guardarPaso();
            l.splice(i, 1);
          }
          sel = null;
        } else if (t !== e.obj.texto || e.nuevo) {
          if (!e.nuevo) guardarPaso();
          e.obj.texto = t;
          sel = e.obj;
        }
        e.obj.oculto = false;
        todo();
        IM.pintarEtiquetas();
      };
      var abrirEdicion = function(o, nuevo) {
        cerrarEdicion();
        var b = v.capa.getBoundingClientRect(), k = cfgEd(), m = Math.min(b.width, b.height), L = LETRAS[o.letra] || LETRAS.Moderna;
        var a = document.createElement("textarea");
        a.className = "ed-edicion";
        a.value = o.texto || "";
        a.setAttribute("aria-label", "Texto");
        a.style.font = fuente(L, Math.max(12, o.fs * m));
        a.style.color = o.color;
        a.style.left = o.x * 100 + "%";
        a.style.top = o.y * 100 + "%";
        a.style.transform = "translate(-50%,-50%)";
        a.style.textAlign = "center";
        a.rows = 1;
        var ajustar = function() {
          a.style.height = "auto";
          a.style.width = "auto";
          a.style.width = Math.max(60, a.scrollWidth + 8) + "px";
          a.style.height = a.scrollHeight + "px";
        };
        a.addEventListener("input", ajustar);
        a.addEventListener("keydown", function(e) {
          if (e.key === "Escape") {
            e.preventDefault();
            cerrarEdicion(true);
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            cerrarEdicion();
          }
          e.stopPropagation();
        });
        a.addEventListener("blur", function() {
          setTimeout(function() {
            if (edic && edic.area === a) cerrarEdicion();
          }, 0);
        });
        v.capa.appendChild(a);
        edic = {
          area: a,
          obj: o,
          nuevo: nuevo
        };
        o.oculto = true;
        letra(o.letra).then(function() {
          ajustar();
          a.focus();
          a.select();
        });
        pintar();
      };
      var acc = null;
      var px = function(e) {
        var p = puntero(v.capa, e), c = capaDibujo(v);
        return {
          x: p.x,
          y: p.y,
          X: p.x * c.width,
          Y: p.y * c.height,
          W: c.width,
          H: c.height
        };
      };
      var tocado = function(p) {
        var c = capaDibujo(v), g = c.getContext("2d"), l = lista(), k = c.width / v.capa.getBoundingClientRect().width;
        for (var i = l.length - 1; i >= 0; i--) {
          var o = l[i], cj = cajaObj(g, o, p.W, p.H), q = aLocal(o, p.W, p.H, cj, p.X, p.Y), pad = 6 * k / ((o.t || {}).s || 1);
          if (q.x >= cj.x - pad && q.x <= cj.x + cj.w + pad && q.y >= cj.y - pad && q.y <= cj.y + cj.h + pad) return o;
        }
        return null;
      };
      v.capa.addEventListener("pointerdown", function(e) {
        if (!v.img || e.target.closest(".ed-edicion")) return;
        var p = px(e), k = cfgEd();
        if (edic) {
          cerrarEdicion();
          if (herr === "texto") return;
        }
        if (herr === "elegir") {
          if (sel) {
            var a = asas(), d = function(q) {
              return Math.hypot(p.X - q[0], p.Y - q[1]);
            };
            var t0 = JSON.parse(JSON.stringify(sel.t || {
              dx: 0,
              dy: 0,
              s: 1,
              r: 0
            }));
            if (d(a.escala) < 10 * a.k) {
              acc = {
                modo: "escala",
                t0: t0,
                d0: Math.hypot(a.escala[0] - a.centro[0], a.escala[1] - a.centro[1]),
                c: a.centro,
                antes: JSON.stringify(lista())
              };
            } else if (d(a.giro) < 10 * a.k) {
              acc = {
                modo: "giro",
                t0: t0,
                c: a.centro,
                a0: Math.atan2(p.Y - a.centro[1], p.X - a.centro[0]),
                antes: JSON.stringify(lista())
              };
            }
          }
          if (!acc) {
            var o = tocado(p);
            sel = o;
            if (self._mostrarTam) self._mostrarTam();
            if (o) acc = {
              modo: "mover",
              p0: p,
              t0: JSON.parse(JSON.stringify(o.t || {
                dx: 0,
                dy: 0,
                s: 1,
                r: 0
              })),
              antes: JSON.stringify(lista())
            };
            pintar();
            botones();
          }
          if (acc) v.capa.setPointerCapture(e.pointerId);
          return;
        }
        if (herr === "texto") {
          var o2 = {
            tipo: "texto",
            x: p.x,
            y: p.y,
            texto: "",
            letra: k.letra,
            fs: k.fs,
            color: k.color,
            contorno: k.contorno
          };
          guardarPaso();
          lista().push(o2);
          abrirEdicion(o2, true);
          return;
        }
        var nuevo = herr === "mano" || herr === "resaltador" ? {
          tipo: herr,
          pts: [ [ p.x, p.y ] ],
          color: herr === "resaltador" ? /blanco/i.test(IM.opcion("Color") || "") ? "#ffe14d" : k.color : k.color,
          grosor: herr === "resaltador" ? Math.max(.045, k.grosor * 5) : k.grosor
        } : {
          tipo: herr,
          x1: p.x,
          y1: p.y,
          x2: p.x,
          y2: p.y,
          color: k.color,
          grosor: k.grosor,
          relleno: k.relleno
        };
        acc = {
          modo: "dibujar",
          obj: nuevo,
          antes: JSON.stringify(lista())
        };
        lista().push(nuevo);
        v.capa.setPointerCapture(e.pointerId);
      });
      v.capa.addEventListener("pointermove", function(e) {
        if (!acc) return;
        var p = px(e);
        if (acc.modo === "dibujar") {
          var o = acc.obj;
          if (o.pts) o.pts.push([ lim(p.x, 0, 1), lim(p.y, 0, 1) ]); else {
            o.x2 = p.x;
            o.y2 = p.y;
            if (e.shiftKey && (o.tipo === "rect" || o.tipo === "circulo")) {
              var s = Math.max(Math.abs(o.x2 - o.x1) * p.W, Math.abs(o.y2 - o.y1) * p.H);
              o.x2 = o.x1 + Math.sign(o.x2 - o.x1 || 1) * s / p.W;
              o.y2 = o.y1 + Math.sign(o.y2 - o.y1 || 1) * s / p.H;
            }
          }
        } else if (acc.modo === "mover") {
          sel.t = {
            dx: acc.t0.dx + p.x - acc.p0.x,
            dy: acc.t0.dy + p.y - acc.p0.y,
            s: acc.t0.s,
            r: acc.t0.r
          };
        } else if (acc.modo === "escala") {
          sel.t = Object.assign({}, acc.t0, {
            s: lim(acc.t0.s * Math.hypot(p.X - acc.c[0], p.Y - acc.c[1]) / Math.max(1, acc.d0), .05, 40)
          });
        } else if (acc.modo === "giro") {
          var r = acc.t0.r + Math.atan2(p.Y - acc.c[1], p.X - acc.c[0]) - acc.a0;
          if (e.shiftKey) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12);
          sel.t = Object.assign({}, acc.t0, {
            r: r
          });
        }
        pintar();
      });
      var soltar = function() {
        if (!acc) return;
        var a = acc;
        acc = null;
        if (a.modo === "dibujar") {
          var o = a.obj, l = lista(), chico = o.pts ? o.pts.length < 2 : Math.abs(o.x2 - o.x1) < .004 && Math.abs(o.y2 - o.y1) < .004;
          if (chico && !o.pts) {
            l.splice(l.indexOf(o), 1);
            pintar();
            return;
          }
        }
        if (a.modo === "escala" && self._mostrarTam) self._mostrarTam();
        if (a.antes !== JSON.stringify(lista())) {
          var h = H0();
          h.atras.push(a.antes);
          h.adelante = [];
        }
        todo();
        IM.pintarEtiquetas();
      };
      v.capa.addEventListener("mousedown", function(e) {
        if (!e.target.closest(".ed-edicion")) e.preventDefault();
      });
      v.capa.addEventListener("pointerup", soltar);
      v.capa.addEventListener("pointercancel", soltar);
      v.capa.addEventListener("dblclick", function(e) {
        if (!v.img) return;
        var o = tocado(px(e));
        if (o && o.tipo === "texto") {
          sel = o;
          abrirEdicion(o, false);
        }
      });
      botones();
    },
    procesar: function() {
      var objs = this._objs, clave = this._clave;
      var con = IM.archivos().filter(function(a) {
        var o = objs[clave(a.file)];
        return o && o.length;
      });
      if (!con.length) {
        IM.aviso("Agregá un texto o un dibujo sobre la foto.");
        return;
      }
      var conClave = con.map(function(a) {
        return clave(a.file);
      });
      U.cadaImagen("Guardando", function(f) {
        var ob = objs[clave(f)];
        if (!ob || !ob.length) return Promise.resolve(null);
        var copia = JSON.parse(JSON.stringify(ob)), fmt = U.formatoElegido("Formato", f);
        return letrasDe(copia).then(function() {
          return componer(f, fmt, function(g, W, Hh) {
            dibujarObjs(g, copia, W, Hh);
          });
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-editada." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "editadas.zip",
        zip: false
      });
      return conClave;
    }
  };
  window.IMSobreFoto = {
    LETRAS: LETRAS,
    letra: letra,
    fuente: fuente,
    colorDe: colorDe,
    capaDibujo: capaDibujo,
    campoTexto: campoTexto,
    puntero: puntero,
    componer: componer,
    renglones: renglones,
    lim: lim,
    campoRango: campoRango,
    rango: rango,
    atarRango: atarRango
  };
})();