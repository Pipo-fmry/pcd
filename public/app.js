/* PCD : front vanilla. Toutes les données viennent de /api (D1). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const P = { croco: '🐊', dauphin: '🐬' };
const VUES = ['accueil', 'cinema', 'livres'];

const etat = {
  films: [],
  liste: 'vu',
  qui: 'tous',
  q: '',
  reco: {},
  ajout: { choix: null, statut: 'vu', qui: 'croco', notes: {} },
};

/* ---------- API ---------- */
async function api(chemin, options = {}) {
  const r = await fetch('/api' + chemin, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (r.status === 401) {
    montrerLogin();
    throw new Error('Code requis');
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || 'Erreur');
  return d;
}

/* ---------- Démarrage / login ---------- */
async function demarrer() {
  try {
    await api('/session');
    montrerApp();
  } catch {
    /* login affiché */
  }
}
function montrerLogin() {
  $('#app').hidden = true;
  $('#v-login').hidden = false;
  setTimeout(() => $('#pin').focus(), 50);
}
async function montrerApp() {
  $('#v-login').hidden = true;
  $('#app').hidden = false;
  await chargerFilms();
  router();
}
$('#loginform').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginerr').hidden = true;
  try {
    await api('/login', { method: 'POST', body: { pin: $('#pin').value } });
    $('#pin').value = '';
    montrerApp();
  } catch (err) {
    $('#loginerr').textContent = err.message;
    $('#loginerr').hidden = false;
  }
});

/* ---------- Routage par hash ---------- */
function router() {
  const h = (location.hash || '#accueil').slice(1);
  const v = VUES.includes(h) ? h : 'accueil';
  VUES.forEach((n) => ($('#v-' + n).hidden = n !== v));
  $$('.tabbar a').forEach((a) =>
    a.dataset.v === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'),
  );
  if (v === 'cinema') rendreCinema();
  window.scrollTo(0, 0);
}
addEventListener('hashchange', router);

/* ---------- Films ---------- */
async function chargerFilms() {
  etat.films = await api('/films');
  $('#n-films').textContent = `${etat.films.filter((f) => f.statut === 'vu').length} vus`;
}

function etoiles(n) {
  return `<span class="stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${n >= i ? 'on' : ''}"></i>`).join('')}</span>`;
}
function noteHtml(f) {
  const parts = [];
  for (const p of ['croco', 'dauphin']) {
    const n = f['note_' + p];
    if (n != null)
      parts.push(`<div class="note"><span title="${p}">${P[p]}</span>${etoiles(n)}<span class="v">${n}</span></div>`);
  }
  const vals = ['croco', 'dauphin'].map((p) => f['note_' + p]).filter((n) => n != null);
  if (vals.length === 2)
    parts.push(`<span class="avg">${(vals.reduce((a, b) => a + b, 0) / 2).toLocaleString('fr-FR')}</span>`);
  return parts.length ? `<div class="notes">${parts.join('')}</div>` : '';
}
function extHtml(f) {
  const x = [];
  if (f.note_rt != null) x.push(`<span>🍅 <b>${f.note_rt} %</b></span>`);
  if (f.note_metacritic != null) x.push(`<span>Metacritic <b>${f.note_metacritic}</b></span>`);
  if (f.note_imdb != null) x.push(`<span>IMDb <b>${f.note_imdb.toLocaleString('fr-FR')}</b></span>`);
  if (!x.length && f.note_tmdb != null) x.push(`<span>TMDB <b>${f.note_tmdb.toLocaleString('fr-FR')}</b></span>`);
  return x.length ? `<div class="ext">${x.join('')}</div>` : '';
}
function posterHtml(f, cls = 'poster') {
  return f.affiche_url
    ? `<img class="${cls}" src="${f.affiche_url}" alt="" loading="lazy">`
    : `<div class="${cls}">🎬</div>`;
}
function dateFr(iso) {
  if (!iso) return '';
  if (/^\d{4}-01-01$/.test(iso)) return iso.slice(0, 4);
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function filmCarte(f) {
  const meta = [
    f.annee,
    f.realisateur,
    f.duree ? `${Math.floor(f.duree / 60)}h${String(f.duree % 60).padStart(2, '0')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const quand =
    f.statut === 'vu'
      ? f.vu_le
        ? `vu en ${dateFr(f.vu_le)}`
        : ''
      : f.ajoute_par
        ? `ajouté par ${P[f.ajoute_par]}`
        : '';
  return `<button class="film" data-id="${f.id}">
    ${posterHtml(f)}
    <div class="body">
      <div class="title">${esc(f.titre)}</div>
      <div class="meta">${esc([meta, quand].filter(Boolean).join(' · '))}</div>
      ${
        f.genres.length
          ? `<div class="genres">${f.genres
              .slice(0, 3)
              .map((g) => `<span>${esc(g)}</span>`)
              .join('')}</div>`
          : ''
      }
      ${extHtml(f)}
      ${noteHtml(f)}
    </div></button>`;
}

