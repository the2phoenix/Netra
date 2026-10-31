// @ts-check
import { events } from '../core/events.js';
import { intents } from '../input/intents.js';

const MAX_FEED_EVENTS = 200;

/**
 * Event & Alert Feed Component (Bottom Instrument Strip - REQ HUD-04)
 * Keeps up to 200 events, newest first, with UTC timestamps.
 * Clicking any event triggers a camera fly-to.
 */
export class EventFeed {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    this.root = root;
    this.eventsList = [];
    this.isExpanded = false;

    this.element = document.createElement('footer');
    this.element.className = 'hud-event-feed';
    this.element.id = 'hudEventFeed';

    this.element.innerHTML = `
      <div class="feed-header">
        <div class="feed-title">
          <span class="feed-icon">⚡</span>
          <span>EVENT & ALERT FEED</span>
          <span class="feed-count" id="feedEventCount">0</span>
        </div>
        <div class="feed-controls">
          <button class="feed-btn" id="btnToggleFeed" title="Expand / Collapse feed">▲</button>
        </div>
      </div>
      <div class="feed-items" id="feedItemsContainer">
        <div class="feed-empty">No active security or hazard events. Monitoring live...</div>
      </div>
    `;

    this.root.appendChild(this.element);

    this.elContainer = this.element.querySelector('#feedItemsContainer');
    this.elCount = this.element.querySelector('#feedEventCount');
    this.btnToggle = this.element.querySelector('#btnToggleFeed');

    this.setupEvents();
  }

  setupEvents() {
    if (this.btnToggle) {
      this.btnToggle.addEventListener('click', () => {
        this.isExpanded = !this.isExpanded;
        this.element.classList.toggle('expanded', this.isExpanded);
        this.btnToggle.textContent = this.isExpanded ? '▼' : '▲';
      });
    }

    // Subscribe to various alerts across the system
    events.subscribe('feed:alert', (evt) => this.addEvent(evt));
    events.subscribe('squawk:alert', (alert) => {
      this.addEvent({
        type: 'squawk',
        level: 'critical',
        text: `SQUAWK ${alert.squawk} ${alert.callsign} (${alert.lat.toFixed(2)}°, ${alert.lon.toFixed(2)}°)`,
        lat: alert.lat,
        lon: alert.lon,
        height: 1500000,
        time: alert.time,
      });
    });

    events.subscribe('geofence:alert', (alert) => {
      this.addEvent({
        type: 'zone',
        level: 'warn',
        text: alert.message,
        lat: alert.lat,
        lon: alert.lon,
        height: 2500000,
        time: alert.time,
      });
    });

    events.subscribe('quake:new', (q) => {
      this.addEvent({
        type: 'quake',
        level: 'warn',
        text: `QUAKE M${q.mag.toFixed(1)} ${q.place}`,
        lat: q.lat,
        lon: q.lon,
        height: 3500000,
        time: new Date(q.time).toISOString(),
      });
    });

    events.subscribe('feed:state-change', (change) => {
      this.addEvent({
        type: 'system',
        level: change.state === 'stale' ? 'warn' : 'info',
        text: `FEED ${change.feed.toUpperCase()} status: ${change.state.toUpperCase()}`,
        time: new Date().toISOString(),
      });
    });
  }

  /**
   * Adds an event to the feed (newest first, capped at 200).
   *
   * @param {{
   *   type: 'squawk'|'quake'|'fire'|'zone'|'system'|'scan',
   *   level?: 'info'|'warn'|'critical',
   *   text: string,
   *   lat?: number,
   *   lon?: number,
   *   height?: number,
   *   time?: string
   * }} evt
   */
  addEvent(evt) {
    const timeObj = evt.time ? new Date(evt.time) : new Date();
    const timeStr = timeObj.toTimeString().split(' ')[0]; // HH:MM:SS

    const eventRecord = {
      ...evt,
      timeStr,
      level: evt.level || 'info',
    };

    this.eventsList.unshift(eventRecord);
    if (this.eventsList.length > MAX_FEED_EVENTS) {
      this.eventsList.pop();
    }

    this.render();
  }

  render() {
    if (!this.elContainer || !this.elCount) return;

    this.elCount.textContent = String(this.eventsList.length);

    if (this.eventsList.length === 0) {
      this.elContainer.innerHTML = `<div class="feed-empty">No active security or hazard events. Monitoring live...</div>`;
      return;
    }

    this.elContainer.innerHTML = '';

    for (let i = 0; i < this.eventsList.length; i++) {
      const evt = this.eventsList[i];
      const row = document.createElement('div');
      row.className = `feed-item ${evt.level} ${evt.type}`;

      let icon = '•';
      if (evt.type === 'squawk') icon = '🚨';
      else if (evt.type === 'quake') icon = '🌐';
      else if (evt.type === 'zone') icon = '⌖';
      else if (evt.type === 'system') icon = 'ℹ';
      else if (evt.type === 'scan') icon = '📡';

      row.innerHTML = `
        <span class="feed-time">${evt.timeStr}</span>
        <span class="feed-badge-icon">${icon}</span>
        <span class="feed-text">${evt.text}</span>
      `;

      if (typeof evt.lat === 'number' && typeof evt.lon === 'number') {
        row.style.cursor = 'pointer';
        row.title = 'Click to fly to event location';
        row.addEventListener('click', () => {
          intents.emit('FLY_TO', {
            lat: evt.lat,
            lon: evt.lon,
            height: evt.height || 2000000,
          });
        });
      }

      this.elContainer.appendChild(row);
    }
  }
}

