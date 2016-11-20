import LatexDocumentProvider from "./document-provider";
import { basename } from "path";
import * as vscode from "vscode";

const LATEX_SELECTOR = { language: "latex", scheme: "file" };

export function activate(ctx: vscode.ExtensionContext) {
  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand("latex-preview.showPreview", showPreview),
    vscode.commands.registerCommand("latex-preview.showPreviewToSide", showPreviewToSide),
    vscode.commands.registerCommand("latex-preview.showSource", showSource)
  );

  // Document provider
  const renderer = new LatexDocumentProvider(ctx);

  ctx.subscriptions.push(renderer);
  ctx.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("latex-preview", renderer));

  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
    if (vscode.languages.match(LATEX_SELECTOR, doc) > 0) {
      renderer.update(doc.uri);
    }
  }));
}

function showPreview(uri?: vscode.Uri, column?: vscode.ViewColumn) {
  const previewUri = uri.with({ scheme: "latex-preview" });
  const title = `Preview "${basename(uri.fsPath)}"`;

  return vscode.commands.executeCommand("vscode.previewHtml", previewUri, vscode.ViewColumn.Two, title);
}

function showPreviewToSide(uri?: vscode.Uri) {
}

function showSource() {
}
