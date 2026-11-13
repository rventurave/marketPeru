// Barra de navegación y pie de página compartidos.

import { fetchMe, getUser } from './auth.js';
import { escapeHtml } from './ui.js';

export async function renderNavbar(container, { showSearch = false } = {}) {
  await fetchMe();
  const user = getUser();

  const search = showSearch
    ? `
      <form class="search-form navbar__search" id="search-form" role="search">
        <label class="visually-hidden" for="search-input">Buscar productos</label>
        <input class="search-form__input" id="search-input" name="q" type="search"
               placeholder="Buscar productos..." autocomplete="off">
        <button class="search-form__btn" type="submit" aria-label="Buscar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line>
          </svg>
        </button>
      </form>`
    : '';

  const authArea = user
    ? `
      <a class="navbar__link" href="dashboard.html">
        <span class="navbar__avatar" aria-hidden="true">${escapeHtml(user.name.charAt(0).toUpperCase())}</span>
        <span class="navbar__link-label">${escapeHtml(user.name)}</span>
      </a>
      <button class="navbar__link" id="logout-btn" type="button">
        <span class="navbar__link-label">Salir</span>
      </button>`
    : `<a class="btn btn-primary btn-sm" href="login.html">Iniciar sesión</a>`;

  container.innerHTML = `
    <nav class="navbar" aria-label="Navegación principal">
      <div class="container navbar__inner">
        <a class="navbar__brand" href="index.html">
          <svg class="navbar__logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="7" width="18" height="13" rx="2"></rect>
            <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"></path>
          </svg>
          MarketPeru
        </a>
        ${search}
        <div class="navbar__actions">
          <a class="navbar__link" href="publish.html">Publicar</a>
          ${authArea}
        </div>
      </div>
    </nav>`;

  const logoutBtn = container.querySelector('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { logout } = await import('./auth.js');
      await logout();
      window.location.href = 'index.html';
    });
  }

  const searchForm = container.querySelector('#search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = searchForm.querySelector('input[name="q"]');
      const q = input.value.trim();
      window.location.href = `index.html${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    });
  }
}

export function renderFooter(container) {
  container.innerHTML = `
    <footer class="footer">
      <div class="container footer__inner">
        <span>MarketPeru — Marketplace</span>
        <div class="footer__links">
          <a href="index.html">Explorar</a>
          <a href="login.html">Iniciar sesión</a>
          <a href="register.html">Registrarse</a>
        </div>
      </div>
    </footer>`;
}
