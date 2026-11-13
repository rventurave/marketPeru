-- =============================================================================
-- 0003_seed_categories.sql
-- Categorías iniciales del marketplace.
--
-- Usa slugs estables y ON CONFLICT para ser idempotente y no duplicar.
-- =============================================================================

INSERT INTO categories (name, slug) VALUES
  ('Tecnología',            'tecnologia'),
  ('Celulares y accesorios', 'celulares-y-accesorios'),
  ('Computadoras',          'computadoras'),
  ('Hogar',                 'hogar'),
  ('Electrodomésticos',     'electrodomesticos'),
  ('Ropa',                  'ropa'),
  ('Calzado',               'calzado'),
  ('Vehículos',             'vehiculos'),
  ('Deportes',              'deportes'),
  ('Entretenimiento',       'entretenimiento'),
  ('Herramientas',          'herramientas'),
  ('Otros',                 'otros')
ON CONFLICT (slug) DO NOTHING;
