# Infinite Scroll Feature Mapping - API v2

## Overview
RSS-Tok infinite scroll system provides seamless content consumption with smart session management and deduplication. The system supports both homepage content and channel-specific feeds with persistent anonymous sessions.

## Core Features

### Session Management
- **Duration**: 15 minutes from last activity
- **Type**: Anonymous persistent sessions (survives app closure)
- **Storage**: Browser localStorage + backend PostgreSQL
- **Scope**: Single device, cross-session persistence
- **Cleanup**: Automatic expiry after 15 minutes inactivity

### Content Delivery Modes
1. **Homepage Mode** (`/v2/content/home`)
   - Mixed content from all available channels
   - Time-ordered delivery (newest first)
   - Balanced channel representation

2. **Channel Mode** (`/v2/content/channel/:channelId`)
   - Channel-specific content only
   - Time-ordered delivery within channel
   - Cycles through all channel content when exhausted

### Memory Management
- **Frontend Buffer**: Maximum 200 items in memory
- **Buffer Strategy**: Keep last 200 items, remove older content
- **Prefetch**: Load next batch when user reaches 80% of current content
- **Memory Cleanup**: Remove items beyond 200-item limit

### Deduplication System
- **Session Tracking**: Track viewed items per session
- **Backend Filtering**: Server-side exclusion of viewed content
- **Cycle Behavior**: When all content consumed, restart with new session
- **Persistence**: Viewed items survive app closure within session duration

## Technical Architecture

### Database Schema

#### Sessions Table
```sql
CREATE TABLE user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_device ON user_sessions(device_fingerprint);
```

#### Session Views Table
```sql
CREATE TABLE session_views (
  session_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, item_id),
  FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

CREATE INDEX idx_session_views_session_id ON session_views(session_id);
CREATE INDEX idx_session_views_viewed_at ON session_views(viewed_at);
```

### API v2 Endpoints

#### Session Management
```
POST /api/v2/session/start
- Creates new session or returns existing active session
- Request: { deviceFingerprint?: string }
- Response: { sessionId: string, expiresAt: timestamp }

PUT /api/v2/session/:sessionId/activity
- Updates last activity timestamp, extends expiry
- Response: { sessionId: string, expiresAt: timestamp }

POST /api/v2/session/:sessionId/views
- Marks items as viewed in current session
- Request: { itemIds: string[] }
- Response: { success: boolean, viewedCount: number }
```

#### Content Delivery
```
GET /api/v2/content/home
- Returns homepage content with session-based deduplication
- Query: sessionId, cursor?, limit=20
- Response: { items: Item[], nextCursor: string, hasMore: boolean }

GET /api/v2/content/channel/:channelId
- Returns channel-specific content with session-based deduplication
- Query: sessionId, cursor?, limit=20
- Response: { items: Item[], nextCursor: string, hasMore: boolean, cycleCount?: number }
```

## Business Logic

### Content Selection Algorithm

#### Homepage Mode
1. Query all channels for content newer than cursor
2. Exclude items already viewed in current session
3. Apply channel balancing (max 5 consecutive items per channel)
4. Sort by publication timestamp (newest first)
5. Limit to requested batch size

#### Channel Mode
1. Query specific channel for content newer than cursor
2. Exclude items already viewed in current session
3. Sort by publication timestamp (newest first)
4. If no more content available, increment cycle counter and restart from beginning
5. Limit to requested batch size

### Session Lifecycle
1. **Creation**: Generate UUID, set 15-minute expiry
2. **Activity**: Each API call extends expiry by 15 minutes
3. **Persistence**: Session survives app closure via localStorage
4. **Expiry**: Automatic cleanup of expired sessions and associated views
5. **Renewal**: Create new session when expired session accessed

### Memory Management Strategy
```javascript
// Frontend buffer management concept
class ContentBuffer {
  maxItems = 200;
  buffer = [];
  
  addItems(newItems) {
    this.buffer.push(...newItems);
    if (this.buffer.length > this.maxItems) {
      this.buffer = this.buffer.slice(-this.maxItems);
    }
  }
}
```

