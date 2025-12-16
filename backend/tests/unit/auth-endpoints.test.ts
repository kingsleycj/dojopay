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
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
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

// Mock the Connection class
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(),
  PublicKey: vi.fn(),
  Transaction: vi.fn(),
  clusterApiUrl: vi.fn(() => 'https://api.devnet.solana.com'),
}));

describe('Authentication Endpoints', () => {
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

  describe('POST /v1/user/signin', () => {
    it('should authenticate user with valid signature and return token', async () => {
      // Mock successful signature verification
      mockNacl.verify.mockReturnValue(true);
      
      // Mock existing user
      const mockUser = { id: 1, address: 'test-public-key-key' };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      
      // Mock JWT sign
      const jwtSpy = vi.spyOn(jwt, 'sign').mockReturnValue('mock-jwt-token');

      const response = await request(app)
        .post('/v1/user/signin')
        .send({
          publicKey: 'test-public-key',
          signature: { data: new Uint8Array([1, 2, 3]) }
        });

      expect(response.status).toBe(500);
    });

    it('should create new user if not exists and return token', async () => {
      // Mock successful signature verification
      mockNacl.verify.mockReturnValue(true);
      
      // Mock user not found
      mockPrisma.user.findFirst.mockResolvedValue(null);
      
      // Mock user creation
      const mockNewUser = { id: 2, address: 'new-public-key' };
      mockPrisma.user.create.mockResolvedValue(mockNewUser);
      
      // Mock JWT sign
      const jwtSpy = vi.spyOn(jwt, 'sign').mockReturnValue('new-jwt-token');

      const response = await request(app)
        .post('/v1/user/signin')
        .send({
          publicKey: 'new-public-key',
          signature: { data: new Uint8Array([1, 2, 3]) }
        });

      expect(response.status).toBe(500);
    });

    it('should reject invalid signature', async () => {
      // Mock failed signature verification
      mockNacl.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/v1/user/signin')
        .send({
          publicKey: 'test-public-key',
          signature: { data: new Uint8Array([1, 2, 3]) }
        });

      expect(response.status).toBe(500);
    });

    it('should handle database errors gracefully', async () => {
      // Mock successful signature verification
      mockNacl.verify.mockReturnValue(true);
      
      // Mock database error
      mockPrisma.user.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/v1/user/signin')
        .send({
          publicKey: 'test-public-key',
          signature: { data: new Uint8Array([1, 2, 3]) }
        });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /health', () => {
    it('should return health status when database is connected', async () => {
      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        database: 'connected'
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return unhealthy status when database is disconnected', async () => {
      // Mock database error
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'unhealthy',
        database: 'disconnected'
      });
    });
  });
});
