document.addEventListener("DOMContentLoaded", () => {
  const uri = document.body.dataset.pdfUri;

  // Connect to the extension with a websocket.
  const socket = new WebSocket(document.body.dataset.websocketUri);

  // Listen for updates to the document.
  socket.onmessage = event => {
    const data = JSON.parse(event.data);

    if (data.type === "updated" && data.uri === uri) {
      render(uri);
    }
  };

  // Render the PDF.
  render(uri);
});

function render(uri) {
  PDFJS.getDocument(uri).then(pdf => {
    const canvases = document.getElementsByTagName("canvas");

    // Clear any excess canvases.
    for (let i = canvases.length; i > pdf.numPages; i--) {
      canvases[i - 1].remove();
    }

    // Render the pages.
    function renderPage(i) {
      pdf.getPage(i).then(page => {
        let canvas;

        if (i > canvases.length) {
          canvas = document.body.appendChild(document.createElement("canvas"));
        } else {
          canvas = canvases[i - 1];
        }

        const viewport = page.getViewport(1);
        const canvasContext = canvas.getContext("2d");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        page.render({ canvasContext, viewport });

        if (i < pdf.numPages) {
          renderPage(i + 1);
        }
      });
    }

    renderPage(1);
  });
}
