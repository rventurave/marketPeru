import { SELF } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, it, expect, beforeAll } from 'vitest';

const ts = () => new Date().toISOString();

// --- Helpers de siembra -------------------------------------------------------

async function insertUser(email, name, { role = 'user', status = 'active' } = {}) {
  await env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(email, 'hash', name, role, status)
    .run();
  const r = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  return r.id;
}

async function insertProfile(userId, displayName, location) {
  await env.DB.prepare('INSERT INTO seller_profiles (user_id, display_name, location) VALUES (?, ?, ?)')
    .bind(userId, displayName, location)
    .run();
}

async function categoryId(slug) {
  const r = await env.DB.prepare('SELECT id FROM categories WHERE slug = ?').bind(slug).first();
  return r.id;
}

async function insertProduct(
  sellerId,
  categoryId,
  { title, price, location = null, condition = 'used', status = 'active', description = null },
) {
  await env.DB.prepare(
    `INSERT INTO products (seller_id, category_id, title, price, location, condition, status, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(sellerId, categoryId, title, price, location, condition, status, description)
    .run();
  const r = await env.DB.prepare('SELECT id FROM products WHERE title = ?').bind(title).first();
  return r.id;
}

async function insertImage(productId, key, position, isPrimary) {
  await env.DB.prepare(
    'INSERT INTO product_images (product_id, r2_key, position, is_primary) VALUES (?, ?, ?, ?)',
  )
    .bind(productId, key, position, isPrimary ? 1 : 0)
    .run();
}

async function insertTransaction(buyerId, sellerId, productId) {
  await env.DB.prepare('INSERT INTO transactions (buyer_id, seller_id, product_id) VALUES (?, ?, ?)')
    .bind(buyerId, sellerId, productId)
    .run();
  const r = await env.DB.prepare(
    'SELECT id FROM transactions WHERE buyer_id = ? AND seller_id = ? AND product_id = ?',
  )
    .bind(buyerId, sellerId, productId)
    .first();
  return r.id;
}

async function completeTransaction(txId) {
  await env.DB.prepare(
    "UPDATE transactions SET buyer_confirmed_at = ?, seller_confirmed_at = ?, status = 'completed' WHERE id = ?",
  )
    .bind(ts(), ts(), txId)
    .run();
}

async function insertReview(txId, reviewerId, revieweeId, rating, comment = null) {
  await env.DB.prepare(
    'INSERT INTO seller_reviews (transaction_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(txId, reviewerId, revieweeId, rating, comment)
    .run();
  const r = await env.DB.prepare('SELECT id FROM seller_reviews WHERE transaction_id = ?')
    .bind(txId)
    .first();
  return r.id;
}

const ids = {};

beforeAll(async () => {
  ids.sellerA = await insertUser('seller.a@test.com', 'Vendedor A');
  await insertProfile(ids.sellerA, 'Vendedor A', 'Lima');

  ids.sellerB = await insertUser('seller.b@test.com', 'Vendedor B');
  await insertProfile(ids.sellerB, 'Vendedor B', 'Arequipa');

  ids.suspended = await insertUser('suspended@test.com', 'Suspendido', { status: 'suspended' });
  await insertProfile(ids.suspended, 'Vendedor Suspendido', 'Lima');

  ids.buyer = await insertUser('buyer@test.com', 'Comprador');

  ids.catTech = await categoryId('tecnologia');
  ids.catHogar = await categoryId('hogar');
  ids.catDeportes = await categoryId('deportes');

  ids.iphone = await insertProduct(ids.sellerA, ids.catTech, {
    title: 'iPhone 13',
    price: 2500,
    location: 'Lima',
    description: 'celular usado',
  });
  await insertImage(ids.iphone, 'products/1/a.jpg', 0, true);
  await insertImage(ids.iphone, 'products/1/b.jpg', 1, false);

  ids.macbook = await insertProduct(ids.sellerA, ids.catTech, {
    title: 'MacBook Air',
    price: 4000,
    location: 'Lima',
  });
  ids.sofa = await insertProduct(ids.sellerA, ids.catHogar, { title: 'Sofá', price: 800, location: 'Lima' });
  ids.laptopVieja = await insertProduct(ids.sellerA, ids.catTech, {
    title: 'Laptop vieja',
    price: 300,
    status: 'sold',
  });
  ids.bicicleta = await insertProduct(ids.sellerB, ids.catDeportes, {
    title: 'Bicicleta',
    price: 600,
    location: 'Arequipa',
  });
  ids.oculto = await insertProduct(ids.suspended, ids.catTech, {
    title: 'Producto oculto',
    price: 100,
  });

  const tx = await insertTransaction(ids.buyer, ids.sellerA, ids.iphone);
  await completeTransaction(tx);
  ids.review = await insertReview(tx, ids.buyer, ids.sellerA, 5, 'Excelente');
});

async function getJson(path) {
  const res = await SELF.fetch(`https://marketperu.test${path}`);
  const body = await res.json();
  return { res, body };
}

// --- Health -------------------------------------------------------------------

describe('GET /api/health', () => {
  it('responde 200 con estado ok', async () => {
    const { res, body } = await getJson('/api/health');
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.data.service).toBe('marketperu-api');
  });
});

