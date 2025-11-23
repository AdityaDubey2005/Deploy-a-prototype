#!/usr/bin/env node

/**
 * Configuration Checker for DevOps Agent Backend
 * Run this script to validate your environment setup
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env') });

const RECOMMENDED_GROQ_MODELS = [
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768'
];

const PROBLEMATIC_GROQ_MODELS = [
    'llama3-70b-8192',
    'llama2-70b-4096'
];

console.log('🔍 DevOps Agent Configuration Checker\n');
console.log('=' .repeat(60));

// Check .env file exists
if (!existsSync(join(__dirname, '.env'))) {
    console.log('\n❌ ERROR: .env file not found!');
    console.log('   Solution: Copy .env.example to .env');
    console.log('   Command: cp .env.example .env');
    process.exit(1);
}

console.log('✅ .env file found\n');

// Check AI Provider
const provider = process.env.AI_PROVIDER || 'not set';
console.log(`📡 AI Provider: ${provider}`);

if (provider === 'not set') {
    console.log('   ⚠️  WARNING: AI_PROVIDER not set, will use default (groq)');
}

// Provider-specific checks
let hasIssues = false;

switch (provider) {
    case 'groq':
        console.log('\n🔧 Checking Groq Configuration...');
        
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey || groqKey === 'your_groq_api_key_here') {
            console.log('   ❌ GROQ_API_KEY not configured');
            console.log('   Solution: Get key from https://console.groq.com/keys');
            hasIssues = true;
        } else {
            console.log('   ✅ GROQ_API_KEY is set');
        }

        const groqModel = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
        console.log(`   📦 Model: ${groqModel}`);

        if (PROBLEMATIC_GROQ_MODELS.includes(groqModel)) {
            console.log('   ⚠️  WARNING: This model has known function calling issues!');
            console.log('   Recommended models:');
            RECOMMENDED_GROQ_MODELS.forEach(m => console.log(`      - ${m}`));
            console.log(`   Solution: Update GROQ_MODEL in .env to one of the above`);
            hasIssues = true;
        } else if (RECOMMENDED_GROQ_MODELS.includes(groqModel)) {
            console.log('   ✅ Using recommended model with good function calling support');
        } else {
            console.log('   ⚠️  Unknown model - may have function calling issues');
        }
        break;

    case 'openai':
        console.log('\n🔧 Checking OpenAI Configuration...');
        
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey || openaiKey === 'your_openai_api_key_here') {
            console.log('   ❌ OPENAI_API_KEY not configured');
            console.log('   Solution: Get key from https://platform.openai.com/api-keys');
            hasIssues = true;
        } else {
            console.log('   ✅ OPENAI_API_KEY is set');
        }

        const openaiModel = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
        console.log(`   📦 Model: ${openaiModel}`);
        console.log('   ✅ OpenAI has excellent function calling support');
        break;

    case 'anthropic':
        console.log('\n🔧 Checking Anthropic Configuration...');
        
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey || anthropicKey === 'your_anthropic_api_key_here') {
            console.log('   ❌ ANTHROPIC_API_KEY not configured');
            console.log('   Solution: Get key from https://console.anthropic.com/');
            hasIssues = true;
        } else {
            console.log('   ✅ ANTHROPIC_API_KEY is set');
        }

        const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';
        console.log(`   📦 Model: ${anthropicModel}`);
        console.log('   ✅ Claude has excellent function calling support');
        break;

    case 'ollama':
        console.log('\n🔧 Checking Ollama Configuration...');
        
        const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        console.log(`   🌐 Base URL: ${ollamaUrl}`);
        console.log('   ℹ️  Make sure Ollama is running: ollama serve');
        
        const ollamaModel = process.env.OLLAMA_MODEL || 'llama2';
        console.log(`   📦 Model: ${ollamaModel}`);
        console.log('   ⚠️  Note: Ollama has limited function calling support');
        break;

    default:
        console.log(`   ⚠️  Unknown provider: ${provider}`);
        console.log('   Valid options: openai, anthropic, groq, ollama');
        hasIssues = true;
}

// Check GitHub Token
console.log('\n🔧 Checking GitHub Configuration...');
const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken || githubToken === 'your_github_personal_access_token') {
    console.log('   ⚠️  GITHUB_TOKEN not configured');
    console.log('   Impact: GitHub PR/Issue commands will not work');
    console.log('   Solution: Get token from https://github.com/settings/tokens');
} else {
    console.log('   ✅ GITHUB_TOKEN is set');
}

// Check Port
console.log('\n🔧 Checking Server Configuration...');
const port = process.env.PORT || '3000';
console.log(`   🚪 Port: ${port}`);

// Check Docker
console.log('\n🔧 Checking Docker Configuration...');
const dockerHost = process.env.DOCKER_HOST;
if (dockerHost) {
    console.log(`   🐳 Docker Host: ${dockerHost}`);
} else {
    console.log('   ℹ️  Using default Docker socket');
}

// Check Kubernetes
console.log('\n🔧 Checking Kubernetes Configuration...');
const kubeconfig = process.env.KUBECONFIG;
if (kubeconfig) {
    console.log(`   ☸️  KUBECONFIG: ${kubeconfig}`);
    if (existsSync(kubeconfig)) {
        console.log('   ✅ Kubeconfig file exists');
    } else {
        console.log('   ⚠️  WARNING: Kubeconfig file not found');
    }
} else {
    const defaultKubeconfig = join(process.env.HOME || process.env.USERPROFILE || '', '.kube', 'config');
    if (existsSync(defaultKubeconfig)) {
        console.log('   ✅ Using default kubeconfig');
    } else {
        console.log('   ℹ️  No kubeconfig found (K8s commands will not work)');
    }
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasIssues) {
    console.log('\n⚠️  Configuration has issues that need attention');
    console.log('   Please review the warnings above and update your .env file\n');
    console.log('📚 For more help, see TROUBLESHOOTING.md\n');
    process.exit(1);
} else {
    console.log('\n✅ Configuration looks good!');
    console.log('   You can start the backend with: npm run dev\n');
}

// Additional recommendations
console.log('💡 Recommendations:');
console.log('   1. Restart backend after any .env changes');
console.log('   2. Check logs for any runtime issues');
console.log('   3. Test connection: curl http://localhost:' + port + '/api/health');
console.log('   4. See TROUBLESHOOTING.md for common issues\n');
