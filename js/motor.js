(function() {
  "use strict";
  var BASE = document.currentScript && document.currentScript.src ? new URL("../", document.currentScript.src).href : new URL("./", document.baseURI).href;
  function formatoRaro(f) {
    return /\.(heic|heif|tiff?)$/i.test(f.name) || /heic|heif|tiff/i.test(f.type || "");
  }
  function esSvg(f) {
    return /\.svg$/i.test(f.name) || f.type === "image/svg+xml";
  }
  function extension(f) {
    var m = (f.name || "").match(/\.(\w+)$/);
    return m ? m[1].toLowerCase() : "";
  }
  function formatoOriginal(f) {
    var e = extension(f);
    if (e === "jpeg" || e === "jfif" || e === "jpg") return "jpg";
    if (e === "png" || e === "webp" || e === "avif") return e;
    if (e === "gif" || e === "bmp" || e === "svg" || e === "ico" || e === "tif" || e === "tiff") return "png";
    return "jpg";
  }
  var trabajador = null, pendientes = {}, sig = 1;
  function nuevoTrabajador() {
    trabajador = new Worker(BASE + "js/trabajador/trabajador.js", {
      type: "module"
    });
    trabajador.onmessage = function(e) {
      var m = e.data, p = pendientes[m.id];
      if (!p) return;
      if (m.avance) {
        if (p.avance) p.avance(m.avance[0], m.avance[1]);
        return;
      }
      delete pendientes[m.id];
      if (m.error) p.mal(m.error); else p.ok(m.ok);
    };
    trabajador.onerror = function(e) {
      if (trabajador) {
        try {
          trabajador.terminate();
        } catch (x) {}
        trabajador = null;
      }
      Object.keys(pendientes).forEach(function(k) {
        pendientes[k].mal({
          codigo: "error",
          detalle: e.message
        });
        delete pendientes[k];
      });
    };
  }
  var renovar = false;
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("controllerchange", function() {
    renovar = true;
  });
  function trabajar(msg, avance, transferir) {
    if (enCuadros && msg.op === "procesar" && msg.salida && msg.salida.formato === "png") msg.salida.calidad = -1;
    if (renovar && trabajador && !Object.keys(pendientes).length) {
      try {
        trabajador.terminate();
      } catch (x) {}
      trabajador = null;
    }
    if (renovar && !trabajador) renovar = false;
    if (!trabajador) nuevoTrabajador();
    return new Promise(function(ok, mal) {
      var id = sig++;
      msg.id = id;
      pendientes[id] = {
        ok: ok,
        mal: mal,
        avance: avance
      };
      trabajador.postMessage(msg, transferir || []);
    });
  }
  function cancelar() {
    if (trabajador) trabajador.terminate();
    trabajador = null;
    if (borrarPendiente) {
      if (trBorrar) trBorrar.terminate();
      trBorrar = null;
      var m = borrarPendiente;
      borrarPendiente = null;
      m({
        codigo: "cancelado"
      });
    }
    if (colorPendiente) {
      if (trColor) trColor.terminate();
      trColor = null;
      var mc = colorPendiente;
      colorPendiente = null;
      mc({
        codigo: "cancelado"
      });
    }
    Object.keys(pendientes).forEach(function(k) {
      pendientes[k].mal({
        codigo: "cancelado"
      });
      delete pendientes[k];
    });
  }
  function svgABitmap(f, lado) {
    return new Promise(function(ok, mal) {
      var url = URL.createObjectURL(f), im = new Image;
      im.onload = function() {
        var w = im.naturalWidth || 1024, h = im.naturalHeight || 1024, e = lado ? Math.min(1, lado / Math.max(w, h)) : Math.max(1, 1024 / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * e);
        c.height = Math.round(h * e);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        createImageBitmap(c).then(ok, mal);
      };
      im.onerror = function() {
        URL.revokeObjectURL(url);
        mal({
          codigo: "imagen",
          archivo: f.name
        });
      };
      im.src = url;
    });
  }
  var cacheBitmap = new WeakMap;
  var cuadroDe = new WeakMap, enCuadros = 0;
  function usarCuadro(f, bm) {
    if (bm) {
      cuadroDe.set(f, bm);
      enCuadros++;
    } else if (cuadroDe.has(f)) {
      cuadroDe.delete(f);
      enCuadros--;
    }
  }
  function esGifAnimado(f) {
    if (!/\.gif$/i.test(f.name || "") && f.type !== "image/gif") return Promise.resolve(false);
    return f.arrayBuffer().then(function(ab) {
      var b = new Uint8Array(ab), n = 0;
      for (var i = 0; i < b.length - 2 && n < 2; i++) if (b[i] === 33 && b[i + 1] === 249 && b[i + 2] === 4) n++;
      return n > 1;
    }, function() {
      return false;
    });
  }
  function cuadrosDeGif(f) {
    return Promise.all([ libVideo(), f.arrayBuffer() ]).then(function(r) {
      var lib = r[0], gif = lib.parseGIF(r[1]), fr = lib.decompressFrames(gif, true);
      if (!fr.length) throw {
        codigo: "imagen",
        archivo: f.name
      };
      var W = gif.lsd.width, Hh = gif.lsd.height, pant = document.createElement("canvas");
      pant.width = W;
      pant.height = Hh;
      var g = pant.getContext("2d", {
        willReadFrequently: true
      }), parche = document.createElement("canvas"), gp = parche.getContext("2d"), anterior = null, out = [], transparente = false;
      fr.forEach(function(x) {
        var d = x.dims;
        if (x.disposalType === 3) anterior = g.getImageData(0, 0, W, Hh);
        if (parche.width !== d.width || parche.height !== d.height) {
          parche.width = d.width;
          parche.height = d.height;
        }
        gp.putImageData(new ImageData(new Uint8ClampedArray(x.patch), d.width, d.height), 0, 0);
        g.drawImage(parche, d.left, d.top);
        var img = g.getImageData(0, 0, W, Hh);
        if (!transparente) for (var k = 3; k < img.data.length; k += 4 * 7) if (img.data[k] < 128) {
          transparente = true;
          break;
        }
        out.push({
          img: img,
          demora: x.delay && x.delay >= 20 ? x.delay : 100
        });
        if (x.disposalType === 2) g.clearRect(d.left, d.top, d.width, d.height); else if (x.disposalType === 3 && anterior) g.putImageData(anterior, 0, 0);
      });
      return {
        W: W,
        H: Hh,
        cuadros: out,
        transparente: transparente
      };
    });
  }
  function bitmap(f) {
    if (cuadroDe.has(f)) return createImageBitmap(cuadroDe.get(f));
    if (cacheBitmap.has(f)) return cacheBitmap.get(f);
    var p = esSvg(f) ? svgABitmap(f) : formatoRaro(f) ? trabajar({
      op: "abrir",
      fuente: f
    }).then(function(r) {
      return r.bitmap;
    }) : createImageBitmap(f, {
      imageOrientation: "from-image"
    }).catch(function() {
      throw {
        codigo: "imagen",
        archivo: f.name
      };
    });
    p = p.catch(function(e) {
      cacheBitmap.delete(f);
      throw e && e.codigo ? Object.assign({
        archivo: f.name
      }, e) : {
        codigo: "imagen",
        archivo: f.name
      };
    });
    cacheBitmap.set(f, p);
    return p;
  }
  function aCanvas(img, lado) {
    var e = lado ? Math.min(1, lado / Math.max(img.width, img.height)) : 1;
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * e));
    c.height = Math.max(1, Math.round(img.height * e));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  function miniatura(f, lado) {
    return bitmap(f).then(function(img) {
      return new Promise(function(ok) {
        aCanvas(img, lado * 2).toBlob(function(b) {
          ok(URL.createObjectURL(b));
        }, "image/png");
      });
    });
  }
  function fuente(f) {
    if (cuadroDe.has(f)) return createImageBitmap(cuadroDe.get(f));
    return esSvg(f) ? bitmap(f).then(function(b) {
      return createImageBitmap(b);
    }) : Promise.resolve(f);
  }
  var usarPlaca = null;
  function placa() {
    if (usarPlaca !== null) return Promise.resolve(usarPlaca);
    if (!navigator.gpu) {
      usarPlaca = false;
      return Promise.resolve(false);
    }
    return navigator.gpu.requestAdapter().then(function(a) {
      usarPlaca = !!a;
      return usarPlaca;
    }, function() {
      usarPlaca = false;
      return false;
    });
  }
  var modFondo = null;
  function libFondo() {
    return modFondo || (modFondo = import(BASE + "vendor/isnet/fondo.mjs").catch(function(e) {
      modFondo = null;
      throw e;
    }));
  }
  function errorFondo(e) {
    if (e && e.codigo) return e;
    var s = String(e && e.message || e);
    return {
      codigo: /fetch|load|session|onnx|wasm/i.test(s) ? "modelo" : /memory|allocate|OOM/i.test(s) ? "memoria" : "error",
      detalle: s
    };
  }
  function opcionesFondo(calidad, alAvance, que) {
    return placa().then(function(gpu) {
      return {
        calidad: calidad,
        gpu: gpu,
        que: que || "principal",
        alAvance: function(a, t) {
          if (alAvance && t) alAvance(a, t);
        }
      };
    });
  }
  function quitarFondo(f, calidad, alAvance, que) {
    return Promise.all([ libFondo(), opcionesFondo(calidad, alAvance, que), bitmap(f) ]).then(function(r) {
      return r[0].quitarFondo(r[2], r[1]);
    }).catch(function(e) {
      throw errorFondo(e);
    });
  }
  function mascara(f, calidad, alAvance, que) {
    return Promise.all([ libFondo(), opcionesFondo(calidad, alAvance, que), bitmap(f) ]).then(function(r) {
      return r[0].mascara(r[2], r[1]);
    }).catch(function(e) {
      throw errorFondo(e);
    });
  }
  var carasHechas = {};
  function caras(f, alAvance) {
    var k = f.name + "|" + f.size + "|" + f.lastModified;
    if (carasHechas[k]) return carasHechas[k];
    return carasHechas[k] = Promise.all([ libFondo(), bitmap(f) ]).then(function(r) {
      return r[0].caras(r[1], {
        alAvance: function(a, t) {
          if (alAvance && t) alAvance(a, t);
        }
      });
    }).catch(function(e) {
      delete carasHechas[k];
      throw errorFondo(e);
    });
  }
  var trBorrar = null;
  function borrar(fuente, mascaraL, alAvance) {
    return Promise.all([ createImageBitmap(fuente), createImageBitmap(mascaraL) ]).then(function(bs) {
      return new Promise(function(ok, mal) {
        if (!trBorrar) trBorrar = new Worker(BASE + "vendor/isnet/borrar-tr.mjs", {
          type: "module"
        });
        var tr = trBorrar;
        tr.onmessage = function(e) {
          var d = e.data || {};
          if (d.tipo === "avance") {
            if (alAvance && d.t) alAvance(d.a, d.t);
            return;
          }
          if (d.tipo === "listo") ok(d.b); else mal(errorFondo(d.detalle));
        };
        tr.onerror = function(e) {
          trBorrar = null;
          mal(errorFondo(e && e.message || "worker"));
        };
        borrarPendiente = mal;
        tr.postMessage({
          img: bs[0],
          mascara: bs[1]
        }, [ bs[0], bs[1] ]);
      }).then(function(b) {
        borrarPendiente = null;
        return b;
      }, function(e) {
        borrarPendiente = null;
        throw e;
      });
    });
  }
  var borrarPendiente = null;
  var trColor = null, colorPendiente = null;
  function colorear(fuente, alAvance) {
    return createImageBitmap(fuente).then(function(b) {
      return new Promise(function(ok, mal) {
        if (!trColor) trColor = new Worker(BASE + "vendor/isnet/colorear-tr.mjs", {
          type: "module"
        });
        var tr = trColor;
        tr.onmessage = function(e) {
          var d = e.data || {};
          if (d.tipo === "avance") {
            if (alAvance && d.t) alAvance(d.a, d.t);
            return;
          }
          if (d.tipo === "listo") ok(d.b); else mal(errorFondo(d.detalle));
        };
        tr.onerror = function(e) {
          trColor = null;
          mal(errorFondo(e && e.message || "worker"));
        };
        colorPendiente = mal;
        tr.postMessage({
          img: b
        }, [ b ]);
      }).then(function(r) {
        colorPendiente = null;
        return r;
      }, function(e) {
        colorPendiente = null;
        throw e;
      });
    });
  }
  var modVideo = null;
  function libVideo() {
    return modVideo || (modVideo = import(BASE + "vendor/video/video.mjs").catch(function(e) {
      modVideo = null;
      throw e;
    }));
  }
  var modIa = null;
  function libIa() {
    return modIa || (modIa = import(BASE + "vendor/ia/ia.mjs").catch(function(e) {
      modIa = null;
      throw e;
    }));
  }
  function mejorar(clave, f, alAvance, cancelado) {
    return Promise.all([ libIa(), bitmap(f) ]).then(function(r) {
      var ia = r[0], img = r[1];
      return ia.upscaler(clave, BASE + "vendor/ia/modelos/").then(function(u) {
        var c = aCanvas(img);
        return u.execute(c, {
          patchSize: 128,
          padding: 6,
          output: "tensor",
          awaitNextFrame: true,
          progress: function(p) {
            if (alAvance) alAvance(p);
            if (cancelado && cancelado()) u.abort();
          }
        }).then(function(t) {
          var h = t.shape[0], w = t.shape[1], out = document.createElement("canvas");
          out.width = w;
          out.height = h;
          return ia.tf.browser.toPixels(ia.tf.tidy(function() {
            return t.div(255).clipByValue(0, 1);
          }), out).then(function() {
            t.dispose();
            return out;
          });
        });
      });
    }).catch(function(e) {
      if (e && e.codigo) throw e;
      var s = String(e && e.message || e);
      throw {
        codigo: /abort/i.test(s) ? "cancelado" : /memory|OOM|allocate/i.test(s) ? "memoria" : /fetch|load|model/i.test(s) ? "modelo" : "error",
        detalle: s
      };
    });
  }
  var IDIOMAS = {
    "Español": "spa",
    "Inglés": "eng",
    "Portugués": "por",
    "Francés": "fra",
    Italiano: "ita",
    "Alemán": "deu",
    "Catalán": "cat",
    "Neerlandés": "nld",
    Polaco: "pol",
    Rumano: "ron",
    Ruso: "rus",
    Ucraniano: "ukr",
    Griego: "ell",
    "Árabe": "ara",
    Hebreo: "heb",
    Hindi: "hin",
    "Chino simplificado": "chi_sim",
    "Chino tradicional": "chi_tra",
    "Japonés": "jpn",
    Coreano: "kor"
  };
  var modOcr = null, ocrIdiomas = "", ocrTrabajador = null;
  function libOcr() {
    return modOcr || (modOcr = new Promise(function(ok, mal) {
      if (window.Tesseract) return ok(window.Tesseract);
      var s = document.createElement("script");
      s.src = BASE + "vendor/tesseract/tesseract.min.js";
      s.onload = function() {
        ok(window.Tesseract);
      };
      s.onerror = function() {
        modOcr = null;
        mal({
          codigo: "modelo"
        });
      };
      document.head.appendChild(s);
    }));
  }
  function lectorOcr(codigos, alAvance) {
    var clave = codigos.join("+");
    if (ocrTrabajador && ocrIdiomas === clave) return Promise.resolve(ocrTrabajador);
    return libOcr().then(function(T) {
      var previo = ocrTrabajador ? ocrTrabajador.terminate() : Promise.resolve();
      ocrTrabajador = null;
      return previo.then(function() {
        return T.createWorker(codigos, 1, {
          workerPath: BASE + "vendor/tesseract/worker.min.js",
          corePath: BASE + "vendor/tesseract/core/",
          langPath: BASE + "vendor/tesseract/idiomas/",
          logger: function(m) {
            if (alAvance) alAvance(m);
          }
        });
      }).then(function(w) {
        ocrTrabajador = w;
        ocrIdiomas = clave;
        return w;
      });
    }).catch(function(e) {
      throw e && e.codigo ? e : {
        codigo: "idioma-ocr",
        detalle: String(e && e.message || e)
      };
    });
  }
  function leerTexto(f, codigos, alAvance) {
    var actual = null;
    return lectorOcr(codigos, function(m) {
      actual = m;
      if (alAvance) alAvance(m);
    }).then(function(w) {
      return bitmap(f).then(function(img) {
        return w.recognize(aCanvas(img), {}, {
          blocks: true
        });
      });
    }).then(function(r) {
      return r.data;
    });
  }
  function soltarOcr() {
    if (ocrTrabajador) {
      ocrTrabajador.terminate();
      ocrTrabajador = null;
      ocrIdiomas = "";
    }
  }
  window.IMMotor = {
    BASE: BASE,
    formatoRaro: formatoRaro,
    esSvg: esSvg,
    formatoOriginal: formatoOriginal,
    bitmap: bitmap,
    aCanvas: aCanvas,
    miniatura: miniatura,
    fuente: fuente,
    usarCuadro: usarCuadro,
    esGifAnimado: esGifAnimado,
    cuadrosDeGif: cuadrosDeGif,
    trabajar: trabajar,
    cancelar: cancelar,
    placa: placa,
    quitarFondo: quitarFondo,
    mascara: mascara,
    mejorar: mejorar,
    caras: caras,
    borrar: borrar,
    colorear: colorear,
    libVideo: libVideo,
    IDIOMAS: IDIOMAS,
    leerTexto: leerTexto,
    soltarOcr: soltarOcr
  };
})();