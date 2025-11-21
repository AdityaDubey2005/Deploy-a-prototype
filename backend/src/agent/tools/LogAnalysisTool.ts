import { Tool, ToolContext, LogAnalysisResult, LogEntry, LogPattern } from '../../types/index.js';
import { readFile } from 'fs/promises';
import { logger } from '../../utils/logger.js';

export const LogAnalysisTool: Tool = {
    name: 'analyze_logs',
    description: 'Analyze application logs to identify errors, warnings, patterns, and anomalies. Provides insights and recommendations for debugging.',
    parameters: [
        {
            name: 'logFilePath',
            type: 'string',
            description: 'Path to the log file to analyze',
            required: true,
        },
        {
            name: 'timeRange',
            type: 'string',
            description: 'Optional time range filter (e.g., "last 1h", "last 24h")',
            required: false,
        },
        {
            name: 'severity',
            type: 'string',
            description: 'Filter by severity level: error, warning, info, debug',
            required: false,
            enum: ['error', 'warning', 'info', 'debug'],
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<LogAnalysisResult> => {
        const { logFilePath, timeRange, severity } = args;

        try {
            const fullPath = context.workspaceRoot
                ? `${context.workspaceRoot}/${logFilePath}`
                : logFilePath;

            const logContent = await readFile(fullPath, 'utf-8');
            const lines = logContent.split('\n').filter(line => line.trim());

            const errors: LogEntry[] = [];
            const warnings: LogEntry[] = [];
            const patterns: Map<string, number> = new Map();

            // Parse each log line
            for (const line of lines) {
                const entry = parseLogLine(line);

                // Filter by severity if specified
                if (severity && entry.level.toLowerCase() !== severity.toLowerCase()) {
                    continue;
                }

                // Categorize by level
                if (entry.level.toLowerCase().includes('error') || entry.level.toLowerCase().includes('err')) {
                    errors.push(entry);

                    // Track error patterns
                    const errorType = extractErrorType(entry.message);
                    patterns.set(errorType, (patterns.get(errorType) || 0) + 1);
                } else if (entry.level.toLowerCase().includes('warn')) {
                    warnings.push(entry);
                }

                // Track common patterns
                const pattern = extractPattern(entry.message);
                if (pattern) {
                    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
                }
            }

            // Convert patterns map to sorted array
            const logPatterns: LogPattern[] = Array.from(patterns.entries())
                .map(([pattern, occurrences]) => ({
                    pattern,
                    occurrences,
                    severity: determineSeverity(pattern, occurrences),
                    description: generateDescription(pattern, occurrences),
                }))
                .sort((a, b) => b.occurrences - a.occurrences)
                .slice(0, 10); // Top 10 patterns

            // Generate recommendations
            const recommendations: string[] = [];

            if (errors.length > 0) {
                recommendations.push(`Found ${errors.length} error(s). Review and fix critical errors first.`);

                // Check for common error patterns
                const connectionErrors = errors.filter(e =>
                    e.message.toLowerCase().includes('connection') ||
                    e.message.toLowerCase().includes('econnrefused')
                );
                if (connectionErrors.length > 0) {
                    recommendations.push('Multiple connection errors detected. Check service availability and network configuration.');
                }

                const timeoutErrors = errors.filter(e =>
                    e.message.toLowerCase().includes('timeout') ||
                    e.message.toLowerCase().includes('timed out')
                );
                if (timeoutErrors.length > 0) {
                    recommendations.push('Timeout errors detected. Consider increasing timeout values or optimizing slow operations.');
                }

                const authErrors = errors.filter(e =>
                    e.message.toLowerCase().includes('authentication') ||
                    e.message.toLowerCase().includes('unauthorized') ||
                    e.message.toLowerCase().includes('forbidden')
                );
                if (authErrors.length > 0) {
                    recommendations.push('Authentication/authorization errors found. Verify credentials and permissions.');
                }
            }

            if (warnings.length > 0) {
                recommendations.push(`${warnings.length} warning(s) detected. Address warnings to prevent future issues.`);
            }

            // Check for rapid error spikes
            const recentErrors = errors.slice(-10);
            if (recentErrors.length >= 5) {
                recommendations.push('Recent error spike detected. This may indicate an ongoing incident.');
            }

            if (recommendations.length === 0) {
                recommendations.push('No critical issues found. Logs appear healthy.');
            }

            const summary = `Analyzed ${lines.length} log lines. Found ${errors.length} errors, ${warnings.length} warnings. Identified ${logPatterns.length} significant patterns.`;

            logger.info(`Log analysis completed for ${logFilePath}: ${errors.length} errors, ${warnings.length} warnings`);

            return {
                summary,
                errors: errors.slice(0, 50), // Return up to 50 errors
                warnings: warnings.slice(0, 50), // Return up to 50 warnings
                patterns: logPatterns,
                recommendations,
            };
        } catch (error: any) {
            logger.error(`Log analysis failed for ${logFilePath}:`, error);
            throw new Error(`Failed to analyze logs: ${error.message}`);
        }
    },
};

function parseLogLine(line: string): LogEntry {
    // Try to parse common log formats

    // JSON format
    try {
        const json = JSON.parse(line);
        return {
            timestamp: json.timestamp || json.time || json.date,
            level: json.level || json.severity || 'info',
            message: json.message || json.msg || line,
            context: json,
        };
    } catch {
        // Not JSON, try other formats
    }

    // Common text format: [timestamp] [level] message
    const textMatch = line.match(/^\[?([^\]]+)\]?\s*\[?(\w+)\]?\s*(.+)$/);
    if (textMatch) {
        return {
            timestamp: textMatch[1],
            level: textMatch[2],
            message: textMatch[3],
        };
    }

    // Fallback: treat as plain message
    const levelMatch = line.match(/\b(ERROR|WARN|INFO|DEBUG|FATAL)\b/i);
    return {
        level: levelMatch ? levelMatch[1] : 'info',
        message: line,
    };
}

function extractErrorType(message: string): string {
    // Extract error class name if present
    const errorMatch = message.match(/(\w+Error):/);
    if (errorMatch) {
        return errorMatch[1];
    }

    // Extract common error keywords
    if (message.includes('connection')) return 'ConnectionError';
    if (message.includes('timeout')) return 'TimeoutError';
    if (message.includes('authentication')) return 'AuthenticationError';
    if (message.includes('not found')) return 'NotFoundError';
    if (message.includes('permission')) return 'PermissionError';

    return 'GenericError';
}

function extractPattern(message: string): string | null {
    // Remove timestamps, IDs, and other variable parts to identify patterns
    let pattern = message
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
        .replace(/\b\d+\b/g, '<NUM>')
        .replace(/\b0x[0-9a-f]+\b/gi, '<HEX>');

    // Return pattern only if it's different from original (contains variables)
    return pattern !== message ? pattern : null;
}

function determineSeverity(pattern: string, occurrences: number): 'high' | 'medium' | 'low' {
    if (occurrences > 100) return 'high';
    if (occurrences > 10) return 'medium';
    return 'low';
}

function generateDescription(pattern: string, occurrences: number): string {
    return `Pattern occurs ${occurrences} time(s) in the log file`;
}
