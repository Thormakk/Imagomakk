(function() {
  "use strict";
  var H = window.IMHerramientas, U = H._util;
  var $ = U.$, $$ = U.$$, esc = U.esc, base = U.base, campo = U.campo, mostrarSi = U.mostrarSi;
  var MM = 72 / 25.4, PX = 72 / 96;
  var HOJAS = {
    A4: [ 595.28, 841.89 ],
    Carta: [ 612, 792 ],
    Oficio: [ 612, 1008 ]
  };
  function encajar(w, h, cw, ch) {
    var e = Math.min(cw / w, ch / h);
    return {
      w: w * e,
      h: h * e,
      e: e
    };
  }
  function aBlob(c, tipo, q) {
    return new Promise(function(ok, mal) {
      c.toBlob(function(b) {
        if (b) ok(b); else mal({
          codigo: "memoria"
        });
      }, tipo, q);
    });
  }
  var enc = new TextEncoder;
  function armarPdf(hojas) {
    var partes = [], pos = 0, offs = [], n = 0, imgsHechas = new Map;
    var escribir = function(x) {
      var b = typeof x === "string" ? enc.encode(x) : x;
      partes.push(b);
      pos += b.length;
    };
    var nuevo = function() {
      return ++n;
    };
    var objeto = function(num, dic, flujo) {
      offs[num] = pos;
      if (flujo) {
        escribir(num + " 0 obj\n" + dic.replace(/>>$/, "/Length " + flujo.length + ">>") + "\nstream\n");
        escribir(flujo);
        escribir("\nendstream\nendobj\n");
      } else escribir(num + " 0 obj\n" + dic + "\nendobj\n");
    };
    escribir("%PDF-1.4\n%âãÏÓ\n".replace(/[\xE2\xE3\xCF\xD3]/g, "~"));
    var catalogo = nuevo(), paginas = nuevo(), kids = [];
    hojas.forEach(function(hj) {
      var pag = nuevo(), cont = nuevo(), recursos = [], cuerpo = "";
      hj.piezas.forEach(function(pz) {
        var im = pz.img, num = imgsHechas.get(im);
        if (!num) {
          num = nuevo();
          var sm = null;
          if (im.smask) {
            sm = nuevo();
            objeto(sm, "<</Type/XObject/Subtype/Image/Width " + im.smask.w + "/Height " + im.smask.h + "/ColorSpace/DeviceGray/BitsPerComponent 8/Filter/FlateDecode>>", im.smask.bytes);
          }
          objeto(num, "<</Type/XObject/Subtype/Image/Width " + im.w + "/Height " + im.h + "/ColorSpace/" + im.cs + "/BitsPerComponent 8/Filter/" + im.filtro + (im.decode ? "/Decode[" + im.decode + "]" : "") + (sm ? "/SMask " + sm + " 0 R" : "") + ">>", im.bytes);
          imgsHechas.set(im, num);
        }
        var nom = "Im" + num;
        if (recursos.indexOf(nom) < 0) recursos.push(nom);
        var d = pz.dst.map(function(v) {
          return +v.toFixed(3);
        }), x = d[0], y = d[1], w = d[2], h = d[3], m;
        if (im.rot === 90) m = [ 0, -h, w, 0, x, y + h ]; else if (im.rot === 270) m = [ 0, h, -w, 0, x + w, y ]; else if (im.rot === 180) m = [ -w, 0, 0, -h, x + w, y + h ]; else m = [ w, 0, 0, h, x, y ];
        cuerpo += "q " + m.map(function(v) {
          return +(+v).toFixed(3);
        }).join(" ") + " cm /" + nom + " Do Q\n";
      });
      objeto(cont, "<<>>", enc.encode(cuerpo));
      objeto(pag, "<</Type/Page/Parent " + paginas + " 0 R/MediaBox[0 0 " + +hj.ancho.toFixed(3) + " " + +hj.alto.toFixed(3) + "]/Resources<</XObject<<" + recursos.map(function(r) {
        return "/" + r + " " + r.slice(2) + " 0 R";
      }).join("") + ">>>>/Contents " + cont + " 0 R>>");
      kids.push(pag);
    });
    objeto(paginas, "<</Type/Pages/Kids[" + kids.map(function(k) {
      return k + " 0 R";
    }).join(" ") + "]/Count " + kids.length + ">>");
    objeto(catalogo, "<</Type/Catalog/Pages " + paginas + " 0 R>>");
    var xref = pos, t = "xref\n0 " + (n + 1) + "\n0000000000 65535 f \n";
    for (var i = 1; i <= n; i++) t += String(offs[i]).padStart(10, "0") + " 00000 n \n";
    escribir(t + "trailer\n<</Size " + (n + 1) + "/Root " + catalogo + " 0 R>>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(partes, {
      type: "application/pdf"
    });
  }
  function leerJpg(b) {
    if (b[0] !== 255 || b[1] !== 216) return null;
    var i = 2, r = {
      rot: 0,
      adobe: false,
      espejo: false
    };
    while (i + 4 < b.length) {
      if (b[i] !== 255) {
        i++;
        continue;
      }
      var m = b[i + 1], largo = b[i + 2] << 8 | b[i + 3];
      if (m === 216 || m === 1 || m >= 208 && m <= 215) {
        i += 2;
        continue;
      }
      if (m === 238 && b[i + 4] === 65 && b[i + 5] === 100) r.adobe = true;
      if (m === 225 && b[i + 4] === 69 && b[i + 5] === 120 && b[i + 6] === 105 && b[i + 7] === 102) {
        var o = leerOrientacion(b, i + 10, largo - 8);
        if (o) r.orient = o;
      }
      if (m >= 192 && m <= 207 && m !== 196 && m !== 200 && m !== 204) {
        if (b[i + 4] !== 8) return null;
        r.h = b[i + 5] << 8 | b[i + 6];
        r.w = b[i + 7] << 8 | b[i + 8];
        r.comp = b[i + 9];
        break;
      }
      if (m === 218 || m === 217) break;
      i += 2 + largo;
    }
    if (!r.w || !r.h || [ 1, 3, 4 ].indexOf(r.comp) < 0) return null;
    var o2 = r.orient || 1;
    if (o2 === 3) r.rot = 180; else if (o2 === 6) r.rot = 90; else if (o2 === 8) r.rot = 270; else if (o2 !== 1) return null;
    return r;
  }
  function leerOrientacion(b, ini, largo) {
    try {
      var le = b[ini] === 73, u16 = function(p) {
        return le ? b[p] | b[p + 1] << 8 : b[p] << 8 | b[p + 1];
      };
      var u32 = function(p) {
        return le ? (b[p] | b[p + 1] << 8 | b[p + 2] << 16 | b[p + 3] << 24) >>> 0 : (b[p] << 24 | b[p + 1] << 16 | b[p + 2] << 8 | b[p + 3]) >>> 0;
      };
      var ifd = ini + u32(ini + 4), n = u16(ifd);
      for (var k = 0; k < n; k++) {
        var e = ifd + 2 + k * 12;
        if (e + 12 > ini + largo) break;
        if (u16(e) === 274) return u16(e + 8);
      }
    } catch (x) {}
    return 0;
  }
  function imagenPdf(f, reducir, q) {
    return f.arrayBuffer().then(function(ab) {
      var b = new Uint8Array(ab), j = reducir ? null : leerJpg(b);
      if (j) {
        var r = j.rot === 90 || j.rot === 270, im = {
          w: j.w,
          h: j.h,
          cs: {
            1: "DeviceGray",
            3: "DeviceRGB",
            4: "DeviceCMYK"
          }[j.comp],
          filtro: "DCTDecode",
          bytes: b,
          rot: j.rot
        };
        if (j.comp === 4 && j.adobe) im.decode = "1 0 1 0 1 0 1 0";
        return {
          img: im,
          pw: (r ? j.h : j.w) * PX,
          ph: (r ? j.w : j.h) * PX
        };
      }
      return IMMotor.bitmap(f).then(function(bm) {
        var e = reducir ? Math.min(1, 2400 / Math.max(bm.width, bm.height)) : 1, w = Math.max(1, Math.round(bm.width * e)), h = Math.max(1, Math.round(bm.height * e));
        var c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        var x = c.getContext("2d");
        var medida = {
          pw: bm.width * PX,
          ph: bm.height * PX
        };
        if (reducir) {
          x.fillStyle = "#fff";
          x.fillRect(0, 0, w, h);
          x.drawImage(bm, 0, 0, w, h);
          return aBlob(c, "image/jpeg", q).then(function(bl) {
            c.width = c.height = 0;
            return bl.arrayBuffer();
          }).then(function(jb) {
            return {
              img: {
                w: w,
                h: h,
                cs: "DeviceRGB",
                filtro: "DCTDecode",
                bytes: new Uint8Array(jb),
                rot: 0
              },
              pw: medida.pw,
              ph: medida.ph
            };
          });
        }
        x.drawImage(bm, 0, 0, w, h);
        var d = x.getImageData(0, 0, w, h).data, n = w * h, rgb = new Uint8Array(n * 3), alfa = null;
        for (var i = 0, k = 0; i < n; i++, k += 4) {
          rgb[i * 3] = d[k];
          rgb[i * 3 + 1] = d[k + 1];
          rgb[i * 3 + 2] = d[k + 2];
          if (d[k + 3] !== 255 && !alfa) alfa = true;
        }
        var im2 = {
          w: w,
          h: h,
          cs: "DeviceRGB",
          filtro: "FlateDecode",
          bytes: fflate.zlibSync(rgb, {
            level: 6
          }),
          rot: 0
        };
        if (alfa) {
          var a = new Uint8Array(n);
          for (var i2 = 0; i2 < n; i2++) a[i2] = d[i2 * 4 + 3];
          im2.smask = {
            w: w,
            h: h,
            bytes: fflate.zlibSync(a, {
              level: 6
            })
          };
        }
        c.width = c.height = 0;
        return {
          img: im2,
          pw: medida.pw,
          ph: medida.ph
        };
      });
    });
  }
  function medidaDe(f) {
    return f.slice(0, 262144).arrayBuffer().then(function(ab) {
      var j = leerJpg(new Uint8Array(ab));
      if (j) {
        var r = j.rot === 90 || j.rot === 270;
        return {
          w: (r ? j.h : j.w) * PX,
          h: (r ? j.w : j.h) * PX
        };
      }
      return IMMotor.bitmap(f).then(function(bm) {
        return {
          w: bm.width * PX,
          h: bm.height * PX
        };
      });
    });
  }
  function pintarHojas(cont, plan, dibujar, rotulos) {
    cont.innerHTML = "";
    plan.slice(0, 60).forEach(function(hj, i) {
      var fig = document.createElement("figure"), c = document.createElement("canvas"), e = 150 / hj.ancho;
      if (hj.alto * e > 600) e = 600 / hj.alto;
      c.width = Math.round(hj.ancho * e * 2);
      c.height = Math.round(hj.alto * e * 2);
      c.style.width = hj.ancho * e + "px";
      var x = c.getContext("2d"), k = e * 2;
      x.fillStyle = "#fff";
      x.fillRect(0, 0, c.width, c.height);
      fig.appendChild(c);
      var cap = document.createElement("figcaption");
      cap.textContent = i + 1;
      fig.appendChild(cap);
      cont.appendChild(fig);
      (rotulos ? rotulos(hj, i) : []).forEach(function(t) {
        var s = document.createElement("span");
        s.className = "aj-rotulo";
        s.textContent = t;
        cap.appendChild(document.createTextNode(" · "));
        cap.appendChild(s);
      });
      hj.piezas.forEach(function(pz) {
        dibujar(pz).then(function(src) {
          if (src && c.isConnected !== false) x.drawImage(src, pz.dst[0] * k, c.height - (pz.dst[1] + pz.dst[3]) * k, pz.dst[2] * k, pz.dst[3] * k);
        });
      });
    });
  }
  var miniCache = new WeakMap;
  function miniDe(f) {
    if (!miniCache.has(f)) miniCache.set(f, IMMotor.bitmap(f).then(function(bm) {
      var e = Math.min(1, 700 / Math.max(bm.width, bm.height)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bm.width * e));
      c.height = Math.max(1, Math.round(bm.height * e));
      c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
      return c;
    }, function() {
      return null;
    }));
    return miniCache.get(f);
  }
  H["imagen-a-pdf"] = {
    opcion: function(rotulo, valor, ui) {
      if (rotulo === "Orden") return "";
      if (rotulo === "Calidad") return ui.grupo("Calidad", [ "Original", "Reducir el peso" ]) + campo("campo-calidad", "Calidad", '<input type="range" min="35" max="95" value="70" data-c2="calidad">', true);
      return null;
    },
    montar: function(cont) {
      var self = this;
      this.medidas = new WeakMap;
      this.tok = 0;
      cont.innerHTML = '<div class="hj-caja"><p class="aj-resumen" aria-live="polite"></p><div class="aj-hojas"></div></div>';
      this.c = cont.firstChild;
      IM.suavizarAlto(this.c);
      var recargar = function() {
        var arch = IM.archivos(), t = ++self.tok;
        Promise.all(arch.map(function(a) {
          if (self.medidas.has(a.file)) return null;
          return medidaDe(a.file).then(function(m) {
            self.medidas.set(a.file, m);
          }, function() {
            self.medidas.set(a.file, null);
          });
        })).then(function() {
          if (t === self.tok) self.pintar();
        });
      };
      IM.alCambiarArchivos(recargar);
      IM.alCambiarOpcion(function() {
        mostrarSi($("#campo-calidad"), /^Reducir/.test(IM.opcion("Calidad") || ""));
        self.pintar();
      });
      recargar();
    },
    plan: function() {
      var self = this, it = IM.archivos().map(function(a, f) {
        return {
          a: a,
          f: f,
          m: self.medidas.get(a.file)
        };
      }).filter(function(x) {
        return x.m;
      }), out = [];
      var hoja = HOJAS[IM.opcion("Tamaño de hoja") || ""], or = IM.opcion("Orientación") || "";
      var marg = {
        "Sin margen": 0,
        Chico: 18,
        Grande: 54
      }[IM.opcion("Margen") || "Sin margen"] || 0, varias = /^Varias/.test(IM.opcion("Imágenes por hoja") || "");
      var apaisada = function(m) {
        return /verticales/.test(or) ? false : /horizontales/.test(or) ? true : m.w > m.h;
      };
      var hojaPara = function(x) {
        var m = x.m;
        if (!hoja) {
          var W = m.w + 2 * marg, Hh = m.h + 2 * marg;
          if (/verticales/.test(or) && W > Hh || /horizontales/.test(or) && Hh > W) {
            var t = W;
            W = Hh;
            Hh = t;
          }
          return [ W, Hh ];
        }
        return apaisada(m) ? [ hoja[1], hoja[0] ] : [ hoja[0], hoja[1] ];
      };
      var grupo = function(lista) {
        var d = hojaPara(lista[0]), cols = lista.length > 1 ? 2 : 1, filas = lista.length > 2 ? 2 : lista.length > 1 && d[0] <= d[1] ? 2 : 1;
        if (lista.length === 2 && d[0] > d[1]) cols = 2;
        if (lista.length === 2 && d[0] <= d[1]) cols = 1;
        var cw = (d[0] - 2 * marg) / cols, ch = (d[1] - 2 * marg) / filas, hj = {
          ancho: d[0],
          alto: d[1],
          piezas: []
        };
        if (!/verticales|horizontales/.test(or) && d[0] > d[1]) hj.rotulo = "Apaisada";
        lista.forEach(function(x, k) {
          var c = k % cols, r = Math.floor(k / cols), e = encajar(x.m.w, x.m.h, cw - (cols > 1 ? 6 : 0), ch - (filas > 1 ? 6 : 0));
          hj.piezas.push({
            x: x,
            f: x.f,
            dst: [ marg + c * cw + (cw - e.w) / 2, d[1] - marg - (r + 1) * ch + (ch - e.h) / 2, e.w, e.h ]
          });
        });
        return hj;
      };
      if (varias) {
        for (var i = 0; i < it.length; i += 4) out.push(grupo(it.slice(i, i + 4)));
      } else it.forEach(function(x) {
        out.push(grupo([ x ]));
      });
      return out;
    },
    pintar: function() {
      var plan = this.plan(), n = IM.archivos().length;
      IM.mostrarOpcion("Resultado", n > 1);
      IM.botonHabilitado(plan.length > 0);
      $(".aj-resumen", this.c).textContent = plan.length ? plan.length === 1 ? "1 hoja." : plan.length + " hojas." : "";
      pintarHojas($(".aj-hojas", this.c), plan, function(pz) {
        return miniDe(pz.x.a.file);
      }, function(hj) {
        return hj.rotulo ? [ hj.rotulo ] : [];
      });
    },
    procesar: function() {
      var plan = this.plan(), arch = IM.archivos();
      if (!plan.length) return;
      var porImagen = arch.length > 1 && /^Un PDF por/.test(IM.opcion("Resultado") || "");
      var reducir = /^Reducir/.test(IM.opcion("Calidad") || ""), cq = $('.h-opciones [data-c2="calidad"]'), q = (cq && +cq.value || 70) / 100;
      return IM.procesar({
        textoInicial: "Creando el PDF…",
        zip: true,
        nombreZip: arch.length + "-pdf.zip",
        preparar: function(av, cancelado) {
          var hechas = {}, cad = Promise.resolve();
          arch.forEach(function(a, i) {
            cad = cad.then(function() {
              if (cancelado()) throw {
                codigo: "cancelado"
              };
              av("Creando el PDF…" + (arch.length > 1 ? " Imagen " + (i + 1) + " de " + arch.length + "." : ""));
              return imagenPdf(a.file, reducir, q).then(function(r) {
                hechas[i] = r.img;
              }, function(e) {
                throw {
                  codigo: e && e.codigo || "imagen",
                  archivo: a.file.name
                };
              });
            });
          });
          return cad.then(function() {
            var hoja = function(h) {
              return {
                ancho: h.ancho,
                alto: h.alto,
                piezas: h.piezas.map(function(p) {
                  return {
                    img: hechas[p.f],
                    dst: p.dst
                  };
                })
              };
            };
            if (porImagen) return {
              listos: arch.map(function(a, f) {
                return {
                  nombre: base(a.file.name) + ".pdf",
                  blob: armarPdf(plan.filter(function(h) {
                    return h.piezas.some(function(p) {
                      return p.f === f;
                    });
                  }).map(hoja)),
                  origen: a.id
                };
              })
            };
            return {
              listos: [ {
                nombre: arch.length > 1 ? arch.length + "-imagenes.pdf" : base(arch[0].file.name) + ".pdf",
                blob: armarPdf(plan.map(hoja))
              } ]
            };
          });
        }
      });
    }
  };
  function letraGrupo(n) {
    var r = "";
    n++;
    while (n > 0) {
      n--;
      r = String.fromCharCode(65 + n % 26) + r;
      n = Math.floor(n / 26);
    }
    return r;
  }
  var MEDIDAS_DOC = {
    tarjeta: [ 85.6, 54 ],
    pasaporte: [ 125, 88 ]
  };
  function analizarFoto(img) {
    var e = Math.min(1, 420 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * e)), h = Math.max(1, Math.round(img.height * e));
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var x = c.getContext("2d");
    x.drawImage(img, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, borde = [];
    for (var k = 0; k < w; k += 3) {
      borde.push(k, k + (h - 1) * w);
    }
    for (var y = 0; y < h; y += 3) {
      borde.push(y * w, y * w + w - 1);
    }
    var med = [ 0, 1, 2 ].map(function(cn) {
      var v = borde.map(function(i) {
        return d[i * 4 + cn];
      }).sort(function(a, b) {
        return a - b;
      });
      return v[v.length >> 1];
    });
    var pts = [];
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      var i = (yy * w + xx) * 4;
      if (Math.abs(d[i] - med[0]) + Math.abs(d[i + 1] - med[1]) + Math.abs(d[i + 2] - med[2]) > 60) pts.push(xx - w / 2, yy - h / 2);
    }
    if (pts.length < w * h * .05) return {
      ang: 0,
      rect: [ 0, 0, 1, 1 ]
    };
    var mejor = null;
    var angulos = [];
    for (var a0 = -12; a0 <= 12; a0 += .5) angulos.push(a0);
    var paso = Math.max(1, Math.ceil(pts.length / 2 / 2e4)), n = Math.floor(pts.length / 2 / paso), px = new Float32Array(n), py = new Float32Array(n);
    for (var z = 0; z < n; z++) {
      px[z] = pts[z * paso * 2];
      py[z] = pts[z * paso * 2 + 1];
    }
    var xs = new Float32Array(n), ys = new Float32Array(n);
    var probar = function(a) {
      var t = a * Math.PI / 180, co = Math.cos(t), si = Math.sin(t);
      for (var j = 0; j < n; j++) {
        xs[j] = px[j] * co - py[j] * si;
        ys[j] = px[j] * si + py[j] * co;
      }
      xs.sort();
      ys.sort();
      var q = Math.floor(xs.length * .01), x0 = xs[q], x1 = xs[xs.length - 1 - q], y0 = ys[q], y1 = ys[ys.length - 1 - q], area = (x1 - x0) * (y1 - y0);
      if (!mejor || area < mejor.area) mejor = {
        area: area,
        ang: a,
        x0: x0,
        x1: x1,
        y0: y0,
        y1: y1
      };
    };
    angulos.forEach(probar);
    var base0 = mejor.ang;
    for (var a1 = -.4; a1 <= .41; a1 += .1) if (Math.abs(a1) > .05) probar(Math.round((base0 + a1) * 10) / 10);
    var t2 = mejor.ang * Math.PI / 180, W = w * Math.abs(Math.cos(t2)) + h * Math.abs(Math.sin(t2)), Hh = w * Math.abs(Math.sin(t2)) + h * Math.abs(Math.cos(t2)), m = -.004;
    return {
      ang: mejor.ang,
      rect: [ Math.max(0, (mejor.x0 + W / 2) / W - m), Math.max(0, (mejor.y0 + Hh / 2) / Hh - m), Math.min(1, (mejor.x1 - mejor.x0) / W + 2 * m), Math.min(1, (mejor.y1 - mejor.y0) / Hh + 2 * m) ]
    };
  }
  function enderezarFoto(img, ang, maxLado) {
    var t = ang * Math.PI / 180, W = img.width * Math.abs(Math.cos(t)) + img.height * Math.abs(Math.sin(t)), Hh = img.width * Math.abs(Math.sin(t)) + img.height * Math.abs(Math.cos(t));
    var e = Math.min(1, (maxLado || 1e9) / Math.max(W, Hh)), c = document.createElement("canvas");
    c.width = Math.round(W * e);
    c.height = Math.round(Hh * e);
    var x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.translate(c.width / 2, c.height / 2);
    x.rotate(t);
    x.scale(e, e);
    x.drawImage(img, -img.width / 2, -img.height / 2);
    return c;
  }
  function jpgConPpp(blob) {
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
  function pngConPpp(blob) {
    return blob.arrayBuffer().then(function(buf) {
      var b = new Uint8Array(buf), fin = 8 + 8 + 13 + 4, ch = new Uint8Array(21), dv = new DataView(ch.buffer);
      dv.setUint32(0, 9);
      ch.set([ 112, 72, 89, 115 ], 4);
      dv.setUint32(8, 11811);
      dv.setUint32(12, 11811);
      ch[16] = 1;
      dv.setUint32(17, crc32(ch.subarray(4, 17)));
      return new Blob([ b.subarray(0, fin), ch, b.subarray(fin) ], {
        type: "image/png"
      });
    });
  }
  var TABLA_CRC = null;
  function crc32(d) {
    if (!TABLA_CRC) {
      TABLA_CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        TABLA_CRC[n] = c >>> 0;
      }
    }
    var r = 4294967295;
    for (var i = 0; i < d.length; i++) r = TABLA_CRC[(r ^ d[i]) & 255] ^ r >>> 8;
    return (r ^ 4294967295) >>> 0;
  }
  var doc = H["documento-de-identidad-en-una-hoja"] = {
    conPrevia: true,
    opcion: function(rotulo, valor, ui) {
      if (rotulo === "Tipo de documento") return ui.grupo("Tipo de documento", [ "Tarjeta (como un documento de identidad o una licencia de conducir)", "Pasaporte (página de datos)", "Otro: indicás las medidas de tu documento" ]) + '<div class="opc-medidas" id="doc-mm" hidden>' + campo("doc-mm-ancho", "Ancho (mm)", '<input type="number" min="10" max="300" step="any" value="100" data-d="ancho">') + campo("doc-mm-alto", "Alto (mm)", '<input type="number" min="10" max="300" step="any" value="70" data-d="alto">') + "</div>";
      if (rotulo === "Tamaño en la hoja") return ui.grupo("Tamaño en la hoja", [ "Real", "Ampliado (para que se lea mejor)" ]);
      return null;
    },
    montar: function(cont) {
      var self = this;
      this.fotos = {};
      this.solos = {};
      cont.innerHTML = '<div class="hj-caja"><p class="doc-ayuda">Cada grupo toma dos archivos seguidos y los pone juntos. Para cambiar un grupo, arrastrá los archivos.</p><div class="doc-recortes"></div><p class="aj-resumen" aria-live="polite"></p><div class="aj-hojas"></div></div>';
      this.c = cont.firstChild;
      IM.suavizarAlto(this.c);
      var recargar = function() {
        var cadena = Promise.resolve(), listo;
        IM.esperarPrevia(new Promise(function(r) {
          listo = r;
        }));
        IM.archivos().forEach(function(a) {
          if (a.id in self.fotos) return;
          cadena = cadena.then(function() {
            return new Promise(function(r) {
              setTimeout(r, 0);
            });
          }).then(function() {
            return IMMotor.bitmap(a.file).then(function(img) {
              var an = analizarFoto(img);
              self.fotos[a.id] = {
                img: img,
                ang: an.ang,
                rect: an.rect,
                auto: an
              };
            }, function(e) {
              self.fotos[a.id] = null;
              IM.aviso(IM.textoError({
                codigo: e && e.codigo || "imagen",
                archivo: a.file.name
              }));
            });
          });
        });
        cadena.then(function() {
          IM.junto(function() {
            self.pintarRecortes();
            self.pintar();
            self.marcarLista($("#lista"));
          });
          listo();
        });
      };
      IM.alCambiarArchivos(recargar);
      IM.alCambiarOpcion(function() {
        mostrarSi($("#doc-mm"), /^Otro/.test(IM.opcion("Tipo de documento") || ""));
        var mano = /^A mano/.test(IM.opcion("Recorte") || "");
        Object.keys(self.fotos).forEach(function(k) {
          var f = self.fotos[k];
          if (f && !mano) {
            f.ang = f.auto.ang;
            f.rect = f.auto.rect.slice();
          }
        });
        self.pintarRecortes();
        self.pintar();
      });
      $$(".h-opciones [data-d]").forEach(function(i) {
        i.addEventListener("input", function() {
          self.pintar();
        });
      });
      this.alCambiarSolo = function(c) {
        if (c.checked) self.solos[c.dataset.solo] = 1; else delete self.solos[c.dataset.solo];
        self.marcarLista($("#lista"));
        self.pintar();
      };
      if (!doc.escuchando) {
        doc.escuchando = true;
        document.addEventListener("change", function(e) {
          var c = e.target.closest && e.target.closest("[data-solo]");
          if (c && doc.alCambiarSolo) doc.alCambiarSolo(c);
        });
      }
      this.arrastre();
      recargar();
    },
    desmontar: function() {
      this.alCambiarSolo = null;
      $$("#lista li").forEach(function(li) {
        delete li.dataset.grupo;
        li.classList.remove("g-ini", "g-fin");
        $$(".g-rot, .g-solo, .g-suelto", li).forEach(function(x) {
          x.remove();
        });
      });
    },
    grupos: function() {
      var arch = IM.archivos(), g = [], i = 0;
      while (i < arch.length) {
        var letra = letraGrupo(g.length), solo = this.solos[arch[i].id] || i === arch.length - 1;
        if (solo) {
          g.push({
            letra: letra,
            archivos: [ arch[i] ]
          });
          i++;
        } else {
          g.push({
            letra: letra,
            archivos: [ arch[i], arch[i + 1] ]
          });
          i += 2;
        }
      }
      return g;
    },
    marcarLista: function(ul) {
      if (!this.fotos) return;
      var self = this, gs = this.grupos(), porId = {}, arch = IM.archivos();
      gs.forEach(function(g) {
        g.archivos.forEach(function(a, k) {
          porId[a.id] = {
            g: g,
            k: k
          };
        });
      });
      $$("li", ul).forEach(function(li) {
        var x = porId[+li.dataset.id];
        $$(".g-rot, .g-solo, .g-suelto", li).forEach(function(z) {
          z.remove();
        });
        if (!x) return;
        li.dataset.grupo = x.g.letra;
        li.classList.toggle("g-ini", x.k === 0);
        li.classList.toggle("g-fin", x.k === x.g.archivos.length - 1);
        var r = document.createElement("span");
        r.className = "g-rot";
        li.insertBefore(r, $(".nombre", li));
        if (x.k === 0) {
          var esUltimo = arch.length && arch[arch.length - 1].id === +li.dataset.id;
          r.textContent = x.g.letra;
          if (x.g.archivos.length === 1) {
            var su = document.createElement("span");
            su.className = "g-suelto";
            su.textContent = "· Un solo archivo en la hoja";
            li.insertBefore(su, $(".peso", li));
          }
          if (!esUltimo) {
            var o = document.createElement("label");
            o.className = "g-solo";
            o.innerHTML = '<input type="checkbox" data-solo="' + li.dataset.id + '"' + (self.solos[li.dataset.id] ? " checked" : "") + "> Usar un solo archivo";
            li.insertBefore(o, $(".peso", li));
          }
        }
      });
    },
    pintarRecortes: function() {
      var self = this, cont = $(".doc-recortes", this.c);
      cont.innerHTML = "";
      var mano = /^A mano/.test(IM.opcion("Recorte") || "");
      IM.archivos().forEach(function(a) {
        var f = self.fotos[a.id];
        if (!f) return;
        var fig = document.createElement("figure"), c = enderezarFoto(f.img, f.ang, 520);
        fig.className = "doc-recorte";
        fig.dataset.id = a.id;
        var w = document.createElement("div");
        w.className = "lienzo";
        c.style.width = "100%";
        w.appendChild(c);
        var caja = document.createElement("div");
        caja.className = "recorte-caja" + (mano ? "" : " fija");
        caja.innerHTML = [ "nw", "ne", "sw", "se" ].map(function(k) {
          return '<span class="tirador-r" data-t="' + k + '"></span>';
        }).join("");
        w.appendChild(caja);
        fig.appendChild(w);
        var cap = document.createElement("figcaption");
        cap.textContent = a.file.name;
        fig.appendChild(cap);
        cont.appendChild(fig);
        self.pintarCaja(a.id);
      });
    },
    pintarCaja: function(id) {
      var f = this.fotos[id], caja = $('.doc-recorte[data-id="' + id + '"] .recorte-caja', this.c);
      if (!f || !caja) return;
      var r = f.rect;
      caja.style.left = r[0] * 100 + "%";
      caja.style.top = r[1] * 100 + "%";
      caja.style.width = r[2] * 100 + "%";
      caja.style.height = r[3] * 100 + "%";
    },
    arrastre: function() {
      var self = this, op = null;
      this.c.addEventListener("pointerdown", function(e) {
        var caja = e.target.closest(".recorte-caja");
        if (!caja || caja.classList.contains("fija")) return;
        e.preventDefault();
        var id = +caja.closest(".doc-recorte").dataset.id, f = self.fotos[id], fr = caja.parentNode.getBoundingClientRect();
        op = {
          id: id,
          t: e.target.dataset.t || "mover",
          x: e.clientX,
          y: e.clientY,
          ini: f.rect.slice(),
          fw: fr.width,
          fh: fr.height
        };
        caja.setPointerCapture(e.pointerId);
      });
      this.c.addEventListener("pointermove", function(e) {
        if (!op) return;
        var f = self.fotos[op.id], dx = (e.clientX - op.x) / op.fw, dy = (e.clientY - op.y) / op.fh, r = op.ini.slice(), min = .05;
        if (op.t === "mover") {
          r[0] = Math.min(1 - r[2], Math.max(0, r[0] + dx));
          r[1] = Math.min(1 - r[3], Math.max(0, r[1] + dy));
        } else {
          var x0 = r[0], y0 = r[1], x1 = r[0] + r[2], y1 = r[1] + r[3];
          if (/w/.test(op.t)) x0 = Math.min(x1 - min, Math.max(0, x0 + dx)); else x1 = Math.max(x0 + min, Math.min(1, x1 + dx));
          if (/n/.test(op.t)) y0 = Math.min(y1 - min, Math.max(0, y0 + dy)); else y1 = Math.max(y0 + min, Math.min(1, y1 + dy));
          r = [ x0, y0, x1 - x0, y1 - y0 ];
        }
        f.rect = r;
        self.pintarCaja(op.id);
      });
      var fin = function() {
        if (op) {
          op = null;
          self.pintar();
        }
      };
      this.c.addEventListener("pointerup", fin);
      this.c.addEventListener("pointercancel", fin);
    },
    recorte: function(a, maxLado) {
      var f = this.fotos[a.id], c = enderezarFoto(f.img, f.ang, maxLado), r = f.rect;
      var o = document.createElement("canvas");
      o.width = Math.max(1, Math.round(c.width * r[2]));
      o.height = Math.max(1, Math.round(c.height * r[3]));
      var x = o.getContext("2d");
      x.drawImage(c, c.width * r[0], c.height * r[1], o.width, o.height, 0, 0, o.width, o.height);
      if (/grises/.test(IM.opcion("Color") || "")) {
        var d = x.getImageData(0, 0, o.width, o.height), p = d.data;
        for (var i = 0; i < p.length; i += 4) {
          var g = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114;
          p[i] = p[i + 1] = p[i + 2] = g;
        }
        x.putImageData(d, 0, 0);
      }
      c.width = c.height = 0;
      return o;
    },
    medidaDoc: function(ancho, alto) {
      var t = IM.opcion("Tipo de documento") || "Tarjeta", m = /^Pasaporte/.test(t) ? MEDIDAS_DOC.pasaporte : /^Otro/.test(t) ? [ +($('.h-opciones [data-d="ancho"]') || {}).value || 100, +($('.h-opciones [data-d="alto"]') || {}).value || 70 ] : MEDIDAS_DOC.tarjeta;
      var w = Math.max(m[0], m[1]), h = Math.min(m[0], m[1]);
      if (alto > ancho) {
        var q = w;
        w = h;
        h = q;
      }
      var k = /^Ampliado/.test(IM.opcion("Tamaño en la hoja") || "") ? 1.5 : 1;
      return [ w * k * MM, h * k * MM ];
    },
    plan: function() {
      var self = this, hoja = HOJAS[IM.opcion("Hoja") || "A4"] || HOJAS.A4, W = hoja[0], Hh = hoja[1], marg = 42.5, gap = 20;
      var lado = /^Uno al lado/.test(IM.opcion("Ubicación") || ""), varios = /^Varios/.test(IM.opcion("Documentos en la hoja") || ""), out = [], hj = null, y = 0;
      var nueva = function() {
        hj = {
          ancho: W,
          alto: Hh,
          piezas: []
        };
        out.push(hj);
        y = Hh - marg;
      };
      var lado0 = function(a) {
        var n = base(a.file.name).toLowerCase(), b = "(^|[^a-záéíóúñ])", e = "([^a-záéíóúñ]|$)";
        return new RegExp(b + "(frente|anverso|front)" + e).test(n) ? -1 : new RegExp(b + "(dorso|reverso|back)" + e).test(n) ? 1 : 0;
      };
      this.grupos().forEach(function(g) {
        var orden = g.archivos.length === 2 && lado0(g.archivos[0]) > lado0(g.archivos[1]) ? [ g.archivos[1], g.archivos[0] ] : g.archivos;
        var ps = orden.filter(function(a) {
          return self.fotos[a.id];
        }).map(function(a) {
          var f = self.fotos[a.id], r = f.rect, m = self.medidaDoc(r[2] * f.img.width, r[3] * f.img.height);
          return {
            a: a,
            w: m[0],
            h: m[1]
          };
        });
        if (!ps.length) return;
        var ancho = lado ? ps.reduce(function(t, p) {
          return t + p.w;
        }, 0) + gap * (ps.length - 1) : Math.max.apply(null, ps.map(function(p) {
          return p.w;
        }));
        var alto = lado ? Math.max.apply(null, ps.map(function(p) {
          return p.h;
        })) : ps.reduce(function(t, p) {
          return t + p.h;
        }, 0) + gap * (ps.length - 1);
        if (!hj || !varios || y - alto < marg) nueva();
        if (!varios) hj.letra = g.letra;
        var x = (W - ancho) / 2, yy = y;
        ps.forEach(function(p) {
          if (lado) {
            hj.piezas.push({
              a: p.a,
              dst: [ x, yy - p.h, p.w, p.h ]
            });
            x += p.w + gap;
          } else {
            hj.piezas.push({
              a: p.a,
              dst: [ (W - p.w) / 2, yy - p.h, p.w, p.h ]
            });
            yy -= p.h + gap;
          }
        });
        y -= alto + gap * 2;
      });
      return out;
    },
    pintar: function() {
      if (!this.c) return;
      var self = this, plan = this.plan();
      $(".aj-resumen", this.c).textContent = plan.length ? plan.length === 1 ? "1 hoja." : plan.length + " hojas." : "";
      IM.botonHabilitado(plan.length > 0);
      pintarHojas($(".aj-hojas", this.c), plan, function(pz) {
        return Promise.resolve(self.fotos[pz.a.id] ? self.recorte(pz.a, 600) : null);
      }, function(hj) {
        return hj.letra && plan.length > 1 ? [ hj.letra ] : [];
      });
    },
    procesar: function() {
      var self = this, plan = this.plan();
      if (!plan.length) return;
      var fmt = (IM.opcion("Formato") || "PDF").toLowerCase(), porDocumento = this.grupos().length > 1 && !/^Varios/.test(IM.opcion("Documentos en la hoja") || "");
      var nombre = function(h, i, ext) {
        return (porDocumento && h.letra ? "documento-" + h.letra : plan.length > 1 ? "documento-hoja-" + (i + 1) : "documento") + "-en-una-hoja." + ext;
      };
      return IM.procesar({
        textoInicial: "Armando la hoja…",
        zip: true,
        nombreZip: plan.length + "-documentos-en-una-hoja.zip",
        preparar: function(av, cancelado) {
          var cad = Promise.resolve(), listos = [];
          if (fmt === "pdf") {
            var imgs = {}, total = 0, n = 0;
            plan.forEach(function(h) {
              total += h.piezas.length;
            });
            plan.forEach(function(h) {
              h.piezas.forEach(function(p) {
                cad = cad.then(function() {
                  if (cancelado()) throw {
                    codigo: "cancelado"
                  };
                  n++;
                  av("Armando la hoja…" + (total > 1 ? " Imagen " + n + " de " + total + "." : ""));
                  if (imgs[p.a.id]) return;
                  var r = self.recorte(p.a, 2400);
                  return aBlob(r, "image/jpeg", .92).then(function(b) {
                    r.width = r.height = 0;
                    return b.arrayBuffer();
                  }).then(function(ab) {
                    var u = new Uint8Array(ab), j = leerJpg(u);
                    imgs[p.a.id] = {
                      w: j.w,
                      h: j.h,
                      cs: j.comp === 1 ? "DeviceGray" : "DeviceRGB",
                      filtro: "DCTDecode",
                      bytes: u,
                      rot: 0
                    };
                  });
                });
              });
            });
            return cad.then(function() {
              var hoja = function(h) {
                return {
                  ancho: h.ancho,
                  alto: h.alto,
                  piezas: h.piezas.map(function(p) {
                    return {
                      img: imgs[p.a.id],
                      dst: p.dst
                    };
                  })
                };
              };
              if (!porDocumento) return {
                listos: [ {
                  nombre: nombre({}, 0, "pdf").replace("documento-hoja-1", "documento"),
                  blob: armarPdf(plan.map(hoja))
                } ]
              };
              return {
                listos: plan.map(function(h, i) {
                  return {
                    nombre: nombre(h, i, "pdf"),
                    blob: armarPdf([ hoja(h) ])
                  };
                })
              };
            });
          }
          var k = 300 / 72;
          plan.forEach(function(h, i) {
            cad = cad.then(function() {
              if (cancelado()) throw {
                codigo: "cancelado"
              };
              av("Armando la hoja…" + (plan.length > 1 ? " Hoja " + (i + 1) + " de " + plan.length + "." : ""));
              var c = document.createElement("canvas");
              c.width = Math.round(h.ancho * k);
              c.height = Math.round(h.alto * k);
              var x = c.getContext("2d");
              x.fillStyle = "#fff";
              x.fillRect(0, 0, c.width, c.height);
              x.imageSmoothingQuality = "high";
              h.piezas.forEach(function(p) {
                var r = self.recorte(p.a, 2400);
                x.drawImage(r, p.dst[0] * k, c.height - (p.dst[1] + p.dst[3]) * k, p.dst[2] * k, p.dst[3] * k);
                r.width = r.height = 0;
              });
              return aBlob(c, fmt === "png" ? "image/png" : "image/jpeg", .92).then(function(b) {
                c.width = c.height = 0;
                return fmt === "png" ? pngConPpp(b) : jpgConPpp(b);
              }).then(function(b) {
                listos.push({
                  nombre: plan.length === 1 ? "documento-en-una-hoja." + fmt : nombre(h, i, fmt),
                  blob: b
                });
              });
            });
          });
          return cad.then(function() {
            return {
              listos: listos
            };
          });
        }
      });
    }
  };
  H._pdf = {
    armarPdf: armarPdf,
    leerJpg: leerJpg
  };
})();