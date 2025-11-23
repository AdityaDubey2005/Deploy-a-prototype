# Complete Testing Guide - DevOps Agent

## 🧪 Test Scenarios with Commands & Prompts

---

## 1️⃣ Code Review Testing

### Scenario A: Review a Simple File

**Setup:**
```powershell
# Create a test file
cd C:\Users\adity\Desktop\Projects\BE_project\devops-agent-repo
mkdir test-project
cd test-project
echo "function add(a, b) { return a + b; }" > calculator.js
```

**Open in Extension Development Host and test:**

**Method 1: Command Palette**
1. Open `calculator.js`
2. `Ctrl+Shift+P` → "DevOps Agent: Review Current File"
3. Wait for analysis in DevOps Agent panel

**Method 2: Chat Prompt**
1. Click robot icon (`Ctrl+Shift+D`)
2. Type: `Review the calculator.js file and check for issues`

**Expected Results:**
- Analysis of code quality
- Security recommendations
- Best practice suggestions
- Cost: ~$0.001-0.002

---

### Scenario B: Review with Specific Focus

**Chat Prompts to try:**
```
Review calculator.js focusing on performance optimization

Check calculator.js for security vulnerabilities

Analyze calculator.js for TypeScript migration suggestions

Review this file and suggest unit tests that should be written
```

---

## 2️⃣ Test Generation & Execution

### Scenario A: Generate Tests

**Setup:**
```javascript
// Create sample.js
function multiply(a, b) {
    return a * b;
}

function divide(a, b) {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
}

module.exports = { multiply, divide };
```

**Test Commands:**

**Method 1: Command**
1. Open `sample.js`
2. `Ctrl+Shift+P` → "DevOps Agent: Generate Tests"
3. Select framework: `jest`
4. Review generated test file

**Method 2: Chat Prompt**
```
Generate comprehensive Jest tests for sample.js covering edge cases and error scenarios
```

**Expected Output:**
- Creates `sample.test.js`
- Includes multiple test cases
- Covers happy path and errors

---

### Scenario B: Run Tests

**Setup package.json:**
```json
{
  "name": "test-project",
  "version": "1.0.0",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

**Test Commands:**
```powershell
npm install
```

**Then in VS Code:**
1. `Ctrl+Shift+P` → "DevOps Agent: Run Tests"
2. Select: "Yes - With coverage report"

**Chat Prompt:**
```
Run all tests in this project with coverage report
```

**Expected Output:**
- Test results summary
- Pass/fail counts
- Coverage percentages
- Cost: ~$0.0005

---

## 3️⃣ Pre-Push Validation

### Scenario: Complete Pre-Push Check

**Setup:**
```powershell
# Initialize git repo
git init
git add .
git commit -m "Initial commit"

# Make some changes
echo "// New feature" >> sample.js
```

**Test Command:**
1. `Ctrl+Shift+P` → "DevOps Agent: Pre-Push Validation"
2. Select: "Yes - Auto-fix linting issues"

**Chat Prompt:**
```
Run pre-push validation on my code. Check tests, linting, security, and build status.
```

**Expected Output:**
- ✅ Git status check
- ✅ Linting results
- ✅ Test results
- ✅ Security scan
- ✅ Build verification
- Final recommendation: Safe to push or not
- Cost: ~$0.002-0.005

---

## 4️⃣ Git Operations

### Scenario A: Git Fetch

**Setup:**
```powershell
# Add a remote
git remote add origin https://github.com/yourusername/test-repo.git
```

**Test Command:**
1. `Ctrl+Shift+P` → "DevOps Agent: Git Fetch"
2. Select: "Yes - Prune deleted branches"

**Chat Prompts:**
```
Fetch latest changes from origin

Fetch from origin and prune deleted remote branches

Check what branches are available on the remote
```

---

### Scenario B: Create Pull Request

**Test Command:**
1. `Ctrl+Shift+P` → "DevOps Agent: Create Pull Request"
2. Enter repository: `yourusername/your-repo`
3. Enter title: `Add new calculator features`
4. Enter head branch: `feature/calculator`
5. Enter base branch: `main`

**Chat Prompt:**
```
Create a PR in myrepo/project from feature-branch to main with title "Add authentication"

Help me create a pull request with an auto-generated description based on my recent commits
```

**Expected Output:**
- PR created on GitHub
- URL to the PR
- Auto-generated description
- Cost: ~$0.002-0.003

---

## 5️⃣ Docker Deployment

### Scenario A: Deploy a Node.js App

**Setup - Create Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**Create simple server.js:**
```javascript
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello from Docker!');
});
server.listen(3000, () => console.log('Server running on port 3000'));
```

**Test Command:**
1. `Ctrl+Shift+P` → "DevOps Agent: Deploy to Docker"
2. Enter image name: `my-app`
3. Enter container name: `my-app-container`

**Chat Prompts:**
```
Build and deploy this Node.js app to Docker with port 3000 exposed

Deploy to Docker with image name "test-app" and container name "test-container"

Check if my Docker container is running and show me the logs
```

**Expected Output:**
- Image built
- Container created and started
- Port mapping info
- Container ID
- Cost: ~$0.001

---

### Scenario B: List Docker Containers

**Chat Prompt:**
```
Show me all running Docker containers

List all Docker containers including stopped ones

Check the status of my test-app container
```

---

## 6️⃣ CI/CD Monitoring

### Scenario: Monitor GitHub Actions

**Test Command:**
1. `Ctrl+Shift+P` → "DevOps Agent: Monitor CI/CD Pipeline"
2. Select platform: `github-actions`
3. Enter repository: `microsoft/vscode`
4. Enter workflow: `ci.yml`

**Chat Prompts:**
```
Check the status of GitHub Actions workflow "ci.yml" in microsoft/vscode

