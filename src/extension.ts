import LatexDocumentProvider from "./document-provider";
import { basename } from "path";
import { ExtensionContext, Uri, ViewColumn, commands, languages, window, workspace } from "vscode";

const LATEX_SELECTOR = { language: "latex", scheme: "file" };

export function activate(ctx: ExtensionContext) {
  // Commands
  ctx.subscriptions.push(
    commands.registerCommand("latex-preview.showPreview", showPreview),
    commands.registerCommand("latex-preview.showPreviewToSide", showPreviewToSide),
    commands.registerCommand("latex-preview.showSource", showSource)
  );

  // Document provider
  const renderer = new LatexDocumentProvider(ctx);

  ctx.subscriptions.push(renderer);
  ctx.subscriptions.push(workspace.registerTextDocumentContentProvider("latex-preview", renderer));

  ctx.subscriptions.push(workspace.onDidSaveTextDocument(doc => {
    if (languages.match(LATEX_SELECTOR, doc) > 0) {
      renderer.update(doc.uri);
    }
  }));
}

function showPreview(uri?: Uri, column?: ViewColumn) {
  if (!uri && window.activeTextEditor) {
    uri = window.activeTextEditor.document.uri;
  }

  if (!uri) {
    return;
  }

  if (!column) {
    column = window.activeTextEditor ? window.activeTextEditor.viewColumn : ViewColumn.One;
  }

  const previewUri = uri.with({ scheme: "latex-preview" });
  const title = `Preview "${basename(uri.fsPath)}"`;

  return commands.executeCommand("vscode.previewHtml", previewUri, column, title);
}

function showPreviewToSide(uri?: Uri) {
  if (!window.activeTextEditor) {
    return showPreview(uri);
  }

  switch (window.activeTextEditor.viewColumn) {
    case ViewColumn.One: return showPreview(uri, ViewColumn.Two);
    case ViewColumn.Two: return showPreview(uri, ViewColumn.Three);
    default: return showPreview(uri, ViewColumn.One);
  }
}

function showSource(uri?: Uri) {
  if (!uri) {
    return commands.executeCommand("workbench.action.navigateBack");
  }

  uri = uri.with({ scheme: "file" });

  for (const editor of window.visibleTextEditors) {
    if (editor.document.uri.toString() === uri.toString()) {
      return window.showTextDocument(editor.document, editor.viewColumn);
    }
  }

  return workspace.openTextDocument(uri).then(window.showTextDocument);
}
