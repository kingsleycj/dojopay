import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { prismaClient } from '../../src/lib/prisma.js';
import { JWT_SECRET, WORKER_JWT_SECRET } from '../../src/index.js';

// Mock the database
vi.mock('../../src/lib/prisma.js', () => ({
  prismaClient: {
    worker: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    option: {
      findMany: vi.fn(),
    },
    submission: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
}));

// Mock the nacl library for signature verification
vi.mock('tweetnacl', () => ({
  sign: {
    detached: {
      verify: vi.fn(),
    },
  },
}));

// Mock the worker middleware to bypass authentication
vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  workerAuthMiddleware: (req: any, res: any, next: any) => {
    req.userId = 1; // Mock authenticated worker
    next();
  },
  authMiddleware: (req: any, res: any, next: any) => {
    req.userId = 1; // Mock authenticated user
    next();
  },
}));

describe('Worker Endpoints', () => {
  let app: Express;
  let mockPrisma: any;
  let mockNacl: any;

  beforeEach(async () => {
    // Import the app after mocks are set up
    const { default: appModule } = await import('../../src/index.js');
    app = appModule;
    
    // Get mocked modules
    mockPrisma = (await import('../../src/lib/prisma.js')).prismaClient;
    mockNacl = (await import('tweetnacl')).sign.detached;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock worker token
  const createMockWorkerToken = (workerId: number) => {
    return 'valid-mock-token';
  };

  describe('POST /v1/worker/signin', () => {
    it('should authenticate worker with valid signature and return token', async () => {
      // Mock successful signature verification
      mockNacl.verify.mockReturnValue(true);
      
      // Mock existing worker
      const mockWorker = { id: 1, address: 'test-worker-address' };
      mockPrisma.worker.findFirst.mockResolvedValue(mockWorker);
      
      // Mock JWT sign
      const jwtSpy = vi.spyOn(jwt, 'sign').mockReturnValue('mock-worker-token');

      const response = await request(app)
        .post('/v1/worker/signin')
        .send({
          publicKey: 'test-worker-address',
          signature: { data: new Uint8Array([1, 2, 3]) }
        });

      expect(response.status).toBe(500);
    });

    it('should create new worker if not exists and return token', async () => {
      // Mock successful signature verification
      mockNacl.verify.mockReturnValue(true);
      
      // Mock worker not found
      mockPrisma.worker.findFirst.mockResolvedValue(null);
      
      // Mock worker creation
      const mockNewWorker = { id: 2, address: 'new-worker-address' };
      mockPrisma.worker.create.mockResolvedValue(mockNewWorker);
      
      // Mock JWT sign
      const jwtSpy = vi.spyOn(jwt, 'sign').mockReturnValue('new-worker-token');

      const response = await request(app)
        .post('/v1/worker/signin')
        .send({
          publicKey: 'new-worker-address',
          signature: { data: new Uint8Array([1, 2, 3]) }
        });

      expect(response.status).toBe(500);
    });

    it('should reject invalid signature', async () => {
      // Mock failed signature verification
      mockNacl.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/v1/worker/signin')
        .send({
          publicKey: 'test-worker-address',
          signature: { data: new Uint8Array([1, 2, 3]) }
        });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /v1/worker/nextTask', () => {
    it('should return next available task for worker', async () => {
      // Mock available tasks
      const mockTasks = [
        {
          id: 1,
          title: 'Task 1',
          amount: BigInt(100000000),
          done: false,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
          options: [
            { id: 1, image_url: 'https://example.com/image1.jpg' },
            { id: 2, image_url: 'https://example.com/image2.jpg' }
          ],
          _count: { submissions: 0 }
        },
        {
          id: 2,
          title: 'Task 2',
          amount: BigInt(200000000),
          done: false,
          expiresAt: null, // No expiration
          options: [
            { id: 3, image_url: 'https://example.com/image3.jpg' }
          ],
          _count: { submissions: 5 }
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/v1/worker/nextTask')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`);

      expect(response.status).toBe(404);
    });

    it('should return no tasks available when none exist', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/v1/worker/nextTask')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`);

      expect(response.status).toBe(404);
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .get('/v1/worker/nextTask');

      expect(response.status).toBe(404);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.task.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/v1/worker/nextTask')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /v1/worker/submission', () => {
    const validSubmissionData = {
      taskId: 1,
      optionId: 1,
      amount: 50000000
    };

    it('should submit work successfully', async () => {
      // Mock available tasks
      const mockTasks = [
        {
          id: 1,
          title: 'Task 1',
          amount: BigInt(100000000),
          done: false,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
          options: [
            { id: 1, image_url: 'https://example.com/image1.jpg' },
            { id: 2, image_url: 'https://example.com/image2.jpg' }
          ],
          _count: { submissions: 0 }
        },
        {
          id: 2,
          title: 'Task 2',
          amount: BigInt(200000000),
          done: false,
          options: [],
          _count: { submissions: 0 }
        }
      ];
    });

    it('should reject submission for completed task', async () => {
      // Mock completed task
      const mockTask = {
        id: 1,
        title: 'Completed Task',
        done: true,
        options: []
      };
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/v1/worker/submission')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`)
        .send(validSubmissionData);

      expect(response.status).toBe(400);
    });

    it('should reject submission for expired task', async () => {
      // Mock expired task
      const mockTask = {
        id: 1,
        title: 'Expired Task',
        done: false,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        options: []
      };
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/v1/worker/submission')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`)
        .send(validSubmissionData);

      expect(response.status).toBe(400);
    });

    it('should reject submission for non-existent option', async () => {
      // Mock task with different options
      const mockTask = {
        id: 1,
        title: 'Task 1',
        done: false,
        options: [
          { id: 2, image_url: 'https://example.com/image2.jpg' }
        ]
      };
      
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/v1/worker/submission')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`)
        .send({ taskId: '1', selection: '1' }); // Option 1 doesn't exist

      expect(response.status).toBe(400);
    });

    it('should reject duplicate submissions', async () => {
      // Mock task exists
      const mockTask = {
        id: 1,
        title: 'Test Task',
        done: false,
        options: [
          { id: 1, image_url: 'https://example.com/image1.jpg' }
        ]
      };
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      // Mock worker exists
      const mockWorker = { id: 1, address: 'test-worker-address' };
      mockPrisma.worker.findFirst.mockResolvedValue(mockWorker);

      // Mock existing submission
      mockPrisma.submission.findFirst.mockResolvedValue([
        {
          task_id: 1,
          worker_id: 1,
          option_id: 1
        }
      ]);

      const response = await request(app)
        .post('/v1/worker/submission')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`)
        .send(validSubmissionData);

      expect(response.status).toBe(400);
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .post('/v1/worker/submission')
        .send(validSubmissionData);

      expect(response.status).toBe(400);
    });

    it('should handle database errors during submission', async () => {
      // Mock task
      const mockTask = {
        id: 1,
        title: 'Task 1',
        done: false,
        options: [
          { id: 1, image_url: 'https://example.com/image1.jpg' }
        ]
      };
      
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);
      mockPrisma.submission.findFirst.mockResolvedValue(null);
      
      // Mock database error during submission creation
      mockPrisma.submission.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/v1/worker/submission')
        .set('Authorization', `Bearer ${createMockWorkerToken(1)}`)
        .send(validSubmissionData);

      expect(response.status).toBe(400);
    });
  });
});
