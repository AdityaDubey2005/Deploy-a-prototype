import { Octokit } from '@octokit/rest';
import { Tool, ToolContext, GitHubPRRequest } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
    if (!octokit) {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN not configured in environment variables');
        }
        octokit = new Octokit({ auth: token });
    }
    return octokit;
}

export const GitHubCreatePRTool: Tool = {
    name: 'github_create_pr',
    description: 'Create a new pull request on GitHub. Automatically generates PR description based on changes.',
    parameters: [
        {
            name: 'repository',
            type: 'string',
            description: 'Repository in format owner/repo (e.g., "microsoft/vscode")',
            required: true,
        },
        {
            name: 'title',
            type: 'string',
            description: 'Title of the pull request',
            required: true,
        },
        {
            name: 'head',
            type: 'string',
            description: 'Branch containing changes (source branch)',
            required: true,
        },
        {
            name: 'base',
            type: 'string',
            description: 'Branch to merge into (target branch, usually "main" or "master")',
            required: true,
        },
        {
            name: 'body',
            type: 'string',
            description: 'Optional PR description. If not provided, will be auto-generated.',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { repository, title, head, base, body } = args;

        try {
            const [owner, repo] = repository.split('/');
            if (!owner || !repo) {
                throw new Error('Invalid repository format. Use "owner/repo"');
            }

            const client = getOctokit();

            // Get commit comparison to generate PR body if not provided
            let prBody = body;
            if (!prBody) {
                try {
                    const comparison = await client.repos.compareCommits({
                        owner,
                        repo,
                        base,
                        head,
                    });

                    const commits = comparison.data.commits;
                    prBody = `## Changes\n\nThis PR includes ${commits.length} commit(s):\n\n`;
                    prBody += commits.map(c => `- ${c.commit.message.split('\n')[0]}`).join('\n');

                    if (comparison.data.files && comparison.data.files.length > 0) {
                        prBody += `\n\n## Files Changed (${comparison.data.files.length})\n\n`;
                        prBody += comparison.data.files
                            .slice(0, 10)
                            .map(f => `- \`${f.filename}\` (+${f.additions} -${f.deletions})`)
                            .join('\n');

                        if (comparison.data.files.length > 10) {
                            prBody += `\n- ... and ${comparison.data.files.length - 10} more files`;
                        }
                    }
                } catch (err) {
                    logger.warn('Could not fetch commit comparison, using basic PR body');
                    prBody = `Merge ${head} into ${base}`;
                }
            }

            // Create the pull request
            const response = await client.pulls.create({
                owner,
                repo,
                title,
                head,
                base,
                body: prBody,
            });

            logger.info(`Created PR #${response.data.number} in ${repository}`);

            return {
                success: true,
                prNumber: response.data.number,
                url: response.data.html_url,
                message: `Successfully created PR #${response.data.number}`,
            };
        } catch (error: any) {
            logger.error(`Failed to create PR in ${repository}:`, error);
            throw new Error(`GitHub PR creation failed: ${error.message}`);
        }
    },
};

export const GitHubReviewPRTool: Tool = {
    name: 'github_review_pr',
    description: 'Review a pull request and provide automated feedback on code quality, potential issues, and suggestions.',
    parameters: [
        {
            name: 'repository',
            type: 'string',
            description: 'Repository in format owner/repo',
            required: true,
        },
        {
            name: 'prNumber',
            type: 'number',
            description: 'Pull request number to review',
            required: true,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { repository, prNumber } = args;

        try {
            const [owner, repo] = repository.split('/');
            if (!owner || !repo) {
                throw new Error('Invalid repository format. Use "owner/repo"');
            }

            const client = getOctokit();

            // Get PR details
            const pr = await client.pulls.get({
                owner,
                repo,
                pull_number: prNumber,
            });

            // Get PR files
            const files = await client.pulls.listFiles({
                owner,
                repo,
                pull_number: prNumber,
            });

            // Analyze changes
            const analysis = {
                filesChanged: files.data.length,
                additions: files.data.reduce((sum, f) => sum + f.additions, 0),
                deletions: files.data.reduce((sum, f) => sum + f.deletions, 0),
                largeFiles: files.data.filter(f => f.changes > 500),
                concerns: [] as string[],
                suggestions: [] as string[],
            };

            // Check for concerns
            if (analysis.largeFiles.length > 0) {
                analysis.concerns.push(
                    `${analysis.largeFiles.length} file(s) have more than 500 changes. Consider splitting into smaller PRs.`
                );
            }

            if (analysis.filesChanged > 20) {
                analysis.concerns.push(
                    `PR modifies ${analysis.filesChanged} files. Large PRs are harder to review.`
                );
            }

            const hasTests = files.data.some(f =>
                f.filename.includes('.test.') ||
                f.filename.includes('.spec.') ||
                f.filename.includes('__tests__')
            );

            if (!hasTests && files.data.length > 3) {
                analysis.suggestions.push('Consider adding tests for the changes');
            }

            // Check for common issues in patches
            for (const file of files.data) {
                if (file.patch) {
                    // Check for console.log additions
                    if (file.patch.includes('+') && /\+.*console\.log/.test(file.patch)) {
                        analysis.concerns.push(`File ${file.filename} adds console.log statements`);
                    }

                    // Check for TODO/FIXME additions
                    if (file.patch.includes('+') && /\+.*(TODO|FIXME)/.test(file.patch)) {
                        analysis.suggestions.push(`File ${file.filename} adds TODO/FIXME comments`);
                    }
                }
            }

            if (analysis.concerns.length === 0 && analysis.suggestions.length === 0) {
                analysis.suggestions.push('PR looks good! No major concerns found.');
            }

            logger.info(`Reviewed PR #${prNumber} in ${repository}`);

            return {
                prNumber,
                title: pr.data.title,
                author: pr.data.user?.login,
                status: pr.data.state,
                analysis,
            };
        } catch (error: any) {
            logger.error(`Failed to review PR #${prNumber} in ${repository}:`, error);
            throw new Error(`GitHub PR review failed: ${error.message}`);
        }
    },
};

export const GitHubListIssuesTool: Tool = {
    name: 'github_list_issues',
    description: 'List open issues in a GitHub repository with optional filtering.',
    parameters: [
        {
            name: 'repository',
            type: 'string',
            description: 'Repository in format owner/repo',
            required: true,
        },
        {
            name: 'state',
            type: 'string',
            description: 'Issue state filter: open, closed, all',
            required: false,
            enum: ['open', 'closed', 'all'],
        },
        {
            name: 'labels',
            type: 'string',
            description: 'Comma-separated labels to filter by',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { repository, state = 'open', labels } = args;

        try {
            const [owner, repo] = repository.split('/');
            if (!owner || !repo) {
                throw new Error('Invalid repository format. Use "owner/repo"');
            }

            const client = getOctokit();

            const response = await client.issues.listForRepo({
                owner,
                repo,
                state: state as 'open' | 'closed' | 'all',
                labels: labels || undefined,
                per_page: 20,
            });

            const issues = response.data.map(issue => ({
                number: issue.number,
                title: issue.title,
                state: issue.state,
                labels: issue.labels.map((l: any) => l.name),
                author: issue.user?.login,
                createdAt: issue.created_at,
                url: issue.html_url,
            }));

            logger.info(`Retrieved ${issues.length} issues from ${repository}`);

            return {
                count: issues.length,
                issues,
            };
        } catch (error: any) {
            logger.error(`Failed to list issues in ${repository}:`, error);
            throw new Error(`GitHub issue listing failed: ${error.message}`);
        }
    },
};
