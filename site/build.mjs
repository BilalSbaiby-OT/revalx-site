// Static site generator for REVALX. No dependencies.
// Usage: node site/build.mjs   (env: TURNSTILE_SITEKEY)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, '..', 'dist');
const SITEKEY = process.env.TURNSTILE_SITEKEY || '1x00000000000000000000AA'; // Cloudflare always-pass test key

// Locales are enabled by the presence of site/i18n/<code>.json. Phase 2 adds de/es/fr.
const LOCALES = readdirSync(join(root, 'i18n')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const strings = Object.fromEntries(LOCALES.map(l => [l, JSON.parse(readFileSync(join(root, 'i18n', l + '.json'), 'utf8'))]));
const DEFAULT = 'en';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Every "[pending approval]" is rendered as a visible marker.
const rich = s => esc(s).replace(/\[pending approval\]/g, '<mark class="pending">[pending approval]</mark>');

const ICONS = {
  ball: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 26h12v12H4zM48 26h12v12H48z"/><circle cx="32" cy="32" r="16"/><path d="M32 16V6M24 6h16"/><path d="M20 32h24" stroke-dasharray="3 3"/></svg>',
  butterfly: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 24h10v16H4zM50 24h10v16H50z"/><path d="M14 20h36v24H14z"/><ellipse cx="32" cy="32" rx="5" ry="12"/><path d="M32 20V6M24 6h16"/></svg>',
  gate: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 30h12v12H4zM48 30h12v12H48z"/><path d="M16 26h32v20H16z"/><path d="M26 26V12M38 26V12M32 12V4M22 4h20"/><path d="M26 34h12v8H26z"/></svg>',
  check: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 28h12v14H4zM48 28h12v14H48z"/><path d="M16 22h32v26H16z"/><path d="M26 28l10 7-10 7z"/><path d="M42 26v18"/></svg>'
};
const VALVES = ['ball', 'butterfly', 'gate', 'check'];

function build(lang) {
  const t = strings[lang];
  const base = '/' + lang + '/';
  const href = key => base + t.slugs[key];
  const P = t.pages;
  const pagesOut = [];

  const specTable = (rows, caption) => `<table class="spec"><caption class="sr">${esc(caption)}</caption><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${rich(k)}</th><td>${rich(v)}</td></tr>`).join('')}</tbody></table>`;
  const cta = (extra = '') => `<div class="cta-row ${extra}"><a class="btn btn-primary" href="${href('rfq')}">${esc(t.cta_primary)}</a><a class="btn btn-secondary" href="${href('rfq')}#need">${esc(t.cta_secondary)}</a></div>`;
  const closing = (h, p) => `<section class="band band-navy"><div class="wrap closing"><div><h2>${esc(h)}</h2><p>${esc(p)}</p></div>${cta('on-dark')}</div></section>`;
  const hero = (h1, lead, extra = '') => `<section class="page-head"><div class="wrap"><h1>${esc(h1)}</h1><p class="lead">${rich(lead)}</p>${extra}</div></section>`;

  function layout({ key, path, title, desc, body, scripts = '' }) {
    const url = base + path;
    const nav = ['products', 'technical', 'industries', 'process', 'why', 'about', 'contact']
      .map(k => `<li><a href="${href(k)}"${path.startsWith(t.slugs[k]) && t.slugs[k] ? ' aria-current="page"' : ''}>${esc(t.nav[k])}</a></li>`).join('');
    const switcher = LOCALES.length > 1 ? `<nav class="lang" aria-label="${esc(t.lang_label)}">${LOCALES.map(l => `<a href="/${l}/${path}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${l.toUpperCase()}</a>`).join('')}</nav>` : '';
    return `<!doctype html>
