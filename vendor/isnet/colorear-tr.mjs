import { colorear } from "./fondo.mjs";

self.onmessage = async e => {
  try {
    const c = await colorear(e.data.img, {
      alAvance: (a, t) => self.postMessage({
        tipo: "avance",
        a: a,
        t: t
      })
    });
    const b = c.transferToImageBitmap ? c.transferToImageBitmap() : await createImageBitmap(c);
    self.postMessage({
      tipo: "listo",
      b: b
    }, [ b ]);
  } catch (err) {
    self.postMessage({
      tipo: "error",
      detalle: String(err && err.message || err)
    });
  }
};