import { workspace } from 'vscode';
import * as path from 'path';
import { existsSync } from 'fs';
import * as semver from 'semver';
import { execSync } from 'child_process';

import { outputChannel } from './extension';

export interface AmebaConfig {
    command: string;
    configFileName: string;
    trigger: LintTrigger;
}

export enum LintTrigger {
    None = "none",
    Save = "save",
    Type = "type"
}

export function getConfig(): AmebaConfig {
    let command = 'ameba';
    const root = workspace.workspaceFolders || [];
    if (root.length) {
        const localAmebaPath = path.join(root[0].uri.fsPath, 'bin', 'ameba');
        if (existsSync(localAmebaPath)) {
            outputChannel.appendLine(`[Config] Using local ameba at ${localAmebaPath}`)
            command = localAmebaPath;
        } else {
            outputChannel.appendLine(`[Config] Using system ameba`)
        }
    }

    const workspaceConfig = workspace.getConfiguration('crystal-ameba');
    const currentVersion = execSync(`"${command}" --version`).toString();

    let trigger = workspaceConfig.get<LintTrigger>("lint-trigger", LintTrigger.Type);

    if (!semver.satisfies(currentVersion, ">=1.6.4") && trigger == LintTrigger.Type) {
        trigger = LintTrigger.Save;
    }

    return {
        command,
        configFileName: '.ameba.yml',
        trigger: trigger
    };
};
