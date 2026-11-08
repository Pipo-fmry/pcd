// Transforme seed/carnet.json (carnet manuscrit) en seed/carnet.sql, enrichi via TMDB (+ OMDb si clé).
// Usage : TMDB_API_KEY=… [OMDB_API_KEY=…] node scripts/import-carnet.mjs
// Puis : pnpm seed:local (ou pnpm seed pour la prod). Idempotent : INSERT OR IGNORE sur tmdb_id.
import { readFileSync, writeFileSync } from 'node:fs';

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;
if (!TMDB_KEY) {
  console.error('TMDB_API_KEY manquante');
  process.exit(1);
}

const { films } = JSON.parse(readFileSync(new URL('../seed/carnet.json', import.meta.url), 'utf8'));
const IMG = 'https://image.tmdb.org/t/p/w342';
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

async function tmdb(chemin, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + chemin);
  u.searchParams.set('api_key', TMDB_KEY);
  u.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`TMDB ${r.status} ${chemin}`);
  return r.json();
}

async function omdb(imdbId) {
  if (!imdbId || !OMDB_KEY) return {};
  const d = await (await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`)).json();
  if (d.Response === 'False') return {};
  const rt = (d.Ratings || []).find((x) => x.Source === 'Rotten Tomatoes')?.Value;
  return {
    note_imdb: d.imdbRating !== 'N/A' ? +d.imdbRating : null,
    note_metacritic: d.Metascore !== 'N/A' ? +d.Metascore : null,
    note_rt: rt ? parseInt(rt, 10) : null,
  };
}

const lignes = ['-- Généré par scripts/import-carnet.mjs. Ne pas éditer à la main.'];
const introuvables = [];

for (const f of films) {
  // « Titre FR (Titre original) » : on cherche d'abord l'original, plus fiable chez TMDB.
  const m = f.titre.match(/^(.*?)\s*\((.+)\)$/);
  const requetes = m ? [m[2], m[1]] : [f.titre];
  let hit = null;
  for (const r of requetes) {
    for (const year of [f.annee_vu, f.annee_vu - 1, '']) {
      const d = await tmdb('/search/movie', { query: r, year });
      hit = d.results?.[0];
      if (hit) break;
    }
    if (hit) break;
  }
  if (!hit) {
    introuvables.push(f.titre);
    lignes.push(`-- INTROUVABLE : ${f.titre}`);
    continue;
  }

  const d = await tmdb(`/movie/${hit.id}`, { append_to_response: 'credits,videos,external_ids' });
  const real =
    (d.credits?.crew || [])
      .filter((c) => c.job === 'Director')
      .map((c) => c.name)
      .join(', ') || f.realisateur;
  let videos = (d.videos?.results || []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  if (!videos.length)
    videos = ((await tmdb(`/movie/${hit.id}/videos`, { language: 'en-US' })).results || []).filter(
      (v) => v.site === 'YouTube' && v.type === 'Trailer',
    );
  const imdbId = d.external_ids?.imdb_id || null;
  const ext = await omdb(imdbId);
  const acteurs = f.acteurs.length ? f.acteurs : (d.credits?.cast || []).slice(0, 4).map((c) => c.name);

  lignes.push(
    `INSERT OR IGNORE INTO films (tmdb_id, imdb_id, titre, titre_original, annee, realisateur, acteurs, genres, synopsis, duree, affiche_url, trailer_youtube, note_tmdb, note_imdb, note_metacritic, note_rt, statut, ajoute_par, vu_le) VALUES (` +
      [
        d.id,
        imdbId,
        d.title,
        d.original_title,
        d.release_date ? +d.release_date.slice(0, 4) : null,
        real,
        JSON.stringify(acteurs),
        JSON.stringify((d.genres || []).map((g) => g.name)),
        d.overview || null,
        d.runtime || null,
        d.poster_path ? IMG + d.poster_path : null,
        videos[0]?.key || null,
        d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
        ext.note_imdb ?? null,
        ext.note_metacritic ?? null,
        ext.note_rt ?? null,
        'vu',
        'croco',
        `${f.annee_vu}-01-01`,
      ]
        .map(q)
        .join(', ') +
      ');',
  );
  if (f.note != null) {
    lignes.push(
      `INSERT OR IGNORE INTO notes (film_id, personne, note) SELECT id, 'croco', ${f.note} FROM films WHERE tmdb_id = ${d.id};`,
    );
  }
  process.stdout.write(`✓ ${f.titre} → ${d.title} (${d.release_date?.slice(0, 4)})\n`);
}

writeFileSync(new URL('../seed/carnet.sql', import.meta.url), lignes.join('\n') + '\n');
console.log(`\n${films.length - introuvables.length}/${films.length} films → seed/carnet.sql`);
if (introuvables.length) console.log('Introuvables :', introuvables.join(' ; '));
