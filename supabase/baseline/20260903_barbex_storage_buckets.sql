-- ==============================================================================
-- BARBEX CONSOLIDATED STORAGE BUCKETS BASELINE
-- DEFINIÇÃO ESTRUTURAL DOS BUCKETS DO SUPABASE STORAGE
-- TARGET PROJECT: ywdwrstxvsdqiryhieiz
-- ==============================================================================

-- 1. barber-avatars: Avatares de barbeiros, logos, qr codes e fotos de galeria (Público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'barber-avatars',
  'barber-avatars',
  true,
  52428800, -- 50 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. payment-receipts: Comprovantes de pagamento PIX enviados por clientes (Privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. support-attachments: Anexos de chamados e tickets de suporte técnico (Privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  20971520, -- 20 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. system-assets: Assets públicos globais do sistema SaaS (logos do Barbex, branding)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'system-assets',
  'system-assets',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. tutorial-assets: Vídeos e tutoriais da central de ajuda Barbex (Público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorial-assets',
  'tutorial-assets',
  true,
  104857600, -- 100 MB
  ARRAY['image/png', 'image/jpeg', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
