import * as cp from "child_process";
import * as http from "http";
import { dirname, join } from "path";
import { CancellationToken, ExtensionContext, TextDocumentContentProvider, Uri } from "vscode";
import * as ws from "ws";

export default class LatexDocumentProvider implements TextDocumentContentProvider {
  private http: http.Server;
  private websocket: ws.Server;
  private listening: Promise<void>;

  constructor(private context: ExtensionContext) {
    this.http = http.createServer();
    this.listening = new Promise((c, e) => {
      this.http.listen(0, "localhost", undefined, err => err ? e(err) : c())
    });

    this.websocket = ws.createServer({ server: this.http });
  }

  public dispose() {
    this.websocket.close();
  }

  public async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
    await this.listening;

    const preview = await this.build(uri);

    const { address, port } = this.http.address();
    const ws = `ws://${address}:${port}`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="${this.getPath("media/style.css")}">

      <script src="${this.getModulePath("pdfjs-dist/build/pdf.js")}"></script>
      <script src="${this.getModulePath("pdfjs-dist/build/pdf.worker.js")}"></script>
      <script src="${this.getPath("src/client.js")}"></script>
    </head>
    <body class="preview" data-websocket-uri="${attr(ws)}" data-pdf-uri="${attr(preview.toString())}">
    </body>
    </html>`;
  }

  public async update(uri: Uri) {
    const preview = await this.build(uri);

    for (const client of this.websocket.clients) {
      client.send(JSON.stringify({ type: "updated", uri: preview.toString() }));
    }
  }

  /**
   * Builds a PDF and returns the URI to it.
   */
  private build(uri: Uri): Promise<Uri> {
    const path = uri.fsPath;
    const cwd = dirname(path);

    return new Promise((resolve, reject) => {
      cp.exec(`pdflatex -jobname=preview -halt-on-error ${arg(path)}`, { cwd }, (err, out) =>
        err ? reject(err) : resolve(Uri.file(join(cwd, "preview.pdf")))
      );
    });
  }

  private getPath(file: string): string {
    return this.context.asAbsolutePath(file);
  }

  private getModulePath(file: string): string {
    return this.context.asAbsolutePath(join("node_modules", file));
  }
}

function arg(str: string): string {
  return '"' + str.replace(/([\\"$])/g, "\\$1") + '"';
}

function attr(str: string): string {
  return str.replace("&", "&amp;").replace('"', "&quot;");
}
