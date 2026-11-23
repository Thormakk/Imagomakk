(function() {
  "use strict";
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
  function base(n) {
    return n.replace(/\.[^.]+$/, "");
  }
  function sinDatos(f) {
    return f.arrayBuffer().then(function(ab) {
      var b = new Uint8Array(ab), partes = [];
      if (b[0] === 255 && b[1] === 216) {
        partes.push(b.subarray(0, 2));
        var i = 2;
        while (i + 4 <= b.length && b[i] === 255) {
          var m = b[i + 1];
          if (m === 218 || m === 217) break;
          var largo = b[i + 2] << 8 | b[i + 3];
          if (!(m === 225 || m === 237 || m === 254)) partes.push(b.subarray(i, i + 2 + largo));
          i += 2 + largo;
        }
        partes.push(b.subarray(i));
        return new Blob(partes, {
          type: "image/jpeg"
        });
      }
      if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) {
        partes.push(b.subarray(0, 8));
        var j = 8, fuera = {
          tEXt: 1,
          iTXt: 1,
          zTXt: 1,
          eXIf: 1,
          tIME: 1
        };
        while (j + 12 <= b.length) {
          var n = (b[j] << 24 | b[j + 1] << 16 | b[j + 2] << 8 | b[j + 3]) >>> 0, tipo = String.fromCharCode(b[j + 4], b[j + 5], b[j + 6], b[j + 7]);
          if (!fuera[tipo]) partes.push(b.subarray(j, j + 12 + n));
          j += 12 + n;
        }
        return new Blob(partes, {
          type: "image/png"
        });
      }
      if (String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" && String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP") {
        var trozos = [], k = 12, total = 4;
        while (k + 8 <= b.length) {
          var id = String.fromCharCode(b[k], b[k + 1], b[k + 2], b[k + 3]), tam = b[k + 4] | b[k + 5] << 8 | b[k + 6] << 16 | b[k + 7] << 24, fin = k + 8 + tam + (tam & 1);
          if (id !== "EXIF" && id !== "XMP ") {
            var c = b.slice(k, fin);
            if (id === "VP8X") c[8] &= ~12;
            trozos.push(c);
            total += c.length;
          }
          k = fin;
        }
        var cab = new Uint8Array(12);
        cab.set(b.subarray(0, 12));
        new DataView(cab.buffer).setUint32(4, total, true);
        return new Blob([ cab ].concat(trozos), {
          type: "image/webp"
        });
      }
      return null;
    });
  }
  function num(t) {
    return Number(String(t || "").replace(",", "."));
  }
  function porc(a, t) {
    return t ? Math.min(100, Math.floor(a / t * 100)) : 0;
  }
  var CALIDAD = {
    Alta: 88,
    Media: 75,
    Baja: 58
  };
  var EXT = {
    jpg: "jpg",
    png: "png",
    webp: "webp",
    avif: "avif",
    svg: "svg"
  };
  function formatoElegido(rotulo, f) {
    var v = (IM.opcion(rotulo) || "").toLowerCase();
    if (!v || /igual/.test(v)) return IMMotor.formatoOriginal(f);
    return {
      jpg: "jpg",
      png: "png",
      webp: "webp",
      avif: "avif"
    }[v] || "jpg";
  }
  function enZip() {
    return /ZIP/.test(IM.opcion("Resultado") || "");
  }
  function debounce(f, ms) {
    var t = null;
    return function() {
      clearTimeout(t);
      t = setTimeout(f, ms);
    };
  }
  function campo(id, rotulo, html, oculto) {
    return '<label class="opc-campo" id="' + id + '"' + (oculto ? " hidden" : "") + "><span>" + esc(rotulo) + "</span>" + html + "</label>";
  }
  function mostrarSi(el, si) {
    if (!el) return;
    el._quiere = !!si;
    if (si) {
      if (el._saliendo) {
        if (el.getAnimations) el.getAnimations().forEach(function(a) {
          a.cancel();
        });
        el._saliendo = false;
        el.style.overflow = "";
      }
      if (el.hidden) {
        el.hidden = false;
        IM.expandir(el);
      }
    } else if (!el.hidden && !el._saliendo) {
      el._saliendo = true;
      IM.contraer(el, function() {
        el._saliendo = false;
        el.style.overflow = "";
        if (el._quiere === false) el.hidden = true;
      });
    }
  }
  var GIF_ANIMA = /^\/(girar-y-voltear|recortar-imagen|redimensionar-imagen|tamano-para-instagram|blanco-y-negro-y-filtros|foto-a-dibujo|bordes-y-esquinas-redondeadas|marca-de-agua|agregar-texto-y-dibujos|crear-meme)\//;
  var GIF_AVISA = /^\/(colorear-fotos|dividir-imagen|dividir-imagen-para-instagram|convertir-imagen|imagen-a-svg|[a-z]+-a-(jpg|png|webp|svg)|desenfocar|desenfocar-caras|quitar-fondo|agrandar-imagen|borrar-objetos|foto-carnet-y-pasaporte)\//;
  function gifQueda() {
    var r = IM_RUTA(), fo = (IM.opcion("Formato") || "").toLowerCase();
    return GIF_ANIMA.test(r) && (!fo || /igual/.test(fo));
  }
  function nombresY(l) {
    return l.length > 1 ? l.slice(0, -1).join(", ") + " y " + l[l.length - 1] : l[0];
  }
  function rehacerGif(f, fn, i, av, cancelado) {
    return IMMotor.cuadrosDeGif(f).then(function(gif) {
      var cuadros = [], cadena = Promise.resolve(), nombre = null, total = gif.cuadros.length;
      gif.cuadros.forEach(function(q, k) {
        cadena = cadena.then(function() {
          if (cancelado()) throw {
            codigo: "cancelado"
          };
          av("Cuadro " + (k + 1) + " de " + total + ".");
          return createImageBitmap(q.img).then(function(bm) {
            IMMotor.usarCuadro(f, bm);
            return Promise.resolve(fn(f, i, function() {}, cancelado)).then(function(r) {
              IMMotor.usarCuadro(f, null);
              if (!r) return;
              nombre = r.nombre;
              return createImageBitmap(r.blob).then(function(b) {
                cuadros.push(b);
              });
            }, function(e) {
              IMMotor.usarCuadro(f, null);
              throw e;
            });
          });
        });
      });
      return cadena.then(function() {
        if (!cuadros.length) return null;
        av("Armando el GIF…");
        var lado = Math.max(cuadros[0].width, cuadros[0].height);
        return IMMotor.trabajar({
          op: "gif",
          fuentes: cuadros,
          o: {
            lado: lado,
            demoras: gif.cuadros.map(function(q) {
              return q.demora;
            }),
            demora: 100,
            repetir: true,
            transparente: gif.transparente
          }
        }, function(h, t) {
          av("Armando el GIF… Cuadro " + h + " de " + t + ".");
        }, cuadros).then(function(r) {
          return {
            nombre: String(nombre).replace(/\.\w+$/, "") + ".gif",
            blob: r.blob,
            nota: total + " cuadros."
          };
        });
      });
    });
  }
  function cadaImagen(texto, fn, extra) {
    extra = extra || {};
    var ids = IM.archivos().map(function(a) {
      return a.id;
    });
    var archivos = IM.archivos().map(function(a) {
      return a.file;
    });
    var anima = gifQueda(), avisa = GIF_AVISA.test(IM_RUTA()) || GIF_ANIMA.test(IM_RUTA()) && !anima, quietos = [];
    var fnOrig = fn;
    fn = function(f, i, av, cancelado) {
      if (!anima && !avisa) return fnOrig(f, i, av, cancelado);
      return IMMotor.esGifAnimado(f).then(function(si) {
        if (!si) return fnOrig(f, i, av, cancelado);
        if (anima) return rehacerGif(f, fnOrig, i, av, cancelado);
        quietos.push(f.name);
        return fnOrig(f, i, av, cancelado);
      });
    };
    var fin = function(r) {
      if (r && quietos.length) IM.aviso(nombresY(quietos) + (quietos.length > 1 ? " son GIF animados" : " es un GIF animado") + ": el resultado usa solo el primer cuadro.");
      return r;
    };
    return IM.procesar({
      textoInicial: texto + "…",
      zip: extra.zip !== undefined ? extra.zip : enZip(),
      nombreZip: extra.nombreZip || "imagomakk.zip",
      alCancelar: function() {
        IMMotor.cancelar();
      },
      preparar: function(av, cancelado) {
        var listos = [], cadena = Promise.resolve();
        archivos.forEach(function(f, i) {
          cadena = cadena.then(function() {
            if (cancelado()) throw {
              codigo: "cancelado"
            };
            var pre = texto + "…" + (archivos.length > 1 ? " " + (extra.unidad || "Imagen") + " " + (i + 1) + " de " + archivos.length + "." : "");
            av(pre);
            return fn(f, i, function(t) {
              av(t ? pre + " " + t : pre);
            }, cancelado).then(function(r) {
              (Array.isArray(r) ? r : [ r ]).forEach(function(x) {
                if (x) {
                  if (x.origen == null) x.origen = ids[i];
                  listos.push(x);
                }
              });
            }, function(e) {
              if (e && !e.archivo && e.codigo !== "cancelado") e.archivo = f.name;
              throw e;
            });
          });
        });
        return cadena.then(function() {
          return {
            listos: listos,
            sinDescargar: extra.sinDescargar
          };
        });
      }
    }).then(fin);
  }
  function codificar(fuente, pasos, salida, transferir) {
    return IMMotor.trabajar({
      op: "procesar",
      fuente: fuente,
      pasos: pasos || [],
      salida: salida
    }, null, transferir);
  }
  function canvasABitmap(c) {
    return createImageBitmap(c);
  }
  function volverOpciones() {
    $$('.h-opciones .desp:not([data-multi="1"])').forEach(function(d) {
      var r = IM_ES($(".desp-rotulo", d)).replace(/:$/, ""), li = $("li[data-inicial]", d) || $("li", d);
      if (li && IM.opcion(r) !== IM_ES(li)) IM.ponerOpcion(r, IM_ES(li));
    });
    $$(".h-opciones input").forEach(function(i) {
      if (i.type === "checkbox") {
        if (i.checked !== i.defaultChecked) {
          i.checked = i.defaultChecked;
          i.dispatchEvent(new Event("change", {
            bubbles: true
          }));
        }
      } else if (i.type !== "file" && i.value !== i.defaultValue) {
        i.value = i.defaultValue;
        i.dispatchEvent(new Event("input", {
          bubbles: true
        }));
        i.dispatchEvent(new Event("change", {
          bubbles: true
        }));
      }
    });
  }
  var BOTON_REST = '<button type="button" class="restablecer">Restablecer</button>';
  document.addEventListener("click", function(e) {
    var b = e.target.closest(".restablecer");
    if (!b || b.hasAttribute("data-desde-resultados")) return;
    volverOpciones();
    IM.aviso("");
    document.dispatchEvent(new Event("im-restablecer"));
  });
  function Visor(cont, op) {
    op = op || {};
    if (!op.grilla) op.grilla = function() {};
    var self = this;
    this.i = 0;
    this.cont = cont;
    this.op = op;
    this.lote = 0;
    var conPrevia = /^\/(dividir-imagen|dividir-imagen-para-instagram|girar-y-voltear|blanco-y-negro-y-filtros|foto-a-dibujo|recortar-imagen|desenfocar|marca-de-agua|crear-meme|agregar-texto-y-dibujos|collage|crear-gif|foto-carnet-y-pasaporte)\//.test(IM_RUTA());
    cont.innerHTML = '<div class="visor" hidden><p class="res-rotulo visor-rotulo">' + (conPrevia ? "Vista previa" : "Original") + BOTON_REST + "</p>" + (op.grilla ? '<div class="visor-ver"></div>' : "") + '<div class="visor-uno"><div class="visor-area"><div class="visor-marco"><canvas class="visor-lienzo"></canvas><div class="visor-capa"></div></div>' + (op.derecha ? '<div class="visor-marco visor-der"></div>' : "") + "</div>" + (op.nota ? '<p class="visor-nota">' + esc(op.nota) + "</p>" : "") + "</div>" + (op.grilla ? '<div class="gal-grilla visor-grilla" hidden></div>' : "") + "</div>";
    if ($(".visor-nota", cont)) IM.suavizarAlto($(".visor-nota", cont));
    this.el = $(".visor", cont);
    this.lienzo = $(".visor-lienzo", cont);
    this.capa = $(".visor-capa", cont);
    this.der = $(".visor-der", cont);
    this.uno = $(".visor-uno", cont);
    this.grilla = $(".visor-grilla", cont);
    this.barra = $(".visor-ver", cont);
    var rot = $(".visor-rotulo", cont), conVista = null;
    var ponRotulo = function() {
      var hay = conPrevia || !!$(".visor-previa:not([hidden]), .visor-vivo:not([hidden])", self.el);
      if (hay === conVista || !rot || !rot.firstChild || rot.firstChild.nodeType !== 3) return;
      conVista = hay;
      rot.firstChild.data = hay ? "Vista previa" : "Original";
    };
    new MutationObserver(ponRotulo).observe(this.el, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [ "hidden", "src" ]
    });
    IM.usarEleccion();
    document.addEventListener("im-restablecer", function() {
      setTimeout(function() {
        if (!document.body.contains(self.el)) return;
        IM.pintarEtiquetas();
        if (self.img) self.ir(IM.elegido());
        if (self.refrescar) self.refrescar();
      }, 0);
    });
    IM.alElegirArchivo(function() {
      var i = IM.elegido(), n = IM.nVer(IM.archivos().length);
      if (self.enGrilla()) {
        self.lote = Math.floor(i / n) * n;
        self.pintarGrilla();
      } else if (op.grilla) self.pintarGrilla();
      self.ir(i);
    });
    IM.alCambiarArchivos(function() {
      self.ir(IM.elegido());
      self.refrescar();
    });
    if (op.grilla) {
      this.refrescar = debounce(function() {
        self.pintarGrilla();
      }, 150);
      IM.alCambiarOpcion(this.refrescar);
      IM.alCambiarVer(function() {
        var n = IM.nVer(IM.archivos().length);
        self.lote = Math.floor(IM.elegido() / n) * n;
        IM.cambiarAlto(self.el, function() {
          self.pintarGrilla(true);
        });
      });
      this.barra.addEventListener("click", function(e) {
        var b = e.target.closest("[data-ver]"), l = e.target.closest("[data-lote]");
        if (b) IM.ponerVer(+b.dataset.ver);
        if (l && IM.nVer(IM.archivos().length) === 1) {
          IM.elegirIndice(Math.max(0, Math.min(IM.archivos().length - 1, IM.elegido() + +l.dataset.lote)));
          return;
        }
        if (l) {
          self.lote += +l.dataset.lote * IM.nVer(IM.archivos().length);
          IM.cambiarAlto(self.el, function() {
            self.pintarGrilla(true);
          });
        }
      });
      this.grilla.addEventListener("click", function(e) {
        var c = e.target.closest(".gal-cuadro");
        if (!c) return;
        IM.elegirIndice(+c.dataset.i);
        IM.ponerVer(1);
      });
    } else this.refrescar = function() {};
    Promise.resolve().then(function() {
      self.ir(IM.elegido());
    });
  }
  Visor.prototype.ir = function(i) {
    var arch = IM.archivos(), self = this;
    var vacio = !arch.length;
    if (vacio) {
      if (!this.el.hidden) IM.ocultarSuave(this.el);
      this.actual = null;
      this.img = null;
      if (this.op.alCambiar) this.op.alCambiar(null);
      return;
    }
    var oculto = this.el.hidden || !!this.el.dataset.saliendoAlto;
    if (oculto && this.actual === arch[Math.max(0, Math.min(arch.length - 1, i))].file && this.img) IM.mostrarSuave(this.el); else if (oculto) this._mostrar = true;
    if (this.op.grilla && !this.pintada) {
      this.pintada = true;
      this.pintarGrilla();
    }
    this.i = Math.max(0, Math.min(arch.length - 1, i));
    var f = arch[this.i].file;
    if (arch[this.i].tipo === "video") {
      this.actual = null;
      this.img = null;
      if (!this.el.hidden) IM.ocultarSuave(this.el);
      return;
    }
    if (this.actual === f && this.img) {
      if (this.op.alCambiar) this.op.alCambiar(this);
      return;
    }
    this.actual = f;
    Promise.all([ IMMotor.bitmap(f), IMMotor.esGifAnimado(f) ]).then(function(rr) {
      var img = rr[0], animado = rr[1];
      if (self.actual !== f) return;
      self.img = img;
      $$("canvas.sf-capa", self.el).forEach(function(c) {
        c.getContext("2d").clearRect(0, 0, c.width, c.height);
      });
      var lado = self.op.lado || 900, e = Math.min(1, lado / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.round(img.width * e);
      c.height = Math.round(img.height * e);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      var pv = $(".visor-previa:not([hidden])", self.el);
      var cambiar = function(url) {
        if (self.actual !== f) return;
        var dibujar = function() {
          self.lienzo.width = c.width;
          self.lienzo.height = c.height;
          self.escala = e;
          self.lienzo.getContext("2d").drawImage(c, 0, 0);
          var gi = $(".visor-gif", self.el);
          if (animado) {
            if (!gi) {
              gi = document.createElement("img");
              gi.className = "visor-gif";
              gi.alt = "";
              self.lienzo.parentNode.insertBefore(gi, self.lienzo.nextSibling);
            }
            if (gi._url) URL.revokeObjectURL(gi._url);
            gi._url = URL.createObjectURL(f);
            gi.src = gi._url;
            gi.hidden = false;
          } else if (gi) {
            gi.hidden = true;
            if (gi._url) {
              URL.revokeObjectURL(gi._url);
              gi._url = null;
            }
            gi.removeAttribute("src");
          }
          if (url && pv) {
            pv.src = url;
          }
          if (self.op.alCambiar) self.op.alCambiar(self);
        };
        if (self._mostrar) {
          self._mostrar = false;
          self.el.hidden = false;
          self.el.classList.add("quieto");
          dibujar();
          void self.el.offsetHeight;
          self.el.classList.remove("quieto");
          self.el.hidden = true;
          IM.mostrarSuave(self.el);
        } else IM.altoSuave(self.el, dibujar);
      };
      if (pv && self.op.prepararPrevia) {
        var listo = false;
        self.op.prepararPrevia(c, f).then(function(url) {
          if (!url) {
            cambiar();
            return;
          }
          var im = new Image;
          im.onload = im.onerror = function() {
            listo = true;
            cambiar(url);
          };
          im.src = url;
        }, function() {
          cambiar();
        });
      } else cambiar();
    }, function(e) {
      IM.aviso(IM.textoError(e));
    });
  };
  Visor.prototype.enGrilla = function() {
    return !!this.op.grilla && IM.nVer(IM.archivos().length) > 1;
  };
  Visor.prototype.pintarGrilla = function() {
    if (!this.op.grilla) return;
    var self = this, arch = IM.archivos(), total = arch.length, n = IM.nVer(total);
    this.lote = Math.max(0, Math.min(this.lote, Math.floor(Math.max(0, total - 1) / n) * n));
    var nueva = total ? IM.htmlBarraVer("", total, n, n === 1 ? IM.elegido() : this.lote) : "", br = this.barra;
    if (br.innerHTML !== nueva) IM.altoSuave(br, function() {
      br.innerHTML = nueva;
    });
    var grilla = n > 1 && total > 1;
    this.uno.hidden = grilla;
    this.grilla.hidden = !grilla;
    this.grilla.className = "gal-grilla visor-grilla n" + n;
    if (!grilla) return;
    var tok = this.tokGrilla = (this.tokGrilla || 0) + 1, eleg = IM.elegido();
    this.grilla.innerHTML = arch.slice(this.lote, this.lote + n).map(function(a, k) {
      return '<button type="button" class="gal-cuadro' + (self.lote + k === eleg ? " elegido" : "") + '" data-i="' + (self.lote + k) + '"><span class="gal-marco"></span><span class="gal-nombre">' + esc(a.file.name) + "</span></button>";
    }).join("");
    arch.slice(this.lote, this.lote + n).forEach(function(a, k) {
      IMMotor.bitmap(a.file).then(function(img) {
        if (tok !== self.tokGrilla) return;
        var marco = $$(".gal-marco", self.grilla)[k];
        if (!marco) return;
        var e = Math.min(1, 360 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * e));
        c.height = Math.max(1, Math.round(img.height * e));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        var caja = document.createElement("span");
        caja.className = "gal-img";
        caja.appendChild(c);
        marco.innerHTML = "";
        marco.appendChild(caja);
        self.op.grilla(caja, a.file, img, c);
      }, function() {});
    });
  };
  Visor.prototype.muestra = function() {
    return this.img ? createImageBitmap(this.lienzo) : Promise.reject();
  };
  window.IMHerramientas = {
    _valorMulti: function(d) {
      var sel = $$('li[aria-selected="true"]', d).map(function(li) {
        return IM_ES(li);
      });
      return sel.length === 0 ? "Ninguno" : sel.length <= 2 ? sel.join(", ") : sel.length + " idiomas";
    }
  };
  var H = window.IMHerramientas;
  function desplegablePropio(rotulo, items, elegidos) {
    var id = "op-" + rotulo.replace(/\W+/g, "");
    var sel = items.filter(function(it) {
      return elegidos.indexOf(it) >= 0;
    });
    return '<div class="desp" data-multi="1" data-valor-propio="1"><button type="button" class="desp-boton" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '">' + '<span class="desp-texto"><span class="desp-rotulo">' + esc(rotulo) + '</span> <span class="desp-valor">' + esc(sel.length <= 2 ? sel.join(", ") : sel.length + " idiomas") + "</span></span>" + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><ul class="desp-lista" id="' + id + '" role="listbox" aria-multiselectable="true" aria-label="' + esc(rotulo) + '" hidden>' + items.map(function(it) {
      return '<li role="option" tabindex="-1" aria-selected="' + (elegidos.indexOf(it) >= 0) + '">' + esc(it) + "</li>";
    }).join("") + "</ul></div>";
  }
  function opcionColor(rotulo, valor, ui) {
    if (rotulo !== "Fondo") return null;
    var items = valor.replace(/\.$/, "").split(" · ");
    return ui.grupo(rotulo, items) + campo("campo-color", "Color", '<input type="color" value="#ffffff">', true);
  }
  function colorFondo() {
    var v = IM.opcion("Fondo") || "";
    if (/Transparente|original/i.test(v)) return null;
    if (/Blanco/.test(v)) return "#ffffff";
    if (/Negro/.test(v)) return "#000000";
    if (/Gris claro/.test(v)) return "#e9e9e9";
    var c = $("#campo-color input");
    return c ? c.value : "#ffffff";
  }
  function fondoManda() {
    var transp = /^Transparente/.test(IM.opcion("Fondo") || "");
    IM.ocultarValores("Fondo", []);
    if (transp && /JPG/.test(IM.opcion("Formato") || "")) IM.ponerOpcion("Formato", "PNG");
    IM.ocultarValores("Formato", transp ? [ /^JPG/ ] : []);
  }
  function avanceModelo(av) {
    return function(a, t) {
      av("Cargando el modelo de inteligencia artificial: " + porc(a, t) + " %.");
    };
  }
  function soloPersonas() {
    return /personas/i.test(IM.opcion("Qué dejar") || "");
  }
  H["quitar-fondo"] = {
    opcion: opcionColor,
    montar: function(cont) {
      new Visor(cont, {});
      var act = function() {
        fondoManda();
        mostrarSi($("#campo-color"), /color a elección/.test(IM.opcion("Fondo") || ""));
        IM.mostrarOpcion("Calidad", !soloPersonas());
      };
      IM.alCambiarOpcion(act);
      act();
    },
    procesar: function() {
      var calidad = /máxima/i.test(IM.opcion("Calidad") || "") ? "máxima" : "buena", que = soloPersonas() ? "personas" : "principal";
      cadaImagen("Quitando el fondo", function(f, i, av) {
        var fmt = formatoElegido("Formato", f), color = colorFondo();
        if (fmt === "jpg" && !color) color = "#ffffff";
        return IMMotor.quitarFondo(f, calidad, avanceModelo(av), que).then(function(png) {
          av("Guardando…");
          return codificar(png, color ? [ {
            fondo: color
          } ] : [], {
            formato: fmt,
            calidad: 90
          });
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-sin-fondo." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "sin-fondo.zip"
      });
    }
  };
  H["colorear-fotos"] = {
    montar: function(cont) {
      new Visor(cont, {});
    },
    procesar: function() {
      cadaImagen("Coloreando", function(f, i, av) {
        var fmt = formatoElegido("Formato", f), carga = avanceModelo(av);
        return IMMotor.bitmap(f).then(function(img) {
          return IMMotor.colorear(img, function(a, t) {
            if (a >= t) av(); else carga(a, t);
          });
        }).then(function(b) {
          av("Guardando…");
          return codificar(b, [], {
            formato: fmt,
            calidad: 92
          }, [ b ]);
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-color." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "coloreadas.zip"
      });
    }
  };
  var PINCEL = {
    chico: .012,
    mediano: .025,
    grande: .05
  };
  H["borrar-objetos"] = {
    montar: function(cont) {
      var hecho = {}, trazos = {}, hist = {}, v, url = null, tokV = 0;
      var radio = function() {
        var o = (IM.opcion("Tamaño del pincel") || "").toLowerCase();
        return PINCEL[o] || PINCEL.mediano;
      };
      var clave = function() {
        return v && v.actual ? claveArch(v.actual) : null;
      };
      var pintura = document.createElement("canvas");
      pintura.className = "bo-pintura";
      var cursor = document.createElement("span");
      cursor.className = "bo-cursor";
      cursor.hidden = true;
      var deshacer = document.createElement("button");
      deshacer.type = "button";
      deshacer.className = "boton-chico bo-deshacer";
      deshacer.textContent = "Deshacer";
      var hayAlgo = function() {
        return IM.archivos().some(function(a) {
          var k = claveArch(a.file);
          return (trazos[k] || []).length || hecho[k];
        });
      };
      var estado = function() {
        var k = clave();
        deshacer.disabled = !k || !(hist[k] || []).length;
        IM.botonHabilitado(hayAlgo() || !IM.archivos().length);
      };
      var dibujar = function() {
        var k = clave(), W = v.lienzo.width, Hh = v.lienzo.height;
        if (pintura.width !== W || pintura.height !== Hh) {
          pintura.width = W;
          pintura.height = Hh;
        }
        var g = pintura.getContext("2d");
        g.clearRect(0, 0, W, Hh);
        g.strokeStyle = g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--acento").trim() || "#c27a1e";
        g.lineCap = g.lineJoin = "round";
        (k && trazos[k] || []).forEach(function(s) {
          var r = s.r * Math.max(W, Hh);
          g.lineWidth = 2 * r;
          g.beginPath();
          g.moveTo(s.p[0][0] * W, s.p[0][1] * Hh);
          if (s.p.length === 1) {
            g.arc(s.p[0][0] * W, s.p[0][1] * Hh, r, 0, 2 * Math.PI);
            g.fill();
            return;
          }
          s.p.forEach(function(q) {
            g.lineTo(q[0] * W, q[1] * Hh);
          });
          g.stroke();
        });
      };
      var mostrarHecho = function() {
        var k = clave(), der = $(".visor-previa", cont), c = k && hecho[k], t = ++tokV;
        if (!c) {
          if (der) der.hidden = true;
          v.lienzo.style.visibility = "";
          return;
        }
        c.toBlob(function(b) {
          if (t !== tokV || !b) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(b);
          if (!der) {
            der = document.createElement("img");
            der.className = "visor-previa";
            der.alt = "";
            v.lienzo.parentNode.insertBefore(der, v.capa);
          }
          der.src = url;
          der.hidden = false;
        }, "image/png");
      };
      var todo = function() {
        dibujar();
        mostrarHecho();
        estado();
        if (v.refrescar) v.refrescar();
      };
      v = new Visor(cont, {
        nota: " ",
        alCambiar: function() {
          if (!v || !v.img) return;
          if (pintura.parentNode !== v.capa) {
            v.capa.appendChild(pintura);
            v.capa.appendChild(cursor);
            v.capa.classList.add("bo-capa");
          }
          var n = $(".visor-nota", cont);
          if (n && deshacer.parentNode !== n) {
            n.textContent = "";
            n.appendChild(deshacer);
          }
          todo();
        },
        grilla: function(marco, f, img, c) {
          var k = claveArch(f), g = c.getContext("2d");
          if (hecho[k]) g.drawImage(hecho[k], 0, 0, c.width, c.height);
          var ts = trazos[k] || [];
          if (!ts.length) return;
          var p = document.createElement("canvas");
          p.width = c.width;
          p.height = c.height;
          var q = p.getContext("2d"), W = c.width, Hh = c.height;
          q.strokeStyle = q.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--acento").trim() || "#c27a1e";
          q.lineCap = q.lineJoin = "round";
          ts.forEach(function(s) {
            var r = s.r * Math.max(W, Hh);
            q.lineWidth = 2 * r;
            q.beginPath();
            q.moveTo(s.p[0][0] * W, s.p[0][1] * Hh);
            if (s.p.length === 1) {
              q.arc(s.p[0][0] * W, s.p[0][1] * Hh, r, 0, 2 * Math.PI);
              q.fill();
              return;
            }
            s.p.forEach(function(pt) {
              q.lineTo(pt[0] * W, pt[1] * Hh);
            });
            q.stroke();
          });
          g.globalAlpha = .5;
          g.drawImage(p, 0, 0);
          g.globalAlpha = 1;
        }
      });
      var enCapa = function(e) {
        var b = v.capa.getBoundingClientRect();
        return [ Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)), b ];
      };
      var verCursor = function(e) {
        var q = enCapa(e), b = q[2], d = 2 * radio() * Math.max(b.width, b.height);
        cursor.style.width = cursor.style.height = d + "px";
        cursor.style.left = q[0] * 100 + "%";
        cursor.style.top = q[1] * 100 + "%";
        cursor.hidden = false;
      };
      v.capa.addEventListener("pointermove", function(e) {
        if (v.img) verCursor(e);
      });
      v.capa.addEventListener("pointerleave", function() {
        cursor.hidden = true;
      });
      v.capa.addEventListener("pointerdown", function(e) {
        if (!v.img || e.button > 0) return;
        e.preventDefault();
        var k = clave(), q = enCapa(e);
        var s = {
          r: radio(),
          p: [ [ q[0], q[1] ] ]
        };
        (trazos[k] = trazos[k] || []).push(s);
        (hist[k] = hist[k] || []).push({
          t: "trazo"
        });
        v.capa.setPointerCapture(e.pointerId);
        dibujar();
        estado();
        var mover = function(ev) {
          var r = enCapa(ev);
          s.p.push([ r[0], r[1] ]);
          verCursor(ev);
          dibujar();
        };
        var soltar = function() {
          v.capa.removeEventListener("pointermove", mover);
          v.capa.removeEventListener("pointerup", soltar);
          v.capa.removeEventListener("pointercancel", soltar);
          if (v.refrescar) v.refrescar();
        };
        v.capa.addEventListener("pointermove", mover);
        v.capa.addEventListener("pointerup", soltar);
        v.capa.addEventListener("pointercancel", soltar);
      });
      deshacer.addEventListener("click", function() {
        var k = clave(), h = k && hist[k];
        if (!h || !h.length) return;
        var u = h.pop();
        if (u.t === "trazo") trazos[k].pop(); else {
          hecho[k] = u.antes;
          trazos[k] = u.trazos;
        }
        todo();
      });
      document.addEventListener("keydown", function(e) {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && document.body.contains(deshacer) && !/INPUT|TEXTAREA/.test(e.target && e.target.tagName || "")) {
          e.preventDefault();
          deshacer.click();
        }
      });
      document.addEventListener("im-restablecer", function() {
        hecho = {};
        trazos = {};
        hist = {};
        if (v.img) todo();
      });
      IM.alCambiarArchivos(estado);
      IM.alCambiarOpcion(function() {
        cursor.hidden = true;
      });
      this._borrar = function(f, av) {
        var k = claveArch(f), ts = trazos[k] || [];
        var hecho0 = hecho[k];
        if (!ts.length) return Promise.resolve(hecho0 || null);
        return (hecho0 ? Promise.resolve(hecho0) : IMMotor.bitmap(f)).then(function(img) {
          var W = img.width, Hh = img.height, m = document.createElement("canvas");
          m.width = W;
          m.height = Hh;
          var g = m.getContext("2d");
          g.lineCap = g.lineJoin = "round";
          g.strokeStyle = g.fillStyle = "#000";
          ts.forEach(function(s) {
            var r = s.r * Math.max(W, Hh);
            g.lineWidth = 2 * r;
            g.beginPath();
            g.moveTo(s.p[0][0] * W, s.p[0][1] * Hh);
            if (s.p.length === 1) {
              g.arc(s.p[0][0] * W, s.p[0][1] * Hh, r, 0, 2 * Math.PI);
              g.fill();
              return;
            }
            s.p.forEach(function(q) {
              g.lineTo(q[0] * W, q[1] * Hh);
            });
            g.stroke();
          });
          var carga = avanceModelo(av);
          return IMMotor.borrar(img, m, function(a, t) {
            if (a >= t) av(); else carga(a, t);
          });
        }).then(function(c) {
          var r = document.createElement("canvas");
          r.width = c.width;
          r.height = c.height;
          r.getContext("2d").drawImage(c, 0, 0);
          (hist[k] = hist[k] || []).push({
            t: "borrado",
            antes: hecho0 || null,
            trazos: ts
          });
          hecho[k] = r;
          trazos[k] = [];
          if (v.actual === f) todo(); else estado();
          return r;
        });
      };
    },
    procesar: function() {
      var self = this;
      cadaImagen("Borrando", function(f, i, av) {
        var fmt = formatoElegido("Formato", f);
        return self._borrar(f, av).then(function(c) {
          if (!c) return null;
          av("Guardando…");
          return canvasABitmap(c).then(function(b) {
            return codificar(b, [], {
              formato: fmt,
              calidad: 92
            }, [ b ]);
          }).then(function(r) {
            return {
              nombre: base(f.name) + "-sin-objetos." + fmt,
              blob: r.blob
            };
          });
        });
      }, {
        nombreZip: "sin-objetos.zip"
      });
    }
  };
  var ICO_COPIAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>', ICO_TILDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function mejorarImagenes(clave, texto, sufijo, formatoDe, anchoDe) {
    return cadaImagen(texto, function(f, i, av, cancelado) {
      var meta = null;
      return IMMotor.bitmap(f).then(function(img) {
        var cl = clave;
        if (anchoDe) {
          var W = anchoDe(f, img), k = W / img.width;
          if (!(k > 1) || k > 4) throw {
            codigo: "ancho-ia",
            archivo: f.name,
            min: img.width + 1,
            max: img.width * 4
          };
          meta = {
            w: Math.round(W),
            h: Math.max(1, Math.round(img.height * k))
          };
          cl = k <= 2 ? "x2" : "x4";
        }
        var factor = cl === "x4" ? 4 : cl === "x2" ? 2 : 1, w = img.width * factor, h = img.height * factor;
        if (w * h > 8e7) throw {
          codigo: "memoria-ia",
          archivo: f.name,
          ancho: w,
          alto: h
        };
        av("Cargando el modelo de inteligencia artificial…");
        return IMMotor.mejorar(cl, f, function(p) {
          av(Math.round(p * 100) + " %.");
        }, cancelado);
      }).then(function(c) {
        av("Guardando…");
        if (meta && (c.width !== meta.w || c.height !== meta.h)) {
          var d = document.createElement("canvas");
          d.width = meta.w;
          d.height = meta.h;
          var g = d.getContext("2d");
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = "high";
          g.drawImage(c, 0, 0, meta.w, meta.h);
          c = d;
        }
        var fmt = formatoDe(f);
        return canvasABitmap(c).then(function(b) {
          return codificar(b, [], {
            formato: fmt,
            calidad: 92
          }, [ b ]);
        }).then(function(r) {
          return {
            nombre: base(f.name) + (meta ? "-" + meta.w + "x" + meta.h : sufijo) + "." + fmt,
            blob: r.blob
          };
        });
      });
    });
  }
  function aMedida() {
    return /medida/i.test(IM.opcion("Aumento") || "");
  }
  function anchoPedido() {
    var i = $("#campo-ancho-ia input");
    return i ? num(i.value) : 0;
  }
  H["agrandar-imagen"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo === "Aumento") return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + campo("campo-ancho-ia", "Ancho (px)", '<input type="number" min="1" step="1" inputmode="numeric">', true);
      return null;
    },
    montar: function(cont) {
      var v = new Visor(cont, {
        alCambiar: function() {
          medidas();
        }
      });
      var medidas = function() {
        mostrarSi($("#campo-ancho-ia"), aMedida());
        var p = $(".visor-nota", cont) || cont.appendChild(Object.assign(document.createElement("p"), {
          className: "visor-nota"
        }));
        if (!v.img) {
          p.textContent = "";
          return;
        }
        var w = v.img.width, h = v.img.height, ent = $("#campo-ancho-ia input");
        if (aMedida()) {
          if (!ent.value) ent.value = w * 3;
          var W = anchoPedido();
          p.textContent = W > w && W <= w * 4 ? "Mide " + w + " × " + h + " píxeles. Agrandada, " + Math.round(W) + " × " + Math.max(1, Math.round(h * W / w)) + "." : "Mide " + w + " × " + h + " píxeles. El ancho tiene que estar entre " + (w + 1) + " y " + w * 4 + ".";
          return;
        }
        var k = /4/.test(IM.opcion("Aumento") || "") ? 4 : 2;
        p.textContent = "Mide " + w + " × " + h + " píxeles. Agrandada, " + w * k + " × " + h * k + ".";
      };
      IM.alCambiarOpcion(medidas);
      $("#campo-ancho-ia input").addEventListener("input", medidas);
    },
    procesar: function() {
      if (aMedida()) {
        var W = anchoPedido();
        if (!(W > 0)) {
          IM.aviso("Escribí el ancho.");
          return;
        }
        mejorarImagenes("", "Agrandando", "", function(f) {
          return formatoElegido("Formato", f);
        }, function() {
          return W;
        });
        return;
      }
      var clave = /4/.test(IM.opcion("Aumento") || "") ? "x4" : "x2";
      mejorarImagenes(clave, "Agrandando", "-" + clave, function(f) {
        return formatoElegido("Formato", f);
      });
    }
  };
  function conEnlace(frase, ruta) {
    var t = esc(window.TR ? TR(frase) : frase).replace("&lt;a&gt;", '<a href="' + (window.IM_URL ? IM_URL(ruta) : ruta) + '">').replace("&lt;/a&gt;", "</a>");
    return t;
  }
  var FMT_ROTULO = {
    jpg: "JPG",
    jpeg: "JPG",
    png: "PNG",
    webp: "WebP",
    avif: "AVIF"
  };
  function formatoComun() {
    var a = IM.archivos();
    if (!a.length) return null;
    var fs = a.map(function(x) {
      var e = (x.file.name.match(/\.(\w+)$/) || [ , "" ])[1].toLowerCase();
      return FMT_ROTULO[e] || "?";
    });
    return fs.every(function(x) {
      return x === fs[0];
    }) && fs[0] !== "?" ? fs[0] : null;
  }
  H["convertir-imagen"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo !== "Convertir a") return null;
      return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + '<p class="opc-nota" id="nota-formato" hidden></p>';
    },
    montar: function(cont) {
      new Visor(cont, {});
      var repuesto = null, puesto = null;
      var actualizar = function() {
        var comun = formatoComun(), nota = $("#nota-formato"), antes = IM.opcion("Convertir a");
        if (puesto && antes !== puesto) {
          repuesto = null;
          puesto = null;
        }
        if (IM.ocultarValores("Convertir a", comun ? [ comun ] : [])) {
          if (!repuesto) repuesto = antes;
          puesto = IM.opcion("Convertir a");
        } else if (repuesto && repuesto !== comun) {
          var r = repuesto;
          repuesto = null;
          puesto = null;
          IM.ponerOpcion("Convertir a", r);
        }
        if (nota) {
          if (comun) nota.innerHTML = conEnlace((IM.archivos().length === 1 ? "Tu imagen ya está en " + comun + ". Para que pese" : "Tus imágenes ya están en " + comun + ". Para que pesen") + " menos sin cambiar el formato, está <a>Comprimir imagen</a>.", "/comprimir-imagen/");
          mostrarSi(nota, !!comun);
        }
        var f = (IM.opcion("Convertir a") || "").toLowerCase();
        IM.botonTexto("Convertir a " + (IM.opcion("Convertir a") || "JPG"));
        IM.mostrarOpcion("Calidad", f !== "png");
        IM.mostrarOpcion("Fondo de las partes transparentes", f === "jpg");
      };
      IM.alCambiarOpcion(actualizar);
      IM.alCambiarArchivos(actualizar);
      actualizar();
    },
    procesar: function() {
      var fmt = (IM.opcion("Convertir a") || "JPG").toLowerCase(), cal = CALIDAD[IM.opcion("Calidad")] || 88, fondo = /Negro/.test(IM.opcion("Fondo de las partes transparentes") || "") ? "#000000" : "#ffffff";
      cadaImagen("Convirtiendo", function(f) {
        if ((f.name.match(/\.(\w+)$/) || [ , "" ])[1].toLowerCase().replace("jpeg", "jpg") === EXT[fmt]) return Promise.resolve({
          nombre: f.name,
          blob: f,
          nota: "Ya estaba en " + (IM.opcion("Convertir a") || fmt.toUpperCase()) + ": queda igual."
        });
        return IMMotor.fuente(f).then(function(src) {
          return codificar(src, [], {
            formato: fmt,
            calidad: cal,
            fondo: fondo
          }, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          var mismo = (f.name.match(/\.(\w+)$/) || [ , "" ])[1].toLowerCase().replace("jpeg", "jpg") === EXT[fmt];
          return {
            nombre: base(f.name) + (mismo ? "-convertida." : ".") + EXT[fmt],
            blob: r.blob
          };
        });
      }, {
        nombreZip: "convertidas.zip"
      });
    }
  };
  function opcionesSvg() {
    var c = parseInt(IM.opcion("Colores"), 10) || 8, d = (IM.opcion("Detalle") || "Medio").toLowerCase();
    return {
      formato: "svg",
      colores: c,
      detalle: d
    };
  }
  H["imagen-a-svg"] = {
    montar: function(cont) {
      var v, tok = 0, url = null;
      var previa = debounce(function() {
        if (!v || !v.img) return;
        var t = ++tok;
        v.der.innerHTML = '<span class="visor-cargando">Armando la vista previa…</span>';
        v.muestra().then(function(b) {
          return codificar(b, [], opcionesSvg(), [ b ]);
        }).then(function(r) {
          if (t !== tok) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(r.blob);
          v.der.innerHTML = '<img alt="Vista previa en SVG" src="' + url + '">';
        }, function() {});
      }, 250);
      v = new Visor(cont, {
        derecha: true,
        lado: 640,
        alCambiar: previa
      });
      IM.alCambiarOpcion(previa);
    },
    procesar: function() {
      var o = opcionesSvg();
      cadaImagen("Convirtiendo a SVG", function(f) {
        return IMMotor.fuente(f).then(function(src) {
          return codificar(src, [], o, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          return {
            nombre: base(f.name) + ".svg",
            blob: r.blob
          };
        });
      }, {
        nombreZip: "svg.zip"
      });
    }
  };
  var NOMBRES_IDIOMA = Object.keys(IMMotor.IDIOMAS);
  function idiomasIniciales() {
    var nav = (navigator.language || "es").slice(0, 2), mapa = {
      es: "Español",
      en: "Inglés",
      pt: "Portugués",
      fr: "Francés",
      it: "Italiano",
      de: "Alemán",
      ca: "Catalán",
      nl: "Neerlandés",
      pl: "Polaco",
      ro: "Rumano",
      ru: "Ruso",
      uk: "Ucraniano",
      el: "Griego",
      ar: "Árabe",
      he: "Hebreo",
      hi: "Hindi",
      zh: "Chino simplificado",
      ja: "Japonés",
      ko: "Coreano"
    };
    var l = [ mapa[nav] || "Español" ];
    if (l[0] !== "Inglés") l.push("Inglés");
    return l;
  }
  function renglones(data) {
    var out = [];
    (data.blocks || []).forEach(function(b) {
      (b.paragraphs || []).forEach(function(p) {
        (p.lines || []).forEach(function(l) {
          var ws = (l.words || []).filter(function(w) {
            return w.text && w.text.trim();
          });
          if (!ws.length) return;
          var alto = Math.max(8, l.bbox.y1 - l.bbox.y0), celdas = [ [ ws[0].text ] ];
          for (var k = 1; k < ws.length; k++) {
            if (ws[k].bbox.x0 - ws[k - 1].bbox.x1 > alto * 1.6) celdas.push([ ws[k].text ]); else celdas[celdas.length - 1].push(ws[k].text);
          }
          out.push({
            texto: ws.map(function(w) {
              return w.text;
            }).join(" "),
            celdas: celdas.map(function(c) {
              return c.join(" ");
            }),
            parrafoNuevo: l === p.lines[0]
          });
        });
      });
    });
    return out;
  }
  function xmlEsc(t) {
    return String(t).replace(/[&<>"]/g, function(c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      }[c];
    }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  }
  function zip(arch) {
    var m = {};
    Object.keys(arch).forEach(function(k) {
      m[k] = fflate.strToU8(arch[k]);
    });
    return fflate.zipSync(m);
  }
  function docx(partes) {
    var cuerpo = partes.map(function(p) {
      var h = partes.length > 1 ? '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">' + xmlEsc(p.titulo) + "</w:t></w:r></w:p>" : "";
      return h + p.lineas.map(function(l) {
        return '<w:p><w:r><w:t xml:space="preserve">' + xmlEsc(l.texto) + "</w:t></w:r></w:p>";
      }).join("");
    }).join("");
    return zip({
      "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      "word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      "word/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style></w:styles>',
      "word/document.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + cuerpo + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>'
    });
  }
  function xlsx(partes) {
    var col = function(n) {
      var s = "";
      n++;
      while (n) {
        var m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };
    var hojas = {}, lista = "", rels = "", tipos = "", usados = {};
    partes.forEach(function(p, i) {
      var filas = p.lineas.map(function(l, r) {
        return '<row r="' + (r + 1) + '">' + l.celdas.map(function(c, k) {
          var n = /^-?\d+([.,]\d+)?$/.test(c.trim()) ? c.trim().replace(",", ".") : null;
          return n !== null ? '<c r="' + col(k) + (r + 1) + '"><v>' + n + "</v></c>" : '<c r="' + col(k) + (r + 1) + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(c) + "</t></is></c>";
        }).join("") + "</row>";
      }).join("");
      hojas["xl/worksheets/sheet" + (i + 1) + ".xml"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + filas + "</sheetData></worksheet>";
      var nombre = (p.titulo || "Hoja " + (i + 1)).replace(/[\\\/?*\[\]:]/g, " ").slice(0, 31), k = 2;
      while (usados[nombre.toLowerCase()]) nombre = nombre.slice(0, 28) + " " + k++;
      usados[nombre.toLowerCase()] = 1;
      lista += '<sheet name="' + xmlEsc(nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      tipos += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    });
    hojas["[Content_Types].xml"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + tipos + "</Types>";
    hojas["_rels/.rels"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    hojas["xl/workbook.xml"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + lista + "</sheets></workbook>";
    hojas["xl/_rels/workbook.xml.rels"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + "</Relationships>";
    return zip(hojas);
  }
  H["extraer-texto-de-imagen"] = {
    opcion: function(rotulo) {
      if (rotulo === "Idioma") return desplegablePropio("Idiomas", NOMBRES_IDIOMA, idiomasIniciales());
      return null;
    },
    montar: function(cont) {
      new Visor(cont, {});
      var salida = document.createElement("div");
      salida.className = "texto-salida";
      salida.id = "texto-salida";
      salida.hidden = true;
      cont.appendChild(salida);
    },
    procesar: function() {
      var nombres = IM.multi("Idiomas");
      if (!nombres.length) {
        IM.aviso("Elegí al menos un idioma.");
        return;
      }
      var codigos = nombres.map(function(n) {
        return IMMotor.IDIOMAS[n];
      }), res = IM.opcion("Resultado") || "", partes = [];
      var archivos = IM.archivos().map(function(a) {
        return a.file;
      });
      IM.procesar({
        textoInicial: "Preparando el reconocedor de texto…",
        alCancelar: function() {
          IMMotor.soltarOcr();
        },
        preparar: function(av, cancelado) {
          var cadena = Promise.resolve();
          archivos.forEach(function(f, i) {
            cadena = cadena.then(function() {
              if (cancelado()) throw {
                codigo: "cancelado"
              };
              var pre = "Leyendo el texto…" + (archivos.length > 1 ? " Imagen " + (i + 1) + " de " + archivos.length + "." : "");
              av(pre);
              return IMMotor.leerTexto(f, codigos, function(m) {
                if (/loading language/.test(m.status)) av("Descargando el reconocedor de texto: " + Math.round((m.progress || 0) * 100) + " %."); else if (/recognizing/.test(m.status)) av(pre + " " + Math.round((m.progress || 0) * 100) + " %.");
              }).then(function(d) {
                partes.push({
                  titulo: base(f.name),
                  lineas: renglones(d),
                  texto: (d.text || "").trim()
                });
              });
            });
          });
          return cadena.then(function() {
            var nombre = archivos.length === 1 ? base(archivos[0].name) : "texto-de-" + archivos.length + "-imagenes";
            var sal = $("#texto-salida");
            if (/copiarlo/.test(res)) {
              sal.innerHTML = partes.map(function(p, i) {
                return '<div class="texto-bloque">' + (partes.length > 1 ? "<h3>" + esc(p.titulo) + "</h3>" : "") + '<div class="texto-caja"><textarea rows="10" spellcheck="false">' + esc(p.texto) + '</textarea><button type="button" class="copiar" data-copiar="' + i + '">' + ICO_COPIAR + "<span>Copiar</span></button></div></div>";
              }).join("");
              $$("[data-copiar]", sal).forEach(function(b) {
                b.addEventListener("click", function() {
                  var t = b.previousElementSibling;
                  navigator.clipboard.writeText(t.value).then(function() {
                    b.innerHTML = ICO_TILDE + "<span>Copiado</span>";
                    b.classList.add("hecho");
                    clearTimeout(b._t);
                    b._t = setTimeout(function() {
                      b.innerHTML = ICO_COPIAR + "<span>Copiar</span>";
                      b.classList.remove("hecho");
                    }, 2e3);
                  }, function() {
                    t.select();
                  });
                });
              });
              if (sal.hidden) {
                sal.hidden = false;
                IM.expandir(sal);
              }
              if (!partes.some(function(p) {
                return p.texto;
              })) IM.aviso("No se encontró texto en la imagen.");
              return {
                listos: []
              };
            }
            if (!partes.some(function(p) {
              return p.texto;
            })) {
              IM.aviso("No se encontró texto en la imagen.");
              return {
                listos: []
              };
            }
            if (/Word/.test(res)) return {
              listos: [ {
                nombre: nombre + ".docx",
                blob: new Blob([ docx(partes) ], {
                  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                })
              } ]
            };
            if (/Excel/.test(res)) return {
              listos: [ {
                nombre: nombre + ".xlsx",
                blob: new Blob([ xlsx(partes) ], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                })
              } ]
            };
            var txt = partes.map(function(p) {
              return (partes.length > 1 ? "— " + p.titulo + " —\n\n" : "") + p.texto;
            }).join("\n\n");
            return {
              listos: [ {
                nombre: nombre + ".txt",
                blob: new Blob([ "\ufeff" + txt ], {
                  type: "text/plain;charset=utf-8"
                })
              } ]
            };
          });
        }
      });
    }
  };
  function campoKB(id, oculto) {
    return campo(id, "Peso máximo (KB)", '<input type="number" min="5" step="1" value="100" inputmode="numeric">', oculto);
  }
  H["comprimir-imagen"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo !== "Cómo") return null;
      return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + campoKB("campo-kb", true);
    },
    montar: function(cont) {
      new Visor(cont, {});
      var act = function() {
        var peso = /peso/.test(IM.opcion("Cómo") || "");
        mostrarSi($("#campo-kb"), peso);
        IM.mostrarOpcion("Calidad", !peso);
      };
      IM.alCambiarOpcion(act);
      act();
    },
    procesar: function() {
      var peso = /peso/.test(IM.opcion("Cómo") || ""), kb = num($("#campo-kb input").value), cal = CALIDAD[IM.opcion("Calidad")] || 75;
      if (peso && !(kb >= 5)) {
        IM.aviso("Escribí el peso máximo en KB (5 o más).");
        return;
      }
      cadaImagen("Comprimiendo", function(f) {
        var fmt = formatoElegido("Formato", f);
        if (peso && fmt === IMMotor.formatoOriginal(f) && !IMMotor.formatoRaro(f) && f.size <= kb * 1024) return sinDatos(f).then(function(limpia) {
          limpia = limpia || f;
          return {
            nombre: base(f.name) + "-comprimida." + fmt,
            blob: limpia,
            nota: "Ya pesaba menos de " + kb + " KB: queda igual."
          };
        });
        return IMMotor.fuente(f).then(function(src) {
          return codificar(src, [], peso ? {
            formato: fmt,
            maxBytes: kb * 1024
          } : {
            formato: fmt,
            calidad: cal
          }, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          var mismo = fmt === IMMotor.formatoOriginal(f) && !IMMotor.formatoRaro(f);
          if (!peso && mismo && r.blob.size >= f.size) return sinDatos(f).then(function(limpia) {
            if (!limpia) limpia = r.blob;
            return {
              nombre: base(f.name) + "-comprimida." + fmt,
              blob: limpia,
              nota: "Ya estaba comprimida: queda igual (" + IM.peso(limpia.size) + ")."
            };
          });
          var ahorro = Math.round((1 - r.blob.size / f.size) * 100);
          return {
            nombre: base(f.name) + "-comprimida." + fmt,
            blob: r.blob,
            nota: "Pesaba " + IM.peso(f.size) + " · ahora " + IM.peso(r.blob.size) + (ahorro > 0 ? " (−" + ahorro + " %)" : "") + (r.ancho !== r.ancho0 ? " · " + r.ancho + " × " + r.alto + " px" : "") + "."
          };
        });
      }, {
        nombreZip: "comprimidas.zip"
      });
    }
  };
  var MEDIDAS_REDES = [ "Instagram, vertical (1080 × 1350)", "Instagram, cuadrada (1080 × 1080)", "Instagram, horizontal (1080 × 566)", "Instagram, historia (1080 × 1920)", "Facebook, portada (1640 × 624)", "YouTube, miniatura (1280 × 720)", "LinkedIn, publicación (1200 × 627)", "X, publicación (1600 × 900)" ];
  function componerRedes(img, MW, MH, aj) {
    var c2 = document.createElement("canvas");
    c2.width = MW;
    c2.height = MH;
    var g = c2.getContext("2d");
    g.imageSmoothingQuality = "high";
    var cub = Math.max(MW / img.width, MH / img.height), cab = Math.min(MW / img.width, MH / img.height);
    if (/Recortar/.test(aj)) g.drawImage(img, (MW - img.width * cub) / 2, (MH - img.height * cub) / 2, img.width * cub, img.height * cub); else {
      if (/blanco/.test(aj)) {
        g.fillStyle = "#fff";
        g.fillRect(0, 0, MW, MH);
      } else {
        var ch = document.createElement("canvas");
        ch.width = Math.max(1, Math.round(MW / 40));
        ch.height = Math.max(1, Math.round(MH / 40));
        var gh = ch.getContext("2d");
        gh.imageSmoothingQuality = "high";
        gh.drawImage(img, (ch.width - img.width * cub / 40) / 2, (ch.height - img.height * cub / 40) / 2, img.width * cub / 40, img.height * cub / 40);
        g.drawImage(ch, 0, 0, MW, MH);
        g.fillStyle = "rgba(0,0,0,.12)";
        g.fillRect(0, 0, MW, MH);
      }
      g.drawImage(img, (MW - img.width * cab) / 2, (MH - img.height * cab) / 2, img.width * cab, img.height * cab);
    }
    return c2;
  }
  function medidaRedes() {
    var m = (IM.opcion("Medida") || "").match(/(\d+) × (\d+)/);
    return m ? [ +m[1], +m[2] ] : [ 1080, 1350 ];
  }
  H["redimensionar-imagen"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo !== "Cómo") return null;
      return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + '<div class="opc-medidas" id="campo-medidas">' + campo("campo-ancho", "Ancho (px)", '<input type="number" min="1" step="1" inputmode="numeric">') + campo("campo-alto", "Alto (px)", '<input type="number" min="1" step="1" inputmode="numeric">') + '<label class="opc-check"><input type="checkbox" id="mantener" checked> Mantener la proporción</label></div>' + campo("campo-porc", "Porcentaje (%)", '<input type="number" min="1" max="1000" step="1" value="50" inputmode="numeric">', true) + campoKB("campo-kb", true) + '<div id="campo-redes" hidden>' + ui.grupo("Medida", MEDIDAS_REDES, true) + ui.grupo("Si no entra justa", [ "Recortar al centro", "Completar con la misma foto desenfocada", "Completar con blanco" ], true) + "</div>" + '<p class="opc-nota" id="nota-redim" hidden></p>';
    },
    montar: function(cont) {
      var tocado = false;
      var url = null;
      var previa = function() {
        var der = $(".visor-previa", cont), redes = /redes/.test(IM.opcion("Cómo") || "");
        if (!v || !v.img || !redes) {
          if (der) der.hidden = true;
          if (v) v.lienzo.style.visibility = "";
          return;
        }
        var m = medidaRedes(), e = Math.min(1, 900 / Math.max(m[0], m[1]));
        componerRedes(v.lienzo, Math.round(m[0] * e), Math.round(m[1] * e), IM.opcion("Si no entra justa") || "").toBlob(function(b) {
          if (!b) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(b);
          if (!der) {
            der = document.createElement("img");
            der.className = "visor-previa visor-previa-libre visor-previa-redes";
            der.alt = "";
            v.lienzo.parentNode.insertBefore(der, v.capa);
          }
          der.src = url;
          der.hidden = false;
          v.lienzo.style.visibility = "hidden";
        }, "image/jpeg", .9);
      };
      var v = new Visor(cont, {
        alCambiar: function(vv) {
          if (vv && vv.img && !tocado) {
            $("#campo-ancho input").value = vv.img.width;
            $("#campo-alto input").value = vv.img.height;
          }
          previa();
          if (estadoRd) estadoRd();
        }
      });
      IM.alCambiarOpcion(previa);
      var w = $("#campo-ancho input"), h = $("#campo-alto input"), m = $("#mantener");
      [ w, h ].forEach(function(i) {
        i.addEventListener("input", function() {
          tocado = true;
        });
      });
      document.addEventListener("im-restablecer", function() {
        if (!document.body.contains(w)) return;
        tocado = false;
        if (v.img) {
          w.value = v.img.width;
          h.value = v.img.height;
        }
        if (estadoRd) estadoRd();
      });
      var prop = function() {
        return v.img ? v.img.height / v.img.width : 1;
      };
      w.addEventListener("input", function() {
        if (m.checked && num(w.value) > 0) h.value = Math.max(1, Math.round(num(w.value) * prop()));
      });
      h.addEventListener("input", function() {
        if (m.checked && num(h.value) > 0) w.value = Math.max(1, Math.round(num(h.value) / prop()));
      });
      var act = function() {
        var c = IM.opcion("Cómo") || "";
        mostrarSi($("#campo-medidas"), /medidas/.test(c));
        mostrarSi($("#campo-porc"), /porcentaje/.test(c));
        mostrarSi($("#campo-kb"), /peso/.test(c));
        mostrarSi($("#campo-redes"), /redes/.test(c));
      };
      IM.alCambiarOpcion(act);
      act();
      var tokR = 0;
      var estadoR = function() {
        var c = IM.opcion("Cómo") || "", arch = IM.archivos(), t = ++tokR, nota = $("#nota-redim");
        var poner = function(igual, agranda) {
          if (t !== tokR) return;
          IM.botonHabilitado(!igual || !arch.length);
          if (!nota) return;
          if (agranda) nota.innerHTML = conEnlace((arch.length > 1 ? "Agrandadas así se ven más borrosas." : "Agrandada así se ve más borrosa.") + " Para agrandar con nitidez, está <a>Agrandar imagen</a>.", "/agrandar-imagen/");
          mostrarSi(nota, agranda);
        };
        if (!arch.length) {
          poner(false, false);
          return;
        }
        if (/porcentaje/.test(c)) {
          var p = num($("#campo-porc input").value);
          poner(p === 100, p > 100);
          return;
        }
        if (!/medidas/.test(c)) {
          poner(false, false);
          return;
        }
        var W = num(w.value), Hh = num(h.value);
        if (!(W > 0 && Hh > 0)) {
          poner(false, false);
          return;
        }
        Promise.all(arch.map(function(a) {
          return IMMotor.bitmap(a.file);
        })).then(function(imgs) {
          var esc0 = imgs.map(function(im) {
            return m.checked ? Math.min(W / im.width, Hh / im.height) : null;
          });
          var igual = imgs.every(function(im, k) {
            return m.checked ? Math.abs(esc0[k] - 1) < .002 : W === im.width && Hh === im.height;
          });
          var agranda = imgs.some(function(im, k) {
            return m.checked ? esc0[k] > 1.002 : W > im.width || Hh > im.height;
          });
          poner(igual, agranda);
        }, function() {
          poner(false, false);
        });
      };
      var estadoRd = debounce(estadoR, 150);
      [ w, h, $("#campo-porc input") ].forEach(function(i) {
        i.addEventListener("input", estadoRd);
      });
      m.addEventListener("change", estadoRd);
      IM.alCambiarOpcion(estadoRd);
      IM.alCambiarArchivos(estadoRd);
      setTimeout(estadoR, 300);
    },
    procesar: function() {
      var c = IM.opcion("Cómo") || "", W = num($("#campo-ancho input").value), Ht = num($("#campo-alto input").value), mant = $("#mantener").checked, p = num($("#campo-porc input").value), kb = num($("#campo-kb input").value);
      if (/medidas/.test(c) && !(W > 0 && Ht > 0)) {
        IM.aviso("Escribí el ancho y el alto en píxeles.");
        return;
      }
      if (/porcentaje/.test(c) && !(p > 0)) {
        IM.aviso("Escribí el porcentaje.");
        return;
      }
      if (/peso/.test(c) && !(kb >= 5)) {
        IM.aviso("Escribí el peso máximo en KB (5 o más).");
        return;
      }
      if (/redes/.test(c)) {
        var med = medidaRedes(), aj = IM.opcion("Si no entra justa") || "";
        var MW = med[0], MH = med[1];
        return cadaImagen("Redimensionando", function(f) {
          var fmt = formatoElegido("Formato", f);
          return IMMotor.bitmap(f).then(function(img) {
            return createImageBitmap(componerRedes(img, MW, MH, aj));
          }).then(function(b) {
            return codificar(b, [], {
              formato: fmt,
              calidad: 92
            }, [ b ]);
          }).then(function(r) {
            return {
              nombre: base(f.name) + "-" + MW + "x" + MH + "." + fmt,
              blob: r.blob,
              nota: MW + " × " + MH + " px · " + IM.peso(r.blob.size) + "."
            };
          });
        }, {
          nombreZip: "redimensionadas.zip"
        });
      }
      cadaImagen("Redimensionando", function(f) {
        var fmt = formatoElegido("Formato", f);
        return Promise.all([ IMMotor.bitmap(f), IMMotor.fuente(f) ]).then(function(r) {
          var img = r[0], src = r[1], pasos = [], salida = {
            formato: fmt,
            calidad: 90
          };
          if (/medidas/.test(c)) {
            var w = W, h = Ht;
            if (mant) {
              var e = Math.min(W / img.width, Ht / img.height);
              w = img.width * e;
              h = img.height * e;
            }
            pasos.push({
              medida: [ w, h ]
            });
          } else if (/porcentaje/.test(c)) pasos.push({
            porcentaje: p
          }); else salida = {
            formato: fmt,
            maxBytes: kb * 1024
          };
          return codificar(src, pasos, salida, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-" + r.ancho + "x" + r.alto + "." + fmt,
            blob: r.blob,
            nota: r.ancho + " × " + r.alto + " px · " + IM.peso(r.blob.size) + "."
          };
        });
      }, {
        nombreZip: "redimensionadas.zip"
      });
    }
  };
  function Recuadro(capa, op) {
    this.capa = capa;
    this.op = op;
    this.rect = op.rect || {
      x: .1,
      y: .1,
      w: .8,
      h: .8
    };
    var el = this.el = document.createElement("div");
    el.className = "recuadro" + (op.circulo ? " circulo" : "");
    el.innerHTML = '<span class="tir n o"></span><span class="tir n e"></span><span class="tir s o"></span><span class="tir s e"></span>';
    capa.appendChild(el);
    this.pintar();
    var self = this, modo = null, x0, y0, r0;
    el.addEventListener("pointerdown", function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      el.setPointerCapture(ev.pointerId);
      var t = ev.target.classList.contains("tir") ? ev.target : null;
      modo = t ? (t.classList.contains("n") ? "n" : "s") + (t.classList.contains("o") ? "o" : "e") : "mover";
      x0 = ev.clientX;
      y0 = ev.clientY;
      r0 = Object.assign({}, self.rect);
    });
    el.addEventListener("pointermove", function(ev) {
      if (!modo) return;
      var b = capa.getBoundingClientRect(), dx = (ev.clientX - x0) / b.width, dy = (ev.clientY - y0) / b.height, r = Object.assign({}, r0);
      if (modo === "mover") {
        r.x = Math.min(1 - r.w, Math.max(0, r0.x + dx));
        r.y = Math.min(1 - r.h, Math.max(0, r0.y + dy));
      } else {
        var izq = modo[1] === "o", arr = modo[0] === "n";
        var x1 = izq ? Math.max(0, Math.min(r0.x + r0.w - .02, r0.x + dx)) : r0.x, x2 = izq ? r0.x + r0.w : Math.min(1, Math.max(r0.x + .02, r0.x + r0.w + dx));
        var y1 = arr ? Math.max(0, Math.min(r0.y + r0.h - .02, r0.y + dy)) : r0.y, y2 = arr ? r0.y + r0.h : Math.min(1, Math.max(r0.y + .02, r0.y + r0.h + dy));
        r = {
          x: x1,
          y: y1,
          w: x2 - x1,
          h: y2 - y1
        };
        var asp = self.op.aspecto && self.op.aspecto();
        if (asp) {
          var k = asp * b.height / b.width;
          var ax = izq ? r0.x + r0.w : r0.x, ay = arr ? r0.y + r0.h : r0.y;
          var maxW = izq ? ax : 1 - ax, maxH = arr ? ay : 1 - ay;
          var w = Math.max(r.w, r.h * k);
          w = Math.max(.02, Math.min(w, maxW, maxH * k));
          var h = w / k;
          r = {
            x: izq ? ax - w : ax,
            y: arr ? ay - h : ay,
            w: w,
            h: h
          };
        }
      }
      self.rect = r;
      self.pintar();
      if (self.op.alMover) self.op.alMover(r);
    });
    el.addEventListener("pointerup", function() {
      modo = null;
      if (self.op.alSoltar) self.op.alSoltar(self.rect);
    });
  }
  Recuadro.prototype.pintar = function() {
    var r = this.rect, s = this.el.style;
    s.left = r.x * 100 + "%";
    s.top = r.y * 100 + "%";
    s.width = r.w * 100 + "%";
    s.height = r.h * 100 + "%";
  };
  Recuadro.prototype.quitar = function() {
    this.el.remove();
  };
  function rectMaximo(aspImg, aspRec) {
    if (!aspRec) return {
      x: 0,
      y: 0,
      w: 1,
      h: 1
    };
    var k = aspRec / aspImg, w = 1, h = w / k;
    if (h > 1) {
      h = 1;
      w = h * k;
    }
    return {
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      w: w,
      h: h
    };
  }
  function copiaRect(r) {
    return {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h
    };
  }
  function agrandarCara(r) {
    var w = r.w * 1.35, h = r.h * 1.45, x = r.x + r.w / 2 - w / 2, y = r.y + r.h * .48 - h / 2;
    x = Math.max(0, x);
    y = Math.max(0, y);
    return {
      x: x,
      y: y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y)
    };
  }
  function claveArch(f) {
    return f.name + "|" + f.size + "|" + f.lastModified;
  }
  function esPrimero(f) {
    var a = IM.archivos();
    return a.length && a[0].file === f;
  }
  function ayudaGeneral(cont, texto, si) {
    var p = $(".visor-ayuda", cont);
    if (!p) {
      p = document.createElement("p");
      p.className = "visor-ayuda";
      p.hidden = true;
      p.textContent = texto;
      $(".visor-uno", cont).appendChild(p);
    }
    mostrarSi(p, si);
  }
  var ASPECTOS = {
    "Cuadrado (1:1)": 1,
    "4:3": 4 / 3,
    "3:2": 3 / 2,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "4:5": 4 / 5,
    "Círculo": 1
  };
  H["recortar-imagen"] = {
    montar: function(cont) {
      var general = null, propios = {}, rec = null, v;
      var forma = function() {
        return IM.opcion("Forma") || "Libre";
      };
      var aspecto = function() {
        return ASPECTOS[forma()] || null;
      };
      var rectGeneral = function(W, Hh) {
        var asp = aspecto();
        if (!general || general.forma !== forma()) return rectMaximo(W / Hh, asp);
        var g = general.r;
        if (!asp) return copiaRect(g);
        var k = asp * Hh / W, w = g.w, h = w / k;
        if (h > 1) {
          h = 1;
          w = h * k;
        }
        if (w > 1) {
          w = 1;
          h = w / k;
        }
        var cx = g.x + g.w / 2, cy = g.y + g.h / 2;
        return {
          x: Math.min(1 - w, Math.max(0, cx - w / 2)),
          y: Math.min(1 - h, Math.max(0, cy - h / 2)),
          w: w,
          h: h
        };
      };
      var propio = function(f) {
        var p = propios[claveArch(f)];
        return p && p.forma === forma() ? p : null;
      };
      var rectPara = function(f, img) {
        var p = propio(f);
        return p ? p.r : rectGeneral(img.width, img.height);
      };
      var poner = function() {
        if (rec) {
          rec.quitar();
          rec = null;
        }
        ayudaGeneral(cont, "El recuadro vale para todas las imágenes. Si cambiás el de una, esa queda con el suyo.", IM.archivos().length > 1);
        if (!v || !v.img) return;
        var f = v.actual;
        rec = new Recuadro(v.capa, {
          rect: copiaRect(rectPara(f, v.img)),
          circulo: forma() === "Círculo",
          aspecto: function() {
            return aspecto();
          },
          alMover: function(r) {
            if (esPrimero(f) && !propio(f)) general = {
              forma: forma(),
              r: copiaRect(r)
            }; else propios[claveArch(f)] = {
              forma: forma(),
              r: copiaRect(r)
            };
            medidas(r);
          },
          alSoltar: function() {
            IM.pintarEtiquetas();
            v.refrescar();
          }
        });
        medidas(rec.rect);
      };
      var medidas = function(r) {
        var p = $(".visor-nota", cont);
        if (!p || !v.img) return;
        p.textContent = "Recorte: " + Math.round(r.w * v.img.width) + " × " + Math.round(r.h * v.img.height) + " px.";
      };
      v = new Visor(cont, {
        nota: " ",
        alCambiar: poner,
        grilla: function(marco, f, img) {
          var r = rectPara(f, img), d = document.createElement("span");
          d.className = "gal-recorte" + (forma() === "Círculo" ? " circulo" : "");
          d.style.left = r.x * 100 + "%";
          d.style.top = r.y * 100 + "%";
          d.style.width = r.w * 100 + "%";
          d.style.height = r.h * 100 + "%";
          marco.appendChild(d);
        }
      });
      IM.alCambiarOpcion(poner);
      document.addEventListener("im-restablecer", function() {
        general = null;
        propios = {};
        poner();
      });
      IM.etiquetas(function(a) {
        if (IM.archivos().length < 2 || !propio(a.file)) return null;
        return {
          texto: "Recorte propio",
          accion: "Volver al general",
          alTocar: function() {
            delete propios[claveArch(a.file)];
            IM.pintarEtiquetas();
            poner();
            v.refrescar();
          }
        };
      });
      this._rectPara = rectPara;
    },
    procesar: function() {
      var rectPara = this._rectPara, circ = (IM.opcion("Forma") || "") === "Círculo";
      cadaImagen("Recortando", function(f) {
        var fmt = formatoElegido("Formato", f);
        if (circ && fmt === "jpg") fmt = "png";
        return Promise.all([ IMMotor.bitmap(f), IMMotor.fuente(f) ]).then(function(r) {
          var img = r[0], q = rectPara(f, img);
          return codificar(r[1], [ {
            recorte: {
              x: q.x * img.width,
              y: q.y * img.height,
              w: q.w * img.width,
              h: q.h * img.height,
              circulo: circ
            }
          } ], {
            formato: fmt,
            calidad: 92
          }, r[1] instanceof ImageBitmap ? [ r[1] ] : []);
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-recortada." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "recortadas.zip"
      });
    }
  };
  function intensidad() {
    return {
      Suave: "suave",
      Media: "media",
      Fuerte: "fuerte"
    }[IM.opcion("Intensidad")] || "media";
  }
  function efecto() {
    return /Pixelar/.test(IM.opcion("Efecto") || "") ? "pixelar" : "desenfocar";
  }
  H["desenfocar"] = {
    montar: function(cont) {
      var general = [], propias = {}, v, tok = 0, url = null;
      var carasDe = {}, propiasC = {}, buscando = {}, estadoCaras = "";
      var mascaras = {}, buscandoM = {}, estadoFondo = "";
      var modo = function() {
        var q = IM.opcion("Qué desenfocar") || "";
        return /fondo/.test(q) ? "fondo" : /caras/.test(q) ? "caras" : "zonas";
      };
      var esFondo = function() {
        return modo() === "fondo";
      };
      var zonasPara = function(f) {
        var k = claveArch(f);
        return modo() === "caras" ? propiasC[k] || carasDe[k] || [] : propias[k] || general;
      };
      var buscarCaras = function(f) {
        if (!f || modo() !== "caras") return;
        var k = claveArch(f);
        if (carasDe[k] || buscando[k]) {
          nota();
          return;
        }
        buscando[k] = true;
        estadoCaras = "Buscando caras…";
        nota();
        IMMotor.caras(f, function(a, t) {
          estadoCaras = t && a >= t ? "Buscando caras…" : "Descargando el detector de caras: " + porc(a, t) + " %.";
          nota();
        }).then(function(l) {
          delete buscando[k];
          carasDe[k] = l.map(agrandarCara);
          estadoCaras = "";
          cambio();
        }, function(e) {
          delete buscando[k];
          estadoCaras = "";
          nota();
          IM.aviso(IM.textoError(e));
        });
      };
      var buscarFondo = function(f) {
        if (!f || !esFondo()) return;
        var k = claveArch(f);
        if (mascaras[k] || buscandoM[k]) {
          nota();
          return;
        }
        buscandoM[k] = true;
        estadoFondo = "Reconociendo el fondo…";
        nota();
        IMMotor.mascara(f, "buena", function(a, t) {
          estadoFondo = t && a >= t ? "Reconociendo el fondo…" : "Cargando el modelo de inteligencia artificial: " + porc(a, t) + " %.";
          nota();
        }).then(function(m) {
          delete buscandoM[k];
          mascaras[k] = m;
          estadoFondo = "";
          previa();
          nota();
        }, function(e) {
          delete buscandoM[k];
          estadoFondo = "";
          nota();
          IM.aviso(IM.textoError(e));
        });
      };
      var editables = function() {
        var f = v.actual, k = claveArch(f);
        if (modo() === "caras") return propiasC[k] || (propiasC[k] = (carasDe[k] || []).map(copiaRect));
        if (propias[k]) return propias[k];
        if (esPrimero(f)) return general;
        return propias[k] = general.map(copiaRect);
      };
      var cambio = function() {
        dibujarZonas();
        previa();
        nota();
        IM.pintarEtiquetas();
        v.refrescar();
      };
      var dibujarZonas = function() {
        $$(".zona-marca", v.capa).forEach(function(z) {
          z.remove();
        });
        if (esFondo() || !v.actual) return;
        zonasPara(v.actual).forEach(function(r, k) {
          var z = document.createElement("div");
          z.className = "zona-marca" + (modo() === "caras" ? " ovalo" : "");
          z.style.left = r.x * 100 + "%";
          z.style.top = r.y * 100 + "%";
          z.style.width = r.w * 100 + "%";
          z.style.height = r.h * 100 + "%";
          var x = document.createElement("button");
          x.type = "button";
          x.className = "zona-quitar";
          x.textContent = "✕";
          x.setAttribute("aria-label", "Quitar esta zona");
          x.addEventListener("pointerdown", function(e) {
            e.stopPropagation();
          });
          x.addEventListener("click", function(e) {
            e.stopPropagation();
            editables().splice(k, 1);
            cambio();
          });
          var asa = document.createElement("span");
          asa.className = "zona-asa";
          asa.setAttribute("aria-hidden", "true");
          z.appendChild(asa);
          z.addEventListener("pointerdown", function(e) {
            if (e.target === x || e.button > 0) return;
            e.stopPropagation();
            e.preventDefault();
            var b = v.capa.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, o = {
              x: r.x,
              y: r.y,
              w: r.w,
              h: r.h
            }, tam = e.target === asa, n = null;
            z.classList.add("moviendo");
            z.setPointerCapture(e.pointerId);
            vivoBase = null;
            var mover = function(ev) {
              var dx = (ev.clientX - x0) / b.width, dy = (ev.clientY - y0) / b.height;
              n = tam ? {
                x: o.x,
                y: o.y,
                w: Math.min(1 - o.x, Math.max(.015, o.w + dx)),
                h: Math.min(1 - o.y, Math.max(.015, o.h + dy))
              } : {
                x: Math.min(1 - o.w, Math.max(0, o.x + dx)),
                y: Math.min(1 - o.h, Math.max(0, o.y + dy)),
                w: o.w,
                h: o.h
              };
              z.style.left = n.x * 100 + "%";
              z.style.top = n.y * 100 + "%";
              z.style.width = n.w * 100 + "%";
              z.style.height = n.h * 100 + "%";
              enVivo(k, n);
            };
            var soltar = function() {
              z.removeEventListener("pointermove", mover);
              z.removeEventListener("pointerup", soltar);
              z.removeEventListener("pointercancel", soltar);
              z.classList.remove("moviendo");
              if (n) {
                var lista = editables();
                if (lista[k]) {
                  lista[k].x = n.x;
                  lista[k].y = n.y;
                  lista[k].w = n.w;
                  lista[k].h = n.h;
                }
                cambio();
              }
            };
            z.addEventListener("pointermove", mover);
            z.addEventListener("pointerup", soltar);
            z.addEventListener("pointercancel", soltar);
          });
          z.appendChild(x);
          v.capa.appendChild(z);
        });
      };
      var vivo = null, vivoBase = null, vivoPend = null;
      var enVivo = function(k, n) {
        var c0 = v && v.lienzo;
        if (!c0 || !c0.width) return;
        if (!vivo) {
          vivo = document.createElement("canvas");
          vivo.className = "visor-vivo";
          c0.parentNode.insertBefore(vivo, v.capa);
        }
        vivoPend = [ k, n ];
        if (vivo._raf) return;
        vivo._raf = requestAnimationFrame(function() {
          vivo._raf = 0;
          var W = c0.width, Hh = c0.height, px = efecto() === "pixelar", it = intensidad();
          if (vivo.width !== W || vivo.height !== Hh) {
            vivo.width = W;
            vivo.height = Hh;
          }
          var g = vivo.getContext("2d");
          if (!px && !vivoBase) {
            vivoBase = document.createElement("canvas");
            vivoBase.width = W;
            vivoBase.height = Hh;
            var gb = vivoBase.getContext("2d");
            gb.filter = "blur(" + ({
              suave: .006,
              media: .014,
              fuerte: .03
            }[it] || .014) * Math.max(W, Hh) / 1.7 + "px)";
            gb.drawImage(c0, 0, 0);
          }
          g.drawImage(c0, 0, 0);
          var lados = zonasPara(v.actual).map(function(r0, j) {
            var r = j === vivoPend[0] ? vivoPend[1] : r0;
            return Math.min(r.w * W, r.h * Hh);
          }).sort(function(p, q) {
            return p - q;
          });
          var bc = Math.max(3 * (v.img && v.img.width ? W / v.img.width : 1), (lados.length ? lados[lados.length >> 1] : 100) / ({
            suave: 16,
            media: 11,
            fuerte: 8
          }[it] || 11));
          zonasPara(v.actual).forEach(function(r0, j) {
            var r = j === vivoPend[0] ? vivoPend[1] : r0, x = r.x * W, y = r.y * Hh, w = r.w * W, h = r.h * Hh;
            g.save();
            g.beginPath();
            if (modo() === "caras" && px) {
              var ccx = x + w / 2, ccy = y + h / 2, mx = Math.ceil(w / 2 / bc), my = Math.ceil(h / 2 / bc);
              for (var ii = -mx; ii < mx; ii++) for (var jj = -my; jj < my; jj++) {
                var qx = (ii + .5) * bc / (w / 2), qy = (jj + .5) * bc / (h / 2);
                if (qx * qx + qy * qy <= 1) g.rect(ccx + ii * bc, ccy + jj * bc, bc, bc);
              }
            } else if (modo() === "caras") g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else g.rect(x, y, w, h);
            g.clip();
            if (!px) g.drawImage(vivoBase, 0, 0); else {
              var cx = x + w / 2, cy = y + h / 2, nx = Math.ceil(w / 2 / bc), ny = Math.ceil(h / 2 / bc), x0 = Math.max(0, cx - nx * bc), y0 = Math.max(0, cy - ny * bc), ww = Math.min(W, cx + nx * bc) - x0, hh = Math.min(Hh, cy + ny * bc) - y0;
              var cw = Math.max(1, Math.round(ww / bc)), ch = Math.max(1, Math.round(hh / bc));
              var t = document.createElement("canvas");
              t.width = cw;
              t.height = ch;
              t.getContext("2d").drawImage(c0, x0, y0, ww, hh, 0, 0, cw, ch);
              g.imageSmoothingEnabled = false;
              g.drawImage(t, 0, 0, cw, ch, x0, y0, ww, hh);
              g.imageSmoothingEnabled = true;
            }
            g.restore();
          });
          vivo.hidden = false;
        });
      };
      var previa = debounce(function() {
        var der = $(".visor-previa", cont);
        var mf = v && v.actual && esFondo() ? mascaras[claveArch(v.actual)] : null;
        if (!v || !v.img || (esFondo() ? !mf : !zonasPara(v.actual).length)) {
          if (der) der.hidden = true;
          v.lienzo.style.visibility = "";
          return;
        }
        var t = ++tok, W = v.lienzo.width, Hh = v.lienzo.height;
        v.muestra().then(function(b) {
          if (mf) return createImageBitmap(mf).then(function(m) {
            return codificar(b, [ {
              desenfoque: {
                mascara: m,
                intensidad: intensidad(),
                efecto: efecto()
              }
            } ], {
              formato: "jpg",
              calidad: 92
            }, [ b, m ]);
          });
          return codificar(b, [ {
            desenfoque: {
              zonas: zonasPara(v.actual).map(function(r) {
                return {
                  x: r.x * W,
                  y: r.y * Hh,
                  w: r.w * W,
                  h: r.h * Hh,
                  ovalo: modo() === "caras"
                };
              }),
              intensidad: intensidad(),
              efecto: efecto(),
              escala: v.img && v.img.width ? W / v.img.width : 1
            }
          } ], {
            formato: "jpg",
            calidad: 92
          }, [ b ]);
        }).then(function(r) {
          if (t !== tok) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(r.blob);
          if (!der) {
            der = document.createElement("img");
            der.className = "visor-previa";
            der.alt = "";
            v.lienzo.parentNode.insertBefore(der, v.capa);
          }
          der.src = url;
          der.hidden = false;
          if (vivo && !vivo.hidden) {
            var v0 = vivo;
            (der.decode ? der.decode() : Promise.resolve()).then(function() {
              if (t === tok) v0.hidden = true;
            }, function() {
              v0.hidden = true;
            });
          }
        }, function() {});
      }, 200);
      var nota = function() {
        var p = $(".visor-nota", cont);
        if (!p) return;
        if (modo() === "caras") {
          var n = v && v.actual ? zonasPara(v.actual).length : 0, k = v && v.actual ? claveArch(v.actual) : "";
          p.textContent = estadoCaras || (!carasDe[k] ? "" : n ? (n === 1 ? "Se encontró 1 cara." : "Se encontraron " + n + " caras.") + " Tocá ✕ para quitar una, o arrastrá el mouse para agregar otra." : "No se encontraron caras. Marcalas arrastrando el mouse.");
          return;
        }
        p.textContent = esFondo() ? estadoFondo || " " : "Marcá con el mouse las zonas que querés tapar. Tocá ✕ para quitar una.";
      };
      v = new Visor(cont, {
        nota: " ",
        prepararPrevia: function(c, f) {
          var zs = esFondo() ? [] : zonasPara(f);
          if (!zs.length) return Promise.resolve(null);
          return createImageBitmap(c).then(function(b) {
            return codificar(b, [ {
              desenfoque: {
                zonas: zs.map(function(r) {
                  return {
                    x: r.x * c.width,
                    y: r.y * c.height,
                    w: r.w * c.width,
                    h: r.h * c.height,
                    ovalo: modo() === "caras"
                  };
                }),
                intensidad: intensidad(),
                efecto: efecto()
              }
            } ], {
              formato: "jpg",
              calidad: 92
            }, [ b ]);
          }).then(function(r) {
            if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(r.blob);
            return url;
          });
        },
        alCambiar: function() {
          if (!v) return;
          dibujarZonas();
          previa();
          nota();
          buscarCaras(v.actual);
          buscarFondo(v.actual);
          ayudaGeneral(cont, "Las zonas valen para todas las imágenes. Si cambiás las de una, esa queda con las suyas.", IM.archivos().length > 1 && modo() === "zonas");
        },
        grilla: function(marco, f) {
          if (esFondo()) return;
          zonasPara(f).forEach(function(r) {
            var d = document.createElement("span");
            d.className = "gal-zona";
            d.style.left = r.x * 100 + "%";
            d.style.top = r.y * 100 + "%";
            d.style.width = r.w * 100 + "%";
            d.style.height = r.h * 100 + "%";
            marco.appendChild(d);
          });
        }
      });
      IM.etiquetas(function(a) {
        if (IM.archivos().length < 2 || modo() !== "zonas" || !propias[claveArch(a.file)]) return null;
        return {
          texto: "Zonas propias",
          accion: "Volver al general",
          alTocar: function() {
            delete propias[claveArch(a.file)];
            cambio();
          }
        };
      });
      document.addEventListener("im-restablecer", function() {
        general = [];
        propias = {};
        propiasC = {};
        cambio();
      });
      var ini = null, marca = null;
      v.capa.addEventListener("pointerdown", function(e) {
        if (esFondo() || !v.img || e.target.closest(".zona-marca")) return;
        var b = v.capa.getBoundingClientRect();
        ini = [ (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height ];
        marca = document.createElement("div");
        marca.className = "zona-marca dibujando";
        v.capa.appendChild(marca);
        v.capa.setPointerCapture(e.pointerId);
      });
      v.capa.addEventListener("pointermove", function(e) {
        if (!ini) return;
        var b = v.capa.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
        var r = {
          x: Math.min(x, ini[0]),
          y: Math.min(y, ini[1]),
          w: Math.abs(x - ini[0]),
          h: Math.abs(y - ini[1])
        };
        marca.style.left = r.x * 100 + "%";
        marca.style.top = r.y * 100 + "%";
        marca.style.width = r.w * 100 + "%";
        marca.style.height = r.h * 100 + "%";
        marca._r = r;
      });
      v.capa.addEventListener("pointerup", function() {
        if (!ini) return;
        ini = null;
        var r = marca._r;
        marca.remove();
        marca = null;
        if (r && r.w > .01 && r.h > .01) {
          editables().push(r);
          cambio();
        }
      });
      var boton = function() {
        IM.botonTexto(efecto() === "pixelar" ? "Pixelar" : "Desenfocar");
      };
      boton();
      IM.alCambiarOpcion(function() {
        boton();
        dibujarZonas();
        previa();
        nota();
        v.capa.classList.toggle("marcable", !esFondo());
        IM.pintarEtiquetas();
        if (v.actual) {
          buscarCaras(v.actual);
          buscarFondo(v.actual);
        }
        ayudaGeneral(cont, "Las zonas valen para todas las imágenes. Si cambiás las de una, esa queda con las suyas.", IM.archivos().length > 1 && modo() === "zonas");
      });
      v.capa.classList.toggle("marcable", !esFondo());
      this._zonasPara = zonasPara;
      this._carasDe = carasDe;
      this._propiasC = propiasC;
      this._mascaras = mascaras;
    },
    procesar: function() {
      var zonasPara = this._zonasPara, carasDe = this._carasDe, propiasC = this._propiasC, mascaras = this._mascaras, fondo = /fondo/.test(IM.opcion("Qué desenfocar") || ""), conCaras = /caras/.test(IM.opcion("Qué desenfocar") || ""), it = intensidad(), ef = efecto();
      if (!fondo && !conCaras && !IM.archivos().some(function(a) {
        return zonasPara(a.file).length;
      })) {
        IM.aviso("Marcá en la imagen las zonas que querés desenfocar.");
        return;
      }
      var hechas = 0, sinCaras = [];
      if (conCaras) {
        var px = ef === "pixelar";
        return cadaImagen(px ? "Pixelando las caras" : "Desenfocando las caras", function(f, i, av) {
          var k = claveArch(f), fmt = formatoElegido("Formato", f);
          var zonasListas = propiasC[k] || carasDe[k] ? Promise.resolve(zonasPara(f)) : (av("Buscando caras…"), 
          IMMotor.caras(f, avanceModelo(av)).then(function(l) {
            carasDe[k] = l.map(agrandarCara);
            return carasDe[k];
          }));
          return zonasListas.then(function(zs) {
            if (!zs.length) {
              sinCaras.push(f.name);
              return null;
            }
            hechas++;
            return Promise.all([ IMMotor.bitmap(f), IMMotor.fuente(f) ]).then(function(r) {
              var img = r[0], src = r[1];
              return codificar(src, [ {
                desenfoque: {
                  zonas: zs.map(function(q) {
                    return {
                      x: q.x * img.width,
                      y: q.y * img.height,
                      w: q.w * img.width,
                      h: q.h * img.height,
                      ovalo: true
                    };
                  }),
                  intensidad: it,
                  efecto: ef
                }
              } ], {
                formato: fmt,
                calidad: 90
              }, src instanceof ImageBitmap ? [ src ] : []);
            }).then(function(r) {
              return {
                nombre: base(f.name) + (ef === "pixelar" ? "-caras-pixeladas." : "-caras-desenfocadas.") + fmt,
                blob: r.blob
              };
            });
          });
        }, {
          nombreZip: px ? "caras-pixeladas.zip" : "caras-desenfocadas.zip"
        }).then(function(prep) {
          if (!prep) return;
          if (!hechas) IM.aviso("No se encontraron caras. Marcalas arrastrando el mouse sobre la imagen."); else if (sinCaras.length) IM.aviso("No se encontraron caras en " + (sinCaras.length > 1 ? sinCaras.slice(0, -1).join(", ") + " y " + sinCaras[sinCaras.length - 1] : sinCaras[0]) + ".");
        });
      }
      cadaImagen(ef === "pixelar" ? fondo ? "Pixelando el fondo" : "Pixelando" : fondo ? "Desenfocando el fondo" : "Desenfocando", function(f, i, av) {
        var fmt = formatoElegido("Formato", f);
        return Promise.all([ IMMotor.bitmap(f), IMMotor.fuente(f) ]).then(function(r) {
          var img = r[0], src = r[1];
          var mc = mascaras[claveArch(f)];
          if (fondo) return (mc ? createImageBitmap(mc) : IMMotor.mascara(f, "buena", avanceModelo(av))).then(function(m) {
            av(ef === "pixelar" ? "Pixelando…" : "Desenfocando…");
            return codificar(src, [ {
              desenfoque: {
                mascara: m,
                intensidad: it,
                efecto: ef
              }
            } ], {
              formato: fmt,
              calidad: 90
            }, [ m ].concat(src instanceof ImageBitmap ? [ src ] : []));
          });
          var zs = zonasPara(f).map(function(q) {
            return {
              x: q.x * img.width,
              y: q.y * img.height,
              w: q.w * img.width,
              h: q.h * img.height
            };
          });
          if (!zs.length) return null;
          return codificar(src, [ {
            desenfoque: {
              zonas: zs,
              intensidad: it,
              efecto: ef
            }
          } ], {
            formato: fmt,
            calidad: 90
          }, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          return r ? {
            nombre: base(f.name) + (ef === "pixelar" ? fondo ? "-fondo-pixelado." : "-pixelada." : fondo ? "-fondo-desenfocado." : "-desenfocada.") + fmt,
            blob: r.blob
          } : null;
        });
      }, {
        nombreZip: "desenfocadas.zip"
      });
    }
  };
  function giro() {
    var g = IM.opcion("Girar") || "";
    return /derecha/.test(g) ? 90 : /izquierda/.test(g) ? 270 : /180/.test(g) ? 180 : 0;
  }
  function vuelta() {
    var v = IM.opcion("Voltear") || "";
    return /horizontal/i.test(v) ? "h" : /vertical/i.test(v) ? "v" : null;
  }
  H["girar-y-voltear"] = {
    montar: function(cont) {
      var v;
      var act = function() {
        if (!v || !v.img) return;
        var g = giro(), f = vuelta(), m = v.lienzo.parentNode;
        m.style.transform = "rotate(" + g + "deg)" + (f === "h" ? " scaleX(-1)" : f === "v" ? " scaleY(-1)" : "");
        var cruz = g === 90 || g === 270;
        m.classList.toggle("girado", cruz);
        if (cruz) {
          var e = Math.min(1, v.lienzo.width / v.lienzo.height);
          m.style.scale = String(e);
        } else m.style.scale = "";
        var sobra = cruz ? (m.clientHeight - m.clientWidth * Math.min(1, v.lienzo.width / v.lienzo.height)) / 2 : 0;
        m.style.marginTop = m.style.marginBottom = sobra ? -sobra + "px" : "";
      };
      v = new Visor(cont, {
        alCambiar: act,
        grilla: function(marco, f, img, c) {
          var g = giro(), fl = vuelta(), cruz = g === 90 || g === 270;
          c.style.transform = "rotate(" + g + "deg)" + (fl === "h" ? " scaleX(-1)" : fl === "v" ? " scaleY(-1)" : "");
          if (cruz) {
            var fw = 4, fh = 3, k = Math.min(fw / c.width, fh / c.height), dw = c.width * k, dh = c.height * k;
            c.style.scale = String(Math.min(fw / dh, fh / dw));
            marco.style.overflow = "visible";
          }
        }
      });
      IM.alCambiarOpcion(act);
    },
    procesar: function() {
      var g = giro(), f0 = vuelta();
      if (!g && !f0) {
        IM.aviso("Elegí cómo girar o voltear las imágenes.");
        return;
      }
      cadaImagen("Girando", function(f) {
        var fmt = formatoElegido("Formato", f);
        return IMMotor.fuente(f).then(function(src) {
          return codificar(src, [ {
            girar: g,
            voltear: f0
          } ], {
            formato: fmt,
            calidad: 92
          }, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-girada." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "giradas.zip"
      });
    }
  };
  function filtroActual() {
    var r = function(id) {
      var e = $("#" + id + " input");
      return e ? num(e.value) : 0;
    };
    return {
      nombre: (IM.opcion("Filtro") || "Ninguno").toLowerCase(),
      brillo: r("campo-brillo"),
      contraste: r("campo-contraste"),
      saturacion: r("campo-saturacion")
    };
  }
  H["blanco-y-negro-y-filtros"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo !== "Filtro") return null;
      var desl = function(id, rot) {
        return campo(id, rot, '<input type="range" min="-50" max="50" step="1" value="0"><output>0</output>');
      };
      return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + '<div class="opc-ajustes">' + desl("campo-brillo", "Brillo") + desl("campo-contraste", "Contraste") + desl("campo-saturacion", "Saturación") + "</div>" + '<p class="opc-nota" id="nota-filtro" hidden></p>';
    },
    montar: function(cont) {
      var v, tok = 0, url = null;
      var previa = debounce(function() {
        if (!v || !v.img) return;
        var t = ++tok;
        v.muestra().then(function(b) {
          return codificar(b, [ {
            filtro: filtroActual()
          } ], {
            formato: "jpg",
            calidad: 92
          }, [ b ]);
        }).then(function(r) {
          if (t !== tok) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(r.blob);
          var der = $(".visor-previa", cont);
          if (!der) {
            der = document.createElement("img");
            der.className = "visor-previa";
            der.alt = "";
            v.lienzo.parentNode.insertBefore(der, v.capa);
          }
          der.src = url;
        }, function() {});
      }, 120);
      v = new Visor(cont, {
        lado: 800,
        alCambiar: previa,
        prepararPrevia: function(c) {
          return createImageBitmap(c).then(function(b) {
            return codificar(b, [ {
              filtro: filtroActual()
            } ], {
              formato: "jpg",
              calidad: 92
            }, [ b ]);
          }).then(function(r) {
            if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(r.blob);
            return url;
          });
        },
        grilla: function(marco, f, img, c) {
          createImageBitmap(c).then(function(b) {
            return codificar(b, [ {
              filtro: filtroActual()
            } ], {
              formato: "jpg",
              calidad: 92
            }, [ b ]);
          }).then(function(r) {
            var im = document.createElement("img");
            im.alt = "";
            im.src = URL.createObjectURL(r.blob);
            im.onload = function() {
              setTimeout(function() {
                URL.revokeObjectURL(im.src);
              }, 1e3);
            };
            if (c.parentNode) c.replaceWith(im);
          }, function() {});
        }
      });
      var estadoF = function() {
        var fl = filtroActual(), nada = fl.nombre === "ninguno" && !fl.brillo && !fl.contraste && !fl.saturacion, nota = $("#nota-filtro");
        IM.botonHabilitado(!nada || !IM.archivos().length);
        if (nota) {
          if (nada) nota.innerHTML = conEnlace("Sin filtro ni ajustes, no cambia nada. Para cambiar el formato, está <a>Convertir imagen</a>.", "/convertir-imagen/");
          mostrarSi(nota, nada);
        }
      };
      IM.alCambiarOpcion(function() {
        previa();
        estadoF();
      });
      IM.alCambiarArchivos(estadoF);
      estadoF();
      $$(".opc-ajustes input").forEach(function(i) {
        i.addEventListener("input", function() {
          i.nextElementSibling.textContent = i.value;
          previa();
          v.refrescar();
          estadoF();
        });
      });
    },
    procesar: function() {
      var fl = filtroActual();
      cadaImagen("Aplicando el filtro", function(f) {
        var fmt = formatoElegido("Formato", f);
        return IMMotor.fuente(f).then(function(src) {
          return codificar(src, [ {
            filtro: fl
          } ], {
            formato: fmt,
            calidad: 90
          }, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-" + fl.nombre.replace(/\s+/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, "") + "." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "con-filtro.zip"
      });
    }
  };
  function dibujoActual() {
    return {
      estilo: (IM.opcion("Estilo") || "lápiz").toLowerCase(),
      trazo: (IM.opcion("Trazo") || "medio").toLowerCase()
    };
  }
  H["foto-a-dibujo"] = {
    montar: function(cont) {
      var v, tok = 0, url = null;
      var hacer = function(b) {
        return codificar(b, [ {
          dibujo: dibujoActual()
        } ], {
          formato: "jpg",
          calidad: 92
        }, [ b ]);
      };
      var previa = debounce(function() {
        if (!v || !v.img) return;
        var t = ++tok;
        v.muestra().then(hacer).then(function(r) {
          if (t !== tok) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(r.blob);
          var der = $(".visor-previa", cont);
          if (!der) {
            der = document.createElement("img");
            der.className = "visor-previa";
            der.alt = "";
            v.lienzo.parentNode.insertBefore(der, v.capa);
          }
          der.src = url;
        }, function() {});
      }, 120);
      v = new Visor(cont, {
        lado: 800,
        alCambiar: previa,
        prepararPrevia: function(c) {
          return createImageBitmap(c).then(hacer).then(function(r) {
            if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(r.blob);
            return url;
          });
        },
        grilla: function(marco, f, img, c) {
          createImageBitmap(c).then(hacer).then(function(r) {
            var im = document.createElement("img");
            im.alt = "";
            im.src = URL.createObjectURL(r.blob);
            im.onload = function() {
              setTimeout(function() {
                URL.revokeObjectURL(im.src);
              }, 1e3);
            };
            if (c.parentNode) c.replaceWith(im);
          }, function() {});
        }
      });
      IM.alCambiarOpcion(function() {
        previa();
        v.refrescar();
      });
    },
    procesar: function() {
      var dj = dibujoActual();
      cadaImagen("Convirtiendo en dibujo", function(f) {
        var fmt = formatoElegido("Formato", f);
        return IMMotor.fuente(f).then(function(src) {
          return codificar(src, [ {
            dibujo: dj
          } ], {
            formato: fmt,
            calidad: 90
          }, src instanceof ImageBitmap ? [ src ] : []);
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-dibujo." + fmt,
            blob: r.blob
          };
        });
      }, {
        nombreZip: "dibujos.zip"
      });
    }
  };
  function opcionesCollage(escala) {
    var prop = IM.opcion("Proporción") || "", L = 2400 * (escala || 1);
    var med = /4:5/.test(prop) ? [ L * .8, L ] : /16:9/.test(prop) ? [ L, L * 9 / 16 ] : /9:16/.test(prop) ? [ L * 9 / 16, L ] : [ L, L ];
    var auto = /según las fotos/i.test(prop);
    var s = IM.opcion("Separación") || "", fondo = IM.opcion("Fondo") || "";
    var sep = /Ancha/.test(s) ? .025 : /Sin/.test(s) ? 0 : .008;
    var fmt = (IM.opcion("Formato") || "JPG").toLowerCase();
    var dis = (IM.opcion("Diseño") || "Cuadrícula").toLowerCase(), disM = /al lado/.test(dis) ? "en fila" : /debajo/.test(dis) ? "en columna" : dis;
    return {
      auto: auto,
      medida: [ Math.round(med[0]), Math.round(med[1]) ],
      separacion: Math.round(Math.min(med[0], med[1]) * sep),
      diseno: disM,
      fondo: colorFondo() || "transparente",
      formato: fmt === "jpg" ? "jpg" : fmt
    };
  }
  function previaConjunto(cont, armar) {
    var tok = 0, url = null, caja = document.createElement("div");
    caja.className = "conjunto-previa";
    caja.hidden = true;
    cont.appendChild(caja);
    caja.innerHTML = '<p class="res-rotulo visor-rotulo">Vista previa' + BOTON_REST + '</p><div class="conjunto-img"></div>';
    var cimg = caja.querySelector(".conjunto-img");
    var hacer = debounce(function() {
      var arch = IM.archivos();
      if (arch.length < 2) {
        tok++;
        if (!caja.hidden) IM.ocultarSuave(caja);
        return;
      }
      var t = ++tok;
      Promise.all(arch.map(function(a) {
        return IMMotor.bitmap(a.file).then(function(b) {
          var e = Math.min(1, 480 / Math.max(b.width, b.height));
          return createImageBitmap(b, {
            resizeWidth: Math.max(1, Math.round(b.width * e)),
            resizeHeight: Math.max(1, Math.round(b.height * e)),
            resizeQuality: "high"
          });
        });
      })).then(function(bs) {
        return armar(bs);
      }).then(function(r) {
        if (t !== tok) return;
        var viejo = url;
        url = URL.createObjectURL(r.blob);
        var im = new Image;
        im.alt = "Vista previa";
        im.src = url;
        (im.decode ? im.decode().catch(function() {}) : Promise.resolve()).then(function() {
          if (t !== tok) return;
          var poner = function() {
            cimg.innerHTML = "";
            cimg.appendChild(im);
            if (viejo) URL.revokeObjectURL(viejo);
          };
          if (caja.hidden || caja.dataset.saliendoAlto) {
            poner();
            caja.hidden = true;
            delete caja.dataset.saliendoAlto;
            IM.mostrarSuave(caja);
          } else IM.altoSuave(caja, poner);
        });
      }, function(e) {
        IM.aviso(IM.textoError(e));
      });
    }, 250);
    IM.alCambiarArchivos(hacer);
    IM.alCambiarOpcion(hacer);
    hacer();
    return hacer;
  }
  H["collage"] = {
    opcion: opcionColor,
    montar: function(cont) {
      var act = function() {
        fondoManda();
        mostrarSi($("#campo-color"), /elección/.test(IM.opcion("Fondo") || ""));
      };
      IM.alCambiarOpcion(act);
      act();
      var rehacer = previaConjunto(cont, function(bs) {
        var o = opcionesCollage(.25);
        o.formato = "png";
        return IMMotor.trabajar({
          op: "collage",
          fuentes: bs,
          o: o
        }, null, bs);
      });
      var ci = $("#campo-color input");
      if (ci) ci.addEventListener("input", debounce(function() {
        rehacer();
      }, 120));
    },
    procesar: function() {
      var o = opcionesCollage(1), arch = IM.archivos();
      IM.procesar({
        textoInicial: "Armando el collage…",
        alCancelar: function() {
          IMMotor.cancelar();
        },
        preparar: function() {
          return Promise.all(arch.map(function(a) {
            return IMMotor.fuente(a.file);
          })).then(function(fs) {
            return IMMotor.trabajar({
              op: "collage",
              fuentes: fs,
              o: o
            }, null, fs.filter(function(x) {
              return x instanceof ImageBitmap;
            }));
          }).then(function(r) {
            return {
              listos: [ {
                nombre: "collage." + o.formato,
                blob: r.blob
              } ]
            };
          });
        }
      });
    }
  };
  function opcionesGif(lado) {
    var vel = IM.opcion("Velocidad") || "", tam = IM.opcion("Tamaño") || "";
    return {
      demora: /Rápida/.test(vel) ? 200 : /Lenta/.test(vel) ? 1e3 : 500,
      lado: lado || (/Grande/.test(tam) ? 800 : /Chico/.test(tam) ? 320 : 480),
      repetir: !/una sola/i.test(IM.opcion("Repetir") || "")
    };
  }
  H["crear-gif"] = {
    montar: function(cont) {
      previaConjunto(cont, function(bs) {
        return IMMotor.trabajar({
          op: "gif",
          fuentes: bs,
          o: opcionesGif(300)
        }, null, bs);
      });
    },
    procesar: function() {
      var o = opcionesGif(), arch = IM.archivos();
      IM.procesar({
        textoInicial: "Creando el GIF…",
        alCancelar: function() {
          IMMotor.cancelar();
        },
        preparar: function(av) {
          return Promise.all(arch.map(function(a) {
            return IMMotor.fuente(a.file);
          })).then(function(fs) {
            return IMMotor.trabajar({
              op: "gif",
              fuentes: fs,
              o: o
            }, function(h, t) {
              av("Creando el GIF… Imagen " + h + " de " + t + ".");
            }, fs.filter(function(x) {
              return x instanceof ImageBitmap;
            }));
          }).then(function(r) {
            return {
              listos: [ {
                nombre: "animacion.gif",
                blob: r.blob
              } ]
            };
          });
        }
      });
    }
  };
  var DOCS = [ {
    n: "Estados Unidos: pasaporte y visa (51 × 51 mm)",
    w: 51,
    h: 51,
    cab: [ 25, 35 ]
  }, {
    n: "Canadá: pasaporte (50 × 70 mm)",
    w: 50,
    h: 70,
    cab: [ 31, 36 ]
  }, {
    n: "Reino Unido: pasaporte (35 × 45 mm)",
    w: 35,
    h: 45,
    cab: [ 29, 34 ],
    fondo: "Gris claro"
  }, {
    n: "China: visa (33 × 48 mm)",
    w: 33,
    h: 48,
    cab: [ 28, 33 ]
  }, {
    n: "Medida común de 35 × 45 mm",
    w: 35,
    h: 45,
    cab: [ 29, 34 ]
  }, {
    n: "30 × 40 mm",
    w: 30,
    h: 40
  }, {
    n: "40 × 50 mm",
    w: 40,
    h: 50
  }, {
    n: "50 × 50 mm",
    w: 50,
    h: 50
  }, {
    n: "Medida personalizada",
    w: 35,
    h: 45,
    propia: true
  } ];
  var MM = 300 / 25.4;
  var FONDOS = {
    Blanco: "#ffffff",
    "Gris claro": "#e9e9e9",
    Celeste: "#cfe3f4",
    Azul: "#3f7cc4",
    Rojo: "#c8232c"
  };
  function colorCarnet() {
    var v = IM.opcion("Fondo") || "Blanco";
    if (/original/i.test(v)) return null;
    if (FONDOS[v]) return FONDOS[v];
    var c = $("#campo-color input");
    return c ? c.value : "#ffffff";
  }
  function docActual() {
    var n = IM.opcion("País y documento"), d = DOCS.filter(function(x) {
      return x.n === n;
    })[0] || DOCS[0];
    if (d.propia) {
      var w = num($("#campo-mm-ancho input").value), h = num($("#campo-mm-alto input").value);
      return {
        n: d.n,
        w: w > 5 ? w : 35,
        h: h > 5 ? h : 45
      };
    }
    return d;
  }
  function jpeg300(blob) {
    return blob.arrayBuffer().then(function(buf) {
      var b = new Uint8Array(buf);
      if (b[2] === 255 && b[3] === 224 && b[6] === 74 && b[7] === 70) {
        b[13] = 1;
        b[14] = 1;
        b[15] = 44;
        b[16] = 1;
        b[17] = 44;
      }
      return new Blob([ b ], {
        type: "image/jpeg"
      });
    });
  }
  H["foto-carnet-y-pasaporte"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo === "Fondo") return opcionColor(rotulo, valor, ui);
      if (rotulo === "País y documento") return ui.grupo(rotulo, DOCS.map(function(d) {
        return d.n;
      }), true) + '<div class="opc-medidas" id="campo-mm" hidden>' + campo("campo-mm-ancho", "Ancho (mm)", '<input type="number" min="10" max="200" step="1" value="35">') + campo("campo-mm-alto", "Alto (mm)", '<input type="number" min="10" max="200" step="1" value="45">') + "</div>";
      return null;
    },
    montar: function(cont) {
      var self = this, estados = {}, img = null, actual = null, tok = 0;
      cont.innerHTML = '<div class="carnet" hidden><p class="res-rotulo visor-rotulo">Vista previa' + BOTON_REST + '</p><div class="visor-ver carnet-ver"></div><div class="carnet-marco"><canvas></canvas><svg class="carnet-guia" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="45" rx="22" ry="30"/></svg></div>' + '<div class="carnet-control"><label>Tamaño de la cara <input type="range" min="0.2" max="4" step="0.01" value="1" id="carnet-zoom"></label><button type="button" class="boton-borde" id="carnet-centrar">Centrar</button></div>' + '<p class="visor-nota">Arrastrá la foto para que tu cara quede dentro de la guía, de la barbilla a lo alto de la cabeza.</p></div>';
      var caja = $(".carnet", cont), marco = $(".carnet-marco", cont), cv = $("canvas", cont), guia = $(".carnet-guia ellipse", cont), zoom = $("#carnet-zoom", cont), barra = $(".carnet-ver", cont);
      IM.usarEleccion();
      var st = function() {
        return actual && estados[claveArch(actual)];
      };
      var dibujar = function() {
        var d = docActual(), alto = 420, ancho = Math.round(alto * d.w / d.h), s = st();
        cv.width = ancho * 2;
        cv.height = alto * 2;
        marco.style.width = ancho + "px";
        marco.style.height = alto + "px";
        var g = cv.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, cv.width, cv.height);
        if (img && s) {
          limitarCarnet(s, img.width, img.height, d);
          var base0 = Math.max(cv.width / img.width, cv.height / img.height), e = base0 * s.esc;
          g.drawImage(img, cv.width / 2 - img.width * e / 2 + s.dx * cv.width, cv.height / 2 - img.height * e / 2 + s.dy * cv.height, img.width * e, img.height * e);
          zoom.value = s.esc;
        }
        var gu = guiaCarnet(d);
        guia.setAttribute("ry", gu.ry);
        guia.setAttribute("rx", gu.rx);
        guia.setAttribute("cy", gu.cy);
      };
      var pintarBarra = function() {
        var n = IM.archivos().length, nueva = n > 1 ? IM.htmlBarraVer("", n, 1, IM.elegido()).replace(/<span class="ver-n"><span>Ver:<\/span>.*?<\/span>/, "") : "";
        if (barra.innerHTML === nueva) return;
        if (caja.hidden || caja.dataset.saliendoAlto) barra.innerHTML = nueva; else IM.altoSuave(barra, function() {
          barra.innerHTML = nueva;
        });
      };
      barra.addEventListener("click", function(e) {
        var l = e.target.closest("[data-lote]");
        if (!l) return;
        IM.elegirIndice(Math.max(0, Math.min(IM.archivos().length - 1, IM.elegido() + +l.dataset.lote)));
      });
      var cargar = function() {
        var arch = IM.archivos(), a = arch[IM.elegido()];
        if (!a) {
          if (!caja.hidden) IM.ocultarSuave(caja);
          img = null;
          actual = null;
          return;
        }
        pintarBarra();
        var f = a.file, t0 = ++tok;
        if (f === actual && img) return;
        Promise.all([ IMMotor.bitmap(f), encuadreCarnet(f, estados) ]).then(function(r) {
          if (t0 !== tok) return;
          img = r[0];
          actual = f;
          if (caja.hidden) {
            dibujar();
            IM.mostrarSuave(caja);
          } else IM.altoSuave(caja, dibujar);
        }, function(e) {
          IM.aviso(IM.textoError(e));
        });
      };
      var tocar = function() {
        var s = st();
        if (s) s.auto = false;
        return s;
      };
      var arr = null;
      marco.addEventListener("pointerdown", function(e) {
        var s = tocar();
        if (!s) return;
        arr = [ e.clientX, e.clientY, s.dx, s.dy ];
        marco.setPointerCapture(e.pointerId);
      });
      marco.addEventListener("pointermove", function(e) {
        var s = st();
        if (!arr || !s) return;
        s.dx = arr[2] + (e.clientX - arr[0]) / marco.clientWidth;
        s.dy = arr[3] + (e.clientY - arr[1]) / marco.clientHeight;
        dibujar();
      });
      marco.addEventListener("pointerup", function() {
        arr = null;
      });
      marco.addEventListener("wheel", function(e) {
        e.preventDefault();
        var s = tocar();
        if (!s) return;
        s.esc = Math.min(4, Math.max(.2, s.esc * (e.deltaY < 0 ? 1.04 : .96)));
        dibujar();
      }, {
        passive: false
      });
      zoom.addEventListener("input", function() {
        var s = tocar();
        if (!s) return;
        s.esc = num(zoom.value);
        dibujar();
      });
      $("#carnet-centrar", cont).addEventListener("click", function() {
        var s = tocar();
        if (!s) return;
        s.dx = 0;
        s.dy = 0;
        dibujar();
      });
      document.addEventListener("im-restablecer", function() {
        Object.keys(estados).forEach(function(k) {
          autoCarnet(estados[k], docActual());
        });
        dibujar();
      });
      IM.alCambiarArchivos(cargar);
      IM.alElegirArchivo(cargar);
      var docAntes = IM.opcion("País y documento");
      IM.alCambiarOpcion(function() {
        var n = IM.opcion("País y documento");
        if (n !== docAntes) {
          docAntes = n;
          var d0 = DOCS.filter(function(x) {
            return x.n === n;
          })[0];
          IM.ponerOpcion("Fondo", d0 && d0.fondo || "Blanco");
        }
        mostrarSi($("#campo-mm"), /personalizada/.test(n || ""));
        mostrarSi($("#campo-color"), /color a elección/.test(IM.opcion("Fondo") || ""));
        Object.keys(estados).forEach(function(k) {
          if (estados[k].auto) autoCarnet(estados[k], docActual());
        });
        dibujar();
      });
      $$("#campo-mm input").forEach(function(i) {
        i.addEventListener("input", function() {
          Object.keys(estados).forEach(function(k) {
            if (estados[k].auto) autoCarnet(estados[k], docActual());
          });
          dibujar();
        });
      });
      this._estados = estados;
      cargar();
    },
    procesar: function() {
      var estados = this._estados || {}, d = docActual(), color = colorCarnet(), hoja = IM.opcion("Para imprimir") || "";
      cadaImagen("Preparando la foto", function(f, i, av) {
        var W = Math.round(d.w * MM), Hh = Math.round(d.h * MM), st;
        return encuadreCarnet(f, estados).then(function(s) {
          st = Object.assign({}, s);
          return !color ? IMMotor.bitmap(f) : IMMotor.quitarFondo(f, "buena", avanceModelo(av)).then(function(b) {
            return createImageBitmap(b);
          });
        }).then(function(img) {
          av("Armando la foto…");
          limitarCarnet(st, img.width, img.height, d);
          var c = document.createElement("canvas");
          c.width = W;
          c.height = Hh;
          var g = c.getContext("2d");
          g.fillStyle = color || "#ffffff";
          g.fillRect(0, 0, W, Hh);
          var base0 = Math.max(W / img.width, Hh / img.height), e = base0 * st.esc;
          g.imageSmoothingQuality = "high";
          g.drawImage(img, W / 2 - img.width * e / 2 + st.dx * W, Hh / 2 - img.height * e / 2 + st.dy * Hh, img.width * e, img.height * e);
          var final = c;
          if (!/solo/i.test(hoja)) {
            var a4 = /A4/.test(hoja), HW = Math.round((a4 ? 210 : 100) * MM), HH = Math.round((a4 ? 297 : 150) * MM), sep = Math.round(3 * MM), mar = Math.round((a4 ? 8 : 3) * MM);
            var entran = function(aw, ah) {
              return [ Math.max(1, Math.floor((aw - 2 * mar + sep) / (W + sep))), Math.max(1, Math.floor((ah - 2 * mar + sep) / (Hh + sep))) ];
            };
            var vert = entran(HW, HH), horiz = entran(HH, HW);
            if (horiz[0] * horiz[1] > vert[0] * vert[1]) {
              var tmp = HW;
              HW = HH;
              HH = tmp;
              vert = horiz;
            }
            var cols = vert[0], filas = vert[1];
            final = document.createElement("canvas");
            final.width = HW;
            final.height = HH;
            var h2 = final.getContext("2d");
            h2.fillStyle = "#fff";
            h2.fillRect(0, 0, HW, HH);
            var x0 = Math.round((HW - (cols * W + (cols - 1) * sep)) / 2), y0 = Math.round((HH - (filas * Hh + (filas - 1) * sep)) / 2);
            h2.strokeStyle = "#c8c8c8";
            h2.lineWidth = 2;
            for (var fi = 0; fi < filas; fi++) for (var co = 0; co < cols; co++) {
              var x = x0 + co * (W + sep), y = y0 + fi * (Hh + sep);
              h2.drawImage(c, x, y);
              h2.strokeRect(x - 1, y - 1, W + 2, Hh + 2);
            }
          }
          return createImageBitmap(final);
        }).then(function(b) {
          return codificar(b, [], {
            formato: "jpg",
            calidad: 95
          }, [ b ]);
        }).then(function(r) {
          return jpeg300(r.blob);
        }).then(function(j) {
          return {
            nombre: base(f.name) + "-carnet-" + d.w + "x" + d.h + "mm.jpg",
            blob: j,
            nota: d.w + " × " + d.h + " mm a 300 ppp."
          };
        });
      }, {
        nombreZip: "fotos-carnet.zip"
      });
    }
  };
  function guiaCarnet(d) {
    var cab = d.cab ? (d.cab[0] + d.cab[1]) / 2 / d.h : .62, ry = cab * 50, rx = ry * .74 * d.h / d.w;
    return {
      cab: cab,
      ry: ry,
      rx: rx,
      cy: Math.max(ry + 4, 50 - (d.h > d.w ? 4 : 2))
    };
  }
  function limitarCarnet(s, iw, ih, d) {
    var R = d.w / d.h, e = Math.max(R / iw, 1 / ih) * s.esc;
    var lx = Math.abs(iw * e - R) / 2 / R, ly = Math.abs(ih * e - 1) / 2;
    s.dx = Math.max(-lx, Math.min(lx, s.dx));
    s.dy = Math.max(-ly, Math.min(ly, s.dy));
  }
  function autoCarnet(s, d) {
    s.auto = true;
    s.esc = 1;
    s.dx = 0;
    s.dy = 0;
    var c = s.cara;
    if (!c) {
      limitarCarnet(s, s.iw, s.ih, d);
      return s;
    }
    var gu = guiaCarnet(d), R = d.w / d.h, base0 = Math.max(R / s.iw, 1 / s.ih);
    var cabH = c.h * 1.25, ucx = c.x + c.w / 2, ucy = c.y + c.h * 1.04 - cabH / 2;
    s.esc = Math.min(4, Math.max(.2, gu.cab / (cabH * s.ih * base0)));
    var e = base0 * s.esc;
    s.dx = -(ucx - .5) * s.iw * e / R;
    s.dy = gu.cy / 100 - .5 - (ucy - .5) * s.ih * e;
    limitarCarnet(s, s.iw, s.ih, d);
    return s;
  }
  function encuadreCarnet(f, estados) {
    var k = claveArch(f);
    if (estados[k]) return Promise.resolve(estados[k]);
    return IMMotor.bitmap(f).then(function(img) {
      var s = {
        iw: img.width,
        ih: img.height,
        cara: null
      };
      return IMMotor.caras(f).then(function(l) {
        s.cara = (l || []).sort(function(a, b) {
          return b.w * b.h - a.w * a.h;
        })[0] || null;
      }, function() {}).then(function() {
        if (!estados[k]) estados[k] = autoCarnet(s, docActual());
        return estados[k];
      });
    });
  }
  H._sinDatos = sinDatos;
  H._util = {
    $: $,
    $$: $$,
    esc: esc,
    base: base,
    num: num,
    debounce: debounce,
    campo: campo,
    mostrarSi: mostrarSi,
    cadaImagen: cadaImagen,
    codificar: codificar,
    formatoElegido: formatoElegido,
    Visor: Visor
  };
})();