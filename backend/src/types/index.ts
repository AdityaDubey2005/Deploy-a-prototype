// Core type definitions for the DevOps Agent system

export interface AgentMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

export interface ToolResult {
    id: string;
    name: string;
    result: any;
    error?: string;
}

export interface Tool {
    name: string;
    description: string;
    parameters: ToolParameter[];
    execute: (args: Record<string, any>, context: ToolContext) => Promise<any>;
}

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    enum?: string[];
}

export interface ToolContext {
    workspaceRoot?: string;
    currentFile?: string;
    userId?: string;
    sessionId: string;
}

export interface AgentConfig {
    provider: 'openai' | 'anthropic' | 'groq' | 'ollama';
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface ConversationHistory {
    messages: AgentMessage[];
    sessionId: string;
    userId?: string;
    metadata?: Record<string, any>;
}


// WebSocket message types
export type WSMessageType =
    | 'agent_request'
    | 'agent_response'
    | 'agent_stream'
    | 'tool_execution'
    | 'error'
    | 'status_update'
    | 'ping'
    | 'pong';

export interface WSMessage {
    type: WSMessageType;
    payload: any;
    requestId?: string;
    timestamp: number;
}

// DevOps specific types
export interface CodeReviewResult {
    file: string;
    issues: CodeIssue[];
    suggestions: string[];
    score: number;
    summary: string;
}

export interface CodeIssue {
    severity: 'error' | 'warning' | 'info';
    line: number;
    column?: number;
    message: string;
    suggestion?: string;
    category: 'security' | 'performance' | 'style' | 'bug' | 'best-practice';
}

export interface TestGenerationResult {
    testFile: string;
    testCode: string;
    framework: string;
    coverage: string[];
}

export interface LogAnalysisResult {
    summary: string;
    errors: LogEntry[];
    warnings: LogEntry[];
    patterns: LogPattern[];
    recommendations: string[];
}

export interface LogEntry {
    timestamp?: string;
    level: string;
    message: string;
    context?: Record<string, any>;
}

export interface LogPattern {
    pattern: string;
    occurrences: number;
    severity: 'high' | 'medium' | 'low';
    description: string;
}

export interface GitHubPRRequest {
    title: string;
    body: string;
    head: string;
    base: string;
    repository: string;
}

export interface DeploymentRequest {
    type: 'docker' | 'kubernetes';
    config: DockerConfig | KubernetesConfig;
}

export interface DockerConfig {
    image: string;
    tag: string;
    containerName: string;
    ports?: { host: number; container: number }[];
    env?: Record<string, string>;
    volumes?: { host: string; container: string }[];
}

export interface KubernetesConfig {
    namespace: string;
    deployment: string;
    image: string;
    replicas?: number;
    configMap?: Record<string, string>;
}

export interface CICDStatus {
    platform: 'jenkins' | 'gitlab' | 'github-actions' | 'circleci';
    pipeline: string;
    status: 'success' | 'failed' | 'running' | 'pending';
    lastRun?: Date;
    url?: string;
}

export interface IncidentReport {
    severity: 'critical' | 'high' | 'medium' | 'low';
    service: string;
    description: string;
    rootCause?: string;
    timeline: IncidentEvent[];
    recommendations: string[];
}

export interface IncidentEvent {
    timestamp: Date;
    event: string;
    details?: string;
}
