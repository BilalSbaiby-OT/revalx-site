(function(){
  var b=document.querySelector('.menu-btn'),n=document.getElementById('site-nav');
  if(!b||!n)return;
  b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&n.classList.contains('open')){n.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus()}});
})();
