const cache = new Map();

export function loadResource(path) {
  if (!cache.has(path)) {
    const pending = (async () => {
      const response = await fetch(chrome.runtime.getURL(path));
      if (!response.ok)
        throw new Error(`Packaged resource unavailable: ${path}`);
      return response.json();
    })();
    cache.set(path, pending);
    pending.catch(() => cache.delete(path));
  }
  return cache.get(path);
}
