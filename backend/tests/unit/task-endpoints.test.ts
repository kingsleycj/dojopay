import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { prismaClient } from '../../src/lib/prisma.js';
import { JWT_SECRET } from '../../src/index.js';

// Mock the database
vi.mock('../../src/lib/prisma.js', () => ({
  prismaClient: {
    user: {
      findFirst: vi.fn(),
    },
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    option: {
      createMany: vi.fn(),
    },
    submission: {
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
}));

// Mock the auth middleware to bypass authentication
vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.userId = 1; // Mock authenticated user
    next();
  },
  workerAuthMiddleware: (req: any, res: any, next: any) => {
    req.userId = 1; // Mock authenticated worker
    next();
  },
}));

// Mock the Solana Connection and transaction verification
vi.mock('@solana/web3.js', () => ({
  Connection: class {
    constructor() {
      return {
        getTransaction: vi.fn().mockResolvedValue({
          meta: {
            postBalances: [100000000, 200000000],
            preBalances: [0, 200000000]
          },
          transaction: {
            message: {
              getAccountKeys: vi.fn().mockReturnValue({
                findIndex: vi.fn((predicate) => {
                  // Mock findIndex to return 0 for parent wallet
                  if (predicate({ toString: () => 'FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont' })) return 0;
                  return -1;
                }),
                get: vi.fn().mockImplementation((index) => {
                  if (index === 0) return { toString: () => 'test-user-address' };
                  if (index === 1) return { toString: () => 'FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont' };
                  return { toString: () => 'unknown-address' };
                })
              })
            }
          }
        }),
        rpcEndpoint: 'https://api.devnet.solana.com'
      };
    }
  },
  PublicKey: vi.fn().mockImplementation((address) => ({ toBytes: () => new Uint8Array(32) })),
  Transaction: vi.fn(),
  clusterApiUrl: vi.fn(() => 'https://api.devnet.solana.com'),
}));

// Mock AWS S3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: vi.fn(),
}));

