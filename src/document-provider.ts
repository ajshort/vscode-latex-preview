import * as synctex from "./synctex";
import * as cp from "child_process";
import * as http from "http";
import * as tmp from "tmp";
import { CancellationToken, ExtensionContext, Position, TextDocumentContentProvider, Uri, commands } from "vscode";
import * as ws from "ws";

/**
 * Provides preview content and creates a websocket server which communicates with the preview.
 */
export default class LatexDocumentProvider implements TextDocumentContentProvider {
  private http: http.Server;
  private server: ws.Server;
  private listening: Promise<void>;

  private directories = new Map<string, string>();
  private clients = new Map<string, ws>();
  private connected = new Map<string, Promise<void>>();
  private connectedResolve = new Map<string, Function>();

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

  /**
   * Returns true if a client with the specified path is connected.
   */
  public isPreviewing(path: string): boolean {
    return this.clients.has(path);
  }

  /**
   * Creates a working dir and returns client HTML.
   */
  public async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
    await this.listening;

    // Create a working dir and start listening.
    const path = uri.fsPath;

    this.directories[path] = await this.createTempDir();
    this.listenForConnection(path);

    // Generate the document content.
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
    <body class="preview" data-path="${attr(path)}" data-websocket="${attr(ws)}">
    </body>
    </html>`;
  }

  public update(uri: Uri) {
    const path = uri.fsPath;

    if (!this.isPreviewing(path)) {
      return;
    }

    this.build(path, this.directories[path]).then(pdf => {
      this.clients.get(path).send(JSON.stringify({ type: "update", path: pdf }));
    });
  }

  /**
   * Shows a text editor position in the preview.
   */
  public async showPosition(uri: Uri, position: Position) {
    const path = uri.fsPath;

    if (!this.isPreviewing(path)) {
      await commands.executeCommand("latex-preview.showPreview", uri);
    }

    // Make sure the client is connected.
    await this.connected.get(path);

    // Get the position and send to the client.
    const rects = await synctex.view({
      line: position.line + 1,
      column: position.character + 1,
      input: path,
      output: `${this.directories[path]}/preview.pdf`,
    });

    if (rects.length === 0) {
      return;
    }

    this.clients.get(path).send(JSON.stringify({ type: "show", rect: rects[0] }));
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

  private listenForConnection(path: string) {
    this.connected.set(path, new Promise(resolve => {
      this.connectedResolve.set(path, resolve);
    }));
  }

  private onClientMessage(client: ws, message: any) {
    const data = JSON.parse(message);

    if (data.type === "open") {
      const path = data.path;

      this.clients.set(path, client);
      this.connectedResolve.get(path)();

      this.update(Uri.file(path));
    }

    if (data.type === "click") {
      const path = this.getPathForClient(client);
      const file = `${this.directories[path]}/preview.pdf`;

      synctex.edit(Object.assign(data, { file }));
    }
  }

  private onClientClose(closed: ws) {
    const path = this.getPathForClient(closed);

    this.clients.delete(path);
    this.listenForConnection(path);
  }

  private getPathForClient(client: ws): string {
    for (const [path, candidate] of this.clients.entries()) {
      if (client === candidate) {
        return path;
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
