import * as vscode from 'vscode';
import { BackendClient } from '../connection/BackendClient';

export function registerReviewCodeCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.reviewCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to review');
            return;
        }

        const document = editor.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const relativePath = workspaceFolder
            ? vscode.workspace.asRelativePath(document.uri)
            : document.fileName;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Reviewing code...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please review the code in ${relativePath} and provide feedback on security, performance, style, and best practices.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Code review failed: ${error.message}`);
        }
    });
}

export function registerGenerateTestsCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.generateTests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to generate tests for');
            return;
        }

        const document = editor.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const relativePath = workspaceFolder
            ? vscode.workspace.asRelativePath(document.uri)
            : document.fileName;

        const framework = await vscode.window.showQuickPick(['jest', 'mocha', 'vitest'], {
            placeHolder: 'Select testing framework',
        });

        if (!framework) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating tests...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please generate ${framework} tests for ${relativePath}. Create comprehensive test cases.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Test generation failed: ${error.message}`);
        }
    });
}

export function registerAnalyzeLogsCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.analyzeLogs', async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Log Files': ['log', 'txt'] },
        });

        if (!uris || uris.length === 0) return;

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder
            ? vscode.workspace.asRelativePath(uris[0])
            : uris[0].fsPath;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Analyzing logs...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please analyze the log file at ${relativePath} and identify errors, patterns, and provide recommendations.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Log analysis failed: ${error.message}`);
        }
    });
}

export function registerCreatePRCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.createPR', async () => {
        const repository = await vscode.window.showInputBox({
            prompt: 'Enter repository (owner/repo)',
            placeHolder: 'e.g., microsoft/vscode',
        });

        if (!repository) return;

        const title = await vscode.window.showInputBox({
            prompt: 'Enter PR title',
            placeHolder: 'Feature: Add new functionality',
        });

        if (!title) return;

        const head = await vscode.window.showInputBox({
            prompt: 'Enter source branch (head)',
            placeHolder: 'feature/my-feature',
        });

        if (!head) return;

        const base = await vscode.window.showInputBox({
            prompt: 'Enter target branch (base)',
            value: 'main',
        });

        if (!base) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Creating PR...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please create a GitHub PR in ${repository} with title "${title}", merging ${head} into ${base}.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`PR creation failed: ${error.message}`);
        }
    });
}

export function registerReviewPRCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.reviewPR', async () => {
        const repository = await vscode.window.showInputBox({
            prompt: 'Enter repository (owner/repo)',
            placeHolder: 'e.g., microsoft/vscode',
        });

        if (!repository) return;

        const prNumber = await vscode.window.showInputBox({
            prompt: 'Enter PR number',
            placeHolder: '123',
        });

        if (!prNumber) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Reviewing PR...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please review GitHub PR #${prNumber} in ${repository} and provide an analysis of the changes.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`PR review failed: ${error.message}`);
        }
    });
}

export function registerDeployDockerCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.deployDocker', async () => {
        const image = await vscode.window.showInputBox({
            prompt: 'Enter Docker image name',
            placeHolder: 'my-app',
        });

        if (!image) return;

        const containerName = await vscode.window.showInputBox({
            prompt: 'Enter container name',
            value: image,
        });

        if (!containerName) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Deploying to Docker...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please deploy Docker container "${containerName}" using image "${image}". Check if a Dockerfile exists in the workspace.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Docker deployment failed: ${error.message}`);
        }
    });
}

export function registerDeployKubernetesCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.deployKubernetes', async () => {
        const deploymentName = await vscode.window.showInputBox({
            prompt: 'Enter deployment name',
            placeHolder: 'my-app',
        });

        if (!deploymentName) return;

        const image = await vscode.window.showInputBox({
            prompt: 'Enter Docker image',
            placeHolder: 'my-app:latest',
        });

        if (!image) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Deploying to Kubernetes...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please deploy to Kubernetes with deployment name "${deploymentName}" using image "${image}".`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Kubernetes deployment failed: ${error.message}`);
        }
    });
}

export function registerMonitorCICommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.monitorCI', async () => {
        const platform = await vscode.window.showQuickPick(
            ['jenkins', 'gitlab', 'github-actions'],
            { placeHolder: 'Select CI/CD platform' }
        );

        if (!platform) return;

        let pipeline: string | undefined;
        let repository: string | undefined;

        if (platform === 'github-actions') {
            repository = await vscode.window.showInputBox({
                prompt: 'Enter repository (owner/repo)',
                placeHolder: 'microsoft/vscode',
            });
            if (!repository) return;

            pipeline = await vscode.window.showInputBox({
                prompt: 'Enter workflow name',
                placeHolder: 'ci.yml',
            });
        } else {
            pipeline = await vscode.window.showInputBox({
                prompt: 'Enter pipeline/job name',
                placeHolder: 'main-build',
            });
        }

        if (!pipeline) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Checking CI/CD status...',
                    cancellable: false,
                },
                async () => {
                    const repoInfo = repository ? ` in ${repository}` : '';
                    await client.sendMessage(
                        `Please check the status of ${platform} pipeline "${pipeline}"${repoInfo}.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`CI/CD monitoring failed: ${error.message}`);
        }
    });
}

export function registerClearConversationCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.clearConversation', () => {
        client.clearConversation();
        vscode.window.showInformationMessage('Conversation cleared');
    });
}
