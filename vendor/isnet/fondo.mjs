import * as ort from "./ort.webgpu.min.mjs";

const LADO = 1024;

const base = new URL("./", import.meta.url).href;

let manifiesto = null, binarioMotor = null, motorListo = null;

const sesiones = {};

let sinPlaca = false;

function leerManifiesto() {
  return manifiesto || (manifiesto = fetch(base + "piezas.json").then(r => {
    if (!r.ok) throw new Error("fetch piezas.json");
    return r.json();
  }));
}

async function bajar(nombre, alAvance) {
  const m = (await leerManifiesto())[nombre];
  const todo = new Uint8Array(m.bytes);
  let pos = 0;
  for (const pieza of m.piezas) {
    const r = await fetch(base + pieza);
    if (!r.ok) throw new Error("fetch " + pieza);
    const lector = r.body.getReader();
    for (;;) {
      const {done: done, value: value} = await lector.read();
      if (done) break;
      todo.set(value, pos);
      pos += value.length;
      if (alAvance) alAvance(pos);
    }
  }
  if (pos !== m.bytes) throw new Error("fetch " + nombre + ": incompleto");
  return todo;
}

function nombreModelo(calidad, que) {
  if (que === "personas") return "modnet.onnx";
  if (que === "colorear") return "ddcolor.onnx";
  if (que === "borrar") return "lama.onnx";
  if (que === "caras") return "caras.onnx";
  return calidad === "máxima" ? "isnet.onnx" : "isnet-fp16.onnx";
}

async function sesion(calidad, gpu, alAvance, que) {
  const clave = nombreModelo(calidad, que) + (gpu && !sinPlaca ? ":gpu" : ":cpu");
  if (sesiones[clave]) return sesiones[clave];
  const man = await leerManifiesto();
  const modelo = nombreModelo(calidad, que);
  const total = (binarioMotor ? 0 : man["motor.wasm"].bytes) + man[modelo].bytes;
  let hecho = 0;
  const av = n => {
    if (alAvance) alAvance(hecho + n, total);
  };
  if (!binarioMotor) {
    binarioMotor = await bajar("motor.wasm", av);
    hecho += man["motor.wasm"].bytes;
  }
  if (!motorListo) {
    ort.env.wasm.wasmBinary = binarioMotor;
    ort.env.wasm.wasmPaths = {
      mjs: new URL("ort-wasm-simd-threaded.asyncify.mjs", import.meta.url).href
    };
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    ort.env.logLevel = "error";
    motorListo = true;
  }
  const datos = await bajar(modelo, av);
  const extra = modelo === "lama.onnx" ? {
    extra: {
      session: {
        disable_quant_qdq: "1"
      }
    }
  } : {};
  const crear = ep => ort.InferenceSession.create(datos, Object.assign({
    executionProviders: [ ep ],
    graphOptimizationLevel: "all"
  }, extra));
  sesiones[clave] = (gpu && !sinPlaca ? crear("webgpu").catch(() => {
    sinPlaca = true;
    return crear("wasm");
  }) : crear("wasm")).catch(e => {
    delete sesiones[clave];
    throw e;
  });
  return sesiones[clave];
}

function lienzo(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function aBitmap(fuente) {
  if (typeof ImageBitmap !== "undefined" && fuente instanceof ImageBitmap) return fuente;
  return createImageBitmap(fuente, {
    imageOrientation: "from-image"
  });
}

async function mascaraPersonas(img, gpu, alAvance) {
  const s = await sesion("", false, alAvance, "personas");
  const k = 512 / Math.min(img.width, img.height);
  const w = Math.max(32, Math.round(img.width * k / 32) * 32), h = Math.max(32, Math.round(img.height * k / 32) * 32);
  const c = lienzo(w, h), x = c.getContext("2d", {
    willReadFrequently: true
  });
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, w, h);
  const px = x.getImageData(0, 0, w, h).data, n = w * h, entrada = new Float32Array(3 * n);
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    entrada[j] = px[i] / 127.5 - 1;
    entrada[j + n] = px[i + 1] / 127.5 - 1;
    entrada[j + 2 * n] = px[i + 2] / 127.5 - 1;
  }
  const tensor = new ort.Tensor("float32", entrada, [ 1, 3, h, w ]);
  const r = await s.run({
    input: tensor
  });
  const salida = r.output.data;
  const m = new ImageData(w, h), d = m.data;
  for (let j = 0, i = 0; j < n; j++, i += 4) {
    const v = salida[j];
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }
  tensor.dispose && tensor.dispose();
  r.output.dispose && r.output.dispose();
  x.putImageData(m, 0, 0);
  const g = lienzo(img.width, img.height), gx = g.getContext("2d", {
    willReadFrequently: true
  });
  gx.imageSmoothingEnabled = true;
  gx.imageSmoothingQuality = "high";
  gx.drawImage(c, 0, 0, img.width, img.height);
  return g;
}

