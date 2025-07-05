import { TargetLanguage } from '@/config/feedUrls';

export interface RSSItem {
  guid?: string;
  title?: string;
  content?: string;
  link?: string;
  pubDate?: string;
  categories?: string[];
  'media:content'?: MediaContent;
  'media:thumbnail'?: MediaThumbnail;
  'media:credit'?: string;
}

export interface MediaContent {
  url?: string;
  type?: string;
  medium?: string;
  width?: string;
  height?: string;
}

export interface MediaThumbnail {
  url?: string;
  width?: string;
  height?: string;
}

export interface TranslationJob {
  batchId: string;
  status: 'processing' | 'completed' | 'failed';
  submittedAt: number;
  targetLanguages: TargetLanguage[];
  requests: number;
  completedAt?: number;
  error?: string;
}

export interface Translations {
  [language: string]: {
    title?: string;
    content?: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  database: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
  services: {
    rss: boolean;
    translation: boolean;
  };
}