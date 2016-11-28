import * as constants from "./constants";
import LatexDocumentProvider from "./document-provider";
import { basename } from "path";
import { ExtensionContext, Uri, ViewColumn, commands, languages, window, workspace } from "vscode";

/**
 * The extension's document provider instance.
 */
let provider: LatexDocumentProvider;

export function activate(ctx: ExtensionContext) {
  // Commands
  ctx.subscriptions.push(
    commands.registerCommand(constants.COMMAND_CREATE_BUILD_TASK, createBuildTask),
    commands.registerCommand(constants.COMMAND_SHOW_PREVIEW, showPreview),
    commands.registerCommand(constants.COMMAND_SHOW_PREVIEW_TO_SIDE, showPreviewToSide),
    commands.registerCommand(constants.COMMAND_SHOW_IN_PREVIEW, showInPreview),
    commands.registerCommand(constants.COMMAND_SHOW_SOURCE, showSource),
    commands.registerCommand(constants.COMMAND_SHOW_COMPILE_OUTPUT, showCompileOutput),
  );

  // Document provider
  provider = new LatexDocumentProvider(ctx);

  ctx.subscriptions.push(provider);
  ctx.subscriptions.push(workspace.registerTextDocumentContentProvider(constants.PREVIEW_SCHEME, provider));

  ctx.subscriptions.push(workspace.onDidSaveTextDocument(doc => {
    if (languages.match(constants.LATEX_SELECTOR, doc) > 0) {
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
    command: workspace.getConfiguration().get(constants.CONFIG_COMMAND, "pdflatex"),
    isShellCommand: true,
    args: ["-interaction=nonstopmode", "-file-line-error", file],
    showOutput: "silent",
    problemMatcher: {
      owner: "latex-preview",
      fileLocation: ["relative", "${workspaceRoot}"],
      pattern: {
        regexp: constants.ERROR_REGEX,
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

  const previewUri = uri.with({ scheme: constants.PREVIEW_SCHEME });
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

function showCompileOutput() {
  provider.showOutputChannel();
}