function rendreCinema() {
  const list = $('#cine-list'),
    empty = $('#cine-empty');
  $$('#cine-seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.list === etat.liste));
  $$('#cine-chips .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.qui === etat.qui));
  $('#fab').hidden = etat.liste === 'reco';
  $('.searchrow').hidden = etat.liste === 'reco';
  if (etat.liste === 'reco') return rendreReco();

  let films = etat.films.filter((f) => f.statut === etat.liste);
  if (etat.qui !== 'tous') {
    films =
      etat.liste === 'vu'
        ? films
            .filter((f) => f['note_' + etat.qui] != null)
            .sort((a, b) => b['note_' + etat.qui] - a['note_' + etat.qui])
        : films.filter((f) => f.ajoute_par === etat.qui);
  }
  if (etat.q) {
    const q = etat.q.toLowerCase();
    films = films.filter((f) =>
      [f.titre, f.titre_original, f.realisateur, ...f.acteurs, ...f.genres].join(' ').toLowerCase().includes(q),
    );
  }
  list.innerHTML = films.map(filmCarte).join('');
  empty.hidden = films.length > 0;
  empty.innerHTML =
    etat.liste === 'vu'
      ? '<div class="big">🎬</div><div>Aucun film ici.</div><div>Appuie sur + pour ajouter un film vu.</div>'
      : '<div class="big">🍿</div><div>Rien à voir pour l\'instant.</div><div>Appuie sur + pour ajouter une envie.</div>';
}

async function rendreReco() {
  const list = $('#cine-list'),
    empty = $('#cine-empty');
  const qui = etat.qui === 'tous' ? 'nous' : etat.qui;
  list.innerHTML = '<div class="empty"><div>Je réfléchis…</div></div>';
  empty.hidden = true;
  try {
    const recos = etat.reco[qui] || (etat.reco[qui] = await api('/reco?personne=' + qui));
    if (!recos.length) {
      list.innerHTML = '';
      empty.hidden = false;
      empty.innerHTML =
        '<div class="big">🤷</div><div>Pas encore de piste.</div><div>Note quelques films 4 ou 5 pour que je trouve des idées.</div>';
      return;
    }
    list.innerHTML = recos
      .map(
        (r) => `<div class="film" data-reco="${r.tmdb_id}">
      ${posterHtml(r)}
      <div class="body">
        <div class="title">${esc(r.titre)}</div>
        <div class="meta">${r.annee || ''}${r.note_tmdb ? ` · TMDB ${r.note_tmdb.toLocaleString('fr-FR')}` : ''}</div>
        <div class="why">Parce que ${qui === 'nous' ? 'vous avez' : 'tu as'} aimé <b>${r.parce_que.map(esc).join('</b> et <b>')}</b></div>
        <div class="actions"><button class="btn primary" data-act="avoir" data-tmdb="${r.tmdb_id}" data-titre="${esc(r.titre)}">+ À voir</button><button class="btn" data-act="refus" data-tmdb="${r.tmdb_id}">Pas pour ${qui === 'nous' ? 'nous' : 'moi'}</button></div>
      </div></div>`,
      )
      .join('');
  } catch (e) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = `<div class="big">⚠️</div><div>${esc(e.message)}</div>`;
  }
}

$('#cine-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) {
    etat.liste = b.dataset.list;
    rendreCinema();
  }
});
$('#cine-chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (b) {
    etat.qui = b.dataset.qui;
    rendreCinema();
  }
});
$('#cine-q').addEventListener('input', (e) => {
  etat.q = e.target.value.trim();
  rendreCinema();
});

$('#cine-list').addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    const qui = etat.qui === 'tous' ? 'nous' : etat.qui;
    try {
      if (act.dataset.act === 'avoir') {
        await api('/films', {
          method: 'POST',
          body: { tmdb_id: +act.dataset.tmdb, statut: 'a_voir', ajoute_par: qui === 'nous' ? 'croco' : qui },
        });
        toast(`« ${act.dataset.titre} » ajouté à voir`);
      } else {
        await api('/reco/refus', { method: 'POST', body: { tmdb_id: +act.dataset.tmdb, personne: qui } });
      }
      etat.reco = {};
      await chargerFilms();
      rendreCinema();
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const carte = e.target.closest('.film[data-id]');
  if (carte) ouvrirFilm(+carte.dataset.id);
});

