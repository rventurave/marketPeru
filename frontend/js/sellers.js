// Lógica de vendedores y sus opiniones.

import { api } from './api.js';
import { reviewCard, starRating, productCard, pagination, emptyState } from './components.js';
import { escapeHtml, formatDate } from './ui.js';

export async function fetchSeller(id) {
  return api.get(`/api/sellers/${id}`);
}

export async function fetchSellerReviews(id, { page = 1, limit = 10 } = {}) {
  return api.get(`/api/sellers/${id}/reviews?page=${page}&limit=${limit}`);
}

function ratingBreakdown(reviews) {
  const counts = [0, 0, 0, 0, 0]; // 1..5 estrellas
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) counts[5 - r.rating]++;
  }
  const total = reviews.length || 1;
  return [5, 4, 3, 2, 1]
    .map((star) => {
      const count = counts[5 - star];
      const pct = Math.round((count / total) * 100);
      return `
        <div class="rating-breakdown__row">
          <span>${star} ${star === 1 ? 'estrella' : 'estrellas'}</span>
          <div class="rating-breakdown__bar"><div class="rating-breakdown__fill" style="width:${pct}%"></div></div>
          <span>${count}</span>
        </div>`;
    })
    .join('');
}

export function renderSeller(container, seller) {
  const avatar = seller.avatar_url
    ? `<img src="${escapeHtml(seller.avatar_url)}" alt="">`
    : escapeHtml((seller.name || '?').charAt(0).toUpperCase());

  const products = seller.products?.items || [];

  container.innerHTML = `
    <div class="seller-card" style="margin-bottom: var(--space-5);">
      <div class="seller-card__avatar">${avatar}</div>
      <div>
        <div class="seller-card__name">${escapeHtml(seller.name)}</div>
        <div class="seller-card__meta">${starRating(seller.average_rating, seller.rating_count)}</div>
        ${seller.location ? `<div class="seller-card__meta">${escapeHtml(seller.location)}</div>` : ''}
        <div class="seller-card__meta">Miembro desde ${escapeHtml(formatDate(seller.joined_at))}</div>
      </div>
    </div>
    ${seller.bio ? `<p class="section-subtitle">${escapeHtml(seller.bio)}</p>` : ''}

    <h2 class="section-title">Productos publicados</h2>
    <div class="product-grid">
      ${products.length ? products.map(productCard).join('') : emptyState({ title: 'Sin productos publicados' })}
    </div>`;
}

export function renderReviews(container, data) {
  const reviews = data?.data || [];
  if (reviews.length === 0) {
    container.innerHTML = emptyState({ title: 'Sin opiniones todavía' });
    return;
  }
  container.innerHTML = `
    <div class="rating-breakdown" style="margin-bottom: var(--space-4);">${ratingBreakdown(reviews)}</div>
    <div class="review-list">${reviews.map(reviewCard).join('')}</div>`;
}

export function renderReviewPagination(container, meta, onPageChange) {
  container.innerHTML = pagination(meta);
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
  });
}
