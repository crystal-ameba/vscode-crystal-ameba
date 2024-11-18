import {
    commands, ExtensionContext, languages,
    TextDocument, Uri, window,
    workspace, WorkspaceFolder
} from 'vscode';
import * as path from 'path';

import { Ameba } from './ameba';
import { getConfig, LintTrigger, LintScope } from './configuration';


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
        commands.registerCommand('crystal.ameba.lint-workspace', () => {
            if (ameba) {
                outputChannel.appendLine('[Lint] Running ameba on current workspace')

                if (!ameba) return;

                workspace.workspaceFolders?.forEach(folder => {
                    ameba && ameba.executeFolder(folder);
                })

            } else {
                window.showWarningMessage(
                    'Ameba has been disabled for this workspace.',
                    'Enable'
                ).then(
                    enable => {
                        if (!enable) return;
                        ameba = new Ameba(diag);

                        workspace.workspaceFolders?.forEach(folder => {
                            ameba && ameba.executeFolder(folder);
                        })
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
        outputChannel.appendLine(`[Config] Reloading config`)
        ameba.config = getConfig();

        outputChannel.appendLine(`[Config] Clearing all diagnostics after config change`)
        ameba.clear();
        executeAmebaOnWorkspace(ameba);
    });

    executeAmebaOnWorkspace(ameba);

    workspace.onDidOpenTextDocument(doc => {
        if (ameba && ameba.config.lintTrigger != LintTrigger.None && documentIsOnDisk(doc)) {
            outputChannel.appendLine(`[Open] Running ameba on ${getRelativePath(doc)}`)
            ameba.execute(doc);
        }
    });

    workspace.onDidChangeTextDocument(e => {
        if (ameba && ameba.config.lintTrigger == LintTrigger.Type && e.document.languageId === 'crystal') {
            outputChannel.appendLine(`[Change] Running ameba on ${getRelativePath(e.document)}`)
            ameba.execute(e.document, true);
        }
    })

    workspace.onDidSaveTextDocument(doc => {
        // If onType is enabled, it will be run when saving
        if (ameba && ameba.config.lintTrigger == LintTrigger.Save && documentIsOnDisk(doc)) {
            outputChannel.appendLine(`[Save] Running ameba on ${getRelativePath(doc)}`)
            ameba.execute(doc);
        } else if (ameba && path.basename(doc.fileName) == ".ameba.yml") {
            outputChannel.appendLine(`[Config] Clearing all diagnostics after config file change`)
            ameba.clear();
            executeAmebaOnWorkspace(ameba);
        }
    });

    workspace.onDidCloseTextDocument(doc => {
        if (ameba && doc.languageId === 'crystal' && ameba.config.lintScope == LintScope.File) {
            outputChannel.appendLine(`[Close] Clearing ${getRelativePath(doc)}`)
            ameba.clear(doc);
        }
    });
}

function executeAmebaOnWorkspace(ameba: Ameba | null) {
    if (!ameba) return;

    if (ameba.config.lintScope == LintScope.File) {
        workspace.textDocuments.forEach(doc => {
            if (documentIsOnDisk(doc) && !doc.isClosed) {
                outputChannel.appendLine(`[Init] Running ameba on ${getRelativePath(doc)}`);
                ameba.execute(doc);
            }
        });
    } else {
        workspace.workspaceFolders?.forEach(folder => {
            outputChannel.appendLine(`[Init] Running ameba on ${folder.name}`);
            ameba && ameba.executeFolder(folder);
        })
    }
}

export function deactivate() { }

function documentIsOnDisk(doc: TextDocument): boolean {
    return doc.languageId === 'crystal' && !doc.isUntitled && doc.uri.scheme === 'file'
}

function getRelativePath(document: TextDocument): string {
    const space: WorkspaceFolder = workspace.getWorkspaceFolder(document.uri) ?? noWorkspaceFolder(document.uri)
    return path.relative(space.uri.fsPath, document.uri.fsPath)
}

export function noWorkspaceFolder(uri: Uri): WorkspaceFolder {
    return {
        uri: Uri.parse(path.dirname(uri.fsPath)),
        name: path.basename(path.dirname(uri.fsPath)),
        index: -1
    }
}
