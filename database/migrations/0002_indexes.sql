-- =============================================================================
-- 0002_indexes.sql
-- Índices para las consultas más frecuentes.
--
-- Nota: las restricciones UNIQUE ya generan índices implícitos
-- (users.email, sessions.token_hash, seller_profiles.user_id,
--  categories.slug, favorites(user_id, product_id),
--  conversations(buyer_id, seller_id, product_id),
--  seller_reviews(transaction_id, reviewer_id)).
-- =============================================================================

-- Productos: por categoría, vendedor, estado, precio y recientes.
CREATE INDEX idx_products_created         ON products(created_at DESC);
CREATE INDEX idx_products_price           ON products(price);
CREATE INDEX idx_products_seller_status   ON products(seller_id, status);
CREATE INDEX idx_products_category_status ON products(category_id, status);
CREATE INDEX idx_products_status_created  ON products(status, created_at DESC);

-- Imágenes por producto.
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- Favoritos por producto (por usuario ya lo cubre el UNIQUE).
CREATE INDEX idx_favorites_product ON favorites(product_id);

-- Conversaciones por vendedor y por producto
-- (por comprador ya lo cubre el UNIQUE).
CREATE INDEX idx_conversations_seller       ON conversations(seller_id);
CREATE INDEX idx_conversations_seller_buyer ON conversations(seller_id, buyer_id);
CREATE INDEX idx_conversations_product      ON conversations(product_id);

-- Mensajes por conversación y fecha.
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);

-- Transacciones por comprador, vendedor, producto y estado.
CREATE INDEX idx_transactions_buyer_seller ON transactions(buyer_id, seller_id);
CREATE INDEX idx_transactions_seller_buyer ON transactions(seller_id, buyer_id);
CREATE INDEX idx_transactions_product      ON transactions(product_id);
CREATE INDEX idx_transactions_status       ON transactions(status);

-- Calificaciones por vendedor (para reputación).
CREATE INDEX idx_seller_reviews_reviewee ON seller_reviews(reviewee_id);

-- Sesiones por usuario y expiración.
CREATE INDEX idx_sessions_user_expires ON sessions(user_id, expires_at);
CREATE INDEX idx_sessions_expires      ON sessions(expires_at);

-- Reportes por estado y por reportador.
CREATE INDEX idx_reports_status   ON reports(status);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
