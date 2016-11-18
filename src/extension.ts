import LatexDocumentProvider from "./document-provider";
import { basename } from "path";
import { ExtensionContext, Uri, ViewColumn, commands, window, workspace } from "vscode";

export function activate(ctx: ExtensionContext) {
  ctx.subscriptions.push(
    commands.registerCommand("latex-live.showPreview", showPreview),
    commands.registerCommand("latex-live.showPreviewToSide", showPreviewToSide),
    commands.registerCommand("latex-live.showSource", showSource)
  );

  ctx.subscriptions.push(workspace.registerTextDocumentContentProvider("latex-live", new LatexDocumentProvider()));
}

function showPreview(uri?: Uri, column?: ViewColumn) {
  const liveUri = uri.with({ scheme: "latex-live" });
  const title = `Preview "${basename(uri.fsPath)}"`;

  return commands.executeCommand("vscode.previewHtml", liveUri, column, title);
}

function showPreviewToSide(uri?: Uri) {
}

function showSource() {
}