// --- Productos ----------------------------------------------------------------

describe('GET /api/products', () => {
  it('lista productos publicados con paginación', async () => {
    const { res, body } = await getJson('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(4);
    expect(body.meta).toMatchObject({ page: 1, limit: 20, total: 4, totalPages: 1 });
  });

  it('excluye productos no publicados y de vendedores suspendidos', async () => {
    const { body } = await getJson('/api/products');
    const titles = body.data.map((p) => p.title);
    expect(titles).not.toContain('Laptop vieja');
    expect(titles).not.toContain('Producto oculto');
  });

  it('busca por texto', async () => {
    const { body } = await getJson('/api/products?q=iphone');
    expect(body.data.length).toBe(1);
    expect(body.data[0].title).toBe('iPhone 13');
  });

  it('filtra por categoría', async () => {
    const { body } = await getJson(`/api/products?category_id=${ids.catTech}`);
    expect(body.data).toHaveLength(2);
    const titles = body.data.map((p) => p.title);
    expect(titles).toContain('iPhone 13');
    expect(titles).toContain('MacBook Air');
  });

  it('filtra por rango de precio', async () => {
    const { body } = await getJson('/api/products?min_price=1000&max_price=5000');
    expect(body.data).toHaveLength(2);
    const titles = body.data.map((p) => p.title);
    expect(titles).toContain('iPhone 13');
    expect(titles).toContain('MacBook Air');
  });

  it('ordena por precio ascendente', async () => {
    const { body } = await getJson('/api/products?sort=price_asc');
    const prices = body.data.map((p) => p.price);
    expect(prices).toEqual([600, 800, 2500, 4000]);
  });

  it('ordena por precio descendente', async () => {
    const { body } = await getJson('/api/products?sort=price_desc');
    const prices = body.data.map((p) => p.price);
    expect(prices).toEqual([4000, 2500, 800, 600]);
  });

  it('pagina correctamente', async () => {
    const { body } = await getJson('/api/products?limit=2&page=1');
    expect(body.data.length).toBe(2);
    expect(body.meta.total).toBe(4);
    expect(body.meta.totalPages).toBe(2);
  });

  it('devuelve 400 con parámetros inválidos', async () => {
    const { res, body } = await getJson('/api/products?page=0');
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);

    const sort = await getJson('/api/products?sort=invalido');
    expect(sort.res.status).toBe(400);
    expect(sort.body.error.code).toBe('INVALID_SORT');

    const limit = await getJson('/api/products?limit=9999');
    expect(limit.res.status).toBe(400);

    const range = await getJson('/api/products?min_price=100&max_price=10');
    expect(range.res.status).toBe(400);
  });
});

