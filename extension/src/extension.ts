import * as vscode from 'vscode';
import { BackendClient } from './connection/BackendClient';
import { AgentPanel } from './views/AgentPanel';
import { ConfigManager } from './utils/ConfigManager';
import {
    registerReviewCodeCommand,
    registerGenerateTestsCommand,
    registerAnalyzeLogsCommand,
    registerCreatePRCommand,
    registerReviewPRCommand,
    registerDeployDockerCommand,
    registerDeployKubernetesCommand,
    registerMonitorCICommand,
    registerClearConversationCommand,
    registerViewCostsCommand,
    registerPrePushCheckCommand,
    registerRunTestsCommand,
    registerGitFetchCommand,
    registerPrepareDockerDeployCommand,
} from './commands/index';

let backendClient: BackendClient;
let configManager: ConfigManager;

export function activate(context: vscode.ExtensionContext) {
    try {
        console.log('DevOps Agent Extension is now active');

        // Initialize managers
        configManager = new ConfigManager();
        backendClient = new BackendClient();

        // Register show panel command
        context.subscriptions.push(
            vscode.commands.registerCommand('devops-agent.showPanel', async () => {
                AgentPanel.createOrShow(context.extensionUri, backendClient);
                // Try to connect if not already connected
                if (!backendClient.isConnected()) {
                    try {
                        await backendClient.connect();
                    } catch (error) {
                        // Silently fail - the panel will show disconnected status
                        console.log('Failed to auto-connect:', error);
                    }
                }
            })
        );

        // Register all DevOps commands
        context.subscriptions.push(
            registerReviewCodeCommand(backendClient),
            registerGenerateTestsCommand(backendClient),
            registerAnalyzeLogsCommand(backendClient),
            registerCreatePRCommand(backendClient),
            registerReviewPRCommand(backendClient),
            registerDeployDockerCommand(backendClient),
            registerDeployKubernetesCommand(backendClient),
            registerMonitorCICommand(backendClient),
            registerClearConversationCommand(backendClient),
            registerViewCostsCommand(backendClient),
            registerPrePushCheckCommand(backendClient),
            registerRunTestsCommand(backendClient),
            registerGitFetchCommand(backendClient),
            registerPrepareDockerDeployCommand(backendClient)
        );

        // Register status bar item
        const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        statusBarItem.text = '$(robot) DevOps Agent';
        statusBarItem.command = 'devops-agent.showPanel';
        statusBarItem.tooltip = 'Open DevOps Agent';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        // Update status bar on connection changes
        backendClient.on('connected', () => {
            statusBarItem.text = '$(robot) DevOps Agent $(check)';
            statusBarItem.tooltip = 'DevOps Agent (Connected)';
        });

        backendClient.on('disconnected', () => {
            statusBarItem.text = '$(robot) DevOps Agent $(x)';
            statusBarItem.tooltip = 'DevOps Agent (Disconnected)';
        });

        // Listen for configuration changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('devopsAgent.backendUrl')) {
                    configManager.refresh();
                    const newUrl = configManager.getBackendUrl();
                    backendClient.updateBackendUrl(newUrl);
                    vscode.window.showInformationMessage(
                        `Backend URL updated to ${newUrl}. Reconnection required.`
                    );
                }
            })
        );

        console.log('DevOps Agent Extension fully activated');
    } catch (err: any) {
        console.error('Extension activation failed:', err);
        try {
            vscode.window.showErrorMessage(`DevOps Agent failed to activate: ${err?.message || err}`);
        } catch (e) {
            // ignore errors showing message
        }
    }
}

export function deactivate() {
    if (backendClient) {
        backendClient.disconnect();
    }
    console.log('DevOps Agent Extension deactivated');
}
