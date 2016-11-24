import * as constants from "./constants";
import * as synctex from "./synctex";
import * as cp from "child_process";
import * as http from "http";
import * as tmp from "tmp";
import { CancellationToken, Diagnostic, DiagnosticCollection, DiagnosticSeverity, ExtensionContext, Position, Range,
         Selection, TextDocumentContentProvider, Uri, commands, languages, window, workspace } from "vscode";
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

  private diagnostics: DiagnosticCollection;

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

    this.diagnostics = languages.createDiagnosticCollection("LaTeX Preview");
  }

  public dispose() {
    this.server.close();
    this.diagnostics.dispose();
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
      <div id="error-indicator">⚠</div>
    </body>
    </html>`;
  }

  public update(uri: Uri) {
    const path = uri.fsPath;

    if (!this.isPreviewing(path)) {
      return;
    }

    this.build(path, this.directories[path])
      .then(pdf => ({ type: "update", path: pdf }))
      .catch(() => ({ type: "error" }))
      .then(data => this.clients.get(path).send(JSON.stringify(data)));
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
    let command = workspace.getConfiguration().get(constants.CONFIG_COMMAND, "pdflatex");
    command = `${command} -jobname=preview -synctex=1 -interaction=nonstopmode -file-line-error ${arg(path)}`;

    return new Promise((resolve, reject) => {
      cp.exec(command, { cwd }, (err, out) => {
        this.diagnostics.clear();

        if (err) {
          let regexp = new RegExp(constants.ERROR_REGEX, "gm");
          let entries: [Uri, Diagnostic[]][] = [];
          let matches: RegExpExecArray;

          while ((matches = regexp.exec(out)) != null) {
            const line = parseInt(matches[2], 10) - 1;
            const range = new Range(line, 0, line, Number.MAX_VALUE);

            entries.push([Uri.file(matches[1]), [new Diagnostic(range, matches[3], DiagnosticSeverity.Error)]]);
          }

          this.diagnostics.set(entries);

          reject(err);
        } else {
          resolve(`${cwd}/preview.pdf`);
        }
      });
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
      this.onClientClick(client, data);
    }
  }

  private async onClientClick(client: ws, data: any) {
    const path = this.getPathForClient(client);
    const file = `${this.directories[path]}/preview.pdf`;

    const location = await synctex.edit(Object.assign(data, { file }));

    if (!location) {
      return;
    }

    const character = (location.column > 0) ? location.column - 1 : 0;
    const position = new Position(location.line - 1, character);

    const document = await workspace.openTextDocument(location.input);
    const editor = await window.showTextDocument(document);
    editor.selection = new Selection(position, position);
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
