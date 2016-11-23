/// <reference path="../node_modules/@types/pdf/index.d.ts" />

let path: string;
let socket: WebSocket;

let canvases: HTMLCanvasElement[] = [];
let pages: PDFPageProxy[] = [];
let viewports: PDFPageViewport[] = [];

document.addEventListener("DOMContentLoaded", () => {
  const error = document.getElementById("error-indicator");

  path = document.body.dataset["path"];
  socket = new WebSocket(document.body.dataset["websocket"]);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "open", path }));
  });

  socket.addEventListener("message", event => {
    const data = JSON.parse(event.data);

    if (data.type === "update") {
      error.style.display = "none";
      loadAndRender(data.path);
    }

    if (data.type === "error") {
      error.style.display = "block";
    }

    if (data.type === "show") {
    }
  });

  // Re-render pages on resize.
  let timeout: NodeJS.Timer;

  window.onresize = () => {
    clearTimeout(timeout);
    timeout = setTimeout(renderPages, 200);
  };
});

function loadAndRender(source: string) {
  return PDFJS.getDocument(source).then(async pdf => {
    // Ensure the right number of canvases.
    while (canvases.length < pdf.numPages) {
      const canvas = document.createElement("canvas");
      canvas.onclick = onCanvasClick;
      canvases.push(canvas);

      document.body.appendChild(canvas);
    }

    while (canvases.length > pdf.numPages) {
      canvases.pop().remove();
    }

    // Create the page objects.
    pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      pages.push(await pdf.getPage(i));
    }

    // Draw the pages.
    renderPages();
  });
}

function renderPages() {
  viewports = [];

  for (let i = 0; i < pages.length; i++) {
    const scale = document.body.clientWidth / pages[i].getViewport(1).width;
    const viewport = pages[i].getViewport(scale);

    viewports.push(viewport);

    const canvas = canvases[i];
    const canvasContext = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    pages[i].render({ viewport, canvasContext });
  }
}

function onCanvasClick(e: MouseEvent) {
  const page = canvases.indexOf(this) + 1;
  const point = viewports[page - 1].convertToPdfPoint(e.x, e.y);

  socket.send(JSON.stringify({ type: "click", page, x: point[0], y: point[1] }));
}
