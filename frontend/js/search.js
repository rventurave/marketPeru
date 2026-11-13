// Gestión del estado de búsqueda y filtros en la URL.

export function readFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') || '',
    category_id: params.get('category_id') || '',
    min_price: params.get('min_price') || '',
    max_price: params.get('max_price') || '',
    location: params.get('location') || '',
    sort: params.get('sort') || 'recent',
    page: Number(params.get('page')) || 1,
  };
}

export function writeFilters(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const isDefault =
      (key === 'page' && value === 1) ||
      (key === 'sort' && value === 'recent') ||
      value === '' ||
      value === null ||
      value === undefined;
    if (!isDefault) params.set(key, value);
  }
  const qs = params.toString();
  history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}
