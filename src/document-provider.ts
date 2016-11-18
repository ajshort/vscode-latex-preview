import { CancellationToken, TextDocumentContentProvider, Uri } from "vscode";

export default class LatexDocuemntProvider implements TextDocumentContentProvider {
  public provideTextDocumentContent(uri: Uri, token: CancellationToken): string {
    return "Hello, world";
  }
}
