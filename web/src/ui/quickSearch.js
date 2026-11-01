// @ts-check
import { events } from '../core/events.js';

const CITY_PRESETS = [
  { name: 'Delhi (DEL)', lat: 28.5665, lon: 77.1031, height: 400000 },
  { name: 'Mumbai (BOM)', lat: 19.0896, lon: 72.8656, height: 400000 },
  { name: 'Bengaluru (BLR)', lat: 13.1986, lon: 77.7066, height: 400000 },
  { name: 'Tokyo (HND)', lat: 35.5494, lon: 139.7798, height: 500000 },
  { name: 'London (LHR)', lat: 51.4700, lon: -0.4543, height: 450000 },
  { name: 'New York (JFK)', lat: 40.6398, lon: -73.7789, height: 450000 },
  { name: 'Dubai (DXB)', lat: 25.2532, lon: 55.3657, height: 400000 },
  { name: 'Singapore (SIN)', lat: 1.3644, lon: 103.9915, height: 400000 },
  { name: 'Paris (CDG)', lat: 49.0097, lon: 2.5479, height: 450000 },
  { name: 'Sydney (SYD)', lat: -33.9461, lon: 151.1772, height: 500000 },
];

/**
 * Keyless Quick Search & City Jump Bar (Hotkey: /)
 * Inspired by God's Eye View keyless search & coordinate routing.
 *
 * @param {HTMLElement} root
 */
export function initQuickSearch(root) {
  const container = document.createElement('div');
  container.className = 'quick-search-modal';
  container.id = 'quickSearchModal';
  container.style.display = 'none';

  container.innerHTML = `
    <div class="quick-search-backdrop"></div>
    <div class="quick-search-box">
      <div class="quick-search-header">
        <span class="quick-search-icon">🔍</span>
        <input
          type="text"
          class="quick-search-input"
          id="quickSearchInput"
          placeholder="Search city (Delhi, Tokyo, London) or enter lat, lon..."
          autocomplete="off"
          spellcheck="false"
        />
        <span class="quick-search-kbd">ESC</span>
      </div>
      <div class="quick-search-list" id="quickSearchList"></div>
    </div>
  `;
  root.appendChild(container);

  const modal = container;
  const input = /** @type {HTMLInputElement} */ (container.querySelector('#quickSearchInput'));
  const list = container.querySelector('#quickSearchList');
  const backdrop = container.querySelector('.quick-search-backdrop');

  function openSearch() {
    modal.style.display = 'flex';
    input.value = '';
    renderResults('');
    setTimeout(() => input.focus(), 50);
  }

  function closeSearch() {
    modal.style.display = 'none';
    input.blur();
  }

  if (backdrop) backdrop.addEventListener('click', closeSearch);

  function executeJump(lat, lon, height = 500000) {
    events.emit('camera:jumpTo', { lat, lon, heightM: height });
    closeSearch();
  }

  function renderResults(query) {
    if (!list) return;
    const q = query.trim().toLowerCase();

    // Check if input is lat, lon format (e.g. "28.5, 77.2")
    const coordMatch = q.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        list.innerHTML = `
          <div class="quick-search-item active" data-action="coord" data-lat="${lat}" data-lon="${lon}">
            <span class="qs-badge">COORD</span>
            <span class="qs-title">Fly to coordinates: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°</span>
            <span class="qs-action">ENTER ➔</span>
          </div>
        `;
        return;
      }
    }

    const matches = CITY_PRESETS.filter((c) => c.name.toLowerCase().includes(q));
    if (matches.length === 0) {
      list.innerHTML = `<div class="quick-search-empty">No matching city found. Try "Delhi", "Tokyo", or "lat, lon".</div>`;
      return;
    }

    list.innerHTML = matches
      .map(
        (c, idx) => `
        <div class="quick-search-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
          <span class="qs-badge">CITY</span>
          <span class="qs-title">${c.name}</span>
          <span class="qs-coords">${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°</span>
          <span class="qs-action">JUMP</span>
        </div>
      `
      )
      .join('');

    // Click handler for items
    const items = list.querySelectorAll('.quick-search-item');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        if (action === 'coord') {
          const lat = parseFloat(item.getAttribute('data-lat') || '0');
          const lon = parseFloat(item.getAttribute('data-lon') || '0');
          executeJump(lat, lon, 450000);
        } else {
          const idx = parseInt(item.getAttribute('data-idx') || '0', 10);
          const city = matches[idx];
          if (city) executeJump(city.lat, city.lon, city.height);
        }
      });
    });
  }

  input.addEventListener('input', (e) => {
    // @ts-ignore
    renderResults(e.target.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
    } else if (e.key === 'Enter') {
      const activeItem = list?.querySelector('.quick-search-item.active') || list?.querySelector('.quick-search-item');
      if (activeItem) {
        /** @type {HTMLElement} */ (activeItem).click();
      }
    }
  });

  // Global shortcut: '/' opens search
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
    if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
      e.preventDefault();
      openSearch();
    }
  });

  events.subscribe('quicksearch:open', openSearch);
}
