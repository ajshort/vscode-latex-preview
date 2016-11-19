document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("pdf");
  const url = container.dataset.url;

  PDFJS.getDocument(url).then(pdf => {
    function render(num) {
      console.log(num);
      pdf.getPage(num).then(page => {
        const viewport = page.getViewport(1);

        const canvas = document.createElement("canvas");
        const canvasContext = canvas.getContext("2d");

        container.appendChild(canvas);

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        page.render({ canvasContext, viewport });

        if (num < pdf.numPages) {
          render(num + 1);
        }
      });
    }

    render(1);
  });
});
