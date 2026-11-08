/* Livres : bibliothèque partagée, un statut par personne. Utilise $, $$, P, api, esc, toast, ouvrir, fermer de app.js. */
const PERS = ['croco', 'dauphin', 'pedro'];
const NOMS = { croco: 'Croco', dauphin: 'Dauphin', pedro: 'Pedro' };
const STATUTS = { a_acheter: 'À acheter', a_lire: 'À lire', en_cours: 'En cours', lu: 'Lu' };
const TYPES = { fiction: 'Fiction', essai: 'Essai', reference: 'Référence' };
const VERSIONS = { papier: 'Papier', numerique: 'Numérique', 'papier,numerique': 'Papier + numérique' };
const PAGE = 60;

const liv = {
  tous: [],
  onglet: 'biblio',
  qui: 'tous',
  q: '',
  tri: 'recent',
  statut: '',
  genre: '',
  type: '',
  version: '',
  culte: false,
  pages: 1,
  ajout: null,
};

/* ---------- Données ---------- */
async function chargerLivres() {
  liv.tous = await api('/livres');
  const lus = liv.tous.filter((l) => l.statuts.some((s) => s.statut === 'lu')).length;
  $('#n-livres').textContent = `${lus} lus`;
}
function remplacerLivre(l) {
  const i = liv.tous.findIndex((x) => x.id === l.id);
  if (i > -1) liv.tous[i] = l;
  else liv.tous.unshift(l);
}
const statutDe = (l, p) => l.statuts.find((s) => s.personne === p);
function normaliser(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(le|la|les|l|un|une|des|du|de|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// Tous les mots cherchés doivent apparaître, dans n'importe quel ordre.
function correspond(l, q) {
  const h = normaliser(`${l.titre} ${l.auteur || ''} ${l.editeur || ''}`);
  return normaliser(q)
    .split(' ')
    .every((m) => h.includes(m));
}
function noteLivre(l) {
  if (liv.qui !== 'tous') return statutDe(l, liv.qui)?.note ?? -1;
  const n = l.statuts.map((s) => s.note).filter((x) => x != null);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : -1;
}
function anneeLue(l) {
  const s = liv.qui !== 'tous' ? [statutDe(l, liv.qui)] : l.statuts;
  return Math.max(0, ...s.filter(Boolean).map((x) => x.annee_lu || 0));
}

function filtrer() {
  let r = liv.tous;
  if (liv.qui !== 'tous') r = r.filter((l) => statutDe(l, liv.qui));
  if (liv.statut) {
    r = r.filter((l) =>
      liv.qui === 'tous' ? l.statuts.some((s) => s.statut === liv.statut) : statutDe(l, liv.qui)?.statut === liv.statut,
    );
  }
  if (liv.type) r = r.filter((l) => l.type === liv.type);
  if (liv.genre) r = r.filter((l) => l.genre === liv.genre);
  if (liv.version) r = r.filter((l) => (l.version || '').split(',').includes(liv.version));
  if (liv.culte) r = r.filter((l) => l.culte);
  if (liv.q) r = r.filter((l) => correspond(l, liv.q));
  const cmp = {
    recent: null,
    titre: (a, b) => a.titre.localeCompare(b.titre, 'fr'),
    auteur: (a, b) => (a.auteur || '~').localeCompare(b.auteur || '~', 'fr') || a.titre.localeCompare(b.titre, 'fr'),
    annee_lu: (a, b) => anneeLue(b) - anneeLue(a),
    note: (a, b) => noteLivre(b) - noteLivre(a),
  }[liv.tri];
  return cmp ? [...r].sort(cmp) : r;
}

/* ---------- Rendu ---------- */
function couvHtml(l, cls = 'couv') {
  const url =
    l.couverture_url || (l.isbn13 ? `https://covers.openlibrary.org/b/isbn/${l.isbn13}-M.jpg?default=false` : null);
  const initiale = esc(
    (l.titre || '?')
      .replace(/^(le|la|les|l'|un|une|des|the)\s+/i, '')
      .slice(0, 1)
      .toUpperCase(),
  );
  return `<div class="${cls}"><span>${initiale}</span>${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>`;
}
function etoilesLivre(n) {
  return `<span class="stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${n >= i ? 'on' : ''}"></i>`).join('')}</span>`;
}
function statutsHtml(l) {
  const items = PERS.map((p) => statutDe(l, p))
    .filter(Boolean)
    .map(
      (s) =>
        `<span class="st"><b>${P[s.personne]}</b>${s.statut === 'lu' && s.note ? etoilesLivre(s.note) : `<em>${STATUTS[s.statut]}</em>`}${s.statut === 'lu' && s.annee_lu ? `<small>${s.annee_lu}</small>` : ''}</span>`,
    );
  return items.length ? `<div class="statuts">${items.join('')}</div>` : '';
}
function livreCarte(l) {
  const meta = [l.auteur, l.annee, l.pages ? `${l.pages} p.` : null].filter(Boolean).join(' · ');
  const pills = [
    l.culte ? '<span class="culte">★ Culte</span>' : '',
    l.genre ? `<span>${esc(l.genre)}</span>` : '',
    l.type && l.type !== 'fiction' ? `<span>${TYPES[l.type]}</span>` : '',
    l.version ? `<span>${l.version.includes(',') ? '📖💻' : l.version === 'papier' ? '📖' : '💻'}</span>` : '',
  ].join('');
  return `<button type="button" class="livre" data-livre="${l.id}">
    ${couvHtml(l)}
    <div class="body">
      <div class="title">${esc(l.titre)}</div>
      <div class="meta">${esc(meta)}</div>
      ${pills ? `<div class="genres">${pills}</div>` : ''}
      ${statutsHtml(l)}
    </div></button>`;
}

function rendreLivres() {
  $$('#liv-seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.onglet === liv.onglet));
  $$('#liv-chips .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.qui === liv.qui));
  const biblio = liv.onglet === 'biblio';
  $('#liv-filtres').hidden = !biblio;
  $('#liv-filtres2').hidden = !biblio;
  $('#liv-search').hidden = liv.onglet === 'stats';
  $('#liv-fab').hidden = liv.onglet === 'stats';
  const list = $('#liv-list');
  const empty = $('#liv-empty');
  const more = $('#liv-more');
  more.hidden = true;
  empty.hidden = true;
  if (liv.onglet === 'stats') return rendreStats(list);
  if (liv.onglet === 'achat') return rendreAchat(list, empty);
  majFiltres();
  const r = filtrer();
  const visibles = r.slice(0, liv.pages * PAGE);
  list.innerHTML = visibles.map(livreCarte).join('');
  $('#liv-compte').textContent = `${r.length} livre${r.length > 1 ? 's' : ''}`;
  more.hidden = visibles.length >= r.length;
  more.textContent = `Charger plus (${r.length - visibles.length} restants)`;
  if (!r.length) {
    empty.hidden = false;
    empty.innerHTML = '<div class="big">📚</div><div>Aucun livre ici.</div>';
  }
}

function majFiltres() {
  const base = liv.qui === 'tous' ? liv.tous : liv.tous.filter((l) => statutDe(l, liv.qui));
  const genres = [...new Set(base.map((l) => l.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  if (liv.genre && !genres.includes(liv.genre)) liv.genre = '';
  const sel = $('#liv-genre');
  sel.innerHTML =
    '<option value="">Genre</option>' +
    genres.map((g) => `<option value="${esc(g)}"${g === liv.genre ? ' selected' : ''}>${esc(g)}</option>`).join('');
  $('#liv-genres').innerHTML = genres.map((g) => `<option value="${esc(g)}">`).join('');
  for (const [id, v, def] of [
    ['#liv-tri', liv.tri, 'recent'],
    ['#liv-statut', liv.statut, ''],
    ['#liv-type', liv.type, ''],
    ['#liv-version', liv.version, ''],
  ]) {
    $(id).value = v;
    $(id).classList.toggle('actif', v !== def);
  }
  sel.classList.toggle('actif', !!liv.genre);
  $('#liv-culte').setAttribute('aria-pressed', liv.culte);
}

function rendreAchat(list, empty) {
  const r = liv.tous
    .filter((l) => l.statuts.some((s) => s.statut === 'a_acheter' && (liv.qui === 'tous' || s.personne === liv.qui)))
    .filter((l) => !liv.q || correspond(l, liv.q))
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  $('#liv-compte').textContent = `${r.length} à acheter`;
  list.innerHTML = r
    .map(
      (l) => `<div class="livre achat" data-livre="${l.id}">
      ${couvHtml(l)}
      <div class="body">
        <div class="title">${esc(l.titre)}</div>
        <div class="meta">${esc([l.auteur, l.editeur].filter(Boolean).join(' · '))}</div>
        <div class="meta">Pour ${l.statuts
          .filter((s) => s.statut === 'a_acheter')
          .map((s) => `${P[s.personne]} ${NOMS[s.personne]}`)
          .join(', ')}</div>
        <div class="actions">
          <button type="button" class="btn primary" data-achete="${l.id}">Acheté</button>
          ${l.statuts
            .filter((s) => s.statut === 'a_acheter')
            .map(
              (s) =>
                `<button type="button" class="btn" data-retirer="${l.id}" data-p="${s.personne}">Retirer ${P[s.personne]}</button>`,
            )
            .join('')}
        </div>
      </div></div>`,
    )
    .join('');
  if (!r.length) {
    empty.hidden = false;
    empty.innerHTML = '<div class="big">🛒</div><div>Rien à acheter.</div>';
  }
}

function rendreStats(list) {
  const pers = liv.qui === 'tous' ? PERS : [liv.qui];
  const st = liv.tous.flatMap((l) => l.statuts.filter((s) => pers.includes(s.personne)).map((s) => ({ ...s, l })));
  const lus = st.filter((s) => s.statut === 'lu');
  const compte = (k) => st.filter((s) => s.statut === k).length;
  const notes = lus.map((s) => s.note).filter(Boolean);
  const moy = notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1).replace('.', ',') : '–';
  const pages = lus.reduce((a, s) => a + (s.l.pages || 0), 0);
  const top = (f) => {
    const c = {};
    for (const s of lus) {
      const k = f(s.l);
      if (k) c[k] = (c[k] || 0) + 1;
    }
    return Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  };
  const ann = {};
  for (const s of lus) if (s.annee_lu) ann[s.annee_lu] = (ann[s.annee_lu] || 0) + 1;
  const annees = Object.entries(ann).sort((a, b) => b[0] - a[0]);
  const barres = (rows) => {
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return `<div class="bars">${rows
      .map(
        ([k, v]) =>
          `<div class="bar"><span class="k">${esc(k)}</span><span class="b"><i style="width:${Math.round((v / max) * 100)}%"></i></span><span class="v">${v}</span></div>`,
      )
      .join('')}</div>`;
  };
  $('#liv-compte').textContent = liv.qui === 'tous' ? 'Tout le monde' : `${P[liv.qui]} ${NOMS[liv.qui]}`;
  list.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><strong>${lus.length}</strong><span>lus</span></div>
      <div class="stat"><strong>${compte('en_cours')}</strong><span>en cours</span></div>
      <div class="stat"><strong>${compte('a_lire')}</strong><span>à lire</span></div>
      <div class="stat"><strong>${compte('a_acheter')}</strong><span>à acheter</span></div>
      <div class="stat"><strong>${moy}</strong><span>note moyenne</span></div>
      <div class="stat"><strong>${pages.toLocaleString('fr-FR')}</strong><span>pages lues</span></div>
    </div>
    ${annees.length ? `<div class="stat-card"><h2>Par année</h2>${barres(annees)}</div>` : ''}
    ${lus.length ? `<div class="stat-card"><h2>Genres</h2>${barres(top((l) => l.genre))}</div>` : ''}
    ${lus.length ? `<div class="stat-card"><h2>Auteurs</h2>${barres(top((l) => l.auteur))}</div>` : ''}`;
}

/* ---------- Contrôles ---------- */
$('#liv-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  liv.onglet = b.dataset.onglet;
  liv.pages = 1;
  rendreLivres();
});
$('#liv-chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  liv.qui = b.dataset.qui;
  liv.pages = 1;
  rendreLivres();
});
for (const [id, cle] of [
  ['#liv-tri', 'tri'],
  ['#liv-statut', 'statut'],
  ['#liv-genre', 'genre'],
  ['#liv-type', 'type'],
  ['#liv-version', 'version'],
]) {
  $(id).addEventListener('change', (e) => {
    liv[cle] = e.target.value;
    liv.pages = 1;
    rendreLivres();
  });
}
$('#liv-culte').addEventListener('click', () => {
  liv.culte = !liv.culte;
  liv.pages = 1;
  rendreLivres();
});
$('#liv-q').addEventListener('input', (e) => {
  liv.q = e.target.value.trim();
  liv.pages = 1;
  rendreLivres();
});
$('#liv-more').addEventListener('click', () => {
  liv.pages++;
  rendreLivres();
});
$('#liv-list').addEventListener('click', async (e) => {
  const a = e.target.closest('[data-achete]');
  const r = e.target.closest('[data-retirer]');
  try {
    if (a) {
      remplacerLivre(await api(`/livres/${a.dataset.achete}/achete`, { method: 'POST' }));
      toast('Passé en « à lire »');
      return rendreLivres();
    }
    if (r) {
      remplacerLivre(await api(`/livres/${r.dataset.retirer}/statut/${r.dataset.p}`, { method: 'DELETE' }));
      return rendreLivres();
    }
  } catch (err) {
    return toast(err.message);
  }
  const c = e.target.closest('[data-livre]');
  if (c) ouvrirLivre(+c.dataset.livre);
});

