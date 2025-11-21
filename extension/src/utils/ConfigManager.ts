import * as vscode from 'vscode';

export class ConfigManager {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('devopsAgent');
    }

    refresh(): void {
        this.config = vscode.workspace.getConfiguration('devopsAgent');
    }

    getBackendUrl(): string {
        return this.config.get('backendUrl', 'http://localhost:3000');
    }

    getAutoConnect(): boolean {
        return this.config.get('autoConnect', true);
    }

    getGitHubToken(): string {
        return this.config.get('githubToken', '');
    }

    getDefaultRepository(): string {
        return this.config.get('defaultRepository', '');
    }

    async setBackendUrl(url: string): Promise<void> {
        await this.config.update('backendUrl', url, vscode.ConfigurationTarget.Global);
        this.refresh();
    }

    async setGitHubToken(token: string): Promise<void> {
        await this.config.update('githubToken', token, vscode.ConfigurationTarget.Global);
        this.refresh();
    }

    async setDefaultRepository(repo: string): Promise<void> {
        await this.config.update('defaultRepository', repo, vscode.ConfigurationTarget.Global);
        this.refresh();
    }
}
