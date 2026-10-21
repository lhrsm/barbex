-- Rollback script for 20261021120000_r2e24d_normalize_legacy_storage_urls.sql
UPDATE public.profiles
SET pix_qr_code_url = 'https://wdxhjwodyctgzqtogkgv.supabase.co/storage/v1/object/public/barber-avatars/c54ac1ac-49be-4505-b7a4-d257ed023f08-pix-qr-0.9717369603773581.jpeg'
WHERE id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';

UPDATE public.customers
SET avatar_url = 'https://wdxhjwodyctgzqtogkgv.supabase.co/storage/v1/object/public/barber-avatars/customer-avatars/17a7cd46-ff2a-4df0-a425-62121a422a3a-0.5015456304598606.jpg'
WHERE id = '17a7cd46-ff2a-4df0-a425-62121a422a3a';

UPDATE public.customers
SET avatar_url = 'https://wdxhjwodyctgzqtogkgv.supabase.co/storage/v1/object/public/barber-avatars/customer-avatars/40bc272a-ee7c-4572-9ae7-f622f764a35b-0.9164051652589847.png'
WHERE id = '40bc272a-ee7c-4572-9ae7-f622f764a35b';

UPDATE public.customers
SET avatar_url = 'https://wdxhjwodyctgzqtogkgv.supabase.co/storage/v1/object/public/barber-avatars/customer-avatars/a43d0f80-7cc0-4d2d-b89e-d50a8d7c9aa6-0.36508968964703326.jpg'
WHERE id = 'a43d0f80-7cc0-4d2d-b89e-d50a8d7c9aa6';

UPDATE public.customers
SET avatar_url = 'https://wdxhjwodyctgzqtogkgv.supabase.co/storage/v1/object/public/barber-avatars/customer-avatars/00e9ee44-4f68-42ae-bd65-3ea19eb3a9a4-0.9839577117920691.png'
WHERE id = '00e9ee44-4f68-42ae-bd65-3ea19eb3a9a4';
