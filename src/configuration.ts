import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface AmebaConfig {
    command: string;
    configFileName: string;
    onSave: boolean;
}

export const getConfig: () => AmebaConfig = () => {
    let command = 'ameba';
    const wsRoot = vscode.workspace.rootPath;
    if (wsRoot) {
        const localAmebaPath = path.join(wsRoot, 'bin', 'ameba');
        if (fs.existsSync(localAmebaPath)) {
            command = localAmebaPath;
        }
    }
    return {
        command: command,
        configFileName: '.ameba.yml',
        onSave: true
    };
};
