import { workspace } from 'vscode';
import * as path from 'path';
import { existsSync } from 'fs';

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

    return {
        command,
        configFileName: '.ameba.yml',
        onSave: true,
        onType: workspaceConfig.get<boolean>("onType") || false
    };
};
