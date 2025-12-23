import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Setup test database
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup test database
  await prisma.$disconnect();
  console.log('Test environment cleaned up');
});

beforeEach(async () => {
  // Reset database before each test
  console.log('Resetting test data...');
});

afterEach(async () => {
  // Cleanup after each test
  console.log('Test completed, cleaning up...');
});
