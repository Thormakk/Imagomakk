self.onmessage = function(e) {
  var d = e.data, o = {
    imageOrientation: "from-image"
  };
  if (d.ancho) {
    o.resizeWidth = d.ancho;
    o.resizeHeight = d.alto;
    o.resizeQuality = "high";
  }
  createImageBitmap(d.f, o).then(function(b) {
    self.postMessage({
      id: d.id,
      b: b
    }, [ b ]);
  }, function() {
    self.postMessage({
      id: d.id,
      error: true
    });
  });
};