import LatexDocumentProvider from "./document-provider";
import { basename } from "path";
import { ExtensionContext, Uri, ViewColumn, commands, languages, window, workspace } from "vscode";

const LATEX_SELECTOR = { language: "latex", scheme: "file" };

/**
 * The extension's document provider instance.
 */
let provider: LatexDocumentProvider;

export function activate(ctx: ExtensionContext) {
  // Commands
  ctx.subscriptions.push(
    commands.registerCommand("latex-preview.createBuildTask", createBuildTask),
    commands.registerCommand("latex-preview.showPreview", showPreview),
    commands.registerCommand("latex-preview.showPreviewToSide", showPreviewToSide),
    commands.registerCommand("latex-preview.showInPreview", showInPreview),
    commands.registerCommand("latex-preview.showSource", showSource),
  );

  // Document provider
  provider = new LatexDocumentProvider(ctx);

  ctx.subscriptions.push(provider);
  ctx.subscriptions.push(workspace.registerTextDocumentContentProvider("latex-preview", provider));

  ctx.subscriptions.push(workspace.onDidSaveTextDocument(doc => {
    if (languages.match(LATEX_SELECTOR, doc) > 0) {
      provider.update(doc.uri);
    }
  }));
}

async function createBuildTask() {
  const texes = workspace.findFiles("**/*.tex", "").then(uris => uris.map(uri => workspace.asRelativePath(uri)));
  const file = await window.showQuickPick(texes, { placeHolder: "File to build" });

  if (!file) {
    return;
  }

  workspace.getConfiguration().update("tasks", {
    version: "0.1.0",
    command: "pdflatex",
    isShellCommand: true,
    args: ["-interaction=nonstopmode", "-file-line-error", file],
    showOutput: "silent",
    problemMatcher: {
      owner: "latex-preview",
      fileLocation: ["relative", "${workspaceRoot}"],
      pattern: {
        regexp: "^(.*):(\\d+):\\s+(.*)$",
        file: 1,
        line: 2,
        message: 3,
      },
    },
  });
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

/**
 * Shows the preview and jumps to the selected location.
 */
function showInPreview() {
  const uri = window.activeTextEditor.document.uri;
  const position = window.activeTextEditor.selection.active;

  if (!uri || !position) {
    return;
  }

  return provider.showPosition(uri, position);
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