async function calcularMascara(img, calidad, gpu, alAvance, que) {
  if (que === "personas") return mascaraPersonas(img, gpu, alAvance);
  const s = await sesion(calidad, gpu, alAvance);
  const [c, x] = (() => {
    const c = lienzo(LADO, LADO);
    return [ c, c.getContext("2d", {
      willReadFrequently: true
    }) ];
  })();
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, LADO, LADO);
  const px = x.getImageData(0, 0, LADO, LADO).data, n = LADO * LADO, entrada = new Float32Array(3 * n);
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    entrada[j] = (px[i] - 128) / 256;
    entrada[j + n] = (px[i + 1] - 128) / 256;
    entrada[j + 2 * n] = (px[i + 2] - 128) / 256;
  }
  const tensor = new ort.Tensor("float32", entrada, [ 1, 3, LADO, LADO ]);
  const r = await s.run({
    input: tensor
  });
  const salida = r.output.data;
  const m = new ImageData(LADO, LADO), d = m.data;
  for (let j = 0, i = 0; j < n; j++, i += 4) {
    const v = salida[j];
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }
  tensor.dispose && tensor.dispose();
  r.output.dispose && r.output.dispose();
  x.putImageData(m, 0, 0);
  const g = lienzo(img.width, img.height), gx = g.getContext("2d", {
    willReadFrequently: true
  });
  gx.imageSmoothingEnabled = true;
  gx.imageSmoothingQuality = "high";
  gx.drawImage(c, 0, 0, img.width, img.height);
  return g;
}

async function aPng(c) {
  if (c.convertToBlob) return c.convertToBlob({
    type: "image/png"
  });
  return new Promise(ok => c.toBlob(ok, "image/png"));
}

export async function quitarFondo(fuente, o) {
  const img = await aBitmap(fuente);
  const mascara = await calcularMascara(img, o.calidad, o.gpu, o.alAvance, o.que);
  const c = lienzo(img.width, img.height), x = c.getContext("2d", {
    willReadFrequently: true
  });
  x.drawImage(img, 0, 0);
  const foto = x.getImageData(0, 0, img.width, img.height), a = mascara.getContext("2d", {
    willReadFrequently: true
  }).getImageData(0, 0, img.width, img.height).data, p = foto.data;
  for (let i = 3; i < p.length; i += 4) p[i] = Math.round(p[i] * a[i] / 255);
  x.putImageData(foto, 0, 0);
  return aPng(c);
}

export async function mascara(fuente, o) {
  const img = await aBitmap(fuente);
  return createImageBitmap(await calcularMascara(img, o.calidad, o.gpu, o.alAvance, o.que));
}

async function carasEn(s, img, x0, y0, w0, h0) {
  const c = lienzo(640, 480), x = c.getContext("2d", {
    willReadFrequently: true
  });
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, x0, y0, w0, h0, 0, 0, 640, 480);
  const px = x.getImageData(0, 0, 640, 480).data, n = 640 * 480, entrada = new Float32Array(3 * n);
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    entrada[j] = (px[i] - 127) / 128;
    entrada[j + n] = (px[i + 1] - 127) / 128;
    entrada[j + 2 * n] = (px[i + 2] - 127) / 128;
  }
  const t = new ort.Tensor("float32", entrada, [ 1, 3, 480, 640 ]);
  const r = await s.run({
    input: t
  });
  const sc = r.scores.data, bx = r.boxes.data, out = [];
  for (let k = 0; k < sc.length / 2; k++) {
    const p = sc[2 * k + 1];
    if (p < .7) continue;
    const a = bx[4 * k], b = bx[4 * k + 1], c2 = bx[4 * k + 2], d = bx[4 * k + 3];
    out.push({
      x: (x0 + a * w0) / img.width,
      y: (y0 + b * h0) / img.height,
      w: (c2 - a) * w0 / img.width,
      h: (d - b) * h0 / img.height,
      p: p
    });
  }
  t.dispose && t.dispose();
  return out;
}

