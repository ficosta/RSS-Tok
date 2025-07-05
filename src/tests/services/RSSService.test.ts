import { RSSService } from '@/services/RSSService';
import { ItemRepository } from '@/repositories/ItemRepository';
import { TranslationService } from '@/services/TranslationService';

// Mock dependencies
jest.mock('@/repositories/ItemRepository');
jest.mock('@/services/TranslationService');
jest.mock('rss-parser');

const mockItemRepository = ItemRepository as jest.MockedClass<typeof ItemRepository>;
const mockTranslationService = TranslationService as jest.MockedClass<typeof TranslationService>;

describe('RSSService', () => {
  let rssService: RSSService;
  let mockRepository: jest.Mocked<ItemRepository>;
  let mockTranslation: jest.Mocked<TranslationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRepository = new mockItemRepository() as jest.Mocked<ItemRepository>;
    mockTranslation = new mockTranslationService() as jest.Mocked<TranslationService>;
    
    rssService = new RSSService();
  });

  describe('getChannelItems', () => {
    it('should return formatted channel items', async () => {
      const mockItems = [
        {
          itemId: 'test-1',
          title: 'Test Title',
          content: 'Test Content',
          link: 'https://example.com',
          pubDate: '2023-01-01',
          pubTimestamp: 1672531200000,
          mediaContent: {},
          mediaThumbnail: {},
          mediaCredit: '',
          categories: [],
          translations: { en: { title: 'Test Title EN' } },
        },
      ];

      mockRepository.findByChannel.mockResolvedValue({
        items: mockItems,
        total: 1,
      });

      const result = await rssService.getChannelItems('news', 1, 20);

      expect(result).toEqual({
        items: [
          {
            itemId: 'test-1',
            title: 'Test Title',
            content: 'Test Content',
            link: 'https://example.com',
            pubDate: '2023-01-01',
            pubTimestamp: 1672531200000,
            mediaContent: {},
            mediaThumbnail: {},
            mediaCredit: '',
            categories: [],
            translations: { en: { title: 'Test Title EN' } },
            hasTranslation: true,
          },
        ],
        total: 1,
      });

      expect(mockRepository.findByChannel).toHaveBeenCalledWith('news', 1, 20);
    });

    it('should handle empty results', async () => {
      mockRepository.findByChannel.mockResolvedValue({
        items: [],
        total: 0,
      });

      const result = await rssService.getChannelItems('news', 1, 20);

      expect(result).toEqual({
        items: [],
        total: 0,
      });
    });
  });

  describe('getStats', () => {
    it('should return repository stats', async () => {
      const mockStats = {
        totalItems: 100,
        itemsWithTranslations: 50,
        pendingTranslations: 10,
      };

      mockRepository.getStats.mockResolvedValue(mockStats);

      const result = await rssService.getStats();

      expect(result).toEqual(mockStats);
      expect(mockRepository.getStats).toHaveBeenCalled();
    });
  });
});