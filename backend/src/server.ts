import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Agent } from './agent/Agent.js';
import { WebSocketServer } from './websocket/WebSocketServer.js';
import { logger } from './utils/logger.js';
import router from './api/routes.js';

// Import all tools
import { CodeReviewTool } from './agent/tools/CodeReviewTool.js';
import { TestGenerationTool } from './agent/tools/TestGenerationTool.js';
import { LogAnalysisTool } from './agent/tools/LogAnalysisTool.js';
import {
    GitHubCreatePRTool,
    GitHubReviewPRTool,
    GitHubListIssuesTool,
} from './agent/tools/GitHubTool.js';
import {
    DockerDeployTool,
    DockerListContainersTool,
    DockerStopContainerTool,
} from './agent/tools/DockerTool.js';
import {
    KubernetesDeployTool,
    KubernetesListPodsTool,
    KubernetesGetLogsTool,
} from './agent/tools/KubernetesTool.js';
import {
    CICDMonitorTool,
    IncidentDetectionTool,
} from './agent/tools/CICDTool.js';
import {
    FileSystemTool,
    WriteFileTool,
    ListFilesTool,
    SearchFilesTool,
} from './agent/tools/FileSystemTool.js';
import {
    GitInitTool,
    CreateGitHubRepoTool,
    GitCommitTool,
    GitAddRemoteTool,
    GitRemoveRemoteTool,
    GitRemoteSetBranchTool,
    GitBranchTool,
    GitPushTool,
    GitPullTool,
    GitFetchTool,
    GitStatusTool,
} from './agent/tools/GitTool.js';
import {
    CostTrackingTool,
    ResetCostsTool,
} from './agent/tools/CostTrackingTool.js';
import {
    TestExecutionTool,
    PrePushValidationTool,
} from './agent/tools/TestExecutionTool.js';
import {
    AutoDeployTool,
    DockerDeployPrepTool,
    CompleteDockerDeployTool,
    DeployToCloudTool,
    CompleteGitHubDeployTool,
} from './agent/tools/DeploymentTool.js';

// Environment configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'groq' | 'ollama';
const AI_MODEL = process.env[`${AI_PROVIDER.toUpperCase()}_MODEL`] || 'gpt-4o-mini';

async function main() {
    logger.info('Starting DevOps Agent Backend...');

    // Initialize Express app
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, res, next) => {
        logger.info(`${req.method} ${req.path}`);
        next();
    });

    // Initialize Agent with configured AI provider
    logger.info(`Initializing agent with provider: ${AI_PROVIDER}, model: ${AI_MODEL}`);

    const agent = new Agent({
        provider: AI_PROVIDER,
        model: AI_MODEL,
        temperature: 0.7,
        maxTokens: 2000,
    });

    // Register all DevOps tools
    logger.info('Registering DevOps tools...');

    agent.registerTools([
        // File system tools
        FileSystemTool,
        WriteFileTool,
        ListFilesTool,
        SearchFilesTool,

        // Git tools
        GitInitTool,
        CreateGitHubRepoTool,
        GitCommitTool,
        GitAddRemoteTool,
        GitRemoveRemoteTool,
        GitRemoteSetBranchTool,
        GitBranchTool,
        GitPushTool,
        GitPullTool,
        GitFetchTool,
        GitStatusTool,

        // Code analysis tools
        CodeReviewTool,
        TestGenerationTool,
        TestExecutionTool,
        PrePushValidationTool,
        LogAnalysisTool,

        // GitHub tools
        GitHubCreatePRTool,
        GitHubReviewPRTool,
        GitHubListIssuesTool,

        // Docker tools
        DockerDeployTool,
        DockerListContainersTool,
        DockerStopContainerTool,

        // Kubernetes tools
        KubernetesDeployTool,
        KubernetesListPodsTool,
        KubernetesGetLogsTool,

        // CI/CD and monitoring tools
        CICDMonitorTool,
        IncidentDetectionTool,

        // Cost tracking tools
        CostTrackingTool,
        ResetCostsTool,
        
        // Auto-deployment tools
        AutoDeployTool,
        DockerDeployPrepTool,
        CompleteDockerDeployTool,
        DeployToCloudTool,
        CompleteGitHubDeployTool,
    ]);

    logger.info(`Registered ${38} DevOps tools`);

    // API routes
    app.use('/api', router);

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket server
    const wsServer = new WebSocketServer(httpServer, agent);

    // Start server
    httpServer.listen(PORT, () => {
        logger.info(`🚀 Server running on http://localhost:${PORT}`);
        logger.info(`📡 WebSocket server ready`);
        logger.info(`🤖 AI Provider: ${AI_PROVIDER} (${AI_MODEL})`);
        logger.info('✅ DevOps Agent Backend is ready!');
    });

    // Graceful shutdown
    const shutdown = () => {
        logger.info('Shutting down gracefully...');
        httpServer.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// Start the server
main().catch((error) => {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
});
