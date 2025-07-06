import { z } from 'zod';

// Session validation schemas
export const sessionStartSchema = z.object({
  body: z.object({
    deviceFingerprint: z.string().optional(),
    existingSessionId: z.string().uuid().optional()
  })
});

export const sessionIdParamSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID format')
  })
});

export const markViewedSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID format')
  }),
  body: z.object({
    itemIds: z.array(z.string()).max(200, 'Cannot mark more than 200 items at once')
  })
});

// Content validation schemas
export const homeContentSchema = z.object({
  query: z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
    cursor: z.string().optional(),
    limit: z.string()
      .optional()
      .default('20')
      .refine(val => {
        const num = parseInt(val);
        return !isNaN(num) && num >= 1 && num <= 100;
      }, 'Limit must be between 1 and 100'),
    maxConsecutive: z.string()
      .optional()
      .default('5')
      .refine(val => {
        const num = parseInt(val);
        return !isNaN(num) && num >= 1 && num <= 10;
      }, 'maxConsecutive must be between 1 and 10')
  })
});

export const channelContentSchema = z.object({
  params: z.object({
    channelId: z.string().min(1, 'Channel ID is required')
  }),
  query: z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
    cursor: z.string().optional(),
    limit: z.string()
      .optional()
      .default('20')
      .refine(val => {
        const num = parseInt(val);
        return !isNaN(num) && num >= 1 && num <= 100;
      }, 'Limit must be between 1 and 100')
  })
});

export const markContentViewedSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID format')
  }),
  body: z.object({
    itemIds: z.array(z.string()).max(200, 'Cannot mark more than 200 items at once')
  })
});

// Middleware schemas
export const sessionActivitySchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID format')
  })
});

export type SessionStartRequest = z.infer<typeof sessionStartSchema>;
export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
export type MarkViewedRequest = z.infer<typeof markViewedSchema>;
export type HomeContentRequest = z.infer<typeof homeContentSchema>;
export type ChannelContentRequest = z.infer<typeof channelContentSchema>;
export type MarkContentViewedRequest = z.infer<typeof markContentViewedSchema>;
export type SessionActivityRequest = z.infer<typeof sessionActivitySchema>;