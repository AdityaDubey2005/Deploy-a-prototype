import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolParameter } from '../../types/index.js';

export const FileSystemTool: Tool = {
    name: 'read_file',
    description: 'Read the contents of a file from the workspace',
    parameters: [
        {
            name: 'filePath',
            type: 'string',
            description: 'The path to the file to read (relative to workspace root)',
            required: true
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { filePath } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            // Resolve the full path
            const fullPath = path.isAbsolute(filePath)
                ? filePath
                : path.join(workspaceRoot, filePath);

            // Security check: ensure the file is within workspace
            const resolvedPath = path.resolve(fullPath);
            const resolvedWorkspace = path.resolve(workspaceRoot);

            if (!resolvedPath.startsWith(resolvedWorkspace)) {
                return `Error: Access denied. File must be within workspace: ${workspaceRoot}`;
            }

            // Check if file exists
            const stats = await fs.stat(resolvedPath);
            if (!stats.isFile()) {
                return `Error: ${filePath} is not a file`;
            }

            // Read the file
            const content = await fs.readFile(resolvedPath, 'utf-8');

            return `File: ${filePath}\n\nContent:\n${content}`;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return `Error: File not found: ${filePath}`;
            }
            return `Error reading file: ${error.message}`;
        }
    }
};

export const WriteFileTool: Tool = {
    name: 'write_file',
    description: 'Write content to a file in the workspace. Overwrites existing content.',
    parameters: [
        {
            name: 'filePath',
            type: 'string',
            description: 'The path to the file to write (relative to workspace root)',
            required: true
        },
        {
            name: 'content',
            type: 'string',
            description: 'The content to write to the file',
            required: true
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { filePath, content } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            // Resolve the full path
            const fullPath = path.isAbsolute(filePath)
                ? filePath
                : path.join(workspaceRoot, filePath);

            // Security check: ensure the file is within workspace
            const resolvedPath = path.resolve(fullPath);
            const resolvedWorkspace = path.resolve(workspaceRoot);

            if (!resolvedPath.startsWith(resolvedWorkspace)) {
                return `Error: Access denied. File must be within workspace: ${workspaceRoot}`;
            }

            // Ensure directory exists
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

            // Write the file
            await fs.writeFile(resolvedPath, content, 'utf-8');

            return `✅ Successfully wrote to file: ${filePath}`;
        } catch (error: any) {
            return `Error writing file: ${error.message}`;
        }
    }
};

export const ListFilesTool: Tool = {
    name: 'list_files',
    description: 'List files and directories in a workspace directory',
    parameters: [
        {
            name: 'directory',
            type: 'string',
            description: 'The directory path to list (relative to workspace root, default is root)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const directory = args.directory || '.';
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            const fullPath = path.isAbsolute(directory)
                ? directory
                : path.join(workspaceRoot, directory);

            // Security check
            const resolvedPath = path.resolve(fullPath);
            const resolvedWorkspace = path.resolve(workspaceRoot);

            if (!resolvedPath.startsWith(resolvedWorkspace)) {
                return `Error: Access denied. Directory must be within workspace`;
            }

            // Read directory
            const entries = await fs.readdir(fullPath, { withFileTypes: true });

            const files: string[] = [];
            const dirs: string[] = [];

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    dirs.push(entry.name + '/');
                } else {
                    files.push(entry.name);
                }
            }

            let result = `Directory: ${directory}\n\n`;
            result += `Directories (${dirs.length}):\n${dirs.join('\n') || 'None'}\n\n`;
            result += `Files (${files.length}):\n${files.join('\n') || 'None'}`;

            return result;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return `Error: Directory not found: ${directory}`;
            }
            return `Error listing directory: ${error.message}`;
        }
    }
};

export const SearchFilesTool: Tool = {
    name: 'search_files',
    description: 'Search for files by name pattern in the workspace',
    parameters: [
        {
            name: 'pattern',
            type: 'string',
            description: 'File name pattern to search for (e.g., "*.js", "package.json")',
            required: true
        },
        {
            name: 'directory',
            type: 'string',
            description: 'Directory to search in (default is workspace root)',
            required: false
        }
    ],
    execute: async (args: Record<string, any>, context: any): Promise<string> => {
        const { pattern, directory = '.' } = args;
        const workspaceRoot = context.workspaceRoot || process.cwd();

        try {
            const searchPath = path.isAbsolute(directory)
                ? directory
                : path.join(workspaceRoot, directory);

            const results = await searchRecursive(searchPath, pattern, workspaceRoot);

            if (results.length === 0) {
                return `No files found matching pattern: ${pattern}`;
            }

            return `Found ${results.length} file(s) matching "${pattern}":\n\n${results.join('\n')}`;
        } catch (error: any) {
            return `Error searching files: ${error.message}`;
        }
    }
};

// Helper function for recursive search
async function searchRecursive(
    dir: string,
    pattern: string,
    workspaceRoot: string,
    results: string[] = []
): Promise<string[]> {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            // Skip node_modules and hidden directories
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                await searchRecursive(fullPath, pattern, workspaceRoot, results);
            } else if (entry.isFile() && matchPattern(entry.name, pattern)) {
                const relativePath = path.relative(workspaceRoot, fullPath);
                results.push(relativePath);
            }
        }

        return results;
    } catch {
        return results;
    }
}

// Helper function for pattern matching
function matchPattern(filename: string, pattern: string): boolean {
    // Simple pattern matching (* wildcard)
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
}
