/// <reference path="../node_modules/@types/pdf/index.d.ts" />

let path: string;
let socket: WebSocket;

let canvases = [];
let pages = [];

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
      canvases.push(document.body.appendChild(document.createElement("canvas")));
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
  for (let i = 0; i < pages.length; i++) {
    const scale = document.body.clientWidth / pages[i].getViewport(1).width;
    const viewport = pages[i].getViewport(scale);

    const canvas = canvases[i];
    const canvasContext = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    pages[i].render({ viewport, canvasContext });
  }
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
