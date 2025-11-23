# 🚀 Quick Start - 5 Minutes to Running!

## ⚡ Super Fast Setup

### Step 1: Install Dependencies (2 min)
```powershell
# Backend
cd backend
npm install

# Extension (new terminal)
cd extension  
npm install
```

### Step 2: Configure API Key (1 min)
```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

**Add your OpenAI key:**
```env
OPENAI_API_KEY=sk-YOUR_KEY_HERE
```
Save and close.

### Step 3: Start Everything (2 min)
```powershell
# Terminal 1 - Backend
cd backend
npm run dev

# VS Code - Extension
# Open 'extension' folder
# Press F5
```

**✅ Done! Click robot icon in new VS Code window**
