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
    const base = basename(path, ".tex");

    // Build the dvi file. If it fails, display the log.
    return new Promise(resolve => {
      cp.exec(`latex -halt-on-error ${quoted(path)}`, { cwd }, (err, out) => {
        if (err) {
          return resolve(out);
        }

        // Convert the dvi file to png.
        cp.exec(`dvipng -T tight -D 200 ${base}.dvi`, { cwd }, () => {
          resolve(this.getPreviewContent(cwd));
        });
      });
    });
  }

  public update(uri: Uri) {
    this.changed.fire(uri.with({ scheme: "latex-live" }));
  }

  public get onDidChange(): Event<Uri> {
    return this.changed.event;
  }

  private async getPreviewContent(dir: string): Promise<string> {
    const pages = (await readdir(dir))
      .filter(name => name.endsWith(".png"))
      .sort()
      .map(name => join(dir, name))
      .reduce((val, img) => val.concat(`<img src="file:${img}" />`), "");

    return `<!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="${this.getMediaPath("style.css")}" />
    </head>
    <body class="preview">
      ${pages}
    </body>
    </html>`;
  }

  private getMediaPath(file: string): string {
    return this.context.asAbsolutePath(join("media", file));
  }
}

function readdir(path: string): Promise<string[]> {
  return new Promise((c, e) => fs.readdir(path, (err, files) => err ? e(err) : c(files)));
}

function quoted(str: string): string {
  return '"' + str.replace(/([\\"$])/g, "\\$1") + '"';
}
