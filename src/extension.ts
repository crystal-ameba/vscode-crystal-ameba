import {
  commands,
  ExtensionContext,
  languages,
  OutputChannel,
  window,
  workspace,
} from 'vscode';
import * as path from 'path';

import { Ameba } from './ameba';
import { getConfig, LintScope, LintTrigger } from './configuration';
import {
  getRelativePath,
  isValidCrystalDocument,
  isDocumentVirtual,
} from './helpers';

export let outputChannel: OutputChannel;

export function log(message: string) {
  outputChannel.appendLine(message);
}

export function activate(context: ExtensionContext) {
  outputChannel = window.createOutputChannel('Crystal Ameba', 'log');
  context.subscriptions.push(outputChannel);

  const diag = languages.createDiagnosticCollection('crystal');
  let ameba: Ameba | null = new Ameba(diag);

  context.subscriptions.push(diag);

  context.subscriptions.push(
    commands.registerCommand('crystal.ameba.lint', () => {
      if (ameba) {
        const editor = window.activeTextEditor;
        if (editor) {
          log('[Lint] Running ameba on current document');
          ameba.execute(editor.document);
        }
      } else {
        window
          .showWarningMessage(
            'Ameba has been disabled for this workspace.',
            'Enable'
          )
          .then(
            (enable) => {
              if (!enable) return;
              ameba = new Ameba(diag);
              const editor = window.activeTextEditor;
              if (editor) {
                log('[Enable] Running ameba on current document');
                ameba.execute(editor.document);
              }
            },
            (_) => {}
          );
      }
    })
  );

  context.subscriptions.push(
    commands.registerCommand('crystal.ameba.lint-workspace', () => {
      if (ameba) {
        log('[Lint] Running ameba on current workspace');
        executeAmebaOnWorkspace(ameba);
      } else {
        window
          .showWarningMessage(
            'Ameba has been disabled for this workspace.',
            'Enable'
          )
          .then(
            (enable) => {
              if (!enable) return;
              ameba = new Ameba(diag);
              executeAmebaOnWorkspace(ameba);
            },
            (_) => {}
          );
      }
    })
  );

  context.subscriptions.push(
    commands.registerCommand('crystal.ameba.restart', () => {
      if (ameba) {
        const editor = window.activeTextEditor;
        if (editor) {
          log(
            `[Restart] Clearing diagnostics for ${getRelativePath(editor.document)}`
          );
          ameba.clear(editor.document.uri);
        }
      } else {
        log('[Restart] Starting ameba');
        ameba = new Ameba(diag);
        executeAmebaOnWorkspace(ameba);
      }
    })
  );

  context.subscriptions.push(
    commands.registerCommand('crystal.ameba.disable', () => {
      if (!ameba) return;
      log('[Disable] Disabling ameba for this session');
      ameba.clear();
      ameba = null;
    })
  );

  context.subscriptions.push(
    workspace.onDidChangeConfiguration((_) => {
      if (!ameba) return;
      log(`[Config] Reloading diagnostics after config change`);
      ameba.config = getConfig();
      ameba.clear();
      executeAmebaOnWorkspace(ameba);
    })
  );

  executeAmebaOnWorkspace(ameba);

  // This can happen when a file is open _or_ when a file's language id changes
  context.subscriptions.push(
    workspace.onDidOpenTextDocument((doc) => {
      if (
        ameba &&
        ameba.config.trigger !== LintTrigger.None &&
        isValidCrystalDocument(doc)
      ) {
        if (isDocumentVirtual(doc)) {
          if (ameba.config.trigger === LintTrigger.Type) {
            log(`[Open] Running ameba on ${getRelativePath(doc)}`);
            ameba.execute(doc, true);
          }
        } else {
          log(`[Open] Running ameba on ${getRelativePath(doc)}`);
          ameba.execute(doc);
        }
      }
    })
  );

  context.subscriptions.push(
    workspace.onDidChangeTextDocument((e) => {
      if (
        ameba &&
        ameba.config.trigger === LintTrigger.Type &&
        isValidCrystalDocument(e.document)
      ) {
        log(`[Change] Running ameba on ${getRelativePath(e.document)}`);
        ameba.execute(e.document, isDocumentVirtual(e.document));
      }
    })
  );

  context.subscriptions.push(
    workspace.onDidSaveTextDocument((doc) => {
      if (
        ameba &&
        ameba.config.trigger === LintTrigger.Save &&
        isValidCrystalDocument(doc)
      ) {
        log(`[Save] Running ameba on ${getRelativePath(doc)}`);
        ameba.execute(doc);
      } else if (
        ameba &&
        ameba.config.trigger !== LintTrigger.None &&
        path.basename(doc.fileName) == '.ameba.yml'
      ) {
        log(`[Config] Reloading diagnostics after config file change`);
        ameba.clear();
        executeAmebaOnWorkspace(ameba);
      }
    })
  );

  context.subscriptions.push(
    workspace.onDidCloseTextDocument((doc) => {
      if (!ameba || !isValidCrystalDocument(doc)) return;
      let shouldClear = true;

      if (workspace.workspaceFolders) {
        shouldClear = !workspace.getWorkspaceFolder(doc.uri);
      }

      if (shouldClear) {
        log(`[Clear] Clearing ${getRelativePath(doc)}`);
        ameba.clear(doc.uri);
      }
    })
  );

  context.subscriptions.push(
    workspace.onDidDeleteFiles((e) => {
      if (!ameba) return;

      for (const file of e.files) {
        log(`[Delete] Clearing ${file.fsPath}`);
        ameba.clear(file);
      }
    })
  );
}

export function deactivate() {}

function executeAmebaOnWorkspace(ameba: Ameba | null) {
  if (!ameba || ameba.config.trigger === LintTrigger.None) return;

  if (ameba.config.scope === LintScope.File) {
    for (const doc of workspace.textDocuments) {
      if (isValidCrystalDocument(doc)) {
        if (isDocumentVirtual(doc)) {
          if (ameba.config.trigger === LintTrigger.Type) {
            log(`[Workspace] Running ameba on ${getRelativePath(doc)}`);
            ameba.execute(doc, true);
          }
        } else {
          log(`[Workspace] Running ameba on ${getRelativePath(doc)}`);
          ameba.execute(doc);
        }
      }
    }
  } else if (workspace.workspaceFolders) {
    for (const folder of workspace.workspaceFolders) {
      log(`[Workspace] Running ameba on ${folder.name}`);
      ameba.execute(folder);
    }
  }
}
