// @ts-check
import { events } from '../core/events.js';

export const TACTICAL_LANDMARKS = [
  { name: 'Statue of Liberty (New York)', type: 'MONUMENT', lat: 40.6892, lon: -74.0445, height: 750, pitch: -35, heading: 35 },
  { name: 'Tokyo Tower (Tokyo)', type: 'MONUMENT', lat: 35.6586, lon: 139.7454, height: 600, pitch: -35, heading: 45 },
  { name: 'India Gate (New Delhi)', type: 'MONUMENT', lat: 28.6129, lon: 77.2295, height: 600, pitch: -35, heading: 0 },
  { name: 'Eiffel Tower (Paris)', type: 'MONUMENT', lat: 48.8584, lon: 2.2945, height: 700, pitch: -35, heading: 135 },
  { name: 'Taj Mahal (Agra)', type: 'MONUMENT', lat: 27.1751, lon: 78.0421, height: 500, pitch: -30, heading: 180 },
  { name: 'Burj Khalifa (Dubai)', type: 'MONUMENT', lat: 25.1972, lon: 55.2744, height: 1200, pitch: -30, heading: 60 },
  { name: 'Sydney Opera House (Sydney)', type: 'MONUMENT', lat: -33.8568, lon: 151.2153, height: 600, pitch: -35, heading: 200 },
  { name: 'Colosseum (Rome)', type: 'MONUMENT', lat: 41.8902, lon: 12.4922, height: 500, pitch: -35, heading: 90 },
  { name: 'Golden Gate Bridge (San Francisco)', type: 'LANDMARK', lat: 37.8199, lon: -122.4783, height: 900, pitch: -30, heading: 330 },
  { name: 'Pyramids of Giza (Cairo)', type: 'LANDMARK', lat: 29.9792, lon: 31.1342, height: 1000, pitch: -35, heading: 45 },
  { name: 'White House (Washington DC)', type: 'GOV', lat: 38.8977, lon: -77.0365, height: 600, pitch: -35, heading: 0 },
  { name: 'Gateway of India (Mumbai)', type: 'MONUMENT', lat: 18.9220, lon: 72.8347, height: 500, pitch: -35, heading: 45 },
  { name: 'Big Ben & Westminster (London)', type: 'MONUMENT', lat: 51.5007, lon: -0.1246, height: 600, pitch: -35, heading: 120 },
  { name: 'Delhi NCR Hub (DEL)', type: 'CITY', lat: 28.5665, lon: 77.1031, height: 40000, pitch: -45, heading: 0 },
  { name: 'Mumbai Metropolitan (BOM)', type: 'CITY', lat: 19.0896, lon: 72.8656, height: 40000, pitch: -45, heading: 0 },
  { name: 'Tokyo Bay (HND)', type: 'CITY', lat: 35.5494, lon: 139.7798, height: 50000, pitch: -45, heading: 0 },
  { name: 'New York JFK Hub', type: 'CITY', lat: 40.6398, lon: -73.7789, height: 45000, pitch: -45, heading: 0 },
  { name: 'London Heathrow (LHR)', type: 'CITY', lat: 51.4700, lon: -0.4543, height: 45000, pitch: -45, heading: 0 },
];

