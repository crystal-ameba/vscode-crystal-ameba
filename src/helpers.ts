import * as path from 'path';
import { TextDocument, Uri, workspace, WorkspaceFolder } from 'vscode';

export function noWorkspaceFolder(uri: Uri): WorkspaceFolder {
  const firstWorkspaceFolder = workspace.workspaceFolders?.[0];
  if (uri.scheme === 'untitled' && firstWorkspaceFolder) {
    return firstWorkspaceFolder;
  }

  return {
    uri: Uri.file(path.dirname(uri.fsPath)),
    name: path.basename(path.dirname(uri.fsPath)),
    index: -1,
  };
}

export function getRelativePath(document: TextDocument): string {
  if (document.uri.scheme === 'untitled') {
    return document.fileName;
  }

  const space: WorkspaceFolder =
    workspace.getWorkspaceFolder(document.uri) ??
    noWorkspaceFolder(document.uri);
  return path.relative(space.uri.fsPath, document.uri.fsPath);
}

export function isValidCrystalDocument(doc: TextDocument): boolean {
  return (
    ['crystal', 'html.ecr'].includes(doc.languageId) &&
    ['file', 'untitled'].includes(doc.uri.scheme)
  );
}

export function isDocumentVirtual(document: TextDocument): boolean {
  return (
    document.isDirty ||
    document.isUntitled ||
    document.uri.scheme === 'untitled'
  );
}

export function isTextDocument(
  document: TextDocument | WorkspaceFolder
): document is TextDocument {
  return (document as TextDocument).languageId !== undefined;
}
