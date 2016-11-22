/// <reference path="../node_modules/@types/pdf/index.d.ts" />

let path: string;
let socket: WebSocket;

document.addEventListener("DOMContentLoaded", () => {
  path = document.body.dataset["path"];
  socket = new WebSocket(document.body.dataset["websocket"]);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "open", path }));
  });

  socket.addEventListener("message", event => {
    const data = JSON.parse(event.data);

    if (data.type === "update") {
      loadAndRender(data.path);
    }

    if (data.type === "show") {
    }
  });
});

function loadAndRender(pdf: string) {
  return PDFJS.getDocument(pdf).then(render);
}

function render(pdf: PDFDocumentProxy) {
  let canvases = document.getElementsByTagName("canvas");

  // Ensure we have the right number of canvases.
  for (let i = canvases.length; i < pdf.numPages; i++) {
    const canvas = document.createElement("canvas");
    canvas.addEventListener("click", getClickHandler(canvas, i + 1));
    document.body.appendChild(canvas);
  }

  for (let i = canvases.length; i > pdf.numPages; i--) {
    canvases[i - 1].remove();
  }

  canvases = document.getElementsByTagName("canvas");

  // Render the pages.
  const draw = (i: number) => pdf.getPage(i).then(page => {
    const viewport = page.getViewport(document.body.clientWidth / page.getViewport(1).width);

    const canvas = canvases[i - 1];
    const canvasContext = canvases[i - 1].getContext("2d");

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    page.render({ canvasContext, viewport });

    if (i < pdf.numPages) {
      draw(i + 1);
    }
  });

  draw(1);
}

function getClickHandler(el: Element, page: number) {
  return (e: MouseEvent) => {
    socket.send(JSON.stringify({
      type: "click",
      page,
      x: e.x / el.clientWidth,
      y: e.y / el.clientHeight,
    }));
  };
}