/* ---------- Fiche ---------- */
function segHtml(id, options, valeur, petit = true) {
  return `<div class="seg${petit ? ' small' : ''}" data-seg="${id}">${Object.entries(options)
    .map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${k === valeur}">${v}</button>`)
    .join('')}</div>`;
}
function rateHtml(p, note) {
  return `<div class="rate" data-rate="${p}"><b>${P[p]}</b>${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-pressed="${note === n}">${n}</button>`).join('')}</div>`;
}
function blocPersonne(p, s) {
  const statut = s?.statut || '';
  return `<div class="pers" data-pers="${p}">
    <div class="lab">${P[p]} ${NOMS[p]}</div>
    ${segHtml('statut', { '': '—', ...STATUTS }, statut)}
    <div class="si-lu" ${statut === 'lu' ? '' : 'hidden'}>
      ${rateHtml(p, s?.note)}
      <input type="number" class="annee" inputmode="numeric" placeholder="Année de lecture" value="${s?.annee_lu || ''}">
    </div>
    <textarea class="commentaire" placeholder="Commentaire" ${statut ? '' : 'hidden'}>${esc(s?.commentaire || '')}</textarea>
  </div>`;
}

function ouvrirLivre(id) {
  const l = liv.tous.find((x) => x.id === id);
  if (!l) return;
  const panel = $('#liv-panel');
  const meta = [l.auteur, l.annee, l.editeur, l.pages ? `${l.pages} p.` : null].filter(Boolean).join(' · ');
  panel.innerHTML = `
    <div class="sheet-head"><div class="grab"></div><button type="button" class="iconbtn" data-close aria-label="Fermer">✕</button></div>
    <div class="detail-head livre-head">
      ${couvHtml(l, 'couv grande')}
      <div>
        <h2>${esc(l.titre)}</h2>
        <div class="meta">${esc(meta)}</div>
        ${l.isbn13 || l.isbn ? `<div class="meta">ISBN ${esc(l.isbn13 || l.isbn)}</div>` : ''}
        ${l.note_exemplaire ? `<div class="meta">${esc(l.note_exemplaire)}</div>` : ''}
      </div>
    </div>
    ${l.resume ? `<p class="synopsis">${esc(l.resume)}</p>` : ''}
    <div class="field"><span class="lab">Type</span>${segHtml('type', TYPES, l.type || 'fiction')}</div>
    <div class="field"><label for="d-genre">Genre</label><input id="d-genre" list="liv-genres" value="${esc(l.genre || '')}" placeholder="Roman, Essai, BD…"></div>
    <div class="field"><span class="lab">Version</span>${segHtml('version', { '': '—', ...VERSIONS }, l.version || '')}</div>
    <label class="check"><span>★ Culte</span><input type="checkbox" id="d-culte" ${l.culte ? 'checked' : ''}></label>
    <div class="field"><label for="d-notes">Notes sur l'exemplaire</label><input id="d-notes" value="${esc(l.notes || '')}" placeholder="Prêté à…, édition…"></div>
    ${PERS.map((p) => blocPersonne(p, statutDe(l, p))).join('')}
    <div class="err" id="d-err" hidden></div>
    <button class="btn primary big" id="d-save" type="button">Enregistrer</button>
    <div class="actions"><button class="btn danger" id="d-delete" type="button">Supprimer</button></div>`;
  brancherSegs(panel);
  $('#d-save').onclick = async () => {
    try {
      const corps = {
        type: panel.querySelector('[data-seg="type"] [aria-pressed="true"]').dataset.v,
        genre: $('#d-genre').value,
        version: panel.querySelector('[data-seg="version"] [aria-pressed="true"]').dataset.v || null,
        culte: $('#d-culte').checked,
        notes: $('#d-notes').value,
      };
      let maj = await api(`/livres/${id}`, { method: 'PATCH', body: corps });
      for (const bloc of $$('.pers', panel)) {
        const p = bloc.dataset.pers;
        const s = lireBloc(bloc);
        const avant = statutDe(l, p);
        if (!s.statut && avant) maj = await api(`/livres/${id}/statut/${p}`, { method: 'DELETE' });
        else if (s.statut) maj = await api(`/livres/${id}/statut/${p}`, { method: 'PUT', body: s });
      }
      remplacerLivre(maj);
      fermer();
      rendreLivres();
      toast('Enregistré');
    } catch (e) {
      $('#d-err').textContent = e.message;
      $('#d-err').hidden = false;
    }
  };
  $('#d-delete').onclick = async (e) => {
    const b = e.currentTarget;
    if (b.dataset.confirm) {
      try {
        await api(`/livres/${id}`, { method: 'DELETE' });
        liv.tous = liv.tous.filter((x) => x.id !== id);
        fermer();
        rendreLivres();
        toast('Livre supprimé');
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    b.dataset.confirm = '1';
    b.textContent = 'Confirmer la suppression';
  };
  ouvrir('#sheet-liv');
}

function lireBloc(bloc) {
  const statut = bloc.querySelector('[data-seg="statut"] [aria-pressed="true"]')?.dataset.v || '';
  const note = +(bloc.querySelector('.rate [aria-pressed="true"]')?.dataset.n || 0) || null;
  return {
    statut,
    note,
    annee_lu: bloc.querySelector('.annee').value || null,
    commentaire: bloc.querySelector('.commentaire').value,
  };
}
// Segments et notes : un clic bascule l'état ; le statut « lu » révèle note et année.
function brancherSegs(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button, .rate button');
    if (!b) return;
    const grp = b.parentElement;
    if (grp.matches('.rate')) {
      const deja = b.getAttribute('aria-pressed') === 'true';
      $$('button', grp).forEach((x) => x.setAttribute('aria-pressed', !deja && x === b));
    } else {
      $$('button', grp).forEach((x) => x.setAttribute('aria-pressed', x === b));
      const pers = grp.closest('.pers, .ajout-statut');
      if (pers && grp.dataset.seg === 'statut') {
        const lu = b.dataset.v === 'lu';
        pers.querySelector('.si-lu').hidden = !lu;
        const com = pers.querySelector('.commentaire');
        if (com) com.hidden = !b.dataset.v;
        if (lu && !pers.querySelector('.annee').value) pers.querySelector('.annee').value = new Date().getFullYear();
      }
    }
  });
}

