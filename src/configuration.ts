import { workspace } from 'vscode';
import * as path from 'path';
import { existsSync } from 'fs';
import semver = require('semver');
import { execSync } from 'child_process';

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
        if (existsSync(localAmebaPath)) command = localAmebaPath;
    }

    const workspaceConfig = workspace.getConfiguration('crystal-ameba');
    const currentVersion = execSync(`"${command}" --version`).toString();

    // Support added in ameba v1.6.3
    let onType = workspaceConfig.get<boolean>("onType", true) &&
        semver.satisfies(currentVersion, ">=1.6.3")

    return {
        command,
        configFileName: '.ameba.yml',
        onSave: true,
        onType: onType
    };
};
