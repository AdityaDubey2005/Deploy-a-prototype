import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import axios from 'axios';
import {
    AgentConfig,
    AgentMessage,
    Tool,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { CostTracker } from './tools/CostTrackingTool.js';

export class AIProvider {
    private config: AgentConfig;
    private openai?: OpenAI;
    private anthropic?: Anthropic;
    private groq?: Groq;

    constructor(config: AgentConfig) {
        this.config = config;
        this.initialize();
    }

    private initialize() {
        switch (this.config.provider) {
            case 'openai':
                if (!process.env.OPENAI_API_KEY) {
                    throw new Error('OPENAI_API_KEY not set in environment');
                }
                this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                break;
            case 'anthropic':
                if (!process.env.ANTHROPIC_API_KEY) {
                    throw new Error('ANTHROPIC_API_KEY not set in environment');
                }
                this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
                break;
            case 'groq':
                if (!process.env.GROQ_API_KEY) {
                    throw new Error('GROQ_API_KEY not set in environment');
                }
                this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                break;
            case 'ollama':
                // Ollama doesn't require API key, uses local server
                if (!process.env.OLLAMA_BASE_URL) {
                    logger.warn('OLLAMA_BASE_URL not set, using default http://localhost:11434');
                }
                break;
        }
    }

    async generateResponse(
        messages: AgentMessage[],
        tools: Tool[],
        stream: boolean = false
    ): Promise<AgentMessage> {
        const systemMessage = this.config.systemPrompt || this.getDefaultSystemPrompt();

        switch (this.config.provider) {
            case 'openai':
                return this.generateOpenAIResponse(messages, tools, systemMessage, stream);
            case 'anthropic':
                return this.generateAnthropicResponse(messages, tools, systemMessage, stream);
            case 'groq':
                return this.generateGroqResponse(messages, tools, systemMessage, stream);
            case 'ollama':
                return this.generateOllamaResponse(messages, tools, systemMessage, stream);
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    private async generateOpenAIResponse(
        messages: AgentMessage[],
        tools: Tool[],
        systemMessage: string,
        _stream: boolean
    ): Promise<AgentMessage> {
        if (!this.openai) throw new Error('OpenAI not initialized');

        const formattedMessages: any[] = [
            { role: 'system' as const, content: systemMessage },
            ...messages.map((m) => {
                if (m.role === 'tool') {
                    return {
                        role: 'tool' as const,
                        content: m.content,
                        tool_call_id: m.id,
                    };
                }
                const msg: any = {
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                };
                if (m.toolCalls) {
                    msg.tool_calls = m.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: 'function' as const,
                        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                    }));
                }
                return msg;
            }),
        ];

        const toolDefinitions = tools.map((tool) => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: 'object',
                    properties: Object.fromEntries(
                        tool.parameters.map((p) => {
                            const propDef: any = {
                                type: p.type,
                                description: p.description,
                            };
                            if (p.enum) propDef.enum = p.enum;
                            if (p.type === 'array') propDef.items = { type: 'string' };
                            return [p.name, propDef];
                        })
                    ),
                    required: tool.parameters.filter((p) => p.required).map((p) => p.name),
                },
            },
        }));

        const response = await this.openai.chat.completions.create({
            model: this.config.model,
            messages: formattedMessages,
            tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 2000,
        });

        // Track API costs
        if (response.usage) {
            const costTracker = CostTracker.getInstance();
            await costTracker.trackRequest(
                'openai',
                this.config.model,
                response.usage.prompt_tokens || 0,
                response.usage.completion_tokens || 0,
                messages[messages.length - 1]?.content || 'API call'
            );
        }

        const choice = response.choices[0];
        const message = choice.message;

        const agentMessage: AgentMessage = {
            id: response.id,
            role: 'assistant',
            content: message.content || '',
            timestamp: Date.now(),
        };

        if (message.tool_calls && message.tool_calls.length > 0) {
            agentMessage.toolCalls = message.tool_calls.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments),
            }));
        }

        return agentMessage;
    }

    private async generateAnthropicResponse(
        messages: AgentMessage[],
        tools: Tool[],
        systemMessage: string,
        _stream: boolean
    ): Promise<AgentMessage> {
        if (!this.anthropic) throw new Error('Anthropic not initialized');

        const formattedMessages = messages.map((m) => ({
            role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: m.content,
        }));

        const toolDefinitions = tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: {
                type: 'object' as const,
                properties: Object.fromEntries(
                    tool.parameters.map((p) => {
                        const propDef: any = {
                            type: p.type,
                            description: p.description,
                        };
                        if (p.enum) propDef.enum = p.enum;
                        if (p.type === 'array') propDef.items = { type: 'string' };
                        return [p.name, propDef];
                    })
                ),
                required: tool.parameters.filter((p) => p.required).map((p) => p.name),
            },
        }));

        const response = await this.anthropic.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens || 2000,
            system: systemMessage,
            messages: formattedMessages,
            ...(toolDefinitions.length > 0 && { tools: toolDefinitions as any }),
            temperature: this.config.temperature || 0.7,
        } as any);

        const agentMessage: AgentMessage = {
            id: response.id,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        };

        // Process content blocks
        for (const block of response.content) {
            if (block.type === 'text') {
                agentMessage.content += block.text;
            } else if (block.type === 'tool_use') {
                if (!agentMessage.toolCalls) agentMessage.toolCalls = [];
                const toolBlock = block as any;
                agentMessage.toolCalls.push({
                    id: toolBlock.id,
                    name: toolBlock.name,
                    arguments: toolBlock.input as Record<string, any>,
                });
            }
        }

        return agentMessage;
    }

    private async generateGroqResponse(
        messages: AgentMessage[],
        tools: Tool[],
        systemMessage: string,
        _stream: boolean
    ): Promise<AgentMessage> {
        if (!this.groq) throw new Error('Groq not initialized');

        const formattedMessages: any[] = [
            { role: 'system' as const, content: systemMessage },
            ...messages.map((m) => {
                if (m.role === 'tool') {
                    return {
                        role: 'tool' as const,
                        content: m.content,
                        tool_call_id: m.id,
                    };
                }
                const msg: any = {
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                };
                if (m.toolCalls) {
                    msg.tool_calls = m.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: 'function' as const,
                        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                    }));
                }
                return msg;
            }),
        ];

        const toolDefinitions = tools.map((tool) => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: 'object',
                    properties: Object.fromEntries(
                        tool.parameters.map((p) => {
                            const propDef: any = {
                                type: p.type,
                                description: p.description,
                            };
                            if (p.enum) propDef.enum = p.enum;
                            if (p.type === 'array') propDef.items = { type: 'string' };
                            return [p.name, propDef];
                        })
                    ),
                    required: tool.parameters.filter((p) => p.required).map((p) => p.name),
                },
            },
        }));

        try {
            const response = await this.groq.chat.completions.create({
                model: this.config.model,
                messages: formattedMessages,
                tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
                temperature: this.config.temperature || 0.7,
                max_tokens: this.config.maxTokens || 2000,
            });

            const choice = response.choices[0];
            const message = choice.message;

            const agentMessage: AgentMessage = {
                id: response.id || `groq-${Date.now()}`,
                role: 'assistant',
                content: message.content || '',
                timestamp: Date.now(),
            };

            if (message.tool_calls && message.tool_calls.length > 0) {
                agentMessage.toolCalls = message.tool_calls
                    .filter((tc) => tc.function)
                    .map((tc) => {
                        try {
                            return {
                                id: tc.id || `call-${Date.now()}`,
                                name: tc.function!.name || '',
                                arguments: JSON.parse(tc.function!.arguments || '{}'),
                            };
                        } catch (parseError) {
                            logger.error('Failed to parse tool call arguments', {
                                toolCall: tc,
                                error: parseError,
                            });
                            return null;
                        }
                    })
                    .filter((tc): tc is NonNullable<typeof tc> => tc !== null);
            }

            return agentMessage;
        } catch (error: any) {
            // Handle Groq function calling errors
            if (error.status === 400 && error.error?.code === 'tool_use_failed') {
                logger.error('Groq function calling failed, retrying without tools', {
                    error: error.error,
                    model: this.config.model,
                });

                // Retry without tools - fallback to text-only response
                const fallbackResponse = await this.groq.chat.completions.create({
                    model: this.config.model,
                    messages: formattedMessages,
                    temperature: this.config.temperature || 0.7,
                    max_tokens: this.config.maxTokens || 2000,
                });

                const fallbackMessage = fallbackResponse.choices[0].message;

                return {
                    id: fallbackResponse.id || `groq-${Date.now()}`,
                    role: 'assistant',
                    content: fallbackMessage.content || 'I apologize, but I encountered an issue with function calling. Please try rephrasing your request or use a different command.',
                    timestamp: Date.now(),
                };
            }

            // Re-throw other errors
            throw error;
        }
    }

    private async generateOllamaResponse(
        messages: AgentMessage[],
        _tools: Tool[],
        systemMessage: string,
        _stream: boolean
    ): Promise<AgentMessage> {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

        const formattedMessages = [
            { role: 'system', content: systemMessage },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        const response = await axios.post(`${baseUrl}/api/chat`, {
            model: this.config.model,
            messages: formattedMessages,
            stream: false,
            options: {
                temperature: this.config.temperature || 0.7,
            },
        });

        return {
            id: `ollama-${Date.now()}`,
            role: 'assistant',
            content: response.data.message.content,
            timestamp: Date.now(),
        };
    }

    private getDefaultSystemPrompt(): string {
        return `You are an expert DevOps AI assistant integrated into a developer's VS Code environment.

UNDERSTANDING USER'S PROJECT:
- When user asks "What is this project?" or "What does this file do?" → Use list_files and read_file tools to explore
- Build context by reading key files: README.md, package.json, main source files
- Remember file contents and project structure from conversation history
- Provide intelligent answers based on actual code you've read
- If you don't know about a file, offer to read it first

COMMUNICATION STYLE:
- Be conversational, intelligent, and direct
- Answer questions naturally - use tools when needed to gather context
- Proactively explore the project when asked about it
- Reference specific code, functions, and files you've seen
- Be concise and helpful

WHEN TO USE TOOLS:
✅ USE tools when:
- User asks "What is this project?" → List files, read README/package.json to understand
- User asks "What does X file do?" → Read that file and explain its purpose
- User asks "How does Y function work?" → Read the file containing Y and explain
- User explicitly asks to review/analyze/generate code
- You need to read, write, or modify files
- Performing Git operations, Docker deployments, CI/CD monitoring
- Accessing real-time data (logs, costs, test results)

❌ DON'T use tools when:
- User asks general programming questions ("What is Docker?", "How does REST API work?")
- You can answer from general knowledge or conversation context
- User is having a normal conversation about concepts

YOUR CAPABILITIES:
- Project exploration and code understanding
- Code review and quality analysis
- Test generation and execution  
- Log analysis and debugging
- Git & GitHub operations (commits, PRs, fetch, push)
- Docker and Kubernetes deployments
- CI/CD pipeline monitoring
- API cost tracking and analysis
- Pre-push validation

IMPORTANT: When a user opens your extension in a new project, proactively explore it to understand the codebase. Use list_files to see structure, read key files like README, package.json, main entry points. Build a mental model of the project so you can answer questions intelligently.

Be helpful, intelligent, and actually understand the user's code by reading it.`;
    }
}
