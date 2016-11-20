import * as cp from "child_process";
import * as http from "http";
import { join } from "path";
import * as tmp from "tmp";
import { CancellationToken, ExtensionContext, TextDocumentContentProvider, Uri } from "vscode";
import * as ws from "ws";

export default class LatexDocumentProvider implements TextDocumentContentProvider {
  private http: http.Server;
  private websocket: ws.Server;
  private listening: Promise<void>;

  private dirs: { [uri: string]: string } = {};

  constructor(private context: ExtensionContext) {
    this.http = http.createServer();
    this.listening = new Promise((c, e) => {
      this.http.listen(0, "localhost", undefined, err => err ? e(err) : c());
    });

    this.websocket = ws.createServer({ server: this.http });
    this.websocket.on("connection", client => {
      client.on("message", data => {
        console.log(data);
      });
    });
  }

  public dispose() {
    this.websocket.close();
  }

  public async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
    await this.listening;

    // Create a temp dir for the preview.
    this.dirs[uri.toString()] = await new Promise<string>((c, e) => {
      tmp.dir({ unsafeCleanup: true }, (err, path) => err ? e(err) : c(path));
    });

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
      <script src="${this.getPath("out/src/client.js")}"></script>
    </head>
    <body class="preview" data-websocket="${attr(ws)}" data-pdf="${attr(preview.toString())}">
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
    const cwd = this.dirs[uri.toString()];

    return new Promise((resolve, reject) => {
      cp.exec(`pdflatex -jobname=preview -synctex=1 -halt-on-error ${arg(path)}`, { cwd }, (err, out) =>
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
