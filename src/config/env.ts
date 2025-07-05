import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  DATABASE_URL: z.string(),
  OPENAI_API_KEY: z.string(),
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().transform((val) => parseInt(val, 10)).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform((val) => parseInt(val, 10)).default('100'),
  RSS_FETCH_INTERVAL: z.string().default('*/30 * * * *'), // Every 30 minutes
  TRANSLATION_POLL_INTERVAL: z.string().default('*/5 * * * *'), // Every 5 minutes
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  // OpenAI Configuration
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.string().transform((val) => parseInt(val, 10)).default('500'),
  OPENAI_TEMPERATURE: z.string().transform((val) => parseFloat(val)).default('0.3'),
  TRANSLATION_BATCH_SIZE: z.string().transform((val) => parseInt(val, 10)).default('50'),
  // Advanced Translation Settings
  TRANSLATION_SYSTEM_PROMPT_STYLE: z.enum(['professional', 'casual', 'news']).default('news'),
  TRANSLATION_INCLUDE_CONTEXT: z.string().transform((val) => val === 'true').default('true'),
});

type EnvConfig = z.infer<typeof envSchema>;

const parseEnv = (): EnvConfig => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
};

export const env = parseEnv();