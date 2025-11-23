import { nanoid } from 'nanoid';
import {
    AgentConfig,
    AgentMessage,
    Tool,
    ToolCall,
    ToolResult,
    ToolContext,
    ConversationHistory,
} from '../types/index.js';
import { AIProvider } from './AIProvider.js';
import { logger } from '../utils/logger.js';

export class Agent {
    private config: AgentConfig;
    private aiProvider: AIProvider;
    private tools: Map<string, Tool>;
    private conversations: Map<string, ConversationHistory>;

    constructor(config: AgentConfig) {
        this.config = config;
        this.aiProvider = new AIProvider(config);
        this.tools = new Map();
        this.conversations = new Map();
    }

    registerTool(tool: Tool): void {
        this.tools.set(tool.name, tool);
        logger.info(`Registered tool: ${tool.name}`);
    }

    registerTools(tools: Tool[]): void {
        tools.forEach((tool) => this.registerTool(tool));
    }

    async processMessage(
        userMessage: string,
        context: ToolContext,
        sessionId?: string,
        statusCallback?: (status: string) => void
    ): Promise<AgentMessage> {
        const sid = sessionId || nanoid();
        const history = this.getOrCreateConversation(sid, context.userId);

        // Add user message to history
        const userMsg: AgentMessage = {
            id: nanoid(),
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
        };
        history.messages.push(userMsg);

        let iterations = 0;
        const maxIterations = 20; // Prevent infinite loops (increased for complex workflows)

        while (iterations < maxIterations) {
            iterations++;

            // Get AI response
            const response = await this.aiProvider.generateResponse(
                history.messages,
                Array.from(this.tools.values())
            );

            history.messages.push(response);

            // Check if AI wants to use tools
            if (response.toolCalls && response.toolCalls.length > 0) {
                logger.info(`Agent requesting ${response.toolCalls.length} tool call(s)`);

                // Execute all tool calls
                const toolResults: ToolResult[] = [];
                for (const toolCall of response.toolCalls) {
                    const result = await this.executeTool(toolCall, context, statusCallback);
                    toolResults.push(result);
                }

                // Add tool results to history as individual tool messages for each result
                // This is required by OpenAI's API format
                for (const toolResult of toolResults) {
                    const toolResultMessage: AgentMessage = {
                        id: toolResult.id, // Use the tool call ID
                        role: 'tool',
                        content: typeof toolResult.result === 'string' 
                            ? toolResult.result 
                            : JSON.stringify(toolResult.error || toolResult.result),
                        timestamp: Date.now(),
                        toolResults: [toolResult],
                    };
                    history.messages.push(toolResultMessage);
                }

                // Continue loop to get final response
                continue;
            }

            // No tool calls, we have our final response
            return response;
        }

        logger.warn(`Max iterations (${maxIterations}) reached for session ${sid}`);
        return {
            id: nanoid(),
            role: 'assistant',
            content: 'I apologize, but I reached the maximum number of processing steps. Please try rephrasing your request.',
            timestamp: Date.now(),
        };
    }

    private async executeTool(
        toolCall: ToolCall,
        context: ToolContext,
        statusCallback?: (status: string) => void
    ): Promise<ToolResult> {
        const tool = this.tools.get(toolCall.name);

        if (!tool) {
            logger.error(`Tool not found: ${toolCall.name}`);
            return {
                id: toolCall.id,
                name: toolCall.name,
                result: null,
                error: `Tool '${toolCall.name}' not found`,
            };
        }

        try {
            // Send status update
            if (statusCallback) {
                statusCallback(`🔧 Executing: ${tool.description || toolCall.name}...`);
            }

            logger.info(`Executing tool: ${toolCall.name}`, { arguments: toolCall.arguments });
            const result = await tool.execute(toolCall.arguments, context);

            return {
                id: toolCall.id,
                name: toolCall.name,
                result,
            };
        } catch (error: any) {
            logger.error(`Tool execution failed: ${toolCall.name}`, { error: error.message });
            return {
                id: toolCall.id,
                name: toolCall.name,
                result: null,
                error: error.message,
            };
        }
    }

    private getOrCreateConversation(
        sessionId: string,
        userId?: string
    ): ConversationHistory {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, {
                sessionId,
                userId,
                messages: [],
            });
        }
        return this.conversations.get(sessionId)!;
    }

    getConversation(sessionId: string): ConversationHistory | undefined {
        return this.conversations.get(sessionId);
    }

    clearConversation(sessionId: string): void {
        this.conversations.delete(sessionId);
        logger.info(`Cleared conversation: ${sessionId}`);
    }

    clearAllConversations(): void {
        this.conversations.clear();
        logger.info('Cleared all conversations');
    }
}
