import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RSS-Tok API',
      version: '1.0.0',
      description: 'RSS feed aggregator with multilingual translations',
      contact: {
        name: 'Felipe Iasi',
        url: 'https://github.com/ficosta/RSS-Tok',
      },
    },
    servers: [
      {
        url: env.NODE_ENV === 'development' ? `http://localhost:${env.PORT}` : 'https://rss-tok.onrender.com',
        description: env.NODE_ENV === 'development' ? 'Development server' : 'Production server',
      },
    ],
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            error: {
              type: 'string',
              description: 'Error message if success is false',
            },
            message: {
              type: 'string',
              description: 'Additional message',
            },
          },
        },
        PaginatedResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  },
                },
              },
            },
          ],
        },
        RSSItem: {
          type: 'object',
          properties: {
            itemId: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            link: { type: 'string' },
            pubDate: { type: 'string' },
            pubTimestamp: { type: 'integer' },
            mediaContent: { type: 'object' },
            mediaThumbnail: { type: 'object' },
            mediaCredit: { type: 'string' },
            categories: {
              type: 'array',
              items: { type: 'string' },
            },
            translations: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
            hasTranslation: { type: 'boolean' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'RSS',
        description: 'RSS feed operations',
      },
      {
        name: 'Health',
        description: 'Health check and monitoring',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);