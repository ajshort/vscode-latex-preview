import * as vscode from "vscode";

export default class LatexDocumentProvider implements vscode.TextDocumentContentProvider {
  private changed = new vscode.EventEmitter<vscode.Uri>();

  public async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
    return `Hello, world at ${Date.now()}`;
  }

  public update(uri: vscode.Uri) {
    this.changed.fire(uri.with({ scheme: "latex-live" }));
  }

  public get onDidChange(): vscode.Event<vscode.Uri> {
    return this.changed.event;
  }
}
