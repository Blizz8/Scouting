/* storageSync.js
 * Client helper to sync localStorage with server-side global storage.
 * Usage:
 *   - Call `storageSync.init()` on page load to pull global storage into localStorage.
 *   - Use `storageSync.setGlobalKey(key, value)` to update server and broadcast.
 *   - Listen for updates: storageSync.onUpdate = ({key, value}) => { ... }
 */

const storageSync = (function () {
  let eventSource = null;
  let onUpdate = null; // user-provided callback

  async function getAll() {
    const res = await fetch('/api/storage');
    if (!res.ok) throw new Error('Failed to fetch global storage');
    return await res.json();
  }

  async function getKey(key) {
    const res = await fetch('/api/storage/' + encodeURIComponent(key));
    if (!res.ok) return null;
    return await res.json();
  }

  async function setKey(key, value) {
    const res = await fetch('/api/storage/' + encodeURIComponent(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    if (!res.ok) throw new Error('Failed to set key');
    return await res.json();
  }

  // Utility to merge server storage into localStorage (doesn't overwrite keys that are already present unless overwrite true)
  async function pullIntoLocal({ overwrite = false } = {}) {
    const globalStorage = await getAll();
    Object.keys(globalStorage).forEach(k => {
      try {
        const v = JSON.stringify(globalStorage[k]);
        if (overwrite || localStorage.getItem(k) === null) {
          localStorage.setItem(k, v);
        }
      } catch (e) {
        console.warn('Failed to set localStorage key', k, e);
      }
    });
    return globalStorage;
  }

  // Push a local key to global storage
  async function pushLocalKey(key) {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    let value;
    try { value = JSON.parse(raw); } catch (e) { value = raw; }
    return await setKey(key, value);
  }

  // Subscribe to server-sent events for live updates
  function subscribeToUpdates() {
    if (eventSource) return eventSource;
    eventSource = new EventSource('/api/stream');
    eventSource.onmessage = function (msg) {
      try {
        const payload = JSON.parse(msg.data);
        if (payload && typeof payload.key === 'string') {
          // update localStorage with new value
          try {
            localStorage.setItem(payload.key, JSON.stringify(payload.value));
          } catch (e) {}
        }
        if (typeof onUpdate === 'function') onUpdate(payload);
      } catch (e) {
        console.warn('Invalid message from server', e);
      }
    };
    eventSource.onerror = function (e) {
      console.warn('SSE connection errored', e);
    };
    return eventSource;
  }

  async function init({ autoPull = true, overwrite = false } = {}) {
    if (autoPull) await pullIntoLocal({ overwrite });
    subscribeToUpdates();
  }

  return {
    init,
    pullIntoLocal,
    pushLocalKey,
    setKey,
    getAll,
    getKey,
    subscribeToUpdates,
    onUpdate: null,
    // convenience: set user callback
    set onUpdateCallback(cb) { onUpdate = cb; },
    get onUpdateCallback() { return onUpdate; }
  };
})();

// Expose on window for pages to use
if (typeof window !== 'undefined') window.storageSync = storageSync;

// If using bundlers or ESM, you can import this file separately and export default.
// We avoid a bare `export` here so the script can be included directly via <script> in browsers.