/**
 * Keyless Global Search & 3D Landmark Navigation Bar (Hotkey: /)
 * Searches monuments, landmarks, cities, or coordinates worldwide using live Nominatim geocoding.
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
          placeholder="Search destination, monument, or coordinates (e.g. Statue of Liberty, Tokyo Tower, India Gate)..."
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

  let debounceTimer = null;

  function openSearch() {
    modal.style.display = 'flex';
    input.value = '';
    renderPresets('');
    setTimeout(() => input.focus(), 50);
  }

  function closeSearch() {
    modal.style.display = 'none';
    input.blur();
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  if (backdrop) backdrop.addEventListener('click', closeSearch);

  function executeJump(lat, lon, height = 800, pitch = -35.0, heading = 0.0) {
    events.emit('camera:jumpTo', {
      lat,
      lon,
      heightM: height,
      pitchDeg: pitch,
      headingDeg: heading,
    });
    closeSearch();
  }

  function renderPresets(query) {
    if (!list) return;
    const q = query.trim().toLowerCase();

    // Check if input is lat, lon format
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
        bindClickEvents();
        return;
      }
    }

    const matches = q
      ? TACTICAL_LANDMARKS.filter((c) => c.name.toLowerCase().includes(q))
      : TACTICAL_LANDMARKS.slice(0, 8);

    if (matches.length > 0) {
      list.innerHTML = matches
        .map(
          (c, idx) => `
          <div class="quick-search-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}" data-lat="${c.lat}" data-lon="${c.lon}" data-height="${c.height}" data-pitch="${c.pitch || -35}" data-heading="${c.heading || 0}">
            <span class="qs-badge" style="color:#00F0FF;border-color:rgba(0,240,255,0.4)">${c.type}</span>
            <span class="qs-title">${c.name}</span>
            <span class="qs-coords">${c.lat.toFixed(3)}°, ${c.lon.toFixed(3)}°</span>
            <span class="qs-action">3D JUMP ➔</span>
          </div>
        `
        )
        .join('');
      bindClickEvents();
    } else {
      list.innerHTML = `
        <div class="quick-search-loading" style="padding:16px;text-align:center;color:#94A3B8;font-family:'JetBrains Mono',monospace;font-size:11px;">
          Searching global OpenStreetMap registry for "${query}"...
        </div>
      `;
      // Query OpenStreetMap Nominatim for any worldwide monument or place
      queryNominatim(query);
    }
  }

  async function queryNominatim(q) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6`);
      if (!res.ok) throw new Error('Geocoding response error');
      const data = await res.json();
      if (!list) return;

      if (!data || data.length === 0) {
        list.innerHTML = `<div class="quick-search-empty" style="padding:16px;text-align:center;color:#94A3B8;">No global destination found for "${q}". Try "Statue of Liberty", "Tokyo Tower", or "lat, lon".</div>`;
        return;
      }

      list.innerHTML = data
        .map((item, idx) => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const badge = (item.type || 'LANDMARK').toUpperCase().substring(0, 8);
          return `
            <div class="quick-search-item ${idx === 0 ? 'active' : ''}" data-lat="${lat}" data-lon="${lon}" data-height="1200" data-pitch="-35" data-heading="0">
              <span class="qs-badge" style="color:#34D399;border-color:rgba(52,211,153,0.4)">${badge}</span>
              <span class="qs-title">${item.display_name.split(',').slice(0, 3).join(',')}</span>
              <span class="qs-coords">${lat.toFixed(3)}°, ${lon.toFixed(3)}°</span>
              <span class="qs-action">3D JUMP ➔</span>
            </div>
          `;
        })
        .join('');

      bindClickEvents();
    } catch (err) {
      if (list) {
        list.innerHTML = `<div class="quick-search-empty" style="padding:16px;text-align:center;color:#94A3B8;">Geocoding offline. Select from tactical presets above.</div>`;
      }
    }
  }

  function bindClickEvents() {
    if (!list) return;
    const items = list.querySelectorAll('.quick-search-item');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        const lat = parseFloat(item.getAttribute('data-lat') || '0');
        const lon = parseFloat(item.getAttribute('data-lon') || '0');
        const height = parseFloat(item.getAttribute('data-height') || '1000');
        const pitch = parseFloat(item.getAttribute('data-pitch') || '-35');
        const heading = parseFloat(item.getAttribute('data-heading') || '0');
        executeJump(lat, lon, height, pitch, heading);
      });
    });
  }

  input.addEventListener('input', (e) => {
    // @ts-ignore
    const val = e.target.value;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderPresets(val);
    }, 250);
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
