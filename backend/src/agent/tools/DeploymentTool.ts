import { Tool, ToolContext } from '../../types/index.js';
import { execSync } from 'child_process';
import { statSync, readdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger.js';

// Calculate directory size recursively
function getDirectorySize(dirPath: string): number {
    let totalSize = 0;
    
    try {
        const files = readdirSync(dirPath, { withFileTypes: true });
        
        for (const file of files) {
            const fullPath = join(dirPath, file.name);
            
            // Skip common large directories
            if (file.name === 'node_modules' || file.name === '.git' || 
                file.name === 'dist' || file.name === 'build' || 
                file.name === '.next' || file.name === 'coverage') {
                continue;
            }
            
            if (file.isDirectory()) {
                totalSize += getDirectorySize(fullPath);
            } else {
                try {
                    totalSize += statSync(fullPath).size;
                } catch {
                    // Skip files that can't be read
                }
            }
        }
    } catch {
        // Skip directories that can't be read
    }
    
    return totalSize;
}

// Detect project type
function detectProjectType(workspaceRoot: string): {
    type: string;
    framework: string | null;
    deployable: boolean;
} {
    const packageJsonPath = join(workspaceRoot, 'package.json');
    const requirementsPath = join(workspaceRoot, 'requirements.txt');
    const streamlitPath = join(workspaceRoot, 'streamlit_app.py');
    const nextConfigPath = join(workspaceRoot, 'next.config.js');
    
    // Check for Streamlit
    if (existsSync(streamlitPath) || existsSync(requirementsPath)) {
        return { type: 'python', framework: 'streamlit', deployable: true };
    }
    
    // Check for Next.js
    if (existsSync(nextConfigPath)) {
        return { type: 'node', framework: 'nextjs', deployable: true };
    }
    
    // Check for generic Node.js
    if (existsSync(packageJsonPath)) {
        try {
            const packageJson = require(packageJsonPath);
            
            // Detect frameworks
            if (packageJson.dependencies?.['next']) {
                return { type: 'node', framework: 'nextjs', deployable: true };
            }
            if (packageJson.dependencies?.['react']) {
                return { type: 'node', framework: 'react', deployable: true };
            }
            if (packageJson.dependencies?.['express']) {
                return { type: 'node', framework: 'express', deployable: true };
            }
            
            return { type: 'node', framework: null, deployable: true };
        } catch {
            return { type: 'node', framework: null, deployable: true };
        }
    }
    
    return { type: 'unknown', framework: null, deployable: false };
}

// Auto-generate Dockerfile based on project type
function generateDockerfile(workspaceRoot: string, projectInfo: any): string {
    const packageJsonPath = join(workspaceRoot, 'package.json');
    let packageJson: any = {};
    let port = '3000';
    
    if (existsSync(packageJsonPath)) {
        packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        // Try to detect port from common sources
        const serverFiles = ['server.js', 'index.js', 'app.js', 'src/server.ts', 'src/index.ts'];
        for (const file of serverFiles) {
            const filePath = join(workspaceRoot, file);
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                const portMatch = content.match(/PORT\s*=\s*(?:process\.env\.PORT\s*\|\|\s*)?(\d+)/);
                if (portMatch) port = portMatch[1];
                break;
            }
        }
    }
    
    if (projectInfo.type === 'node') {
        const nodeVersion = packageJson.engines?.node || '18';
        const startCommand = packageJson.scripts?.start || 'node server.js';
        
        return `# Auto-generated Dockerfile for Node.js application
FROM node:${nodeVersion}-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE ${port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:${port}/api/todos', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start application
CMD ["${startCommand.split(' ')[0]}", "${startCommand.split(' ').slice(1).join('", "')}"]
`;
    }
    
    // Python/Streamlit
    if (projectInfo.type === 'python') {
        return `# Auto-generated Dockerfile for Python application
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${port}

CMD ["streamlit", "run", "streamlit_app.py", "--server.port=${port}", "--server.address=0.0.0.0"]
`;
    }
    
    return '';
}

// Auto-generate .dockerignore
function generateDockerignore(): string {
    return `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.DS_Store
coverage
.vscode
.idea
*.log
dist
build
.next
`;
}

// Auto-generate render.yaml
function generateRenderYaml(appName: string, port: string): string {
    return `services:
  - type: web
    name: ${appName}
    env: docker
    dockerfilePath: ./Dockerfile
    plan: free
    envVars:
      - key: PORT
        value: ${port}
`;
}

