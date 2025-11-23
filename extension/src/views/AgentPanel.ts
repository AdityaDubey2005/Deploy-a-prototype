import * as vscode from 'vscode';
import { BackendClient, AgentMessage } from '../connection/BackendClient';

export class AgentPanel {
  public static currentPanel: AgentPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private backendClient: BackendClient;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, backendClient: BackendClient) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.backendClient = backendClient;

    this.panel.webview.html = this.getHtmlForWebview();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleWebviewMessage(message);
      },
      null,
      this.disposables
    );

    // Listen to backend events
    this.backendClient.on('message', (msg: AgentMessage) => {
      this.addMessage(msg);
    });

    this.backendClient.on('status', (status: any) => {
      this.updateStatus(status.message);
    });

    this.backendClient.on('connected', () => {
      this.updateConnectionStatus(true);
    });

    this.backendClient.on('disconnected', () => {
      this.updateConnectionStatus(false);
    });
  }

  public static createOrShow(extensionUri: vscode.Uri, backendClient: BackendClient) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (AgentPanel.currentPanel) {
      AgentPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'devopsAgentChat',
      'DevOps Agent',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
      }
    );

    AgentPanel.currentPanel = new AgentPanel(panel, extensionUri, backendClient);
  }

  private async handleWebviewMessage(message: any) {
    switch (message.type) {
      case 'sendMessage':
        await this.sendUserMessage(message.text);
        break;
      case 'clearConversation':
        this.backendClient.clearConversation();
        this.panel.webview.postMessage({ type: 'conversationCleared' });
        break;
    }
  }

  private async sendUserMessage(text: string) {
    if (!this.backendClient.isConnected()) {
      vscode.window.showErrorMessage('Not connected to backend');
      return;
    }

    // Display user message immediately
    this.addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    try {
      // Backend will emit message event which we listen to
      await this.backendClient.sendMessage(text);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
      this.addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: Date.now(),
      });
    }
  }



  private addMessage(message: AgentMessage) {
    this.panel.webview.postMessage({
      type: 'addMessage',
      message,
    });
  }

  private updateStatus(status: string) {
    this.panel.webview.postMessage({
      type: 'updateStatus',
      status,
    });
  }

  private updateConnectionStatus(connected: boolean) {
    this.panel.webview.postMessage({
      type: 'connectionStatus',
      connected,
    });
  }

  public dispose() {
    AgentPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevOps Agent</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    #header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--vscode-sideBar-background);
    }

    #connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--vscode-errorForeground);
    }

    .status-dot.connected {
      background-color: var(--vscode-testing-iconPassed);
    }

    #clear-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    #clear-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 85%;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.user {
      align-self: flex-end;
    }

    .message.assistant {
      align-self: flex-start;
    }

    .message-header {
      font-size: 11px;
      opacity: 0.7;
      font-weight: 500;
    }

    .message-content {
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message.user .message-content {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .message.assistant .message-content {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }

    #status-bar {
      padding: 8px 16px;
      font-size: 12px;
      font-style: italic;
      opacity: 0.7;
      min-height: 32px;
      display: flex;
      align-items: center;
      border-top: 1px solid var(--vscode-panel-border);
    }

    #input-container {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      background-color: var(--vscode-sideBar-background);
    }

    #message-input {
      flex: 1;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 8px 12px;
      border-radius: 4px;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      min-height: 36px;
      max-height: 120px;
    }

    #message-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    #send-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    #send-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    #send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      opacity: 0.5;
      text-align: center;
      padding: 32px;
    }

    .empty-state-icon {
      font-size: 48px;
    }

    .empty-state-text {
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="header">
    <div id="connection-status">
      <span class="status-dot"></span>
      <span id="connection-text">Disconnected</span>
    </div>
    <button id="clear-btn">Clear Chat</button>
  </div>

  <div id="messages">
    <div class="empty-state">
      <div class="empty-state-icon">🤖</div>
      <div class="empty-state-text">
        <strong>DevOps Agent Ready</strong><br/>
        Ask me about code review, testing, deployment, or any DevOps task!
      </div>
    </div>
  </div>

  <div id="status-bar"></div>

  <div id="input-container">
    <textarea id="message-input" placeholder="Ask the DevOps agent anything..." rows="1"></textarea>
    <button id="send-btn">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusBar = document.getElementById('status-bar');
    const statusDot = document.querySelector('.status-dot');
    const connectionText = document.getElementById('connection-text');

    let messages = [];

    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text) return;

      vscode.postMessage({ type: 'sendMessage', text });
      messageInput.value = '';
      messageInput.style.height = '36px';
    }

    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('input', () => {
      messageInput.style.height = '36px';
      messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    clearBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearConversation' });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'addMessage':
          addMessage(message.message);
          break;
        case 'updateStatus':
          updateStatus(message.status);
          break;
        case 'connectionStatus':
          updateConnectionStatus(message.connected);
          break;
        case 'conversationCleared':
          messages = [];
          renderMessages();
          break;
      }
    });

    function addMessage(msg) {
      // Remove empty state if present
      const emptyState = messagesDiv.querySelector('.empty-state');
      if (emptyState) {
        emptyState.remove();
      }

      messages.push(msg);
      renderMessages();
      scrollToBottom();
    }

    function renderMessages() {
      // Clear all messages except empty state
      const existingMessages = messagesDiv.querySelectorAll('.message');
      existingMessages.forEach(m => m.remove());

      // Render each message
      messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + msg.role;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.textContent = msg.role === 'user' ? 'You' : 'DevOps Agent';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = msg.content;

        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);
        messagesDiv.appendChild(messageDiv);
      });
    }

    function updateStatus(status) {
      statusBar.textContent = status;
    }

    function updateConnectionStatus(connected) {
      if (connected) {
        statusDot.classList.add('connected');
        connectionText.textContent = 'Connected';
      } else {
        statusDot.classList.remove('connected');
        connectionText.textContent = 'Disconnected';
      }
    }

    function scrollToBottom() {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  }
}
