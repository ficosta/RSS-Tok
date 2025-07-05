-- Initial schema for RSS-Tok database
-- Run this script to create the initial database structure

-- ===============================
-- Tabela principal de Itens RSS
-- ===============================
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

-- =====================================================
-- Relacionamento entre Itens e Canais (visibilidade)
-- =====================================================
CREATE TABLE IF NOT EXISTS item_channels (
  item_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, channel),
  FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

-- =====================================================
-- Índices para performance (consultas frequentes)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_items_pub_timestamp ON items(pub_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_translation_status ON items((translation_job->>'status'));
CREATE INDEX IF NOT EXISTS idx_item_channels_channel_visible ON item_channels(channel, is_visible);
CREATE INDEX IF NOT EXISTS idx_item_channels_item_id ON item_channels(item_id);

-- =====================================================
-- Função para atualizar updated_at automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- Triggers para atualizar updated_at
-- =====================================================
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_channels_updated_at BEFORE UPDATE ON item_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();