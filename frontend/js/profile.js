// Lógica del perfil personal del usuario autenticado.

import { api, setCsrfToken } from './api.js';
import { getUser } from './auth.js';
import { escapeHtml } from './ui.js';

export function renderProfile(container) {
  const user = getUser();
  if (!user) return;

  const avatar = escapeHtml((user.name || '?').charAt(0).toUpperCase());
  const seller = user.seller_profile;

  container.innerHTML = `
    <div class="card profile-card">
      <div class="profile-card__header">
        <div class="profile-card__avatar" aria-hidden="true">${avatar}</div>
        <div class="profile-card__detail">
          <h1>${escapeHtml(user.name)}</h1>
          <span class="muted">${escapeHtml(user.email)}</span>
          <span class="badge badge--success">${user.status === 'active' ? 'Activo' : escapeHtml(user.status)}</span>
        </div>
      </div>
      <div class="profile-card__detail">
        <span class="muted">Miembro desde: ${escapeHtml(user.created_at ? new Date(user.created_at).toLocaleDateString('es-PE') : '')}</span>
      </div>
    </div>

    <div class="card profile-card" style="margin-top: var(--space-4);">
      <h2 class="section-title">Editar perfil</h2>
      <form id="profile-form">
        <div class="form-group">
          <label class="form-label" for="name">Nombre</label>
          <input class="form-input" id="name" name="name" type="text" value="${escapeHtml(user.name)}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bio">Descripción</label>
          <textarea class="form-input" id="bio" name="bio" rows="3">${escapeHtml(seller?.bio || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="location">Ubicación</label>
          <input class="form-input" id="location" name="location" type="text" value="${escapeHtml(seller?.location || '')}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Guardar cambios</button>
        </div>
      </form>
    </div>`;

  container.querySelector('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = { name: form.get('name'), bio: form.get('bio'), location: form.get('location') };
    const { toast } = await import('./ui.js');
    try {
      const data = await api.patch('/api/users/me', payload, { csrf: true });
      setCsrfToken(data.data.csrf_token);
      toast('Perfil actualizado', 'success');
    } catch (err) {
      toast(err.message || 'No se pudo actualizar el perfil', 'error');
    }
  });
}
