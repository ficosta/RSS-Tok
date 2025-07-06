# Frontend Implementation Guide - Infinite Scroll

## Overview
This guide provides step-by-step instructions for implementing the infinite scroll functionality on the frontend using the RSS-Tok API v2.

## Core Components Required

### 1. SessionManager
Handles session creation, persistence, and renewal.

```javascript
class SessionManager {
  constructor() {
    this.sessionId = null;
    this.expiresAt = null;
    this.storageKey = 'rss-tok-session';
  }

  async initialize() {
    // Try to restore from localStorage
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      const { sessionId, expiresAt } = JSON.parse(stored);
      if (new Date(expiresAt) > new Date()) {
        // Session still valid, try to reactivate
        const result = await this.reactivateSession(sessionId);
        if (result.success) return;
      }
    }

    // Create new session
    await this.createNewSession();
  }

  async createNewSession() {
    const response = await fetch('/api/v2/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceFingerprint: this.generateDeviceFingerprint()
      })
    });

    const data = await response.json();
    this.sessionId = data.sessionId;
    this.expiresAt = data.expiresAt;
    this.saveToStorage();
  }

  async reactivateSession(sessionId) {
    try {
      const response = await fetch('/api/v2/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingSessionId: sessionId })
      });

      if (response.ok) {
        const data = await response.json();
        this.sessionId = data.sessionId;
        this.expiresAt = data.expiresAt;
        this.saveToStorage();
        return { success: true };
      }
    } catch (error) {
      console.warn('Failed to reactivate session:', error);
    }
    return { success: false };
  }

  generateDeviceFingerprint() {
    // Simple fingerprint - enhance as needed
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
    
    return btoa(
      navigator.userAgent + 
      navigator.language + 
      screen.width + 'x' + screen.height +
      canvas.toDataURL()
    ).substring(0, 32);
  }

  saveToStorage() {
    localStorage.setItem(this.storageKey, JSON.stringify({
      sessionId: this.sessionId,
      expiresAt: this.expiresAt
    }));
  }

  getSessionId() {
    return this.sessionId;
  }

  async updateActivity() {
    if (!this.sessionId) return;
    
    try {
      const response = await fetch(`/api/v2/session/${this.sessionId}/activity`, {
        method: 'PUT'
      });

      if (response.ok) {
        const data = await response.json();
        this.expiresAt = data.expiresAt;
        this.saveToStorage();
      }
    } catch (error) {
      console.warn('Failed to update session activity:', error);
    }
  }
}
```

### 2. ContentBuffer
Manages in-memory content with 200-item limit.

```javascript
class ContentBuffer {
  constructor(maxItems = 200) {
    this.maxItems = maxItems;
    this.items = [];
    this.viewedItems = new Set();
    this.nextCursor = null;
    this.hasMore = true;
  }

  addItems(newItems, nextCursor, hasMore) {
    this.items.push(...newItems);
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;

    // Maintain buffer limit
    if (this.items.length > this.maxItems) {
      const removed = this.items.splice(0, this.items.length - this.maxItems);
      // Remove viewed tracking for old items
      removed.forEach(item => this.viewedItems.delete(item.itemId));
    }
  }

  markAsViewed(itemIds) {
    itemIds.forEach(id => this.viewedItems.add(id));
  }

  getItems() {
    return this.items;
  }

  getNextCursor() {
    return this.nextCursor;
  }

  hasMoreContent() {
    return this.hasMore;
  }

  getViewedItems() {
    return Array.from(this.viewedItems);
  }

  clear() {
    this.items = [];
    this.viewedItems.clear();
    this.nextCursor = null;
    this.hasMore = true;
  }
}
```

### 3. ScrollMonitor
Detects scroll position and triggers content loading.

```javascript
class ScrollMonitor {
  constructor(container, onLoadMore, onMarkViewed) {
    this.container = container;
    this.onLoadMore = onLoadMore;
    this.onMarkViewed = onMarkViewed;
    this.isLoading = false;
    this.triggerThreshold = 0.8; // Load at 80% scrolled
    this.viewThreshold = 0.5; // Mark viewed at 50% visible
    
    this.visibleItems = new Set();
    this.observer = null;
    
    this.init();
  }

  init() {
    // Scroll listener for loading more content
    this.container.addEventListener('scroll', this.throttle(this.handleScroll.bind(this), 100));
    
    // Intersection Observer for tracking viewed items
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      { 
        root: this.container,
        threshold: this.viewThreshold 
      }
    );
  }

  handleScroll() {
    if (this.isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = this.container;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage >= this.triggerThreshold) {
      this.isLoading = true;
      this.onLoadMore().finally(() => {
        this.isLoading = false;
      });
    }
  }

  handleIntersection(entries) {
    const viewedItems = [];
    
    entries.forEach(entry => {
      const itemId = entry.target.dataset.itemId;
      
      if (entry.isIntersecting) {
        if (!this.visibleItems.has(itemId)) {
          this.visibleItems.add(itemId);
          viewedItems.push(itemId);
        }
      }
    });

    if (viewedItems.length > 0) {
      this.onMarkViewed(viewedItems);
    }
  }

  observeItem(element) {
    this.observer.observe(element);
  }

  unobserveItem(element) {
    this.observer.unobserve(element);
  }

  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  destroy() {
    this.observer.disconnect();
    this.container.removeEventListener('scroll', this.handleScroll);
  }
}
```

