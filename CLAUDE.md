# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
RSS-Tok is a modern Node.js TypeScript API that fetches RSS feeds from German news sources (primarily Bild.de), stores them in PostgreSQL, and provides multilingual translations using OpenAI's batch API. The application features automated RSS fetching via cron jobs, comprehensive error handling, and a RESTful API with Swagger documentation.

## Architecture
The application follows a clean, layered TypeScript architecture:

```
src/
├── config/           # Configuration (database, env, logger, swagger)
├── controllers/      # API route handlers
├── services/         # Business logic (RSS, Translation)
├── models/          # TypeORM entities
├── repositories/    # Data access layer
├── middleware/      # Express middleware (auth, validation, error handling)
├── jobs/           # Cron job implementations
├── routes/         # API route definitions
├── types/          # TypeScript type definitions
├── validators/     # Request validation schemas (Zod)
├── utils/          # Utility functions
├── tests/          # Unit and integration tests
└── migrations/     # Database migration scripts
```

### Database Schema
The system uses PostgreSQL with TypeORM and the following structure:

#### items (main RSS items table)
```sql
CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  link TEXT,
  pub_date TEXT,
  pub_timestamp BIGINT,
  media_content JSONB,
  media_thumbnail JSONB,
  media_credit TEXT,
  categories JSONB,
  translation_job JSONB DEFAULT '{}'::JSONB,
  translations JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### item_channels (visibility management)
```sql
CREATE TABLE IF NOT EXISTS item_channels (
  item_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, channel),
  FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);
```

#### Performance Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_items_pub_timestamp ON items(pub_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_translation_status ON items((translation_job->>'status'));
CREATE INDEX IF NOT EXISTS idx_item_channels_channel_visible ON item_channels(channel, is_visible);
CREATE INDEX IF NOT EXISTS idx_item_channels_item_id ON item_channels(item_id);
```

## Development Commands

### Setup and Development
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run database migration
npm run migration:run

# Development server with hot reload
npm run dev

# Build production
npm run build

# Start production server
npm start
```

### Code Quality
```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Testing
npm test
npm run test:watch
```

### Database Operations
```bash
# Generate migration
npm run migration:generate -- src/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## Environment Variables Required
```bash
NODE_ENV=development|production|test
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/rss_tok
OPENAI_API_KEY=your_openai_api_key_here
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RSS_FETCH_INTERVAL=*/30 * * * *
TRANSLATION_POLL_INTERVAL=*/5 * * * *
LOG_LEVEL=info
```

## Key Features

### Automated Cron Jobs
- **RSS Fetcher**: Runs every 30 minutes (`*/30 * * * *`) to fetch all RSS feeds
- **Translation Poller**: Runs every 5 minutes (`*/5 * * * *`) to check OpenAI batch job completions
- Jobs are managed by `JobManager` with proper error handling and logging

### API Endpoints
- `GET /api/rss/channels` - List all available RSS channels
- `GET /api/rss/:channel` - Get RSS items for specific channel (with pagination)
- `GET /api/rss/stats` - Get system statistics
- `POST /api/rss/refresh` - Manually trigger RSS refresh
- `GET /health` - Health check endpoint
- `GET /api-docs` - Swagger API documentation

### Translation System
- Uses OpenAI's `gpt-4o-mini` model with batch API
- Translates to: English, Portuguese (Brazil), Spanish, Turkish
- Batch processing for cost efficiency (24-hour completion window)
- Automatic job polling and result processing

### Security & Performance
- Helmet.js for security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes by default)
- Request/response logging with Winston
- Input validation with Zod schemas
- Comprehensive error handling

### Database Patterns
- TypeORM with entities and repositories
- JSONB columns for flexible data (translations, metadata)
- Proper indexing for performance
- Automatic timestamps and triggers
- Foreign key constraints for data integrity

## Common Development Tasks

### Adding New RSS Channels
1. Update `FEED_URLS` in `src/config/feedUrls.ts`
2. The system will automatically start fetching from new channels

### Modifying Translation Languages
1. Update `TARGET_LANGUAGES` in `src/config/feedUrls.ts`
2. Update language mapping in `TranslationService.getLanguageName()`

### Adding New API Endpoints
1. Create validation schema in `src/validators/`
2. Add controller method in appropriate controller
3. Define route in `src/routes/`
4. Add Swagger documentation comments

### Database Changes
1. Create migration: `npm run migration:generate -- src/migrations/DescriptiveName`
2. Review generated migration file
3. Run migration: `npm run migration:run`

### Testing Strategy
- Unit tests for services and utilities
- Integration tests for API endpoints
- Mock external dependencies (OpenAI, RSS feeds)
- Test database operations with test database

## Monitoring and Observability
- Structured logging with Winston
- Health check endpoint with database connectivity
- Error tracking with stack traces
- Performance metrics in logs
- Docker health checks for containers

## Deployment Notes
- Uses multi-stage Docker builds for optimization
- Non-root user for security
- Proper signal handling for graceful shutdowns
- Environment-based configuration
- Production-ready logging and error handling