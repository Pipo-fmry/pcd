// PCD : Worker Cloudflare = API JSON devant D1 + fichiers statiques (public/).
// Accès protégé par un code PIN partagé (secret PCD_PIN) posé en cookie signé.

const PERSONNES = ['croco', 'dauphin'];
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w342';
const COOKIE = 'pcd_session';
const CACHE_JOURS = 7;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, url);
    } catch (e) {
      console.error(e);
      return json({ erreur: e.message || 'Erreur serveur' }, e.status || 500);
    }
  },
};

/* ---------- Routage ---------- */

async function api(request, env, url) {
  const path = url.pathname.replace(/^\/api/, '');
  const m = request.method;

  if (path === '/login' && m === 'POST') return login(request, env);
  if (path === '/logout' && m === 'POST')
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0` });

  if (!(await estConnecte(request, env))) throw erreur(401, 'Code requis');

  if (path === '/session') return json({ ok: true });
  if (path === '/films' && m === 'GET') return listerFilms(env, url);
  if (path === '/films' && m === 'POST') return ajouterFilm(env, await request.json());
  let r = path.match(/^\/films\/(\d+)$/);
  if (r && m === 'PATCH') return modifierFilm(env, +r[1], await request.json());
  if (r && m === 'DELETE') return supprimerFilm(env, +r[1]);
  r = path.match(/^\/films\/(\d+)\/refresh$/);
  if (r && m === 'POST') return rafraichirFilm(env, +r[1]);
  if (path === '/tmdb/search') return rechercherTmdb(env, url.searchParams.get('q') || '');
  if (path === '/reco' && m === 'GET') return recommander(env, url.searchParams.get('personne') || 'nous');
  if (path === '/reco/refus' && m === 'POST') return refuserReco(env, await request.json());

  // Livres
  if (path === '/livres' && m === 'GET') return listerLivres(env);
  if (path === '/livres' && m === 'POST') return ajouterLivre(env, await request.json());
  if (path === '/livres/recherche') return rechercherLivres(env, url.searchParams.get('q') || '');
  r = path.match(/^\/livres\/(\d+)$/);
  if (r && m === 'PATCH') return modifierLivre(env, +r[1], await request.json());
  if (r && m === 'DELETE') return supprimerLivre(env, +r[1]);
  r = path.match(/^\/livres\/(\d+)\/statut\/(croco|dauphin|pedro)$/);
  if (r && m === 'PUT') return poserStatut(env, +r[1], r[2], await request.json());
  if (r && m === 'DELETE') return retirerStatut(env, +r[1], r[2]);
  r = path.match(/^\/livres\/(\d+)\/achete$/);
  if (r && m === 'POST') return marquerAchete(env, +r[1]);

  // Diversification de Pedro : documents JSON (journal + réglages), voir public/pedro/shim.js.
  if (path === '/pedro/log' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, json FROM pedro_log ORDER BY cree_le, id').all();
    return json(results.map((r) => ({ id: r.id, data: JSON.parse(r.json) })));
  }
  if (path === '/pedro/log' && m === 'POST') {
    const id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await env.DB.prepare('INSERT INTO pedro_log (id, json) VALUES (?,?)')
      .bind(id, JSON.stringify(await request.json()))
      .run();
    return json({ id }, 201);
  }
  r = path.match(/^\/pedro\/log\/([\w-]+)$/);
  if (r && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM pedro_log WHERE id = ?').bind(r[1]).run();
    return json({ ok: true });
  }
  if (path === '/pedro/settings' && m === 'GET') {
    const row = await env.DB.prepare("SELECT json FROM pedro_settings WHERE cle = 'baby'").first();
    return json(row ? JSON.parse(row.json) : null);
  }
  r = path.match(/^\/pedro\/settings\/([\w-]+)$/);
  if (r && m === 'PUT') {
    await env.DB.prepare(
      "INSERT INTO pedro_settings (cle, json, modifie_le) VALUES (?,?,datetime('now')) ON CONFLICT(cle) DO UPDATE SET json = excluded.json, modifie_le = excluded.modifie_le",
    )
      .bind(r[1], JSON.stringify(await request.json()))
      .run();
    return json({ ok: true });
  }
  throw erreur(404, 'Route inconnue');
}

/* ---------- Auth ---------- */

async function login(request, env) {
  const { pin } = await request.json();
  if (!env.PCD_PIN || pin !== env.PCD_PIN) throw erreur(401, 'Mauvais code');
  const jeton = await signer(env.PCD_PIN);
  return json({ ok: true }, 200, {
    'Set-Cookie': `${COOKIE}=${jeton}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`,
  });
}

async function estConnecte(request, env) {
  if (!env.PCD_PIN) return false;
  const cookie = request.headers.get('Cookie') || '';
  const v = cookie
    .split(/;\s*/)
    .find((c) => c.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
  return !!v && v === (await signer(env.PCD_PIN));
}

async function signer(secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('pcd-session-v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- Films ---------- */

async function listerFilms(env, url) {
  const statut = url.searchParams.get('statut');
  const where = statut ? 'WHERE f.statut = ?' : '';
  const { results } = await env.DB.prepare(
    `SELECT f.*,
       (SELECT note FROM notes WHERE film_id = f.id AND personne = 'croco') AS note_croco,
       (SELECT note FROM notes WHERE film_id = f.id AND personne = 'dauphin') AS note_dauphin
     FROM films f ${where}
     ORDER BY COALESCE(f.vu_le, '') DESC, f.cree_le DESC, f.id DESC`,
  )
    .bind(...(statut ? [statut] : []))
    .all();
  return json(results.map(formaterFilm));
}

function formaterFilm(r) {
  return { ...r, acteurs: JSON.parse(r.acteurs || '[]'), genres: JSON.parse(r.genres || '[]') };
}

async function ajouterFilm(env, corps) {
  const statut = corps.statut === 'a_voir' ? 'a_voir' : 'vu';
  let film;
  if (corps.tmdb_id) {
    const existant = await env.DB.prepare('SELECT id FROM films WHERE tmdb_id = ?').bind(corps.tmdb_id).first();
    if (existant) throw erreur(409, 'Ce film est déjà dans la liste');
    film = await detailsTmdb(env, corps.tmdb_id);
  } else {
    if (!corps.titre) throw erreur(400, 'Titre requis');
    film = {
      titre: corps.titre,
      annee: corps.annee || null,
      realisateur: corps.realisateur || null,
      acteurs: corps.acteurs || [],
      genres: [],
    };
  }
  const res = await env.DB.prepare(
    `INSERT INTO films (tmdb_id, imdb_id, titre, titre_original, annee, realisateur, acteurs, genres, synopsis, duree,
       affiche_url, trailer_youtube, note_tmdb, note_imdb, note_metacritic, note_rt, statut, ajoute_par, vu_le)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      film.tmdb_id ?? null,
      film.imdb_id ?? null,
      film.titre,
      film.titre_original ?? null,
      film.annee ?? null,
      film.realisateur ?? null,
      JSON.stringify(film.acteurs || []),
      JSON.stringify(film.genres || []),
      film.synopsis ?? null,
      film.duree ?? null,
      film.affiche_url ?? null,
      film.trailer_youtube ?? null,
      film.note_tmdb ?? null,
      film.note_imdb ?? null,
      film.note_metacritic ?? null,
      film.note_rt ?? null,
      statut,
      PERSONNES.includes(corps.ajoute_par) ? corps.ajoute_par : null,
      statut === 'vu' ? corps.vu_le || new Date().toISOString().slice(0, 10) : null,
    )
    .run();
  const id = res.meta.last_row_id;
  await enregistrerNotes(env, id, corps.notes);
  return json(await lireFilm(env, id), 201);
}

