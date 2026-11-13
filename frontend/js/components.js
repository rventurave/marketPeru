// Componentes reutilizables de renderizado (vanilla JS).

import { escapeHtml, formatPrice, formatDate } from './ui.js';
import { R2_PUBLIC_BASE } from './config.js';

const PLACEHOLDER = 'assets/images/placeholder.svg';
const STAR_PATH =
  'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

function starSvg(cls, style = '') {
  return `<svg class="stars__icon ${cls}" viewBox="0 0 24 24" style="${style}" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
}

export function starRating(average, count = null) {
  const rating = Math.max(0, Math.min(5, Number(average) || 0));
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  let html = `<span class="stars" role="img" aria-label="Calificación ${rating.toFixed(1)} de 5">`;
  for (let i = 0; i < full; i++) html += starSvg('');
  if (hasHalf) {
    html += `<span style="position:relative;display:inline-flex;width:1rem;height:1rem;">
      ${starSvg('stars__icon--empty', 'position:absolute;inset:0;')}
      ${starSvg('', 'position:absolute;inset:0;clip-path:inset(0 50% 0 0);')}
    </span>`;
  }
  for (let i = 0; i < empty; i++) html += starSvg('stars__icon--empty');
  html += '</span>';
  if (count !== null && count !== undefined) {
    html += `<span class="stars__count">(${Number(count)})</span>`;
  }
  return html;
}

export function imageUrl(key) {
  if (!key) return null;
  // La URL pública de R2 se configurará al implementar la subida de imágenes.
  if (R2_PUBLIC_BASE) return `${R2_PUBLIC_BASE}/${key}`;
  return null;
}

function renderImage(src, alt) {
  if (src) return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  return `<img src="${PLACEHOLDER}" alt="${escapeHtml(alt || 'Sin imagen')}" loading="lazy">`;
}

export function productCard(product) {
  const img = renderImage(imageUrl(product.primary_image), product.title);
  return `
    <a class="card card--hover product-card" href="product.html?id=${product.id}">
      <div class="product-card__image">${img}</div>
      <div class="product-card__body">
        <span class="product-card__price">${escapeHtml(formatPrice(product.price, product.currency))}</span>
        <span class="product-card__title">${escapeHtml(product.title)}</span>
        <div class="product-card__meta">
          ${product.location ? `<span>${escapeHtml(product.location)}</span>` : ''}
          <span>${product.condition === 'new' ? 'Nuevo' : 'Usado'}</span>
        </div>
        <div class="product-card__seller">
          ${starRating(product.seller?.average_rating, product.seller?.rating_count)}
          <span>${escapeHtml(product.seller?.name || '')}</span>
        </div>
      </div>
    </a>`;
}

export function categoryChip(category) {
  return `<a class="category-chip" href="index.html?category_id=${category.id}">${escapeHtml(category.name)}</a>`;
}

export function reviewCard(review) {
  return `
    <article class="review-card">
      <div class="review-card__header">
        <span class="review-card__reviewer">${escapeHtml(review.reviewer?.name || 'Comprador')}</span>
        <span class="review-card__date">${escapeHtml(formatDate(review.created_at))}</span>
      </div>
      ${starRating(review.rating)}
      ${review.comment ? `<p class="review-card__comment">${escapeHtml(review.comment)}</p>` : ''}
    </article>`;
}

export function sellerCard(seller) {
  const avatar = seller.avatar_url
    ? `<img src="${escapeHtml(seller.avatar_url)}" alt="">`
    : escapeHtml((seller.name || '?').charAt(0).toUpperCase());
  return `
    <div class="seller-card">
      <div class="seller-card__avatar">${avatar}</div>
      <div>
        <div class="seller-card__name">${escapeHtml(seller.name)}</div>
        <div class="seller-card__meta">
          ${starRating(seller.average_rating, seller.rating_count)}
        </div>
      </div>
    </div>`;
}

export function pagination(meta) {
  const { page, totalPages, total } = meta;
  if (totalPages <= 1) return '';
  return `
    <nav class="pagination" aria-label="Paginación">
      <span class="pagination__info">Página ${page} de ${totalPages} · ${total} resultados</span>
      <button type="button" class="btn btn-outline btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
      <button type="button" class="btn btn-outline btn-sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>
    </nav>`;
}

export function emptyState({ title = 'No hay resultados', message = '' } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">&#9679;</div>
      <h3 class="empty-state__title">${escapeHtml(title)}</h3>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    </div>`;
}

export function skeletonGrid(count = 8) {
  return `<div class="product-grid">${'<div class="skeleton skeleton-card"></div>'.repeat(count)}</div>`;
}
