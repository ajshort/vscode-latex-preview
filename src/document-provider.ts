import * as cp from "child_process";
import { basename, dirname } from "path";
import { CancellationToken, Event, EventEmitter, TextDocumentContentProvider, Uri } from "vscode";

export default class LatexDocumentProvider implements TextDocumentContentProvider {
  private changed = new EventEmitter<Uri>();

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
          resolve(`Hello, world at ${Date.now()}`);
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
}

function quoted(str: string): string {
  return '"' + str.replace(/([\\"$])/g, "\\$1") + '"';
}