async function modifierFilm(env, id, corps) {
  const film = await env.DB.prepare('SELECT * FROM films WHERE id = ?').bind(id).first();
  if (!film) throw erreur(404, 'Film introuvable');
  const statut = corps.statut === 'a_voir' || corps.statut === 'vu' ? corps.statut : film.statut;
  let vu_le = corps.vu_le !== undefined ? corps.vu_le : film.vu_le;
  if (statut === 'vu' && !vu_le) vu_le = new Date().toISOString().slice(0, 10);
  if (statut === 'a_voir') vu_le = null;
  await env.DB.prepare('UPDATE films SET statut = ?, vu_le = ? WHERE id = ?').bind(statut, vu_le, id).run();
  await enregistrerNotes(env, id, corps.notes);
  return json(await lireFilm(env, id));
}

async function enregistrerNotes(env, filmId, notes) {
  if (!notes) return;
  for (const p of PERSONNES) {
    if (!(p in notes)) continue;
    const n = notes[p];
    if (n === null || n === '' || n === undefined) {
      await env.DB.prepare('DELETE FROM notes WHERE film_id = ? AND personne = ?').bind(filmId, p).run();
    } else {
      const v = Math.max(0, Math.min(5, Math.round(+n)));
      await env.DB.prepare(
        'INSERT INTO notes (film_id, personne, note) VALUES (?,?,?) ON CONFLICT(film_id, personne) DO UPDATE SET note = excluded.note',
      )
        .bind(filmId, p, v)
        .run();
    }
  }
}

