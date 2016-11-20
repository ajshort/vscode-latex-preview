import LatexDocumentProvider from "./document-provider";
import { basename } from "path";
import * as vscode from "vscode";

const LATEX_SELECTOR = { language: "latex", scheme: "file" };

export function activate(ctx: vscode.ExtensionContext) {
  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand("latex-live.showPreview", showPreview),
    vscode.commands.registerCommand("latex-live.showPreviewToSide", showPreviewToSide),
    vscode.commands.registerCommand("latex-live.showSource", showSource)
  );

  // Document provider
  const renderer = new LatexDocumentProvider(ctx);

  ctx.subscriptions.push(renderer);
  ctx.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("latex-live", renderer));

  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
    if (vscode.languages.match(LATEX_SELECTOR, doc) > 0) {
      renderer.update(doc.uri);
    }
  }));
}

function showPreview(uri?: vscode.Uri, column?: vscode.ViewColumn) {
  const liveUri = uri.with({ scheme: "latex-live" });
  const title = `Preview "${basename(uri.fsPath)}"`;

  return vscode.commands.executeCommand("vscode.previewHtml", liveUri, vscode.ViewColumn.Two, title);
}

function showPreviewToSide(uri?: vscode.Uri) {
}

function showSource() {
}
