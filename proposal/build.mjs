// REVALX proposal preview (RES-1379). English only, no dependencies.
// node proposal/build.mjs  (env: TURNSTILE_SITEKEY) -> proposal/dist
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');
const SITEKEY = process.env.TURNSTILE_SITEKEY || '1x00000000000000000000AA'; // Cloudflare always-pass test key
const COUNTRIES = JSON.parse(readFileSync(join(root, '..', 'site', 'i18n', 'en.json'), 'utf8')).countries;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const POSITIONING = 'REVALX is an international industrial valve trading company supplying ball valves, butterfly valves, gate valves and check valves to B2B customers across global markets.';
const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg>';
const BACK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 8H3M7 3.5 2.5 8 7 12.5"/></svg>';

// Simple blue line illustrations used as placeholders until the owner's custom visuals arrive.
const ILL = {
  ball: '<svg class="ill" viewBox="0 0 120 100" aria-hidden="true"><circle cx="60" cy="58" r="26"/><circle cx="60" cy="58" r="12"/><path d="M10 40h18v36H10zM92 40h18v36H92zM60 32V14M44 14h32"/><path d="M34 58h-6M92 58h-6"/></svg>',
  butterfly: '<svg class="ill" viewBox="0 0 120 100" aria-hidden="true"><circle cx="60" cy="58" r="34"/><circle cx="60" cy="58" r="26"/><ellipse cx="60" cy="58" rx="6" ry="22"/><path d="M60 24V10M46 10h28"/></svg>',
  gate: '<svg class="ill" viewBox="0 0 120 100" aria-hidden="true"><path d="M8 52h18v34H8zM94 52h18v34H94zM26 48h68v42H26z"/><path d="M48 48V20M72 48V20M60 20V8M44 8h32"/><path d="M48 62h24v14H48z"/></svg>',
  check: '<svg class="ill" viewBox="0 0 120 100" aria-hidden="true"><path d="M8 50h18v34H8zM94 50h18v34H94zM26 40h68v54H26z"/><path d="M46 52l22 15-22 15z"/><path d="M80 48v38"/></svg>'
};
const VALVES = [
  ['ball', 'Ball valves', 'Quarter-turn shut-off for a wide range of industrial applications.'],
  ['butterfly', 'Butterfly valves', 'Compact, efficient flow control and isolation for various industries.'],
  ['gate', 'Gate valves', 'Full-flow isolation for demanding environments.'],
  ['check', 'Check valves', 'Prevent reverse flow and protect the system.']
];

const IC = {
  select: '<svg viewBox="0 0 32 32"><path d="M6 10h8v6H6zM18 10h8v6h-8zM16 10V4M12 4h8M16 16v6M8 22h16"/></svg>',
  doc: '<svg viewBox="0 0 32 32"><path d="M8 3h11l6 6v20H8zM19 3v6h6M12 15h8M12 19h8M12 23h5"/></svg>',
  truck: '<svg viewBox="0 0 32 32"><path d="M3 9h17v13H3zM20 13h6l3 4v5H20zM8 26a2.5 2.5 0 1 0 0-.01M24 26a2.5 2.5 0 1 0 0-.01"/></svg>',
  file: '<svg viewBox="0 0 32 32"><path d="M8 3h11l6 6v20H8zM19 3v6h6M12 17h8M12 21h8"/></svg>',
  help: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12"/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1.2.7-1.5 1.3-1.5 2.5M16 22.5v.5"/></svg>',
  mail: '<svg viewBox="0 0 32 32"><path d="M4 8h24v16H4zM4 9l12 9 12-9"/></svg>',
  headset: '<svg viewBox="0 0 32 32"><path d="M6 18v-3a10 10 0 0 1 20 0v3M5 18h4v7H5zM23 18h4v7h-4zM23 25c0 2-3 3-7 3"/></svg>',
  globe: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4c-5 6-5 18 0 24M16 4c5 6 5 18 0 24"/></svg>',
  gear: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="4"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M24.5 7.5l-2.8 2.8M10.3 21.7l-2.8 2.8"/></svg>',
  upload: '<svg viewBox="0 0 32 32"><path d="M16 22V6M10 12l6-6 6 6M5 22v5h22v-5"/></svg>',
  valve: '<svg viewBox="0 0 32 32"><path d="M4 18h6v8H4zM22 18h6v8h-6zM10 14h12v16H10zM16 14V6M11 6h10"/></svg>',
  chain: '<svg viewBox="0 0 32 32"><path d="M13 19l6-6M11 15l-3 3a4 4 0 0 0 6 6l3-3M21 17l3-3a4 4 0 0 0-6-6l-3 3"/></svg>',
  hands: '<svg viewBox="0 0 32 32"><path d="M3 15l6-5 5 2 5-2 6 5-8 9-4-2-4 2zM9 10l-2 3"/></svg>'
};
const ico = k => IC[k].replace('<svg ', '<svg aria-hidden="true" ');

