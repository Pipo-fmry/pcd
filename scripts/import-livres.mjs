// Génère seed/livres.sql à partir de :
//  - seed/livres/export-complet.json : la bibliothèque de Morgane (export Turso : books + statuses)
//  - seed/livres/goodreads-croco.csv : l'export Goodreads de Croco
// Puis : pnpm wrangler d1 execute pcd --local --file seed/livres.sql (ou --remote pour la prod).
// Idempotent : INSERT OR IGNORE avec des identifiants fixes. Les fichiers sources ne sont pas versionnés (données perso).
import fs from 'node:fs';

const PERSONNES = { Morgane: 'dauphin', François: 'croco', Pedro: 'pedro' };
const STATUTS = { to_buy: 'a_acheter', to_read: 'a_lire', read: 'lu' };
const SHELVES = { read: 'lu', 'to-read': 'a_lire', 'currently-reading': 'en_cours' };

const q = (v) =>
  v == null || v === '' ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const normaliser = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(le|la|les|l|un|une|des|du|de|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const nomFamille = (a) =>
  normaliser(
    String(a || '')
      .split(',')[0]
      .trim()
      .split(' ')
      .pop(),
  );
const cleLivre = (l) => (l.isbn13 ? `i:${l.isbn13}` : `t:${normaliser(l.titre)}|${nomFamille(l.auteur)}`);

const lignes = ['-- Généré par scripts/import-livres.mjs. Ne pas éditer à la main.'];
const insererLivre = (l) =>
  lignes.push(
    `INSERT OR IGNORE INTO livres (id, titre, auteur, isbn, isbn13, genre, editeur, pages, annee, type, version, culte, reference, resume, note_exemplaire, notes, couverture_url) VALUES (${[
      l.id,
      l.titre,
      l.auteur,
      l.isbn,
      l.isbn13,
      l.genre,
      l.editeur,
      l.pages,
      l.annee,
      l.type,
      l.version,
      l.culte ? 1 : 0,
      l.reference ? 1 : 0,
      l.resume,
      l.note_exemplaire,
      l.notes,
      l.couverture_url,
    ]
      .map(q)
      .join(', ')});`,
  );
const insererStatut = (s) =>
  lignes.push(
    `INSERT OR IGNORE INTO livre_statuts (livre_id, personne, statut, note, annee_lu, commentaire) VALUES (${[
      s.livre_id,
      s.personne,
      s.statut,
      s.note,
      s.annee_lu,
      s.commentaire,
    ]
      .map(q)
      .join(', ')});`,
  );

/* ---- 1. Bibliothèque de Morgane ---- */
const exp = JSON.parse(fs.readFileSync('seed/livres/export-complet.json', 'utf8'));
const index = new Map(); // clé de dédoublonnage → id
let nbStatuts = 0;
for (const b of exp.books) {
  const l = {
    id: b.id,
    titre: b.title,
    auteur: b.author === 'Auteur inconnu' ? null : b.author,
    isbn: b.isbn || null,
    isbn13: b.isbn13 || null,
    genre: b.genre || null,
    editeur: b.publisher || null,
    pages: b.pages || null,
    annee: b.year_published || null,
    type: b.type || null,
    version: b.version || null,
    culte: b.culte,
    reference: b.status === 'reference' || b.type === 'reference',
    resume: b.summary || null,
    note_exemplaire: b.owned_copy_note || null,
    notes: b.notes || null,
    couverture_url: null,
  };
  insererLivre(l);
  index.set(cleLivre(l), l.id);
  for (const s of b.statuses || []) {
    if (!PERSONNES[s.person] || !STATUTS[s.status]) continue;
    insererStatut({
      livre_id: b.id,
      personne: PERSONNES[s.person],
      statut: STATUTS[s.status],
      note: STATUTS[s.status] === 'lu' && s.rating ? s.rating : null,
      annee_lu: STATUTS[s.status] === 'lu' && s.date_read ? Number(String(s.date_read).slice(0, 4)) || null : null,
      commentaire: s.notes || null,
    });
    nbStatuts++;
  }
}
console.log(`Morgane : ${exp.books.length} livres, ${nbStatuts} statuts`);

/* ---- 2. Goodreads de Croco ---- */
function csv(texte) {
  const rows = [];
  let row = [];
  let cell = '';
  let guill = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guill) {
      if (c === '"' && texte[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') guill = false;
      else cell += c;
    } else if (c === '"') guill = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [tete, ...corps] = rows;
  return corps.filter((r) => r.length > 1).map((r) => Object.fromEntries(tete.map((h, i) => [h, r[i] ?? ''])));
}
const isbnPropre = (v) =>
  (v || '')
    .replace(/^="?|"?$/g, '')
    .replace(/"/g, '')
    .trim() || null;
const annee = (d) => (d ? Number(d.slice(0, 4)) || null : null);

const gr = csv(fs.readFileSync('seed/livres/goodreads-croco.csv', 'utf8'));
let prochainId = 10000;
let nouveaux = 0;
let fusionnes = 0;
for (const r of gr) {
  const statut = SHELVES[r['Exclusive Shelf']];
  if (!statut) continue;
  const titre = r.Title.replace(/\s*\((French|English) Edition\)\s*/i, '').trim();
  const l = {
    titre,
    auteur: r.Author.replace(/\s+/g, ' ').trim() || null,
    isbn: isbnPropre(r.ISBN),
    isbn13: isbnPropre(r.ISBN13),
    editeur: r.Publisher || null,
    pages: Number(r['Number of Pages']) || null,
    annee: Number(r['Original Publication Year']) || Number(r['Year Published']) || null,
    type: null,
    genre: null,
    version: /kindle|ebook/i.test(r.Binding) ? 'numerique' : r.Binding ? 'papier' : null,
    culte: 0,
    reference: 0,
    resume: null,
    note_exemplaire: null,
    notes: null,
    couverture_url: null,
  };
  let id = index.get(cleLivre(l)) || index.get(`t:${normaliser(l.titre)}|${nomFamille(l.auteur)}`);
  if (id) fusionnes++;
  else {
    id = prochainId++;
    l.id = id;
    insererLivre(l);
    index.set(cleLivre(l), id);
    nouveaux++;
  }
  const note = Number(r['My Rating']) || null;
  insererStatut({
    livre_id: id,
    personne: 'croco',
    statut,
    note: statut === 'lu' ? note : null,
    annee_lu: statut === 'lu' ? annee(r['Date Read']) || annee(r['Date Added']) : null,
    commentaire: r['My Review'] || null,
  });
}
console.log(
  `Croco : ${gr.length} lignes Goodreads → ${nouveaux} nouveaux livres, ${fusionnes} fusionnés avec la bibliothèque`,
);

fs.writeFileSync('seed/livres.sql', `${lignes.join('\n')}\n`);
console.log(`→ seed/livres.sql (${lignes.length - 1} instructions)`);
