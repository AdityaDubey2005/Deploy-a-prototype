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
                        tool.parameters.map((p) => [
                            p.name,
                            { type: p.type, description: p.description, ...(p.enum && { enum: p.enum }) },
                        ])
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
                    tool.parameters.map((p) => [
                        p.name,
                        { type: p.type, description: p.description },
                    ])
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
                        tool.parameters.map((p) => [
                            p.name,
                            { type: p.type, description: p.description, ...(p.enum && { enum: p.enum }) },
                        ])
                    ),
                    required: tool.parameters.filter((p) => p.required).map((p) => p.name),
                },
            },
        }));

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
                .map((tc) => ({
                    id: tc.id || `call-${Date.now()}`,
                    name: tc.function!.name || '',
                    arguments: JSON.parse(tc.function!.arguments || '{}'),
                }));
        }

        return agentMessage;
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
        return `You are an expert DevOps AI assistant integrated into a developer's VS Code environment. Your role is to help with:
- Code review and quality analysis
- Test generation and execution
- Log analysis and debugging
- GitHub operations (PR creation, review)
- Docker and Kubernetes deployments
- CI/CD pipeline monitoring
- Incident detection and root cause analysis

You have access to various tools to perform these tasks. Always explain your reasoning and provide actionable recommendations. When suggesting code changes, be specific and provide examples.`;
    }
}