<html lang="${lang}" dir="${t.meta.dir}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | REVALX</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#162234">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/site.css">
<script>document.documentElement.className='js'</script>
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
<div class="preview-bar" role="note"><div class="wrap">${rich(t.preview_banner)}</div></div>
${t.draft_banner ? `<div class="draft-bar" role="note"><div class="wrap">${esc(t.draft_banner)}</div></div>` : ''}
<header class="site-header"><div class="wrap header-in">
<a class="wordmark" href="${base}" aria-label="REVALX"><span class="wm-mark" aria-hidden="true"></span>${esc(t.brand)}</a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">${esc(t.menu)}</button>
<nav id="site-nav" class="site-nav" aria-label="${esc(t.nav_label || 'Main')}"><ul>${nav}</ul>${switcher}<a class="btn btn-primary btn-sm" href="${href('rfq')}">${esc(t.cta_primary)}</a></nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap foot">
<div><a class="wordmark on-dark" href="${base}"><span class="wm-mark" aria-hidden="true"></span>${esc(t.brand)}</a><p>${esc(t.footer.blurb)}</p></div>
<div><p class="foot-h">${rich(t.footer.company)}</p><p>${esc(t.footer.legal)}</p></div>
<div><ul><li><a href="${href('rfq')}">${esc(t.cta_primary)}</a></li><li><a href="${href('contact')}">${esc(t.footer.privacy)}</a></li></ul></div>
</div><div class="wrap foot-base">© ${esc(t.footer.rights)}</div></footer>
<script src="/assets/site.js" defer></script>
${scripts}
</body>
</html>`;
  }

  const add = (key, body, extra = {}) => pagesOut.push({ path: t.slugs[key], html: layout({ key, path: t.slugs[key], title: extra.title ?? P[key].title, desc: P[key].desc, body, scripts: extra.scripts }) });

  // ---------- Home ----------
  const h = P.home;
  add('home', `
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy">
    <p class="eyebrow">${esc(t.tagline)}</p>
    <h1>${esc(h.h1)}</h1>
    <p class="lead">${esc(h.lead)}</p>
    ${cta()}
  </div>
  <aside class="sheet" aria-labelledby="sheet-h">
    <p class="sheet-tag">RFQ</p>
    <h2 id="sheet-h">${esc(h.spec_title)}</h2>
    ${specTable(h.spec_rows, h.spec_title)}
    <p class="sheet-note">${esc(h.spec_note)}</p>
  </aside>
</div></section>
<section class="band"><div class="wrap">
  <div class="range-head"><h2>${esc(h.range_h)}</h2><p>${esc(h.range_p)}</p></div>
  <ul class="valve-grid">${VALVES.map(v => `<li><a class="valve-link" href="${href(v)}"><span class="valve-ico">${ICONS[v]}</span><span class="valve-name">${esc(P[v].h1)}</span><span class="valve-sum">${esc(P[v].lead)}</span></a></li>`).join('')}</ul>
</div></section>
<section class="band band-grey"><div class="wrap principles">
  <div><h2>${esc(h.approach_h)}</h2><p>${esc(h.approach_p)}</p><p><a class="link" href="${href('process')}">${esc(h.approach_cta)}</a></p></div>
  <div><h2>${esc(h.tech_h)}</h2><p>${esc(h.tech_p)}</p></div>
  <div><h2>${esc(h.int_h)}</h2><p>${rich(h.int_p)}</p></div>
</div></section>
<section class="band"><div class="wrap">
  <h2>${esc(h.steps_h)}</h2>
  <ol class="steps-short">${t.process_short.map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join('')}</ol>
  <p><a class="link" href="${href('process')}">${esc(h.steps_cta)}</a></p>
</div></section>
${closing(h.closing_h, h.closing_p)}`);

  // ---------- About ----------
  const a = P.about;
  add('about', `${hero(a.h1, a.lead)}
