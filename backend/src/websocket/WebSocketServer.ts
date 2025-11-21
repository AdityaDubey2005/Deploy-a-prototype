import { Server, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Agent } from '../agent/Agent.js';
import { ToolContext, WSMessage } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { nanoid } from 'nanoid';

export class WebSocketServer {
    private io: Server;
    private agent: Agent;
    private sessions: Map<string, string>; // socketId -> sessionId

    constructor(httpServer: HTTPServer, agent: Agent) {
        this.agent = agent;
        this.sessions = new Map();

        this.io = new Server(httpServer, {
            cors: {
                origin: '*', // In production, restrict to VS Code extension
                methods: ['GET', 'POST'],
            },
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        this.setupHandlers();
        logger.info('WebSocket server initialized');
    }

    private setupHandlers() {
        this.io.on('connection', (socket: Socket) => {
            const sessionId = nanoid();
            this.sessions.set(socket.id, sessionId);

            logger.info(`Client connected: ${socket.id} (session: ${sessionId})`);

            socket.emit('connected', { sessionId });

            socket.on('agent_request', async (data: any) => {
                await this.handleAgentRequest(socket, data);
            });

            socket.on('clear_conversation', () => {
                const sid = this.sessions.get(socket.id);
                if (sid) {
                    this.agent.clearConversation(sid);
                    socket.emit('conversation_cleared', { sessionId: sid });
                    logger.info(`Cleared conversation for session ${sid}`);
                }
            });

            socket.on('ping', () => {
                socket.emit('pong');
            });

            socket.on('disconnect', () => {
                const sid = this.sessions.get(socket.id);
                this.sessions.delete(socket.id);
                logger.info(`Client disconnected: ${socket.id} (session: ${sid})`);
            });

            socket.on('error', (error) => {
                logger.error(`Socket error for ${socket.id}:`, error);
            });
        });
    }

    private async handleAgentRequest(socket: Socket, data: any) {
        const requestId = data.requestId || nanoid();
        const sessionId = this.sessions.get(socket.id) || nanoid();

        try {
            const { message, context = {} } = data;

            if (!message) {
                socket.emit('error', {
                    requestId,
                    error: 'Message is required',
                });
                return;
            }

            logger.info(`Processing request ${requestId} from session ${sessionId}`);

            // Send status update
            socket.emit('status_update', {
                requestId,
                status: 'processing',
                message: 'Agent is thinking...',
            });

            const toolContext: ToolContext = {
                workspaceRoot: context.workspaceRoot,
                currentFile: context.currentFile,
                userId: context.userId,
                sessionId,
            };

            // Process message through agent
            const response = await this.agent.processMessage(
                message,
                toolContext,
                sessionId,
                (status: string) => {
                    // Send tool execution updates as chat messages
                    socket.emit('agent_response', {
                        type: 'agent_response',
                        payload: {
                            message: {
                                id: `status-${Date.now()}`,
                                role: 'assistant',
                                content: status,
                                timestamp: Date.now(),
                            },
                            sessionId,
                        },
                        requestId,
                        timestamp: Date.now(),
                    });
                }
            );

            // Send response
            const responseMessage: WSMessage = {
                type: 'agent_response',
                payload: {
                    message: response,
                    sessionId,
                },
                requestId,
                timestamp: Date.now(),
            };

            socket.emit('agent_response', responseMessage);

            logger.info(`Completed request ${requestId}`);
        } catch (error: any) {
            logger.error(`Error processing request ${requestId}:`, error);

            socket.emit('error', {
                requestId,
                error: error.message,
                timestamp: Date.now(),
            });
        }
    }

    broadcast(event: string, data: any) {
        this.io.emit(event, data);
    }

    sendToSession(sessionId: string, event: string, data: any) {
        const socketId = Array.from(this.sessions.entries())
            .find(([_, sid]) => sid === sessionId)?.[0];

        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }

    getConnectedClients(): number {
        return this.sessions.size;
    }
}
