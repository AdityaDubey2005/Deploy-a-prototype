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

        const absolutePath = document.uri.fsPath;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Reviewing code...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Please review the code in file "${relativePath}" (located at "${absolutePath}"). Check for security issues, performance problems, code style, and best practices. Provide specific recommendations.`
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

        const absolutePath = document.uri.fsPath;

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
                        `Generate comprehensive ${framework} tests for the file "${relativePath}" (${absolutePath}). Include edge cases, error scenarios, and good coverage.`
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

        const absolutePath = uris[0].fsPath;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Analyzing logs...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Analyze the log file "${relativePath}" (${absolutePath}). Identify errors, patterns, anomalies, and provide actionable recommendations to fix issues.`
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

export function registerViewCostsCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.viewCosts', async () => {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Loading API cost data...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        'Show me my API usage costs with a breakdown by provider and model. Include today, this week, and this month.'
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load costs: ${error.message}`);
        }
    });
}

export function registerPrePushCheckCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.prePushCheck', async () => {
        const autoFix = await vscode.window.showQuickPick(
            ['Yes - Auto-fix linting issues', 'No - Only report issues'],
            { placeHolder: 'Auto-fix linting issues?' }
        );

        if (!autoFix) return;

        const shouldAutoFix = autoFix.startsWith('Yes');

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Running pre-push validation...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Run pre-push validation on my code. Check git status, run linting${shouldAutoFix ? ' and auto-fix issues' : ''}, execute tests, check for sensitive data, and verify the build. Tell me if it's safe to push.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Pre-push validation failed: ${error.message}`);
        }
    });
}

export function registerRunTestsCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.runTests', async () => {
        const withCoverage = await vscode.window.showQuickPick(
            ['Yes - With coverage report', 'No - Standard test run'],
            { placeHolder: 'Run with coverage?' }
        );

        if (!withCoverage) return;

        const coverage = withCoverage.startsWith('Yes');

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Running tests...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Run all tests in this project${coverage ? ' with a coverage report' : ''}. Show me the results with pass/fail counts.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Test execution failed: ${error.message}`);
        }
    });
}

export function registerGitFetchCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.gitFetch', async () => {
        const prune = await vscode.window.showQuickPick(
            ['Yes - Prune deleted branches', 'No - Standard fetch'],
            { placeHolder: 'Prune deleted remote branches?' }
        );

        if (!prune) return;

        const shouldPrune = prune.startsWith('Yes');

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Fetching from remote...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Fetch the latest changes from origin${shouldPrune ? ' and prune deleted branches' : ''}. Let me know what was updated.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Git fetch failed: ${error.message}`);
        }
    });
}

export function registerPrepareDockerDeployCommand(client: BackendClient): vscode.Disposable {
    return vscode.commands.registerCommand('devops-agent.prepareDockerDeploy', async () => {
        const appName = await vscode.window.showInputBox({
            prompt: 'Enter application name for deployment (leave empty for default)',
            placeHolder: 'my-app',
        });

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Preparing Docker deployment...',
                    cancellable: false,
                },
                async () => {
                    await client.sendMessage(
                        `Prepare this project for Docker deployment${appName ? ` with the name "${appName}"` : ''}. Auto-generate Dockerfile, .dockerignore, render.yaml, and deployment guide. Make sure everything is ready for cloud deployment.`
                    );
                }
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Deployment preparation failed: ${error.message}`);
        }
    });
}