// Auto-generate deployment guide
function generateDeploymentGuide(appName: string, repoUrl: string): string {
    return `# 🚀 Deployment Guide - ${appName}

## Auto-Generated Files
This project now includes:
- ✅ Dockerfile (containerizes your application)
- ✅ .dockerignore (optimizes Docker builds)
- ✅ render.yaml (configures Render.com deployment)

## Quick Deploy to Render.com (Recommended)

**Get a shareable link in 2 minutes:**

1. **Visit:** [render.com](https://render.com) and sign up (free)
2. **Click:** "New +" → "Web Service"
3. **Connect:** Your GitHub account
4. **Select:** \`${appName}\` repository
5. **Deploy:** Render auto-detects the Dockerfile
6. **Done!** Share your link: \`https://${appName}.onrender.com\`

## Alternative Platforms

### Railway.app
\`\`\`bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
\`\`\`
**Link:** \`https://${appName}.up.railway.app\`

### Fly.io
\`\`\`bash
# Install Fly CLI
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Deploy
fly launch --name ${appName}
\`\`\`
**Link:** \`https://${appName}.fly.dev\`

## Docker Hub (For Sharing Images)

\`\`\`bash
# Login
docker login

# Tag and push
docker tag ${appName} yourusername/${appName}:latest
docker push yourusername/${appName}:latest
\`\`\`

**Anyone can run your app:**
\`\`\`bash
docker pull yourusername/${appName}:latest
docker run -p 3001:3001 yourusername/${appName}:latest
\`\`\`

## 🎯 What's Next?

1. Push these new files to GitHub
2. Deploy to your chosen platform
3. Share the live link with others!

All deployment files are configured and ready to use.
`;
}

