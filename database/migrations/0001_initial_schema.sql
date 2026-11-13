-- =============================================================================
-- 0001_initial_schema.sql
-- Esquema inicial del marketplace (Cloudflare D1 / SQLite).
--
-- Convenciones:
--   * Claves primarias: INTEGER PRIMARY KEY (rowid, auto-asignado).
--   * Fechas: TEXT en formato ISO 8601 UTC con milisegundos.
--   * Integridad referencial habilitada (D1 habilita foreign keys por defecto).
--   * Restricciones CHECK para estados y rangos.
--   * Triggers para validaciones entre tablas que CHECK/FK no pueden expresar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users — cuentas de usuario (credenciales y estado de cuenta)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'admin')),
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'banned')),
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- sessions — sesiones autenticadas
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- seller_profiles — perfil público del vendedor (1—1 con users)
-- -----------------------------------------------------------------------------
CREATE TABLE seller_profiles (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  bio            TEXT,
  location       TEXT,
  phone          TEXT,
  average_rating REAL    NOT NULL DEFAULT 0,
  rating_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- categories — categorías de productos (jerárquicas)
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- products — publicaciones de los vendedores
-- -----------------------------------------------------------------------------
CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title       TEXT    NOT NULL,
  description TEXT,
  price       REAL    NOT NULL CHECK (price >= 0),
  currency    TEXT    NOT NULL DEFAULT 'PEN'
              CHECK (currency = upper(currency) AND length(currency) = 3),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  condition   TEXT    NOT NULL DEFAULT 'used'
              CHECK (condition IN ('new', 'used')),
  status      TEXT    NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'sold', 'hidden', 'removed')),
  location    TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- product_images — referencias a fotografías almacenadas en R2
-- -----------------------------------------------------------------------------
CREATE TABLE product_images (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key     TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- favorites — productos guardados por un usuario
-- -----------------------------------------------------------------------------
CREATE TABLE favorites (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, product_id)
);

-- -----------------------------------------------------------------------------
-- conversations — conversación entre comprador y vendedor sobre un producto
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY,
  buyer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (buyer_id <> seller_id),
  UNIQUE (buyer_id, seller_id, product_id)
);

-- -----------------------------------------------------------------------------
-- messages — mensajes dentro de una conversación
-- -----------------------------------------------------------------------------
CREATE TABLE messages (
  id              INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body            TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  read_at         TEXT
);

-- -----------------------------------------------------------------------------
-- transactions — acuerdos entre comprador y vendedor
--
-- Flujo de confirmación bilateral:
--   * 'pending'   -> creada, esperando confirmación.
--   * 'completed' -> solo cuando AMBAS partes confirmaron (buyer_confirmed_at
--                    y seller_confirmed_at no nulos). Lo garantiza el trigger
--                    trg_transactions_completed_guard.
--   * 'cancelled' -> cancelada por una de las partes o un administrador.
--   * 'disputed'  -> se abrió una disputa.
-- Una transacción cancelada o disputada NUNCA habilita calificación.
-- -----------------------------------------------------------------------------
CREATE TABLE transactions (
  id                  INTEGER PRIMARY KEY,
  buyer_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  status              TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'cancelled', 'disputed')),
  buyer_confirmed_at  TEXT,
  seller_confirmed_at TEXT,
  completed_at        TEXT,
  cancelled_at        TEXT,
  cancelled_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  disputed_at         TEXT,
  disputed_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  dispute_reason      TEXT,
  resolved_at         TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (buyer_id <> seller_id)
);

-- -----------------------------------------------------------------------------
-- seller_reviews — calificaciones de vendedores vinculadas a transacciones
-- -----------------------------------------------------------------------------
CREATE TABLE seller_reviews (
  id             INTEGER PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  reviewer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewee_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (reviewer_id <> reviewee_id),
  UNIQUE (transaction_id, reviewer_id)
);

