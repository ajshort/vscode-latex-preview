import * as cp from "child_process";
import * as fs from "fs";
import { basename, dirname, join } from "path";
import { CancellationToken, Event, EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri } from "vscode";

export default class LatexDocumentProvider implements TextDocumentContentProvider {
  private changed = new EventEmitter<Uri>();

  constructor(private context: ExtensionContext) {
  }

  public provideTextDocumentContent(uri: Uri, token: CancellationToken): Thenable<string> {
    const path = uri.fsPath;
    const cwd = dirname(path);
    const pdf = join(cwd, "preview.pdf");

    // Build the dvi file. If it fails, display the log.
    return new Promise(resolve => {
      cp.exec(`pdflatex -jobname=preview -halt-on-error ${quoted(path)}`, { cwd }, (err, out) => {
        if (err) {
          return resolve(out);
        }

        resolve(this.getPreviewContent(pdf));
      });
    });
  }

  public update(uri: Uri) {
    this.changed.fire(uri.with({ scheme: "latex-live" }));
  }

  public get onDidChange(): Event<Uri> {
    return this.changed.event;
  }

  private getPreviewContent(url: string): string {
    const escaped = url.replace("&", "&amp;").replace('"', "&quot;");

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="${this.getModulePath("pdfjs-dist/build/pdf.js")}"></script>
      <script src="${this.getModulePath("pdfjs-dist/build/pdf.worker.js")}"></script>
      <script src="${this.getPath("src/client.js")}"></script>
    </head>
    <body class="preview">
      <canvas id="pdf" data-url="${escaped}" />
    </body>
    </html>`;
  }

  private getPath(file: string): string {
    return this.context.asAbsolutePath(file);
  }

  private getModulePath(file: string): string {
    return this.context.asAbsolutePath(join("node_modules", file));
  }
}

function readdir(path: string): Promise<string[]> {
  return new Promise((c, e) => fs.readdir(path, (err, files) => err ? e(err) : c(files)));
}

function quoted(str: string): string {
  return '"' + str.replace(/([\\"$])/g, "\\$1") + '"';
}