const NAV = [['products', '/products', 'Products'], ['faq', '/faq', 'FAQ'], ['spec', '/image-spec', 'Image specification']];

function layout({ key, title, desc, body, scripts = '' }) {
  const nav = NAV.map(([k, h, l]) => `<li><a href="${h}"${key === k ? ' aria-current="page"' : ''}>${l}</a></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | REVALX (proposal preview)</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0a1c32">
<link rel="icon" href="/assets/logo-navy-720.png" type="image/png">
<link rel="preload" href="/assets/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="ribbon" role="note"><div class="wrap"><strong>Proposal preview.</strong> Not the live site, not indexed. Specification values and images are placeholders until verified documents and the owner's visuals arrive.</div></div>
<header class="site-header"><div class="wrap header-in">
<a class="brand" href="/" aria-label="REVALX home"><img src="/assets/logo-light-720.png" width="204" height="68" alt="REVALX Industrial Supply &amp; Solutions"></a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
<nav id="site-nav" class="site-nav" aria-label="Main"><ul>${nav}</ul><a class="btn btn-red btn-sm" href="/request-a-quote">Request a Quote ${ARROW}</a></nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap foot">
<div><img src="/assets/logo-navy-720.png" width="216" height="72" alt="REVALX Industrial Supply &amp; Solutions"><p>${esc(POSITIONING)}</p></div>
<div><p class="foot-h">Preview pages</p><ul><li><a href="/request-a-quote">Request a Quote</a></li><li><a href="/faq">FAQ</a></li><li><a href="/products">Products</a></li><li><a href="/products/trunnion-mounted-ball-valve">Product detail template</a></li><li><a href="/image-spec">Image specification</a></li></ul></div>
<div><p class="foot-h">Contact</p><p><a href="mailto:support@revalx.eu">support@revalx.eu</a></p><p>Enquiries and delivery destinations are subject to commercial feasibility, applicable regulations and confirmed supply capabilities.</p></div>
</div><div class="wrap foot-base">© REVALX. Proposal preview, not for publication.</div></footer>
<script src="/assets/site.js" defer></script>
${scripts}
</body>
</html>`;
}

const pages = [];
const add = (path, p) => pages.push({ path, html: layout(p) });

// ---------- shared pieces ----------
const heroArt = label => `<div class="hero-art" aria-hidden="true"><svg class="lines" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#5f7fb8" stroke-width=".8"><circle cx="270" cy="130" r="96"/><circle cx="270" cy="130" r="70"/><circle cx="270" cy="130" r="30"/><path d="M0 130h400M270 0v260M60 40h210M60 220h210" stroke-dasharray="6 5"/></svg><div class="slot-dark">${label}</div></div>`;

// ---------- Home (index of the proposal) ----------
add('', {
  key: 'home', title: 'Proposal preview', desc: 'Proposal preview of the REVALX request-a-quote, FAQ, catalogue and product pages.',
  body: `
<section class="hero home-hero"><div class="wrap">
<div><p class="eyebrow">Proposal preview</p><h1>Four pages,<br>one design system</h1>
<p class="lead">${esc(POSITIONING)}</p>
<div class="kicker-list"><a class="btn btn-red" href="/request-a-quote">Request a Quote ${ARROW}</a><a class="btn btn-line" href="/faq" style="background:transparent;color:#fff;border-color:#fff">FAQ</a></div></div>
${heroArt('Hero image slot H1 &middot; see Image specification')}
</div></section>
<section class="wrap blk"><p class="sec-label">The pages in this preview</p>
<ul class="pages">
<li><a href="/request-a-quote"><b>Request a Quote</b><span>Contact, product, delivery and upload sections. Reuses the existing enquiry reference and submission process.</span></a></li>
<li><a href="/faq"><b>FAQ</b><span>Five categories, accessible accordions, contact section at the bottom.</span></a></li>
<li><a href="/products"><b>Product catalogue</b><span>Ball, butterfly, gate and check valves in a two-column grid with a technical information section.</span></a></li>
<li><a href="/products/trunnion-mounted-ball-valve"><b>Product detail</b><span>The reusable template, rendered for one product, with a blue technical drawing area.</span></a></li>
</ul></section>
<section class="wrap notes"><p class="sec-label">What is real and what is placeholder</p>
<ul>
<li><strong>Brand.</strong> Navy, red and white. The logo files are the originals from the owner's email of 19 October, shown unmodified except for scaled-down copies for faster loading.</li>
<li><strong>Images.</strong> Every picture is a marked slot with a simple line illustration. Sizes, ratios and formats are on the <a href="/image-spec">Image specification</a> page.</li>
<li><strong>Specifications.</strong> The product detail page holds no values. Each row says it is pending a verified manufacturer datasheet. Nothing here is a product claim.</li>
<li><strong>Technical drawing.</strong> A generic schematic in brand blue on white, with dimension letters only. It is not a drawing of any real product.</li>
<li><strong>Quote form.</strong> It works end to end: validation, file upload, duplicate protection and an enquiry reference. On this preview, submissions go to a separate test store and never to the team's real enquiry flow.</li>
<li><strong>Not in this preview.</strong> Homepage, About, Industries, Why REVALX and Technical Supply pages; all other locales; supplier-quote comparison and a customer quote portal.</li>
</ul></section>`
});

// ---------- FAQ ----------
const FAQ = [
  ['product', 'Product Selection', 'Choosing the right valve', 'select', [
    ['How do I choose the right valve for my application?', 'The right valve depends on the fluid, operating pressure and temperature, material compatibility and the end connection. If you are not sure, describe the application in a quote request and our team will come back with questions or a suggestion.'],
    ['What is the difference between a ball valve and a butterfly valve?', 'A ball valve closes with a rotating ball that has a bore through it. A butterfly valve closes with a disc turning on a central shaft. Both are quarter-turn valves. Ball valves are usually longer and heavier; butterfly valves are compact, which helps in large sizes. The best choice depends on pressure, media and the shut-off you need.'],
    ['When should I use a gate valve?', 'Gate valves are used for on/off isolation where a straight, full-flow path matters and the valve is operated infrequently. They are not intended for throttling.'],
    ['Can I use your valves for corrosive environments?', 'That depends on the body and trim material and on the medium. Give us the medium, concentration and temperature in your request, and we will confirm which material options the manufacturer lists for it.'],
    ['Do you offer manual and actuated valves?', 'Both are possible. Tell us the operation you need (manual lever, gear, electric or pneumatic actuator) in the request form, and we will quote what the manufacturer can supply.']
  ]],
  ['tech', 'Technical Specifications', 'Materials, standards and ratings', 'doc', [
    ['Which international standards do your valves comply with?', 'Each valve is built to the standards stated on its manufacturer datasheet. We quote to the standard you specify where the manufacturer confirms it. Name the standard you need in your request.'],
    ['What materials are available?', 'Common body materials for industrial valves include carbon steel, stainless steel and duplex grades. What is available for a given item depends on the manufacturer, so we confirm it in the quotation.'],
    ['What pressure ratings do you offer?', 'Pressure ratings (PN or Class) depend on the product and size. The rating of an item is the one on its datasheet. Tell us the rating you need and we will check it against what the manufacturer supplies.'],
    ['Can you provide custom specifications?', 'Send us the specification you need, with drawings or a datasheet if you have them. We take it to the manufacturers and tell you what can be supplied and on what terms.']
  ]],
  ['orders', 'Orders & Delivery', 'Lead times, shipping and logistics', 'truck', [
    ['What are the typical lead times?', 'Lead time depends on the product, size, quantity and the manufacturer\'s confirmed schedule. We state the lead time in each quotation rather than quoting a general figure.'],
    ['Do you ship worldwide?', 'We supply B2B customers internationally. Delivery to a given destination depends on commercial feasibility, applicable regulations and confirmed supply capabilities, so please give your destination country in the request and we will confirm.'],
    ['What Incoterms do you work with?', 'Tell us the Incoterms you prefer in the request form. We confirm the terms we can offer for your destination in the quotation.'],
    ['How is the product packaged?', 'Packing is agreed per order and depends on valve type, size and transport. If you have packing requirements, include them in the request.']
  ]],
  ['docs', 'Documentation', 'Datasheets, drawings and certificates', 'file', [
    ['Can I get a datasheet for a specific product?', 'Where a verified manufacturer datasheet exists for the item, we can provide it with the quotation. Product pages show a datasheet button only when a verified document is available.'],
    ['Do you provide technical drawings?', 'Dimensional drawings are provided where the manufacturer supplies them. Drawings on this website are only published from verified documentation.'],
    ['Can I request certificates (e.g. EN 10204 3.1)?', 'Yes, ask for the certificate you need in your request. Availability depends on what the manufacturer can issue for the item, and we confirm it in the quotation.']
  ]],
  ['general', 'General Enquiries', 'Company, partnership and support', 'help', [
    ['What does REVALX do?', 'REVALX is an international industrial valve trading company. We buy valves from manufacturers and supply them to B2B customers. We are not a manufacturer.'],
    ['Who do you supply?', 'Business customers: contractors, plant operators, distributors and project teams that need industrial valves. We do not sell to consumers.'],
    ['How do I get a quote?', 'Use the Request a Quote form. Fields you do not know can stay empty; the contact details, valve type and quantity are enough to start. You receive an enquiry reference when you submit.'],
    ['How do I contact the team directly?', 'Write to support@revalx.eu and include your enquiry reference if you have one.']
  ]]
];
const faqNav = FAQ.map(([id, h, sub, ic], i) => `<a href="#${id}"${i === 0 ? ' aria-current="true"' : ''} data-cat="${id}">${ico(ic)}<span><b>${esc(h)}</b><small>${esc(sub)}</small></span></a>`).join('');
const faqBody = FAQ.map(([id, h, , , qs]) => `<section class="faq-cat" id="${id}" aria-labelledby="h-${id}"><p class="sec-label" id="h-${id}">${esc(h)}</p><div class="acc">${qs.map(([q, a], i) => `<details${id === 'product' && i === 0 ? ' open' : ''}><summary>${esc(q)}<span class="pm" aria-hidden="true"></span></summary><div class="body"><p>${esc(a)}</p></div></details>`).join('')}</div></section>`).join('');
add('faq', {
  key: 'faq', title: 'FAQ', desc: 'Answers to common questions about REVALX products, technical specifications, orders and documentation.',
  body: `
<section class="hero"><div class="wrap"><div><h1>FAQ</h1><p class="lead">Find answers to common questions about our products, technical specifications, orders and documentation.</p></div>${heroArt('Hero image slot H1 &middot; see Image specification')}</div></section>
<div class="wrap faq">
<nav class="faq-nav" aria-label="FAQ categories">${faqNav}
<div class="faq-help"><b>Still have questions?</b><p>Our team is here to help. Write to us or send a request.</p><a class="btn btn-line btn-sm" href="#contact" style="width:100%">Contact us ${ARROW}</a></div></nav>
<div class="faq-list">${faqBody}</div></div>
<section class="band-contact" id="contact"><div class="wrap">
<div><p class="eyebrow">Need further assistance?</p><h2>Contact<br>our team</h2><p style="color:#d7dfea;font-size:.875rem;margin:12px 0 18px">If you cannot find the answer you are looking for, write to <a href="mailto:support@revalx.eu">support@revalx.eu</a> or send a request.</p><a class="btn btn-red btn-sm" href="/request-a-quote">Get in touch ${ARROW}</a></div>
<div class="trio"><div><b>Expert support</b><span>From our technical and sales team</span></div><div><b>International supply</b><span>Subject to feasibility and regulations</span></div><div><b>Clear process</b><span>An enquiry reference and a written quotation</span></div></div>
</div></section>`,
  scripts: ''
});

// ---------- Catalogue ----------
const TECH = [
  ['Design standards', 'Typical reference standards by type: ball valves ISO 17292 and API 6D; butterfly valves EN 593 and API 609; gate valves EN 1984, API 600 and API 6D; check valves EN 12334 and API 6D. The standard for a quoted item is the one stated on the manufacturer\'s datasheet.'],
  ['Materials', 'Body materials commonly include carbon steel, stainless steel and duplex. Seat, seal and trim options depend on the manufacturer and the medium. We confirm the material of each quoted item in writing.'],
  ['Connections', 'Flanged, wafer, lug, butt-weld and threaded ends exist across these valve types. Tell us the connection and flange standard you need.'],
  ['Pressure ratings', 'Ratings are given as PN or Class and depend on type, size and material. The rating of an item is the one on its datasheet.'],
  ['Documentation', 'Where the manufacturer supplies them, we can provide datasheets, dimensional drawings and material certificates (for example EN 10204 3.1) with the quotation.']
];
add('products', {
  key: 'products', title: 'Industrial valves', desc: 'Ball, butterfly, gate and check valves supplied to B2B customers by REVALX.',
  body: `
<div class="wrap">
<div class="catalogue-head"><div><p class="eyebrow">Products</p><h1>Industrial<br>valves</h1></div><p>Industrial valves from third-party manufacturers, supplied by REVALX to B2B customers internationally.</p></div>
<ul class="pgrid">${VALVES.map(([k, n, d], i) => {
    const href = k === 'ball' ? '/products/trunnion-mounted-ball-valve' : '/request-a-quote?valve=' + k;
    return `<li><a class="pcard" href="${href}"><span class="num">0${i + 1}</span><div class="slot ar-43">${ILL[k]}<span class="tag">Image slot P${i + 1} &middot; 1600 &times; 1200 px (4:3)</span></div><h2>${esc(n)} ${ARROW}</h2><p>${esc(d)}</p></a></li>`;
  }).join('')}</ul>
<section class="tech-info" aria-labelledby="ti-h"><h2 id="ti-h">Technical information</h2><div class="acc">${TECH.map(([h, b], i) => `<details><summary><span class="n">0${i + 1}</span>${esc(h)}<span class="pm" aria-hidden="true"></span></summary><div class="body"><p>${esc(b)}</p></div></details>`).join('')}</div>
<p class="center"><a class="btn btn-navy" href="/faq#tech">More technical questions ${ARROW}</a></p></section>
<p style="margin:40px 0 64px;color:var(--mute);font-size:.875rem">In this preview only the ball valve links to a full product page; the other three would use the same template. Their cards go to the quote form with the valve type preselected.</p>
</div>`
});

// ---------- Product detail ----------
const SPECS = ['Nominal size (DN)', 'Pressure rating (PN / Class)', 'Temperature range', 'Design standard', 'Face-to-face', 'End connection', 'Body material', 'Seats', 'Operation', 'Applications'];
const drawing = `<svg viewBox="0 0 960 360" role="img" aria-labelledby="dw-t dw-d"><title id="dw-t">Technical drawing schematic, trunnion mounted ball valve</title><desc id="dw-d">Generic schematic in brand blue: side view with length L, flange diameter D and height H, and end view with bolt circle K and flange diameter D. No dimensions are stated.</desc>
<g><!-- side view -->
<rect x="64" y="124" width="26" height="148"/><rect x="450" y="124" width="26" height="148"/>
<path d="M90 148h360v100H90z"/>
<circle cx="270" cy="198" r="76"/><circle cx="270" cy="198" r="52"/>
<path d="M90 178h54M396 178h54M90 218h54M396 218h54"/>
<path d="M40 198h460" stroke-dasharray="14 5 3 5"/>
<rect x="252" y="76" width="36" height="72"/><rect x="232" y="62" width="76" height="14"/>
<ellipse cx="270" cy="40" rx="104" ry="11"/><path d="M270 62V51"/>
<path d="M64 124h26M450 124h26M64 272h26M450 272h26M64 148v100"/>
<!-- L -->
<path d="M64 308h412M64 296v24M476 296v24"/><text x="262" y="334">L</text>
<!-- D -->
<path d="M30 124v148M20 124h50M20 272h50"/><text x="4" y="204">D</text>
<!-- H -->
<path d="M510 40v232M500 40h14M500 272h14"/><text x="520" y="160">H</text>
</g>
<g><!-- end view -->
<circle cx="740" cy="198" r="104"/><circle cx="740" cy="198" r="84"/>
<circle cx="740" cy="198" r="48"/><circle cx="740" cy="198" r="36"/>
${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<circle cx="${(740 + 66 * Math.cos(r)).toFixed(1)}" cy="${(198 + 66 * Math.sin(r)).toFixed(1)}" r="7"/>`; }).join('')}
<path d="M636 198h208M740 94v208" stroke-dasharray="14 5 3 5"/>
<rect x="726" y="60" width="28" height="34"/>
<path d="M636 40h208M636 28v24M844 28v24"/><text x="733" y="26">W</text>
<path d="M880 94v208M872 94h16M872 302h16"/><text x="894" y="204">ØD</text>
<path d="M858 132v132M850 132h16M850 264h16"/><text x="824" y="292">ØK</text>
<path d="M787 151l28-33h35"/><text x="818" y="110">n-Ød</text>
</g></svg>`;
add('products/trunnion-mounted-ball-valve', {
  key: 'products', title: 'Trunnion mounted ball valve', desc: 'Product detail template: trunnion mounted ball valve, specification table and technical drawing area.',
  body: `
