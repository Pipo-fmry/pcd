/* Pont entre la page Pedro (qui attend `window.claude.use('db')`, API façon Firestore)
   et l'API PCD (/api/pedro/*, stockée dans D1). Les écrans et fonctions de la page restent inchangés.
   onSnapshot = premier chargement + rechargement après chaque écriture + rafraîchissement toutes les 20 s. */
(() => {
  const abonnes = { log: new Set(), settings: new Set() };
  let cacheLog = null,
    cacheSettings;

  async function api(chemin, options = {}) {
    const r = await fetch('/api/pedro' + chemin, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (r.status === 401) {
      location.href = '/#accueil';
      throw Object.assign(new Error('Code requis'), { code: 'auth' });
    }
    if (!r.ok) throw Object.assign(new Error('Erreur API'), { code: 'api-' + r.status });
    return r.json();
  }

  async function rafraichir(fromCache = false) {
    try {
      const [log, settings] = await Promise.all([api('/log'), api('/settings')]);
      cacheLog = log;
      cacheSettings = settings;
      publier(fromCache);
    } catch (e) {
      for (const cb of abonnes.log) cb.erreur?.(e);
    }
  }
  function publier(fromCache) {
    if (cacheLog) {
      const snap = { metadata: { fromCache }, docs: cacheLog.map((d) => ({ id: d.id, data: () => d.data })) };
      for (const cb of abonnes.log) cb.ok(snap);
    }
    const s = cacheSettings;
    const snapS = { exists: !!s, data: () => s || {} };
    for (const cb of abonnes.settings) cb.ok(snapS);
  }

  const db = {
    collection(nom) {
      if (nom !== 'log') throw new Error('Collection inconnue : ' + nom);
      return {
        onSnapshot(ok, erreur) {
          const cb = { ok, erreur };
          abonnes.log.add(cb);
          if (cacheLog) publier(true);
          else rafraichir();
          return () => abonnes.log.delete(cb);
        },
        async add(data) {
          const r = await api('/log', { method: 'POST', body: data });
          await rafraichir();
          return { id: r.id };
        },
      };
    },
    doc(chemin) {
      const [col, id] = chemin.split('/');
      if (col === 'log')
        return {
          async delete() {
            await api('/log/' + encodeURIComponent(id), { method: 'DELETE' });
            await rafraichir();
          },
        };
      if (col === 'settings')
        return {
          onSnapshot(ok, erreur) {
            const cb = { ok, erreur };
            abonnes.settings.add(cb);
            if (cacheSettings !== undefined) publier(true);
            else rafraichir();
            return () => abonnes.settings.delete(cb);
          },
          async set(data) {
            await api('/settings/' + encodeURIComponent(id), { method: 'PUT', body: data });
            await rafraichir();
          },
        };
      throw new Error('Document inconnu : ' + chemin);
    },
  };

  window.claude = window.claude || {};
  window.claude.use = async (nom) => {
    if (nom !== 'db') throw new Error('Capacité inconnue');
    return db;
  };
  setInterval(() => {
    if (document.visibilityState === 'visible' && (abonnes.log.size || abonnes.settings.size)) rafraichir();
  }, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cacheLog) rafraichir();
  });
})();