function nms(l, umbral) {
  l.sort((a, b) => b.p - a.p);
  const ok = [];
  for (const a of l) {
    if (ok.every(b => {
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const i = ix * iy, u = a.w * a.h + b.w * b.h - i, chica = Math.min(a.w * a.h, b.w * b.h);
      return i / u < umbral && i / chica < .6;
    })) ok.push(a);
  }
  return ok;
}

export async function caras(fuente, o) {
  const img = await aBitmap(fuente);
  const s = await sesion("", false, o && o.alAvance, "caras");
  let l = await carasEn(s, img, 0, 0, img.width, img.height);
  if (Math.max(img.width, img.height) > 1200) {
    const w = img.width * .6, h = img.height * .6;
    for (const [fx, fy] of [ [ 0, 0 ], [ .4, 0 ], [ 0, .4 ], [ .4, .4 ] ]) l = l.concat(await carasEn(s, img, img.width * fx, img.height * fy, w, h));
  }
  return nms(l.filter(r => r.w > .004 && r.h > .004), .3).map(r => ({
    x: Math.max(0, r.x),
    y: Math.max(0, r.y),
    w: Math.min(r.w, 1 - Math.max(0, r.x)),
    h: Math.min(r.h, 1 - Math.max(0, r.y))
  }));
}

export async function borrar(fuente, mascara, o) {
  const img = await aBitmap(fuente), W = img.width, H = img.height;
  const mx = mascara.getContext("2d", {
    willReadFrequently: true
  }), md = mx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0, i = 3; y < H; y++) for (let x = 0; x < W; x++, i += 4) if (md[i]) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const sal = lienzo(W, H), sx = sal.getContext("2d", {
    willReadFrequently: true
  });
  sx.drawImage(img, 0, 0);
  if (x1 < 0) return sal;
  const s = await sesion("", false, o && o.alAvance, "borrar");
  let lado = Math.max(256, Math.max(x1 - x0 + 1, y1 - y0 + 1) * 2 + 64);
  lado = Math.min(lado, Math.max(W, H));
  const cw = Math.min(lado, W), ch = Math.min(lado, H);
  const cx = Math.max(0, Math.min(Math.round((x0 + x1) / 2 - cw / 2), W - cw)), cy = Math.max(0, Math.min(Math.round((y0 + y1) / 2 - ch / 2), H - ch));
  const N = 512, n = N * N;
  const ci = lienzo(N, N), cix = ci.getContext("2d", {
    willReadFrequently: true
  });
  cix.imageSmoothingEnabled = true;
  cix.imageSmoothingQuality = "high";
  cix.drawImage(img, cx, cy, cw, ch, 0, 0, N, N);
  const cm = lienzo(N, N), cmx = cm.getContext("2d", {
    willReadFrequently: true
  });
  cmx.drawImage(mascara, cx, cy, cw, ch, 0, 0, N, N);
  const px = cix.getImageData(0, 0, N, N).data, pm = cmx.getImageData(0, 0, N, N).data;
  const imagen = new Float32Array(3 * n), hueco = new Float32Array(n);
  for (let j = 0, i = 0; j < n; j++, i += 4) {
    imagen[j] = px[i] / 255;
    imagen[j + n] = px[i + 1] / 255;
    imagen[j + 2 * n] = px[i + 2] / 255;
    hueco[j] = pm[i + 3] > 0 ? 1 : 0;
  }
  const ti = new ort.Tensor("float32", imagen, [ 1, 3, N, N ]), tm = new ort.Tensor("float32", hueco, [ 1, 1, N, N ]);
  const r = await s.run({
    image: ti,
    mask: tm
  });
  const o2 = r.output.data, res = new ImageData(N, N), d = res.data;
  for (let j = 0, i = 0; j < n; j++, i += 4) {
    d[i] = o2[j];
    d[i + 1] = o2[j + n];
    d[i + 2] = o2[j + 2 * n];
    d[i + 3] = 255;
  }
  ti.dispose && ti.dispose();
  tm.dispose && tm.dispose();
  r.output.dispose && r.output.dispose();
  cix.putImageData(res, 0, 0);
  const pe = lienzo(cw, ch), pex = pe.getContext("2d");
  pex.imageSmoothingEnabled = true;
  pex.imageSmoothingQuality = "high";
  pex.drawImage(ci, 0, 0, N, N, 0, 0, cw, ch);
  pex.globalCompositeOperation = "destination-in";
  pex.filter = "blur(" + Math.max(1, Math.round(Math.max(cw, ch) / 512)) + "px)";
  pex.drawImage(mascara, cx, cy, cw, ch, 0, 0, cw, ch);
  pex.filter = "none";
  sx.drawImage(pe, cx, cy);
  return sal;
}

