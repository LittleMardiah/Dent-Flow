import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DentFlow API Documentation',
      version: '1.0.0',
      description: 'DentFlow - Dental Clinic Management System API',
      contact: {
        name: 'DentFlow Team',
        email: 'support@dentflow.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          properties: {
            username: { type: 'string', example: 'admin_001' },
            password: { type: 'string', example: 'Admin123!' },
          },
          required: ['username', 'password'],
        },
        RegisterPatientRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', example: 'patient@test.com' },
            password: { type: 'string', example: 'Patient123!' },
            fullName: { type: 'string', example: 'John Doe' },
            phone: { type: 'string', example: '08123456789' },
          },
          required: ['email', 'password', 'fullName'],
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string' },
                    username: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
                token: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
              },
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
            timestamp: { type: 'string', format: 'date-time' },
            services: {
              type: 'object',
              properties: {
                api: { type: 'string', enum: ['ok', 'down'] },
                database: { type: 'string', enum: ['ok', 'down'] },
                redis: { type: 'string', enum: ['ok', 'down'] },
                storage: { type: 'string', enum: ['ok', 'down'] },
              },
            },
            uptime: { type: 'number' },
            version: { type: 'string' },
            jobs: {
              type: 'object',
              properties: {
                initialized: { type: 'boolean' },
                totalJobs: { type: 'number' },
                jobs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      running: { type: 'boolean' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', example: 'patient@test.com' },
          },
          required: ['email'],
        },
        ResetPasswordRequest: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'abc123...' },
            newPassword: { type: 'string', example: 'NewPass123!' },
          },
          required: ['token', 'newPassword'],
        },
        WebhookRequest: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: ['midtrans', 'xendit'], example: 'midtrans' },
            transaction_id: { type: 'string', example: 'txn_123456' },
            order_id: { type: 'string', example: 'booking_123' },
            transaction_status: { type: 'string', example: 'settlement' },
            signature_key: { type: 'string', example: 'dummy_signature' },
          },
        },
        WebhookResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      { name: 'Authentication', description: 'Authentication endpoints' },
      { name: 'Health', description: 'Health check endpoint' },
      { name: 'Webhook', description: 'Payment webhook endpoints' },
    ],
  },
  apis: ['src/routes/*.ts', 'src/modules/*/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
