import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { AmebaIssue, AmebaFile } from './amebaOutput';
import { TaskQueue, Task } from './taskQueue';
import { getConfig, AmebaConfig } from './configuration';
import { AmebaOutput } from './amebaOutput';
import { CpuInfo } from 'os';

function isFileUri(uri: vscode.Uri): boolean {
    return uri.scheme === 'file';
}

function getCurrentPath(fileName: string): string {
    return vscode.workspace.rootPath || path.dirname(fileName);
}

function getCommandArguments(fileName: string): string[] {
    let commandArguments = [fileName, '--format', 'json'];
    const extensionConfig = getConfig();
    if (extensionConfig.configFilePath !== '') {
        if (fs.existsSync(extensionConfig.configFilePath)) {
            const config = ['--config', extensionConfig.configFilePath];
            commandArguments = commandArguments.concat(config);
        }
    }

    return commandArguments;
}

export class Ameba {
    private diag: vscode.DiagnosticCollection;
    private taskQueue: TaskQueue = new TaskQueue();
    public config: AmebaConfig;

    constructor(
        diagnostics: vscode.DiagnosticCollection,
        additionalArguments: string[] = [],
    ) {
        this.diag = diagnostics;
        // this.additionalArguments = additionalArguments;
        this.config = getConfig();
    }

    public execute(document: vscode.TextDocument, onComplete?: () => void): void {
        if (document.languageId !== 'crystal' || document.isUntitled || !isFileUri(document.uri)) {
            return;
        }

        const fileName = document.fileName;
        const uri = document.uri;
        let currentPath = getCurrentPath(fileName);

        let onDidExec = (error: Error | null, stdout: string, stderr: string) => {
            if (this.hasError(error, stderr)) {
                return;
            }

            this.diag.delete(uri);
            let ameba = this.parse(stdout);

            if (ameba === undefined || ameba === null) {
                return;
            }

            let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];
            ameba.sources.forEach((source: AmebaFile) => {
                let diagnostics: Array<vscode.Diagnostic> = [];
                source.issues.forEach((issue: AmebaIssue) => {
                    const loc = issue.location;
                    let end_loc = issue.end_location;
                    if (end_loc === null || end_loc.line === null) {
                        end_loc = {
                            line: loc.line,
                            column: loc.column
                        };
                    }
                    const range = new vscode.Range(
                        loc.line - 1, loc.column - 1,
                        end_loc.line - 1, end_loc.column - 1
                    );
                    const sev = vscode.DiagnosticSeverity.Error;
                    const message = `[${issue.rule_name}] ${issue.message}`;
                    const diagnostic = new vscode.Diagnostic(range, message, sev);
                    diagnostics.push(diagnostic);
                });
                entries.push([uri, diagnostics]);
            });
            this.diag.set(entries);
        };

        const args = getCommandArguments(fileName);

        let task = new Task(uri, token => {
            let process = this.executeAmeba(args, document.getText(), {}, (error, stdout, stderr) => {
                if (token.isCanceled) {
                    return;
                }
                onDidExec(error, stdout, stderr);
                token.finished();
                if (onComplete) {
                    onComplete();
                }
            });
            return () => process.kill();
        });
        this.taskQueue.enqueue(task);
    }

    public clear(document: vscode.TextDocument): void {
        let uri = document.uri;
        if (isFileUri(uri)) {
            this.taskQueue.cancel(uri);
            this.diag.delete(uri);
        }
    }

    private executeAmeba(
        args: string[],
        fileContents: string,
        options: cp.ExecFileOptions,
        cb: (err: Error | null, stdout: string, stderr: string) => void): cp.ChildProcess {
        let cmd = `${this.config.command} ${args.join(' ')}`;
        let child = cp.exec(cmd, options, cb);
        child.stdin.write(fileContents);
        child.stdin.end();
        return child;
    }

    // checking ameba output has error
    private hasError(error: Error | null, stderr: string): boolean {
        let errorOutput = stderr.toString();
        if (error && (<any>error).code === 'ENOENT') {
            console.error(error);
            vscode.window.showWarningMessage(`${this.config.command} is not executable`);
            return true;
        } else if (error && (<any>error).code === 127) {
            vscode.window.showWarningMessage(stderr);
            return true;
        } else if (errorOutput.length > 0) {
            vscode.window.showErrorMessage(stderr);
            return true;
        }

        return false;
    }

    private parse(output: string): AmebaOutput | null {
        if (output.length < 1) {
            let message = `command ${this.config.command} returns empty output!`;
            vscode.window.showWarningMessage(message);

            return null;
        }

        try {
            return JSON.parse(output);
        } catch(e) {
            if (e instanceof SyntaxError) {
                let errorMessage = `Error on parsing output (It might non-JSON output) : "${output}"`;
                vscode.window.showWarningMessage(errorMessage);

                return null;
            }
        }

        return null;
    }
}