async function lireFilm(env, id) {
  const r = await env.DB.prepare(
    `SELECT f.*,
       (SELECT note FROM notes WHERE film_id = f.id AND personne = 'croco') AS note_croco,
       (SELECT note FROM notes WHERE film_id = f.id AND personne = 'dauphin') AS note_dauphin
     FROM films f WHERE f.id = ?`,
  )
    .bind(id)
    .first();
  return formaterFilm(r);
}

async function supprimerFilm(env, id) {
  await env.DB.prepare('DELETE FROM notes WHERE film_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM films WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// Recharge affiche, bande-annonce et notes externes depuis TMDB / OMDb (utile pour les films importés sans tmdb_id).
async function rafraichirFilm(env, id) {
  const film = await env.DB.prepare('SELECT * FROM films WHERE id = ?').bind(id).first();
  if (!film) throw erreur(404, 'Film introuvable');
  let tmdbId = film.tmdb_id;
  if (!tmdbId) {
    const cand = await tmdbGet(env, '/search/movie', {
      query: film.titre_original || film.titre,
      year: film.annee || '',
    });
    tmdbId = cand.results?.[0]?.id;
    if (!tmdbId) throw erreur(404, 'Introuvable sur TMDB');
  }
  const d = await detailsTmdb(env, tmdbId);
  await env.DB.prepare(
    `UPDATE films SET tmdb_id=?, imdb_id=?, titre_original=?, annee=COALESCE(?, annee), realisateur=COALESCE(?, realisateur),
       acteurs=CASE WHEN acteurs='[]' THEN ? ELSE acteurs END, genres=?, synopsis=?, duree=?, affiche_url=?, trailer_youtube=?,
       note_tmdb=?, note_imdb=?, note_metacritic=?, note_rt=? WHERE id=?`,
  )
    .bind(
      d.tmdb_id,
      d.imdb_id,
      d.titre_original,
      d.annee,
      d.realisateur,
      JSON.stringify(d.acteurs),
      JSON.stringify(d.genres),
      d.synopsis,
      d.duree,
      d.affiche_url,
      d.trailer_youtube,
      d.note_tmdb,
      d.note_imdb,
      d.note_metacritic,
      d.note_rt,
      id,
    )
    .run();
  return json(await lireFilm(env, id));
}

/* ---------- TMDB / OMDb ---------- */

async function tmdbGet(env, chemin, params = {}) {
  if (!env.TMDB_API_KEY) throw erreur(503, 'TMDB_API_KEY manquante');
  const u = new URL(TMDB + chemin);
  u.searchParams.set('api_key', env.TMDB_API_KEY);
  u.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw erreur(502, `TMDB ${r.status}`);
  return r.json();
}

async function rechercherTmdb(env, q) {
  if (q.trim().length < 2) return json([]);
  const d = await tmdbGet(env, '/search/movie', { query: q, include_adult: 'false' });
  return json(
    (d.results || []).slice(0, 8).map((f) => ({
      tmdb_id: f.id,
      titre: f.title,
      titre_original: f.original_title,
      annee: f.release_date ? +f.release_date.slice(0, 4) : null,
      affiche_url: f.poster_path ? IMG + f.poster_path : null,
      synopsis: f.overview,
    })),
  );
}

async function detailsTmdb(env, tmdbId) {
  const d = await tmdbGet(env, `/movie/${tmdbId}`, { append_to_response: 'credits,videos,external_ids' });
  const real =
    (d.credits?.crew || [])
      .filter((c) => c.job === 'Director')
      .map((c) => c.name)
      .join(', ') || null;
  let videos = (d.videos?.results || []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  if (!videos.length) {
    const en = await tmdbGet(env, `/movie/${tmdbId}/videos`, { language: 'en-US' });
    videos = (en.results || []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  }
  const imdbId = d.external_ids?.imdb_id || d.imdb_id || null;
  const ext = await notesOmdb(env, imdbId);
  return {
    tmdb_id: d.id,
    imdb_id: imdbId,
    titre: d.title,
    titre_original: d.original_title,
    annee: d.release_date ? +d.release_date.slice(0, 4) : null,
    realisateur: real,
    acteurs: (d.credits?.cast || []).slice(0, 4).map((c) => c.name),
    genres: (d.genres || []).map((g) => g.name),
    synopsis: d.overview || null,
    duree: d.runtime || null,
    affiche_url: d.poster_path ? IMG + d.poster_path : null,
    trailer_youtube: videos[0]?.key || null,
    note_tmdb: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    ...ext,
  };
}

async function notesOmdb(env, imdbId) {
  const vide = { note_imdb: null, note_metacritic: null, note_rt: null };
  if (!imdbId || !env.OMDB_API_KEY) return vide;
  try {
    const r = await fetch(`https://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&i=${imdbId}`);
    const d = await r.json();
    if (d.Response === 'False') return vide;
    const rt = (d.Ratings || []).find((x) => x.Source === 'Rotten Tomatoes')?.Value;
    return {
      note_imdb: d.imdbRating && d.imdbRating !== 'N/A' ? +d.imdbRating : null,
      note_metacritic: d.Metascore && d.Metascore !== 'N/A' ? +d.Metascore : null,
      note_rt: rt ? parseInt(rt, 10) : null,
    };
  } catch {
    return vide;
  }
}

/* ---------- Recommandations ----------
   Pour une personne : ses films notés ≥ 4 servent de graines ; TMDB donne les films proches de chaque graine ;
   un candidat marque d'autant plus qu'il revient souvent, que la graine était bien notée et que ses genres
   ressemblent à ceux que la personne aime. On retire les films vus, à voir, ou refusés.
   « nous » : somme des deux scores quand les deux sont positifs (repli sur Croco si Dauphin n'a rien noté). */

async function recommander(env, personne) {
  const cibles = personne === 'nous' ? PERSONNES : [personne];
  if (!cibles.every((p) => PERSONNES.includes(p))) throw erreur(400, 'Personne inconnue');

  const { results: films } = await env.DB.prepare(
    `SELECT f.id, f.tmdb_id, f.titre, f.genres,
       (SELECT note FROM notes WHERE film_id = f.id AND personne = 'croco') AS note_croco,
       (SELECT note FROM notes WHERE film_id = f.id AND personne = 'dauphin') AS note_dauphin
     FROM films f`,
  ).all();
  const connus = new Set(films.map((f) => f.tmdb_id).filter(Boolean));
  const { results: refus } = await env.DB.prepare('SELECT tmdb_id, personne FROM reco_refus').all();

  const parPersonne = {};
  for (const p of cibles) {
    const notes = films.filter((f) => f[`note_${p}`] != null);
    if (!notes.length) continue;
    const affGenres = affiniteGenres(notes, p);
    const graines = notes
      .filter((f) => f.tmdb_id && f[`note_${p}`] >= 4)
      .sort((a, b) => b.id - a.id)
      .slice(0, 12);
    const scores = new Map();
    for (const g of graines) {
      const voisins = await recosTmdbCache(env, g.tmdb_id);
      const poids = g[`note_${p}`] - 2.5; // 1.5 pour un 4, 2.5 pour un 5
      for (const v of voisins) {
        if (connus.has(v.id)) continue;
        if (refus.some((r) => r.tmdb_id === v.id && r.personne === p)) continue;
        const bonusGenre = (v.genre_ids || []).reduce((s, gid) => s + (affGenres[gid] || 0), 0);
        const e = scores.get(v.id) || { film: v, score: 0, raisons: [] };
        e.score += poids * (1 + bonusGenre) * Math.min(1.2, (v.vote_average || 6) / 6.5);
        if (!e.raisons.includes(g.titre)) e.raisons.push(g.titre);
        scores.set(v.id, e);
      }
    }
    parPersonne[p] = scores;
  }

  let fusion;
  if (personne === 'nous') {
    const a = parPersonne.croco,
      b = parPersonne.dauphin;
    if (a && b) {
      fusion = new Map();
      for (const [id, e] of a) {
        const f = b.get(id);
        if (f && f.score > 0 && e.score > 0)
          fusion.set(id, {
            film: e.film,
            score: e.score + f.score,
            raisons: [...new Set([...e.raisons, ...f.raisons])],
          });
      }
    } else fusion = a || b || new Map();
  } else fusion = parPersonne[personne] || new Map();

  const top = [...fusion.values()].sort((x, y) => y.score - x.score).slice(0, 12);
  return json(
    top.map(({ film, raisons }) => ({
      tmdb_id: film.id,
      titre: film.title,
      annee: film.release_date ? +film.release_date.slice(0, 4) : null,
      affiche_url: film.poster_path ? IMG + film.poster_path : null,
      note_tmdb: film.vote_average ? Math.round(film.vote_average * 10) / 10 : null,
      synopsis: film.overview,
      parce_que: raisons.slice(0, 2),
    })),
  );
}

// Affinité par genre TMDB : moyenne des écarts (note − 2.5) sur les films notés, bornée.
function affiniteGenres(films, p) {
  const acc = {};
  for (const f of films) {
    const ecart = (f[`note_${p}`] - 2.5) / 2.5;
    for (const nom of JSON.parse(f.genres || '[]')) {
      const gid = GENRE_IDS[nom];
      if (!gid) continue;
      (acc[gid] ||= []).push(ecart);
    }
  }
  const out = {};
  for (const [gid, arr] of Object.entries(acc))
    out[gid] = Math.max(-0.5, Math.min(0.5, arr.reduce((s, x) => s + x, 0) / arr.length)) * Math.min(1, arr.length / 3);
  return out;
}

const GENRE_IDS = {
  Action: 28,
  Aventure: 12,
  Animation: 16,
  Comédie: 35,
  Crime: 80,
  Documentaire: 99,
  Drame: 18,
  Familial: 10751,
  Fantastique: 14,
  Histoire: 36,
  Horreur: 27,
  Musique: 10402,
  Mystère: 9648,
  Romance: 10749,
  'Science-Fiction': 878,
  Téléfilm: 10770,
  Thriller: 53,
  Guerre: 10752,
  Western: 37,
};

async function recosTmdbCache(env, tmdbId) {
  const cle = `reco:${tmdbId}`;
  const c = await env.DB.prepare(`SELECT json FROM tmdb_cache WHERE cle = ? AND recupere_le > datetime('now', ?)`)
    .bind(cle, `-${CACHE_JOURS} days`)
    .first();
  if (c) return JSON.parse(c.json);
  const d = await tmdbGet(env, `/movie/${tmdbId}/recommendations`);
  const voisins = (d.results || [])
    .slice(0, 20)
    .map(({ id, title, release_date, poster_path, vote_average, genre_ids, overview }) => ({
      id,
      title,
      release_date,
      poster_path,
      vote_average,
      genre_ids,
      overview,
    }));
  await env.DB.prepare(
    `INSERT INTO tmdb_cache (cle, json, recupere_le) VALUES (?,?,datetime('now')) ON CONFLICT(cle) DO UPDATE SET json = excluded.json, recupere_le = excluded.recupere_le`,
  )
    .bind(cle, JSON.stringify(voisins))
    .run();
  return voisins;
}

async function refuserReco(env, { tmdb_id, personne }) {
  const cibles = personne === 'nous' ? PERSONNES : [personne];
  if (!tmdb_id || !cibles.every((p) => PERSONNES.includes(p))) throw erreur(400, 'Paramètres invalides');
  for (const p of cibles)
    await env.DB.prepare('INSERT OR IGNORE INTO reco_refus (tmdb_id, personne) VALUES (?,?)').bind(tmdb_id, p).run();
  return json({ ok: true });
}

/* ---------- Livres ---------- */

const LIVRE_CHAMPS = [
  'titre',
  'auteur',
  'isbn',
  'isbn13',
  'genre',
  'editeur',
  'pages',
  'annee',
  'type',
  'version',
  'culte',
  'reference',
  'resume',
  'note_exemplaire',
  'notes',
  'couverture_url',
];
const STATUTS_LIVRE = ['a_acheter', 'a_lire', 'en_cours', 'lu'];

const SQL_LIVRE = `SELECT l.*,
  (SELECT json_group_array(json_object('personne', s.personne, 'statut', s.statut, 'note', s.note, 'annee_lu', s.annee_lu, 'commentaire', s.commentaire))
     FROM livre_statuts s WHERE s.livre_id = l.id) AS statuts
  FROM livres l`;

function formaterLivre(r) {
  return { ...r, statuts: JSON.parse(r.statuts || '[]') };
}

async function listerLivres(env) {
  const { results } = await env.DB.prepare(`${SQL_LIVRE} ORDER BY l.id DESC`).all();
  return json(results.map(formaterLivre));
}

async function lireLivre(env, id) {
  const r = await env.DB.prepare(`${SQL_LIVRE} WHERE l.id = ?`).bind(id).first();
  if (!r) throw erreur(404, 'Livre inconnu');
  return formaterLivre(r);
}

function nettoyerLivre(corps) {
  const l = {};
  for (const c of LIVRE_CHAMPS) {
    if (!(c in corps)) continue;
    let v = corps[c];
    if (typeof v === 'string') v = v.trim() || null;
    if (['pages', 'annee'].includes(c)) v = v == null || v === '' ? null : Number(v) || null;
    if (['culte', 'reference'].includes(c)) v = v ? 1 : 0;
    if (c === 'type' && v && !['fiction', 'essai', 'reference'].includes(v)) throw erreur(400, 'Type inconnu');
    l[c] = v;
  }
  return l;
}

// corps : les champs du livre + éventuellement `statut: { personne, statut, note, annee_lu, commentaire }`.
async function ajouterLivre(env, corps) {
  const l = nettoyerLivre(corps);
  if (!l.titre) throw erreur(400, 'Titre requis');
  const cols = Object.keys(l);
  const r = await env.DB.prepare(
    `INSERT INTO livres (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING id`,
  )
    .bind(...cols.map((c) => l[c]))
    .first();
  if (corps.statut?.personne) await upsertStatut(env, r.id, corps.statut.personne, corps.statut);
  return json(await lireLivre(env, r.id), 201);
}

async function modifierLivre(env, id, corps) {
  const l = nettoyerLivre(corps);
  const cols = Object.keys(l);
  if (cols.length) {
    await env.DB.prepare(
      `UPDATE livres SET ${cols.map((c) => `${c} = ?`).join(', ')}, modifie_le = datetime('now') WHERE id = ?`,
    )
      .bind(...cols.map((c) => l[c]), id)
      .run();
  }
  return json(await lireLivre(env, id));
}

async function supprimerLivre(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM livre_statuts WHERE livre_id = ?').bind(id),
    env.DB.prepare('DELETE FROM livres WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

async function upsertStatut(env, livreId, personne, s) {
  if (!['croco', 'dauphin', 'pedro'].includes(personne)) throw erreur(400, 'Personne inconnue');
  if (!STATUTS_LIVRE.includes(s.statut)) throw erreur(400, 'Statut inconnu');
  const note = s.statut === 'lu' && s.note >= 1 && s.note <= 5 ? Math.round(s.note) : null;
  const annee = s.statut === 'lu' && s.annee_lu ? Number(s.annee_lu) || null : null;
  await env.DB.prepare(
    `INSERT INTO livre_statuts (livre_id, personne, statut, note, annee_lu, commentaire, modifie_le)
     VALUES (?,?,?,?,?,?,datetime('now'))
     ON CONFLICT(livre_id, personne) DO UPDATE SET statut = excluded.statut, note = excluded.note,
       annee_lu = excluded.annee_lu, commentaire = excluded.commentaire, modifie_le = excluded.modifie_le`,
  )
    .bind(livreId, personne, s.statut, note, annee, (s.commentaire || '').trim().slice(0, 1000) || null)
    .run();
}

async function poserStatut(env, id, personne, corps) {
  await upsertStatut(env, id, personne, corps);
  return json(await lireLivre(env, id));
}

async function retirerStatut(env, id, personne) {
  await env.DB.prepare('DELETE FROM livre_statuts WHERE livre_id = ? AND personne = ?').bind(id, personne).run();
  return json(await lireLivre(env, id));
}

// « Acheté » : tout le monde qui voulait l'acheter passe en « à lire ».
async function marquerAchete(env, id) {
  await env.DB.prepare(
    "UPDATE livre_statuts SET statut = 'a_lire', modifie_le = datetime('now') WHERE livre_id = ? AND statut = 'a_acheter'",
  )
    .bind(id)
    .run();
  return json(await lireLivre(env, id));
}

// Recherche en ligne : Open Library puis Google Books, sans clé. Éditions françaises d'abord, doublons retirés.
async function rechercherLivres(env, q) {
  q = q.trim();
  if (q.length < 2) return json([]);
  const cle = `livres:${q.toLowerCase()}`;
  const cache = await env.DB.prepare(
    `SELECT json FROM tmdb_cache WHERE cle = ? AND recupere_le > datetime('now', '-${CACHE_JOURS} days')`,
  )
    .bind(cle)
    .first();
  if (cache) return json(JSON.parse(cache.json));

  const [ol, gb] = await Promise.all([openLibrary(q), googleBooks(q)]);
  const vus = new Set();
  const out = [];
  for (const r of [...ol, ...gb]) {
    const k = r.isbn13 || `${normaliser(r.titre)}|${normaliser((r.auteur || '').split(/[ ,]/)[0])}`;
    if (vus.has(k)) continue;
    vus.add(k);
    out.push(r);
  }
  out.sort((a, b) => (b.fr ? 1 : 0) - (a.fr ? 1 : 0));
  const res = out.slice(0, 12);
  await env.DB.prepare(
    "INSERT INTO tmdb_cache (cle, json, recupere_le) VALUES (?,?,datetime('now')) ON CONFLICT(cle) DO UPDATE SET json = excluded.json, recupere_le = excluded.recupere_le",
  )
    .bind(cle, JSON.stringify(res))
    .run();
  return json(res);
}

async function openLibrary(q) {
  try {
    const u = new URL('https://openlibrary.org/search.json');
    u.searchParams.set('q', q);
    u.searchParams.set('limit', '10');
    u.searchParams.set(
      'fields',
      'title,author_name,first_publish_year,isbn,cover_i,publisher,number_of_pages_median,language',
    );
    const r = await fetch(u, { headers: { 'User-Agent': 'PCD (site perso)' } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.docs || []).map((x) => {
      const isbn13 = (x.isbn || []).find((i) => i.length === 13) || null;
      return {
        source: 'Open Library',
        titre: x.title,
        auteur: (x.author_name || []).slice(0, 2).join(', ') || null,
        annee: x.first_publish_year || null,
        isbn13,
        isbn: (x.isbn || []).find((i) => i.length === 10) || null,
        editeur: (x.publisher || [])[0] || null,
        pages: x.number_of_pages_median || null,
        couverture_url: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg` : null,
        resume: null,
        fr: (x.language || []).includes('fre'),
      };
    });
  } catch {
    return [];
  }
}

async function googleBooks(q) {
  try {
    const u = new URL('https://www.googleapis.com/books/v1/volumes');
    u.searchParams.set('q', q);
    u.searchParams.set('maxResults', '10');
    u.searchParams.set('langRestrict', 'fr');
    u.searchParams.set('printType', 'books');
    const r = await fetch(u);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || []).map(({ volumeInfo: v }) => {
      const ids = v.industryIdentifiers || [];
      return {
        source: 'Google Books',
        titre: v.title + (v.subtitle ? ` : ${v.subtitle}` : ''),
        auteur: (v.authors || []).slice(0, 2).join(', ') || null,
        annee: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) || null : null,
        isbn13: ids.find((i) => i.type === 'ISBN_13')?.identifier || null,
        isbn: ids.find((i) => i.type === 'ISBN_10')?.identifier || null,
        editeur: v.publisher || null,
        pages: v.pageCount || null,
        couverture_url: v.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
        resume: v.description ? v.description.slice(0, 600) : null,
        fr: v.language === 'fr',
      };
    });
  } catch {
    return [];
  }
}

function normaliser(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(le|la|les|l|un|une|des|du|de|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- Utilitaires ---------- */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function erreur(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
