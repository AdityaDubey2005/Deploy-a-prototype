import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

export interface AgentMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolCalls?: any[];
    toolResults?: any[];
}

export class BackendClient extends EventEmitter {
    private socket: Socket | null = null;
    private backendUrl: string;
    private connected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private sessionId: string | null = null;

    constructor() {
        super();
        const config = vscode.workspace.getConfiguration('devopsAgent');
        this.backendUrl = config.get('backendUrl', 'http://localhost:3000');
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve();
                return;
            }

            this.socket = io(this.backendUrl, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: this.maxReconnectAttempts,
            });

            this.socket.on('connect', () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
                vscode.window.showInformationMessage('DevOps Agent: Connected to backend');
                resolve();
            });

            this.socket.on('connected', (data: any) => {
                this.sessionId = data.sessionId;
                this.emit('session', this.sessionId);
            });

            this.socket.on('agent_response', (message: any) => {
                this.emit('message', message.payload.message);
            });

            this.socket.on('status_update', (data: any) => {
                this.emit('status', data);
            });

            this.socket.on('error', (error: any) => {
                this.emit('error', error);
                const errorMsg = this.formatErrorMessage(error);
                vscode.window.showErrorMessage(`DevOps Agent Error: ${errorMsg}`, 'View Details').then(selection => {
                    if (selection === 'View Details') {
                        this.showDetailedError(error);
                    }
                });
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
                this.emit('disconnected');
                vscode.window.showWarningMessage('DevOps Agent: Disconnected from backend');
            });

            this.socket.on('connect_error', (error) => {
                this.reconnectAttempts++;
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.emit('connectionFailed');
                    vscode.window.showErrorMessage('DevOps Agent: Failed to connect to backend. Please check if the server is running.');
                    reject(new Error('Failed to connect to backend'));
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.sessionId = null;
        }
    }

    sendMessage(message: string, context?: any): Promise<AgentMessage> {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.connected) {
                reject(new Error('Not connected to backend'));
                return;
            }

            const requestId = Date.now().toString();

            this.socket!.emit('agent_request', {
                requestId,
                message,
                context: {
                    workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                    currentFile: vscode.window.activeTextEditor?.document.uri.fsPath,
                    ...context,
                },
            });

            // Listen for response
            const responseHandler = (response: any) => {
                if (response.requestId === requestId || response.payload?.sessionId === this.sessionId) {
                    this.socket!.off('agent_response', responseHandler);
                    resolve(response.payload.message);
                }
            };

            this.socket!.on('agent_response', responseHandler);

            // Timeout after 60 seconds
            setTimeout(() => {
                this.socket!.off('agent_response', responseHandler);
                reject(new Error('Request timeout'));
            }, 60000);
        });
    }

    clearConversation(): void {
        if (this.socket && this.connected) {
            this.socket.emit('clear_conversation');
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    getSessionId(): string | null {
        return this.sessionId;
    }

    updateBackendUrl(url: string): void {
        this.backendUrl = url;
        if (this.connected) {
            this.disconnect();
        }
    }

    private formatErrorMessage(error: any): string {
        if (error.error?.error?.message) {
            return error.error.error.message;
        }
        if (error.error?.message) {
            return error.error.message;
        }
        if (error.message) {
            return error.message;
        }
        return 'Unknown error occurred';
    }

    private showDetailedError(error: any): void {
        const channel = vscode.window.createOutputChannel('DevOps Agent - Error Details');
        channel.clear();
        channel.appendLine('DevOps Agent Error Details');
        channel.appendLine('='.repeat(50));
        channel.appendLine('');
        
        if (error.error?.error) {
            const apiError = error.error.error;
            channel.appendLine(`Type: ${apiError.type || 'Unknown'}`);
            channel.appendLine(`Code: ${apiError.code || 'Unknown'}`);
            channel.appendLine(`Message: ${apiError.message || 'No message'}`);
            
            if (apiError.failed_generation) {
                channel.appendLine('');
                channel.appendLine('Failed Generation:');
                channel.appendLine(apiError.failed_generation);
            }
        }
        
        if (error.stack) {
            channel.appendLine('');
            channel.appendLine('Stack Trace:');
            channel.appendLine(error.stack);
        }
        
        channel.appendLine('');
        channel.appendLine('Full Error Object:');
        channel.appendLine(JSON.stringify(error, null, 2));
        
        channel.show();
    }
}
