# Troubleshooting Guide

## Common Issues and Solutions

### 1. Groq API Function Calling Errors

**Error Message:**
```
Error processing request: 400 {"error":{"message":"Failed to call a function. Please adjust your prompt.", "type":"invalid_request_error","code":"tool_use_failed"}}
```

**Cause:** 
- Using an older Groq model (like `llama3-70b-8192`) that has inconsistent function calling support
- Malformed tool definitions
- Model trying to generate function calls in incorrect format

**Solutions:**

#### Option 1: Use a Better Groq Model (Recommended)
Update your `.env` file:
```env
GROQ_MODEL=llama-3.1-70b-versatile
```

**Recommended Groq Models for Function Calling:**
- `llama-3.1-70b-versatile` ✅ (Best for function calling)
- `llama-3.1-8b-instant` ✅ (Faster, good function calling)
- `mixtral-8x7b-32768` ✅ (Good alternative)
- `llama3-70b-8192` ❌ (Avoid - poor function calling)

#### Option 2: Switch to a Different AI Provider

**OpenAI (Most Reliable):**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

**Anthropic Claude (Excellent Function Calling):**
```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Ollama (Local, Free):**
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

#### Option 3: Restart Backend After Changes
After updating your `.env` file:
```bash
cd backend
# Stop the server (Ctrl+C)
npm run dev
```

### 2. Backend Connection Issues

**Symptoms:**
- Extension shows "Disconnected" status
- Chat messages not sending
- WebSocket errors in logs

**Solutions:**

1. **Check if backend is running:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Verify port availability:**
   ```bash
   # Windows PowerShell
   netstat -ano | findstr :3000
   
   # If port is in use, change PORT in .env
   PORT=3001
   ```

3. **Check backend logs:**
   ```bash
   cd backend
   npm run dev
   # Look for any startup errors
   ```

4. **Update extension settings:**
   - Open VS Code Settings
   - Search "DevOps Agent"
   - Set Backend URL to match your PORT

### 3. Missing Environment Variables

**Error:**
```
Error: GROQ_API_KEY not set in environment
```

**Solution:**
1. Create `.env` file in `backend/` directory:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` with your API keys:
   ```env
   AI_PROVIDER=groq
   GROQ_API_KEY=your_actual_key_here
   GITHUB_TOKEN=your_github_token
   ```

3. Get API keys:
   - **Groq:** https://console.groq.com/keys
   - **OpenAI:** https://platform.openai.com/api-keys
   - **Anthropic:** https://console.anthropic.com/
   - **GitHub:** https://github.com/settings/tokens

### 4. Tool Execution Failures

**Error:**
```
Tool execution failed: search_files
```

**Common Causes & Solutions:**

#### File System Tools
- **Issue:** Permission denied
- **Solution:** Check workspace folder permissions
  ```bash
  # Ensure the workspace is accessible
  ls -la /path/to/workspace
  ```

#### GitHub Tools
- **Issue:** GitHub token invalid or insufficient permissions
- **Solution:** 
  1. Generate new token with required scopes: `repo`, `workflow`
  2. Update `GITHUB_TOKEN` in `.env`

#### Docker Tools
- **Issue:** Cannot connect to Docker daemon
- **Solution:**
  ```bash
  # Check Docker is running
  docker ps
  
  # Update DOCKER_HOST if needed
  # Unix/Mac: unix:///var/run/docker.sock
  # Windows: npipe:////./pipe/docker_engine
  ```

#### Kubernetes Tools
- **Issue:** KUBECONFIG not found
- **Solution:**
  ```bash
  # Verify kubeconfig exists
  ls ~/.kube/config
  
  # Or set custom path in .env
  KUBECONFIG=/path/to/your/kubeconfig
  ```

### 5. Extension Not Activating

**Symptoms:**
- Commands not available in Command Palette
- Status bar icon not showing
- No chat panel

**Solutions:**

1. **Check VS Code version:**
   - Requires VS Code 1.85.0 or higher
   - Help → About → Check version

2. **Reinstall extension dependencies:**
   ```bash
   cd extension
   rm -rf node_modules
   npm install
   npm run compile
   ```

3. **Check extension logs:**
   - Help → Toggle Developer Tools
   - Console tab → Look for errors
   - Filter by "DevOps Agent"

4. **Reload VS Code:**
   - Command Palette → "Developer: Reload Window"
   - Or press `Ctrl+R` (Cmd+R on Mac)

