(function() {
  "use strict";
  var H = window.IMHerramientas, U = H._util;
  var Visor = U.Visor, $ = U.$, $$ = U.$$, esc = U.esc, base = U.base, num = U.num, debounce = U.debounce, campo = U.campo, mostrarSi = U.mostrarSi;
  var cadaImagen = U.cadaImagen, codificar = U.codificar;
  function claveArch(f) {
    return f.name + "|" + f.size + "|" + f.lastModified;
  }
  function porc(a, t) {
    return t ? Math.min(100, Math.floor(a / t * 100)) : 0;
  }
  function lienzo(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function aBlob(c, tipo, q) {
    return new Promise(function(ok, mal) {
      c.toBlob(function(b) {
        if (b) ok(b); else mal({
          codigo: "memoria"
        });
      }, tipo || "image/png", q);
    });
  }
  function copiar(texto, boton) {
    var hecho = function() {
      if (!boton) return;
      var antes = boton.dataset.texto || boton.textContent;
      boton.dataset.texto = antes;
      boton.classList.add("copiado");
      boton.textContent = "Copiado";
      setTimeout(function() {
        boton.textContent = antes;
        boton.classList.remove("copiado");
      }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(hecho, hecho); else hecho();
  }
  function hex2(n) {
    return ("0" + n.toString(16)).slice(-2).toUpperCase();
  }
  function aHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [ Math.round(h), Math.round(s * 100), Math.round(l * 100) ];
  }
  function codigoColor(c, como) {
    if (/RGB/.test(como)) return "rgb(" + c[0] + ", " + c[1] + ", " + c[2] + ")";
    if (/HSL/.test(como)) {
      var h = aHsl(c[0], c[1], c[2]);
      return "hsl(" + h[0] + ", " + h[1] + "%, " + h[2] + "%)";
    }
    return "#" + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
  }
  function claro(c) {
    return .299 * c[0] + .587 * c[1] + .114 * c[2] > 150;
  }
  function paletaDe(canvas, k) {
    var e = Math.min(1, 140 / Math.max(canvas.width, canvas.height)), c = lienzo(canvas.width * e, canvas.height * e), g = c.getContext("2d", {
      willReadFrequently: true
    });
    g.drawImage(canvas, 0, 0, c.width, c.height);
    var d = g.getImageData(0, 0, c.width, c.height).data, px = [];
    for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([ d[i], d[i + 1], d[i + 2] ]);
    if (!px.length) return [];
    var semilla = 7, azar = function() {
      semilla = semilla * 16807 % 2147483647;
      return semilla / 2147483647;
    };
    var dist = function(a, b) {
      var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
      return .3 * x * x + .59 * y * y + .11 * z * z;
    };
    var cent = [ px[Math.floor(azar() * px.length)].slice() ];
    while (cent.length < k) {
      var dd = px.map(function(p) {
        return Math.min.apply(null, cent.map(function(q) {
          return dist(p, q);
        }));
      }), tot = dd.reduce(function(a, b) {
        return a + b;
      }, 0);
      if (!tot) break;
      var r = azar() * tot, j = 0;
      while (r > dd[j] && j < dd.length - 1) {
        r -= dd[j];
        j++;
      }
      cent.push(px[j].slice());
    }
    var grupo = new Array(px.length), cuenta = [];
    for (var it = 0; it < 12; it++) {
      var suma = cent.map(function() {
        return [ 0, 0, 0 ];
      });
      cuenta = cent.map(function() {
        return 0;
      });
      for (var p = 0; p < px.length; p++) {
        var mejor = 0, md = Infinity;
        for (var q = 0; q < cent.length; q++) {
          var v = dist(px[p], cent[q]);
          if (v < md) {
            md = v;
            mejor = q;
          }
        }
        grupo[p] = mejor;
        cuenta[mejor]++;
        suma[mejor][0] += px[p][0];
        suma[mejor][1] += px[p][1];
        suma[mejor][2] += px[p][2];
      }
      cent = cent.map(function(c0, q) {
        return cuenta[q] ? [ suma[q][0] / cuenta[q], suma[q][1] / cuenta[q], suma[q][2] / cuenta[q] ] : c0;
      });
    }
    return cent.map(function(c0, q) {
      return {
        c: [ Math.round(c0[0]), Math.round(c0[1]), Math.round(c0[2]) ],
        n: cuenta[q] / px.length
      };
    }).filter(function(x) {
      return x.n > 0;
    }).sort(function(a, b) {
      return b.n - a.n;
    });
  }
  function nPaleta() {
    var m = (IM.opcion("Paleta") || "").match(/\d+/);
    return m ? +m[0] : 6;
  }
  function codigoElegido() {
    return IM.opcion("Código") || "HEX";
  }
  H["tomar-colores-de-una-imagen"] = {
    montar: function(cont) {
      var v, paleta = [], elegido = null, marca = null, elegidos = {};
      var panel = document.createElement("div");
      panel.className = "colores";
      panel.hidden = true;
      panel.innerHTML = '<div class="color-elegido" hidden><span class="color-muestra"></span><button type="button" class="color-codigo"></button></div>' + '<p class="res-rotulo">Paleta</p><div class="paleta"></div>';
      var pintar = function() {
        var como = codigoElegido(), ce = $(".color-elegido", panel);
        if (elegido) {
          ce.hidden = false;
          $(".color-muestra", ce).style.background = codigoColor(elegido, "HEX");
          $(".color-codigo", ce).textContent = codigoColor(elegido, como);
          $(".color-codigo", ce).removeAttribute("data-texto");
        } else ce.hidden = true;
        var n = Math.max(paleta.length, 1), tope = /HEX/.test(como) ? 6 : 4;
        $(".paleta", panel).style.gridTemplateColumns = "repeat(" + (n <= tope ? n : Math.ceil(n / 2)) + ", minmax(0, 1fr))";
        $(".paleta", panel).innerHTML = paleta.map(function(x) {
          return '<button type="button" class="paleta-color" data-codigo="' + esc(codigoColor(x.c, como)) + '"><span class="paleta-muestra" style="background:' + codigoColor(x.c, "HEX") + '"></span>' + '<span class="paleta-texto">' + esc(codigoColor(x.c, como)) + '</span><span class="paleta-parte">' + Math.max(1, Math.round(x.n * 100)) + " %</span></button>";
        }).join("");
      };
      var pintarSuave = function() {
        if (panel.hidden) pintar(); else IM.altoSuave(panel, pintar);
      };
      var calcular = debounce(function() {
        if (!v || !v.img) {
          paleta = [];
          panel.hidden = true;
          return;
        }
        paleta = paletaDe(v.lienzo, nPaleta());
        IM.mostrarSuave(panel);
        pintar();
      }, 60);
      var ponerMarca = function(x) {
        if (!x) {
          if (marca) {
            marca.remove();
            marca = null;
          }
          return;
        }
        if (!marca) {
          marca = document.createElement("span");
          marca.className = "color-punto";
          v.capa.appendChild(marca);
        }
        marca.style.left = x.fx * 100 + "%";
        marca.style.top = x.fy * 100 + "%";
        marca.style.background = codigoColor(x.c, "HEX");
      };
      v = new Visor(cont, {
        nota: "Tocá la imagen para tomar un color.",
        alCambiar: function() {
          var x = v.actual && elegidos[claveArch(v.actual)];
          elegido = x ? x.c : null;
          ponerMarca(x);
          calcular();
        }
      });
      cont.appendChild(panel);
      v.capa.classList.add("tomable");
      v.capa.addEventListener("click", function(e) {
        if (!v.img) return;
        var b = v.capa.getBoundingClientRect(), fx = (e.clientX - b.left) / b.width, fy = (e.clientY - b.top) / b.height;
        var x = Math.min(v.lienzo.width - 1, Math.max(0, Math.floor(fx * v.lienzo.width))), y = Math.min(v.lienzo.height - 1, Math.max(0, Math.floor(fy * v.lienzo.height)));
        var d = v.lienzo.getContext("2d").getImageData(x, y, 1, 1).data;
        elegido = [ d[0], d[1], d[2] ];
        var nuevo = {
          c: elegido,
          fx: fx,
          fy: fy
        };
        if (v.actual) elegidos[claveArch(v.actual)] = nuevo;
        ponerMarca(nuevo);
        pintarSuave();
        copiar(codigoColor(elegido, codigoElegido()), $(".color-codigo", panel));
      });
      panel.addEventListener("click", function(e) {
        var b = e.target.closest(".paleta-color");
        if (b) {
          copiar(b.dataset.codigo, $(".paleta-texto", b));
          return;
        }
        var c = e.target.closest(".color-codigo");
        if (c) copiar(c.textContent, c);
      });
      IM.alCambiarOpcion(function() {
        if (v.img) {
          paleta = paletaDe(v.lienzo, nPaleta());
          pintarSuave();
        }
      });
      document.addEventListener("im-restablecer", function() {
        elegidos = {};
        elegido = null;
        ponerMarca(null);
        if (v.img) {
          paleta = paletaDe(v.lienzo, nPaleta());
          pintarSuave();
        }
      });
      this._elegidos = function() {
        return elegidos;
      };
    },
    procesar: function() {
      var elegidos = this._elegidos(), como = codigoElegido(), n = nPaleta();
      cadaImagen("Armando la paleta", function(f) {
        return IMMotor.bitmap(f).then(function(img) {
          var e0 = Math.min(1, 1200 / Math.max(img.width, img.height)), cv = lienzo(img.width * e0, img.height * e0);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          var x0 = elegidos[claveArch(f)], l = paletaDe(cv, n);
          if (x0) l.unshift({
            c: x0.c,
            elegido: true
          });
          var d = {
            archivo: f
          };
          var W = 1200, alto = 360, n = l.length, c = lienzo(W, alto + 120), g = c.getContext("2d");
          g.fillStyle = "#ffffff";
          g.fillRect(0, 0, c.width, c.height);
          var anchoF = W / n;
          l.forEach(function(x, i) {
            g.fillStyle = codigoColor(x.c, "HEX");
            g.fillRect(i * anchoF, 0, Math.ceil(anchoF), alto);
            g.fillStyle = "#2A2723";
            g.textAlign = "center";
            g.font = "600 " + Math.round(Math.min(26, anchoF / 6)) + "px Inter, Arial, sans-serif";
            g.fillText(codigoColor(x.c, "HEX"), i * anchoF + anchoF / 2, alto + 46);
            g.font = "400 " + Math.round(Math.min(20, anchoF / 8)) + "px Inter, Arial, sans-serif";
            g.fillStyle = "#6E685E";
            g.fillText(/HEX/.test(como) ? codigoColor(x.c, "RGB").replace("rgb", "") : codigoColor(x.c, como), i * anchoF + anchoF / 2, alto + 84);
          });
          return aBlob(c).then(function(b) {
            return {
              nombre: base(d.archivo.name) + "-paleta.png",
              blob: b,
              nota: l.map(function(x) {
                return codigoColor(x.c, como);
              }).join(" · ")
            };
          });
        });
      });
    }
  };
  var MAX_SEG = 30;
  function redondo(x) {
    return Math.round(x * 10) / 10;
  }
  function abrirVideo(f) {
    return new Promise(function(ok, mal) {
      var v = document.createElement("video"), url = URL.createObjectURL(f);
      v.muted = true;
      v.preload = "auto";
      v.playsInline = true;
      v.onloadedmetadata = function() {
        if (!isFinite(v.duration) || !v.videoWidth) {
          mal({
            codigo: "video",
            archivo: f.name
          });
          return;
        }
        ok({
          v: v,
          url: url
        });
      };
      v.onerror = function() {
        URL.revokeObjectURL(url);
        mal({
          codigo: "video",
          archivo: f.name
        });
      };
      v.src = url;
    });
  }
  function irA(v, t) {
    return new Promise(function(ok) {
      var listo = false, fin = function() {
        if (listo) return;
        listo = true;
        v.removeEventListener("seeked", fin);
        ok();
      };
      v.addEventListener("seeked", fin);
      v.currentTime = t;
      setTimeout(fin, 4e3);
    });
  }
  H["video-a-gif"] = {
    opcion: function(rotulo) {
      if (rotulo !== "Fragmento") return null;
      var n = function(id, rot, val) {
        return campo(id, rot, '<span class="campo-con-boton"><input type="number" min="0" step="0.1" value="' + val + '" inputmode="decimal"><button type="button" class="boton-chico" data-aca="' + id + '">' + (id === "campo-desde" ? "Desde acá" : "Hasta acá") + "</button></span>");
      };
      return n("campo-desde", "Desde (s)", 0) + n("campo-hasta", "Hasta (s)", 5);
    },
    montar: function(cont) {
      var caja = document.createElement("div");
      caja.className = "visor video-visor";
      caja.hidden = true;
      caja.innerHTML = '<p class="res-rotulo visor-rotulo">Video<button type="button" class="restablecer">Restablecer</button></p><video class="video-ver" controls playsinline muted></video><p class="visor-nota"></p>';
      cont.appendChild(caja);
      IM.usarEleccion();
      var ver = $("video", caja), nota = $(".visor-nota", caja), actual = null, url = null, tocado = false, tramos = {};
      var guardar = function() {
        if (actual && tocado) tramos[claveArch(actual)] = {
          desde: num(desde.value),
          hasta: num(hasta.value)
        };
      };
      var desde = $("#campo-desde input"), hasta = $("#campo-hasta input");
      var notaLargo = function() {
        var a = num(desde.value), b = num(hasta.value);
        nota.textContent = (isFinite(ver.duration) ? "Dura " + ver.duration.toFixed(1).replace(".", ",") + " s. " : "") + (b > a ? "El GIF dura " + (b - a).toFixed(1).replace(".", ",") + " s." : "");
      };
      var mostrar = function() {
        var arch = IM.archivos(), a = arch[Math.min(IM.elegido(), arch.length - 1)];
        var f = a && a.tipo === "video" ? a.file : (arch.filter(function(x) {
          return x.tipo === "video";
        })[0] || {}).file;
        if (!f) {
          if (!caja.hidden) IM.ocultarSuave(caja);
          actual = null;
          return;
        }
        if (f === actual) return;
        guardar();
        actual = f;
        tocado = !!tramos[claveArch(f)];
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(f);
        ver.src = url;
      };
      ver.addEventListener("loadeddata", function() {
        if (actual) IM.mostrarSuave(caja);
      });
      ver.addEventListener("loadedmetadata", function() {
        var tr = actual && tramos[claveArch(actual)];
        if (tr) {
          desde.value = tr.desde;
          hasta.value = tr.hasta;
        } else if (!tocado) {
          desde.value = 0;
          hasta.value = redondo(Math.min(ver.duration, 5));
        }
        hasta.max = redondo(ver.duration);
        desde.max = redondo(ver.duration);
        notaLargo();
      });
      ver.addEventListener("error", function() {
        if (actual) IM.aviso(actual.name + ": este navegador no puede abrir ese video.");
      });
      [ desde, hasta ].forEach(function(i) {
        i.addEventListener("input", function() {
          tocado = true;
          notaLargo();
        });
      });
      $$("[data-aca]").forEach(function(b) {
        b.addEventListener("click", function() {
          tocado = true;
          var t = redondo(ver.currentTime);
          if (b.dataset.aca === "campo-desde") {
            desde.value = t;
            if (num(hasta.value) <= t) hasta.value = redondo(Math.min(ver.duration, t + 3));
          } else hasta.value = t;
          notaLargo();
        });
      });
      document.addEventListener("im-restablecer", function() {
        tocado = false;
        tramos = {};
        if (isFinite(ver.duration)) {
          desde.value = 0;
          hasta.value = redondo(Math.min(ver.duration, 5));
        }
        notaLargo();
      });
      IM.alCambiarArchivos(mostrar);
      IM.alElegirArchivo(mostrar);
      Promise.resolve().then(mostrar);
      this._tramos = function() {
        guardar();
        return tramos;
      };
      this.desmontar = function() {
        if (url) URL.revokeObjectURL(url);
      };
    },
    procesar: function() {
      var tramos = this._tramos ? this._tramos() : {};
      var malos = IM.archivos().filter(function(a) {
        var tr = tramos[claveArch(a.file)];
        return tr && !(tr.hasta > tr.desde);
      });
      if (malos.length) {
        IM.aviso(malos[0].file.name + ": el segundo de fin tiene que ser mayor que el de inicio.");
        return;
      }
      var largos = IM.archivos().filter(function(a) {
        var tr = tramos[claveArch(a.file)];
        return tr && tr.hasta - tr.desde > MAX_SEG;
      });
      if (largos.length) {
        IM.aviso(largos[0].file.name + ": el fragmento puede durar hasta " + MAX_SEG + " segundos.");
        return;
      }
      var cps = +((IM.opcion("Cuadros por segundo") || "10").match(/\d+/) || [ 10 ])[0], tam = IM.opcion("Tamaño") || "", lado = /Grande/.test(tam) ? 640 : /Chico/.test(tam) ? 320 : 480, repetir = !/una sola/i.test(IM.opcion("Repetir") || "");
      cadaImagen("Leyendo el video", function(f, i, av, cancelado) {
        var cuadros = [], vid, total, tr = tramos[claveArch(f)], a, b;
        return abrirVideo(f).then(function(r) {
          vid = r.v;
          a = tr ? tr.desde : 0;
          b = Math.min(tr ? tr.hasta : 5, vid.duration);
          var e = Math.min(1, lado / Math.max(vid.videoWidth, vid.videoHeight)), w = Math.round(vid.videoWidth * e), h = Math.round(vid.videoHeight * e);
          var c = lienzo(w, h), g = c.getContext("2d");
          total = Math.max(1, Math.round((b - a) * cps));
          var cadena = Promise.resolve();
          for (var k = 0; k < total; k++) (function(k) {
            cadena = cadena.then(function() {
              if (cancelado()) throw {
                codigo: "cancelado"
              };
              av("Cuadro " + (k + 1) + " de " + total + ".");
              return irA(vid, Math.min(vid.duration - .001, a + k / cps)).then(function() {
                g.drawImage(vid, 0, 0, w, h);
                return createImageBitmap(c);
              }).then(function(bm) {
                cuadros.push(bm);
              });
            });
          })(k);
          return cadena;
        }).then(function() {
          URL.revokeObjectURL(vid.src);
          vid.removeAttribute("src");
          vid.load();
          return IMMotor.trabajar({
            op: "gif",
            fuentes: cuadros,
            o: {
              lado: lado,
              demora: Math.round(1e3 / cps),
              repetir: repetir
            }
          }, function(h, t) {
            av("Creando el GIF… Cuadro " + h + " de " + t + ".");
          }, cuadros);
        }).then(function(r) {
          return {
            nombre: base(f.name) + ".gif",
            blob: r.blob,
            nota: total + " cuadros · " + IM.peso(r.blob.size) + "."
          };
        });
      }, {
        unidad: "Video",
        zip: false
      });
    }
  };
  function cuadrosGif(lib, buf) {
    var gif = lib.parseGIF(buf), fr = lib.decompressFrames(gif, true);
    if (!fr.length) throw {
      codigo: "imagen"
    };
    var W = gif.lsd.width, Hh = gif.lsd.height, pant = lienzo(W, Hh), g = pant.getContext("2d"), parche = lienzo(1, 1), gp = parche.getContext("2d"), anterior = null, out = [];
    fr.forEach(function(x) {
      var d = x.dims;
      if (x.disposalType === 3) anterior = g.getImageData(0, 0, W, Hh);
      if (parche.width !== d.width || parche.height !== d.height) {
        parche.width = d.width;
        parche.height = d.height;
      }
      gp.putImageData(new ImageData(new Uint8ClampedArray(x.patch), d.width, d.height), 0, 0);
      g.drawImage(parche, d.left, d.top);
      out.push({
        img: g.getImageData(0, 0, W, Hh),
        demora: x.delay && x.delay >= 20 ? x.delay : 100
      });
      if (x.disposalType === 2) g.clearRect(d.left, d.top, d.width, d.height); else if (x.disposalType === 3 && anterior) g.putImageData(anterior, 0, 0);
    });
    return {
      W: W,
      H: Hh,
      cuadros: out
    };
  }
  H["gif-a-video"] = {
    montar: function(cont) {
      new Visor(cont, {});
    },
    procesar: function() {
      var veces = +((IM.opcion("Repetir el GIF") || "1").match(/\d+/) || [ 1 ])[0] || 1;
      if (/una vez/i.test(IM.opcion("Repetir el GIF") || "")) veces = 1;
      cadaImagen("Convirtiendo", function(f, i, av, cancelado) {
        var lib;
        if (!/\.gif$/i.test(f.name) && f.type !== "image/gif") return Promise.reject({
          codigo: "solo-gif",
          archivo: f.name
        });
        return IMMotor.libVideo().then(function(l) {
          lib = l;
          return f.arrayBuffer();
        }).then(function(buf) {
          var g;
          try {
            g = cuadrosGif(lib, buf);
          } catch (e) {
            throw {
              codigo: "imagen",
              archivo: f.name
            };
          }
          var e = Math.min(1, 1920 / Math.max(g.W, g.H)), W = Math.max(2, Math.round(g.W * e / 2) * 2), Hh = Math.max(2, Math.round(g.H * e / 2) * 2);
          var c = lienzo(W, Hh), cx = c.getContext("2d"), tmp = lienzo(g.W, g.H), tg = tmp.getContext("2d");
          return lib.canEncodeVideo("avc", {
            width: W,
            height: Hh
          }).then(function(avc) {
            return avc ? "avc" : lib.canEncodeVideo("vp9", {
              width: W,
              height: Hh
            }).then(function(vp9) {
              if (!vp9) throw {
                codigo: "video-codificar"
              };
              return "vp9";
            });
          }).then(function(codec) {
            var mp4 = codec === "avc", salida = new lib.Output({
              format: mp4 ? new lib.Mp4OutputFormat({
                fastStart: "in-memory"
              }) : new lib.WebMOutputFormat,
              target: new lib.BufferTarget
            });
            var prom = g.cuadros.reduce(function(x, q) {
              return x + q.demora;
            }, 0) / g.cuadros.length, cps = Math.min(30, Math.max(1, 1e3 / prom));
            var cal = IM.opcion("Calidad") || "", fac = /liviana/i.test(cal) ? .15 : /media/i.test(cal) ? .6 : 1.6;
            var tasa = Math.round(Math.min(8e6, Math.max(15e4, W * Hh * cps * fac)));
            var fuente = new lib.CanvasSource(c, {
              codec: codec,
              bitrate: tasa
            });
            salida.addVideoTrack(fuente);
            var t = 0, total = g.cuadros.length * veces, k = 0;
            return salida.start().then(function() {
              var cadena = Promise.resolve();
              for (var vez = 0; vez < veces; vez++) g.cuadros.forEach(function(q) {
                cadena = cadena.then(function() {
                  if (cancelado()) throw {
                    codigo: "cancelado"
                  };
                  av("Cuadro " + ++k + " de " + total + ".");
                  tg.putImageData(q.img, 0, 0);
                  cx.fillStyle = "#ffffff";
                  cx.fillRect(0, 0, W, Hh);
                  cx.imageSmoothingQuality = "high";
                  cx.drawImage(tmp, 0, 0, W, Hh);
                  var dur = q.demora / 1e3, p = fuente.add(t, dur);
                  t += dur;
                  return p;
                });
              });
              return cadena;
            }).then(function() {
              return salida.finalize();
            }).then(function() {
              var blob = new Blob([ salida.target.buffer ], {
                type: mp4 ? "video/mp4" : "video/webm"
              });
              return {
                nombre: base(f.name) + (mp4 ? ".mp4" : ".webm"),
                blob: blob,
                nota: "Pesaba " + IM.peso(f.size) + " · ahora " + IM.peso(blob.size) + " · " + t.toFixed(1).replace(".", ",") + " s."
              };
            });
          });
        });
      }, {
        nombreZip: "videos.zip"
      });
    }
  };
  function formaIcono() {
    var f = IM.opcion("Forma") || "";
    return /círculo/i.test(f) ? "circulo" : /redondeada/i.test(f) ? "redondeada" : "tal";
  }
  function fondoIcono() {
    var f = IM.opcion("Fondo") || "";
    return /Blanco/.test(f) ? "#ffffff" : /Negro/.test(f) ? "#000000" : null;
  }
  function margenIcono() {
    var m = IM.opcion("Margen") || "";
    return /grande/i.test(m) ? .16 : /chico/i.test(m) ? .08 : 0;
  }
  function camino(g, S, forma) {
    g.beginPath();
    if (forma === "circulo") g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); else if (forma === "redondeada" && g.roundRect) g.roundRect(0, 0, S, S, S * .22); else g.rect(0, 0, S, S);
  }
  function dibujarIcono(img, S, forzarFondo) {
    var c = lienzo(S, S), g = c.getContext("2d"), forma = formaIcono(), fondo = fondoIcono() || forzarFondo, m = margenIcono();
    g.imageSmoothingQuality = "high";
    if (forzarFondo) {
      g.fillStyle = fondoIcono() || forzarFondo;
      g.fillRect(0, 0, S, S);
    }
    camino(g, S, forma);
    g.save();
    g.clip();
    if (fondo) {
      g.fillStyle = fondo;
      g.fillRect(0, 0, S, S);
    }
    var lado = S * (1 - 2 * m), e = Math.min(lado / img.width, lado / img.height);
    if (forma === "circulo" && !fondo && !m) e = Math.max(lado / img.width, lado / img.height);
    g.drawImage(img, (S - img.width * e) / 2, (S - img.height * e) / 2, img.width * e, img.height * e);
    g.restore();
    return c;
  }
  function fondoIphone(img) {
    var c = lienzo(8, 8), g = c.getContext("2d", {
      willReadFrequently: true
    });
    g.drawImage(img, 0, 0, 8, 8);
    var d = g.getImageData(0, 0, 1, 1).data;
    return d[3] > 240 ? "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")" : "#ffffff";
  }
  function ico(pngs) {
    var n = pngs.length, cab = 6 + 16 * n, total = cab + pngs.reduce(function(a, p) {
      return a + p.datos.length;
    }, 0), b = new Uint8Array(total), dv = new DataView(b.buffer);
    dv.setUint16(2, 1, true);
    dv.setUint16(4, n, true);
    var pos = cab;
    pngs.forEach(function(p, i) {
      var o = 6 + 16 * i;
      b[o] = p.lado >= 256 ? 0 : p.lado;
      b[o + 1] = p.lado >= 256 ? 0 : p.lado;
      dv.setUint16(o + 4, 1, true);
      dv.setUint16(o + 6, 32, true);
      dv.setUint32(o + 8, p.datos.length, true);
      dv.setUint32(o + 12, pos, true);
      b.set(p.datos, pos);
      pos += p.datos.length;
    });
    return b;
  }
  H["crear-favicon"] = {
    montar: function(cont) {
      var prev = document.createElement("div");
      prev.className = "favicon-previa";
      prev.hidden = true;
      prev.innerHTML = '<p class="res-rotulo">Así se ve</p><div class="pestana"><img class="pestana-icono" alt=""><span>Tu sitio web</span></div>' + '<div class="favicon-tamanos"></div>';
      var v, urls = [];
      var pintar = debounce(function() {
        if (!v || !v.img) {
          prev.hidden = true;
          return;
        }
        IM.mostrarSuave(prev);
        urls.forEach(function(u) {
          URL.revokeObjectURL(u);
        });
        urls = [];
        var c32 = dibujarIcono(v.img, 64);
        $(".pestana-icono", prev).src = c32.toDataURL();
        $(".favicon-tamanos", prev).innerHTML = [ 16, 32, 48, 180 ].map(function(s) {
          return '<figure><img alt="" width="' + Math.min(s, 90) + '" height="' + Math.min(s, 90) + '" src="' + dibujarIcono(v.img, s * 2, s === 180 ? fondoIphone(v.img) : null).toDataURL() + '"><figcaption>' + (s === 180 ? "180 px (iPhone)" : s + " px") + "</figcaption></figure>";
        }).join("");
      }, 60);
      v = new Visor(cont, {
        alCambiar: pintar
      });
      cont.appendChild(prev);
      IM.alCambiarOpcion(pintar);
      this._img = function() {
        return {
          img: v.img,
          f: v.actual
        };
      };
    },
    procesar: function() {
      cadaImagen("Creando el favicon", function(f) {
        var d = {
          f: f
        };
        return IMMotor.bitmap(d.f).then(function(img) {
          var png = function(s, fondo) {
            return aBlob(dibujarIcono(img, s, fondo)).then(function(b) {
              return b.arrayBuffer();
            }).then(function(a) {
              return new Uint8Array(a);
            });
          };
          return Promise.all([ png(16), png(32), png(48), png(180, fondoIphone(img)), png(192), png(512) ]);
        }).then(function(p) {
          var nombre = base(d.f.name).replace(/[^\w .-]/g, "").slice(0, 40);
          var manifiesto = JSON.stringify({
            name: nombre,
            short_name: nombre,
            icons: [ {
              src: "/android-chrome-192x192.png",
              sizes: "192x192",
              type: "image/png"
            }, {
              src: "/android-chrome-512x512.png",
              sizes: "512x512",
              type: "image/png"
            } ],
            theme_color: "#ffffff",
            background_color: "#ffffff",
            display: "standalone"
          }, null, 2);
          var codigo = '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n';
          var t = new TextEncoder;
          var z = fflate.zipSync({
            "favicon.ico": [ ico([ {
              lado: 16,
              datos: p[0]
            }, {
              lado: 32,
              datos: p[1]
            }, {
              lado: 48,
              datos: p[2]
            } ]), {
              level: 0
            } ],
            "favicon-16x16.png": [ p[0], {
              level: 0
            } ],
            "favicon-32x32.png": [ p[1], {
              level: 0
            } ],
            "apple-touch-icon.png": [ p[3], {
              level: 0
            } ],
            "android-chrome-192x192.png": [ p[4], {
              level: 0
            } ],
            "android-chrome-512x512.png": [ p[5], {
              level: 0
            } ],
            "site.webmanifest": t.encode(manifiesto),
            "codigo-para-tu-pagina.txt": t.encode(codigo)
          });
          return {
            nombre: base(d.f.name) + "-favicon.zip",
            blob: new Blob([ z ], {
              type: "application/zip"
            }),
            nota: "favicon.ico, 5 PNG, site.webmanifest y el código para tu página."
          };
        });
      }, {
        zip: false
      });
    }
  };
  function buscar(b, patron, desde, hasta) {
    hasta = Math.min(b.length - patron.length, hasta == null ? b.length : hasta);
    for (var i = desde || 0; i <= hasta; i++) {
      var k = 0;
      while (k < patron.length && b[i + k] === patron[k]) k++;
      if (k === patron.length) return i;
    }
    return -1;
  }
  var EXIF0 = [ 69, 120, 105, 102, 0, 0 ];
  function leerTiff(b, t0) {
    var le = b[t0] === 73, dv = new DataView(b.buffer, b.byteOffset);
    var u16 = function(o) {
      return dv.getUint16(t0 + o, le);
    }, u32 = function(o) {
      return dv.getUint32(t0 + o, le);
    };
    var TAM = {
      1: 1,
      2: 1,
      3: 2,
      4: 4,
      5: 8,
      7: 1,
      9: 4,
      10: 8
    };
    var valor = function(e) {
      var tipo = u16(e + 2), n = u32(e + 4), tam = (TAM[tipo] || 1) * n, o = tam > 4 ? u32(e + 8) : e + 8;
      if (t0 + o + tam > b.length) return null;
      if (tipo === 2) {
        var s = "";
        for (var i = 0; i < n; i++) {
          var ch = b[t0 + o + i];
          if (!ch) break;
          s += String.fromCharCode(ch);
        }
        return s.trim();
      }
      var out = [];
      for (var j = 0; j < Math.min(n, 16); j++) {
        if (tipo === 3) out.push(u16(o + 2 * j)); else if (tipo === 4) out.push(u32(o + 4 * j)); else if (tipo === 5 || tipo === 10) {
          var a = tipo === 10 ? dv.getInt32(t0 + o + 8 * j, le) : u32(o + 8 * j), d = tipo === 10 ? dv.getInt32(t0 + o + 8 * j + 4, le) : u32(o + 8 * j + 4);
          out.push(d ? a / d : 0);
        } else if (tipo === 1 || tipo === 7) out.push(b[t0 + o + j]);
      }
      return out.length === 1 ? out[0] : out;
    };
    var ifd = function(o, dest) {
      if (!o || t0 + o + 2 > b.length) return;
      var n = u16(o);
      for (var i = 0; i < n && i < 400; i++) {
        var e = o + 2 + 12 * i;
        if (t0 + e + 12 > b.length) break;
        dest[u16(e)] = {
          v: valor(e),
          e: e
        };
      }
    };
    var r = {
      tags: {},
      gps: {},
      le: le,
      t0: t0
    };
    if (u16(2) !== 42) return r;
    ifd(u32(4), r.tags);
    if (r.tags[34665]) ifd(r.tags[34665].v, r.tags);
    if (r.tags[34853]) {
      r.gpsIfd = r.tags[34853].v;
      ifd(r.gpsIfd, r.gps);
    }
    return r;
  }
  function tiffEn(b) {
    if (b[0] === 137 && b[1] === 80) {
      var i = 8;
      while (i + 12 <= b.length) {
        var n = (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0, tp = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
        if (tp === "eXIf") return i + 8;
        i += 12 + n;
      }
      return -1;
    }
    var p = buscar(b, EXIF0, 0, Math.min(b.length, 4 << 20));
    while (p >= 0) {
      var t = p + 6;
      if (b[t] === 73 && b[t + 1] === 73 && b[t + 2] === 42 || b[t] === 77 && b[t + 1] === 77 && b[t + 3] === 42) return t;
      p = buscar(b, EXIF0, p + 1, Math.min(b.length, 4 << 20));
    }
    return -1;
  }
  function xmpEn(b) {
    var p = buscar(b, [ 60, 120, 58, 120, 109, 112, 109, 101, 116, 97 ]);
    if (p < 0) return null;
    var fin = buscar(b, [ 60, 47, 120, 58, 120, 109, 112, 109, 101, 116, 97, 62 ], p);
    return (new TextDecoder).decode(b.subarray(p, fin > 0 ? fin + 12 : Math.min(b.length, p + 65536)));
  }
  function textosPng(b) {
    var out = [], i = 8;
    if (!(b[0] === 137 && b[1] === 80)) return out;
    while (i + 12 <= b.length) {
      var n = (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0, tp = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      if (tp === "tEXt" || tp === "iTXt") {
        var d = b.subarray(i + 8, i + 8 + n), z = d.indexOf(0), clave = (new TextDecoder).decode(d.subarray(0, z)), resto = d.subarray(z + 1);
        if (tp === "iTXt") {
          var k = 2, cuenta = 0;
          while (k < resto.length && cuenta < 2) {
            if (resto[k] === 0) cuenta++;
            k++;
          }
          resto = resto.subarray(k);
        }
        out.push([ clave, (new TextDecoder).decode(resto).slice(0, 200) ]);
      }
      if (tp === "IEND") break;
      i += 12 + n;
    }
    return out;
  }
  function gpsGrados(v, ref) {
    if (!Array.isArray(v)) return null;
    var g = v[0] + v[1] / 60 + v[2] / 3600;
    return /[SW]/.test(ref || "") ? -g : g;
  }
  function analizar(f) {
    return f.arrayBuffer().then(function(ab) {
      var b = new Uint8Array(ab), filas = [], t = tiffEn(b), ubic = false, x;
      if (t >= 0) {
        x = leerTiff(b, t);
        var T = function(id) {
          return x.tags[id] && x.tags[id].v != null && x.tags[id].v !== "" ? x.tags[id].v : null;
        };
        var lat = gpsGrados(x.gps[2] && x.gps[2].v, x.gps[1] && x.gps[1].v), lon = gpsGrados(x.gps[4] && x.gps[4].v, x.gps[3] && x.gps[3].v);
        if (lat != null && lon != null && (lat || lon)) {
          ubic = true;
          filas.push([ "Ubicación", lat.toFixed(6) + ", " + lon.toFixed(6) + (x.gps[6] && typeof x.gps[6].v === "number" ? " · " + Math.round(x.gps[6].v) + " m de altura" : "") ]);
        } else if (Object.keys(x.gps).length) {
          ubic = true;
          filas.push([ "Ubicación", "datos de GPS guardados" ]);
        }
        var fecha = T(36867) || T(306);
        if (fecha) filas.push([ "Fecha", String(fecha).replace(/^(\d{4}):(\d\d):(\d\d)/, "$3/$2/$1") ]);
        var cam = [ T(271), T(272) ].filter(Boolean).join(" ");
        if (cam) filas.push([ "Cámara o teléfono", cam ]);
        if (T(42036)) filas.push([ "Lente", T(42036) ]);
        if (T(42033)) filas.push([ "Número de serie", T(42033) ]);
        if (T(305)) filas.push([ "Programa", T(305) ]);
        if (T(315)) filas.push([ "Autor", T(315) ]);
        if (T(33432)) filas.push([ "Derechos", T(33432) ]);
        if (T(270)) filas.push([ "Descripción", T(270) ]);
        var exp = [];
        if (T(33434)) exp.push(T(33434) < 1 ? "1/" + Math.round(1 / T(33434)) + " s" : T(33434) + " s");
        if (T(33437)) exp.push("f/" + Math.round(T(33437) * 10) / 10);
        if (T(34855)) exp.push("ISO " + (Array.isArray(T(34855)) ? T(34855)[0] : T(34855)));
        if (T(37386)) exp.push(Math.round(T(37386)) + " mm");
        if (exp.length) filas.push([ "Exposición", exp.join(" · ") ]);
      }
      var xmp = xmpEn(b);
      if (xmp) {
        if (!ubic && /GPSLatitude/.test(xmp)) {
          ubic = true;
          filas.unshift([ "Ubicación", "datos de GPS guardados" ]);
        }
        var herr = (xmp.match(/CreatorTool(?:="|>)([^"<]+)/) || [])[1];
        if (herr && !filas.some(function(r) {
          return r[0] === "Programa";
        })) filas.push([ "Programa", herr ]);
        var aut = (xmp.match(/<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]+)/) || [])[1];
        if (aut && !filas.some(function(r) {
          return r[0] === "Autor";
        })) filas.push([ "Autor", aut ]);
        filas.push([ "Datos XMP", "sí (datos de edición)" ]);
      }
      textosPng(b).forEach(function(p) {
        filas.push([ p[0], p[1] ]);
      });
      return {
        filas: filas,
        ubicacion: ubic,
        orientacion: x && x.tags[274] ? x.tags[274].v : 1,
        bytes: b,
        tiff: t
      };
    });
  }
  function vaciarGps(b, t) {
    var x = leerTiff(b, t);
    if (!x.gpsIfd) return false;
    var dv = new DataView(b.buffer, b.byteOffset), le = x.le, o = t + x.gpsIfd, n = dv.getUint16(o, le), TAM = {
      1: 1,
      2: 1,
      3: 2,
      4: 4,
      5: 8,
      7: 1,
      9: 4,
      10: 8
    };
    for (var i = 0; i < n; i++) {
      var e = o + 2 + 12 * i, tam = (TAM[dv.getUint16(e + 2, le)] || 1) * dv.getUint32(e + 4, le);
      if (tam > 4) {
        var vo = t + dv.getUint32(e + 8, le);
        if (vo + tam <= b.length) b.fill(0, vo, vo + tam);
      }
      b.fill(0, e, e + 12);
    }
    dv.setUint16(o, 0, le);
    return true;
  }
  var CRC = null;
  function crc32(b) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        CRC[n] = c >>> 0;
      }
    }
    var r = 4294967295;
    for (var i = 0; i < b.length; i++) r = CRC[(r ^ b[i]) & 255] ^ r >>> 8;
    return (r ^ 4294967295) >>> 0;
  }
  function arreglarCrcPng(b) {
    var i = 8;
    while (i + 12 <= b.length) {
      var n = (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0, tp = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      if (tp === "eXIf") new DataView(b.buffer, b.byteOffset).setUint32(i + 8 + n, crc32(b.subarray(i + 4, i + 8 + n)));
      i += 12 + n;
    }
  }
  function app1Orientacion(o) {
    var s = new Uint8Array([ 255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 77, 77, 0, 42, 0, 0, 0, 8, 0, 1, 1, 18, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0 ]);
    return s;
  }
  H["ver-y-borrar-datos-de-la-foto"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo !== "Qué borrar") return null;
      return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + '<p class="opc-nota" id="nota-datos" hidden></p>';
    },
    montar: function(cont) {
      var datos = {}, panel = document.createElement("div");
      panel.className = "datos-foto";
      panel.hidden = true;
      var clave = function(f) {
        return f.name + "|" + f.size + "|" + f.lastModified;
      };
      var de = function(f) {
        var k = clave(f);
        return datos[k] || (datos[k] = analizar(f).then(function(r) {
          datos[k].r = r;
          IM.pintarEtiquetas();
          return r;
        }, function() {
          return {
            filas: [],
            ubicacion: false
          };
        }));
      };
      var v;
      var pintar = function() {
        if (!v || !v.actual) {
          panel.hidden = true;
          return;
        }
        var f = v.actual;
        de(f).then(function(r) {
          if (v.actual !== f) return;
          IM.mostrarSuave(panel);
          panel.innerHTML = (r.ubicacion ? '<p class="datos-alerta">Esta foto tiene guardada la ubicación donde se sacó.</p>' : "") + (r.filas.length ? '<dl class="datos-lista">' + r.filas.map(function(x) {
            return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>";
          }).join("") + "</dl>" : '<p class="datos-nada">Esta foto no tiene datos guardados.</p>') + (v.img ? '<p class="datos-medidas">' + v.img.width + " × " + v.img.height + " px · " + IM.peso(f.size) + "</p>" : "");
        });
      };
      v = new Visor(cont, {
        lado: 700,
        alCambiar: pintar
      });
      cont.appendChild(panel);
      IM.etiquetas(function(a) {
        var d = datos[clave(a.file)];
        return d && d.r && d.r.ubicacion ? {
          texto: "Con ubicación"
        } : null;
      });
      var boton = function() {
        IM.botonTexto(/ubicación/i.test(IM.opcion("Qué borrar") || "") ? "Borrar la ubicación" : "Borrar los datos");
      };
      var tokE = 0;
      var estado = function() {
        var arch = IM.archivos(), t = ++tokE, soloU = /ubicación/i.test(IM.opcion("Qué borrar") || ""), nota = $("#nota-datos");
        if (!arch.length) {
          IM.botonHabilitado(true);
          mostrarSi(nota, false);
          return;
        }
        Promise.all(arch.map(function(a) {
          return de(a.file);
        })).then(function(rs) {
          if (t !== tokE) return;
          var nada = rs.every(function(r) {
            return soloU ? !r.ubicacion : !r.filas.length;
          }), uno = rs.length === 1;
          IM.botonHabilitado(!nada);
          var txt = !nada ? "" : soloU ? uno ? "Esta foto no tiene la ubicación guardada." : "Ninguna de estas fotos tiene la ubicación guardada." : uno ? "" : "Ninguna de estas fotos tiene datos guardados.";
          if (nota) {
            if (txt) nota.textContent = txt;
            mostrarSi(nota, !!txt);
          }
        });
      };
      boton();
      IM.alCambiarOpcion(function() {
        boton();
        estado();
      });
      IM.alCambiarArchivos(function() {
        IM.archivos().forEach(function(a) {
          de(a.file);
        });
        estado();
      });
      Promise.resolve().then(function() {
        IM.archivos().forEach(function(a) {
          de(a.file);
        });
        estado();
      });
      this._de = de;
    },
    procesar: function() {
      var soloUbic = /ubicación/i.test(IM.opcion("Qué borrar") || ""), de = this._de;
      cadaImagen(soloUbic ? "Borrando la ubicación" : "Borrando los datos", function(f) {
        return de(f).then(function(r) {
          var b = new Uint8Array(r.bytes || []), jpg = b[0] === 255 && b[1] === 216, png = b[0] === 137 && b[1] === 80, webp = b.length > 12 && String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" && String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP";
          var sufijo = soloUbic ? "-sin-ubicacion." : "-sin-datos.";
          var ext = jpg ? "jpg" : png ? "png" : webp ? "webp" : "jpg";
          var nuevo;
          if (soloUbic && !r.ubicacion) nuevo = Promise.resolve({
            blob: new Blob([ b ], {
              type: f.type || "image/jpeg"
            }),
            nota: "No tenía ubicación: queda igual."
          }); else if (!soloUbic && !r.filas.length && (jpg || png || webp)) nuevo = Promise.resolve({
            blob: new Blob([ b ], {
              type: f.type || "image/jpeg"
            }),
            nota: "No tenía datos guardados: queda igual."
          }); else if (soloUbic && (jpg || png || webp) && r.tiff >= 0) {
            var c = b.slice();
            vaciarGps(c, r.tiff);
            if (png) arreglarCrcPng(c);
            var bl = new Blob([ c ], {
              type: f.type || "image/jpeg"
            });
            nuevo = (/GPSLatitude/.test(xmpEn(c) || "") && jpg ? sinXmpJpg(c) : Promise.resolve(bl)).then(function(x) {
              return {
                blob: x,
                nota: "Se borró la ubicación. Los demás datos quedan."
              };
            });
          } else if (jpg || png || webp) {
            nuevo = sinDatosArchivo(f).then(function(x) {
              if (jpg && r.orientacion && r.orientacion !== 1) return x.arrayBuffer().then(function(a) {
                var y = new Uint8Array(a);
                return new Blob([ y.subarray(0, 2), app1Orientacion(r.orientacion), y.subarray(2) ], {
                  type: "image/jpeg"
                });
              });
              return x;
            }).then(function(x) {
              return {
                blob: x,
                nota: soloUbic ? "Se borró la ubicación." : "Se borraron todos los datos. La imagen no cambió."
              };
            });
          } else {
            nuevo = IMMotor.fuente(f).then(function(src) {
              return codificar(src, [], {
                formato: "jpg",
                calidad: 92
              }, src instanceof ImageBitmap ? [ src ] : []);
            }).then(function(x) {
              return {
                blob: x.blob,
                nota: "Guardada como JPG, sin datos."
              };
            });
          }
          return nuevo.then(function(x) {
            return {
              nombre: base(f.name) + sufijo + ext,
              blob: x.blob,
              nota: x.nota
            };
          });
        });
      }, {
        nombreZip: soloUbic ? "sin-ubicacion.zip" : "sin-datos.zip"
      });
    }
  };
  function sinDatosArchivo(f) {
    return H._sinDatos ? H._sinDatos(f) : Promise.resolve(f);
  }
  function sinXmpJpg(b) {
    var partes = [ b.subarray(0, 2) ], i = 2;
    while (i + 4 <= b.length && b[i] === 255) {
      var m = b[i + 1];
      if (m === 218 || m === 217) break;
      var largo = b[i + 2] << 8 | b[i + 3], seg = b.subarray(i, i + 2 + largo);
      var esXmp = m === 225 && /^http:\/\/ns\.adobe\.com\/xap/.test(String.fromCharCode.apply(null, seg.subarray(4, 32)));
      if (!esXmp) partes.push(seg);
      i += 2 + largo;
    }
    partes.push(b.subarray(i));
    return Promise.resolve(new Blob(partes, {
      type: "image/jpeg"
    }));
  }
  function bordeOpc(rotulo, valor, ui) {
    if (rotulo !== "Color del borde") return null;
    return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + campo("campo-color-borde", "Color", '<input type="color" value="#b8741a">', true);
  }
  function opcBordes() {
    var b = IM.opcion("Borde") || "", c = IM.opcion("Color del borde") || "", e = IM.opcion("Esquinas") || "", s = IM.opcion("Sombra") || "";
    return {
      borde: /fino/i.test(b) ? .015 : /mediano/i.test(b) ? .03 : /grueso/i.test(b) ? .06 : 0,
      color: /Blanco/.test(c) ? "#ffffff" : /Negro/.test(c) ? "#000000" : /Gris/.test(c) ? "#9a9a9a" : ($("#campo-color-borde input") || {}).value || "#b8741a",
      radio: /rectas/i.test(e) ? 0 : /muy/i.test(e) ? .15 : /círculo/i.test(e) ? -1 : .06,
      sombra: /marcada/i.test(s) ? 2 : /suave/i.test(s) ? 1 : 0,
      blanco: /blanco/i.test(IM.opcion("Fuera de la imagen") || "")
    };
  }
  function componerBordes(img, o) {
    var w = img.width, h = img.height, sx = 0, sy = 0;
    if (o.radio < 0) {
      var l = Math.min(w, h);
      sx = (w - l) / 2;
      sy = (h - l) / 2;
      w = h = l;
    }
    var base0 = Math.min(w, h), bw = Math.round(base0 * o.borde), blur = o.sombra ? base0 * (o.sombra === 2 ? .05 : .03) : 0, dy = blur * .35, pad = o.sombra ? Math.ceil(blur * 1.6 + dy) : 0;
    var W = w + 2 * bw + 2 * pad, Hh = h + 2 * bw + 2 * pad, c = lienzo(W, Hh), g = c.getContext("2d");
    if (o.blanco) {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, W, Hh);
    }
    var forma = function(x, y, ww, hh, r) {
      g.beginPath();
      if (o.radio < 0) g.ellipse(x + ww / 2, y + hh / 2, ww / 2, hh / 2, 0, 0, Math.PI * 2); else if (r > 0 && g.roundRect) g.roundRect(x, y, ww, hh, r); else g.rect(x, y, ww, hh);
    };
    var R = o.radio > 0 ? base0 * o.radio + bw : 0;
    if (o.sombra) {
      g.save();
      g.shadowColor = "rgba(0,0,0," + (o.sombra === 2 ? .45 : .25) + ")";
      g.shadowBlur = blur;
      g.shadowOffsetY = dy;
      forma(pad, pad, w + 2 * bw, h + 2 * bw, R);
      g.fillStyle = bw ? o.color : "#ffffff";
      g.fill();
      g.restore();
    }
    if (bw) {
      forma(pad, pad, w + 2 * bw, h + 2 * bw, R);
      g.fillStyle = o.color;
      g.fill();
    }
    g.save();
    forma(pad + bw, pad + bw, w, h, Math.max(0, R - bw));
    g.clip();
    if (!bw && !o.blanco) g.clearRect(pad, pad, w, h);
    g.imageSmoothingQuality = "high";
    g.drawImage(img, sx, sy, w, h, pad + bw, pad + bw, w, h);
    g.restore();
    return c;
  }
  H["bordes-y-esquinas-redondeadas"] = {
    opcion: bordeOpc,
    montar: function(cont) {
      var v, url = null, tok = 0;
      var previa = debounce(function() {
        if (!v || !v.img) return;
        var t = ++tok, c = componerBordes(v.lienzo, opcBordes());
        aBlob(c).then(function(b) {
          if (t !== tok) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(b);
          var der = $(".visor-previa", cont);
          if (!der) {
            der = document.createElement("img");
            der.className = "visor-previa visor-previa-libre";
            der.alt = "";
            v.lienzo.parentNode.insertBefore(der, v.capa);
          }
          der.src = url;
          v.lienzo.style.visibility = "hidden";
        });
      }, 80);
      v = new Visor(cont, {
        alCambiar: previa,
        grilla: function(marco, f, img, c) {
          aBlob(componerBordes(c, opcBordes())).then(function(b) {
            var im = document.createElement("img");
            im.alt = "";
            im.src = URL.createObjectURL(b);
            im.onload = function() {
              setTimeout(function() {
                URL.revokeObjectURL(im.src);
              }, 1e3);
            };
            if (c.parentNode) c.replaceWith(im);
          });
        }
      });
      IM.alCambiarOpcion(function() {
        mostrarSi($("#campo-color-borde"), /elección/.test(IM.opcion("Color del borde") || ""));
        previa();
        v.refrescar();
      });
      var ci = $("#campo-color-borde input");
      if (ci) ci.addEventListener("input", function() {
        previa();
        v.refrescar();
      });
    },
    procesar: function() {
      var o = opcBordes();
      cadaImagen("Aplicando", function(f) {
        return IMMotor.bitmap(f).then(function(img) {
          return createImageBitmap(componerBordes(img, o));
        }).then(function(b) {
          return codificar(b, [], {
            formato: o.blanco ? "jpg" : "png",
            calidad: 92,
            fondo: "#ffffff"
          }, [ b ]);
        }).then(function(r) {
          return {
            nombre: base(f.name) + "-bordes." + (o.blanco ? "jpg" : "png"),
            blob: r.blob
          };
        });
      }, {
        nombreZip: "bordes.zip"
      });
    }
  };
  var R_PARTES = "Partes (columnas × filas)";
  function partesElegidas() {
    var v = IM.opcion(R_PARTES) || "", m = v.match(/(\d+)\s*×\s*(\d+)/);
    if (m) return [ +m[1], +m[2] ];
    var lim = function(id) {
      var i = $("#" + id + " input");
      return Math.max(1, Math.min(20, Math.round(num(i && i.value)) || 3));
    };
    return [ lim("campo-cols"), lim("campo-filas") ];
  }
  function lineasDivision(ancho, alto, dibujar) {
    var p = partesElegidas();
    for (var c = 1; c < p[0]; c++) dibujar(true, c / p[0]);
    for (var f = 1; f < p[1]; f++) dibujar(false, f / p[1]);
  }
  H["dividir-imagen"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo !== R_PARTES) return null;
      var n = function(id, rot) {
        return campo(id, rot, '<div class="paso-num"><input type="number" min="1" max="20" step="1" value="3" inputmode="numeric"><button type="button" class="paso" data-d="-1" aria-label="Menos">−</button><button type="button" class="paso" data-d="1" aria-label="Más">+</button></div>');
      };
      return ui.grupo(rotulo, valor.replace(/\.$/, "").split(" · ")) + '<div class="opc-medidas" id="campo-partes" hidden>' + n("campo-cols", "Columnas") + n("campo-filas", "Filas") + "</div>";
    },
    montar: function(cont) {
      var v, capa = document.createElement("div");
      capa.className = "div-lineas";
      var lineas = function() {
        if (!v || !v.img) return;
        if (capa.parentNode !== v.capa.parentNode) v.capa.parentNode.insertBefore(capa, v.capa);
        var html = "";
        lineasDivision(1, 1, function(vertical, x) {
          html += '<span class="div-linea ' + (vertical ? "v" : "h") + '" style="' + (vertical ? "left" : "top") + ":" + (x * 100).toFixed(3) + '%"></span>';
        });
        capa.innerHTML = html;
      };
      v = new Visor(cont, {
        alCambiar: lineas,
        grilla: function(marco, f, img, c) {
          var g = c.getContext("2d");
          g.save();
          g.lineWidth = Math.max(1, c.width / 300);
          lineasDivision(c.width, c.height, function(vertical, x) {
            g.beginPath();
            if (vertical) {
              g.moveTo(x * c.width, 0);
              g.lineTo(x * c.width, c.height);
            } else {
              g.moveTo(0, x * c.height);
              g.lineTo(c.width, x * c.height);
            }
            g.strokeStyle = "rgba(0,0,0,.45)";
            g.lineWidth = Math.max(2, c.width / 200);
            g.stroke();
            g.strokeStyle = "rgba(255,255,255,.95)";
            g.lineWidth = Math.max(1, c.width / 400);
            g.stroke();
          });
          g.restore();
        }
      });
      var medida = function() {
        mostrarSi($("#campo-partes"), /medida/i.test(IM.opcion(R_PARTES) || ""));
      };
      IM.alCambiarOpcion(function() {
        medida();
        lineas();
        v.refrescar();
      });
      $$("#campo-partes input").forEach(function(i) {
        i.addEventListener("input", function() {
          lineas();
          v.refrescar();
        });
      });
      $$("#campo-partes .paso").forEach(function(b) {
        b.addEventListener("click", function() {
          var i = b.parentNode.querySelector("input"), x = Math.round(num(i.value)) || 3;
          i.value = Math.max(1, Math.min(20, x + +b.dataset.d));
          i.dispatchEvent(new Event("input", {
            bubbles: true
          }));
        });
      });
      document.addEventListener("im-restablecer", function() {
        $$("#campo-partes input").forEach(function(i) {
          i.value = 3;
        });
        medida();
        lineas();
      });
      medida();
    },
    procesar: function() {
      var p = partesElegidas(), total = p[0] * p[1];
      cadaImagen("Dividiendo", function(f, i, av) {
        var fmt = U.formatoElegido("Formato", f), dig = String(total).length < 2 ? 2 : String(total).length;
        return IMMotor.bitmap(f).then(function(img) {
          var W = img.width, Hh = img.height, out = [], cadena = Promise.resolve(), k = 0;
          for (var fi = 0; fi < p[1]; fi++) for (var co = 0; co < p[0]; co++) (function(fi, co) {
            cadena = cadena.then(function() {
              var x0 = Math.round(co * W / p[0]), x1 = Math.round((co + 1) * W / p[0]), y0 = Math.round(fi * Hh / p[1]), y1 = Math.round((fi + 1) * Hh / p[1]);
              var n = ++k;
              av("Parte " + n + " de " + total + ".");
              return createImageBitmap(img, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).then(function(b) {
                return codificar(b, [], {
                  formato: fmt,
                  calidad: 92
                }, [ b ]);
              }).then(function(r) {
                out.push({
                  nombre: base(f.name) + "-" + ("000" + n).slice(-dig) + "." + fmt,
                  blob: r.blob,
                  nota: "Fila " + (fi + 1) + ", columna " + (co + 1) + "."
                });
              });
            });
          })(fi, co);
          return cadena.then(function() {
            return out;
          });
        });
      }, {
        nombreZip: "partes.zip"
      });
    }
  };
})();