## Performance Considerations

### Database Optimization
- **Indexes**: Composite indexes on (session_id, viewed_at) and (pub_timestamp, channel)
- **Cleanup Job**: Periodic removal of expired sessions and orphaned views
- **Query Optimization**: Use NOT EXISTS for session-based filtering
- **Connection Pooling**: Efficient database connection management

### Caching Strategy
- **Session Cache**: Redis/In-memory cache for active sessions
- **Content Cache**: Short-term cache for frequently requested content batches
- **Frontend Cache**: Browser cache for static assets and images

### API Rate Limiting
- **Per Session**: 100 requests per 15 minutes
- **Global**: Existing application rate limits apply
- **Content Endpoints**: Separate limits for high-frequency scroll requests

## Frontend Integration Guidelines

### Required Frontend Components
1. **SessionManager**: Handle session creation, persistence, and renewal
2. **ScrollMonitor**: Detect scroll position and trigger content loading
3. **ContentBuffer**: Manage in-memory content with 200-item limit
4. **ViewTracker**: Track and report viewed items to backend

### Implementation Flow
```javascript
// Pseudo-code flow
1. App Launch → Check localStorage for sessionId
2. If expired/missing → Create new session
3. Load initial content batch (20 items)
4. Monitor scroll position
5. At 80% scrolled → Fetch next batch
6. Add to buffer, remove old items if > 200
7. Mark visible items as viewed
8. Repeat cycle

// Session persistence
localStorage.setItem('rss-tok-session', {
  sessionId: 'uuid',
  expiresAt: timestamp,
  deviceFingerprint: 'hash'
});
```

### Error Handling
- **Session Expired**: Automatically create new session, continue loading
- **Network Errors**: Retry with exponential backoff
- **No More Content**: Show "all caught up" message, offer refresh
- **Memory Pressure**: Aggressive cleanup of old content

## Analytics & Monitoring

### Key Metrics
- Session duration and engagement
- Content consumption rate (items per minute)
- Cycle completion rate (users who consume all content)
- Memory usage patterns
- API response times for scroll endpoints

### Business Intelligence
- Most engaging content types
- Optimal batch sizes for different user behaviors
- Session persistence vs engagement correlation
- Channel preference patterns in homepage mode

## Migration Strategy

### API Versioning
- **v1 Endpoints**: Remain unchanged and functional
- **v2 Endpoints**: New namespace with enhanced functionality
- **Frontend Migration**: Gradual adoption of v2 endpoints
- **Deprecation Timeline**: v1 maintained for 6 months post-v2 launch

### Database Migration
- **Additive Changes**: New tables without affecting existing schema
- **Backward Compatibility**: v1 endpoints continue using existing tables
- **Data Migration**: Optional migration tool for existing user patterns

## Security Considerations

### Session Security
- **Anonymous Sessions**: No PII stored
- **Device Fingerprinting**: Optional, privacy-conscious implementation
- **Session Hijacking**: UUID-based sessions with expiry protection
- **Rate Limiting**: Prevent abuse of session creation

### Data Privacy
- **No Tracking**: No cross-device or long-term user tracking
- **Automatic Cleanup**: Regular removal of expired session data
- **Minimal Storage**: Only essential data for functionality
- **GDPR Compliance**: Anonymous, time-limited data retention

## Future Enhancements

### Phase 2 Features
- **Smart Prefetching**: Predictive content loading based on scroll patterns
- **Content Recommendations**: ML-based content suggestion within sessions
- **Offline Mode**: Limited offline content caching
- **Cross-Device Sync**: Optional account-based session sharing

### Performance Optimizations
- **CDN Integration**: Static asset delivery optimization
- **Edge Caching**: Geographically distributed content caching
- **Progressive Loading**: Adaptive batch sizes based on connection speed
- **Virtual Scrolling**: Render optimization for large content lists

---

*This document serves as the technical specification for RSS-Tok's infinite scroll system. All implementations should adhere to these specifications for consistency and optimal user experience.*