/* ---------- Ajout ---------- */
let timerLiv;
$('#liv-fab').onclick = () => {
  liv.ajout = { choix: null, existant: null };
  $('#la-q').value = '';
  $('#la-results').innerHTML = '';
  $('#la-choix').hidden = true;
  $('#la-form').hidden = true;
  $('#la-err').hidden = true;
  ouvrir('#sheet-liv-add');
  setTimeout(() => $('#la-q').focus(), 50);
};
$('#la-q').addEventListener('input', () => {
  clearTimeout(timerLiv);
  const q = $('#la-q').value.trim();
  if (q.length < 2) {
    $('#la-results').innerHTML = '';
    return;
  }
  const locaux = liv.tous.filter((l) => correspond(l, q)).slice(0, 4);
  liv.ajout.locaux = locaux;
  const blocLocal = locaux.length
    ? `<div class="lab">Déjà dans la bibliothèque</div>${locaux
        .map(
          (l, i) =>
            `<button type="button" class="result" data-local="${i}">${couvHtml(l, 'couv mini')}<div><div class="t">${esc(l.titre)}</div><div class="y">${esc(l.auteur || '')}${l.annee ? ` · ${l.annee}` : ''}</div></div></button>`,
        )
        .join('')}`
    : '';
  $('#la-results').innerHTML = `${blocLocal}<div class="lab">En ligne</div><div class="why">Recherche…</div>`;
  timerLiv = setTimeout(async () => {
    let ligne = '';
    try {
      const res = await api('/livres/recherche?q=' + encodeURIComponent(q));
      liv.ajout.enligne = res;
      ligne = res
        .map(
          (r, i) =>
            `<button type="button" class="result" data-ligne="${i}">${couvHtml(r, 'couv mini')}<div><div class="t">${esc(r.titre)}</div><div class="y">${esc(r.auteur || '')}${r.annee ? ` · ${r.annee}` : ''}${r.editeur ? ` · ${esc(r.editeur)}` : ''}</div></div></button>`,
        )
        .join('');
      if (!res.length) ligne = '<div class="why">Rien trouvé en ligne.</div>';
    } catch (e) {
      ligne = `<div class="err">${esc(e.message)}</div>`;
    }
    $('#la-results').innerHTML =
      `${blocLocal}<div class="lab">En ligne</div>${ligne}<button type="button" class="btn" id="la-manuel">Saisir « ${esc(q)} » à la main</button>`;
  }, 350);
});
$('#la-results').addEventListener('click', (e) => {
  const loc = e.target.closest('[data-local]');
  const lig = e.target.closest('[data-ligne]');
  const man = e.target.closest('#la-manuel');
  if (loc) return choisirLivre({ ...liv.ajout.locaux[+loc.dataset.local] }, true);
  if (lig) return choisirLivre({ ...liv.ajout.enligne[+lig.dataset.ligne] }, false);
  if (man) return choisirLivre({ titre: $('#la-q').value.trim(), manuel: true }, false);
});
function choisirLivre(r, existant) {
  liv.ajout.choix = r;
  liv.ajout.existant = existant;
  $('#la-results').innerHTML = '';
  $('#la-choix').hidden = false;
  $('#la-choix').innerHTML =
    `${couvHtml(r, 'couv mini')}<div><div class="t"><b>${esc(r.titre)}</b></div><div class="y">${esc(r.auteur || (r.manuel ? 'saisie manuelle' : ''))}${existant ? ' · déjà dans la bibliothèque' : ''}</div></div><button type="button" class="btn" id="la-change">Changer</button>`;
  $('#la-change').onclick = () => {
    liv.ajout.choix = null;
    $('#la-choix').hidden = true;
    $('#la-form').hidden = true;
    $('#la-q').focus();
  };
  const form = $('#la-form');
  form.hidden = false;
  const qui = localStorage.getItem('pcd_livres_qui') || 'croco';
  form.innerHTML = `
    <div class="field"><span class="lab">Pour qui</span>${segHtml('qui', Object.fromEntries(PERS.map((p) => [p, `${P[p]} ${NOMS[p]}`])), qui)}</div>
    <div class="ajout-statut">
      <div class="field"><span class="lab">Statut</span>${segHtml('statut', STATUTS, 'lu')}</div>
      <div class="si-lu">
        <div class="field"><span class="lab">Note</span>${PERS.map((p) => rateHtml(p, null)).join('')}</div>
        <div class="field"><label for="la-annee">Année de lecture</label><input type="number" id="la-annee" class="annee" inputmode="numeric" value="${new Date().getFullYear()}"></div>
      </div>
      <div class="field"><label for="la-com">Commentaire</label><textarea id="la-com" class="commentaire" placeholder="Un mot ?"></textarea></div>
    </div>
    ${
      existant
        ? ''
        : `<details class="plus"><summary>Détails du livre</summary>
      <div class="field"><label for="la-auteur">Auteur</label><input id="la-auteur" value="${esc(r.auteur || '')}"></div>
      <div class="field"><label for="la-editeur">Éditeur</label><input id="la-editeur" value="${esc(r.editeur || '')}"></div>
      <div class="field"><label for="la-an">Année d'édition</label><input id="la-an" type="number" inputmode="numeric" value="${r.annee || ''}"></div>
      <div class="field"><label for="la-pages">Pages</label><input id="la-pages" type="number" inputmode="numeric" value="${r.pages || ''}"></div>
      <div class="field"><span class="lab">Type</span>${segHtml('type', TYPES, 'fiction')}</div>
      <div class="field"><label for="la-genre">Genre</label><input id="la-genre" list="liv-genres" placeholder="Roman, Essai, BD…"></div>
      <div class="field"><span class="lab">Version</span>${segHtml('version', VERSIONS, 'papier')}</div>
    </details>`
    }
    <div class="err" id="la-err" hidden></div>
    <button type="button" class="btn primary big" id="la-save">Enregistrer</button>`;
  // Une seule ligne de note : celle de la personne choisie.
  const majNote = () => {
    const p = form.querySelector('[data-seg="qui"] [aria-pressed="true"]').dataset.v;
    $$('.rate', form).forEach((r) => (r.hidden = r.dataset.rate !== p));
  };
  majNote();
  brancherSegs(form);
  form.querySelector('[data-seg="qui"]').addEventListener('click', majNote);
  $('#la-save').onclick = enregistrerAjout;
}
async function enregistrerAjout() {
  const form = $('#la-form');
  const r = liv.ajout.choix;
  const p = form.querySelector('[data-seg="qui"] [aria-pressed="true"]').dataset.v;
  localStorage.setItem('pcd_livres_qui', p);
  const statut = {
    personne: p,
    statut: form.querySelector('[data-seg="statut"] [aria-pressed="true"]').dataset.v,
    note: +(form.querySelector(`.rate[data-rate="${p}"] [aria-pressed="true"]`)?.dataset.n || 0) || null,
    annee_lu: $('#la-annee').value || null,
    commentaire: $('#la-com').value,
  };
  $('#la-save').disabled = true;
  try {
    let l;
    if (liv.ajout.existant) {
      l = await api(`/livres/${r.id}/statut/${p}`, { method: 'PUT', body: statut });
    } else {
      l = await api('/livres', {
        method: 'POST',
        body: {
          titre: r.titre,
          auteur: $('#la-auteur').value,
          editeur: $('#la-editeur').value,
          annee: $('#la-an').value,
          pages: $('#la-pages').value,
          isbn: r.isbn || null,
          isbn13: r.isbn13 || null,
          couverture_url: r.couverture_url || null,
          resume: r.resume || null,
          type: form.querySelector('[data-seg="type"] [aria-pressed="true"]').dataset.v,
          genre: $('#la-genre').value,
          version: form.querySelector('[data-seg="version"] [aria-pressed="true"]').dataset.v,
          statut,
        },
      });
    }
    remplacerLivre(l);
    fermer();
    liv.onglet = 'biblio';
    rendreLivres();
    toast(`${l.titre} · ${STATUTS[statut.statut]} ${P[p]}`);
  } catch (e) {
    $('#la-err').textContent = e.message;
    $('#la-err').hidden = false;
  } finally {
    $('#la-save').disabled = false;
  }
}

// Appelées depuis app.js (chargement et routage).
window.chargerLivres = chargerLivres;
window.rendreLivres = rendreLivres;
