import { Tool } from '../../types/index.js';
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import * as path from 'path';
import { logger } from '../../utils/logger.js';

// Initialize Git in the current workspace
export const GitInitTool: Tool = {
    name: 'git_init',
    description: 'Initialize a Git repository in the workspace',
    parameters: [
        {
            name: 'directory',
            type: 'string',
            description: 'Directory to initialize (default is workspace root)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const directory = args.directory || '.';
        const workspaceRoot = context.workspaceRoot || process.cwd();
        const targetDir = path.join(workspaceRoot, directory);

        try {
            execSync('git init', { cwd: targetDir, encoding: 'utf-8' });
            logger.info(`Initialized Git repository in ${targetDir}`);
            return `✅ Initialized Git repository in ${directory}`;
        } catch (error: any) {
            return `❌ Failed to initialize Git repository: ${error.message}`;
        }
    }
};

// Create a GitHub repository
export const CreateGitHubRepoTool: Tool = {
    name: 'create_github_repo',
    description: 'Create a new repository on GitHub',
    parameters: [
        {
            name: 'name',
            type: 'string',
            description: 'Repository name',
            required: true
        },
        {
            name: 'description',
            type: 'string',
            description: 'Repository description',
            required: false
        },
        {
            name: 'private',
            type: 'boolean',
            description: 'Make repository private (default: false)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, _context: any): Promise<string> => {
        const { name, description = '', private: isPrivate = false } = args;

        if (!process.env.GITHUB_TOKEN) {
            return '❌ GitHub token not configured. Please set GITHUB_TOKEN in .env file.';
        }

        try {
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

            const response = await octokit.repos.createForAuthenticatedUser({
                name,
                description,
                private: isPrivate,
                auto_init: false
            });

            logger.info(`Created GitHub repository: ${response.data.full_name}`);

            return `✅ Created repository: ${response.data.html_url}\n\nClone URL: ${response.data.clone_url}`;
        } catch (error: any) {
            logger.error('Failed to create GitHub repository:', error);
            return `❌ Failed to create repository: ${error.message}`;
        }
    }
};

// Add and commit changes
export const GitCommitTool: Tool = {
    name: 'git_commit',
    description: 'Stage and commit changes in the Git repository',
    parameters: [
        {
            name: 'message',
            type: 'string',
            description: 'Commit message',
            required: true
        },
        {
            name: 'files',
            type: 'string',
            description: 'Files to stage (default: all changes with ".")',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { message, files = '.' } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            // Stage files
            execSync(`git add ${files}`, { cwd: workspaceRoot, encoding: 'utf-8' });

            // Commit
            const output = execSync(`git commit -m "${message}"`, {
                cwd: workspaceRoot,
                encoding: 'utf-8'
            });

            logger.info(`Committed changes: ${message}`);
            return `✅ Committed changes:\n${output}`;
        } catch (error: any) {
            if (error.message.includes('nothing to commit')) {
                return '⚠️ No changes to commit.';
            }
            return `❌ Failed to commit: ${error.message}`;
        }
    }
};

// Add remote origin
export const GitAddRemoteTool: Tool = {
    name: 'git_add_remote',
    description: 'Add a remote repository URL to the local Git repo',
    parameters: [
        {
            name: 'url',
            type: 'string',
            description: 'Remote repository URL (e.g., https://github.com/user/repo.git)',
            required: true
        },
        {
            name: 'name',
            type: 'string',
            description: 'Remote name (default: origin)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { url, name = 'origin' } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            let remoteUrl = url;

            // Inject GITHUB_TOKEN if available and it's a GitHub URL
            if (process.env.GITHUB_TOKEN && url.includes('github.com') && !url.includes('@')) {
                remoteUrl = url.replace('https://', `https://x-access-token:${process.env.GITHUB_TOKEN}@`);
            }

            execSync(`git remote add ${name} ${remoteUrl}`, {
                cwd: workspaceRoot,
                encoding: 'utf-8'
            });

            // Log without token
            logger.info(`Added remote ${name}: ${url}`);
            return `✅ Added remote "${name}": ${url}`;
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                return `⚠️ Remote "${name}" already exists. Use git_remove_remote first.`;
            }
            return `❌ Failed to add remote: ${error.message}`;
        }
    }
};

// Remove remote
export const GitRemoveRemoteTool: Tool = {
    name: 'git_remove_remote',
    description: 'Remove a remote repository from the local Git repo',
    parameters: [
        {
            name: 'name',
            type: 'string',
            description: 'Remote name to remove (default: origin)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { name = 'origin' } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            execSync(`git remote remove ${name}`, {
                cwd: workspaceRoot,
                encoding: 'utf-8'
            });

            logger.info(`Removed remote ${name}`);
            return `✅ Removed remote "${name}"`;
        } catch (error: any) {
            return `❌ Failed to remove remote: ${error.message}`;
        }
    }
};

