import axios from 'axios';
import { Tool, ToolContext, CICDStatus } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export const CICDMonitorTool: Tool = {
    name: 'cicd_monitor',
    description: 'Monitor CI/CD pipeline status across different platforms (Jenkins, GitLab, GitHub Actions).',
    parameters: [
        {
            name: 'platform',
            type: 'string',
            description: 'CI/CD platform: jenkins, gitlab, github-actions',
            required: true,
            enum: ['jenkins', 'gitlab', 'github-actions'],
        },
        {
            name: 'pipeline',
            type: 'string',
            description: 'Pipeline/job name or identifier',
            required: true,
        },
        {
            name: 'repository',
            type: 'string',
            description: 'Repository name (required for github-actions)',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<CICDStatus> => {
        const { platform, pipeline, repository } = args;

        try {
            switch (platform) {
                case 'jenkins':
                    return await monitorJenkins(pipeline);
                case 'gitlab':
                    return await monitorGitLab(pipeline);
                case 'github-actions':
                    if (!repository) {
                        throw new Error('Repository parameter required for github-actions');
                    }
                    return await monitorGitHubActions(repository, pipeline);
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
        } catch (error: any) {
            logger.error(`CI/CD monitoring failed for ${platform}/${pipeline}:`, error);
            throw new Error(`CI/CD monitoring failed: ${error.message}`);
        }
    },
};

async function monitorJenkins(jobName: string): Promise<CICDStatus> {
    const jenkinsUrl = process.env.JENKINS_URL;
    const jenkinsUser = process.env.JENKINS_USER;
    const jenkinsToken = process.env.JENKINS_TOKEN;

    if (!jenkinsUrl) {
        throw new Error('JENKINS_URL not configured');
    }

    const auth = jenkinsUser && jenkinsToken
        ? { username: jenkinsUser, password: jenkinsToken }
        : undefined;

    try {
        const response = await axios.get(
            `${jenkinsUrl}/job/${jobName}/lastBuild/api/json`,
            { auth }
        );

        const build = response.data;

        const status: CICDStatus = {
            platform: 'jenkins',
            pipeline: jobName,
            status: build.result ? mapJenkinsStatus(build.result) : 'running',
            lastRun: new Date(build.timestamp),
            url: build.url,
        };

        logger.info(`Jenkins job ${jobName} status: ${status.status}`);
        return status;
    } catch (error: any) {
        if (error.response?.status === 404) {
            throw new Error(`Jenkins job '${jobName}' not found`);
        }
        throw error;
    }
}

async function monitorGitLab(projectId: string): Promise<CICDStatus> {
    const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
    const gitlabToken = process.env.GITLAB_TOKEN;

    if (!gitlabToken) {
        throw new Error('GITLAB_TOKEN not configured');
    }

    try {
        const response = await axios.get(
            `${gitlabUrl}/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/latest`,
            {
                headers: { 'PRIVATE-TOKEN': gitlabToken },
            }
        );

        const pipeline = response.data;

        const status: CICDStatus = {
            platform: 'gitlab',
            pipeline: projectId,
            status: mapGitLabStatus(pipeline.status),
            lastRun: new Date(pipeline.created_at),
            url: pipeline.web_url,
        };

        logger.info(`GitLab pipeline ${projectId} status: ${status.status}`);
        return status;
    } catch (error: any) {
        if (error.response?.status === 404) {
            throw new Error(`GitLab project '${projectId}' not found`);
        }
        throw error;
    }
}

async function monitorGitHubActions(repository: string, workflow: string): Promise<CICDStatus> {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
        throw new Error('GITHUB_TOKEN not configured');
    }

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
        throw new Error('Invalid repository format. Use "owner/repo"');
    }

    try {
        // Get workflow runs
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs`,
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: 'application/vnd.github+json',
                },
                params: { per_page: 1 },
            }
        );

        if (response.data.workflow_runs.length === 0) {
            throw new Error(`No runs found for workflow '${workflow}'`);
        }

        const run = response.data.workflow_runs[0];

        const status: CICDStatus = {
            platform: 'github-actions',
            pipeline: workflow,
            status: mapGitHubStatus(run.conclusion || run.status),
            lastRun: new Date(run.created_at),
            url: run.html_url,
        };

        logger.info(`GitHub Actions workflow ${workflow} status: ${status.status}`);
        return status;
    } catch (error: any) {
        if (error.response?.status === 404) {
            throw new Error(`GitHub workflow '${workflow}' not found in ${repository}`);
        }
        throw error;
    }
}

function mapJenkinsStatus(result: string): 'success' | 'failed' | 'running' | 'pending' {
    switch (result.toUpperCase()) {
        case 'SUCCESS':
            return 'success';
        case 'FAILURE':
        case 'ABORTED':
            return 'failed';
        case 'IN_PROGRESS':
            return 'running';
        default:
            return 'pending';
    }
}

function mapGitLabStatus(status: string): 'success' | 'failed' | 'running' | 'pending' {
    switch (status) {
        case 'success':
            return 'success';
        case 'failed':
        case 'canceled':
            return 'failed';
        case 'running':
            return 'running';
        case 'pending':
        case 'created':
            return 'pending';
        default:
            return 'pending';
    }
}

function mapGitHubStatus(status: string): 'success' | 'failed' | 'running' | 'pending' {
    switch (status) {
        case 'success':
        case 'completed':
            return 'success';
        case 'failure':
        case 'cancelled':
        case 'timed_out':
            return 'failed';
        case 'in_progress':
            return 'running';
        case 'queued':
        case 'waiting':
        case 'requested':
            return 'pending';
        default:
            return 'pending';
    }
}

export const IncidentDetectionTool: Tool = {
    name: 'detect_incident',
    description: 'Detect and analyze incidents from various sources (logs, metrics, alerts). Provides root cause analysis and recommendations.',
    parameters: [
        {
            name: 'source',
            type: 'string',
            description: 'Source of incident data: logs, metrics, manual',
            required: true,
            enum: ['logs', 'metrics', 'manual'],
        },
        {
            name: 'description',
            type: 'string',
            description: 'Description of the incident or issue',
            required: true,
        },
        {
            name: 'service',
            type: 'string',
            description: 'Affected service or component',
            required: true,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { source, description, service } = args;

        try {
            // Analyze the incident description for patterns
            const severity = determineSeverity(description);
            const rootCause = analyzeRootCause(description);
            const recommendations = generateRecommendations(description, service);

            const incident = {
                severity,
                service,
                description,
                rootCause,
                timeline: [
                    {
                        timestamp: new Date(),
                        event: 'Incident detected',
                        details: `Source: ${source}`,
                    },
                    {
                        timestamp: new Date(),
                        event: 'Analysis completed',
                        details: rootCause,
                    },
                ],
                recommendations,
                source,
            };

            logger.info(`Incident detected in ${service} with severity ${severity}`);

            return incident;
        } catch (error: any) {
            logger.error(`Incident detection failed:`, error);
            throw new Error(`Incident detection failed: ${error.message}`);
        }
    },
};

function determineSeverity(description: string): 'critical' | 'high' | 'medium' | 'low' {
    const lower = description.toLowerCase();

    if (
        lower.includes('down') ||
        lower.includes('crashed') ||
        lower.includes('outage') ||
        lower.includes('critical')
    ) {
        return 'critical';
    }

    if (
        lower.includes('error') ||
        lower.includes('failed') ||
        lower.includes('timeout') ||
        lower.includes('high')
    ) {
        return 'high';
    }

    if (lower.includes('warning') || lower.includes('slow') || lower.includes('degraded')) {
        return 'medium';
    }

    return 'low';
}

function analyzeRootCause(description: string): string {
    const lower = description.toLowerCase();

    if (lower.includes('connection') || lower.includes('network')) {
        return 'Likely network connectivity issue or service unavailability';
    }

    if (lower.includes('memory') || lower.includes('oom')) {
        return 'Possible memory exhaustion or leak';
    }

    if (lower.includes('cpu') || lower.includes('high load')) {
        return 'High CPU usage or resource contention';
    }

    if (lower.includes('disk') || lower.includes('storage')) {
        return 'Disk space or I/O issue';
    }

    if (lower.includes('timeout')) {
        return 'Request timeout - service slowness or overload';
    }

    if (lower.includes('authentication') || lower.includes('unauthorized')) {
        return 'Authentication or authorization failure';
    }

    return 'Root cause requires further investigation';
}

function generateRecommendations(description: string, service: string): string[] {
    const recommendations: string[] = [];
    const lower = description.toLowerCase();

    if (lower.includes('connection') || lower.includes('network')) {
        recommendations.push('Check service health and network connectivity');
        recommendations.push('Verify DNS resolution and firewall rules');
        recommendations.push('Review service endpoints and load balancer configuration');
    }

    if (lower.includes('memory')) {
        recommendations.push('Check memory usage metrics and trends');
        recommendations.push('Look for memory leaks in application code');
        recommendations.push('Consider increasing memory limits or scaling horizontally');
    }

    if (lower.includes('timeout')) {
        recommendations.push('Analyze slow queries or operations');
        recommendations.push('Check for service overload or resource constraints');
        recommendations.push('Review and increase timeout configurations if needed');
    }

    if (lower.includes('error')) {
        recommendations.push('Review recent deployments for breaking changes');
        recommendations.push('Check application logs for detailed error messages');
        recommendations.push('Verify dependencies and external service availability');
    }

    if (recommendations.length === 0) {
        recommendations.push(`Review ${service} logs and metrics for anomalies`);
        recommendations.push('Check recent changes and deployments');
        recommendations.push('Verify dependent services are healthy');
    }

    return recommendations;
}
