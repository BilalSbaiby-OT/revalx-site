(function(){
  var b=document.querySelector('.menu-btn'),n=document.getElementById('site-nav');
  if(b&&n){
    b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&n.classList.contains('open')){n.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus()}});
  }
  // FAQ: highlight the category being read
  var links=[].slice.call(document.querySelectorAll('.faq-nav a[data-cat]'));
  if(links.length&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.setAttribute('aria-current',a.dataset.cat===e.target.id?'true':'false')})}})},{rootMargin:'-20% 0px -65% 0px'});
    links.forEach(function(a){var t=document.getElementById(a.dataset.cat);if(t)io.observe(t)});
  }
  // valve preselect from ?valve=
  var vt=document.getElementById('f-valve_type'),q=new URLSearchParams(location.search).get('valve');
  if(vt&&q&&/^(ball|butterfly|gate|check)$/.test(q))vt.value=q;
})();
