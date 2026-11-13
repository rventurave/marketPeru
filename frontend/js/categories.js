// Lógica de categorías.

import { api } from './api.js';
import { categoryChip, emptyState } from './components.js';

export async function fetchCategories() {
  return api.get('/api/categories');
}

export function renderCategories(container, categories) {
  if (!categories || categories.length === 0) {
    container.innerHTML = emptyState({ title: 'No hay categorías disponibles' });
    return;
  }
  container.innerHTML = categories.map(categoryChip).join('');
}