const XN = .950456, ZN = 1.088754;

const lin8 = new Float32Array(256);

for (let i = 0; i < 256; i++) {
  const c = i / 255;
  lin8[i] = c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
}

const GAM = new Uint8ClampedArray(4097);

for (let i = 0; i <= 4096; i++) {
  const c = i / 4096;
  GAM[i] = Math.round(255 * (c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055));
}

const fLab = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

const fInv = t => {
  const t3 = t * t * t;
  return t3 > .008856 ? t3 : (t - 16 / 116) / 7.787;
};

function luz(d, n) {
  const L = new Float32Array(n);
  for (let j = 0, i = 0; j < n; j++, i += 4) {
    const Y = .212671 * lin8[d[i]] + .71516 * lin8[d[i + 1]] + .072169 * lin8[d[i + 2]];
    L[j] = Y > .008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  }
  return L;
}

export async function colorear(fuente, o) {
  const img = await aBitmap(fuente), W = img.width, H = img.height;
  const s = await sesion("", false, o && o.alAvance, "colorear");
  const N = 512, n = N * N;
  const ci = lienzo(N, N), cix = ci.getContext("2d", {
    willReadFrequently: true
  });
  cix.imageSmoothingEnabled = true;
  cix.imageSmoothingQuality = "high";
  cix.drawImage(img, 0, 0, N, N);
  const Lc = luz(cix.getImageData(0, 0, N, N).data, n), ent = new Float32Array(3 * n);
  for (let j = 0; j < n; j++) {
    const L = Lc[j], Y = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
    ent[j] = ent[j + n] = ent[j + 2 * n] = GAM[Math.max(0, Math.min(4096, Math.round(Y * 4096)))] / 255;
  }
  const t = new ort.Tensor("float32", ent, [ 1, 3, N, N ]);
  const r = await s.run({
    [s.inputNames[0]]: t
  });
  const ab = r[s.outputNames[0]].data;
  const sal = lienzo(W, H), sx = sal.getContext("2d", {
    willReadFrequently: true
  });
  sx.drawImage(img, 0, 0);
  const id = sx.getImageData(0, 0, W, H), d = id.data, L = luz(d, W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(N - 1.001, Math.max(0, (y + .5) * N / H - .5)), y0 = fy | 0, ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(N - 1.001, Math.max(0, (x + .5) * N / W - .5)), x0 = fx | 0, tx = fx - x0, k = y0 * N + x0;
      const a = (ab[k] * (1 - tx) + ab[k + 1] * tx) * (1 - ty) + (ab[k + N] * (1 - tx) + ab[k + N + 1] * tx) * ty;
      const b = (ab[n + k] * (1 - tx) + ab[n + k + 1] * tx) * (1 - ty) + (ab[n + k + N] * (1 - tx) + ab[n + k + N + 1] * tx) * ty;
      const j = y * W + x, Lv = L[j], fy2 = (Lv + 16) / 116;
      const Y = Lv > 8 ? fy2 * fy2 * fy2 : Lv / 903.3, X = XN * fInv(fy2 + a / 500), Z = ZN * fInv(fy2 - b / 200);
      const R = 3.240479 * X - 1.53715 * Y - .498535 * Z, G = -.969256 * X + 1.875992 * Y + .041556 * Z, B = .055648 * X - .204043 * Y + 1.057311 * Z;
      const i = j * 4, q = v => GAM[v <= 0 ? 0 : v >= 1 ? 4096 : Math.round(v * 4096)];
      d[i] = q(R);
      d[i + 1] = q(G);
      d[i + 2] = q(B);
    }
  }
  t.dispose && t.dispose();
  sx.putImageData(id, 0, 0);
  return sal;
}