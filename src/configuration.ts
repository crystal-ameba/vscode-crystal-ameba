import { Ameba } from './ameba';

export interface AmebaConfig {
    command: string;
    configFileName: string;
    onSave: boolean;
}

export const onDidChangeConfiguration: (ameba: Ameba) => () => void = (ameba) => {
    return () => ameba.config = getConfig();
};

export const getConfig: () => AmebaConfig = () => {
    return {
        command: 'ameba',
        configFileName: '.ameba.yml',
        onSave: true
    };
};