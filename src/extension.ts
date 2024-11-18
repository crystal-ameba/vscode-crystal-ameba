import { commands, ExtensionContext, languages, TextDocument, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { Ameba } from './ameba';
import { getConfig } from './configuration';
import path = require('path');

export const outputChannel = window.createOutputChannel("Crystal Ameba", "log")

export function activate(context: ExtensionContext) {
    const diag = languages.createDiagnosticCollection('crystal');
    let ameba: Ameba | null = new Ameba(diag);
    context.subscriptions.push(diag);

    context.subscriptions.push(
        commands.registerCommand('crystal.ameba.lint', () => {
            if (ameba) {
                outputChannel.appendLine('[Lint] Running ameba on current document')
                const editor = window.activeTextEditor;
                if (editor) ameba.execute(editor.document);
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
            const editor = window.activeTextEditor;
            if (editor) ameba.clear(editor.document);
            ameba = null;
        })
    );

    workspace.onDidChangeConfiguration(_ => {
        if (!ameba) return;
        outputChannel.appendLine(`[Config] Reloading config`)
        ameba.config = getConfig();
    });

    executeAmebaOnWorkspace(ameba);

    workspace.onDidOpenTextDocument(doc => {
        if (ameba && checkValidDocument(doc)) {
            outputChannel.appendLine(`[Open] Running ameba on ${getRelativePath(doc)}`)
            ameba.execute(doc);
        }
    });

    workspace.onDidChangeTextDocument(e => {
        if (ameba && ameba.config.onType && checkValidDocument(e.document)) {
            outputChannel.appendLine(`[Change] Running ameba on ${getRelativePath(e.document)}`)
            ameba.execute(e.document, true);
        }
    })

    workspace.onDidSaveTextDocument(doc => {
        // If onType is enabled, it will be run when saving
        if (ameba && ameba.config.onSave && !ameba.config.onType && checkValidDocument(doc)) {
            outputChannel.appendLine(`[Save] Running ameba on ${getRelativePath(doc)}`)
            ameba.execute(doc);
        } else if (ameba && path.basename(doc.fileName) == ".ameba.yml") {
            outputChannel.appendLine(`[Config] Clearing all diagnostics after config file change`)
            ameba.clear();
            executeAmebaOnWorkspace(ameba);
        }
    });

    workspace.onDidCloseTextDocument(doc => {
        if (ameba && checkValidDocument(doc)) {
            outputChannel.appendLine(`[Close] Clearing ${getRelativePath(doc)}`)
            ameba.clear(doc);
        }
    });
}

function executeAmebaOnWorkspace(ameba: Ameba | null) {
    if (!ameba) return;

    workspace.textDocuments.forEach(doc => {
        if (checkValidDocument(doc)) {
            outputChannel.appendLine(`[Init] Running ameba on ${getRelativePath(doc)}`);
            ameba.execute(doc);
        }
    });
}

export function deactivate() { }

function checkValidDocument(document: TextDocument): boolean {
    return document.languageId === 'crystal' && !document.isUntitled && document.uri.scheme === 'file'
}

function getRelativePath(document: TextDocument): string {
    const space: WorkspaceFolder = workspace.getWorkspaceFolder(document.uri) ?? noWorkspaceFolder(document)
    return path.relative(space.uri.fsPath, document.uri.fsPath)
}

export function noWorkspaceFolder(document: TextDocument): WorkspaceFolder {
    return {
        uri: Uri.parse(path.dirname(document.uri.fsPath)),
        name: path.basename(path.dirname(document.uri.fsPath)),
        index: -1
    }
}
