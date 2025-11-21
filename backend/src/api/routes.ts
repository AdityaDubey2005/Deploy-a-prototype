import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// API version info
router.get('/version', (req: Request, res: Response) => {
    res.json({
        version: '1.0.0',
        name: 'DevOps Agent Backend',
    });
});

// Get conversation history
router.get('/conversation/:sessionId', (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        // This would require access to the Agent instance
        // For now, return a placeholder
        res.json({
            sessionId,
            messages: [],
        });
    } catch (error: any) {
        logger.error('Error fetching conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Configuration endpoint
router.get('/config', (req: Request, res: Response) => {
    res.json({
        aiProvider: process.env.AI_PROVIDER || 'openai',
        features: {
            codeReview: true,
            testGeneration: true,
            logAnalysis: true,
            github: !!process.env.GITHUB_TOKEN,
            docker: true,
            kubernetes: true,
            cicd: !!(process.env.JENKINS_URL || process.env.GITLAB_TOKEN),
        },
    });
});

export default router;
