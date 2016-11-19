document.addEventListener("DOMContentLoaded", function(event) {
  const canvas = document.getElementById("pdf");
  const url = canvas.dataset.url;

  PDFJS.getDocument(url).then(function(pdf) {
    pdf.getPage(1).then(function (page) {
      const viewport = page.getViewport(document.body.clientWidth / page.getViewport(1).width);
      const canvasContext = canvas.getContext("2d");

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      page.render({ viewport, canvasContext });
    });
  });
});