/* ---------- Détail d'un film ---------- */
function ouvrirFilm(id) {
  const f = etat.films.find((x) => x.id === id);
  if (!f) return;
  const panel = $('#film-panel');
  const meta = [f.annee, f.realisateur, f.duree ? `${f.duree} min` : null].filter(Boolean).join(' · ');
  panel.innerHTML = `
    <div class="grab"></div>
    <div class="detail-head">
      ${posterHtml(f)}
      <div>
        <h2>${esc(f.titre)}</h2>
        ${f.titre_original && f.titre_original !== f.titre ? `<div class="meta">${esc(f.titre_original)}</div>` : ''}
        <div class="meta">${esc(meta)}</div>
        ${f.acteurs.length ? `<div class="meta">Avec ${esc(f.acteurs.join(', '))}</div>` : ''}
        ${f.genres.length ? `<div class="genres">${f.genres.map((g) => `<span>${esc(g)}</span>`).join('')}</div>` : ''}
        ${extHtml(f)}
      </div>
    </div>
    ${f.trailer_youtube ? `<div class="trailer"><iframe src="https://www.youtube-nocookie.com/embed/${esc(f.trailer_youtube)}" title="Bande-annonce" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>` : ''}
    ${f.synopsis ? `<p class="synopsis">${esc(f.synopsis)}</p>` : ''}
    <div class="field"><span class="lab">Notes</span>
      ${['croco', 'dauphin'].map((p) => `<div class="rate" data-p="${p}"><b>${P[p]}</b>${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-pressed="${f['note_' + p] === n}">${n}</button>`).join('')}</div>`).join('')}
    </div>
    <div class="field"><span class="lab">Statut</span>
      <div class="seg small" id="d-statut"><button type="button" aria-pressed="${f.statut === 'vu'}" data-v="vu">Vu</button><button type="button" aria-pressed="${f.statut === 'a_voir'}" data-v="a_voir">À voir</button></div>
    </div>
    ${f.statut === 'vu' ? `<div class="field"><label for="d-date">Vu le</label><input id="d-date" type="date" value="${f.vu_le && /^\d{4}-\d{2}-\d{2}$/.test(f.vu_le) ? f.vu_le : ''}"></div>` : ''}
    <div class="err" id="d-err" hidden></div>
    <button class="btn primary big" id="d-save" type="button">Enregistrer</button>
    <div class="actions">
      ${!f.affiche_url || !f.trailer_youtube ? `<button class="btn" id="d-refresh" type="button">↻ Compléter depuis TMDB</button>` : ''}
      <button class="btn danger" id="d-delete" type="button">Supprimer</button>
      <button class="btn" type="button" data-close>Fermer</button>
    </div>`;
  const notes = { croco: f.note_croco, dauphin: f.note_dauphin };
  let statut = f.statut;
  $$('.rate', panel).forEach((r) =>
    r.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const p = r.dataset.p,
        n = +b.dataset.n;
      notes[p] = notes[p] === n ? null : n;
      $$('button', r).forEach((x) => x.setAttribute('aria-pressed', notes[p] === +x.dataset.n));
    }),
  );
  $('#d-statut', panel).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    statut = b.dataset.v;
    $$('button', $('#d-statut')).forEach((x) => x.setAttribute('aria-pressed', x === b));
  });
  $('#d-save').onclick = async () => {
    try {
      const body = { statut, notes };
      const d = $('#d-date');
      if (d?.value) body.vu_le = d.value;
      await api(`/films/${id}`, { method: 'PATCH', body });
      fermer();
      etat.reco = {};
      await chargerFilms();
      rendreCinema();
      toast('Enregistré');
    } catch (err) {
      $('#d-err').textContent = err.message;
      $('#d-err').hidden = false;
    }
  };
  $('#d-refresh')?.addEventListener('click', async () => {
    try {
      await api(`/films/${id}/refresh`, { method: 'POST' });
      await chargerFilms();
      ouvrirFilm(id);
      toast('Fiche complétée');
    } catch (err) {
      $('#d-err').textContent = err.message;
      $('#d-err').hidden = false;
    }
  });
  $('#d-delete').onclick = () => {
    const b = $('#d-delete');
    if (b.dataset.confirm) {
      api(`/films/${id}`, { method: 'DELETE' }).then(async () => {
        fermer();
        etat.reco = {};
        await chargerFilms();
        rendreCinema();
        toast('Supprimé');
      });
      return;
    }
    b.dataset.confirm = '1';
    b.textContent = 'Confirmer la suppression';
  };
  $('#sheet-film').hidden = false;
}

/* ---------- Ajout ---------- */
let timerRecherche;
$('#fab').onclick = () => {
  reinitAjout();
  $('#sheet-add').hidden = false;
  setTimeout(() => $('#f-q').focus(), 50);
};
function reinitAjout() {
  etat.ajout = {
    choix: null,
    statut: etat.liste === 'a_voir' ? 'a_voir' : 'vu',
    qui: etat.qui === 'dauphin' ? 'dauphin' : 'croco',
    notes: {},
  };
  $('#f-q').value = '';
  $('#f-results').innerHTML = '';
  $('#f-choix').hidden = true;
  $('#f-err').hidden = true;
  $('#f-save').disabled = true;
  $$('#f-statut button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === etat.ajout.statut));
  $$('#f-qui button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === etat.ajout.qui));
  $$('#f-notes-wrap .rate button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  $('#f-notes-wrap').hidden = etat.ajout.statut !== 'vu';
}
$('#f-q').addEventListener('input', () => {
  clearTimeout(timerRecherche);
  const q = $('#f-q').value.trim();
  if (q.length < 2) {
    $('#f-results').innerHTML = '';
    return;
  }
  timerRecherche = setTimeout(async () => {
    try {
      const res = await api('/tmdb/search?q=' + encodeURIComponent(q));
      $('#f-results').innerHTML =
        res
          .map(
            (r) => `<button type="button" class="result" data-r='${esc(JSON.stringify(r))}'>
        ${r.affiche_url ? `<img src="${r.affiche_url}" alt="">` : '<div class="ph"></div>'}<div><div class="t">${esc(r.titre)}</div><div class="y">${r.annee || ''}${r.titre_original !== r.titre ? ` · ${esc(r.titre_original)}` : ''}</div></div></button>`,
          )
          .join('') ||
        `<div class="why">Rien trouvé. <button type="button" class="btn" id="f-manuel">Ajouter « ${esc(q)} » à la main</button></div>`;
    } catch (e) {
      $('#f-results').innerHTML =
        `<div class="err">${esc(e.message)}</div><div class="why"><button type="button" class="btn" id="f-manuel">Ajouter « ${esc(q)} » à la main</button></div>`;
    }
  }, 350);
});
$('#f-results').addEventListener('click', (e) => {
  const m = e.target.closest('#f-manuel');
  if (m) {
    choisir({ titre: $('#f-q').value.trim(), manuel: true });
    return;
  }
  const b = e.target.closest('.result');
  if (!b) return;
  choisir(JSON.parse(b.dataset.r));
});
function choisir(r) {
  etat.ajout.choix = r;
  $('#f-results').innerHTML = '';
  $('#f-choix').hidden = false;
  $('#f-choix').innerHTML =
    `${r.affiche_url ? `<img src="${r.affiche_url}" alt="">` : '<div class="ph"></div>'}<div><div class="t"><b>${esc(r.titre)}</b></div><div class="y">${r.annee || (r.manuel ? 'saisie manuelle' : '')}</div></div><button type="button" class="btn" id="f-change">Changer</button>`;
  $('#f-change').onclick = () => {
    etat.ajout.choix = null;
    $('#f-choix').hidden = true;
    $('#f-save').disabled = true;
    $('#f-q').focus();
  };
  $('#f-save').disabled = false;
}
$('#f-statut').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  etat.ajout.statut = b.dataset.v;
  $$('#f-statut button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  $('#f-notes-wrap').hidden = etat.ajout.statut !== 'vu';
});
$('#f-qui').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  etat.ajout.qui = b.dataset.v;
  $$('#f-qui button').forEach((x) => x.setAttribute('aria-pressed', x === b));
});
$$('#f-notes-wrap .rate').forEach((r) =>
  r.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = r.dataset.p,
      n = +b.dataset.n;
    etat.ajout.notes[p] = etat.ajout.notes[p] === n ? null : n;
    $$('button', r).forEach((x) => x.setAttribute('aria-pressed', etat.ajout.notes[p] === +x.dataset.n));
  }),
);
$('#f-save').onclick = async () => {
  const c = etat.ajout.choix;
  if (!c) return;
  $('#f-save').disabled = true;
  $('#f-err').hidden = true;
  try {
    const body = {
      statut: etat.ajout.statut,
      ajoute_par: etat.ajout.qui,
      notes: etat.ajout.statut === 'vu' ? etat.ajout.notes : {},
    };
    if (c.manuel) body.titre = c.titre;
    else body.tmdb_id = c.tmdb_id;
    await api('/films', { method: 'POST', body });
    fermer();
    etat.reco = {};
    etat.liste = etat.ajout.statut;
    await chargerFilms();
    rendreCinema();
    toast(`« ${c.titre} » ajouté`);
  } catch (err) {
    $('#f-err').textContent = err.message;
    $('#f-err').hidden = false;
    $('#f-save').disabled = false;
  }
};

/* ---------- Feuilles, toast ---------- */
function fermer() {
  $$('.sheet').forEach((s) => (s.hidden = true));
}
$$('.sheet').forEach((s) =>
  s.addEventListener('click', (e) => {
    if (e.target === s || e.target.closest('[data-close]')) fermer();
  }),
);
let timerToast;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => (t.hidden = true), 2500);
}

demarrer();
