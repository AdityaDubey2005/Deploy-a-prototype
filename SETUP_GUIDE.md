# Complete Setup Guide - DevOps Agent

## 📋 Prerequisites

### Required Software:
- ✅ Node.js 20+ ([Download](https://nodejs.org/))
- ✅ VS Code 1.85+ ([Download](https://code.visualstudio.com/))
- ✅ Git ([Download](https://git-scm.com/))

### Optional Software:
- Docker Desktop (for container deployment features)
- Python 3.8+ (for Streamlit deployment)

---

## 🔑 API Keys Setup

### 1. OpenAI API Key (Recommended - You have $5 credit!)

**Get your key:**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)

**Cost with $5:**
- Using `gpt-4o-mini`: ~800-2000 requests
- Should last 1-3 months with regular use

**Alternative FREE options:**
- **Groq** (100% free, fast): https://console.groq.com/keys
- **Ollama** (100% free, local): No key needed

---

### 2. GitHub Token (Optional - for PR/Issue features)

**Get your token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Copy the token (starts with `ghp_`)

**What it enables:**
- Create pull requests
- Review pull requests
- List and manage issues
- Auto-push to GitHub

---

### 3. Docker (Optional - for container deployment)

**Already installed?** Check with:
```powershell
docker --version
```

**Not installed?**
- Windows: Download Docker Desktop from https://www.docker.com/products/docker-desktop
- **Free** for personal use
- No API key needed

---

### 4. Vercel/Streamlit (Optional - for auto-deployment)

**Vercel:**
- Sign up at https://vercel.com (free)
- Login via CLI: `vercel login`
- No API key needed

**Streamlit:**
- Sign up at https://share.streamlit.io (free)
- No API key needed
- Deploy via web interface

---

## 🚀 Installation Steps

### Step 1: Clone/Navigate to Project

```powershell
cd C:\Users\adity\Desktop\Projects\BE_project\devops-agent-repo
```

---

### Step 2: Setup Backend

```powershell
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
Copy-Item .env.example .env

# Open .env file in notepad
notepad .env
```

**Edit `.env` file - Add your keys:**

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# AI Provider (USE OPENAI - You have $5 credit!)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE
OPENAI_MODEL=gpt-4o-mini

# GitHub Integration (Optional but recommended)
GITHUB_TOKEN=ghp_YOUR_GITHUB_TOKEN_HERE

# Docker (Optional - leave default)
DOCKER_HOST=unix:///var/run/docker.sock

# Other providers (Optional)
# GROQ_API_KEY=gsk_YOUR_GROQ_KEY_HERE
# GROQ_MODEL=llama-3.1-70b-versatile

# Logging
LOG_LEVEL=info
```

**Verify your configuration:**
```powershell
npm run check-config
```

**Expected output:**
```
✅ .env file found
📡 AI Provider: openai
✅ OPENAI_API_KEY is set
📦 Model: gpt-4o-mini
✅ Using recommended model with good function calling support
```

---

### Step 3: Start Backend Server

```powershell
# Still in backend directory
npm run dev
```

**Expected output:**
```
🚀 Server running on http://localhost:3000
📡 WebSocket server ready
🤖 AI Provider: openai (gpt-4o-mini)
✅ DevOps Agent Backend is ready!
```

**⚠️ IMPORTANT: Keep this terminal window open!**

---

### Step 4: Setup VS Code Extension

**Open a NEW PowerShell terminal:**

```powershell
# Navigate to extension directory
cd C:\Users\adity\Desktop\Projects\BE_project\devops-agent-repo\extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

**Expected output:**
```
> compile
> tsc -p ./

(Should complete without errors)
```

---

### Step 5: Launch Extension in VS Code

1. **Open VS Code**
2. **File → Open Folder**
3. Select: `C:\Users\adity\Desktop\Projects\BE_project\devops-agent-repo\extension`
4. **Press `F5`** to launch Extension Development Host
5. **New VS Code window will open** with extension activated

---

### Step 6: Verify Connection

In the **new VS Code window** (Extension Development Host):

1. **Look at bottom-right status bar**
   - Should show: `🤖 DevOps Agent ✓`
   - If shows ❌, check backend is running

2. **Open DevOps Agent Panel:**
   - Click robot icon in status bar
   - OR press `Ctrl+Shift+D`
   - OR Command Palette (`Ctrl+Shift+P`) → "DevOps Agent: Show Panel"

3. **Test connection:**
   - Panel should show "Connected" at top
   - Try typing: "Hello"
   - Should get AI response

---

## ✅ Verification Checklist

- [ ] Backend running on port 3000
- [ ] Backend shows "Connected" in terminal
- [ ] Extension loaded in VS Code
- [ ] Status bar shows robot icon with ✓
- [ ] DevOps Agent panel opens
- [ ] Panel shows "Connected" status
- [ ] AI responds to test message

---

## 🧪 Testing - Try These Commands!

### In VS Code Command Palette (`Ctrl+Shift+P`):

```
DevOps Agent: View API Costs
DevOps Agent: Show Panel
DevOps Agent: Review Current File
DevOps Agent: Generate Tests
DevOps Agent: Run Tests
DevOps Agent: Pre-Push Validation
DevOps Agent: Git Fetch
DevOps Agent: Create Pull Request
DevOps Agent: Deploy to Docker
DevOps Agent: Monitor CI/CD Pipeline
```

---

## 🎯 Quick Test Workflow

### Test 1: Code Review
1. Open any `.js` or `.ts` file in VS Code
2. `Ctrl+Shift+P` → "DevOps Agent: Review Current File"
3. Check the DevOps Agent panel for analysis

### Test 2: View Costs
1. `Ctrl+Shift+P` → "DevOps Agent: View API Costs"
2. Should show $0.00 initially (no requests yet)
3. After test 1, run again to see cost

### Test 3: Pre-Push Check
1. Make sure you have a Git repo open
2. `Ctrl+Shift+P` → "DevOps Agent: Pre-Push Validation"
3. Select "No - Only report issues"
4. Wait for comprehensive validation report

### Test 4: Chat Interface
1. Click robot icon or `Ctrl+Shift+D`
2. Type: "What can you help me with?"
3. Should get list of capabilities

---

## 🐛 Troubleshooting

### Backend won't start - Port already in use:
```powershell
# Check what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# Or change port in .env
PORT=3001
```

### Extension not connecting:
1. Verify backend is running (green text in terminal)
2. Check VS Code settings:
   - File → Preferences → Settings
   - Search: "DevOps Agent"
   - Backend URL should be: `http://localhost:3000`

### OpenAI API errors:
```powershell
# Verify API key is set correctly
cd backend
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY ? 'API Key is set ✓' : 'API Key MISSING ✗')"
```

### "Command not found" errors:
```powershell
# Reinstall dependencies
cd backend
rm -r node_modules
npm install
```

---

## 📊 Monitor Your API Usage

### Check costs regularly:
```
Command: "DevOps Agent: View API Costs"
```

### Your budget breakdown (with $5):
- **Code review**: $0.01-0.02 per file
- **Test generation**: $0.01-0.03 per file  
- **Pre-push validation**: $0.001-0.01 per run
- **Chat messages**: $0.0005-0.002 per message
- **Total capacity**: 800-2000 requests

### Switch to free Groq if running low:
1. Get Groq key: https://console.groq.com/keys
2. Edit `backend/.env`:
   ```env
   AI_PROVIDER=groq
   GROQ_API_KEY=gsk_YOUR_KEY_HERE
   GROQ_MODEL=llama-3.1-70b-versatile
   ```
3. Restart backend: `npm run dev`

---

## 🎉 You're All Set!

### Next Steps:
1. ✅ Try all the test commands above
2. ✅ Open a real project and use features
3. ✅ Monitor your API costs
4. ✅ Read `TESTING_GUIDE.md` for more test scenarios

### Need Help?
- See `TROUBLESHOOTING.md` for common issues
- See `FEATURE_SUMMARY.md` for feature documentation
- Check backend logs in the terminal

---

**Happy DevOps Automation! 🚀**
