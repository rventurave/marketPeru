// =============================================================================
// Pruebas del modelo de datos (Cloudflare D1 / SQLite).
//
// Ejecución:  node --test database/tests/database.test.mjs
//
// Se usa el módulo `node:sqlite` (mismo motor SQLite que ejecuta D1) para
// aplicar las migraciones desde cero y verificar integridad sin credenciales
// de Cloudflare.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

const now = () => new Date().toISOString();

function loadMigrations() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(migrationsDir, f), 'utf8'));
}

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of loadMigrations()) {
    db.exec(sql);
  }
  return db;
}

// --- Helpers de inserción -----------------------------------------------------

function createUser(db, { email = 'a@b.c', name = 'Test', role = 'user' } = {}) {
  const r = db
    .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
    .run(email, 'hash', name, role);
  return Number(r.lastInsertRowid);
}

function createSellerProfile(db, userId, { displayName = 'Vendedor' } = {}) {
  db.prepare('INSERT INTO seller_profiles (user_id, display_name) VALUES (?, ?)').run(
    userId,
    displayName,
  );
}

function createCategory(db, { name = 'Cat', slug = 'cat' } = {}) {
  const r = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, slug);
  return Number(r.lastInsertRowid);
}

function createProduct(db, { sellerId, categoryId, price = 10, title = 'Producto' }) {
  const r = db
    .prepare('INSERT INTO products (seller_id, category_id, title, price) VALUES (?, ?, ?, ?)')
    .run(sellerId, categoryId, title, price);
  return Number(r.lastInsertRowid);
}

function createConversation(db, { buyerId, sellerId, productId }) {
  const r = db
    .prepare('INSERT INTO conversations (buyer_id, seller_id, product_id) VALUES (?, ?, ?)')
    .run(buyerId, sellerId, productId);
  return Number(r.lastInsertRowid);
}

function createTransaction(db, { buyerId, sellerId, productId }) {
  const r = db
    .prepare('INSERT INTO transactions (buyer_id, seller_id, product_id) VALUES (?, ?, ?)')
    .run(buyerId, sellerId, productId);
  return Number(r.lastInsertRowid);
}

function completeTransaction(db, id) {
  db.prepare(
    'UPDATE transactions SET buyer_confirmed_at = ?, seller_confirmed_at = ?, status = ? WHERE id = ?',
  ).run(now(), now(), 'completed', id);
}

function insertReview(db, { transactionId, reviewerId, revieweeId, rating, comment = null }) {
  return db
    .prepare(
      'INSERT INTO seller_reviews (transaction_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    )
    .run(transactionId, reviewerId, revieweeId, rating, comment);
}

// --- Creación de usuarios y emails duplicados ---------------------------------

test('crea usuarios y rechaza emails duplicados', () => {
  const db = freshDb();
  const id = createUser(db, { email: 'dup@example.com', name: 'A' });
  assert.ok(id > 0);

  assert.throws(() => createUser(db, { email: 'dup@example.com', name: 'B' }), /UNIQUE/);
});

// --- Productos: vendedor válido, categoría válida, precio no negativo ---------

test('crea productos con vendedor y categoría válidos', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat, price: 25.5 });

  assert.ok(product > 0);
  const row = db.prepare('SELECT price, currency FROM products WHERE id = ?').get(product);
  assert.equal(row.price, 25.5);
  assert.equal(row.currency, 'PEN');
});

test('rechaza precios negativos', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const cat = createCategory(db);

  assert.throws(() => createProduct(db, { sellerId: seller, categoryId: cat, price: -1 }), /CHECK/);
});

test('rechaza producto con vendedor inexistente', () => {
  const db = freshDb();
  const cat = createCategory(db);

  // El trigger de perfil de vendedor dispara antes que la FK; en ambos casos
  // el producto se rechaza. (La integridad por FK pura se cubre en el test
  // de conversaciones con participantes inexistentes.)
  assert.throws(
    () => createProduct(db, { sellerId: 9999, categoryId: cat }),
    /perfil de vendedor|FOREIGN KEY/,
  );
});

test('rechaza producto cuyo vendedor no tiene perfil de vendedor', () => {
  const db = freshDb();
  const user = createUser(db, { email: 'no-seller@example.com' });
  const cat = createCategory(db);

  assert.throws(
    () => createProduct(db, { sellerId: user, categoryId: cat }),
    /perfil de vendedor/,
  );
});

// --- Favoritos duplicados -----------------------------------------------------

test('rechaza favoritos duplicados', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });

  db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)').run(buyer, product);
  assert.throws(
    () => db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)').run(buyer, product),
    /UNIQUE/,
  );
});

// --- Transacciones: restricciones ---------------------------------------------

test('rechaza transacción donde el vendedor es el comprador', () => {
  const db = freshDb();
  const u = createUser(db, { email: 'solo@example.com' });
  createSellerProfile(db, u);
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: u, categoryId: cat });

  assert.throws(
    () => createTransaction(db, { buyerId: u, sellerId: u, productId: product }),
    /CHECK/,
  );
});

