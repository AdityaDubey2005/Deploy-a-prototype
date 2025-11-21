import * as k8s from '@kubernetes/client-node';
import { Tool, ToolContext, KubernetesConfig } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

let k8sConfig: k8s.KubeConfig | null = null;
let k8sAppsApi: k8s.AppsV1Api | null = null;
let k8sCoreApi: k8s.CoreV1Api | null = null;

function getK8sClients() {
    if (!k8sConfig) {
        k8sConfig = new k8s.KubeConfig();
        k8sConfig.loadFromDefault();
        k8sAppsApi = k8sConfig.makeApiClient(k8s.AppsV1Api);
        k8sCoreApi = k8sConfig.makeApiClient(k8s.CoreV1Api);
    }
    return { appsApi: k8sAppsApi!, coreApi: k8sCoreApi! };
}

export const KubernetesDeployTool: Tool = {
    name: 'kubernetes_deploy',
    description: 'Deploy or update an application to Kubernetes cluster.',
    parameters: [
        {
            name: 'namespace',
            type: 'string',
            description: 'Kubernetes namespace (default: default)',
            required: false,
        },
        {
            name: 'deploymentName',
            type: 'string',
            description: 'Name of the deployment',
            required: true,
        },
        {
            name: 'image',
            type: 'string',
            description: 'Docker image to deploy',
            required: true,
        },
        {
            name: 'replicas',
            type: 'number',
            description: 'Number of replicas (default: 1)',
            required: false,
        },
        {
            name: 'port',
            type: 'number',
            description: 'Container port to expose',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const {
            namespace = 'default',
            deploymentName,
            image,
            replicas = 1,
            port = 8080,
        } = args;

        try {
            const { appsApi } = getK8sClients();

            // Define deployment manifest
            const deployment: k8s.V1Deployment = {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: {
                    name: deploymentName,
                    namespace,
                },
                spec: {
                    replicas,
                    selector: {
                        matchLabels: {
                            app: deploymentName,
                        },
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: deploymentName,
                            },
                        },
                        spec: {
                            containers: [
                                {
                                    name: deploymentName,
                                    image,
                                    ports: [
                                        {
                                            containerPort: port,
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
            };

            // Try to update existing deployment first
            try {
                await appsApi.patchNamespacedDeployment(
                    deploymentName,
                    namespace,
                    deployment,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    {
                        headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
                    }
                );

                logger.info(`Updated deployment ${deploymentName} in namespace ${namespace}`);

                return {
                    success: true,
                    action: 'updated',
                    deployment: deploymentName,
                    namespace,
                    image,
                    replicas,
                    message: `Deployment ${deploymentName} updated successfully`,
                };
            } catch (err: any) {
                // Deployment doesn't exist, create it
                if (err.response?.statusCode === 404) {
                    await appsApi.createNamespacedDeployment(namespace, deployment);

                    logger.info(`Created deployment ${deploymentName} in namespace ${namespace}`);

                    return {
                        success: true,
                        action: 'created',
                        deployment: deploymentName,
                        namespace,
                        image,
                        replicas,
                        message: `Deployment ${deploymentName} created successfully`,
                    };
                }
                throw err;
            }
        } catch (error: any) {
            logger.error(`Kubernetes deployment failed for ${deploymentName}:`, error);
            throw new Error(`Kubernetes deployment failed: ${error.message}`);
        }
    },
};

export const KubernetesListPodsTool: Tool = {
    name: 'kubernetes_list_pods',
    description: 'List pods in a Kubernetes namespace with their current status.',
    parameters: [
        {
            name: 'namespace',
            type: 'string',
            description: 'Kubernetes namespace (default: default)',
            required: false,
        },
        {
            name: 'labelSelector',
            type: 'string',
            description: 'Label selector to filter pods (e.g., "app=myapp")',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { namespace = 'default', labelSelector } = args;

        try {
            const { coreApi } = getK8sClients();

            const response = await coreApi.listNamespacedPod(
                namespace,
                undefined,
                undefined,
                undefined,
                undefined,
                labelSelector
            );

            const pods = response.body.items.map(pod => ({
                name: pod.metadata?.name,
                namespace: pod.metadata?.namespace,
                status: pod.status?.phase,
                ready: pod.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True',
                restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
                age: pod.metadata?.creationTimestamp,
                ip: pod.status?.podIP,
            }));

            logger.info(`Retrieved ${pods.length} pod(s) from namespace ${namespace}`);

            return {
                count: pods.length,
                namespace,
                pods,
            };
        } catch (error: any) {
            logger.error(`Failed to list Kubernetes pods in ${namespace}:`, error);
            throw new Error(`Kubernetes list pods failed: ${error.message}`);
        }
    },
};

export const KubernetesGetLogsTool: Tool = {
    name: 'kubernetes_get_logs',
    description: 'Get logs from a Kubernetes pod.',
    parameters: [
        {
            name: 'podName',
            type: 'string',
            description: 'Name of the pod',
            required: true,
        },
        {
            name: 'namespace',
            type: 'string',
            description: 'Kubernetes namespace (default: default)',
            required: false,
        },
        {
            name: 'tailLines',
            type: 'number',
            description: 'Number of lines from the end of the logs (default: 100)',
            required: false,
        },
    ],
    execute: async (args: Record<string, any>, context: ToolContext): Promise<any> => {
        const { podName, namespace = 'default', tailLines = 100 } = args;

        try {
            const { coreApi } = getK8sClients();

            const response = await coreApi.readNamespacedPodLog(
                podName,
                namespace,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                tailLines
            );

            logger.info(`Retrieved logs for pod ${podName} in namespace ${namespace}`);

            return {
                podName,
                namespace,
                logs: response.body,
                lines: response.body.split('\n').length,
            };
        } catch (error: any) {
            logger.error(`Failed to get logs for pod ${podName}:`, error);
            throw new Error(`Kubernetes get logs failed: ${error.message}`);
        }
    },
};
