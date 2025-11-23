import { Tool, ToolContext } from '../../types/index.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger.js';

export const TestExecutionTool: Tool = {
    name: 'run_tests',
    description: 'Execute tests in the project. Automatically detects test framework and runs tests.',
    parameters: [
        {
            name: 'path',
            type: 'string',
            description: 'Path to test file or directory (default: all tests)',
            required: false,
        },
        {
            name: 'coverage',
            type: 'boolean',
            description: 'Run tests with coverage report',
            required: false,
        },
        {
            name: 'watch',
            type: 'boolean',
            description: 'Run tests in watch mode',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<string> => {
        const { path = '', coverage = false, watch = false } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            // Detect test framework
            const framework = detectTestFramework(workspaceRoot);
            if (!framework) {
                return '❌ No test framework detected. Please install Jest, Mocha, or Vitest.';
            }

            logger.info(`Running tests with ${framework}${coverage ? ' (with coverage)' : ''}`);

            // Build test command
            let command = buildTestCommand(framework, path, coverage, watch);

            // Run tests
            const output = execSync(command, {
                cwd: workspaceRoot,
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
            });

            const result = parseTestOutput(output, framework);

            return formatTestResults(result, framework, coverage);
        } catch (error: any) {
            // Test failures still produce output
            const output = error.stdout || error.message;
            const result = parseTestOutput(output, 'jest');
            
            if (result.failed > 0) {
                return formatTestResults(result, 'jest', coverage, true);
            }

            return `❌ Test execution failed:\\n${output}`;
        }
    },
};

export const PrePushValidationTool: Tool = {
    name: 'pre_push_validate',
    description: 'Run comprehensive pre-push validation: generate tests, run tests, check code quality, and prepare for push',
    parameters: [
        {
            name: 'skipTests',
            type: 'boolean',
            description: 'Skip test generation and execution',
            required: false,
        },
        {
            name: 'autoFix',
            type: 'boolean',
            description: 'Automatically fix linting issues',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<string> => {
        const { skipTests = false, autoFix = false } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        let report = '🔍 Pre-Push Validation Report\\n';
        report += '=' .repeat(60) + '\\n\\n';

        const checks: Array<{name: string, status: string, details: string}> = [];

        try {
            // 1. Check Git status
            report += '📋 Step 1/5: Checking Git status...\\n';
            try {
                const gitStatus = execSync('git status --short', {
                    cwd: workspaceRoot,
                    encoding: 'utf-8',
                });
                
                if (!gitStatus.trim()) {
                    checks.push({
                        name: 'Git Status',
                        status: '⚠️ ',
                        details: 'No changes to commit',
                    });
                } else {
                    checks.push({
                        name: 'Git Status',
                        status: '✅',
                        details: `${gitStatus.split('\\n').length} file(s) changed`,
                    });
                }
            } catch (error: any) {
                checks.push({
                    name: 'Git Status',
                    status: '❌',
                    details: error.message,
                });
            }

            // 2. Run linter
            if (!skipTests) {
                report += '📋 Step 2/5: Running linter...\\n';
                try {
                    const lintCmd = autoFix ? 'npm run lint -- --fix' : 'npm run lint';
                    execSync(lintCmd, {
                        cwd: workspaceRoot,
                        encoding: 'utf-8',
                        stdio: 'pipe',
                    });
                    checks.push({
                        name: 'Linting',
                        status: '✅',
                        details: 'No linting errors',
                    });
                } catch (error: any) {
                    const hasLintScript = existsSync(join(workspaceRoot, 'package.json'));
                    if (!hasLintScript) {
                        checks.push({
                            name: 'Linting',
                            status: '⏭️ ',
                            details: 'No lint script found',
                        });
                    } else {
                        checks.push({
                            name: 'Linting',
                            status: '❌',
                            details: 'Linting errors found',
                        });
                    }
                }
            }

            // 3. Run tests
            if (!skipTests) {
                report += '📋 Step 3/5: Running tests...\n';
                try {
                    execSync('npm test', {
                        cwd: workspaceRoot,
                        encoding: 'utf-8',
                        maxBuffer: 10 * 1024 * 1024,
                    });
                    
                    checks.push({
                        name: 'Tests',
                        status: '✅',
                        details: 'All tests passed',
                    });
                } catch (error: any) {
                    const output = error.stdout || error.message;
                    const hasTests = output.includes('test') || output.includes('spec');
                    
                    if (!hasTests) {
                        checks.push({
                            name: 'Tests',
                            status: '⚠️ ',
                            details: 'No tests found',
                        });
                    } else {
                        checks.push({
                            name: 'Tests',
                            status: '❌',
                            details: 'Some tests failed',
                        });
                    }
                }
            } else {
                checks.push({
                    name: 'Tests',
                    status: '⏭️ ',
                    details: 'Skipped',
                });
            }

            // 4. Check for sensitive data
            report += '📋 Step 4/5: Checking for sensitive data...\\n';
            try {
                const sensitivePatterns = [
                    'API_KEY',
                    'SECRET',
                    'PASSWORD',
                    'TOKEN',
                    'PRIVATE_KEY',
                ];
                
                const gitDiff = execSync('git diff --cached', {
                    cwd: workspaceRoot,
                    encoding: 'utf-8',
                });

                let foundSensitive = false;
                for (const pattern of sensitivePatterns) {
                    if (gitDiff.includes(pattern) && !gitDiff.includes('.env.example')) {
                        foundSensitive = true;
                        break;
                    }
                }

                if (foundSensitive) {
                    checks.push({
                        name: 'Security',
                        status: '⚠️ ',
                        details: 'Possible sensitive data detected',
                    });
                } else {
                    checks.push({
                        name: 'Security',
                        status: '✅',
                        details: 'No sensitive data detected',
                    });
                }
            } catch (error) {
                checks.push({
                    name: 'Security',
                    status: '⏭️ ',
                    details: 'No staged changes',
                });
            }

            // 5. Build check (if build script exists)
            report += '📋 Step 5/5: Running build check...\\n';
            try {
                const packageJson = require(join(workspaceRoot, 'package.json'));
                if (packageJson.scripts && packageJson.scripts.build) {
                    execSync('npm run build', {
                        cwd: workspaceRoot,
                        encoding: 'utf-8',
                        stdio: 'pipe',
                    });
                    checks.push({
                        name: 'Build',
                        status: '✅',
                        details: 'Build successful',
                    });
                } else {
                    checks.push({
                        name: 'Build',
                        status: '⏭️ ',
                        details: 'No build script',
                    });
                }
            } catch (error: any) {
                checks.push({
                    name: 'Build',
                    status: '❌',
                    details: 'Build failed',
                });
            }

            // Generate summary
            report += '\\n📊 Validation Summary:\\n';
            report += '=' .repeat(60) + '\\n';

            for (const check of checks) {
                report += `${check.status} ${check.name}: ${check.details}\\n`;
            }

            // Determine if safe to push
            const hasFailures = checks.some(c => c.status === '❌');
            const hasWarnings = checks.some(c => c.status === '⚠️ ');

            report += '\\n';
            if (hasFailures) {
                report += '❌ VALIDATION FAILED - DO NOT PUSH\\n';
                report += 'Please fix the errors above before pushing.\\n';
            } else if (hasWarnings) {
                report += '⚠️  VALIDATION PASSED WITH WARNINGS\\n';
                report += 'Review warnings before pushing.\\n';
            } else {
                report += '✅ VALIDATION PASSED - SAFE TO PUSH\\n';
                report += 'All checks passed successfully!\\n';
            }

            return report;
        } catch (error: any) {
            logger.error('Pre-push validation failed:', error);
            return `❌ Validation error: ${error.message}`;
        }
    },
};

function detectTestFramework(workspaceRoot: string): string | null {
    try {
        const packageJsonPath = join(workspaceRoot, 'package.json');
        if (!existsSync(packageJsonPath)) {
            return null;
        }

        const packageJson = require(packageJsonPath);
        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        if (deps.jest || deps['@types/jest']) return 'jest';
        if (deps.vitest) return 'vitest';
        if (deps.mocha) return 'mocha';

        return null;
    } catch {
        return null;
    }
}

function buildTestCommand(
    framework: string,
    path: string,
    coverage: boolean,
    watch: boolean
): string {
    let command = 'npm test';

    switch (framework) {
        case 'jest':
            command = 'npx jest';
            if (path) command += ` ${path}`;
            if (coverage) command += ' --coverage';
            if (watch) command += ' --watch';
            break;
        case 'vitest':
            command = 'npx vitest run';
            if (path) command += ` ${path}`;
            if (coverage) command += ' --coverage';
            if (watch) command += ' --watch';
            break;
        case 'mocha':
            command = 'npx mocha';
            if (path) command += ` ${path}`;
            if (watch) command += ' --watch';
            // Mocha uses nyc for coverage
            if (coverage) command = `npx nyc ${command}`;
            break;
    }

    return command;
}

interface TestResult {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    duration: string;
    coverage?: {
        lines: number;
        statements: number;
        functions: number;
        branches: number;
    };
}

function parseTestOutput(output: string, _framework: string): TestResult {
    const result: TestResult = {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        duration: '0s',
    };

    // Extract test counts
    const passMatch = output.match(/(\\d+) passed/i);
    const failMatch = output.match(/(\\d+) failed/i);
    const skipMatch = output.match(/(\\d+) skipped/i);
    const totalMatch = output.match(/(\\d+) total/i);

    if (passMatch) result.passed = parseInt(passMatch[1]);
    if (failMatch) result.failed = parseInt(failMatch[1]);
    if (skipMatch) result.skipped = parseInt(skipMatch[1]);
    if (totalMatch) result.total = parseInt(totalMatch[1]);

    // Extract duration
    const durationMatch = output.match(/Time:\\s*([\\d.]+\\s*s)/i);
    if (durationMatch) result.duration = durationMatch[1];

    // Extract coverage if present
    const coverageMatch = output.match(/All files[^\\n]*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)/);
    if (coverageMatch) {
        result.coverage = {
            statements: parseFloat(coverageMatch[1]),
            branches: parseFloat(coverageMatch[2]),
            functions: parseFloat(coverageMatch[3]),
            lines: parseFloat(coverageMatch[4]),
        };
    }

    return result;
}

function formatTestResults(
    result: TestResult,
    framework: string,
    coverage: boolean,
    hasFailed: boolean = false
): string {
    let output = hasFailed ? '❌ Test Results (FAILED)\\n' : '✅ Test Results\\n';
    output += '=' .repeat(60) + '\\n\\n';

    output += `Framework: ${framework}\\n`;
    output += `Duration: ${result.duration}\\n\\n`;

    output += `📊 Summary:\\n`;
    output += `   ✅ Passed: ${result.passed}\\n`;
    if (result.failed > 0) {
        output += `   ❌ Failed: ${result.failed}\\n`;
    }
    if (result.skipped > 0) {
        output += `   ⏭️  Skipped: ${result.skipped}\\n`;
    }
    output += `   📝 Total: ${result.total}\\n`;

    if (coverage && result.coverage) {
        output += `\\n📈 Coverage:\\n`;
        output += `   Statements: ${result.coverage.statements}%\\n`;
        output += `   Branches: ${result.coverage.branches}%\\n`;
        output += `   Functions: ${result.coverage.functions}%\\n`;
        output += `   Lines: ${result.coverage.lines}%\\n`;
    }

    if (hasFailed) {
        output += `\\n⚠️  Some tests failed. Review the output above for details.\\n`;
    }

    return output;
}