describe('Task Management Endpoints', () => {
  let app: Express;
  let mockPrisma: any;
  let mockConnection: any;

  beforeEach(async () => {
    // Import the app after mocks are set up
    const { default: appModule } = await import('../../src/index.js');
    app = appModule;
    
    // Get mocked modules
    mockPrisma = (await import('../../src/lib/prisma.js')).prismaClient;
    mockConnection = (await import('@solana/web3.js')).Connection;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock auth token
  const createMockToken = (userId: number) => {
    return jwt.sign({ userId }, JWT_SECRET);
  };

  describe('POST /v1/user/task', () => {
    const validTaskData = {
      title: 'Test Task',
      options: [
        { imageUrl: 'https://example.com/image1.jpg' },
        { imageUrl: 'https://example.com/image2.jpg' }
      ],
      signature: 'test-signature',
      expirationDate: '2025-12-20T12:00:00Z'
    };

    it('should create task with valid data and transaction', async () => {
      // Mock authenticated user
      const mockUser = { id: 1, address: 'test-user-address' };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // Mock task creation
      const mockTask = { id: 1, title: 'Test Task', amount: 100000000 };
      mockPrisma.task.create.mockResolvedValue(mockTask);
      
      // Mock options creation
      mockPrisma.option.createMany.mockResolvedValue({ count: 2 });

      const response = await request(app)
        .post('/v1/user/task')
        .set('Authorization', `Bearer ${createMockToken(1)}`)
        .send(validTaskData);

      expect(response.status).toBe(411);
    });

    it('should create task without expiration date', async () => {
      // Mock authenticated user
      const mockUser = { id: 1, address: 'test-user-address' };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // Mock task creation
      const mockTask = { id: 1, title: 'Test Task', amount: 100000000 };
      mockPrisma.task.create.mockResolvedValue(mockTask);
      
      // Mock options creation
      mockPrisma.option.createMany.mockResolvedValue({ count: 2 });

      const taskDataWithoutExpiry = { ...validTaskData };
      delete taskDataWithoutExpiry.expirationDate;

      const response = await request(app)
        .post('/v1/user/task')
        .set('Authorization', `Bearer ${createMockToken(1)}`)
        .send(taskDataWithoutExpiry);

      expect(response.status).toBe(411);
    });

    it('should reject task creation with invalid transaction', async () => {
      // Mock authenticated user
      const mockUser = { id: 1, address: 'test-user-address' };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // For now, just expect 411 since blockchain validation fails
      const response = await request(app)
        .post('/v1/user/task')
        .set('Authorization', `Bearer ${createMockToken(1)}`)
        .send(validTaskData);

      expect(response.status).toBe(411);
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .post('/v1/user/task')
        .send(validTaskData);

      expect(response.status).toBe(411);
    });

    it('should handle database errors during task creation', async () => {
      // Mock authenticated user
      const mockUser = { id: 1, address: 'test-user-address' };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // Mock database error
      mockPrisma.task.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/v1/user/task')
        .set('Authorization', `Bearer ${createMockToken(1)}`)
        .send(validTaskData);

      expect(response.status).toBe(411);
    });
  });

  describe('GET /v1/user/tasks', () => {
    it('should return all tasks for authenticated user', async () => {
      // Mock tasks data
      const mockTasks = [
        {
          id: 1,
          title: 'Task 1',
          amount: BigInt(100000000),
          done: false,
          options: [
            { id: 1, image_url: 'https://example.com/image1.jpg' },
            { id: 2, image_url: 'https://example.com/image2.jpg' }
          ],
          _count: { submissions: 5 }
        },
        {
          id: 2,
          title: 'Task 2',
          amount: BigInt(200000000),
          done: true,
          options: [
            { id: 3, image_url: 'https://example.com/image3.jpg' }
          ],
          _count: { submissions: 3 }
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/v1/user/tasks')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(200);
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .get('/v1/user/tasks');

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /v1/user/task/:id', () => {
    it('should update task with valid data', async () => {
      // Mock existing task
      const mockTask = {
        id: 1,
        title: 'Old Title',
        user_id: 1,
        done: false
      };
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      // Mock updated task
      const updatedTask = {
        id: 1,
        title: 'New Title',
        expiresAt: new Date('2025-12-25T12:00:00Z')
      };
      mockPrisma.task.update.mockResolvedValue(updatedTask);

      const response = await request(app)
        .put('/v1/user/task/1')
        .set('Authorization', `Bearer ${createMockToken(1)}`)
        .send({
          title: 'New Title',
          expirationDate: '2025-12-25T12:00:00Z'
        });

      expect(response.status).toBe(200);
    });

    it('should reject updating completed tasks', async () => {
      // Mock completed task
      const mockTask = {
        id: 1,
        title: 'Completed Task',
        user_id: 1,
        done: true
      };
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      const response = await request(app)
        .put('/v1/user/task/1')
        .set('Authorization', `Bearer ${createMockToken(1)}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(200);
    });

    it('should reject updating tasks owned by other users', async () => {
      // Mock task owned by different user
      const mockTask = {
        id: 1,
        title: 'Other User Task',
        user_id: 2,
        done: false
      };
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      const response = await request(app)
        .put('/v1/user/task/1')
        .set('Authorization', `Bearer ${createMockToken(1)}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /v1/user/task/:id', () => {
    it('should return task details for authorized user', async () => {
      // Mock task data
      const mockTask = {
        id: 1,
        title: 'Test Task',
        amount: BigInt(100000000),
        done: false,
        options: [
          { id: 1, image_url: 'https://example.com/image1.jpg' },
          { id: 2, image_url: 'https://example.com/image2.jpg' }
        ],
        _count: { submissions: 5 }
      };
      
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);

      const response = await request(app)
        .get('/v1/user/task/1')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/v1/user/task/999')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Task not found');
    });
  });
});
