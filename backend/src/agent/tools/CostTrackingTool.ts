import { Tool, ToolContext } from '../../types/index.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger.js';

// Cost per 1M tokens (USD) - Updated as of Nov 2024
const MODEL_COSTS = {
    // OpenAI
    'gpt-4-turbo-preview': { input: 10.0, output: 30.0 },
    'gpt-4': { input: 30.0, output: 60.0 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'gpt-4o': { input: 5.0, output: 15.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    
    // Anthropic
    'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
    'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    
    // Groq (FREE but rate limited)
    'llama-3.1-70b-versatile': { input: 0.0, output: 0.0 },
    'llama-3.1-8b-instant': { input: 0.0, output: 0.0 },
    'llama3-70b-8192': { input: 0.0, output: 0.0 },
    'mixtral-8x7b-32768': { input: 0.0, output: 0.0 },
    
    // Ollama (FREE, local)
    'llama2': { input: 0.0, output: 0.0 },
    'llama3.1': { input: 0.0, output: 0.0 },
};

interface CostEntry {
    timestamp: number;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    request: string;
}

interface CostSummary {
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    costByProvider: Record<string, number>;
    costByModel: Record<string, number>;
    todayCost: number;
    weekCost: number;
    monthCost: number;
}

const COST_FILE = 'devops-agent-costs.json';

export class CostTracker {
    private static instance: CostTracker;
    private costLog: CostEntry[] = [];
    private costFilePath: string;

    private constructor() {
        this.costFilePath = join(process.cwd(), 'logs', COST_FILE);
        this.loadCostLog();
    }

    static getInstance(): CostTracker {
        if (!CostTracker.instance) {
            CostTracker.instance = new CostTracker();
        }
        return CostTracker.instance;
    }

    async loadCostLog(): Promise<void> {
        try {
            if (existsSync(this.costFilePath)) {
                const data = await readFile(this.costFilePath, 'utf-8');
                this.costLog = JSON.parse(data);
            }
        } catch (error) {
            logger.warn('Failed to load cost log, starting fresh');
            this.costLog = [];
        }
    }

    async saveCostLog(): Promise<void> {
        try {
            const dir = join(process.cwd(), 'logs');
            if (!existsSync(dir)) {
                await mkdir(dir, { recursive: true });
            }
            await writeFile(this.costFilePath, JSON.stringify(this.costLog, null, 2));
        } catch (error) {
            logger.error('Failed to save cost log:', error);
        }
    }

    async trackRequest(
        provider: string,
        model: string,
        inputTokens: number,
        outputTokens: number,
        request: string
    ): Promise<number> {
        const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
        
        let cost = 0;
        if (costs) {
            cost = (inputTokens / 1_000_000) * costs.input + 
                   (outputTokens / 1_000_000) * costs.output;
        }

        const entry: CostEntry = {
            timestamp: Date.now(),
            provider,
            model,
            inputTokens,
            outputTokens,
            cost,
            request: request.substring(0, 100), // Store first 100 chars
        };

        this.costLog.push(entry);
        await this.saveCostLog();

        logger.info(`API Cost: $${cost.toFixed(4)} (${provider}/${model})`);
        return cost;
    }

    getSummary(): CostSummary {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

        const summary: CostSummary = {
            totalCost: 0,
            totalRequests: this.costLog.length,
            totalTokens: 0,
            costByProvider: {},
            costByModel: {},
            todayCost: 0,
            weekCost: 0,
            monthCost: 0,
        };

        for (const entry of this.costLog) {
            summary.totalCost += entry.cost;
            summary.totalTokens += entry.inputTokens + entry.outputTokens;

            // By provider
            if (!summary.costByProvider[entry.provider]) {
                summary.costByProvider[entry.provider] = 0;
            }
            summary.costByProvider[entry.provider] += entry.cost;

            // By model
            if (!summary.costByModel[entry.model]) {
                summary.costByModel[entry.model] = 0;
            }
            summary.costByModel[entry.model] += entry.cost;

            // Time-based
            if (entry.timestamp >= oneDayAgo) {
                summary.todayCost += entry.cost;
            }
            if (entry.timestamp >= oneWeekAgo) {
                summary.weekCost += entry.cost;
            }
            if (entry.timestamp >= oneMonthAgo) {
                summary.monthCost += entry.cost;
            }
        }

        return summary;
    }

    getRecentEntries(limit: number = 10): CostEntry[] {
        return this.costLog.slice(-limit);
    }
}

export const CostTrackingTool: Tool = {
    name: 'view_api_costs',
    description: 'View API cost tracking and analytics for OpenAI, Anthropic, Groq, and Ollama usage',
    parameters: [
        {
            name: 'detailed',
            type: 'boolean',
            description: 'Show detailed cost breakdown by provider and model',
            required: false,
        },
        {
            name: 'recent',
            type: 'number',
            description: 'Number of recent requests to show (default: 10)',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, _context: ToolContext): Promise<string> => {
        const { detailed = true, recent = 10 } = args;

        try {
            const tracker = CostTracker.getInstance();
            const summary = tracker.getSummary();

            let result = '💰 API Cost Analysis\\n';
            result += '=' .repeat(60) + '\\n\\n';

            // Overall summary
            result += `📊 Overall Statistics:\\n`;
            result += `   Total Cost: $${summary.totalCost.toFixed(4)}\\n`;
            result += `   Total Requests: ${summary.totalRequests}\\n`;
            result += `   Total Tokens: ${summary.totalTokens.toLocaleString()}\\n\\n`;

            // Time-based costs
            result += `📅 Time-based Costs:\\n`;
            result += `   Today: $${summary.todayCost.toFixed(4)}\\n`;
            result += `   This Week: $${summary.weekCost.toFixed(4)}\\n`;
            result += `   This Month: $${summary.monthCost.toFixed(4)}\\n\\n`;

            if (detailed) {
                // By provider
                result += `🔧 Cost by Provider:\\n`;
                for (const [provider, cost] of Object.entries(summary.costByProvider)) {
                    result += `   ${provider}: $${cost.toFixed(4)}\\n`;
                }
                result += '\\n';

                // By model
                result += `🤖 Cost by Model:\\n`;
                for (const [model, cost] of Object.entries(summary.costByModel)) {
                    result += `   ${model}: $${cost.toFixed(4)}\\n`;
                }
                result += '\\n';
            }

            // Recent requests
            if (recent > 0) {
                const recentEntries = tracker.getRecentEntries(recent);
                result += `📝 Recent Requests (last ${Math.min(recent, recentEntries.length)}):\\n`;
                for (const entry of recentEntries) {
                    const date = new Date(entry.timestamp).toLocaleString();
                    result += `   ${date} | ${entry.provider}/${entry.model} | $${entry.cost.toFixed(4)}\\n`;
                }
            }

            // Recommendations
            result += '\\n💡 Recommendations:\\n';
            if (summary.totalCost > 1.0) {
                result += '   ⚠️  Consider using Groq (free) for development\\n';
            }
            if (summary.todayCost > 0.5) {
                result += '   ⚠️  High usage today - monitor your budget\\n';
            }
            if (Object.keys(summary.costByProvider).includes('openai') && summary.costByProvider.openai > 2.0) {
                result += '   💡 Switch to GPT-4o-mini for 90% cost reduction\\n';
            }
            if (summary.totalCost === 0) {
                result += '   ✅ Using free providers - no costs incurred!\\n';
            }

            return result;
        } catch (error: any) {
            logger.error('Cost tracking failed:', error);
            return `❌ Failed to retrieve cost data: ${error.message}`;
        }
    },
};

export const ResetCostsTool: Tool = {
    name: 'reset_api_costs',
    description: 'Reset API cost tracking data',
    parameters: [],
    execute: async (_args: Record<string, any>, _context: ToolContext): Promise<string> => {
        try {
            const tracker = CostTracker.getInstance();
            (tracker as any).costLog = [];
            await tracker.saveCostLog();

            logger.info('Cost tracking data reset');
            return '✅ Cost tracking data has been reset';
        } catch (error: any) {
            logger.error('Failed to reset cost data:', error);
            return `❌ Failed to reset cost data: ${error.message}`;
        }
    },
};