### 6. TypeScript Compilation Errors

**Error:**
```
Cannot find module or its corresponding type declarations
```

**Solution:**
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install
npm run build

# Extension
cd extension
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### 7. WebSocket Connection Drops

**Symptoms:**
- Frequent disconnections
- Messages not reaching backend
- Status changes to "Disconnected" randomly

**Solutions:**

1. **Increase timeout in extension:**
   - Edit `extension/src/connection/BackendClient.ts`
   - Increase reconnect delay if needed

2. **Check firewall/antivirus:**
   - May be blocking WebSocket connections
   - Add exception for port 3000

3. **Use HTTP fallback (if implemented):**
   - Switch to REST API mode
   - Check extension settings

### 8. Docker Deployment Issues

**Error:**
```
Failed to build image
```

**Solutions:**

1. **Verify Dockerfile exists:**
   ```bash
   ls Dockerfile
   ```

2. **Check Docker daemon:**
   ```bash
   docker info
   ```

3. **Build manually to see errors:**
   ```bash
   docker build -t test-image .
   ```

4. **Common Dockerfile issues:**
   - Missing base image
   - Incorrect COPY paths
   - Port not exposed

### 9. Rate Limiting Issues

**Error:**
```
Rate limit exceeded
```

**Solutions:**

**Groq:**
- Free tier: 30 requests/minute
- Wait or upgrade plan
- Switch to different provider temporarily

**OpenAI:**
- Check quota: https://platform.openai.com/usage
- Upgrade plan if needed

**GitHub:**
- Personal tokens: 5000 requests/hour
- Wait for reset time shown in error

### 10. Log Analysis Not Working

**Symptoms:**
- Tool says "No errors found" when there clearly are
- Incomplete analysis

**Solutions:**

1. **Check log file format:**
   - Must be plain text
   - JSON logs should be line-delimited

2. **Verify file path:**
   - Must be relative to workspace root
   - Use forward slashes: `logs/error.log`

3. **Check file size:**
   - Large files (>10MB) may timeout
   - Split into smaller chunks

## Getting Help

### Enable Debug Logging

**Backend:**
```env
LOG_LEVEL=debug
```

**Extension:**
- Open Developer Tools
- Console tab shows all messages
- Export logs if needed

### Collect Diagnostic Information

```bash
# Backend version and status
cd backend
npm run build
node dist/server.js --version

# Check environment
echo $AI_PROVIDER
echo $GROQ_MODEL

# Extension info
# In VS Code: Help → About
```

### Report Issues

When reporting issues, include:
1. Error message (full stack trace)
2. Backend logs (last 50 lines)
3. `.env` configuration (redact API keys!)
4. Node.js version: `node --version`
5. VS Code version
6. Operating system
7. Steps to reproduce

### Useful Commands

```bash
# Check backend health
curl http://localhost:3000/api/health

# Check WebSocket connection
# Install wscat: npm install -g wscat
wscat -c ws://localhost:3000

# View backend logs in real-time
cd backend
npm run dev | tee debug.log

# Test AI provider directly
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

## Performance Optimization

### Reduce Response Time

1. **Use faster models:**
   - `llama-3.1-8b-instant` instead of 70b
   - Groq is faster than OpenAI

2. **Adjust max_tokens:**
   ```env
   # In server.ts or via config
   maxTokens: 1000  # Default is 2000
   ```

3. **Limit tool usage:**
   - Be specific in requests
   - Avoid broad queries

### Reduce Memory Usage

1. **Clear conversation history:**
   - Command: "DevOps Agent: Clear Conversation"
   - Or restart backend

2. **Limit conversation length:**
   - Edit `Agent.ts`: reduce `maxIterations`

## Best Practices

1. **Always restart backend after `.env` changes**
2. **Use specific, targeted commands**
3. **Keep API keys secure** - never commit `.env` files
4. **Monitor API usage** to avoid rate limits
5. **Use appropriate models** for function calling
6. **Keep dependencies updated:** `npm update`
7. **Review logs regularly** for early issue detection

## Known Limitations

1. **Groq function calling** is model-dependent
2. **Local file access only** - no remote file systems
3. **WebSocket reconnect delay** is 5 seconds by default
4. **Docker requires daemon** - can't use in serverless
5. **Kubernetes requires kubectl** configured locally
6. **Large files** (>5MB) may cause timeouts

---

Last updated: 2024-11-23
