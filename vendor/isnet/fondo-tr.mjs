import { quitarFondo, mascara, caras } from "./fondo.mjs";

self.onmessage = async e => {
  const {id: id, op: op, img: img, o: o} = e.data;
  let ultimo = 0;
  const opciones = Object.assign({}, o, {
    alAvance: (a, t) => {
      const ahora = performance.now();
      if (a < t && ahora - ultimo < 125) return;
      ultimo = ahora;
      self.postMessage({
        id: id,
        tipo: "avance",
        a: a,
        t: t
      });
    }
  });
  try {
    let r, pasar = [];
    if (op === "quitarFondo") r = await quitarFondo(img, opciones); else if (op === "mascara") {
      r = await mascara(img, opciones);
      pasar = [ r ];
    } else if (op === "caras") r = await caras(img, opciones); else throw new Error("op " + op);
    self.postMessage({
      id: id,
      tipo: "listo",
      r: r
    }, pasar);
  } catch (err) {
    self.postMessage({
      id: id,
      tipo: "error",
      detalle: String(err && err.message || err)
    });
  } finally {
    img && img.close && img.close();
  }
};