export const DockerDeployPrepTool: Tool = {
    name: 'prepare_docker_deployment',
    description: 'Automatically prepares project for Docker deployment by generating Dockerfile, .dockerignore, render.yaml, and deployment guide. Use this before deploying to cloud platforms.',
    parameters: [
        {
            name: 'appName',
            type: 'string',
            description: 'Application name for deployment (defaults to project folder name)',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<string> => {
        const workspaceRoot = context.workspaceRoot || process.cwd();
        const { appName = 'app' } = args;
        
        try {
            let result = '🔧 Preparing Docker Deployment\n';
            result += '='.repeat(60) + '\n\n';
            
            // Detect project type
            const projectInfo = detectProjectType(workspaceRoot);
            result += `📦 Project Type: ${projectInfo.type} (${projectInfo.framework || 'generic'})\n\n`;
            
            // Check and generate Dockerfile
            const dockerfilePath = join(workspaceRoot, 'Dockerfile');
            if (!existsSync(dockerfilePath)) {
                const dockerfile = generateDockerfile(workspaceRoot, projectInfo);
                writeFileSync(dockerfilePath, dockerfile);
                result += '✅ Created Dockerfile\n';
            } else {
                result += 'ℹ️  Dockerfile already exists (not modified)\n';
            }
            
            // Check and generate .dockerignore
            const dockerignorePath = join(workspaceRoot, '.dockerignore');
            if (!existsSync(dockerignorePath)) {
                writeFileSync(dockerignorePath, generateDockerignore());
                result += '✅ Created .dockerignore\n';
            } else {
                result += 'ℹ️  .dockerignore already exists (not modified)\n';
            }
            
            // Check and generate render.yaml
            const renderYamlPath = join(workspaceRoot, 'render.yaml');
            if (!existsSync(renderYamlPath)) {
                writeFileSync(renderYamlPath, generateRenderYaml(appName, '3001'));
                result += '✅ Created render.yaml\n';
            } else {
                result += 'ℹ️  render.yaml already exists (not modified)\n';
            }
            
            // Always create/update deployment guide
            const deploymentGuidePath = join(workspaceRoot, 'DEPLOYMENT.md');
            const repoUrl = execSync('git config --get remote.origin.url', { 
                cwd: workspaceRoot, 
                encoding: 'utf-8' 
            }).trim().replace('.git', '');
            
            writeFileSync(deploymentGuidePath, generateDeploymentGuide(appName, repoUrl));
            result += '✅ Created DEPLOYMENT.md\n\n';
            
            result += '📋 Summary:\n';
            result += '━'.repeat(60) + '\n';
            result += '  Files ready for Docker deployment:\n';
            result += '  • Dockerfile - Containerizes your application\n';
            result += '  • .dockerignore - Optimizes build process\n';
            result += '  • render.yaml - Render.com configuration\n';
            result += '  • DEPLOYMENT.md - Deployment instructions\n\n';
            
            result += '🚀 Next Steps:\n';
            result += '  1. Commit these files: git add . && git commit -m "Add deployment config"\n';
            result += '  2. Push to GitHub: git push\n';
            result += '  3. Deploy to Render.com (see DEPLOYMENT.md)\n';
            result += '  4. Share your live link!\n\n';
            
            result += `💡 Quick Deploy: Visit render.com → New Web Service → Select your repo\n`;
            result += `   Your app will be live at: https://${appName}.onrender.com\n`;
            
            return result;
        } catch (error: any) {
            logger.error('Docker deployment preparation failed:', error);
            return `❌ Failed to prepare deployment: ${error.message}`;
        }
    },
};

export const AutoDeployTool: Tool = {
    name: 'auto_deploy',
    description: 'Automatically deploy project to Streamlit, Vercel, or GitHub Pages. Checks project size (<2GB) and type, then deploys to appropriate platform.',
    parameters: [
        {
            name: 'platform',
            type: 'string',
            description: 'Deployment platform: streamlit, vercel, github-pages, auto (auto-detect)',
            required: false,
            enum: ['streamlit', 'vercel', 'github-pages', 'auto'],
        },
        {
            name: 'appName',
            type: 'string',
            description: 'Application name for deployment',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<string> => {
        const { platform = 'auto', appName } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();
        
        try {
            let result = '🚀 Auto-Deploy Analysis\\n';
            result += '=' .repeat(60) + '\\n\\n';
            
            // Check project size (excluding node_modules, .git, etc.)
            result += '📊 Checking project size...\\n';
            const sizeBytes = getDirectorySize(workspaceRoot);
            const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
            const sizeGB = (sizeBytes / (1024 * 1024 * 1024)).toFixed(2);
            
            result += `   Project size: ${sizeMB} MB (${sizeGB} GB)\\n`;
            
            if (parseFloat(sizeGB) > 2) {
                result += '\\n❌ Project exceeds 2GB limit for auto-deployment\\n';
                result += '   Consider using Docker or manual deployment\\n';
                return result;
            }
            
            result += '   ✅ Size check passed\\n\\n';
            
            // Detect project type
            result += '🔍 Detecting project type...\\n';
            const projectInfo = detectProjectType(workspaceRoot);
            result += `   Type: ${projectInfo.type}\\n`;
            result += `   Framework: ${projectInfo.framework || 'Generic'}\\n`;
            result += `   Deployable: ${projectInfo.deployable ? 'Yes' : 'No'}\\n\\n`;
            
            if (!projectInfo.deployable) {
                result += '⚠️  Project type not suitable for auto-deployment\\n';
                return result;
            }
            
            // Determine deployment platform
            let targetPlatform = platform;
            if (platform === 'auto') {
                if (projectInfo.framework === 'streamlit') {
                    targetPlatform = 'streamlit';
                } else if (projectInfo.type === 'node') {
                    targetPlatform = 'vercel';
                } else {
                    targetPlatform = 'github-pages';
                }
            }
            
            result += `🎯 Target platform: ${targetPlatform}\\n\\n`;
            
            // Execute deployment
            switch (targetPlatform) {
                case 'streamlit':
                    result += await deployToStreamlit(workspaceRoot, appName);
                    break;
                case 'vercel':
                    result += await deployToVercel(workspaceRoot, appName);
                    break;
                case 'github-pages':
                    result += await deployToGitHubPages(workspaceRoot);
                    break;
                default:
                    result += `❌ Unsupported platform: ${targetPlatform}\\n`;
            }
            
            return result;
        } catch (error: any) {
            logger.error('Auto-deployment failed:', error);
            return `❌ Deployment failed: ${error.message}`;
        }
    },
};

async function deployToStreamlit(workspaceRoot: string, _appName?: string): Promise<string> {
    let result = '📦 Deploying to Streamlit Cloud...\\n\\n';
    
    try {
        // Check if streamlit CLI is installed
        try {
            execSync('streamlit --version', { encoding: 'utf-8', stdio: 'pipe' });
        } catch {
            result += '⚠️  Streamlit CLI not installed\\n';
            result += '   Install: pip install streamlit\\n\\n';
        }
        
        // Check for requirements.txt
        const requirementsPath = join(workspaceRoot, 'requirements.txt');
        if (!existsSync(requirementsPath)) {
            result += '⚠️  requirements.txt not found\\n';
            result += '   Creating basic requirements.txt...\\n';
            
            execSync('pip freeze > requirements.txt', { cwd: workspaceRoot });
            result += '   ✅ Created requirements.txt\\n\\n';
        }
        
        // Check Git status
        try {
            const gitStatus = execSync('git status --porcelain', {
                cwd: workspaceRoot,
                encoding: 'utf-8',
            });
            
            if (gitStatus.trim()) {
                result += '📝 Committing changes...\\n';
                execSync('git add .', { cwd: workspaceRoot });
                execSync('git commit -m "Prepare for Streamlit deployment"', { cwd: workspaceRoot });
                result += '   ✅ Changes committed\\n\\n';
            }
        } catch {
            // No git repo or no changes
        }
        
        result += '🔗 Streamlit Cloud Deployment Steps:\\n';
        result += '   1. Push your code to GitHub\\n';
        result += '   2. Go to https://share.streamlit.io/\\n';
        result += '   3. Click "New app"\\n';
        result += '   4. Select your repository\\n';
        result += '   5. Choose main file (e.g., streamlit_app.py or app.py)\\n';
        result += '   6. Click "Deploy"\\n\\n';
        
        result += '💡 Manual deployment command:\\n';
        result += '   git push origin main\\n';
        result += '   Then deploy via Streamlit Cloud UI\\n';
        
        return result;
    } catch (error: any) {
        return `❌ Streamlit deployment setup failed: ${error.message}\\n`;
    }
}

async function deployToVercel(workspaceRoot: string, _appName?: string): Promise<string> {
    let result = '📦 Deploying to Vercel...\\n\\n';
    
    try {
        // Check if vercel CLI is installed
        let vercelInstalled = false;
        try {
            execSync('vercel --version', { encoding: 'utf-8', stdio: 'pipe' });
            vercelInstalled = true;
        } catch {
            result += '⚠️  Vercel CLI not installed\\n';
            result += '   Installing Vercel CLI...\\n';
            try {
                execSync('npm install -g vercel', { encoding: 'utf-8', stdio: 'pipe' });
                result += '   ✅ Vercel CLI installed\\n\\n';
                vercelInstalled = true;
            } catch {
                result += '   ❌ Failed to install Vercel CLI\\n';
                result += '   Install manually: npm install -g vercel\\n\\n';
            }
        }
        
        if (vercelInstalled) {
            result += '🚀 Deploying to Vercel...\\n';
            
            try {
                // Deploy with vercel CLI
                const deployOutput = execSync('vercel --yes --prod', {
                    cwd: workspaceRoot,
                    encoding: 'utf-8',
                    timeout: 120000, // 2 minute timeout
                });
                
                result += '✅ Deployment successful!\\n\\n';
                result += 'Deployment output:\\n';
                result += deployOutput + '\\n';
                
                // Extract URL from output
                const urlRegex = new RegExp('https://[\\w\\-\\.]+\\.vercel\\.app');
                const urlMatch = deployOutput.match(urlRegex);
                if (urlMatch) {
                    result += `\\n🌐 Live URL: ${urlMatch[0]}\\n`;
                }
            } catch (error: any) {
                const output = error.stdout || error.message;
                
                if (output.includes('No existing credentials found')) {
                    result += '⚠️  Not logged in to Vercel\\n';
                    result += '   Run: vercel login\\n';
                    result += '   Then: vercel --prod\\n';
                } else if (output.includes('Error')) {
                    result += `❌ Deployment failed: ${output}\\n`;
                } else {
                    result += '✅ Deployment initiated\\n';
                    result += output + '\\n';
                }
            }
        } else {
            result += '📝 Manual Vercel deployment steps:\\n';
            result += '   1. Install Vercel CLI: npm install -g vercel\\n';
            result += '   2. Login: vercel login\\n';
            result += '   3. Deploy: vercel --prod\\n';
            result += '   OR use Vercel Dashboard: https://vercel.com/new\\n';
        }
        
        return result;
    } catch (error: any) {
        return `❌ Vercel deployment failed: ${error.message}\\n`;
    }
}

async function deployToGitHubPages(workspaceRoot: string): Promise<string> {
    let result = '📦 Deploying to GitHub Pages...\\n\\n';
    
    try {
        // Check if this is a Git repo
        try {
            execSync('git rev-parse --is-inside-work-tree', {
                cwd: workspaceRoot,
                stdio: 'pipe',
            });
        } catch {
            result += '❌ Not a Git repository\\n';
            result += '   Initialize with: git init\\n';
            return result;
        }
        
        // Check for gh-pages branch or create it
        result += '🔧 Setting up GitHub Pages...\\n';
        
        // Check if build directory exists
        const buildDirs = ['build', 'dist', 'public', 'out'];
        let buildDir: string | null = null;
        
        for (const dir of buildDirs) {
            if (existsSync(join(workspaceRoot, dir))) {
                buildDir = dir;
                break;
            }
        }
        
        if (!buildDir) {
            result += '⚠️  No build directory found (build, dist, public, out)\\n';
            result += '   Build your project first\\n\\n';
        }
        
        result += '📝 GitHub Pages deployment steps:\\n';
        result += '   1. Build your project (npm run build)\\n';
        result += '   2. Install gh-pages: npm install -g gh-pages\\n';
        result += `   3. Deploy: gh-pages -d ${buildDir || 'build'}\\n`;
        result += '   4. Enable GitHub Pages in repo settings\\n';
        result += '   5. Select gh-pages branch\\n\\n';
        
        result += '🔗 Or use GitHub Actions for automatic deployment\\n';
        result += '   Add .github/workflows/deploy.yml to your repo\\n';
        
        return result;
    } catch (error: any) {
        return `❌ GitHub Pages setup failed: ${error.message}\\n`;
    }
}

export const CompleteDockerDeployTool: Tool = {
    name: 'complete_docker_deploy',
    description: 'Complete end-to-end Docker deployment: generates all files, builds image, creates and runs container. Use this when user wants everything done automatically.',
    parameters: [
        {
            name: 'appName',
            type: 'string',
            description: 'Application name for deployment',
            required: true,
        },
        {
            name: 'port',
            type: 'string',
            description: 'Port to expose (default: 3001)',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<string> => {
        const workspaceRoot = context.workspaceRoot || process.cwd();
        const { appName, port = '3001' } = args;
        
        try {
            let result = '🚀 Complete Docker Deployment\n';
            result += '='.repeat(60) + '\n\n';
            
            // Step 1: Prepare files
            result += '📋 Step 1: Preparing deployment files...\n';
            const projectInfo = detectProjectType(workspaceRoot);
            
            // Generate Dockerfile if missing
            const dockerfilePath = join(workspaceRoot, 'Dockerfile');
            if (!existsSync(dockerfilePath)) {
                const dockerfile = generateDockerfile(workspaceRoot, projectInfo);
                writeFileSync(dockerfilePath, dockerfile);
                result += '   ✅ Created Dockerfile\n';
            } else {
                result += '   ℹ️  Using existing Dockerfile\n';
            }
            
            // Generate .dockerignore if missing
            const dockerignorePath = join(workspaceRoot, '.dockerignore');
            if (!existsSync(dockerignorePath)) {
                writeFileSync(dockerignorePath, generateDockerignore());
                result += '   ✅ Created .dockerignore\n';
            }
            
            result += '\n';
            
            // Step 2: Build Docker image
            result += '📦 Step 2: Building Docker image...\n';
            const imageName = `${appName}:latest`;
            
            try {
                const buildOutput = execSync(
                    `docker build -t ${imageName} .`,
                    { cwd: workspaceRoot, encoding: 'utf-8', stdio: 'pipe' }
                );
                result += `   ✅ Image built: ${imageName}\n\n`;
            } catch (error: any) {
                result += `   ❌ Build failed: ${error.message}\n`;
                result += '   Make sure Docker Desktop is running\n';
                return result;
            }
            
            // Step 3: Stop existing container if running
            result += '🛑 Step 3: Checking for existing container...\n';
            try {
                execSync(`docker stop ${appName}`, { stdio: 'pipe' });
                execSync(`docker rm ${appName}`, { stdio: 'pipe' });
                result += `   ✅ Removed existing container: ${appName}\n\n`;
            } catch {
                result += '   ℹ️  No existing container to remove\n\n';
            }
            
            // Step 4: Run container
            result += '🚀 Step 4: Starting container...\n';
            try {
                const runOutput = execSync(
                    `docker run -d -p ${port}:${port} --name ${appName} ${imageName}`,
                    { encoding: 'utf-8', stdio: 'pipe' }
                );
                const containerId = runOutput.trim().substring(0, 12);
                result += `   ✅ Container running: ${containerId}\n\n`;
            } catch (error: any) {
                result += `   ❌ Failed to start container: ${error.message}\n`;
                return result;
            }
            
            // Step 5: Verify container is running
            result += '✅ Step 5: Verifying deployment...\n';
            try {
                const inspectOutput = execSync(
                    `docker inspect ${appName}`,
                    { encoding: 'utf-8', stdio: 'pipe' }
                );
                const containerInfo = JSON.parse(inspectOutput)[0];
                const isRunning = containerInfo.State.Running;
                
                if (isRunning) {
                    result += `   ✅ Status: Running\n`;
                    result += `   📍 Port: ${port}\n`;
                    result += `   🆔 Container: ${containerInfo.Id.substring(0, 12)}\n\n`;
                } else {
                    result += `   ⚠️  Container created but not running\n`;
                    result += `   Check logs: docker logs ${appName}\n\n`;
                }
            } catch (error: any) {
                result += `   ⚠️  Could not verify status\n\n`;
            }
            
            // Summary
            result += '━'.repeat(60) + '\n';
            result += '🎉 DEPLOYMENT COMPLETE!\n';
            result += '━'.repeat(60) + '\n\n';
            result += `📦 Image: ${imageName}\n`;
            result += `🐳 Container: ${appName}\n`;
            result += `🌐 Local URL: http://localhost:${port}\n\n`;
            
            result += '📋 Useful Commands:\n';
            result += `   • View logs: docker logs ${appName}\n`;
            result += `   • Stop: docker stop ${appName}\n`;
            result += `   • Restart: docker restart ${appName}\n`;
            result += `   • Remove: docker rm -f ${appName}\n\n`;
            
            result += '🌍 To Share Publicly:\n';
            result += '   1. Push to Docker Hub:\n';
            result += `      docker tag ${imageName} yourusername/${appName}\n`;
            result += `      docker push yourusername/${appName}\n\n`;
            result += '   2. Deploy to cloud (Render.com recommended):\n';
            result += '      • Push code to GitHub\n';
            result += '      • Connect repo on Render.com\n';
            result += `      • Your app will be at: https://${appName}.onrender.com\n`;
            
            return result;
        } catch (error: any) {
            logger.error('Complete Docker deployment failed:', error);
            return `❌ Deployment failed: ${error.message}\n\nMake sure Docker Desktop is running and try again.`;
        }
    },
};

export const DeployToCloudTool: Tool = {
    name: 'deploy_to_cloud',
    description: 'Deploy project to cloud platform (Render.com) for public access. Creates deployment files, pushes to GitHub, and provides deployment URL. Use when user wants a shareable public link.',
    parameters: [
        {
            name: 'appName',
            type: 'string',
            description: 'Application name for deployment',
            required: true,
        },
        {
            name: 'platform',
            type: 'string',
            description: 'Cloud platform: render (default), railway, fly',
            required: false,
            enum: ['render', 'railway', 'fly'],
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<string> => {
        const workspaceRoot = context.workspaceRoot || process.cwd();
        const { appName, platform = 'render' } = args;
        
        try {
            let result = '🌍 Cloud Deployment\n';
            result += '='.repeat(60) + '\n\n';
            
            // Step 1: Check Git repository
            result += '📋 Step 1: Checking Git repository...\n';
            let repoUrl = '';
            try {
                repoUrl = execSync('git config --get remote.origin.url', {
                    cwd: workspaceRoot,
                    encoding: 'utf-8',
                    stdio: 'pipe'
                }).trim();
                result += `   ✅ Git remote: ${repoUrl}\n\n`;
            } catch {
                result += '   ❌ No Git remote configured\n';
                result += '   Run: git remote add origin <your-github-repo-url>\n';
                return result;
            }
            
            // Step 2: Prepare deployment files
            result += '📦 Step 2: Preparing deployment files...\n';
            const projectInfo = detectProjectType(workspaceRoot);
            
            // Generate Dockerfile
            const dockerfilePath = join(workspaceRoot, 'Dockerfile');
            if (!existsSync(dockerfilePath)) {
                writeFileSync(dockerfilePath, generateDockerfile(workspaceRoot, projectInfo));
                result += '   ✅ Created Dockerfile\n';
            }
            
            // Generate .dockerignore
            const dockerignorePath = join(workspaceRoot, '.dockerignore');
            if (!existsSync(dockerignorePath)) {
                writeFileSync(dockerignorePath, generateDockerignore());
                result += '   ✅ Created .dockerignore\n';
            }
            
            // Generate platform-specific config
            if (platform === 'render') {
                const renderYamlPath = join(workspaceRoot, 'render.yaml');
                if (!existsSync(renderYamlPath)) {
                    writeFileSync(renderYamlPath, generateRenderYaml(appName, '3001'));
                    result += '   ✅ Created render.yaml\n';
                }
            }
            
            result += '\n';
            
            // Step 3: Commit and push
            result += '🚀 Step 3: Pushing to GitHub...\n';
            try {
                // Check if there are changes
                const gitStatus = execSync('git status --porcelain', {
                    cwd: workspaceRoot,
                    encoding: 'utf-8',
                    stdio: 'pipe'
                });
                
                if (gitStatus.trim()) {
                    // Add all files
                    execSync('git add .', { cwd: workspaceRoot, stdio: 'pipe' });
                    result += '   ✅ Added files to git\n';
                    
                    // Commit
                    execSync('git commit -m "Add deployment configuration"', {
                        cwd: workspaceRoot,
                        stdio: 'pipe'
                    });
                    result += '   ✅ Committed changes\n';
                    
                    // Push
                    execSync('git push', { cwd: workspaceRoot, stdio: 'pipe' });
                    result += '   ✅ Pushed to GitHub\n\n';
                } else {
                    result += '   ℹ️  No changes to commit\n';
                    result += '   ✅ Repository is up to date\n\n';
                }
            } catch (error: any) {
                result += `   ⚠️  Git push failed: ${error.message}\n`;
                result += '   You may need to push manually\n\n';
            }
            
            // Step 4: Deployment instructions
            result += '━'.repeat(60) + '\n';
            result += '🎉 READY FOR CLOUD DEPLOYMENT!\n';
            result += '━'.repeat(60) + '\n\n';
            
            if (platform === 'render') {
                const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
                result += '🌐 Deploy to Render.com (RECOMMENDED):\n\n';
                result += '1. Visit: https://render.com\n';
                result += '2. Click "New +" → "Web Service"\n';
                result += '3. Connect your GitHub account\n';
                result += `4. Select repository: ${repoName}\n`;
                result += '5. Render will auto-detect Dockerfile\n';
                result += '6. Click "Create Web Service"\n\n';
                result += `📍 Your app will be live at: https://${appName}.onrender.com\n`;
                result += '⏱️  First deployment takes ~5 minutes\n';
                result += '✅ Free tier available (with auto-sleep)\n\n';
            } else if (platform === 'railway') {
                result += '🚂 Deploy to Railway.app:\n\n';
                result += '1. Visit: https://railway.app\n';
                result += '2. Click "New Project" → "Deploy from GitHub"\n';
                result += `3. Select repository\n`;
                result += '4. Railway auto-deploys\n';
                result += '5. Get URL from "Settings" → "Domains"\n\n';
                result += `📍 Your app will be live at: https://${appName}.up.railway.app\n`;
                result += '💳 $5 free credit monthly\n\n';
            } else if (platform === 'fly') {
                result += '✈️  Deploy to Fly.io:\n\n';
                result += '1. Install Fly CLI:\n';
                result += '   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"\n\n';
                result += '2. Login: fly auth login\n';
                result += `3. Deploy: fly launch --name ${appName}\n`;
                result += '4. Follow prompts\n\n';
                result += `📍 Your app will be live at: https://${appName}.fly.dev\n`;
                result += '✅ Free tier available\n\n';
            }
            
            result += '📋 Next Steps:\n';
            result += '   • Complete the deployment on your chosen platform\n';
            result += '   • Wait for build to complete (3-5 minutes)\n';
            result += '   • Share the public URL with anyone!\n';
            result += '   • No Docker or local setup needed for users\n\n';
            
            result += '💡 Your deployment files are ready and pushed to GitHub.\n';
            result += '   Just connect the repo on your cloud platform!\n';
            
            return result;
        } catch (error: any) {
            logger.error('Cloud deployment preparation failed:', error);
            return `❌ Deployment failed: ${error.message}`;
        }
    },
};
