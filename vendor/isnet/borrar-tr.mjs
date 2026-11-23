import { borrar } from "./fondo.mjs";

self.onmessage = async e => {
  const {img: img, mascara: mascara} = e.data;
  try {
    const m = new OffscreenCanvas(mascara.width, mascara.height);
    m.getContext("2d").drawImage(mascara, 0, 0);
    mascara.close && mascara.close();
    const c = await borrar(img, m, {
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