### 4. ContentService
Handles API communication for content fetching.

```javascript
class ContentService {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.baseUrl = '/api/v2/content';
  }

  async getHomeContent(cursor = null, limit = 20) {
    const sessionId = this.sessionManager.getSessionId();
    const params = new URLSearchParams({
      sessionId,
      limit: limit.toString()
    });

    if (cursor) {
      params.append('cursor', cursor);
    }

    const response = await fetch(`${this.baseUrl}/home?${params}`);
    
    if (response.status === 401) {
      // Session expired, create new one
      await this.sessionManager.createNewSession();
      return this.getHomeContent(cursor, limit);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.statusText}`);
    }

    return response.json();
  }

  async getChannelContent(channelId, cursor = null, limit = 20) {
    const sessionId = this.sessionManager.getSessionId();
    const params = new URLSearchParams({
      sessionId,
      limit: limit.toString()
    });

    if (cursor) {
      params.append('cursor', cursor);
    }

    const response = await fetch(`${this.baseUrl}/channel/${channelId}?${params}`);
    
    if (response.status === 401) {
      // Session expired, create new one
      await this.sessionManager.createNewSession();
      return this.getChannelContent(channelId, cursor, limit);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch channel content: ${response.statusText}`);
    }

    return response.json();
  }

  async markItemsViewed(itemIds) {
    const sessionId = this.sessionManager.getSessionId();
    
    const response = await fetch(`${this.baseUrl}/${sessionId}/viewed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds })
    });

    if (!response.ok) {
      console.warn('Failed to mark items as viewed:', response.statusText);
    }

    // Update session activity
    await this.sessionManager.updateActivity();
  }
}
```

## Main App Integration

### Complete Implementation Example

```javascript
class InfiniteScrollApp {
  constructor(containerSelector, mode = 'home', channelId = null) {
    this.container = document.querySelector(containerSelector);
    this.mode = mode; // 'home' or 'channel'
    this.channelId = channelId;
    
    this.sessionManager = new SessionManager();
    this.contentService = new ContentService(this.sessionManager);
    this.contentBuffer = new ContentBuffer();
    this.scrollMonitor = null;
    
    this.isInitialized = false;
    this.pendingViewedItems = [];
    this.viewedBatchTimeout = null;
  }

  async initialize() {
    try {
      await this.sessionManager.initialize();
      
      this.setupScrollMonitor();
      await this.loadInitialContent();
      
      this.isInitialized = true;
      console.log('Infinite scroll app initialized');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      throw error;
    }
  }

  setupScrollMonitor() {
    this.scrollMonitor = new ScrollMonitor(
      this.container,
      this.loadMoreContent.bind(this),
      this.handleViewedItems.bind(this)
    );
  }

  async loadInitialContent() {
    try {
      let response;
      
      if (this.mode === 'home') {
        response = await this.contentService.getHomeContent();
      } else {
        response = await this.contentService.getChannelContent(this.channelId);
      }

      this.contentBuffer.addItems(response.items, response.nextCursor, response.hasMore);
      this.renderContent();
      
    } catch (error) {
      console.error('Failed to load initial content:', error);
      this.showError('Failed to load content. Please try again.');
    }
  }

  async loadMoreContent() {
    if (!this.contentBuffer.hasMoreContent()) {
      console.log('No more content available');
      return;
    }

    try {
      this.showLoadingIndicator();
      
      let response;
      const cursor = this.contentBuffer.getNextCursor();
      
      if (this.mode === 'home') {
        response = await this.contentService.getHomeContent(cursor);
      } else {
        response = await this.contentService.getChannelContent(this.channelId, cursor);
      }

      this.contentBuffer.addItems(response.items, response.nextCursor, response.hasMore);
      this.renderNewContent(response.items);
      
      if (!response.hasMore) {
        this.showEndMessage();
      }
      
    } catch (error) {
      console.error('Failed to load more content:', error);
      this.showError('Failed to load more content.');
    } finally {
      this.hideLoadingIndicator();
    }
  }

  handleViewedItems(itemIds) {
    this.pendingViewedItems.push(...itemIds);
    this.contentBuffer.markAsViewed(itemIds);
    
    // Batch viewed items to reduce API calls
    clearTimeout(this.viewedBatchTimeout);
    this.viewedBatchTimeout = setTimeout(() => {
      this.flushViewedItems();
    }, 1000); // Send after 1 second of inactivity
  }

