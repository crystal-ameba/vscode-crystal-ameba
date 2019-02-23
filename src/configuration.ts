import { Ameba } from './ameba';

export interface AmebaConfig {
    command: string;
    configFilePath: string;
    onSave: boolean;
}

export const onDidChangeConfiguration: (ameba: Ameba) => () => void = (ameba) => {
    return () => ameba.config = getConfig();
};

export const getConfig: () => AmebaConfig = () => {
    return {
        command: 'ameba',
        configFilePath: '.ameba.yml',
        onSave: true
    };
};