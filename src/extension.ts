import {
    commands, ExtensionContext, languages,
    TextDocument, Uri, window,
    workspace, WorkspaceFolder
} from 'vscode';
import * as path from 'path'

import { Ameba } from './ameba';
import { getConfig } from './configuration';


export const outputChannel = window.createOutputChannel("Crystal Ameba", "log")

export function activate(context: ExtensionContext) {
    const diag = languages.createDiagnosticCollection('crystal');
    let ameba: Ameba | null = new Ameba(diag);
    context.subscriptions.push(diag);

    context.subscriptions.push(
        commands.registerCommand('crystal.ameba.lint', () => {
            if (ameba) {
                const editor = window.activeTextEditor;
                if (editor) {
                    outputChannel.appendLine('[Lint] Running ameba on current document')
                    ameba.execute(editor.document);
                }
            } else {
                window.showWarningMessage(
                    'Ameba has been disabled for this workspace.',
                    'Enable'
                ).then(
                    enable => {
                        if (!enable) return;
                        ameba = new Ameba(diag);
                        const editor = window.activeTextEditor;
                        if (editor) ameba.execute(editor.document);
                    },
                    _ => { }
                );
            }
        })
    );

    context.subscriptions.push(
        commands.registerCommand('crystal.ameba.restart', () => {
            if (ameba) {
                const editor = window.activeTextEditor;
                if (editor) {
                    outputChannel.appendLine(`[Restart] Clearing diagnostics for ${getRelativePath(editor.document)}`)
                    ameba.clear(editor.document);
                }
            } else {
                outputChannel.appendLine('[Restart] Starting ameba')
                ameba = new Ameba(diag);
            }
        })
    );

    context.subscriptions.push(
        commands.registerCommand('crystal.ameba.disable', () => {
            if (!ameba) return;
            outputChannel.appendLine('[Disable] Disabling ameba for this session')
            ameba.clear();
            ameba = null;
        })
    );

    workspace.onDidChangeConfiguration(_ => {
        if (!ameba) return;
        outputChannel.appendLine(`[Config] Reloading diagnostics after config change`)
        ameba.config = getConfig();
        ameba.clear()
        executeAmebaOnWorkspace(ameba)
    });

    workspace.textDocuments.forEach(doc => {
        ameba && ameba.execute(doc);
    });

    workspace.onDidOpenTextDocument(doc => {
        ameba && ameba.execute(doc);
    });

    workspace.onDidSaveTextDocument(doc => {
        if (ameba && doc.languageId === 'crystal' && !doc.isUntitled && doc.uri.scheme === 'file') {
            outputChannel.appendLine(`[Save] Running ameba on ${getRelativePath(doc)}`)
            ameba.execute(doc);
        } else if (ameba && path.basename(doc.fileName) == ".ameba.yml") {
            outputChannel.appendLine(`[Config] Reloading diagnostics after config file change`)
            ameba.clear();
            executeAmebaOnWorkspace(ameba);
        }
    });

    workspace.onDidCloseTextDocument(doc => {
        ameba && ameba.clear(doc);
    });
}

export function deactivate() { }

function executeAmebaOnWorkspace(ameba: Ameba | null) {
    if (!ameba) return;

    workspace.textDocuments.forEach(doc => {
        if (doc.languageId === 'crystal' && !doc.isUntitled &&
            doc.uri.scheme === 'file' && !doc.isClosed) {
            outputChannel.appendLine(`[Init] Running ameba on ${getRelativePath(doc)}`);
            ameba.execute(doc);
        }
    });
}

function getRelativePath(document: TextDocument): string {
    const space: WorkspaceFolder = workspace.getWorkspaceFolder(document.uri) ?? noWorkspaceFolder
        (document.uri)
    return path.relative(space.uri.fsPath, document.uri.fsPath)
}

export function noWorkspaceFolder(uri: Uri): WorkspaceFolder {
    return {
        uri: Uri.parse(path.dirname(uri.fsPath)),
        name: path.basename(path.dirname(uri.fsPath)),
        index: -1
    }
}