<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/products">${BACK} Back to products</a><span aria-hidden="true">&rsaquo;</span><span>Ball valves</span></nav>
<p class="eyebrow">Ball valves</p>
<h1>Trunnion mounted<br>ball valve</h1>
<div class="pdetail">
<div>
<div class="slot ar-43">${ILL.ball}<span class="tag">Image slot D1 &middot; main product image &middot; 1800 &times; 1350 px (4:3)</span></div>
<div class="thumbs">${[2, 3, 4, 5].map(n => `<div class="slot"><span class="tag">D${n} &middot; 800 &times; 600</span></div>`).join('')}</div>
</div>
<div class="side">
<p>A trunnion mounted ball valve holds the ball on a fixed shaft at the top and bottom. It is a common choice for large-diameter and higher-pressure lines. The specification of any item we quote is taken from the manufacturer's datasheet.</p>
<a class="btn btn-red" href="/request-a-quote?valve=ball">Request a Quote ${ARROW}</a>
<span class="btn btn-line btn-off" role="note">Download Datasheet<small>Shown only when a verified document exists</small></span>
</div></div>
<section class="blk" aria-labelledby="sp-h"><p class="sec-label" id="sp-h">Specifications</p>
<table class="spec"><caption class="sr">Specifications, values pending verified datasheet</caption><tbody>${SPECS.map(s => `<tr><th scope="row">${esc(s)}</th><td><span class="pending-chip">Pending verified datasheet</span></td></tr>`).join('')}</tbody></table>
<p style="font-size:.8125rem;color:var(--mute);margin-top:10px">Template note: the rows are the owner's list. A value is entered only when it comes from a manufacturer document.</p></section>
<section class="blk" aria-labelledby="td-h"><p class="sec-label" id="td-h">Technical drawing</p>
<figure class="drawing" style="margin:6px 0 0">${drawing}<figcaption>Generic schematic in brand blue, dimension letters only. Replaced by the verified drawing for the item once the manufacturer's document is available.</figcaption></figure></section>
<p style="margin:44px 0 72px"><a class="btn btn-navy" href="/request-a-quote?valve=ball">Request a Quote for this valve ${ARROW}</a></p>
</div>`
});

// ---------- Request a Quote ----------
const countryOpts = COUNTRIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
const fld = (name, label, { type = 'text', req = false, ph = '', ac = '', hint = '' } = {}) => `<div class="field" data-field="${name}"><label for="f-${name}">${esc(label)} ${req ? '<span class="req" aria-hidden="true">*</span><span class="sr"> required</span>' : '<span class="opt">(optional)</span>'}</label>${hint ? `<p class="hint" id="h-${name}">${esc(hint)}</p>` : ''}<input id="f-${name}" name="${name}" type="${type}"${req ? ' required' : ''}${ac ? ` autocomplete="${ac}"` : ''}${ph ? ` placeholder="${esc(ph)}"` : ''}${hint ? ` aria-describedby="h-${name} e-${name}"` : ` aria-describedby="e-${name}"`}><p class="err" id="e-${name}" role="alert"></p></div>`;
const sel = (name, label, opts, { req = false, ph = 'Select' } = {}) => `<div class="field" data-field="${name}"><label for="f-${name}">${esc(label)} ${req ? '<span class="req" aria-hidden="true">*</span><span class="sr"> required</span>' : '<span class="opt">(optional)</span>'}</label><select id="f-${name}" name="${name}"${req ? ' required' : ''} aria-describedby="e-${name}"><option value="">${esc(ph)}</option>${opts}</select><p class="err" id="e-${name}" role="alert"></p></div>`;
const o = arr => arr.map(x => Array.isArray(x) ? `<option value="${esc(x[0])}">${esc(x[1])}</option>` : `<option>${esc(x)}</option>`).join('');
const MSG = { req: 'This field is required.', email: 'Enter a valid email address, for example name@company.com.', count: 'You can attach up to 10 files.', type: 'This file type is not accepted: ', size: 'This file is larger than 20 MB: ', summary: 'Please correct the highlighted fields.', turnstile: 'Please wait for the spam check to finish, then send again.', server: 'We could not send your request. Your entries are kept: please try again.', sending: 'Sending...', submit: 'Submit request', retry: 'Try again', remove: 'Remove', consent: 'Please accept the data processing notice.' };
add('request-a-quote', {
  key: 'rfq', title: 'Request a Quote', desc: 'Request a quote for industrial valves from REVALX: contact, product requirements, delivery and technical documents.',
  body: `
