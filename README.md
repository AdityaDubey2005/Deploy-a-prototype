# Agentic AI DevOps Assistant

A complete AI-powered DevOps assistant consisting of a VS Code extension and an intelligent backend agent system. The assistant can autonomously perform DevOps tasks including code review, test generation, log analysis, GitHub PR management, Docker/Kubernetes deployments, CI/CD monitoring, and incident detection.

## 🏗️ Architecture

The system consists of three main components:

1. **Backend Agentic System** (Node.js/TypeScript)
   - AI agent orchestration with support for OpenAI, Anthropic, and Ollama
   - 14 specialized DevOps tools
   - WebSocket server for real-time communication
   - REST API for configuration and status

2. **VS Code Extension** (TypeScript)
   - Modern chat interface
   - 9 DevOps command integrations
   - Real-time backend communication
   - Status bar integration

3. **Communication Layer**
   - WebSocket-based bidirectional communication
   - Real-time message streaming
   - Session management

## ✨ Features

### Code Analysis
- **Code Review**: Automated analysis for security, performance, style, and best practices
- **Test Generation**: Generate comprehensive unit tests for Jest, Mocha, or Vitest
- **Log Analysis**: Parse logs, identify errors, detect patterns, provide recommendations

### GitHub Integration
- **PR Creation**: Create pull requests with auto-generated descriptions
- **PR Review**: Automated code review with quality analysis
- **Issue Management**: List and filter repository issues

### Deployment & Infrastructure
- **Docker**: Build images, deploy containers, manage container lifecycle
- **Kubernetes**: Deploy applications, list pods, retrieve logs
- **Multi-environment support**

### CI/CD & Monitoring
- **Pipeline Monitoring**: Support for Jenkins, GitLab, and GitHub Actions
- **Incident Detection**: Automated root cause analysis
- **Real-time status updates**

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- VS Code 1.85+
- Docker (optional, for containerized deployment)
- API keys for your chosen AI provider

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file with your configuration**:
   ```env
   AI_PROVIDER=openai  # or anthropic, ollama
   OPENAI_API_KEY=your_key_here
   GITHUB_TOKEN=your_github_token
   ```

5. **Start the backend**:
   ```bash
   npm run dev
   ```

   The backend will start on `http://localhost:3000`

### VS Code Extension Setup

1. **Navigate to extension directory**:
   ```bash
   cd extension
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Compile the extension**:
   ```bash
   npm run compile
   ```

4. **Open extension in VS Code**:
   - Open the `extension` folder in VS Code
   - Press `F5` to launch Extension Development Host
   - The extension will activate automatically

5. **Configure extension settings**:
   - Open VS Code Settings (Ctrl/Cmd + ,)
   - Search for "DevOps Agent"
   - Set `Backend URL` to `http://localhost:3000`

### Docker Deployment (Alternative)

```bash
# Build and start backend
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

## 📖 Usage

### Open the Agent Panel

- Click the DevOps Agent icon in the status bar (bottom right)
- Or use command palette: `Ctrl+Shift+P` → "DevOps Agent: Show Panel"
- Or keyboard shortcut: `Ctrl+Shift+D` (Cmd+Shift+D on Mac)

### Available Commands

| Command | Description |
|---------|-------------|
| `DevOps Agent: Show Panel` | Open the chat interface |
| `DevOps Agent: Review Current File` | Analyze code quality |
| `DevOps Agent: Generate Tests` | Create unit tests |
| `DevOps Agent: Analyze Logs` | Parse and analyze log files |
| `DevOps Agent: Create Pull Request` | Create GitHub PR |
| `DevOps Agent: Review Pull Request` | Review existing PR |
| `DevOps Agent: Deploy to Docker` | Build and deploy container |
| `DevOps Agent: Deploy to Kubernetes` | Deploy to K8s cluster |
| `DevOps Agent: Monitor CI/CD Pipeline` | Check pipeline status |
| `DevOps Agent: Clear Conversation` | Reset chat history |

### Example Workflows

#### Code Review
```
1. Open a code file in VS Code
2. Run: "DevOps Agent: Review Current File"
3. View analysis results in the chat panel
4. Address identified issues
```

#### Generate Tests
```
1. Open a source file
2. Run: "DevOps Agent: Generate Tests"
3. Select testing framework (jest/mocha/vitest)
4. Review and save generated test file
```

#### Create GitHub PR
```
1. Ensure you're on a feature branch with changes
2. Run: "DevOps Agent: Create Pull Request"
3. Enter repository, title, branch names
4. PR created with auto-generated description
```

#### Deploy to Docker
```
1. Ensure Dockerfile exists in workspace
2. Run: "DevOps Agent: Deploy to Docker"
3. Enter image and container names
4. Container built and deployed automatically
```

## ⚙️ Configuration

### Backend Configuration

Edit `backend/.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# AI Provider (choose one)
AI_PROVIDER=openai  # openai, anthropic, or ollama

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# GitHub
GITHUB_TOKEN=ghp_...

# Docker (optional)
DOCKER_HOST=unix:///var/run/docker.sock

# Kubernetes (optional)
KUBECONFIG=~/.kube/config

# CI/CD (optional)
JENKINS_URL=
JENKINS_USER=
JENKINS_TOKEN=

GITLAB_URL=
GITLAB_TOKEN=
```

### Extension Configuration

In VS Code settings:

- **Backend URL**: URL of the backend server (default: `http://localhost:3000`)
- **Auto Connect**: Automatically connect on startup (default: `true`)
- **GitHub Token**: Optional GitHub PAT for PR operations
- **Default Repository**: Default repo for GitHub commands

## 🛠️ Development

### Backend Development

```bash
cd backend

# Watch mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

### Extension Development

```bash
cd extension

# Watch mode
npm run watch

# Compile
npm run compile

# Package extension
npm run package
```

## 📝 API Documentation

### WebSocket API

**Connect**: `ws://localhost:3000`

**Events**:
- `connected`: Connection established
- `agent_request`: Send message to agent
- `agent_response`: Receive agent response
- `status_update`: Progress updates
- `error`: Error notifications

**Example**:
```javascript
socket.emit('agent_request', {
  message: "Review this code",
  context: {
    workspaceRoot: "/path/to/workspace",
    currentFile: "src/index.ts"
  }
});
```

### REST API

- `GET /api/health`: Health check
- `GET /api/version`: API version
- `GET /api/config`: Feature configuration

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
```

### Extension Tests

```bash
cd extension
npm test
```

## 🔒 Security

- API keys stored in environment variables or VS Code secure storage
- GitHub tokens use minimum required permissions
- WebSocket connections can be restricted by origin
- No sensitive data logged

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT

## 🆘 Troubleshooting

### Backend not connecting

- Check if backend is running: `curl http://localhost:3000/api/health`
- Verify port 3000 is not in use
- Check firewall settings

### AI provider errors

- Verify API keys are correctly set in `.env`
- Check API key permissions and quota
- For Ollama, ensure service is running: `ollama serve`

### Docker deployment issues

- Ensure Docker daemon is running
- Check Docker socket permissions
- Verify Dockerfile exists in workspace

### Extension not activating

- Check VS Code version (requires 1.85+)
- View extension logs: Help → Toggle Developer Tools
- Reinstall extension dependencies

## 📚 Additional Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

---

Built with ❤️ for DevOps automation
