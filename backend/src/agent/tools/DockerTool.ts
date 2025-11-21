import Docker from 'dockerode';
import { Tool, ToolContext, DockerConfig } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

let docker: Docker | null = null;

function getDocker(): Docker {
    if (!docker) {
        const host = process.env.DOCKER_HOST;
        docker = new Docker(host ? { host } : undefined);
    }
    return docker;
}

export const DockerDeployTool: Tool = {
    name: 'docker_deploy',
    description: 'Build and deploy a Docker container. Handles image building, container creation, and startup.',
    parameters: [
        {
            name: 'image',
            type: 'string',
            description: 'Docker image name',
            required: true,
        },
        {
            name: 'tag',
            type: 'string',
            description: 'Image tag (default: latest)',
            required: false,
        },
        {
            name: 'containerName',
            type: 'string',
            description: 'Name for the container',
            required: true,
        },
        {
            name: 'ports',
            type: 'array',
            description: 'Port mappings as array of {host: number, container: number}',
            required: false,
        },
        {
            name: 'env',
            type: 'object',
            description: 'Environment variables as key-value object',
            required: false,
        },
        {
            name: 'buildContext',
            type: 'string',
            description: 'Path to build context (directory containing Dockerfile)',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const {
            image,
            tag = 'latest',
            containerName,
            ports = [],
            env = {},
            buildContext,
        } = args;

        try {
            const client = getDocker();
            const fullImageName = `${image}:${tag}`;

            // Build image if build context provided
            if (buildContext) {
                logger.info(`Building Docker image ${fullImageName} from ${buildContext}`);

                const stream = await client.buildImage({
                    context: buildContext,
                    src: ['Dockerfile'],
                }, {
                    t: fullImageName,
                });

                // Wait for build to complete
                await new Promise((resolve, reject) => {
                    docker!.modem.followProgress(stream, (err: any, res: any) => {
                        if (err) reject(err);
                        else resolve(res);
                    });
                });

                logger.info(`Successfully built image ${fullImageName}`);
            }

            // Check if container already exists
            try {
                const existingContainer = client.getContainer(containerName);
                const info = await existingContainer.inspect();

                // Stop and remove if exists
                if (info.State.Running) {
                    await existingContainer.stop();
                }
                await existingContainer.remove();
                logger.info(`Removed existing container ${containerName}`);
            } catch (err) {
                // Container doesn't exist, which is fine
            }

            // Prepare port bindings
            const portBindings: any = {};
            const exposedPorts: any = {};

            for (const portMap of ports) {
                const containerPort = `${portMap.container}/tcp`;
                exposedPorts[containerPort] = {};
                portBindings[containerPort] = [{ HostPort: portMap.host.toString() }];
            }

            // Prepare environment
            const envArray = Object.entries(env).map(([key, value]) => `${key}=${value}`);

            // Create and start container
            const container = await client.createContainer({
                Image: fullImageName,
                name: containerName,
                Env: envArray,
                ExposedPorts: exposedPorts,
                HostConfig: {
                    PortBindings: portBindings,
                },
            });

            await container.start();

            const containerInfo = await container.inspect();

            logger.info(`Successfully deployed container ${containerName} (${containerInfo.Id.substring(0, 12)})`);

            return {
                success: true,
                containerId: containerInfo.Id,
                containerName,
                image: fullImageName,
                status: containerInfo.State.Status,
                ports: portBindings,
                message: `Container ${containerName} deployed successfully`,
            };
        } catch (error: any) {
            logger.error(`Docker deployment failed for ${containerName}:`, error);
            throw new Error(`Docker deployment failed: ${error.message}`);
        }
    },
};

export const DockerListContainersTool: Tool = {
    name: 'docker_list_containers',
    description: 'List Docker containers with their current status.',
    parameters: [
        {
            name: 'all',
            type: 'boolean',
            description: 'Show all containers (default: false, shows only running)',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { all = false } = args;

        try {
            const client = getDocker();
            const containers = await client.listContainers({ all });

            const containerList = containers.map(c => ({
                id: c.Id.substring(0, 12),
                name: c.Names[0]?.replace(/^\//, ''),
                image: c.Image,
                status: c.Status,
                state: c.State,
                ports: c.Ports.map(p => ({
                    private: p.PrivatePort,
                    public: p.PublicPort,
                    type: p.Type,
                })),
            }));

            logger.info(`Retrieved ${containerList.length} container(s)`);

            return {
                count: containerList.length,
                containers: containerList,
            };
        } catch (error: any) {
            logger.error('Failed to list Docker containers:', error);
            throw new Error(`Docker list failed: ${error.message}`);
        }
    },
};

export const DockerStopContainerTool: Tool = {
    name: 'docker_stop_container',
    description: 'Stop a running Docker container.',
    parameters: [
        {
            name: 'containerName',
            type: 'string',
            description: 'Name or ID of the container to stop',
            required: true,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { containerName } = args;

        try {
            const client = getDocker();
            const container = client.getContainer(containerName);

            await container.stop();

            logger.info(`Stopped container ${containerName}`);

            return {
                success: true,
                message: `Container ${containerName} stopped successfully`,
            };
        } catch (error: any) {
            logger.error(`Failed to stop container ${containerName}:`, error);
            throw new Error(`Docker stop failed: ${error.message}`);
        }
    },
};
