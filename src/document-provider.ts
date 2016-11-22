import * as synctex from "./synctex";
import * as cp from "child_process";
import * as http from "http";
import * as tmp from "tmp";
import { CancellationToken, ExtensionContext, Position, TextDocumentContentProvider, Uri, commands } from "vscode";
import * as ws from "ws";

interface Preview {
  path: string;
  dir: string;
  connected: Promise<void>;
  connectedResolve: Function;
  client?: ws;
};

/**
 * Provides preview content and creates a websocket server which communicates with the preview.
 */
export default class LatexDocumentProvider implements TextDocumentContentProvider {
  private http: http.Server;
  private server: ws.Server;
  private listening: Promise<void>;

  private previews: Preview[] = [];

  constructor(private context: ExtensionContext) {
    this.http = http.createServer();
    this.server = ws.createServer({ server: this.http });

    this.listening = new Promise((c, e) => {
      this.http.listen(0, "localhost", undefined, err => err ? e(err) : c());
    });

    this.server.on("connection", client => {
      client.on("message", this.onClientMessage.bind(this, client));
      client.on("close", this.onClientClose.bind(this, client));
    });
  }

  public dispose() {
    this.server.close();
  }

  public async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
    await this.listening;

    // Create a new preview instance.
    const preview = <Preview> {
      path: uri.fsPath,
      dir: await this.createTempDir(),
      connected: null,
      connectedResolve: null,
    };

    preview.connected = new Promise(c => preview.connectedResolve = c);

    this.previews.push(preview);

    // Build the PDF and generate the preview document.
    const pdf = await this.build(preview.path, preview.dir);

    const { address, port } = this.http.address();
    const ws = `ws://${address}:${port}`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="${this.getResourcePath("media/style.css")}">

      <script src="${this.getResourcePath("node_modules/pdfjs-dist/build/pdf.js")}"></script>
      <script src="${this.getResourcePath("node_modules/pdfjs-dist/build/pdf.worker.js")}"></script>
      <script src="${this.getResourcePath("out/src/client.js")}"></script>
    </head>
    <body class="preview" data-path="${attr(preview.path)}" data-websocket="${attr(ws)}" data-pdf="${attr(pdf)}">
    </body>
    </html>`;
  }

  public async update(uri: Uri) {
    const preview = this.getPreview(uri.fsPath);

    if (typeof preview === "undefined") {
      return;
    }

    await this.build(preview.path, preview.dir);
    preview.client.send(JSON.stringify({ type: "update" }));
  }

  /**
   * Shows a text editor position in the preview.
   */
  public async showPosition(uri: Uri, position: Position) {
    let preview = this.getPreview(uri.fsPath);

    if (typeof preview === "undefined") {
      await commands.executeCommand("latex-preview.showPreview", uri);
      preview = this.getPreview(uri.fsPath);
    }

    // Make sure the client is connected.
    await preview.connected;

    // Get the position.
    const rects = await synctex.view({
      line: position.line + 1,
      column: position.character + 1,
      input: preview.path,
      output: `${preview.dir}/preview.pdf`,
    });

    if (rects.length === 0) {
      return;
    }

    preview.client.send(JSON.stringify({ type: "show", rect: rects[0] }));
  }

  /**
   * Gets the preview object for a tex file path.
   */
  private getPreview(path: string): Preview {
    return this.previews.find(preview => preview.path === path);
  }

  /**
   * Builds a PDF and returns the path to it.
   */
  private build(path: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cp.exec(`pdflatex -jobname=preview -synctex=1 -interaction=nonstopmode ${arg(path)}`, { cwd }, (err, out) =>
        err ? reject(err) : resolve(`${cwd}/preview.pdf`)
      );
    });
  }

  private onClientMessage(client: ws, message: any) {
    const data = JSON.parse(message);

    if (data.type === "open") {
      const preview = this.getPreview(data.path);
      preview.client = client;
      preview.connectedResolve();
    }
  }

  private onClientClose(client: ws) {
    for (let i = 0; i < this.previews.length; i++) {
      if (this.previews[i].client === client) {
        this.previews.splice(i, 1);
        return;
      }
    }
  }

  /**
   * Creates a new temporary directory.
   */
  private createTempDir(): Promise<string> {
    return new Promise((c, e) => {
      tmp.dir({ unsafeCleanup: true }, (err, dir) => err ? e(err) : c(dir));
    });
  }

  private getResourcePath(file: string): string {
    return this.context.asAbsolutePath(file);
  }
}

function arg(str: string): string {
  return '"' + str.replace(/([\\"$])/g, "\\$1") + '"';
}

function attr(str: string): string {
  return str.replace("&", "&amp;").replace('"', "&quot;");
}