-- -----------------------------------------------------------------------------
-- reports — reportes de contenido (producto, usuario o mensaje)
-- -----------------------------------------------------------------------------
CREATE TABLE reports (
  id                INTEGER PRIMARY KEY,
  reporter_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type       TEXT    NOT NULL
                    CHECK (target_type IN ('product', 'user', 'message')),
  product_id        INTEGER REFERENCES products(id) ON DELETE CASCADE,
  reported_user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message_id        INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  reason            TEXT    NOT NULL,
  description       TEXT,
  status            TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at       TEXT,
  CHECK (
    (target_type = 'product' AND product_id IS NOT NULL AND reported_user_id IS NULL AND message_id IS NULL)
    OR
    (target_type = 'user' AND reported_user_id IS NOT NULL AND product_id IS NULL AND message_id IS NULL)
    OR
    (target_type = 'message' AND message_id IS NOT NULL AND product_id IS NULL AND reported_user_id IS NULL)
  )
);

-- =============================================================================
-- Triggers: validaciones entre tablas que CHECK y FK no pueden expresar.
-- =============================================================================

-- 1. Un producto debe pertenecer a un usuario con perfil de vendedor.
CREATE TRIGGER trg_products_seller_profile_insert
BEFORE INSERT ON products
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.user_id = NEW.seller_id)
BEGIN
  SELECT RAISE(ABORT, 'products: el vendedor no tiene perfil de vendedor');
END;

CREATE TRIGGER trg_products_seller_profile_update
BEFORE UPDATE OF seller_id ON products
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.user_id = NEW.seller_id)
BEGIN
  SELECT RAISE(ABORT, 'products: el vendedor no tiene perfil de vendedor');
END;

-- 2. El remitente de un mensaje debe participar en la conversación.
CREATE TRIGGER trg_messages_sender_is_participant
BEFORE INSERT ON messages
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.id = NEW.conversation_id
    AND (c.buyer_id = NEW.sender_id OR c.seller_id = NEW.sender_id)
)
BEGIN
  SELECT RAISE(ABORT, 'messages: el remitente no participa en la conversación');
END;

-- 3. El producto de una transacción debe pertenecer al vendedor de la misma.
CREATE TRIGGER trg_transactions_product_seller
BEFORE INSERT ON transactions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = NEW.product_id AND p.seller_id = NEW.seller_id
)
BEGIN
  SELECT RAISE(ABORT, 'transactions: el producto no pertenece al vendedor');
END;

-- 4. Una transacción solo puede completarse con confirmación de AMBAS partes.
CREATE TRIGGER trg_transactions_completed_guard
BEFORE UPDATE OF status ON transactions
FOR EACH ROW
WHEN NEW.status = 'completed'
  AND (NEW.buyer_confirmed_at IS NULL OR NEW.seller_confirmed_at IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'transactions: se requiere confirmación de ambas partes para completar');
END;

-- 5. Una calificación solo es válida para una transacción completada en la que
--    el reviewer sea el comprador y el reviewee el vendedor.
CREATE TRIGGER trg_seller_reviews_validate_insert
BEFORE INSERT ON seller_reviews
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = NEW.transaction_id
    AND t.status = 'completed'
    AND t.buyer_id = NEW.reviewer_id
    AND t.seller_id = NEW.reviewee_id
)
BEGIN
  SELECT RAISE(ABORT, 'seller_reviews: la transacción no está completada o las partes no coinciden');
END;

-- 6. Mantener la reputación del vendedor al insertar una opinión.
CREATE TRIGGER trg_seller_reviews_update_profile_after_insert
AFTER INSERT ON seller_reviews
FOR EACH ROW
BEGIN
  UPDATE seller_profiles
  SET average_rating = (
        SELECT AVG(rating) FROM seller_reviews WHERE reviewee_id = NEW.reviewee_id
      ),
      rating_count = (
        SELECT COUNT(*) FROM seller_reviews WHERE reviewee_id = NEW.reviewee_id
      ),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = NEW.reviewee_id;
END;

-- 7. Mantener la reputación del vendedor al eliminar una opinión.
CREATE TRIGGER trg_seller_reviews_update_profile_after_delete
AFTER DELETE ON seller_reviews
FOR EACH ROW
BEGIN
  UPDATE seller_profiles
  SET average_rating = (
        SELECT AVG(rating) FROM seller_reviews WHERE reviewee_id = OLD.reviewee_id
      ),
      rating_count = (
        SELECT COUNT(*) FROM seller_reviews WHERE reviewee_id = OLD.reviewee_id
      ),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = OLD.reviewee_id;
END;
