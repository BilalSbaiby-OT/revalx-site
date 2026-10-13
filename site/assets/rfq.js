// RFQ form. Contract: POST /api/rfq multipart, header Idempotency-Key (one UUID per form load),
// field lang. 201 {enquiry_id}; 422/4xx {errors:{field:msg}}; 5xx/429/network: keep data, retry with same key.
(function(){
  var form=document.getElementById('rfq-form'); if(!form)return;
  var M=JSON.parse(form.getAttribute('data-msg'));
  var key=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
  var btn=document.getElementById('rfq-submit'),status=document.getElementById('rfq-status'),list=document.getElementById('filelist'),fileIn=document.getElementById('f-files');
  var OKEXT=/\.(pdf|dwg|dxf|step|stp|jpe?g|png)$/i,MAX=20*1024*1024,MAXN=10;
  var files=[],busy=false,wid=null,token='';

  function initTs(){
    if(!window.turnstile){setTimeout(initTs,300);return}
    wid=turnstile.render('#ts',{sitekey:form.getAttribute('data-sitekey'),callback:function(t){token=t},'expired-callback':function(){token=''},'error-callback':function(){token=''}});
  }
  initTs();

  function setErr(name,msg){
    var f=form.querySelector('[data-field="'+name+'"]'),e=document.getElementById('e-'+name);
    if(!e)return; e.textContent=msg||''; if(f)f.classList.toggle('invalid',!!msg);
    var inp=f&&f.querySelector('input,select,textarea'); if(inp){if(msg)inp.setAttribute('aria-invalid','true');else inp.removeAttribute('aria-invalid')}
  }
  function clearAll(){form.querySelectorAll('.err').forEach(function(e){e.textContent=''});form.querySelectorAll('.field').forEach(function(f){f.classList.remove('invalid')});form.querySelectorAll('[aria-invalid]').forEach(function(i){i.removeAttribute('aria-invalid')});status.hidden=true}
  function showStatus(m){status.textContent=m;status.hidden=false}

  function renderFiles(){
    list.innerHTML='';
    files.forEach(function(f,i){
      var li=document.createElement('li'),s=document.createElement('span');s.textContent=f.name+' ('+(f.size/1048576).toFixed(1)+' MB)';
      var r=document.createElement('button');r.type='button';r.textContent=M.remove;r.setAttribute('aria-label',M.remove+' '+f.name);
      r.addEventListener('click',function(){files.splice(i,1);renderFiles();validateFiles()});
      li.appendChild(s);li.appendChild(r);list.appendChild(li);
    });
  }
  function validateFiles(){
    if(files.length>MAXN){setErr('files',M.count);return false}
    for(var i=0;i<files.length;i++){
      if(!OKEXT.test(files[i].name)){setErr('files',M.type+files[i].name);return false}
      if(files[i].size>MAX){setErr('files',M.size+files[i].name);return false}
    }
    setErr('files','');return true;
  }
  fileIn.addEventListener('change',function(){
    for(var i=0;i<fileIn.files.length;i++)files.push(fileIn.files[i]);
    fileIn.value='';renderFiles();validateFiles();
  });

  function validate(){
    var ok=true,first=null;
    ['name','company','email','country','need'].forEach(function(n){
      var el=form.querySelector('[name="'+n+'"]'),v=(el.value||'').trim(),msg='';
      if(!v)msg=M.req; else if(n==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))msg=M.email;
      setErr(n,msg); if(msg){ok=false;if(!first)first=el}
    });
    if(!validateFiles()){ok=false;if(!first)first=fileIn}
    if(first)first.focus();
    return ok;
  }

  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    if(busy)return;               // double-click guard; the Idempotency-Key is the server-side guard
    clearAll();
    if(!validate()){showStatus(M.summary);return}
    if(!token){showStatus(M.turnstile);return}
    send();
  });

  function send(){
    busy=true;btn.disabled=true;btn.setAttribute('aria-disabled','true');btn.textContent=M.sending;
    var fd=new FormData(form);
    fd.delete('files[]');
    files.forEach(function(f){fd.append('files[]',f,f.name)});
    fd.set('lang',form.getAttribute('data-lang'));
    var ctl=new AbortController(),to=setTimeout(function(){ctl.abort()},120000);
    fetch(form.action,{method:'POST',body:fd,headers:{'Idempotency-Key':key,'Accept':'application/json'},signal:ctl.signal,credentials:'same-origin'})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {s:r.status,j:j}})})
      .then(function(x){
        clearTimeout(to);
        if(x.s===200||x.s===201){done(x.j.enquiry_id);return}
        if(x.s>=400&&x.s<500&&x.s!==429&&x.s!==408){fieldErrors(x.j&&x.j.errors);return}
        failed();
      })
      .catch(function(){clearTimeout(to);failed()});
  }
  function release(label){busy=false;btn.disabled=false;btn.removeAttribute('aria-disabled');btn.textContent=label;token='';if(window.turnstile&&wid!==null)turnstile.reset(wid)}
  function failed(){release(M.retry);showStatus(M.server);status.scrollIntoView({block:'center'})}  // data kept; same key reused on retry
  function fieldErrors(errs){
    release(M.submit);
    var first=null,any=false;
    Object.keys(errs||{}).forEach(function(k){var n=k.replace(/\[\]$/,'');if(n==='files[]')n='files';setErr(n,errs[k]);any=true;if(!first)first=form.querySelector('[data-field="'+n+'"] input,[data-field="'+n+'"] select,[data-field="'+n+'"] textarea')});
    showStatus(M.summary);
    if(first)first.focus();
    if(!any)showStatus(M.server);
  }
  function done(id){
    form.hidden=true;
    var ok=document.getElementById('rfq-ok');document.getElementById('rfq-ref').textContent=id||'';
    ok.hidden=false;ok.focus();ok.scrollIntoView({block:'start'});
  }
})();