<section class="hero"><div class="wrap"><div><p class="eyebrow">Request a quote</p><h1>Get a quote<br>for your project</h1><p class="lead">Tell us about your requirements and our team will prepare a written quotation.</p></div>
<div class="hero-art"><ul class="hero-points" style="position:relative;z-index:1;margin-top:8px"><li>${ico('chain')}Structured enquiry handling</li><li>${ico('headset')}Technical coordination</li><li>${ico('globe')}International B2B supply</li><li>${ico('hands')}Written quotation with an enquiry reference</li></ul></div></div></section>
<div class="wrap rfq-grid">
<div class="rfq-main">
<div id="rfq-ok" class="ok" hidden tabindex="-1"><h2>Request received</h2><p>Your enquiry reference</p><p class="ok-ref" id="rfq-ref"></p><p>Keep this reference. Our team will respond to the business email you gave.</p><p class="hint" style="font-size:.8125rem">Preview: this request went to a test store, not to the REVALX team.</p><p><a class="btn btn-line" href="/request-a-quote">Send another request</a></p></div>
<form id="rfq-form" action="/api/rfq" method="post" enctype="multipart/form-data" novalidate data-sitekey="${esc(SITEKEY)}" data-msg='${esc(JSON.stringify(MSG))}'>
<div id="rfq-status" class="status" role="alert" hidden></div>
<p style="font-size:.8125rem;color:var(--mute);margin:0 0 22px"><span class="req" style="color:var(--red)">*</span> Required. Fields you do not know can stay empty.</p>
<fieldset><legend>1. Contact information</legend>
<div class="row2">${fld('name', 'Full name', { req: true, ac: 'name', ph: 'John Doe' })}${fld('email', 'Business email', { type: 'email', req: true, ac: 'email', ph: 'you@company.com' })}</div>
<div class="row2">${fld('phone', 'Phone number', { type: 'tel', ac: 'tel', ph: '+34 612 345 678' })}${fld('company', 'Company name', { req: true, ac: 'organization', ph: 'Company name' })}</div>
<div class="row2">${sel('country', 'Country', countryOpts, { req: true, ph: 'Select country' })}${fld('company_website', 'Company website', { type: 'url', ac: 'url', ph: 'https://' })}</div>
</fieldset>
<fieldset id="need"><legend>2. Product requirements</legend>
<div class="row2">${sel('valve_type', 'Valve type', o([['ball', 'Ball valve'], ['butterfly', 'Butterfly valve'], ['gate', 'Gate valve'], ['check', 'Check valve'], ['unsure', 'Not sure yet']]), { req: true, ph: 'Select valve type' })}${fld('quantity', 'Quantity', { req: true, ph: 'e.g. 100 units' })}</div>
<div class="row2">${fld('size', 'Nominal size (DN/NPS)', { ph: 'e.g. DN100' })}${fld('pressure', 'Pressure rating (PN/Class)', { ph: 'e.g. PN16' })}</div>
<div class="row3">${fld('materials', 'Body material', { ph: 'e.g. carbon steel' })}${sel('connection', 'Connection type', o(['Flanged', 'Wafer', 'Lug', 'Butt-weld', 'Threaded', 'Other']))}${sel('actuation', 'Actuation', o(['Manual lever', 'Gear operated', 'Electric actuator', 'Pneumatic actuator', 'Other']))}</div>
<div class="field" data-field="application"><label for="f-application">Application / operating conditions <span class="opt">(optional)</span></label><textarea id="f-application" name="application" rows="4" placeholder="Describe the application, medium, temperature, pressure or any other relevant details." aria-describedby="e-application"></textarea><p class="err" id="e-application" role="alert"></p></div>
</fieldset>
<fieldset><legend>3. Delivery &amp; additional information</legend>
<div class="row3">${sel('destination', 'Destination country', countryOpts, { ph: 'Select country' })}${fld('delivery_date', 'Required delivery date', { type: 'date' })}${sel('incoterms', 'Preferred Incoterms', o(['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP']))}</div>
<div class="field" data-field="comments"><label for="f-comments">Additional information <span class="opt">(optional)</span></label><textarea id="f-comments" name="comments" rows="4" placeholder="Any other requirements, standards, testing or special requests." aria-describedby="e-comments"></textarea><p class="err" id="e-comments" role="alert"></p></div>
</fieldset>
<fieldset><legend>4. Attach technical documents</legend>
<div class="field" data-field="files"><div class="drop"><label class="pick" for="f-files">${ico('upload')}<span><strong>Click to choose files</strong><small>PDF, DWG, DXF, STEP, STP, JPG or PNG. Up to 10 files, 20 MB each.</small></span></label><small style="color:var(--mute);font-size:.75rem">Datasheets, technical drawings, specifications or other supporting documents. Files are checked before they are stored.</small><input id="f-files" name="files[]" type="file" multiple accept=".pdf,.dwg,.dxf,.step,.stp,.jpg,.jpeg,.png" aria-describedby="e-files"></div><ul class="filelist" id="filelist" aria-live="polite"></ul><p class="err" id="e-files" role="alert"></p></div>
</fieldset>
<div class="hp" aria-hidden="true"><label>Website <input type="text" name="hp" tabindex="-1" autocomplete="off"></label></div>
<input type="hidden" name="lang" value="en">
<div class="field" data-field="consent"><label class="consent" for="f-consent"><input id="f-consent" name="consent" type="checkbox" aria-describedby="e-consent"><span>I agree to the processing of my data to answer this request. [Privacy policy: link pending, the page is not yet written.]</span></label><p class="err" id="e-consent" role="alert"></p></div>
<div id="ts" style="margin:0 0 16px"></div>
<button id="rfq-submit" class="btn btn-red btn-lg" type="submit">Submit request ${ARROW}</button>
</form></div>
<aside class="rfq-side">
<div class="card"><h2>Why REVALX?</h2><ul><li>${ico('valve')}Ball, butterfly, gate and check valves</li><li>${ico('gear')}Technical coordination on your specification</li><li>${ico('globe')}International B2B supply</li><li>${ico('doc')}Written quotation with an enquiry reference</li></ul></div>
<div class="help"><h2>Need help defining your requirements?</h2><p>Our technical team can talk through your application with you before you send the form.</p><a class="btn" href="mailto:support@revalx.eu">Contact our team ${ARROW}</a></div>
<p style="font-size:.75rem;color:var(--mute);margin-top:16px">Preview: submissions here are stored in a separate test store and are never sent to the team's real enquiry flow.</p>
</aside></div>`,
  scripts: '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script><script src="/assets/rfq.js" defer></script>'
});

// ---------- Image specification ----------
add('image-spec', {
  key: 'spec', title: 'Image specification', desc: 'Dimensions, ratios and formats for the custom REVALX images.',
  body: `