test('rechaza transacción cuyo producto no pertenece al vendedor', () => {
  const db = freshDb();
  const owner = createUser(db, { email: 'owner@example.com' });
  createSellerProfile(db, owner);
  const other = createUser(db, { email: 'other@example.com' });
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: owner, categoryId: cat });

  assert.throws(
    () => createTransaction(db, { buyerId: buyer, sellerId: other, productId: product }),
    /no pertenece al vendedor/,
  );
});

test('rechaza completar transacción sin confirmación de ambas partes', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });
  const tx = createTransaction(db, { buyerId: buyer, sellerId: seller, productId: product });

  // Confirmación de una sola parte -> no debe poder completarse.
  db.prepare('UPDATE transactions SET buyer_confirmed_at = ? WHERE id = ?').run(now(), tx);
  assert.throws(
    () => db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run('completed', tx),
    /ambas partes/,
  );
});

test('completa transacción con confirmación bilateral', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });
  const tx = createTransaction(db, { buyerId: buyer, sellerId: seller, productId: product });

  completeTransaction(db, tx);
  const row = db.prepare('SELECT status FROM transactions WHERE id = ?').get(tx);
  assert.equal(row.status, 'completed');
});

// --- Calificaciones -----------------------------------------------------------

test('rechaza calificaciones fuera del rango 1-5', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });
  const tx = createTransaction(db, { buyerId: buyer, sellerId: seller, productId: product });
  completeTransaction(db, tx);

  for (const rating of [0, 6]) {
    assert.throws(
      () => insertReview(db, { transactionId: tx, reviewerId: buyer, revieweeId: seller, rating }),
      /CHECK/,
    );
  }
});

test('rechaza calificación sin transacción completada', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });
  const tx = createTransaction(db, { buyerId: buyer, sellerId: seller, productId: product });

  // Transacción aún en estado 'pending'.
  assert.throws(
    () => insertReview(db, { transactionId: tx, reviewerId: buyer, revieweeId: seller, rating: 5 }),
    /no está completada/,
  );
});

test('rechaza calificación duplicada del mismo comprador y transacción', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });
  const tx = createTransaction(db, { buyerId: buyer, sellerId: seller, productId: product });
  completeTransaction(db, tx);

  insertReview(db, { transactionId: tx, reviewerId: buyer, revieweeId: seller, rating: 4 });
  assert.throws(
    () => insertReview(db, { transactionId: tx, reviewerId: buyer, revieweeId: seller, rating: 5 }),
    /UNIQUE/,
  );
});

test('calcula la reputación del vendedor con opiniones válidas', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);

  // Dos compradores distintos con transacciones completadas.
  for (const [i, rating] of [4, 5].entries()) {
    const buyer = createUser(db, { email: `buyer${i}@example.com`, name: `B${i}` });
    const cat = createCategory(db, { slug: `cat-${i}` });
    const product = createProduct(db, { sellerId: seller, categoryId: cat });
    const tx = createTransaction(db, { buyerId: buyer, sellerId: seller, productId: product });
    completeTransaction(db, tx);
    insertReview(db, { transactionId: tx, reviewerId: buyer, revieweeId: seller, rating });
  }

  const profile = db
    .prepare('SELECT average_rating, rating_count FROM seller_profiles WHERE user_id = ?')
    .get(seller);
  assert.equal(profile.rating_count, 2);
  assert.ok(Math.abs(profile.average_rating - 4.5) < 1e-9);
});

// --- Mensajería ---------------------------------------------------------------

test('rechaza mensajes de usuarios que no participan en la conversación', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const buyer = createUser(db, { email: 'buyer@example.com' });
  const intruder = createUser(db, { email: 'intruder@example.com' });
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });
  const conv = createConversation(db, { buyerId: buyer, sellerId: seller, productId: product });

  assert.throws(
    () =>
      db
        .prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
        .run(conv, intruder, 'hola'),
    /no participa/,
  );

  // Los participantes sí pueden enviar mensajes.
  db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(
    conv,
    buyer,
    'hola',
  );
});

// --- Migraciones desde una base de datos limpia -------------------------------

test('aplica las migraciones desde cero y siembra las categorías', () => {
  const db = freshDb();

  const expectedTables = [
    'users',
    'sessions',
    'seller_profiles',
    'categories',
    'products',
    'product_images',
    'favorites',
    'conversations',
    'messages',
    'transactions',
    'seller_reviews',
    'reports',
  ];

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => r.name);

  for (const t of expectedTables) {
    assert.ok(tables.includes(t), `falta la tabla ${t}`);
  }

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM categories').get();
  assert.equal(count, 12);

  // Idempotencia del seed: volver a aplicar no duplica.
  const seedSql = loadMigrations().at(-1);
  db.exec(seedSql);
  const { count: count2 } = db.prepare('SELECT COUNT(*) AS count FROM categories').get();
  assert.equal(count2, 12);
});

// --- Integridad referencial ---------------------------------------------------

test('rechaza conversaciones con participantes inexistentes (FK)', () => {
  const db = freshDb();
  const seller = createUser(db, { email: 'seller@example.com' });
  createSellerProfile(db, seller);
  const cat = createCategory(db);
  const product = createProduct(db, { sellerId: seller, categoryId: cat });

  assert.throws(
    () => createConversation(db, { buyerId: 9999, sellerId: seller, productId: product }),
    /FOREIGN KEY/,
  );
});