// Set remote branch
export const GitRemoteSetBranchTool: Tool = {
    name: 'git_remote_set_branch',
    description: 'Set the default branch for a remote',
    parameters: [
        {
            name: 'remote',
            type: 'string',
            description: 'Remote name (default: origin)',
            required: false
        },
        {
            name: 'branch',
            type: 'string',
            description: 'Branch name to track',
            required: true
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { remote = 'origin', branch } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            execSync(`git remote set-head ${remote} ${branch}`, {
                cwd: workspaceRoot,
                encoding: 'utf-8'
            });

            logger.info(`Set ${remote} head to ${branch}`);
            return `✅ Set remote "${remote}" head to "${branch}"`;
        } catch (error: any) {
            return `❌ Failed to set remote branch: ${error.message}`;
        }
    }
};

// Create or switch branch
export const GitBranchTool: Tool = {
    name: 'git_branch',
    description: 'Create or switch to a branch',
    parameters: [
        {
            name: 'name',
            type: 'string',
            description: 'Branch name',
            required: true
        },
        {
            name: 'create',
            type: 'boolean',
            description: 'Create new branch (default: true if not exists)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { name, create = true } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            let command = `git checkout ${name}`;

            // Check if branch exists
            try {
                execSync(`git show-ref --verify refs/heads/${name}`, { cwd: workspaceRoot });
            } catch {
                // Branch doesn't exist, create it if requested
                if (create) {
                    command = `git checkout -b ${name}`;
                } else {
                    return `❌ Branch "${name}" does not exist.`;
                }
            }

            execSync(command, { cwd: workspaceRoot, encoding: 'utf-8' });
            logger.info(`Switched to branch ${name}`);
            return `✅ Switched to branch "${name}"`;
        } catch (error: any) {
            return `❌ Failed to switch branch: ${error.message}`;
        }
    }
};

// Push to remote
export const GitPushTool: Tool = {
    name: 'git_push',
    description: 'Push commits to remote repository',
    parameters: [
        {
            name: 'remote',
            type: 'string',
            description: 'Remote name (default: origin)',
            required: false
        },
        {
            name: 'branch',
            type: 'string',
            description: 'Branch name (default: current branch)',
            required: false
        },
        {
            name: 'setUpstream',
            type: 'boolean',
            description: 'Set upstream tracking (use -u flag)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { remote = 'origin', branch = '', setUpstream = false } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            let command = 'git push';
            if (setUpstream) {
                command += ' -u';
            }
            command += ` ${remote}`;
            if (branch) {
                command += ` ${branch}`;
            }

            const output = execSync(command, { cwd: workspaceRoot, encoding: 'utf-8' });
            logger.info(`Pushed to ${remote}/${branch || 'current branch'}`);
            return `✅ Pushed to ${remote}:\n${output}`;
        } catch (error: any) {
            return `❌ Push failed: ${error.message}`;
        }
    }
};

// Pull from remote
export const GitPullTool: Tool = {
    name: 'git_pull',
    description: 'Pull changes from remote repository',
    parameters: [
        {
            name: 'remote',
            type: 'string',
            description: 'Remote name (default: origin)',
            required: false
        },
        {
            name: 'branch',
            type: 'string',
            description: 'Branch name (default: current branch)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { remote = 'origin', branch = '' } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            const command = `git pull ${remote} ${branch}`.trim();
            const output = execSync(command, { cwd: workspaceRoot, encoding: 'utf-8' });
            logger.info(`Pulled from ${remote}/${branch || 'current branch'}`);
            return `✅ Pulled from ${remote}:\n${output}`;
        } catch (error: any) {
            return `❌ Pull failed: ${error.message}`;
        }
    }
};

// Get Git status
export const GitStatusTool: Tool = {
    name: 'git_status',
    description: 'Check the status of the Git repository',
    parameters: [],
    execute: async (_args: Record<string, any>, context: any): Promise<string> => {
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            const output = execSync('git status', { cwd: workspaceRoot, encoding: 'utf-8' });
            return `📊 Git Status:\n${output}`;
        } catch (error: any) {
            return `❌ Failed to get status: ${error.message}`;
        }
    }
};
