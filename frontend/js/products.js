// Lógica de productos: catálogo, detalle y paginación.

import { api } from './api.js';
import { productCard, starRating, pagination, emptyState, imageUrl } from './components.js';
import { escapeHtml, formatPrice, formatDate } from './ui.js';
import { R2_PUBLIC_BASE } from './config.js';

const PLACEHOLDER = 'assets/images/placeholder.svg';

export async function fetchProducts(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  }
  const q = qs.toString();
  return api.get(`/api/products${q ? `?${q}` : ''}`);
}

export function renderProductGrid(container, data) {
  const items = data?.data;
  if (!items || items.length === 0) {
    container.innerHTML = emptyState({
      title: 'No se encontraron productos',
      message: 'Prueba con otros filtros o términos de búsqueda.',
    });
    return;
  }
  container.innerHTML = items.map(productCard).join('');
}

export function renderPagination(container, meta, onPageChange) {
  container.innerHTML = pagination(meta);
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
  });
}

export async function fetchProduct(id) {
  return api.get(`/api/products/${id}`);
}

function renderGallery(product) {
  const images = product.images?.length ? product.images : [];
  const mainSrc = images.length ? imageUrl(images[0].key) || PLACEHOLDER : PLACEHOLDER;

  const thumbs = images
    .map(
      (img, i) => `
        <button type="button" class="product-gallery__thumb ${i === 0 ? 'is-active' : ''}" data-index="${i}">
          <img src="${imageUrl(img.key) || PLACEHOLDER}" alt="Fotografía ${i + 1}">
        </button>`,
    )
    .join('');

  return `
    <div class="product-gallery">
      <div class="product-gallery__main">
        <img id="gallery-main" src="${mainSrc}" alt="${escapeHtml(product.title)}">
      </div>
      ${thumbs ? `<div class="product-gallery__thumbs">${thumbs}</div>` : ''}
    </div>`;
}

export function renderProductDetail(container, product) {
  const seller = product.seller || {};
  container.innerHTML = `
    <div class="product-detail">
      ${renderGallery(product)}
      <div>
        <h1 class="product-detail__title">${escapeHtml(product.title)}</h1>
        <div class="product-detail__price">${escapeHtml(formatPrice(product.price, product.currency))}</div>
        ${product.description ? `<p class="product-detail__description">${escapeHtml(product.description)}</p>` : ''}
        <div class="product-detail__info">
          <span>Estado: <strong>${product.condition === 'new' ? 'Nuevo' : 'Usado'}</strong></span>
          ${product.category ? `<span>Categoría: <a href="index.html?category_id=${product.category.id}">${escapeHtml(product.category.name)}</a></span>` : ''}
          ${product.location ? `<span>Ubicación: ${escapeHtml(product.location)}</span>` : ''}
          <span>Publicado: ${escapeHtml(formatDate(product.created_at))}</span>
        </div>
        <div class="seller-card" style="margin-bottom: var(--space-4);">
          <a class="seller-card__avatar" href="seller.html?id=${seller.id}" aria-hidden="true">
            ${escapeHtml((seller.name || '?').charAt(0).toUpperCase())}
          </a>
          <div>
            <a class="seller-card__name" href="seller.html?id=${seller.id}">${escapeHtml(seller.name)}</a>
            <div class="seller-card__meta">${starRating(seller.average_rating, seller.rating_count)}</div>
            ${seller.location ? `<div class="seller-card__meta">${escapeHtml(seller.location)}</div>` : ''}
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="contact-seller">Contactar vendedor</button>
      </div>
    </div>`;

  const galleryMain = container.querySelector('#gallery-main');
  container.querySelectorAll('.product-gallery__thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const index = Number(thumb.dataset.index);
      const img = product.images[index];
      galleryMain.src = imageUrl(img.key) || PLACEHOLDER;
      container.querySelectorAll('.product-gallery__thumb').forEach((t) => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });
}