describe('GET /api/products/:id', () => {
  it('devuelve el detalle con imágenes y vendedor', async () => {
    const { res, body } = await getJson(`/api/products/${ids.iphone}`);
    expect(res.status).toBe(200);
    expect(body.data.title).toBe('iPhone 13');
    expect(body.data.currency).toBe('PEN');
    expect(body.data.category.slug).toBe('tecnologia');
    expect(body.data.images.length).toBe(2);
    expect(body.data.seller.id).toBe(ids.sellerA);
    expect(body.data.seller.average_rating).toBe(5);
    expect(body.data.seller.rating_count).toBe(1);
  });

  it('devuelve 404 para producto inexistente', async () => {
    const { res, body } = await getJson('/api/products/99999');
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('devuelve 404 para producto no publicado', async () => {
    const { res } = await getJson(`/api/products/${ids.laptopVieja}`);
    expect(res.status).toBe(404);
  });

  it('devuelve 400 para id inválido', async () => {
    const { res } = await getJson('/api/products/abc');
    expect(res.status).toBe(400);
  });
});

// --- Categorías ---------------------------------------------------------------

describe('GET /api/categories', () => {
  it('lista las categorías', async () => {
    const { res, body } = await getJson('/api/categories');
    expect(res.status).toBe(200);
    expect(body.data.length).toBe(12);
  });
});

describe('GET /api/categories/:id/products', () => {
  it('lista productos de una categoría', async () => {
    const { res, body } = await getJson(`/api/categories/${ids.catTech}/products`);
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    const titles = body.data.map((p) => p.title);
    expect(titles).toContain('iPhone 13');
    expect(titles).toContain('MacBook Air');
  });

  it('devuelve 404 para categoría inexistente', async () => {
    const { res } = await getJson('/api/categories/99999/products');
    expect(res.status).toBe(404);
  });
});

// --- Vendedores ---------------------------------------------------------------

describe('GET /api/sellers/:id', () => {
  it('devuelve el perfil público sin datos privados', async () => {
    const { res, body } = await getJson(`/api/sellers/${ids.sellerA}`);
    expect(res.status).toBe(200);
    expect(body.data.name).toBe('Vendedor A');
    expect(body.data.location).toBe('Lima');
    expect(body.data.average_rating).toBe(5);
    expect(body.data.rating_count).toBe(1);
    expect(body.data.products.items.length).toBe(3);

    const json = JSON.stringify(body.data);
    expect(json).not.toContain('@');
    expect(json).not.toContain('password_hash');
    expect(json).not.toContain('phone');
  });

  it('devuelve 404 para vendedor inexistente', async () => {
    const { res } = await getJson('/api/sellers/99999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/sellers/:id/reviews', () => {
  it('lista las opiniones del vendedor', async () => {
    const { res, body } = await getJson(`/api/sellers/${ids.sellerA}/reviews`);
    expect(res.status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].rating).toBe(5);
    expect(body.data[0].comment).toBe('Excelente');
    expect(body.meta.total).toBe(1);
  });
});

// --- Opiniones ----------------------------------------------------------------

describe('GET /api/reviews/:id', () => {
  it('devuelve una opinión pública', async () => {
    const { res, body } = await getJson(`/api/reviews/${ids.review}`);
    expect(res.status).toBe(200);
    expect(body.data.rating).toBe(5);
    expect(body.data.reviewer.name).toBe('Comprador');
    expect(JSON.stringify(body.data)).not.toContain('password_hash');
  });

  it('devuelve 404 para opinión inexistente', async () => {
    const { res } = await getJson('/api/reviews/99999');
    expect(res.status).toBe(404);
  });
});

// --- Ausencia de información privada ------------------------------------------

describe('privacidad de respuestas', () => {
  it('no expone datos privados en productos ni vendedores', async () => {
    const forbidden = ['password_hash', 'email', 'phone', 'role', 'status', 'token_hash', 'csrf_token'];

    const product = await getJson(`/api/products/${ids.iphone}`);
    const productJson = JSON.stringify(product.body);
    for (const key of forbidden) {
      expect(productJson).not.toContain(key);
    }

    const seller = await getJson(`/api/sellers/${ids.sellerA}`);
    const sellerJson = JSON.stringify(seller.body);
    for (const key of forbidden) {
      expect(sellerJson).not.toContain(key);
    }
  });
});

// --- Rutas privadas (401) -----------------------------------------------------

describe('rutas privadas', () => {
  const cases = [
    ['POST', '/api/products'],
    ['PUT', '/api/products/1'],
    ['DELETE', '/api/products/1'],
    ['GET', '/api/conversations'],
    ['POST', '/api/messages'],
    ['GET', '/api/favorites'],
    ['POST', '/api/favorites'],
    ['GET', '/api/transactions'],
    ['POST', '/api/transactions'],
    ['POST', '/api/reviews'],
  ];

  it.each(cases)('%s %s requiere autenticación', async (method, path) => {
    const res = await SELF.fetch(`https://marketperu.test${path}`, { method });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});

// --- Ruta no encontrada -------------------------------------------------------

describe('rutas inexistentes', () => {
  it('devuelve 404', async () => {
    const { res, body } = await getJson('/api/no-existe');
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