  async flushViewedItems() {
    if (this.pendingViewedItems.length === 0) return;
    
    const itemsToSend = [...this.pendingViewedItems];
    this.pendingViewedItems = [];
    
    try {
      await this.contentService.markItemsViewed(itemsToSend);
    } catch (error) {
      console.warn('Failed to send viewed items:', error);
      // Could implement retry logic here
    }
  }

  renderContent() {
    const items = this.contentBuffer.getItems();
    this.container.innerHTML = '';
    
    items.forEach(item => {
      const element = this.createItemElement(item);
      this.container.appendChild(element);
      this.scrollMonitor.observeItem(element);
    });
  }

  renderNewContent(newItems) {
    newItems.forEach(item => {
      const element = this.createItemElement(item);
      this.container.appendChild(element);
      this.scrollMonitor.observeItem(element);
    });
  }

  createItemElement(item) {
    const article = document.createElement('article');
    article.className = 'rss-item';
    article.dataset.itemId = item.itemId;
    
    article.innerHTML = `
      <div class="item-content">
        <h2 class="item-title">${this.escapeHtml(item.title)}</h2>
        <p class="item-content">${this.escapeHtml(item.content || '')}</p>
        <div class="item-meta">
          <span class="item-date">${new Date(item.pubTimestamp).toLocaleDateString()}</span>
          <a href="${item.link}" target="_blank" class="item-link">Read more</a>
        </div>
      </div>
    `;
    
    return article;
  }

  showLoadingIndicator() {
    const existing = this.container.querySelector('.loading-indicator');
    if (existing) return;
    
    const loader = document.createElement('div');
    loader.className = 'loading-indicator';
    loader.innerHTML = '<div class="spinner"></div><p>Loading more content...</p>';
    this.container.appendChild(loader);
  }

  hideLoadingIndicator() {
    const loader = this.container.querySelector('.loading-indicator');
    if (loader) loader.remove();
  }

  showEndMessage() {
    const existing = this.container.querySelector('.end-message');
    if (existing) return;
    
    const message = document.createElement('div');
    message.className = 'end-message';
    message.innerHTML = '<p>🎉 You\'re all caught up!</p>';
    this.container.appendChild(message);
  }

  showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.innerHTML = `<p>❌ ${message}</p>`;
    this.container.appendChild(error);
    
    setTimeout(() => error.remove(), 5000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.scrollMonitor) {
      this.scrollMonitor.destroy();
    }
    
    clearTimeout(this.viewedBatchTimeout);
    this.flushViewedItems(); // Send any pending viewed items
  }
}
```

## Usage Examples

### Homepage Infinite Scroll
```html
<div id="home-feed" class="content-container"></div>

<script>
const app = new InfiniteScrollApp('#home-feed', 'home');
app.initialize().catch(console.error);
</script>
```

### Channel-Specific Infinite Scroll
```html
<div id="channel-feed" class="content-container"></div>

<script>
const app = new InfiniteScrollApp('#channel-feed', 'channel', 'sport');
app.initialize().catch(console.error);
</script>
```

## CSS Styles

```css
.content-container {
  height: 100vh;
  overflow-y: auto;
  padding: 1rem;
}

.rss-item {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #e1e1e1;
  border-radius: 8px;
  background: white;
}

.item-title {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  line-height: 1.4;
}

.item-content {
  margin: 0 0 1rem 0;
  color: #666;
  line-height: 1.6;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #999;
}

.item-link {
  color: #007bff;
  text-decoration: none;
}

.loading-indicator {
  text-align: center;
  padding: 2rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.end-message, .error-message {
  text-align: center;
  padding: 2rem;
  margin: 1rem 0;
}

.error-message {
  background: #ffe6e6;
  border: 1px solid #ff9999;
  border-radius: 4px;
  color: #cc0000;
}
```

## Performance Tips

1. **Debounce viewed items**: Batch API calls to reduce server load
2. **Virtual scrolling**: For very long lists, consider implementing virtual scrolling
3. **Image lazy loading**: Load images only when they come into view
4. **Memory management**: The 200-item buffer prevents memory issues
5. **Error handling**: Implement retry logic for failed API calls
6. **Session persistence**: Sessions survive app restarts for better UX

## Browser Compatibility

- Modern browsers with ES6+ support
- Intersection Observer API (polyfill available for older browsers)
- localStorage support
- Fetch API (polyfill available)

## Testing Considerations

1. Test session expiry and renewal
2. Test scroll performance with many items
3. Test offline/online scenarios
4. Test memory usage with long scrolling sessions
5. Test different screen sizes and orientations

This implementation provides a robust foundation for infinite scrolling with session management and efficient content deduplication.