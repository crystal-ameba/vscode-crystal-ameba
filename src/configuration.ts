import { workspace } from 'vscode';
import * as path from 'path';
import { existsSync } from 'fs';
import semver = require('semver');
import { execSync } from 'child_process';
import { outputChannel } from './extension';

export interface AmebaConfig {
    command: string;
    configFileName: string;
    onSave: boolean;
    onType: boolean;
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

    const onSave = workspaceConfig.get<boolean>("onSave", true);
    const onType = workspaceConfig.get<boolean>("onType", true) &&
        semver.satisfies(currentVersion, ">=1.6.2");

    return {
        command,
        configFileName: '.ameba.yml',
        onSave: onSave,
        onType: onType
    };
};