Monitor my CI/CD pipeline and tell me if the latest build passed

Show me the status of all recent pipeline runs
```

**Expected Output:**
- Pipeline status (success/failed/running)
- Last run timestamp
- URL to pipeline
- Cost: ~$0.001

---

## 7️⃣ Cost Tracking

### Scenario: View and Analyze Costs

**Test Command:**
1. `Ctrl+Shift+P` → "DevOps Agent: View API Costs"

**Chat Prompts:**
```
Show me my API usage and costs

What's my total spending today?

Break down costs by model and provider

Show me the last 20 API requests with their costs

Am I close to my budget limit?
```

**Expected Output:**
- Total costs (today/week/month)
- Cost by provider
- Cost by model
- Recent requests
- Budget recommendations
- Cost: $0.00 (free to check!)

---

## 8️⃣ Auto-Deployment

### Scenario A: Deploy to Vercel

**Setup - Create Next.js app:**
```powershell
npx create-next-app@latest my-next-app --typescript --tailwind --app
cd my-next-app
```

**Chat Prompt:**
```
Check if my project is suitable for deployment and deploy to Vercel

Auto-deploy this Next.js app to the best platform

Deploy to Vercel with automatic configuration
```

**Expected Output:**
- Project size check
- Platform recommendation
- Deployment status
- Live URL (if successful)
- Cost: ~$0.003-0.005

---

### Scenario B: Deploy to Streamlit

**Setup - Create Streamlit app:**
```python
# streamlit_app.py
import streamlit as st

st.title("Hello Streamlit!")
st.write("This is a test deployment")
```

**Chat Prompt:**
```
Prepare this Streamlit app for deployment

Deploy my Python Streamlit app to Streamlit Cloud

Check deployment requirements and deploy
```

---

## 9️⃣ Log Analysis

### Scenario: Analyze Error Logs

**Setup - Create log file:**
```
test-logs.log:
2024-11-23 10:00:00 [INFO] Application started
2024-11-23 10:01:23 [ERROR] Database connection failed: timeout
2024-11-23 10:01:24 [ERROR] Retry attempt 1 failed
2024-11-23 10:01:25 [ERROR] Retry attempt 2 failed
2024-11-23 10:02:00 [WARN] High memory usage detected: 85%
2024-11-23 10:03:00 [ERROR] Request timeout on /api/users
2024-11-23 10:04:00 [INFO] Application recovered
```

**Test Command:**
1. `Ctrl+Shift+P` → "DevOps Agent: Analyze Logs"
2. Select the log file

**Chat Prompts:**
```
Analyze test-logs.log and identify all errors

Find patterns in the log file and suggest root causes

What are the critical issues in this log file?

Provide recommendations to fix the errors in the logs
```

**Expected Output:**
- Error count and types
- Pattern detection
- Root cause analysis
- Recommendations
- Cost: ~$0.002-0.004

---

## 🔟 Complex Workflow Testing

### Scenario: Full Development Workflow

**Complete workflow chat prompts:**

```
1. "Review all JavaScript files in the src directory"

2. "Generate tests for all files that don't have tests"

3. "Run all tests with coverage"

4. "Check if my code is ready to push to GitHub"

5. "Create a detailed commit message based on my changes"

6. "Deploy to Docker if tests pass"

7. "Show me my total API costs for this workflow"
```

**Expected Total Cost:** ~$0.02-0.05

---

## 📊 Test Results Tracking

### Keep track of your tests:

| Test | Status | Cost | Notes |
|------|--------|------|-------|
| Code Review | ✅ | $0.002 | |
| Generate Tests | ✅ | $0.015 | |
| Run Tests | ✅ | $0.001 | |
| Pre-Push Check | ✅ | $0.004 | |
| Docker Deploy | ✅ | $0.001 | |
| View Costs | ✅ | Free | |
| **Total** | | **$0.023** | |

---

## 🎯 Advanced Test Scenarios

### 1. Multi-File Code Review
```
Review all TypeScript files in src/ and rank them by code quality

Analyze the entire backend directory and suggest architecture improvements
```

### 2. Intelligent Test Generation
```
Generate integration tests for my API endpoints

Create E2E tests for the user authentication flow

Generate tests that achieve 80% code coverage
```

### 3. Smart Deployment
```
Check my project size, recommend the best deployment platform, and deploy

Deploy to Vercel only if all tests pass and linting succeeds
```

### 4. Cost Optimization
```
Show me which features are costing the most

Suggest how to reduce my API costs

Compare costs between OpenAI and Groq for my usage pattern
```

---

## 🚨 Error Scenarios to Test

### Test error handling:

1. **Invalid API Key:**
   - Set wrong API key in `.env`
   - Try any command
   - Should show clear error message

2. **Backend Disconnected:**
   - Stop backend server
   - Try any command
   - Should show "Backend disconnected" error

3. **Invalid Git Repo:**
   - Try Git commands in non-Git folder
   - Should provide helpful error

4. **Docker Not Running:**
   - Stop Docker Desktop
   - Try Docker commands
   - Should detect and inform user

---

## ✅ Success Criteria

After testing, you should have:
- [ ] Successfully reviewed at least 3 files
- [ ] Generated and run tests
- [ ] Completed a pre-push validation
- [ ] Deployed a Docker container
- [ ] Checked API costs
- [ ] Used at least 10 different commands
- [ ] Total cost < $0.10
- [ ] All features working correctly

---

## 💡 Pro Tips

1. **Use chat for complex workflows** - More flexible than commands
2. **Check costs frequently** - Stay within budget
3. **Test with small files first** - Lower costs
4. **Save common prompts** - Faster testing
5. **Monitor backend logs** - Catch issues early

---

**Happy Testing! 🎉**