<div class="wrap"><div class="catalogue-head"><div><p class="eyebrow">For the owner's image brief</p><h1>Image<br>specification</h1></div><p>Every placeholder on the preview pages carries a slot code. This page lists what each slot needs. Until approved images arrive, pages keep a placeholder or a simple blue line illustration.</p></div>
<p class="sec-label">Placements</p>
<div style="overflow-x:auto"><table class="dims"><thead><tr><th>Slot</th><th>Where</th><th>Pixels (w &times; h)</th><th>Ratio</th><th>Format</th><th>Max file size</th></tr></thead><tbody>
<tr><td>H1</td><td>Navy page hero, right side (FAQ, Request a Quote, home)</td><td>1600 &times; 1200</td><td>4:3</td><td>WebP, PNG fallback; transparent or navy #0a1c32 background</td><td>300 KB</td></tr>
<tr><td>P1&ndash;P4</td><td>Catalogue cards: ball, butterfly, gate, check</td><td>1600 &times; 1200</td><td>4:3</td><td>WebP, PNG fallback; light grey #f1f3f6 or transparent background</td><td>250 KB each</td></tr>
<tr><td>D1</td><td>Product detail, main image</td><td>1800 &times; 1350</td><td>4:3</td><td>WebP, PNG fallback; light grey #f1f3f6 background</td><td>350 KB</td></tr>
<tr><td>D2&ndash;D5</td><td>Product detail, alternative views (thumbnails)</td><td>800 &times; 600</td><td>4:3</td><td>WebP, PNG fallback</td><td>100 KB each</td></tr>
<tr><td>T1</td><td>Technical drawing, below the specifications</td><td>SVG preferred; otherwise 2400 &times; 1000 PNG</td><td>12:5</td><td>SVG (brand blue linework #1f4aa8 on white or #f6f8fc), no grey linework</td><td>200 KB</td></tr>
</tbody></table></div>
<p class="sec-label" style="margin-top:36px">Rules for all images</p>
<ul class="notes" style="padding-top:0;padding-bottom:0">
<li>Colour space sRGB. Provide each raster at 2&times; the pixel size above, so it stays sharp on high-density screens. The site serves a smaller copy to small screens.</li>
<li>Brand colours: navy #0a1c32, red #d6001c, drawing blue #1f4aa8, light grey #f1f3f6. These are measured from the logo files and the owner's mockups; please confirm exact values.</li>
<li>One visual style across the four categories, with technically accurate shapes for each type.</li>
<li>No generic stock imagery. Illustrative renders must not suggest REVALX-owned stock, warehouses, factories or completed projects.</li>
<li>File names: <code>slot-category-view.webp</code>, for example <code>p1-ball-valve.webp</code>. Alt text is written on the site, not in the file.</li>
<li>Technical drawings and specification tables are published only from verified manufacturer documents. A drawing for an item the owner has not documented stays on the placeholder schematic.</li>
</ul>
<p class="sec-label" style="margin-top:36px">Logo files in use</p>
<p>From the owner's email of 19 October: the full-colour logo with tagline on white backgrounds, and the white-on-navy logo on the navy footer. The files are shown unmodified, only scaled down proportionally for faster loading.</p>
<p style="margin-bottom:72px"></p></div>`
});

// ---------- write ----------
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });
for (const { path, html } of pages) {
  const dir = join(out, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, '404.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not found | REVALX</title><link rel="stylesheet" href="/assets/site.css"><main class="wrap" style="padding:96px 16px"><h1>Page not found</h1><p><a href="/">Proposal preview home</a></p></main>`);
console.log('built', pages.length, 'pages to', out);
