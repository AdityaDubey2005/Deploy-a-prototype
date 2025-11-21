import { Tool, ToolContext, CodeReviewResult, CodeIssue } from '../../types/index.js';
import { readFile } from 'fs/promises';
import { logger } from '../../utils/logger.js';

export const CodeReviewTool: Tool = {
    name: 'review_code',
    description: 'Analyze code for quality, security vulnerabilities, performance issues, and best practices. Returns detailed feedback with severity levels and suggestions.',
    parameters: [
        {
            name: 'filePath',
            type: 'string',
            description: 'Path to the code file to review (relative to workspace)',
            required: true,
        },
        {
            name: 'focusAreas',
            type: 'array',
            description: 'Specific areas to focus on: security, performance, style, best-practice',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<CodeReviewResult> => {
        const { filePath, focusAreas = ['security', 'performance', 'style', 'best-practice'] } = args;

        try {
            const fullPath = context.workspaceRoot
                ? `${context.workspaceRoot}/${filePath}`
                : filePath;

            const code = await readFile(fullPath, 'utf-8');
            const issues: CodeIssue[] = [];

            // Security checks
            if (focusAreas.includes('security')) {
                // Check for hardcoded secrets
                const secretPatterns = [
                    { pattern: /(api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/gi, msg: 'Potential hardcoded API key' },
                    { pattern: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi, msg: 'Potential hardcoded password' },
                    { pattern: /(secret|token)\s*[:=]\s*['"][^'"]+['"]/gi, msg: 'Potential hardcoded secret/token' },
                ];

                secretPatterns.forEach(({ pattern, msg }) => {
                    const matches = code.matchAll(pattern);
                    for (const match of matches) {
                        const lineNumber = code.substring(0, match.index).split('\n').length;
                        issues.push({
                            severity: 'error',
                            line: lineNumber,
                            message: msg,
                            suggestion: 'Use environment variables or secure secret management',
                            category: 'security',
                        });
                    }
                });

                // Check for SQL injection risks
                if (/execute\s*\(\s*["'].*\$\{.*\}.*["']\s*\)/gi.test(code)) {
                    issues.push({
                        severity: 'warning',
                        line: 0,
                        message: 'Potential SQL injection vulnerability with string interpolation',
                        suggestion: 'Use parameterized queries or prepared statements',
                        category: 'security',
                    });
                }
            }

            // Performance checks
            if (focusAreas.includes('performance')) {
                // Check for synchronous file operations
                if (/readFileSync|writeFileSync/g.test(code)) {
                    const matches = code.matchAll(/readFileSync|writeFileSync/g);
                    for (const match of matches) {
                        const lineNumber = code.substring(0, match.index).split('\n').length;
                        issues.push({
                            severity: 'warning',
                            line: lineNumber,
                            message: 'Synchronous file operation can block event loop',
                            suggestion: 'Use async file operations (readFile, writeFile)',
                            category: 'performance',
                        });
                    }
                }

                // Check for console.log in production code
                if (/console\.(log|debug|info)/g.test(code)) {
                    issues.push({
                        severity: 'info',
                        line: 0,
                        message: 'Console statements found in code',
                        suggestion: 'Use a proper logging library (winston, pino) for production',
                        category: 'performance',
                    });
                }
            }

            // Style checks
            if (focusAreas.includes('style')) {
                // Check for var usage (should use let/const)
                const varMatches = code.matchAll(/\bvar\s+/g);
                for (const match of varMatches) {
                    const lineNumber = code.substring(0, match.index).split('\n').length;
                    issues.push({
                        severity: 'info',
                        line: lineNumber,
                        message: 'Use of var keyword',
                        suggestion: 'Use let or const instead for better scoping',
                        category: 'style',
                    });
                }
            }

            // Best practice checks
            if (focusAreas.includes('best-practice')) {
                // Check for error handling
                if (/await\s+/.test(code) && !/try\s*{[\s\S]*catch/g.test(code)) {
                    issues.push({
                        severity: 'warning',
                        line: 0,
                        message: 'Async code without try-catch error handling',
                        suggestion: 'Add proper error handling for async operations',
                        category: 'best-practice',
                    });
                }
            }

            const errorCount = issues.filter(i => i.severity === 'error').length;
            const warningCount = issues.filter(i => i.severity === 'warning').length;

            // Calculate score (100 - deductions)
            const score = Math.max(0, 100 - (errorCount * 15) - (warningCount * 5));

            const summary = `Found ${errorCount} error(s), ${warningCount} warning(s), and ${issues.length - errorCount - warningCount} info item(s). Code quality score: ${score}/100`;

            const suggestions = [
                'Consider adding comprehensive unit tests',
                'Add JSDoc comments for public APIs',
                'Ensure proper error handling for all edge cases',
            ];

            if (errorCount > 0) {
                suggestions.unshift('Address critical security and error issues first');
            }

            logger.info(`Code review completed for ${filePath}: ${issues.length} issues found`);

            return {
                file: filePath,
                issues,
                suggestions,
                score,
                summary,
            };
        } catch (error: any) {
            logger.error(`Code review failed for ${filePath}:`, error);
            throw new Error(`Failed to review code: ${error.message}`);
        }
    },
};
