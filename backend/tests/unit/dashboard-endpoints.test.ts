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
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    submission: {
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  },
  connectDB: vi.fn(),
}));

// Mock AWS S3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: vi.fn().mockResolvedValue({
    url: 'https://s3-bucket.s3.amazonaws.com',
    fields: {
      key: 'dojo/1/random/image.jpg',
      policy: 'mock-policy-12345',
      'x-amz-signature': 'mock-signature-abcdef'
    }
  })
}));

describe('Dashboard and Analytics Endpoints', () => {
  let app: Express;
  let mockPrisma: any;

  beforeEach(async () => {
    // Import the app after mocks are set up
    const { default: appModule } = await import('../../src/index.js');
    app = appModule;
    
    // Get mocked modules
    mockPrisma = (await import('../../src/lib/prisma.js')).prismaClient;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock auth token
  const createMockToken = (userId: number) => {
    return jwt.sign({ userId }, JWT_SECRET);
  };

  describe('GET /v1/user/dashboard', () => {
    it('should return comprehensive dashboard analytics', async () => {
      // Mock tasks with various states
      const mockTasks = [
        {
          id: 1,
          title: 'Task 1',
          amount: BigInt(100000000),
          done: false,
          createdAt: new Date('2025-12-16T10:00:00Z'),
          submissions: [
            { worker_id: 1, option_id: 1, amount: BigInt(50000000) },
            { worker_id: 2, option_id: 2, amount: BigInt(50000000) }
          ],
          _count: { submissions: 2 }
        },
        {
          id: 2,
          title: 'Task 2',
          amount: BigInt(200000000),
          done: true,
          createdAt: new Date('2025-12-15T14:00:00Z'),
          submissions: [
            { worker_id: 3, option_id: 3, amount: BigInt(100000000) }
          ],
          _count: { submissions: 1 }
        },
        {
          id: 3,
          title: 'Task 3',
          amount: BigInt(150000000),
          done: false,
          createdAt: new Date('2025-12-14T09:00:00Z'),
          submissions: [],
          _count: { submissions: 0 }
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/v1/user/dashboard')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(200);
      
      // Check overview stats
      expect(response.body.overview).toMatchObject({
        totalTasks: 3,
        totalSubmissions: 3,
        totalSpent: '450000000',
        completedTasks: 1,
        pendingTasks: 2,
        averageSubmissionsPerTask: '1.00'
      });

      // Check daily stats structure
      expect(response.body.dailyStats).toHaveLength(7);
      expect(response.body.dailyStats[0]).toHaveProperty('date');
      expect(response.body.dailyStats[0]).toHaveProperty('tasksCreated');
      expect(response.body.dailyStats[0]).toHaveProperty('submissionsReceived');

      // Check weekly stats structure
      expect(response.body.weeklyStats).toHaveLength(4);
      expect(response.body.weeklyStats[0]).toHaveProperty('weekStart');
      expect(response.body.weeklyStats[0]).toHaveProperty('weekEnd');
      expect(response.body.weeklyStats[0]).toHaveProperty('tasksCreated');
      expect(response.body.weeklyStats[0]).toHaveProperty('submissionsReceived');

      // Check monthly stats structure
      expect(response.body.monthlyStats).toHaveLength(12);
      expect(response.body.monthlyStats[0]).toHaveProperty('month');
      expect(response.body.monthlyStats[0]).toHaveProperty('tasksCreated');
      expect(response.body.monthlyStats[0]).toHaveProperty('submissionsReceived');

      // Check recent activity
      expect(response.body.recentActivity).toHaveLength(3);
      expect(response.body.recentActivity[0]).toMatchObject({
        id: 1,
        title: 'Task 1',
        amount: '100000000',
        submissions: 2
      });

      // Check completion trend
      expect(response.body.completionTrend).toHaveLength(12);
      expect(response.body.completionTrend[0]).toHaveProperty('period');
      expect(response.body.completionTrend[0]).toHaveProperty('completionRate');
    });

    it('should handle empty dashboard for new user', async () => {
      // Mock empty tasks array
      mockPrisma.task.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/v1/user/dashboard')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(200);
      expect(response.body.overview).toMatchObject({
        totalTasks: 0,
        totalSubmissions: 0,
        totalSpent: '0',
        completedTasks: 0,
        pendingTasks: 0,
        averageSubmissionsPerTask: '0'
      });

      expect(response.body.dailyStats).toHaveLength(7);
      expect(response.body.weeklyStats).toHaveLength(4);
      expect(response.body.monthlyStats).toHaveLength(12);
      expect(response.body.recentActivity).toHaveLength(0);
    });

    it('should calculate completion rate correctly', async () => {
      // Mock tasks with mixed completion status
      const mockTasks = [
        { id: 1, done: true, amount: BigInt(100000000), submissions: [], _count: { submissions: 2 } },
        { id: 2, done: false, amount: BigInt(200000000), submissions: [], _count: { submissions: 1 } },
        { id: 3, done: false, amount: BigInt(150000000), submissions: [], _count: { submissions: 0 } },
        { id: 4, done: true, amount: BigInt(100000000), submissions: [], _count: { submissions: 3 } }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/v1/user/dashboard')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(200);
      expect(response.body.overview.completedTasks).toBe(2);
      expect(response.body.overview.pendingTasks).toBe(2);
      expect(response.body.overview.totalSpent).toBe('550000000');
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .get('/v1/user/dashboard');

      expect(response.status).toBe(403);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockPrisma.task.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/v1/user/dashboard')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch dashboard analytics');
    });
  });

  describe('GET /v1/user/task', () => {
    it('should return task details with submission results', async () => {
      // Mock task details
      const mockTask = {
        id: 1,
        title: 'Test Task',
        user_id: 1,
        options: [
          { id: 1, image_url: 'https://example.com/image1.jpg' },
          { id: 2, image_url: 'https://example.com/image2.jpg' }
        ]
      };
      
      // Mock submissions
      const mockSubmissions = [
        {
          option_id: 1,
          worker: { address: 'worker1-address' },
          worker_id: 1,
          amount: BigInt(50000000)
        },
        {
          option_id: 1,
          worker: { address: 'worker2-address' },
          worker_id: 2,
          amount: BigInt(50000000)
        },
        {
          option_id: 2,
          worker: { address: 'worker3-address' },
          worker_id: 3,
          amount: BigInt(50000000)
        }
      ];
      
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);
      mockPrisma.submission.findMany.mockResolvedValue(mockSubmissions);

      const response = await request(app)
        .get('/v1/user/task?taskId=1')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(200);
      expect(response.body.taskDetails).toEqual({
        title: 'Test Task'
      });

      // Check results structure
      expect(response.body.result).toMatchObject({
        '1': {
          count: 2,
          option: { imageUrl: 'https://example.com/image1.jpg' }
        },
        '2': {
          count: 1,
          option: { imageUrl: 'https://example.com/image2.jpg' }
        }
      });

      // Check submissions
      expect(response.body.submissions).toHaveLength(3);
      expect(response.body.submissions[0]).toMatchObject({
        workerId: 1,
        workerAddress: 'worker1-address',
        optionId: 1,
        amount: '50000000'
      });
    });

    it('should return 400 for missing taskId parameter', async () => {
      const response = await request(app)
        .get('/v1/user/task')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /v1/user/presignedUrl', () => {
    it('should return presigned URL for authenticated user', async () => {
      const response = await request(app)
        .get('/v1/user/presignedUrl')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Presigned URL generated successfully');
      expect(response.body.presignedUrl).toBeDefined();
      expect(response.body.fields).toBeDefined();
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .get('/v1/user/presignedUrl');

      expect(response.status).toBe(403);
    });

    it('should handle missing S3 configuration', async () => {
      // Temporarily unset environment variable
      const originalBucketName = process.env.S3_BUCKET_NAME;
      delete process.env.S3_BUCKET_NAME;

      const response = await request(app)
        .get('/v1/user/presignedUrl')
        .set('Authorization', `Bearer ${createMockToken(1)}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('S3_BUCKET_NAME environment variable not set');

      // Restore environment variable
      process.env.S3_BUCKET_NAME = originalBucketName;
    });
  });
});