<section class="band"><div class="wrap two">
  <div><h2>${esc(a.role_h)}</h2><p>${rich(a.role_p)}</p><h2 class="mt">${esc(a.facts_h)}</h2><p>${esc(a.facts_p)}</p>${specTable(a.facts_rows, a.facts_h)}</div>
  <div><h2>${esc(a.values_h)}</h2><dl class="defs">${a.values.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
</div></section>${closing(P.home.closing_h, P.home.closing_p)}`);

  // ---------- Products overview ----------
  const pr = P.products;
  add('products', `${hero(pr.h1, pr.lead)}
<section class="band"><div class="wrap">
  <ul class="valve-grid">${VALVES.map(v => `<li><a class="valve-link" href="${href(v)}"><span class="valve-ico">${ICONS[v]}</span><span class="valve-name">${esc(P[v].h1)}</span><span class="valve-sum">${esc(P[v].lead)}</span></a></li>`).join('')}</ul>
</div></section>${closing(pr.unsure_h, pr.unsure_p)}`);

  // ---------- Product pages ----------
  const pc = P.product_common;
  for (const v of VALVES) {
    const p = P[v];
    add(v, `${hero(p.h1, p.lead)}
<section class="band"><div class="wrap two">
  <div class="prodcol">
    <div class="prod-ico">${ICONS[v]}</div>
    <h2>${esc(pc.how_h)}</h2><p>${esc(p.how)}</p>
    <h2 class="mt">${esc(pc.variants_h)}</h2><dl class="defs">${p.variants.map(([k, d]) => `<dt>${esc(k)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>
    <h2 class="mt">${rich(p.apps_h)}</h2><ul class="list">${p.apps.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 class="mt">${rich(p.consider_h)}</h2><ul class="list">${p.consider.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
  <div class="sheet"><p class="sheet-tag">RFQ</p><h2>${esc(pc.need_h)}</h2>${specTable(pc.need_rows, pc.need_h)}<p class="sheet-note">${esc(pc.need_note)}</p>${cta('stack')}</div>
</div></section>
<section class="band band-grey"><div class="wrap"><h2>${esc(pc.std_h)}</h2><p class="notice">${esc(p.standards)} ${esc(pc.std_ask)}</p><p class="fine">${esc(pc.disclaimer)}</p>
<h2>${esc(pc.all_h)}</h2><ul class="chips">${VALVES.filter(x => x !== v).map(x => `<li><a href="${href(x)}">${esc(P[x].h1)}</a></li>`).join('')}</ul></div></section>${closing(P.home.closing_h, P.home.closing_p)}`);
  }

  // ---------- Technical Supply ----------
  const te = P.technical;
  add('technical', `${hero(te.h1, te.lead)}
<section class="band"><div class="wrap two">
  <div><h2>${esc(te.guide_h)}</h2>${specTable(te.guide_rows, te.guide_h)}</div>
  <div><h2>${esc(te.notes_h)}</h2><p>${esc(te.notes_p)}</p><h2 class="mt">${esc(te.nodata_h)}</h2><p>${esc(te.nodata_p)}</p><h2 class="mt">${esc(te.limits_h)}</h2><p>${esc(te.limits_p)}</p>${cta('stack')}</div>
</div></section>
<section class="band band-grey"><div class="wrap two">
  <div><h2>${esc(te.terms_h)}</h2>${specTable(te.terms_rows, te.terms_h)}</div>
  <div><h2>${esc(te.checklist_h)}</h2><ul class="list">${te.checklist.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="fine">${esc(te.disclaimer)}</p></div>
</div></section>`);

  // ---------- Industries ----------
  const ind = P.industries;
  add('industries', `${hero(ind.h1, ind.lead)}
<section class="band"><div class="wrap"><p class="notice">${rich(ind.pending_banner)}</p>
<ul class="ind-list">${ind.list.map(([k, v]) => `<li><h2>${esc(k)} <mark class="pending">[pending approval]</mark></h2><p>${esc(v)}</p></li>`).join('')}</ul></div></section>${closing(P.home.closing_h, P.home.closing_p)}`);

  // ---------- Process ----------
  const pp = P.process;
  add('process', `${hero(pp.h1, pp.lead)}
<section class="band"><div class="wrap narrow"><ol class="steps">${pp.steps.map(([k, v]) => `<li><h2>${rich(k)}</h2><p>${rich(v)}</p></li>`).join('')}</ol><h2 class="mt">${esc(pp.who_h)}</h2><ul class="list">${pp.who.map(x => `<li>${rich(x)}</li>`).join('')}</ul><h2 class="mt">${esc(pp.after_h)}</h2><p>${rich(pp.after_p)}</p><p class="notice">${esc(pp.note)}</p></div></section>${closing(pp.cta_h, P.home.closing_p)}`);

  // ---------- Why ----------
  const w = P.why;
  add('why', `${hero(w.h1, w.lead)}
<section class="band"><div class="wrap"><ul class="why-list">${w.points.map(([k, v]) => `<li><h2>${esc(k)} <mark class="pending">[pending approval]</mark></h2><p>${esc(v)}</p><p class="fine">${rich(w.evidence)}</p></li>`).join('')}</ul></div></section>${closing(P.home.closing_h, P.home.closing_p)}`);

  // ---------- Contact ----------
  const c = P.contact;
  add('contact', `${hero(c.h1, c.lead)}
<section class="band"><div class="wrap two">
  <div><h2>${rich(c.details_h)}</h2>${specTable(c.details_rows, c.details_h)}${cta('stack')}</div>
  <div id="privacy"><h2>${rich(c.privacy_h)}</h2><p>${esc(c.privacy_p)}</p><ul class="list">${c.privacy_list.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
</div></section>`);

  // ---------- RFQ ----------
  const r = t.rfq;
  const rp = P.rfq;
  const fld = (name, label, { type = 'text', req = false, hint = '', ac = '', cls = '' } = {}) => `<div class="field ${cls}" data-field="${name}">
<label for="f-${name}">${esc(label)} <span class="tag ${req ? 'tag-req' : ''}">${esc(req ? r.required : r.optional)}</span></label>
${hint ? `<p class="hint" id="h-${name}">${esc(hint)}</p>` : ''}
<input id="f-${name}" name="${name}" type="${type}"${req ? ' required' : ''}${ac ? ` autocomplete="${ac}"` : ''} aria-describedby="${hint ? `h-${name} ` : ''}e-${name}"${name === 'email' ? ' inputmode="email"' : ''}>
<p class="err" id="e-${name}" role="alert"></p></div>`;
  // Option value stays English (what the tracker receives); label is localised and sorted per locale.
  const countryOptions = strings[DEFAULT].countries.map((en, i) => [en, t.countries[i]]).sort((x, y) => (x[0] === 'Other') - (y[0] === 'Other') || x[1].localeCompare(y[1], lang)).map(([en, loc]) => `<option value="${esc(en)}">${esc(loc)}</option>`).join('');
  const rfqBody = `${hero(rp.h1, rp.lead)}
<section class="band"><div class="wrap rfq-grid">
<div class="rfq-main">
<div id="rfq-ok" class="ok" hidden tabindex="-1"><h2>${esc(r.ok_h)}</h2><p class="ok-label">${esc(r.ok_ref)}</p><p class="ok-ref" id="rfq-ref"></p><p>${esc(r.ok_p)}</p><p><a class="btn btn-secondary" href="${href('rfq')}">${esc(r.ok_new)}</a></p></div>
<form id="rfq-form" action="/api/rfq" method="post" enctype="multipart/form-data" novalidate
  data-lang="${lang}" data-sitekey="${esc(SITEKEY)}"
  data-msg='${esc(JSON.stringify({ req: r.err_required, email: r.err_email, count: r.err_files_count, type: r.err_file_type, size: r.err_file_size, summary: r.err_summary, turnstile: r.err_turnstile, server: r.err_server, sending: r.sending, submit: r.submit, retry: r.retry, none: r.files_none, remove: r.file_remove })).replace(/&quot;/g, '&quot;')}'>
<div id="rfq-status" class="status" role="alert" hidden></div>
<fieldset><legend>${esc(r.g_contact)}</legend>
<div class="row2">${fld('name', r.name, { req: true, ac: 'name' })}${fld('company', r.company, { req: true, ac: 'organization' })}</div>
<div class="row2">${fld('email', r.email, { type: 'email', req: true, ac: 'email' })}
<div class="field" data-field="country"><label for="f-country">${esc(r.country)} <span class="tag tag-req">${esc(r.required)}</span></label>
<select id="f-country" name="country" required autocomplete="country-name" aria-describedby="e-country"><option value="">—</option>${countryOptions}</select><p class="err" id="e-country" role="alert"></p></div></div>
${fld('phone', r.phone, { type: 'tel', ac: 'tel' })}
</fieldset>
<fieldset id="need"><legend>${esc(r.g_need)}</legend>
<div class="field" data-field="need"><label for="f-need">${esc(r.need)} <span class="tag tag-req">${esc(r.required)}</span></label><p class="hint" id="h-need">${esc(r.need_hint)}</p>
<textarea id="f-need" name="need" rows="5" required aria-describedby="h-need e-need"></textarea><p class="err" id="e-need" role="alert"></p></div>
</fieldset>
<fieldset><legend>${esc(r.g_tech)}</legend><p class="hint">${esc(r.g_tech_hint)}</p>
<div class="field" data-field="valve_type"><label for="f-valve_type">${esc(r.valve_type)} <span class="tag">${esc(r.optional)}</span></label>
<select id="f-valve_type" name="valve_type" aria-describedby="e-valve_type"><option value="">${esc(r.vt_select)}</option><option value="ball">${esc(r.vt_ball)}</option><option value="butterfly">${esc(r.vt_butterfly)}</option><option value="gate">${esc(r.vt_gate)}</option><option value="check">${esc(r.vt_check)}</option><option value="unsure">${esc(r.vt_unsure)}</option></select><p class="err" id="e-valve_type" role="alert"></p></div>
<div class="row2">${fld('size', r.size, { hint: r.size_hint })}${fld('quantity', r.quantity)}</div>
<div class="row3">${fld('media', r.media, { hint: r.media_hint })}${fld('pressure', r.pressure, { hint: r.pressure_hint })}${fld('temperature', r.temperature, { hint: r.temperature_hint })}</div>
<div class="row2">${fld('materials', r.materials, { hint: r.materials_hint })}${fld('connection', r.connection, { hint: r.connection_hint })}</div>
${fld('application', r.application, { hint: r.application_hint })}
</fieldset>
<fieldset><legend>${esc(r.g_delivery)}</legend>
<div class="row2">${fld('delivery_date', r.delivery_date, { type: 'date' })}${fld('destination', r.destination, { hint: r.destination_hint })}</div>
<div class="field" data-field="files"><label for="f-files">${esc(r.files)} <span class="tag">${esc(r.optional)}</span></label><p class="hint" id="h-files">${esc(r.files_hint)}</p>
<input id="f-files" name="files[]" type="file" multiple accept=".pdf,.dwg,.dxf,.step,.stp,.jpg,.jpeg,.png" aria-describedby="h-files e-files"><ul class="filelist" id="filelist" aria-live="polite"></ul><p class="err" id="e-files" role="alert"></p></div>
</fieldset>
<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<input type="hidden" name="lang" value="${lang}">
<div class="ts-wrap"><div id="ts" class="cf-turnstile-slot"></div></div>
<p class="fine">${esc(r.privacy_note)} <a class="link" href="${href('contact')}#privacy">${esc(r.privacy_link)}</a></p>
<div class="submit-row"><button id="rfq-submit" class="btn btn-primary btn-lg" type="submit">${esc(r.submit)}</button></div>
</form>
</div>
<aside class="rfq-side">
<h2>${esc(rp.why_h)}</h2><p>${esc(rp.why_p)}</p>
<h2>${esc(rp.after_h)}</h2><p>${esc(rp.after_p)}</p>
</aside>
</div></section>`;
  add('rfq', rfqBody, { scripts: '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script><script src="/assets/rfq.js" defer></script>' });

  return pagesOut;
}

// ---------- write ----------
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });
for (const lang of LOCALES) {
  for (const { path, html } of build(lang)) {
    const dir = join(out, lang, path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
  }
}
// Root redirects to default locale. No sitemap on the preview. Disallow all.
writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta http-equiv="refresh" content="0;url=/${DEFAULT}/"><title>REVALX</title><a href="/${DEFAULT}/">REVALX</a>`);
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, '404.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not found | REVALX</title><link rel="stylesheet" href="/assets/site.css"><main class="wrap" style="padding:96px 16px"><h1>Page not found</h1><p><a class="link" href="/en/">REVALX home</a></p></main>`);
console.log('built', LOCALES.join(','), 'to', out);
