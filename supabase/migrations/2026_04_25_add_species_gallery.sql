-- Adds a gallery column for species that have more than one reference photo.
-- The existing `reference_image_url` continues to hold the canonical/cover
-- image; `gallery_image_urls` holds any additional photos in display order.

ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS gallery_image_urls TEXT[] NOT NULL DEFAULT '{}';
