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

#### user_sessions (session management for infinite scroll)
```sql
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
  is_active BOOLEAN DEFAULT TRUE
);
```

#### session_views (tracks viewed items per session)
```sql
CREATE TABLE IF NOT EXISTS session_views (
  session_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, item_id),
  FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items("itemId") ON DELETE CASCADE
);
```

#### Performance Indexes
```sql
-- Items table indexes
CREATE INDEX IF NOT EXISTS idx_items_pub_timestamp ON items(pub_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_translation_status ON items((translation_job->>'status'));

-- Item channels indexes
CREATE INDEX IF NOT EXISTS idx_item_channels_channel_visible ON item_channels(channel, is_visible);
CREATE INDEX IF NOT EXISTS idx_item_channels_item_id ON item_channels(item_id);

-- Session management indexes
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_session_views_session_id ON session_views(session_id);
CREATE INDEX IF NOT EXISTS idx_session_views_item_lookup ON session_views(item_id, session_id);
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

#### v2 API (Recommended - with infinite scroll and session management)
- `POST /api/v2/session/start` - Create new session for infinite scroll
- `GET /api/v2/session/{sessionId}/validate` - Validate session status
- `PUT /api/v2/session/{sessionId}/activity` - Update session activity (extends 15min expiration)
- `POST /api/v2/session/{sessionId}/views` - Mark items as viewed
- `GET /api/v2/content/home` - Get mixed homepage content with infinite scroll
- `GET /api/v2/content/channel/{channelId}` - Get channel-specific content with infinite scroll

#### v1 API (Legacy - basic pagination)
- `GET /api/rss/channels` - List all available RSS channels
- `GET /api/rss/:channel` - Get RSS items for specific channel (with pagination)
- `GET /api/rss/stats` - Get system statistics
- `GET /api/rss/metrics` - Get timeline metrics for analytics dashboard
- `GET /api/rss/channel-metrics` - Get channel distribution metrics
- `POST /api/rss/refresh` - Manually trigger RSS refresh

#### System
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

### Session Management & Infinite Scroll
- UUID-based session tracking for stateless API
- 15-minute session expiration with automatic extension
- Viewed items tracking to prevent duplicates
- Cursor-based pagination for infinite scroll
- Channel balancing for diverse content feeds
- Automatic session cleanup of expired sessions

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

### Working with Sessions (v2 API)
1. **Create session**: `POST /api/v2/session/start`
2. **Use session**: Include `sessionId` in query parameters
3. **Extend session**: `PUT /api/v2/session/{sessionId}/activity`
4. **Sessions expire**: After 15 minutes of inactivity
5. **Session cleanup**: Automated cleanup runs periodically

### Testing Strategy
- Unit tests for services and utilities
- Integration tests for API endpoints
- Mock external dependencies (OpenAI, RSS feeds)
- Test database operations with test database
- Session management testing for infinite scroll

## Monitoring and Observability
- Structured logging with Winston
- Health check endpoint with database connectivity
- Error tracking with stack traces
- Performance metrics in logs
- Docker health checks for containers

## Available RSS Channels

### Content Channels
- `alle` - All content (mixed feed)
- `homepage` - Homepage content
- `news` - General news
- `politik` - Politics
- `unterhaltung` - Entertainment
- `sport` - Sports
- `lifestyle` - Lifestyle
- `ratgeber` - Advice/Tips
- `auto` - Automotive
- `digital` - Technology/Digital
- `spiele` - Games
- `leserreporter` - Reader reports

### Regional Channels
- `berlin` - Berlin regional news
- `chemnitz` - Chemnitz regional news
- `bremen` - Bremen regional news
- `dresden` - Dresden regional news
- `duesseldorf` - Düsseldorf regional news
- `frankfurt` - Frankfurt regional news
- `hamburg` - Hamburg regional news
- `hannover` - Hannover regional news
- `koeln` - Cologne regional news
- `leipzig` - Leipzig regional news
- `muenchen` - Munich regional news
- `ruhrgebiet` - Ruhr area regional news
- `saarland` - Saarland regional news
- `stuttgart` - Stuttgart regional news

## API Usage Examples

### v2 API (Infinite Scroll - Recommended)

```bash
# 1. Create a session
curl -X POST "http://localhost:3000/api/v2/session/start" \
  -H "Content-Type: application/json" \
  -d '{}'

# Response: {"sessionId": "uuid", "expiresAt": "2025-07-07T...", "isNew": true}

# 2. Get homepage content
curl "http://localhost:3000/api/v2/content/home?sessionId=UUID&limit=20"

# 3. Get channel-specific content
curl "http://localhost:3000/api/v2/content/channel/news?sessionId=UUID&limit=20"

# 4. Get more content with cursor (infinite scroll)
curl "http://localhost:3000/api/v2/content/home?sessionId=UUID&limit=20&cursor=1751879399000"

# 5. Mark items as viewed
curl -X POST "http://localhost:3000/api/v2/session/UUID/views" \
  -H "Content-Type: application/json" \
  -d '{"itemIds": ["item1", "item2"]}'
```

### v1 API (Basic Pagination)

```bash
# Get available channels
curl "http://localhost:3000/api/rss/channels"

# Get channel content with pagination
curl "http://localhost:3000/api/rss/news?page=1&limit=20"

# Get analytics metrics
curl "http://localhost:3000/api/rss/metrics?period=7d&granularity=day"

# Get system statistics
curl "http://localhost:3000/api/rss/stats"
```

### Date Format
All dates in the API are displayed in Berlin time (CEST/CET) using the format: `dd/mm/yyyy HH:MM`

## Deployment Notes
- Uses multi-stage Docker builds for optimization
- Non-root user for security
- Proper signal handling for graceful shutdowns
- Environment-based configuration
- Production-ready logging and error handling