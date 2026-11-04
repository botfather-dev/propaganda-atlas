(function(){
'use strict';
var RAW=JSON.parse(document.getElementById('atlas-data').textContent);
var EN=JSON.parse(document.getElementById('atlas-en').textContent);
var LANGKEY='atlas-propaganda-lang-v1',LANG='uk',D;
function _(s){return LANG==='en'&&EN[s]||s}
function N_(s){return s}
function fmt(s,o){return _(s).replace(/\{(\w+)\}/g,function(m,k){return o[k]})}
function isLeaf(o){var k=Object.keys(o);return k.length===2&&'uk' in o&&'en' in o}
function hasEn(o){if(Array.isArray(o))return o.some(hasEn);if(o&&typeof o==='object'){if(isLeaf(o))return o.en!=null;return Object.keys(o).some(function(k){return hasEn(o[k])})}return false}
/* Every {uk,en} leaf becomes one string; a card with a missing English leaf falls back to Ukrainian and says so. */
function localize(o,ctx){
  if(Array.isArray(o))return o.map(function(x){return localize(x,ctx)});
  if(o&&typeof o==='object'){
    if(isLeaf(o)){if(LANG==='en'){if(o.en!=null)return o.en;if(ctx&&o.uk)ctx.pending=true}return o.uk}
    var r={};Object.keys(o).forEach(function(k){r[k]=localize(o[k],ctx)});return r;
  }
  return o;
}
function localCards(a){return a.map(function(c){var x={},r=localize(c,x);r._pending=!!x.pending;return r})}
var NS='http://www.w3.org/2000/svg';
function $(s){return document.querySelector(s)}
var svg=$('#map'),world=$('#world'),gE=$('#edges'),gN=$('#nodes'),gG=$('#grat'),gT=$('#terr'),panel=$('#panel'),pbody=$('#panel-body');
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function el(tag,attrs,parent){var e=document.createElementNS(NS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}

var Fam,Tech,Proof,TYPE,REG;
function colorOf(id){if(Fam[id])return Fam[id].color;if(Tech[id])return Fam[Tech[id].family].color;if(Proof[id])return Fam[Tech[Proof[id].home].family].color;return '#1D1A15'}
var FK=['regime','type'],DEFAULT_LANG='en',HAS_EN=true;
function wornOf(){return 'worn'}
function wornName(){return ''}
function isLead(p){return p.status==='candidate'}
function setTables(){}
(function(){var v=null;try{v=localStorage.getItem(LANGKEY)}catch(e){}LANG=HAS_EN&&(v==='en'||v==='uk')?v:DEFAULT_LANG})();
function emptyF(){var f={};FK.forEach(function(k){f[k]={}});return f}
function hasFilter(){return FK.some(function(k){return Object.keys(S.f[k]).length>0})}
function plural(n,a,b,c){if(LANG==='en')return _(n===1?a:c);var m=n%10,h=n%100;if(m===1&&h!==11)return a;if(m>=2&&m<=4&&(h<12||h>14))return b;return c}

/* ------- state ------- */
var S={mode:null,cam:{x:0,y:0,k:1},collapsed:{},expanded:{},focus:null,panel:null,off:{},
  f:emptyF(),q:'',anim:null,tween:null};
var N={},E=[],Terr={};

/* ------- selection store ------- */
var KEY='atlas-propaganda-selection-v1',mem={star:{},pass:{},note:{}};
function loadSel(){try{var v=localStorage.getItem(KEY);if(v){var o=JSON.parse(v);mem={star:o.star||{},pass:o.pass||{},note:o.note||{}}}}catch(e){}}
function saveSel(){try{localStorage.setItem(KEY,JSON.stringify(mem))}catch(e){}}
loadSel();

/* ------- text index ------- */
var SKIPK={id:1,type:1,regimes:1,state:1,status:1,level:1,family:1,color:1,files:1,file_paths:1,sources:1,home:1,short:1,origin:1,emotion:1,grip:1,src:1,url:1,path:1,wing:1,proofs:1,mark:1,ref:1,doi:1,_pending:1};
/* Joins sentences; a piece that already ends in punctuation gets no second full stop. */
function joinS(a){return a.reduce(function(s,x){return !x?s:s?s+(/[.!?…:;]["”»)]?$/.test(s)?' ':'. ')+x:x},'')}
function flat(o){if(o==null)return'';if(typeof o==='string')return o;if(typeof o==='number')return String(o);if(Array.isArray(o))return joinS(o.map(flat));if(typeof o==='object'){var r=[];for(var k in o){if(SKIPK[k])continue;r.push(flat(o[k]))}return joinS(r)}return''}
/* A source with no year comes as "Name . Title": the empty year leaves its space before the full stop. */
function srcLabel(s){return String(s.label||'').replace(/ \.(?= |$)/g,'.')}
function srcText(c){
  var r=[];(c.sources||[]).forEach(function(s){r.push([s.mark,srcLabel(s),s.locator,s.path,s.url,s.doi].filter(Boolean).join(' '))});
  return r.join(' · ');
}
var Idx={};
function setData(){
  D=localize(RAW);
  D.families=localCards(RAW.families);D.techniques=localCards(RAW.techniques);D.proofs=localCards(RAW.proofs);
  Fam=Object.create(null);Tech=Object.create(null);Proof=Object.create(null);TYPE={};REG={};
  D.families.forEach(function(f){Fam[f.id]=f});
  D.techniques.forEach(function(t){Tech[t.id]=t});
  D.proofs.forEach(function(p){Proof[p.id]=p;p.home=p.techs[0].id});
  D.types.forEach(function(x){TYPE[x.id]=x});D.regimes.forEach(function(x){REG[x.id]=x});
  setTables();
  Idx=Object.create(null);
  D.techniques.concat(D.proofs).forEach(function(c){
  var names=[];if(c.type&&TYPE[c.type])names.push(TYPE[c.type].name);if(wornName(c))names.push(wornName(c));(c.regimes||[]).forEach(function(r){if(REG[r])names.push(REG[r].name)});
  var rest={};for(var k in c)if(k!=='label'&&k!=='title')rest[k]=c[k];
  var top=joinS([c.label,c.title===c.label?'':c.title]),body=joinS([flat(rest)].concat(names)),vis=joinS([top,body]),all=vis+' · '+srcText(c);
  Idx[c.id]={t:all,vis:vis.length,top:vis.length-body.length,low:all.toLowerCase(),head:(c.label+' '+(c.title||'')+' '+(c.sci||'')).toLowerCase()}});
  D.families.forEach(function(f){var s=joinS([f.name,f.sub]);Idx[f.id]={t:s,vis:s.length,top:s.length-f.sub.length,low:s.toLowerCase(),head:f.name.toLowerCase()}});
}
setData();

/* ------- geometry ------- */
var G={FX:96,FW:158,TX:304,TL:206,PX:554,ROW:23.5,TMIN:38,TGAP:12,FGAP:18,STAR:36};
var PH={W:440,RX:12,FX:20,TX:46,PX:74,RH:30,FH:56,TH:50,PH_:50,STARX:408,STAR:50};

function marker(fid,color){
  var d=$('#defs');
  var m=el('marker',{id:'ah-'+fid,viewBox:'0 0 10 8',refX:'9.2',refY:'4',markerWidth:'9',markerHeight:'7.2',markerUnits:'userSpaceOnUse',orient:'auto'},d);
  el('path',{d:'M0 .6L10 4 0 7.4 2 4z',fill:color},m);
}
function shapeD(type,r){
  switch(type){
    case 'recording':return null;
    case 'transcript':return 'M0 '+(-r*1.25)+'L'+(r*1.25)+' 0 0 '+(r*1.25)+' '+(-r*1.25)+' 0Z';
    case 'document':return 'M'+(-r*.92)+' '+(-r*.92)+'H'+(r*.92)+'V'+(r*.92)+'H'+(-r*.92)+'Z';
    case 'image':return 'M'+(-r*1.32)+' '+(-r*.74)+'H'+(r*1.32)+'V'+(r*.74)+'H'+(-r*1.32)+'Z';
    case 'experiment':return 'M0 '+(-r*1.22)+'L'+(r*1.16)+' '+(r*.86)+'H'+(-r*1.16)+'Z';
    case 'corpus':var a=r*1.12,b=r*.56,c=r*.97;return 'M'+(-a)+' 0L'+(-b)+' '+(-c)+'H'+b+'L'+a+' 0 '+b+' '+c+'H'+(-b)+'Z';
  }
}
function markSVG(type,worn,color,r){
  r=r||4.7;var d=shapeD(type,r),a='fill="'+color+'" stroke="'+color+'" stroke-width="1.25"';
  return d?'<path d="'+d+'" '+a+'/>':'<circle r="'+r+'" '+a+'/>';
}
var STAR='M0-5.4 1.6-1.9l3.8.5-2.8 2.6.8 3.8L0 3.1l-3.4 1.900.8-3.800-2.800-2.600 3.800-.5z';

/* ------- scene ------- */
/* Family colour mixed into the paper. Opaque on purpose: translucent rects under the edge groups paint stripes in Chromium. */
function mix(hex,a){var P=[242,236,223],r=[];for(var i=0;i<3;i++){var v=parseInt(hex.substr(1+i*2,2),16);r.push(Math.round(P[i]+(v-P[i])*a))}return 'rgb('+r.join(',')+')'}
function wrap2(s,max){if(s.length<=max)return[s];var w=s.split(' '),best=null;for(var i=1;i<w.length;i++){var a=w.slice(0,i).join(' '),b=w.slice(i).join(' '),m=Math.max(a.length,b.length);if(!best||m<best.m)best={m:m,a:a,b:b}}return best?[best.a,best.b]:[s]}

function buildScene(){
  S.mode=innerWidth<=760?'phone':'desk';
  document.body.classList.toggle('phone',S.mode==='phone');
  gE.textContent='';gN.textContent='';gG.textContent='';gT.textContent='';N={};E=[];Terr={};
  loadOffsets();
  var defs=$('#defs');defs.textContent='';
  var cp=el('clipPath',{id:'halfclip'},defs);el('rect',{x:'-9',y:'-9',width:'9',height:'18'},cp);
  D.families.forEach(function(f){marker(f.id,f.color)});marker('root','#1D1A15');
  var ph=S.mode==='phone';
  addRoot(ph);
  D.families.forEach(function(f){addFamily(f,ph);Terr[f.id]=el('rect',{class:'terr',fill:mix(f.color,.075),stroke:mix(f.color,.22)},gT)});
  D.techniques.forEach(function(t){addTech(t,ph)});
  D.proofs.forEach(function(p){addProof(p,ph)});
  D.families.forEach(function(f){addEdge('root',f.id,'root')});
  D.techniques.forEach(function(t){addEdge(t.family,t.id,'fam')});
  D.proofs.forEach(function(p){p.techs.forEach(function(t){addEdge(t.id,p.id,t.home?'home':'cross')})});
  addLede(ph);
  measureLabels();
  drawGrat(ph);
  layout(false);
  updateMarks();
  applyClasses();
}

function addNode(id,kind,cls){
  var g=el('g',{class:'node '+kind+' '+(cls||''),'data-id':id,tabindex:'0',role:'button'},gN);
  var n={id:id,kind:kind,el:g,x:0,y:0,d:1,visible:true,ext:{l:0,r:0,t:0,b:0}};
  N[id]=n;return n;
}
function addRoot(ph){
  var n=addNode('root','root');n.el.setAttribute('aria-label',_('Про карту'));
  if(ph){
    n.el.innerHTML='<rect class="hit" x="-6" y="-14" width="240" height="28"/><text class="rootname lb" x="4" y="5" style="font-size:14px">'+esc(_('Прийоми пропаганди'))+'</text>';
    n.ext={l:-6,r:230,t:-14,b:14};
  }else{
    n.el.innerHTML='<rect class="rootbox" x="-68" y="-34" width="136" height="68"/><rect class="rootbox2" x="-64" y="-30" width="128" height="60"/><text class="rootname lb" text-anchor="middle" y="-5">'+esc(LANG==='en'?'Propaganda':_('Прийоми'))+'</text><text class="rootname" text-anchor="middle" y="13">'+esc(_('пропаганди'))+'</text>';
    n.ext={l:-68,r:68,t:-34,b:34};
  }
}
function addFamily(f,ph){
  var n=addNode(f.id,'family');n.d=f.wing==='left'?-1:1;
  var homes=D.proofs.filter(function(p){return Tech[p.home].family===f.id}).length;
  var ts=D.techniques.filter(function(t){return t.family===f.id}).length;
  var cnt=ts+' '+plural(ts,'прийом','прийоми','прийомів')+' · '+homes+' '+plural(homes,'доказ','докази','доказів');
  n.el.setAttribute('aria-label',_('Родина')+': '+f.name);
  var c=f.color,h='',tx=PH.STARX-PH.FX;
  function tog(x,r,s,m){return '<g class="famtoggle" transform="translate('+x+' 0)"><rect class="hit" x="'+(-s/2)+'" y="'+(-s/2)+'" width="'+s+'" height="'+s+'"/><circle class="famtog" r="'+r+'" stroke="'+c+'"/><path class="togmark" stroke="'+c+'" d="M'+(-m)+' 0H'+m+'"/><path class="togv" stroke="'+c+'" stroke-width="1.300" stroke-linecap="round" d="M0'+(-m)+'V'+m+'"/></g>'}
  if(ph){
    h='<rect class="hit" x="-8" y="-28" width="'+(tx-20)+'" height="56"/>'+
      /* x 30 keeps the words right of the fit button at every pan: its right edge is 48 px, the list starts at 6 and scales by .885 at least. */
      '<text class="famname lb" x="30" y="0" fill="'+c+'" style="font-size:20px">'+esc(f.name)+'</text>'+
      '<text class="famcount" x="30" y="17">'+esc(cnt)+'</text>'+tog(tx,10,50,4.6);
    n.ext={l:-8,r:tx+25,t:-28,b:28};
    n.el.innerHTML=h;
  }else{
    var d=n.d,anc=d>0?'start':'end',lines=wrap2(f.name,13),LH=24;
    var y0=lines.length>1?-16:-3;
    lines.forEach(function(l,i){h+='<text class="famname '+(i===0?'lb':'')+'" text-anchor="'+anc+'" y="'+(y0+i*LH)+'" fill="'+c+'">'+esc(l)+'</text>'});
    h+='<text class="famcount" text-anchor="'+anc+'" y="'+(y0+(lines.length-1)*LH+17)+'">'+esc(cnt)+'</text>';
    var bx=d>0?-4:-G.FW+14;
    h='<rect class="hit" x="'+bx+'" y="-36" width="'+(G.FW-10)+'" height="70"/>'+h;
    h+=tog(d*G.FW,8,26,3.8);
    n.ext=d>0?{l:-4,r:G.FW+13,t:-36,b:34}:{l:-G.FW-13,r:4,t:-36,b:34};
    n.el.innerHTML=h;
  }
}
/* What this is, in one sentence: in the header on a desktop, first row of the list on a phone. */
var ledeH=0;
function addLede(ph){
  var box=$('#lede'),s=D.about.lede;ledeH=0;
  box.textContent=s;box.hidden=ph;
  if(!ph)return;
  var g=el('g',{id:'ledeg'},gN),max=Math.min(416,(innerWidth-24)/.885-12),LH=19.5,rows=[],cur='';
  var probe=el('text',{class:'ledetext'},g);
  s.split(' ').forEach(function(w){var t=cur?cur+' '+w:w;probe.textContent=t;if(probe.getComputedTextLength()>max&&cur){rows.push(cur);cur=w}else cur=t});
  rows.push(cur);g.removeChild(probe);
  rows.forEach(function(r,i){var t=el('text',{class:'ledetext',x:'4',y:String(-20-(rows.length-1-i)*LH)},g);t.textContent=r});
  ledeH=rows.length*LH+10;
}
function stampW(){return 0}
function madeStamp(){return ''}
function addTech(t,ph){
  var f=Fam[t.family],n=addNode(t.id,'tech');n.d=f.wing==='left'?-1:1;
  n.el.setAttribute('aria-label',_('Прийом')+': '+t.label);
  var c=f.color,count=t.proofs.length,h='';
  if(ph){
    var sx=PH.STARX-PH.TX,marks='',ps=t.proofs.slice(0,8),x=sx-30-ps.length*11;
    ps.forEach(function(id,i){var p=Proof[id];marks+='<g transform="translate('+(x+i*11+6)+' 0)">'+markSVG(p.type,wornOf(p),c,3.300)+'</g>'});
    if(t.proofs.length>8)marks+='<text class="techmeta" x="'+(sx-29)+'" y="3.500">+'+(t.proofs.length-8)+'</text>';
    h='<rect class="hit" x="-6" y="-25" width="'+(sx-PH.STAR/2+6)+'" height="50"/>'+
      '<text class="techname lb" x="4" y="'+(t.made?-3:5)+'" style="font-size:15.500px">'+esc(t.label)+'</text>'+
      '<g class="minimarks">'+marks+'</g>'+
      (t.made?madeStamp(t.made,4+stampW(t.made)/2,11,c):'')+
      starBtn(t.id,sx,0,ph);
    n.ext={l:-6,r:sx+25,t:-25,b:25};
    n.el.innerHTML=h;
  }else{
    var d=n.d,anc=d>0?'start':'end',lines=wrap2(t.label,20);
    var yBase=lines.length>1?-21:-5;
    lines.forEach(function(l,i){h+='<text class="techname tl '+(i===lines.length-1?'lb':'')+'" text-anchor="'+anc+'" y="'+(yBase+i*16.500)+'">'+esc(l)+'</text>'});
    h+='<path class="techrule" stroke="'+c+'" d="M0 3H'+(d*G.TL)+'"/>';
    h+='<text class="techmeta" text-anchor="'+anc+'" y="15">'+count+' '+plural(count,'доказ','докази','доказів')+'</text>';
    if(t.made)h+=madeStamp(t.made,d*(G.TL-stampW(t.made)/2),11,c);
    var bx2=d>0?-3:-G.TL-3,top=lines.length>1?-35:-19;
    h='<rect class="hit" x="'+bx2+'" y="'+top+'" width="'+(G.TL+6)+'" height="'+(20-top)+'"/>'+h;
    n.el.innerHTML=h;
    var lw=0;Array.prototype.forEach.call(n.el.querySelectorAll('.tl'),function(e){lw=Math.max(lw,e.getComputedTextLength())});
    var sxd=Math.max(G.TL-8,lw+12);
    n.el.insertAdjacentHTML('beforeend',starBtn(t.id,d*sxd,yBase+(lines.length-1)*16.500-5,ph));
    var far=Math.max(G.TL+3,sxd+9);
    n.ext=d>0?{l:-3,r:far,t:top,b:20}:{l:-far,r:3,t:top,b:20};
  }
}
function starBtn(id,x,y,ph){
  var s=ph?PH.STAR:G.STAR;
  return '<g class="starbtn" data-star="'+id+'" transform="translate('+x+' '+y+')"><rect x="'+(-s/2)+'" y="'+(-s/2)+'" width="'+s+'" height="'+s+'"/><path class="starshape" d="'+STAR+'" transform="scale('+(ph?1.5:1.4)+')"/><path class="passx" d="M-3.600-3.600L3.600 3.600M3.600-3.600L-3.600 3.600"/></g>';
}
function addProof(p,ph){
  var f=Fam[Tech[p.home].family],n=addNode(p.id,'proof',(isLead(p)?'lead ':'')+(p.status==='not_accepted'?'notok':''));
  n.d=f.wing==='left'?-1:1;
  n.el.setAttribute('aria-label',_('Доказ')+': '+p.label);
  var c=f.color,h='';
  if(ph){
    var sx=PH.STARX-PH.PX;
    h='<rect class="hit" x="-12" y="-25" width="'+(sx-PH.STAR/2+12)+'" height="50"/><g class="mk">'+markSVG(p.type,wornOf(p),c,5)+'</g>'+
      '<text class="proofname lb" x="11" y="'+(p.made?-3:5)+'" style="font-size:14.500px">'+esc(p.label)+'</text>'+starBtn(p.id,sx,0,ph);
    n.el.innerHTML=h;
    var lb=n.el.querySelector('.lb'),w=lb.getComputedTextLength();
    var extra='';var x=11+w+8;
    if(p.techs.length>1){extra+='<text class="sharecount" x="'+x+'" y="'+(p.made?-3:4)+'">×'+p.techs.length+'</text>';x+=22}
    if(p.status==='not_accepted'){extra+='<text class="sharecount" x="'+x+'" y="4">?</text>';x+=12}
    if(p.made)extra+=madeStamp(p.made,11+stampW(p.made)/2,11,c);
    n.el.insertAdjacentHTML('beforeend',extra);
    n.ext={l:-12,r:sx+25,t:-25,b:25};
  }else{
    var d=n.d,anc=d>0?'start':'end';
    h='<g class="mk">'+markSVG(p.type,wornOf(p),c,4.700)+'</g><text class="proofname lb" text-anchor="'+anc+'" x="'+(d*11)+'" y="4.500">'+esc(p.label)+'</text>';
    n.el.innerHTML=h;
    var lb2=n.el.querySelector('.lb'),w2=lb2.getComputedTextLength(),x2=11+w2+6,ex='';
    if(p.techs.length>1){ex+='<text class="sharecount" text-anchor="'+anc+'" x="'+(d*x2)+'" y="3.800">×'+p.techs.length+'</text>';x2+=19}
    if(p.status==='not_accepted'){ex+='<text class="sharecount" text-anchor="'+anc+'" x="'+(d*x2)+'" y="3.800">?</text>';x2+=11}
    if(p.made){var sw=stampW(p.made);ex+=madeStamp(p.made,d*(x2+sw/2),-.400,c);x2+=sw+5}
    ex+=starBtn(p.id,d*(x2+7),0,ph);x2+=16;
    n.el.insertAdjacentHTML('beforeend',ex);
    var wide=x2+6;
    var hit=el('rect',{class:'hit',x:d>0?-9:-wide,y:-11,width:wide+9,height:22});
    n.el.insertBefore(hit,n.el.firstChild);
    n.ext=d>0?{l:-9,r:wide,t:-11,b:11}:{l:-wide,r:9,t:-11,b:11};
  }
}
function addEdge(a,b,kind){
  var c=a==='root'?'#1D1A15':colorOf(a);
  var p=el('path',{class:'edge '+kind,stroke:c,'marker-end':'url(#ah-'+(a==='root'?'root':(Fam[a]?a:Tech[a].family))+')'},gE);
  E.push({a:a,b:b,kind:kind,el:p});
}
function drawGrat(ph){
  if(ph)return;
  for(var i=-4;i<=4;i++){
    var x=i*200;
    el('path',{d:'M'+x+' -760Q'+(x*1.09)+' 0 '+x+' 760'},gG);
  }
  for(var j=-3;j<=3;j++){
    var y=j*200;
    el('path',{d:'M-1000 '+y+'Q0 '+(y*1.09)+' 1000 '+y},gG);
  }
}

/* ------- layout ------- */
function filterActive(){return S.q.length>1||hasFilter()}
function proofMatch(p){
  var f=S.f;
  function any(set,vals){var ks=Object.keys(set);if(!ks.length)return true;return vals.some(function(v){return set[v]})}
  if(!any(f.regime,p.regimes))return false;
  if(!any(f.type,[p.type]))return false;
  if(S.q.length>1&&Idx[p.id].low.indexOf(S.q)<0){
    var linked=p.techs.some(function(t){return Idx[t.id].head.indexOf(S.q)>=0});
    if(!linked)return false;
  }
  return true;
}
function techMatch(t){
  if(t.proofs.some(function(id){return proofMatch(Proof[id])}))return true;
  var hasF=hasFilter();
  if(!hasF&&S.q.length>1&&Idx[t.id].low.indexOf(S.q)>=0)return true;
  return false;
}
function layout(animate){
  var T={};
  if(S.mode==='phone')layoutPhone(T);else layoutDesk(T);
  for(var id in N){
    var n=N[id],t=T[id];
    n.visible=!!t;
    n.el.style.display=t?'':'none';
    if(t){var o=S.off[id]||{x:0,y:0};n.tx=t.x+o.x;n.ty=t.y+o.y}
  }
  E.forEach(function(e){var vis=N[e.a].visible&&N[e.b].visible;e.visible=vis;e.el.style.display=vis?'':'none'});
  placed(T);
  if(animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    if(S.tween)cancelAnimationFrame(S.tween);
    var from={};for(var i in N)from[i]={x:N[i].x,y:N[i].y};
    var t0=performance.now(),dur=380;
    (function tick(now){
      var u=Math.max(0,Math.min(1,(now-t0)/dur)),e=1-Math.pow(1-u,3);
      for(var i in N){var n=N[i];if(!n.visible)continue;var a=from[i];var fx=a.fresh?n.tx:a.x;setPos(n,fx+(n.tx-fx)*e,a.y+(n.ty-a.y)*e)}
      drawEdges();
      if(u<1)S.tween=requestAnimationFrame(tick);else S.tween=null;
    })(t0);
  }else{
    for(var k in N){var m=N[k];if(m.visible)setPos(m,m.tx,m.ty)}
    drawEdges();
  }
}
function placed(T){E.forEach(function(e){if(e.kind==='cross'||e.kind==='home'){var isPrimary=S.mode==='phone'?(T[e.b]&&T[e.b].parent===e.a):e.kind==='home'&&Proof[e.b].home===e.a;e.primary=isPrimary;e.el.classList.toggle('home',isPrimary);e.el.classList.toggle('cross',!isPrimary)}})}
function setPos(n,x,y){n.x=x;n.y=y;n.el.setAttribute('transform','translate('+x.toFixed(2)+' '+y.toFixed(2)+')')}

function layoutDesk(T){
  var wings={right:[],left:[]};
  D.families.forEach(function(f){wings[f.wing].push(f)});
  ['right','left'].forEach(function(w){
    var d=w==='right'?1:-1,y=0,blocks=[];
    wings[w].forEach(function(f,fi){
      var ts=D.techniques.filter(function(t){return t.family===f.id});
      if(fi)y+=G.FGAP;
      var fy0=y;
      if(S.collapsed[f.id]){y+=64;T[f.id]={x:d*G.FX,y:fy0+32};return}
      var tys=[];
      ts.forEach(function(t,ti){
        var ps=D.proofs.filter(function(p){return p.home===t.id});
        var two=t.label.length>20;
        var need=Math.max(ps.length*G.ROW,two?G.TMIN+16:G.TMIN);
        if(ti)y+=G.TGAP;
        var yy=y,rows=ps.length*G.ROW,start=yy+(need-rows)/2;
        ps.forEach(function(p,i){T[p.id]={x:d*G.PX,y:start+G.ROW*(i+.5)}});
        var ty=yy+need/2+(two?8:0);
        T[t.id]={x:d*G.TX,y:ty};tys.push(ty);
        y+=need;
      });
      T[f.id]={x:d*G.FX,y:(tys[0]+tys[tys.length-1])/2};
    });
    var mid=y/2;
    wings[w].forEach(function(f){
      T[f.id].y-=mid;
      if(S.collapsed[f.id])return;
      D.techniques.filter(function(t){return t.family===f.id}).forEach(function(t){T[t.id].y-=mid;D.proofs.filter(function(p){return p.home===t.id}).forEach(function(p){T[p.id].y-=mid})});
    });
  });
  T.root={x:0,y:0};
}
function layoutPhone(T){
  var y=0;
  T.root={x:PH.RX,y:y};y+=PH.RH/2;
  var fa=filterActive(),used={};
  D.families.forEach(function(f){
    y+=PH.FH/2;
    T[f.id]={x:PH.FX,y:y};y+=PH.FH/2-4;
    if(S.collapsed[f.id]){y+=4;return}
    D.techniques.filter(function(t){return t.family===f.id}).forEach(function(t){
      y+=PH.TH/2;T[t.id]={x:PH.TX,y:y};y+=PH.TH/2;
      var open=!!S.expanded[t.id];
      if(fa&&t.proofs.some(function(id){return proofMatch(Proof[id])}))open=true;
      if(open){
        t.proofs.forEach(function(id){
          if(used[id])return;
          if(fa&&!proofMatch(Proof[id]))return;
          used[id]=1;y+=PH.PH_/2;T[id]={x:PH.PX,y:y,parent:t.id};y+=PH.PH_/2;
        });
        y+=4;
      }
    });
    y+=4;
  });
}
function port(n,side,other){
  if(S.mode==='phone'){
    if(n.kind==='root')return{x:n.x,y:n.y+9};
    if(n.kind==='family')return side==='out'?{x:n.x+1,y:n.y+21}:{x:n.x+26,y:n.y};
    if(n.kind==='tech')return side==='out'?{x:n.x+5,y:n.y+20}:{x:n.x+1,y:n.y};
    return{x:n.x-8,y:n.y};
  }
  var d=n.d;
  if(n.kind==='root'){var s=other&&other.x<n.x?-1:1;return{x:n.x+s*68,y:n.y}}
  if(n.kind==='family')return side==='out'?{x:n.x+d*(G.FW+8),y:n.y}:{x:n.x-d*5,y:n.y};
  if(n.kind==='tech')return side==='out'?{x:n.x+d*G.TL,y:n.y+3}:{x:n.x-d*5,y:n.y+3};
  return{x:n.x-d*8,y:n.y};
}
function edgeD(e){
  var A=N[e.a],B=N[e.b];
  if(S.mode==='phone'){
    if(!e.primary&&A.kind==='tech'){
      var q=port(B,'in');
      return 'M'+(A.x+1)+' '+A.y+'C-14 '+A.y+' -14 '+q.y+' '+q.x+' '+q.y;
    }
    var p1=port(A,'out',B),p2=port(B,'in',A);
    return 'M'+p1.x+' '+p1.y+'C'+p1.x+' '+(p1.y+(p2.y-p1.y)*.8)+' '+(p1.x+(p2.x-p1.x)*.2)+' '+p2.y+' '+p2.x+' '+p2.y;
  }
  var a,b;
  if(!e.primary&&A.kind==='tech'&&A.d!==B.d){a=port(A,'in');b=port(B,'in')}
  else{a=port(A,'out',B);b=port(B,'in',A)}
  var m=(a.x+b.x)/2;
  return 'M'+a.x.toFixed(1)+' '+a.y.toFixed(1)+'C'+m.toFixed(1)+' '+a.y.toFixed(1)+' '+m.toFixed(1)+' '+b.y.toFixed(1)+' '+b.x.toFixed(1)+' '+b.y.toFixed(1);
}
function drawEdges(){E.forEach(function(e){if(e.visible)e.el.setAttribute('d',edgeD(e))});drawTerr()}
function drawTerr(){
  var ph=S.mode==='phone',fams=D.families,ys=null;
  if(ph){ys=0;for(var id in N)if(N[id].visible)ys=Math.max(ys,N[id].y+N[id].ext.b)}
  fams.forEach(function(f,i){
    var r=Terr[f.id],n=N[f.id];if(!r||!n)return;
    if(!n.visible||(!ph&&S.collapsed[f.id])){r.style.display='none';return}
    r.style.display='';
    var a,b,c,e;
    if(ph){a=4;b=PH.W-6;c=n.y-PH.FH/2+1;var nx=fams[i+1]?N[fams[i+1].id]:null;e=nx?nx.y-PH.FH/2-1:ys+3}
    else{
      a=n.x+n.ext.l;b=n.x+n.ext.r;c=n.y+n.ext.t;e=n.y+n.ext.b;
      subtree(f.id).forEach(function(k){var m=N[k];if(!m||!m.visible)return;a=Math.min(a,m.x+m.ext.l);b=Math.max(b,m.x+m.ext.r);c=Math.min(c,m.y+m.ext.t);e=Math.max(e,m.y+m.ext.b)});
      a-=7;b+=7;c-=5;e+=5;
    }
    r.setAttribute('x',a.toFixed(1));r.setAttribute('y',c.toFixed(1));r.setAttribute('width',(b-a).toFixed(1));r.setAttribute('height',(e-c).toFixed(1));
  });
}

/* ------- camera ------- */
function applyCam(){world.setAttribute('transform','translate('+S.cam.x.toFixed(2)+' '+S.cam.y.toFixed(2)+') scale('+S.cam.k.toFixed(4)+')');cutLabels()}
/* Text box of each node, kept so the check below needs no layout read on every camera frame. */
function measureLabels(){
  for(var id in N){
    var n=N[id],a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;
    Array.prototype.forEach.call(n.el.querySelectorAll('text'),function(t){var r=t.getBBox();a=Math.min(a,r.x);b=Math.max(b,r.x+r.width);c=Math.min(c,r.y);d=Math.max(d,r.y+r.height)});
    n.tb=a<Infinity?{l:a,r:b,t:c,b:d}:null;
  }
}
/* With a card open, a label that an opaque edge would slice is hidden until it fits again, the faint ones and the root plate too: the window, the desktop panel, the phone header and sheet. Any touch with the pinned title plate, search box or zoom box hides it as well, so its star and marks cannot stick out from under them. The panel kicker names the family. A phone sheet of any kind cuts the same way, because it covers the list below it; dragged up, it can reach the card's own row, and its header names the card. */
function cutLabels(){
  var ph=S.mode==='phone',open=!panel.hidden&&(S.focus||ph),right=open&&!ph?innerWidth-panel.offsetWidth:innerWidth,top=open&&ph?$('#bar').getBoundingClientRect().bottom:0,bot=open&&ph?panel.getBoundingClientRect().top:innerHeight,c=S.cam;
  var plates=open?[$('#titlebtn'),$('#searchwrap'),$('#zoom')].map(function(e){return e.getBoundingClientRect()}).filter(function(p){return p.width>0}):[];
  for(var id in N){
    var n=N[id],cut=false;
    var box=id==='root'?n.ext:n.tb;
    if(open&&(ph||id!==S.focus)&&n.visible&&box){
      var x=n.tx==null?n.x:n.tx,y=n.ty==null?n.y:n.ty,l=c.x+(x+box.l)*c.k,r=c.x+(x+box.r)*c.k,t=c.y+(y+box.t)*c.k,b=c.y+(y+box.b)*c.k;
      cut=r>0&&l<innerWidth&&b>top&&t<bot&&(l<0||r>right&&l<right||t<top||b>bot||plates.some(function(p){return l<p.right&&r>p.left&&t<p.bottom&&b>p.top}));
    }
    if(n.cut!==cut){n.cut=cut;n.el.classList.toggle('cut',cut)}
  }
}
function animCam(to,dur){
  if(S.anim)cancelAnimationFrame(S.anim);
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){S.cam=to;applyCam();return}
  var from={x:S.cam.x,y:S.cam.y,k:S.cam.k},t0=performance.now();dur=dur||520;
  (function tick(now){
    var u=Math.max(0,Math.min(1,(now-t0)/dur)),e=u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
    S.cam={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e,k:from.k*Math.pow(to.k/from.k,e)};
    applyCam();
    if(u<1)S.anim=requestAnimationFrame(tick);else S.anim=null;
  })(t0);
}
function insets(){
  var ph=S.mode==='phone',open=!panel.hidden;
  var i={t:ph?54:72,r:!ph&&innerWidth<1240?70:18,b:ph?10:18,l:18};
  /* Below 1360 px the sentence sits under the header and the map starts under it. */
  var ld=$('#lede').getBoundingClientRect();if(!ph&&!open&&ld.height&&ld.top>60)i.t=Math.ceil(ld.bottom)+8;
  if(open){if(ph)i.b=panel.getBoundingClientRect().height+6;else i.r=panel.offsetWidth+16}
  return i;
}
function bboxOf(ids){
  var a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;
  ids.forEach(function(id){var n=N[id];if(!n||!n.visible)return;var x=n.tx==null?n.x:n.tx,y=n.ty==null?n.y:n.ty;a=Math.min(a,x+n.ext.l);b=Math.max(b,x+n.ext.r);c=Math.min(c,y+n.ext.t);d=Math.max(d,y+n.ext.b)});
  return{l:a,r:b,t:c,b:d};
}
function camFor(ids,maxK,minK){
  var i=insets(),W=innerWidth-i.l-i.r,H=innerHeight-i.t-i.b,B=bboxOf(ids);
  var bw=B.r-B.l,bh=B.b-B.t;
  var k=Math.min(W/bw,H/bh);k=Math.min(k,maxK||2);if(minK)k=Math.max(k,minK);
  var x=i.l+(W-bw*k)/2-B.l*k,y=i.t+(H-bh*k)/2-B.t*k;
  if(bh*k>H)y=i.t-B.t*k;
  if(bw*k>W)x=i.l-B.l*k;
  return{x:x,y:y,k:k};
}
function allIds(){return Object.keys(N).filter(function(id){return N[id].visible})}
function placeLegend(c){
  var l=$('#legend'),n=N.root;
  if(!l||!n||S.mode==='phone'||!panel.hidden)return;
  var rx=c.x+(n.tx==null?n.x:n.tx)*c.k;
  l.style.left=Math.max(14,Math.min(innerWidth-l.offsetWidth-14,Math.round(rx-l.offsetWidth/2)))+'px';
}
function setLegend(min){
  var l=$('#legend'),b=$('#legmin');
  l.classList.toggle('min',min);
  b.textContent=min?_('Умовні позначення')+' +':'\u2212';
  b.setAttribute('aria-expanded',String(!min));
  b.setAttribute('aria-label',min?_('Показати умовні позначення'):_('Сховати умовні позначення'));
  placeLegend(S.cam);
}
function legendOnMove(){var l=$('#legend');if(l&&!l.classList.contains('min'))setLegend(true)}
/* The open legend starts only where it hides no label. */
function legendCovers(){
  var l=$('#legend');if(l.classList.contains('min'))return false;
  var a=l.getBoundingClientRect(),hit=false;
  Array.prototype.forEach.call(gN.querySelectorAll('text'),function(t){var r=t.getBoundingClientRect();if(r.width&&r.left<a.right&&r.right>a.left&&r.top<a.bottom&&r.bottom>a.top)hit=true});
  return hit;
}
function minK(){var B=camFor(allIds(),1.3).k;return Math.min(.5,B)}
function clampCam(c){
  var B=bboxOf(allIds()),W=innerWidth,H=innerHeight,bw=(B.r-B.l)*c.k,bh=(B.b-B.t)*c.k;
  var mx=.2*Math.min(bw,W),my=.2*Math.min(bh,H);
  return{k:c.k,x:Math.max(mx-B.r*c.k,Math.min(W-mx-B.l*c.k,c.x)),y:Math.max(my-B.b*c.k,Math.min(H-my-B.t*c.k,c.y))};
}
/* At the fit view the fit button has nothing to do: the phone hides it until the camera moves. */
function camMoved(){document.body.classList.remove('at-fit')}
function fit(anim){
  var ph=S.mode==='phone',c=camFor(allIds(),ph?1.1:1.3,ph?.885:null);
  if(ph){var i=insets();c.x=(innerWidth-PH.W*c.k)/2+ (PH.W*c.k-(innerWidth))/2 +6;c.y=i.t+(14+ledeH)*c.k}
  document.body.classList.add('at-fit');
  placeLegend(c);setToastGap(c);
  if(anim===false){S.cam=c;applyCam()}else animCam(c);
}
function zoomAt(px,py,f,anim){
  legendOnMove();camMoved();
  var k=Math.max(minK(),Math.min(3.2,S.cam.k*f)),r=k/S.cam.k;
  var c=clampCam({k:k,x:px-(px-S.cam.x)*r,y:py-(py-S.cam.y)*r});
  if(anim)animCam(c,220);else{if(S.anim){cancelAnimationFrame(S.anim);S.anim=null}S.cam=c;applyCam()}
}

/* ------- neighbours and classes ------- */
function neighbours(id){
  var set={};set[id]=1;
  if(id==='root')return set;
  if(Fam[id]){set.root=1;D.techniques.forEach(function(t){if(t.family===id){set[t.id]=1;D.proofs.forEach(function(p){if(p.home===t.id)set[p.id]=1})}})}
  else if(Tech[id]){set[Tech[id].family]=1;Tech[id].proofs.forEach(function(p){set[p]=1})}
  else if(Proof[id]){Proof[id].techs.forEach(function(t){set[t.id]=1;set[Tech[t.id].family]=1})}
  return set;
}
function edgeOn(e,set,id){
  if(Fam[id])return(e.a===id)||(set[e.a]&&set[e.b]&&(e.kind==='home'||e.primary));
  if(Tech[id])return e.a===id||(e.b===id);
  if(Proof[id])return e.b===id||(set[e.a]&&set[e.b]&&Fam[e.a]);
  return false;
}
function applyClasses(){
  var fa=filterActive();
  svg.classList.toggle('filtering',fa);
  svg.classList.toggle('focus',!!S.focus);
  var set=S.focus?neighbours(S.focus):{};
  var q=S.q.length>1?S.q:'';
  for(var id in N){
    var n=N[id],m=true;
    if(n.kind==='proof')m=proofMatch(Proof[id]);
    else if(n.kind==='tech')m=techMatch(Tech[id]);
    else if(n.kind==='family')m=D.techniques.some(function(t){return t.family===id&&techMatch(t)});
    n.match=m;
    n.el.classList.toggle('match',m);
    n.el.classList.toggle('on',!!set[id]);
    n.el.classList.toggle('selected',S.focus===id);
    n.el.classList.toggle('searchhit',!!q&&id!=='root'&&!!Idx[id]&&Idx[id].head.indexOf(q)>=0);
  }
  D.families.forEach(function(f){if(Terr[f.id])Terr[f.id].classList.toggle('on',!!set[f.id])});
  cutLabels();
  E.forEach(function(e){
    e.el.classList.toggle('on',!!(S.focus&&edgeOn(e,set,S.focus)));
    e.el.classList.toggle('match',N[e.a].match!==false&&N[e.b].match!==false);
  });
  var fc=0;FK.forEach(function(k){fc+=Object.keys(S.f[k]).length});
  var fcEl=$('#filtercount');fcEl.hidden=!fc;fcEl.textContent=fc;
  var sc=Object.keys(mem.star).length,scEl=$('#selcount');scEl.hidden=!sc;scEl.textContent=sc;
}
function updateMarks(){
  Array.prototype.forEach.call(document.querySelectorAll('.starbtn'),function(b){b.classList.toggle('on',!!mem.star[b.getAttribute('data-star')])});
  for(var id in N){if(N[id].kind==='proof'||N[id].kind==='tech')N[id].el.classList.toggle('passed',!!mem.pass[id])}
  Object.keys(S.collapsed).forEach(function(){});
  D.families.forEach(function(f){var n=N[f.id];if(!n)return;var v=n.el.querySelector('.togv');if(v)v.style.display=S.collapsed[f.id]?'':'none'});
}

/* ------- open, close ------- */
function openNode(id,opts){
  opts=opts||{};
  if(id==='root'){S.focus=null;openPanel({kind:'about'});applyClasses();if(S.mode==='desk')animCam(camFor(allIds(),1.3));else fit();return}
  S.focus=id;
  if(S.mode==='phone'){
    var keep=S.expanded;S.expanded={};
    if(Tech[id])S.expanded[id]=1;
    else if(Proof[id]){
      var linked=Proof[id].techs.map(function(t){return t.id}).filter(function(t){return keep[t]});
      S.expanded[linked[0]||Proof[id].home]=1;
    }
    var hostFam=Tech[id]?Tech[id].family:Proof[id]?Tech[Proof[id].home].family:id;
    if(S.collapsed[hostFam])delete S.collapsed[hostFam];
  }else{
    var fam=Tech[id]?Tech[id].family:Proof[id]?Tech[Proof[id].home].family:null;
    if(fam&&S.collapsed[fam]){delete S.collapsed[fam]}
    if(Proof[id])Proof[id].techs.forEach(function(t){var f=Tech[t.id].family;if(S.collapsed[f])delete S.collapsed[f]});
  }
  layout(true);updateMarks();
  openPanel({kind:'card',id:id});
  applyClasses();
  if(S.mode==='phone'){
    var focusIds=[id];
    if(Tech[id])focusIds=[id].concat(Tech[id].proofs);
    if(Proof[id])focusIds=[id,Object.keys(S.expanded)[0]];
    if(Fam[id])focusIds=[id].concat(D.techniques.filter(function(t){return t.family===id}).map(function(t){return t.id}));
    var c=camFor(focusIds,1,.885),i=insets();
    c.x=(innerWidth-PH.W*c.k)/2+(PH.W*c.k-innerWidth)/2+6;
    var B=bboxOf(focusIds);c.y=i.t+8-B.t*c.k;
    animCam(c);
  }else{
    var frame=[id];
    if(Tech[id])frame=subtree(id);
    else if(Proof[id])frame=[id,Proof[id].home];
    else if(Fam[id])frame=subtree(id);
    animCam(camFor(frame,1.28,.95));
  }
}
function closePanel(){
  navPush({kind:'map',id:null});
  panel.hidden=true;document.body.classList.remove('panel-open');
  S.panel=null;S.focus=null;docTitle();
  if(S.mode==='phone')S.expanded={};
  layout(true);applyClasses();markTools();updateBack();
  fit();
}
function docTitle(){var s=_('Атлас прийомів пропаганди'),p=S.panel,n=p&&p.kind==='card'?navLabel(p):'';document.title=n?n+' · '+s:s}
function openPanel(p){
  navPush({kind:p.kind,id:p.id||null});
  S.panel=p;docTitle();
  var ph=S.mode==='phone';
  if(ph){var longTech=p.kind==='card'&&Tech[p.id]&&Tech[p.id].proofs.length>8;document.documentElement.style.setProperty('--sheet',longTech?'36dvh':p.kind==='card'?'56dvh':'70dvh')}
  panel.hidden=false;document.body.classList.add('panel-open');
  renderPanel();
  pbody.scrollTop=0;
  markTools();updateBack();
  try{pbody.focus({preventScroll:true})}catch(e){}
  cutLabels();
}
function markTools(){
  var k=S.panel&&S.panel.kind;
  $('#btn-filter').classList.toggle('active',k==='filter');
  $('#btn-sel').classList.toggle('active',k==='sel');
  $('#btn-about').classList.toggle('active',k==='about');
}
function renderPanel(){
  var p=S.panel;if(!p)return;
  if(p.kind==='card'){
    if(Tech[p.id])pbody.innerHTML=techCard(Tech[p.id]);
    else if(Proof[p.id])pbody.innerHTML=proofCard(Proof[p.id]);
    else if(Fam[p.id])pbody.innerHTML=famCard(Fam[p.id]);
  }else if(p.kind==='filter')pbody.innerHTML=filterPanel();
  else if(p.kind==='sel')pbody.innerHTML=selPanel();
  else if(p.kind==='about')pbody.innerHTML=aboutPanel();
}

/* ------- history: each card is a browser history entry ------- */
var Nav={list:[{kind:'map',id:null,scroll:0,open:[]}],cur:0,silent:false,pushed:false};
function openDetails(){var r=[];Array.prototype.forEach.call(pbody.querySelectorAll('details'),function(d,i){if(d.open)r.push(i)});return r}
function restoreDetails(a){var ds=pbody.querySelectorAll('details');(a||[]).forEach(function(i){if(ds[i])ds[i].open=true})}
function saveScroll(){var c=Nav.list[Nav.cur];if(c&&S.panel&&c.kind===S.panel.kind&&c.id===(S.panel.id||null)){c.scroll=pbody.scrollTop;c.open=openDetails()}}
function cardPrefix(id){return Tech[id]?'t/':Proof[id]?'p/':Fam[id]?'f/':''}
function hashOf(e){return e.kind==='map'?'':e.kind==='card'?cardPrefix(e.id)+e.id:e.kind}
/* #t/T15, #p/tape, #f/F-DODGE; the older #T15 still opens. */
function cardFromHash(h){
  var m=/^([tpf])\/(.+)$/.exec(h),id=m?m[2]:h,set=m?{t:Tech,p:Proof,f:Fam}[m[1]]:null;
  if(set)return set[id]?id:null;
  return Tech[id]||Proof[id]||Fam[id]?id:null;
}
function readHash(){try{return decodeURIComponent(location.hash.slice(1))}catch(e){return ''}}
function navPush(e){
  if(Nav.silent)return;
  var c=Nav.list[Nav.cur];if(c&&c.kind===e.kind&&c.id===e.id)return;
  saveScroll();
  Nav.list=Nav.list.slice(0,Nav.cur+1);Nav.list.push({kind:e.kind,id:e.id,scroll:0,open:[]});Nav.cur=Nav.list.length-1;
  try{var h=hashOf(e);history.pushState({i:Nav.cur},'',h?'#'+encodeURI(h):location.pathname+location.search);Nav.pushed=true}catch(x){Nav.pushed=false}
}
function navLabel(e){
  if(e.kind==='filter')return _('Фільтри');if(e.kind==='sel')return _('Мій вибір');if(e.kind==='about')return _('Про карту');
  if(Tech[e.id])return Tech[e.id].label;if(Proof[e.id])return Proof[e.id].label;if(Fam[e.id])return Fam[e.id].name;return'';
}
function updateBack(){
  var b=$('#panel-back'),p=Nav.list[Nav.cur-1];
  if(S.panel&&p&&p.kind!=='map'){b.hidden=false;b.textContent='\u2190 '+navLabel(p);b.setAttribute('aria-label',_('Назад')+': '+navLabel(p))}else b.hidden=true;
}
function showEntry(e){
  Nav.silent=true;
  if(e.kind==='map'){if(S.panel||S.focus)closePanel()}
  else if(e.kind==='card')openNode(e.id);
  else if(e.kind==='about')openNode('root');
  else{S.focus=null;applyClasses();openPanel({kind:e.kind});if(S.mode==='desk')animCam(camFor(allIds(),1.3))}
  Nav.silent=false;
  restoreDetails(e.open);pbody.scrollTop=e.scroll||0;updateBack();
}
function goTo(i){saveScroll();Nav.cur=i;showEntry(Nav.list[i])}
function navBack(){if(Nav.cur<1)return;if(Nav.pushed)history.back();else goTo(Nav.cur-1)}
addEventListener('popstate',function(ev){
  var st=ev.state,h=readHash();
  if(st&&Nav.list[st.i]&&hashOf(Nav.list[st.i])===h){goTo(st.i);return}
  saveScroll();
  var map={kind:'map',id:null,scroll:0,open:[]},e=map;
  var cid=cardFromHash(h);
  if(cid)e={kind:'card',id:cid,scroll:0,open:[]};
  else if(h==='filter'||h==='sel'||h==='about')e={kind:h,id:null,scroll:0,open:[]};
  Nav.list=e===map?[map]:[map,e];Nav.cur=Nav.list.length-1;
  showEntry(e);
  try{history.replaceState({i:Nav.cur},'')}catch(x){}
});

/* ------- cards ------- */
var starI='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.800l2.200 4.600 5 .7-3.600 3.500.9 5-4.500-2.400-4.500 2.400.9-5L2.800 8.100l5-.7z"/></svg>';
var passI='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>';
function actions(id){
  var s=!!mem.star[id],x=!!mem.pass[id];
  var sL=s?_('У вашому виборі'):_('Додати до вибору'),xL=x?_('Пропущено'):_('Пропустити');
  var sT=' title="'+esc(s?_('Прибрати зі списку «Мій вибір».'):_('Додати до списку «Мій вибір». Він зберігається лише в цьому браузері.'))+'"';
  var xT=' title="'+esc(x?_('Прибрати позначку пропуску.'):_('Пропустити: картка лишається, на карті вона сіра й у списку «Мій вибір».'))+'"';
  return '<div class="acts"><button type="button" class="act star '+(s?'on':'')+'" data-act="star" data-id="'+id+'" aria-pressed="'+s+'"'+sT+'>'+starI+sL+'</button>'+
   '<button type="button" class="act '+(x?'on':'')+'" data-act="pass" data-id="'+id+'" aria-pressed="'+x+'"'+xT+'>'+passI+xL+'</button></div>'+
   '<textarea class="note" data-note="'+id+'" placeholder="'+esc(_('Коротка нотатка для себе'))+'" aria-label="'+esc(_('Нотатка'))+'">'+esc(mem.note[id]||'')+'</textarea>';
}
function sec(title,body,ed){return '<section class="sec"><h2>'+esc(title)+(ed?'<span class="ed">'+esc(ed)+'</span>':'')+'</h2>'+body+'</section>'}
function fold(title,body,ed){return '<details class="sec"><summary>'+esc(title)+(ed?'<span class="ed">'+esc(ed)+'</span>':'')+'</summary><div class="foldbody">'+body+'</div></details>'}
function first(s){var m=String(s||'').match(/^.{24,}?[.!?…](?=\s+[А-ЯҐЄІЇA-Z«"]|$)/);var r=m?m[0]:String(s||'');return r}
function sumRow(k,v,cls){return '<div class="sumrow '+(cls||'')+'"><dt>'+esc(k)+'</dt><dd>'+v+'</dd></div>'}
function pendLine(c){return LANG==='en'&&c._pending?'<p class="small pend">'+esc(_('Цю картку ще не перекладено, текст нижче українською.'))+'</p>':''}
var GLOSS=[[/\bN\s?=/,N_('N: кількість у вибірці.')],[/\b[dh]\s?=/,N_('d, h: стандартизований розмір ефекту; 0 означає, що ефекту немає.')],[/\bSE\b/,N_('SE: стандартна похибка.')],[/κ/,N_('κ: узгодженість кодерів.')],[/β/,N_('β: коефіцієнт регресії.')],[/\bCI\b/,N_('CI: довірчий інтервал.')],[/ηp²/,N_('ηp²: частка дисперсії, яку пояснює умова.')],[/\bp\s?[<=]/,N_('p: імовірність такого результату за відсутності ефекту.')]];
function gloss(text){var r=[];GLOSS.forEach(function(g){if(g[0].test(text))r.push(_(g[1]))});return r.length?'<p class="small gloss">'+esc(r.join(' '))+'</p>':''}
/* The denominator and the caveat stay on the first screen; the rest of the entry is in the closed section. */
function oftenLine(o){
  var txt=String(o.text||''),a=first(txt),rest=txt.slice(a.length).trim(),v=o.value;
  if(o.state==='none'){
    if(/^[А-ЯҐЄІЇ][а-яґєії]/.test(a))a=a.charAt(0).toLowerCase()+a.slice(1);
    return '<b>'+esc(v.charAt(0).toUpperCase()+v.slice(1))+':</b> '+esc(a);
  }
  var out=a,boiler=/цілеспрямованої вибірки|purposive sample/.test(rest),next=first(rest);
  if(next&&!/^Частка серед|^Share among/.test(next))out+=' '+next;
  if(boiler)out+=' '+_('Це частка в цілеспрямованій вибірці; частот у новинах вона не дає.');
  return '<b class="num">'+esc(v)+'</b> '+esc(out);
}
function lines(arr,cls){return '<ul class="lines '+(cls||'')+'">'+arr.map(function(x){return'<li>'+esc(x)+'</li>'}).join('')+'</ul>'}
function scale(l,v){return '<div class="scale"><span>'+esc(l)+'</span><div class="bar"><div class="fill" style="width:'+(v*10)+'%"></div></div><b>'+v+'</b></div>'}
function arrowRows(p){return p.techs.map(function(t){var T=Tech[t.id];return'<button type="button" class="prow tr" data-open="'+t.id+'"><span class="sw"><svg width="12" height="12" viewBox="-6 -6 12 12"><rect x="-5" y="-1.200" width="10" height="2.400" fill="'+colorOf(t.id)+'"/></svg></span><span class="n">'+esc(T.label)+(t.note?'<small>'+esc(t.note)+'</small>':'')+'</span><span class="m">'+esc(t.home?_('основна'):'')+'</span></button>'}).join('')}
var ORIG={en:N_('Оригінал англійською'),de:N_('Оригінал німецькою'),ru:N_('Оригінал російською')};
function origLabel(l){return ORIG[l]?_(ORIG[l]):_('оригінал')+', '+l}
function quoteBlock(q,c){return '<blockquote class="quote" style="color:'+c+'"><span class="l">'+esc(origLabel(q.lang))+'</span><p class="o">'+esc(q.orig)+'</p>'+(q.tr===q.orig?'':'<p class="u">'+esc(q.tr)+'</p>')+'</blockquote>'}
function proofHead(p,c){
  return '<div class="card"><div class="topline" style="color:'+c+'"></div><div class="kick">'+esc(_('Доказ'))+' · '+esc(TYPE[p.type].name)+'</div><h1>'+esc(p.title)+'</h1>'+pendLine(p)+
    '<div class="badges">'+p.regimes.map(function(r){return'<span class="badge">'+esc(REG[r].name)+'</span>'}).join('')+'</div>';
}
function statusRows(p){
  var s='';
  if(p.status==='not_accepted')s+=sumRow(_('Статус'),esc(D.status[p.status])+': '+esc(p.status_reason||''),'warnrow');
  else if(p.status==='candidate')s+=sumRow(_('Статус'),esc(D.status[p.status])+': '+esc(_('його взято з ранніх нотаток, повного дослідницького огляду він не проходив.')),'warnrow');
  if(p.open_gap)s+=sumRow(_('Прогалина'),esc(p.open_gap),'warnrow');
  return s;
}
function whoBlock(p){return sec(_('Хто, що, коли, де'),'<dl class="dl"><dt>'+esc(_('Хто'))+'</dt><dd>'+esc(p.who)+'</dd><dt>'+esc(_('Коли'))+'</dt><dd>'+esc(p.when)+'</dd><dt>'+esc(_('Де'))+'</dt><dd>'+esc(p.where)+'</dd></dl>')}
function objBlock(p,lab){return sec(_('Найгостріше заперечення'),'<dl class="obj"><dt>'+esc(lab)+'</dt><dd>'+esc(p.objection.attack)+'</dd><dt>'+esc(_('Відповідь'))+'</dt><dd>'+esc(p.objection.reply)+'</dd></dl>')}
function storyBlock(p){var rest=p.quote?p.story:p.story.slice(2);return rest.length?sec(_('Що сталося'),lines(rest)+gloss(p.story.join(' '))):''}
function techHead(t,f){return '<div class="card"><div class="topline" style="color:'+f.color+'"></div><div class="kick">'+esc(_('Прийом'))+' · '+esc(f.name)+'</div><h1>'+esc(t.label)+'</h1><p class="sci">'+esc(t.sci)+'</p>'+pendLine(t)}
function oftenRows(t){return t.often.map(function(o){return'<div class="often '+esc(o.state)+'"><b>'+esc(o.value)+'</b><span>'+esc(o.text)+'</span></div>'}).join('')}
function techFolds(t){
  var h=fold(_('Популярна назва'),'<p><b>'+esc(t.popular)+'</b></p><p class="small"><b>'+esc(_('Коли підходить точно.'))+'</b> '+esc(t.popular_fit)+'</p>');
  h+=fold(_('Що може зробити глядач'),'<p>'+esc(t.viewer.action)+'</p><p class="small">'+esc(t.viewer.tested)+'</p>');
  var stud=t.studied.design+' '+t.studied.sample+' '+t.studied.limits;
  h+=fold(_('Як досліджено'),'<dl class="dl wide"><dt>'+esc(_('Дизайн'))+'</dt><dd>'+esc(t.studied.design)+'</dd><dt>'+esc(_('Вибірка'))+'</dt><dd>'+esc(t.studied.sample)+'</dd><dt>'+esc(_('Межі'))+'</dt><dd>'+esc(t.studied.limits)+'</dd></dl>'+gloss(stud));
  if(t.gaps&&t.gaps.length)h+=fold(_('Прогалини')+', '+t.gaps.length,lines(t.gaps,'gaps'));
  return h;
}
function famHead(f){
  var col=!!S.collapsed[f.id];
  return '<div class="card"><div class="topline" style="color:'+f.color+'"></div><div class="kick">'+esc(_('Родина прийомів · редакційне групування'))+'</div><h1 style="color:'+f.color+'">'+esc(f.name)+'</h1><p class="sci">'+esc(f.sub)+'</p>'+pendLine(f)+
    '<button type="button" class="plain" data-toggle="'+f.id+'">'+esc(col?_('Розгорнути на карті'):_('Згорнути на карті'))+'</button>';
}
function srcRow(s){
  var lab=esc(srcLabel(s)),doiUrl=s.doi?'https://doi.org/'+s.doi:'',u=s.url||doiUrl;
  if(u)lab='<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+lab+'</a>';
  return '<div class="src">'+lab+(s.locator?' <span class="loc">· '+esc(s.locator)+'</span>':'')+(s.doi?'<span class="pth">DOI <a href="'+esc(doiUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(s.doi)+'</a></span>':'')+'</div>';
}
function sourcesFold(c){
  var rows=(c.sources||[]).map(srcRow).join('');
  return fold(_('Джерела'),rows||'<p class="small">'+esc(_('Для цієї картки поки немає джерела з публічним посиланням.'))+'</p>');
}
/* giscus loads only when this section opens. */
function commentsFold(id){return '<details class="sec comments"><summary>'+esc(_('Коментарі'))+'</summary><div class="foldbody"><div class="giscus-slot" data-term="'+esc(id)+'"></div></div></details>'}
/* "Image." under the kicker "Case · Image" says nothing new; neither does "Experiment." under "Experimental studies". */
function kindIsType(p){var k=String(p.kind).replace(/[.\s]+$/,'').toLowerCase();return k===TYPE[p.type].name.toLowerCase()||(p.type==='experiment'&&(k==='experiment'||k==='експеримент'))}
function proofCard(p){
  var c=colorOf(p.id),h=proofHead(p,c),q=p.quote;
  var s=statusRows(p);
  s+=sumRow(_('Показує'),esc(q?q.meaning:p.story.slice(0,2).join(' ')));
  if(p.caveat)s+=sumRow(_('Застереження'),esc(p.caveat),'warnrow');
  if(!kindIsType(p))s+=sumRow(_('Який це доказ'),esc(p.kind));
  h+='<dl class="summary">'+s+'</dl>';
  h+=actions(p.id);
  h+=whoBlock(p);
  h+=storyBlock(p);
  if(q)h+=sec(_('Цитата'),quoteBlock(q,c)+(q.note?'<p class="small" style="margin-top:7px">'+esc(q.note)+'</p>':''));
  h+=objBlock(p,_('Заперечення'));
  h+=sec(_('Від яких прийомів ведуть стрілки'),arrowRows(p));
  if(p.gaps&&p.gaps.length)h+=fold(_('Прогалини')+', '+p.gaps.length,lines(p.gaps,'gaps'));
  h+=sourcesFold(p);
  h+=commentsFold(p.id);
  return h+'</div>';
}
function proofRow(id){
  var p=Proof[id],c=colorOf(id),on=!!mem.star[id];
  return '<div class="prow pr '+(isLead(p)?'i':'')+'"><button type="button" class="pmain" data-open="'+id+'"><svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">'+markSVG(p.type,wornOf(p),c,4.800)+'</svg><span class="n">'+esc(p.label)+'<small>'+esc(TYPE[p.type].name)+(p.status!=='accepted'?' · '+esc(D.status[p.status]):'')+'</small></span><span class="m">'+(p.techs.length>1?'×'+p.techs.length:'')+'</span></button><button type="button" class="pstar '+(on?'on':'')+'" data-act="star" data-id="'+id+'" aria-pressed="'+on+'" aria-label="'+esc((on?_('Прибрати зірку'):_('Обрати'))+': '+p.label)+'">'+starI+'</button></div>';
}
function techCard(t){
  var f=Fam[t.family],h=techHead(t,f),s='';
  if(t.open_gap)s+=sumRow(_('Прогалина'),esc(t.open_gap),'warnrow');
  s+=sumRow(_('Робить'),esc(t.does));
  s+=sumRow(_('Як часто'),oftenLine(t.often[0]));
  h+='<dl class="summary">'+s+'</dl>';
  h+=actions(t.id);
  h+=sec(_('Докази')+', '+t.proofs.length,t.proofs.map(proofRow).join(''));
  h+=sec(_('Де трапляється'),lines(t.where));
  h+=sec(_('Чи працює на правдивих фактах'),'<p><b>'+esc(t.true_facts.verdict)+'.</b> '+esc(t.true_facts.text)+'</p>');
  h+=fold(_('Як часто: усі оцінки'),oftenRows(t));
  h+=techFolds(t);
  h+=sourcesFold(t);
  h+=commentsFold(t.id);
  return h+'</div>';
}
function famCard(f){
  var ts=D.techniques.filter(function(t){return t.family===f.id});
  var homes=D.proofs.filter(function(p){return Tech[p.home].family===f.id});
  var h=famHead(f);
  h+=sec(_('Прийоми')+', '+ts.length,ts.map(function(t){return'<button type="button" class="prow" data-open="'+t.id+'"><span class="sw"><svg width="12" height="12" viewBox="-6 -6 12 12"><rect x="-5" y="-1.200" width="10" height="2.400" fill="'+f.color+'"/></svg></span><span class="n">'+esc(t.label)+'<small>'+esc(t.does)+'</small></span><span class="m">'+t.proofs.length+'</span></button>'}).join(''));
  h+=sec(_('Основні докази родини')+', '+homes.length,homes.map(function(p){return proofRow(p.id)}).join(''));
  h+=fold(_('Джерела'),'<p class="small">'+esc(_('Групування в родини редакційне. Джерела вказано в картках прийомів і доказів.'))+'</p>');
  h+=commentsFold(f.id);
  return h+'</div>';
}
function filterPanel(){
  function group(title,key,items){
    return '<div class="fgroup"><h2>'+esc(title)+'</h2><div class="chips">'+items.map(function(it){
      var on=!!S.f[key][it.id];
      return '<button type="button" class="chip '+(on?'on':'')+'" data-fil="'+key+':'+it.id+'" aria-pressed="'+on+'">'+(it.icon||'')+esc(it.name)+' <em>'+it.n+'</em></button>'}).join('')+'</div></div>';
  }
  var cR=D.regimes.map(function(r){return{id:r.id,name:r.name,n:D.proofs.filter(function(p){return p.regimes.indexOf(r.id)>=0}).length}}).filter(function(x){return x.n});
  var cT=D.types.map(function(r){return{id:r.id,name:r.name,n:D.proofs.filter(function(p){return p.type===r.id}).length,icon:'<svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">'+markSVG(r.id,'worn','currentColor',4.200)+'</svg>'}});
  var groups=group(_('Режим або лідер'),'regime',cR)+group(_('Тип доказу'),'type',cT);
  return '<div class="kick">'+esc(_('Фільтри'))+'</div><div class="fhead"><div class="fsum" id="fsum">'+esc(fsumText())+'</div><div id="flist" class="flist">'+filterList()+'</div></div>'+groups+
    '<button type="button" class="plain" data-reset="1">'+esc(_('Скинути фільтри'))+'</button><div class="only-phone" style="height:8px"></div>';
}
function fsumText(){return fmt('Показано {a} з {b} доказів',{a:D.proofs.filter(proofMatch).length,b:D.proofs.length})}
function filterList(){
  if(!filterActive())return'<p class="small">'+esc(_('Оберіть режим або тип нижче: тут з’явиться список доказів, які підходять.'))+'</p>';
  var r=D.proofs.filter(proofMatch);
  return r.length?r.map(function(p){return proofRow(p.id)}).join(''):'<p class="small">'+esc(_('Жоден доказ не підходить. Зніміть один із фільтрів.'))+'</p>';
}
function selList(){
  var all=[];
  D.techniques.forEach(function(t){all.push({id:t.id,kind:'tech',label:t.label,c:t})});
  D.proofs.forEach(function(p){all.push({id:p.id,kind:'proof',label:p.label,c:p})});
  var st=all.filter(function(x){return mem.star[x.id]});
  var ps=all.filter(function(x){return mem.pass[x.id]&&!mem.star[x.id]});
  var nt=all.filter(function(x){return mem.note[x.id]&&mem.note[x.id].trim()&&!mem.star[x.id]&&!mem.pass[x.id]});
  return{st:st,ps:ps,nt:nt};
}
function selText(){
  var L=selList(),out=[_('Мій вибір')+', '+_('Атлас прийомів пропаганди')];
  function row(x){
    var s='- '+x.label;
    if(x.kind==='proof')s+=' ('+x.c.techs.map(function(t){return Tech[t.id].label}).join(', ')+')';
    var n=(mem.note[x.id]||'').trim();if(n)s+=' | '+_('нотатка')+': '+n;return s;
  }
  function group(t,a){if(a.length){out.push('');out.push(t+' ('+a.length+'):');a.forEach(function(x){out.push(row(x))})}}
  group(_('Обрано'),L.st);group(_('Пропущено'),L.ps);group(_('Лише нотатка'),L.nt);
  if(!L.st.length&&!L.ps.length&&!L.nt.length)out.push('',_('Поки що нічого не обрано.'));
  return out.join('\n');
}
/* ------- marks travel between pages: browsers keep them per address ------- */
var xferText='';
function exportString(){return JSON.stringify({app:'atlas-propaganda',v:1,star:mem.star,pass:mem.pass,note:mem.note})}
function downloadMarks(text){
  try{
    var a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    a.href=u;a.download='atlas-marks.json';document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(u)},4000);
  }catch(e){}
}
function isMap(o){return !!o&&typeof o==='object'&&!Array.isArray(o)}
function knownId(id){return !!(Tech[id]||Proof[id])}
/* Returns {changed,skipped}, or null when the text is no export of this atlas. A star or pass in the import sets that id; ids it does not name stay as they are. */
function mergeMarks(text){
  var o;try{o=JSON.parse(String(text).trim())}catch(e){return null}
  if(!isMap(o)||o.app!=='atlas-propaganda'||o.v!==1)return null;
  var star=isMap(o.star)?o.star:{},pass=isMap(o.pass)?o.pass:{},note=isMap(o.note)?o.note:{};
  var changed={},skipped={};
  Object.keys(pass).forEach(function(id){
    if(!knownId(id)){skipped[id]=1;return}
    if(!pass[id]||star[id])return;
    if(!mem.pass[id]||mem.star[id])changed[id]=1;
    mem.pass[id]=1;delete mem.star[id];
  });
  Object.keys(star).forEach(function(id){
    if(!knownId(id)){skipped[id]=1;return}
    if(!star[id])return;
    if(!mem.star[id]||mem.pass[id])changed[id]=1;
    mem.star[id]=1;delete mem.pass[id];
  });
  Object.keys(note).forEach(function(id){
    if(!knownId(id)){skipped[id]=1;return}
    var v=typeof note[id]==='string'?note[id].trim():'',cur=mem.note[id]||'';
    if(!v||cur.indexOf(v)>=0)return;
    mem.note[id]=cur.trim()?cur+' | '+v:v;changed[id]=1;
  });
  return{changed:Object.keys(changed).length,skipped:Object.keys(skipped).length};
}
function importMarks(text,pasted){
  var snap=JSON.parse(JSON.stringify(mem)),r=mergeMarks(text);
  if(!r){toast(pasted?_('Це не рядок позначок атласу. Нічого не змінено.'):_('Це не файл позначок атласу. Нічого не змінено.'));return}
  saveSel();updateMarks();applyClasses();xferText='';rerenderKeep();
  var msg=fmt('Імпортовано позначок: {a}.',{a:r.changed});
  if(r.skipped===1)msg+=' '+_('Пропущено позначку, якої ця сторінка не знає.');
  else if(r.skipped)msg+=' '+fmt('Пропущено позначок, яких ця сторінка не знає: {b}.',{b:r.skipped});
  toastUndo(msg,_('Повернути'),function(){mem=snap;saveSel();updateMarks();applyClasses();rerenderKeep()});
}
function xferBlock(){
  return sec(_('Перенести позначки'),'<p class="small">'+esc(_('Браузер зберігає позначки окремо для кожної адреси. Експорт дає файл і рядок. Імпорт додає їх до цих позначок, і кожна повертається на свою картку.'))+'</p>'+
    '<div class="xfer"><button type="button" class="plain" data-export="1">'+esc(_('Експорт'))+'</button><button type="button" class="plain" data-import-file="1">'+esc(_('Імпорт із файлу'))+'</button><button type="button" class="plain" data-import-paste="1">'+esc(_('Імпорт рядка'))+'</button></div>'+
    '<input type="file" id="importfile" accept=".json,application/json" hidden>'+
    '<textarea id="xferbox" spellcheck="false" aria-label="'+esc(_('Рядок позначок'))+'" placeholder="'+esc(_('Тут з’явиться рядок експорту. Для імпорту вставте сюди рядок з іншої сторінки.'))+'">'+esc(xferText)+'</textarea>');
}
function selPanel(){
  var L=selList();
  function item(x,mark){
    var c=colorOf(x.id),ic=x.kind==='proof'?'<svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">'+markSVG(x.c.type,wornOf(x.c),c,4.800)+'</svg>':'<svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><rect x="-6" y="-1.400" width="12" height="2.800" fill="'+c+'"/></svg>';
    return '<div class="selitem">'+ic+'<div><button type="button" class="o" data-open="'+x.id+'">'+esc(x.label)+'</button><small>'+esc(x.kind==='tech'?_('прийом'):_('доказ'))+'</small>'+(mem.note[x.id]?'<span class="nt">'+esc(mem.note[x.id])+'</span>':'')+'</div><button type="button" class="x" data-unsel="'+x.id+'" aria-label="'+esc(_('Прибрати зі списку')+' '+x.label)+'">'+'<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>';
  }
  var h='<div class="card"><h1>'+esc(_('Мій вибір'))+'</h1></div>';
  h+=sec(_('Обрано')+', '+L.st.length,L.st.length?L.st.map(function(x){return item(x)}).join(''):'<p class="small">'+esc(_('Позначте зіркою прийом або доказ на карті чи в картці.'))+'</p>');
  h+=sec(_('Пропущено')+', '+L.ps.length,L.ps.length?L.ps.map(function(x){return item(x)}).join(''):'<p class="small">'+esc(_('Порожньо.'))+'</p>');
  if(L.nt.length)h+=sec(_('Лише нотатка')+', '+L.nt.length,L.nt.map(function(x){return item(x)}).join(''));
  h+='<button type="button" class="plain primary" data-copy="1">'+esc(_('Скопіювати список текстом'))+'</button>';
  h+='<textarea id="copyout" readonly aria-label="'+esc(_('Список текстом'))+'">'+esc(selText())+'</textarea>';
  h+=xferBlock();
  h+='<div class="dangerzone"><button type="button" class="plain" data-clear="1">'+esc(_('Очистити все'))+'</button></div>';
  return h;
}
function legendTypes(){
  var g='#1D1A15',h='<div><h3>'+esc(_('Форма: тип доказу'))+'</h3>';
  D.types.forEach(function(t){h+='<div class="row"><svg width="16" height="14" viewBox="-8 -7 16 14" aria-hidden="true">'+markSVG(t.id,'worn',g,4.700)+'</svg>'+esc(t.name)+'</div>'});
  return h;
}
function legendHTML(){
  var h=legendTypes();
  h+='</div><div class="togg"><label><input type="checkbox" id="crosstoggle" '+(document.body.classList.contains('nocross')?'':'checked')+'>'+esc(_('Спільні докази: пунктир, ×N'))+'</label><span><i>'+esc(_('Курсив'))+'</i>: '+esc(_('кандидат без повного огляду'))+'</span><span><b style="font-family:var(--mono)">?</b> '+esc(_('не прийнято як доказ'))+'</span></div>';
  return h;
}
function aboutPanel(){
  var A=D.about,nt=D.techniques.length,np=D.proofs.length;
  var counts={techs:nt+' '+plural(nt,'прийом','прийоми','прийомів'),proofs:np+' '+plural(np,'доказ','докази','доказів'),shared:D.proofs.filter(function(p){return p.techs.length>1}).length,leads:D.proofs.filter(isLead).length};
  function t(s){return esc(s).replace(/\{(\w+)\}/g,function(m,k){return counts[k]})}
  var h='<div class="kick">'+esc(_('Про карту'))+'</div><div class="card"><h1>'+esc(_('Атлас прийомів пропаганди'))+'</h1></div>';
  h+='<div class="prose">'+sec(_('Що це'),'<p>'+t(A.lede)+'</p>');
  h+=sec(_('Як читати'),'<p>'+t(A.how)+'</p>');
  h+=sec(_('Умовні позначення'),'<div id="legend-copy">'+legendHTML().replace('id="crosstoggle"','id="crosstoggle2"')+'</div>');
  h+=sec(_('Що тут редакційне'),'<p>'+t(A.judgment)+'</p>');
  h+=sec(_('Частоти'),'<p>'+esc(D.corpus.text)+'</p><p class="small">'+t(A.frequency)+'</p>');
  h+=sec(_('Що ніхто не чув'),'<p>'+t(A.unheard)+'</p>');
  h+=sec(_('Межі'),'<ul class="lines">'+A.limits.map(function(x){return'<li>'+t(x)+'</li>'}).join('')+'</ul>');
  h+=sec(_('Ваші позначки'),'<p>'+t(A.marks)+'</p>');
  h+=sec(_('Клавіші'),'<p>'+t(A.keys)+'</p>');
  h+=fold(_('Джерела'),'<div class="src"><a href="'+esc(D.corpus.url)+'" target="_blank" rel="noopener noreferrer">Da San Martino et al., 2019</a> <span class="loc">· '+esc(A.corpus_locator)+'</span></div>');
  return h+'</div>';
}

/* ------- search ------- */
function NOHIT(){return _('Нічого не знайдено.')}
function marked(sn,prefix,suffix){
  var j=sn.toLowerCase().indexOf(S.q);
  return prefix+esc(sn.slice(0,j))+'<mark>'+esc(sn.slice(j,j+S.q.length))+'</mark>'+esc(sn.slice(j+S.q.length))+suffix;
}
function isGap(t,at){return /\s/.test(t.charAt(at))}
/* Where a cut at `en` ends on a whole word, never before `min`. */
function wordEnd(t,en,min,hi){
  if(en>=hi||isGap(t,en))return en;
  var b=t.slice(min,en).search(/\s\S*$/);
  if(b>=0)return min+b;
  while(en<hi&&!isGap(t,en))en++;
  return en;
}
/* A cut end takes the ellipsis in place of its own stop. */
function cutTail(s,cut){return cut?s.replace(/[\s.,;:]+$/,'')+'…':s}
/* The text around a hit, from a whole word to a whole word. */
function around(t,i,lo,hi){
  var n=S.q.length,st=Math.max(lo,i-46),en=wordEnd(t,Math.min(hi,i+n+70),i+n,hi);
  if(st>lo&&!isGap(t,st-1)){
    var sp=t.slice(st,i).search(/\s/);
    if(sp>=0)st+=sp+1;else while(st>lo&&!isGap(t,st-1))st--;
  }
  return marked(cutTail(t.slice(st,en),en<hi),st>lo?'…':'','');
}
/* One source, without its address. An address can be searched, so a hit inside one shows the source's own words. */
function sourceSnippet(t,i,vis){
  var from=t.lastIndexOf(' · ',i),to=t.indexOf(' · ',i);
  var s=t.slice(from<vis?vis:from+3,to<0?t.length:to).replace(/https?:\/\/\S+/g,' ').replace(/\s+/g,' ').trim();
  var j=s.toLowerCase().indexOf(S.q);
  if(j>=0)return around(s,j,0,s.length);
  var en=wordEnd(s,Math.min(s.length,116),0,s.length);
  return esc(cutTail(s.slice(0,en),en<s.length));
}
/* The result already shows the name, so the snippet leaves it out. A hit in the name shows where the card goes on. */
function snippet(h,name){
  var t=h.x.t,top=h.x.top,i=h.x.low.indexOf(S.q);
  if(i<top){
    if(name.toLowerCase().indexOf(S.q)>=0){var en=wordEnd(t,Math.min(h.x.vis,top+116),top,h.x.vis);return esc(cutTail(t.slice(top,en).trim(),en<h.x.vis))}
    return marked(String(h.c.title),'','');
  }
  return i<h.x.vis?around(t,i,top,h.x.vis):sourceSnippet(t,i,h.x.vis);
}
function runSearch(q){
  /* The English text is set with typographic apostrophes; a typed straight one still finds it. */
  S.q=q.trim().toLowerCase().replace(/'/g,'’');
  var box=$('#results');
  if(S.q.length<2){box.hidden=true;box.innerHTML='';afterFilter();return}
  var hits=[];
  ['families','techniques','proofs'].forEach(function(k){D[k].forEach(function(c){
    var x=Idx[c.id];var i=x.low.indexOf(S.q);if(i<0)return;
    var score=(x.head.indexOf(S.q)>=0?0:1)+(k==='proofs'?.1:k==='techniques'?.05:0);
    hits.push({c:c,k:k,i:i,x:x,score:score});
  })});
  hits.sort(function(a,b){return a.score-b.score});
  $('#search').setAttribute('aria-expanded','true');
  box.hidden=false;
  if(!hits.length){box.innerHTML='<div class="resnone">'+esc(NOHIT())+'</div>';afterFilter();return}
  box.innerHTML=hits.slice(0,14).map(function(h,ix){
    var name=h.c.label||h.c.name,snip=snippet(h,name);
    var kk=h.k==='proofs'?_('доказ'):h.k==='techniques'?_('прийом'):_('родина');
    return '<button type="button" class="res '+(ix===0?'active':'')+'" data-open="'+h.c.id+'" role="option"><span class="k">'+esc(kk)+'</span><b>'+esc(name)+'</b>'+(snip?'<span class="s">'+snip+'</span>':'')+'</button>'}).join('')+
    (hits.length>14?'<div class="resnone">'+esc(fmt('Ще {a}. Уточніть запит.',{a:hits.length-14}))+'</div>':'');
  afterFilter();
}
var LAYOUT='atlas-propaganda-layout-v1';
function loadOffsets(){var m=innerWidth<=760?'phone':'desk';S.off={};try{var v=JSON.parse(localStorage.getItem(LAYOUT)||'{}');S.off=v[m]||{}}catch(e){}markReset()}
function saveOffsets(){var m=S.mode;try{var v=JSON.parse(localStorage.getItem(LAYOUT)||'{}');v[m]=S.off;localStorage.setItem(LAYOUT,JSON.stringify(v))}catch(e){}markReset()}
function markReset(){var b=$('#reset-layout');if(b)b.hidden=!Object.keys(S.off).length}
var relayoutT=0;
function afterFilter(){
  applyClasses();
  if(S.mode==='phone'){clearTimeout(relayoutT);relayoutT=setTimeout(function(){layout(true);applyClasses();updateMarks();if(!S.focus)fit()},150)}
  var el2=$('#fsum');if(el2)el2.textContent=fsumText();
  var fl=$('#flist');if(fl)fl.innerHTML=filterList();
}
function closeResults(){$('#results').hidden=true}

/* ------- pointer ------- */
var ptrs={},gesture=null;
function svgPoint(e){return{x:e.clientX,y:e.clientY}}
function toWorld(p){return{x:(p.x-S.cam.x)/S.cam.k,y:(p.y-S.cam.y)/S.cam.k}}
function subtree(id){
  var r=[id];
  if(Fam[id])D.techniques.forEach(function(t){if(t.family===id){r.push(t.id);D.proofs.forEach(function(p){if(p.home===t.id)r.push(p.id)})}});
  else if(Tech[id])D.proofs.forEach(function(p){if(p.home===id)r.push(p.id)});
  return r;
}
svg.addEventListener('pointerdown',function(e){
  if(S.anim){cancelAnimationFrame(S.anim);S.anim=null;camMoved()}
  closeResults();
  var pos=svgPoint(e);ptrs[e.pointerId]=pos;
  try{svg.setPointerCapture(e.pointerId)}catch(err){}
  var ids=Object.keys(ptrs);
  if(ids.length===2){
    var a=ptrs[ids[0]],b=ptrs[ids[1]];
    gesture={type:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y),k0:S.cam.k,cam0:{x:S.cam.x,y:S.cam.y},mx0:(a.x+b.x)/2,my0:(a.y+b.y)/2};
    return;
  }
  var nodeEl=e.target.closest&&e.target.closest('.node');
  gesture={type:'pan',id:e.pointerId,x0:pos.x,y0:pos.y,cam0:{x:S.cam.x,y:S.cam.y},moved:false,target:e.target,nodeId:nodeEl?nodeEl.getAttribute('data-id'):null,touch:e.pointerType==='touch'};
  if(gesture.nodeId&&gesture.nodeId!=='root'){
    if(e.pointerType==='touch'){
      var g=gesture;g.lp=setTimeout(function(){if(gesture===g&&!g.moved){g.type='drag';startDrag(g)}},380);
    }else{gesture.type='drag-pending'}
  }
});
/* A label under the pointer wins; otherwise the nearest star in reach. Star areas are wider than a row. */
function pickAt(x,y){
  var list=document.elementsFromPoint(x,y),text=null,stars=[];
  for(var i=0;i<list.length;i++){
    var a=list[i];
    if(!a.closest)continue;
    var sb=a.closest('.starbtn');
    if(sb){if(stars.indexOf(sb)<0)stars.push(sb);continue}
    if(!text&&a.tagName==='text'&&a.closest('.node'))text=a.closest('.node').getAttribute('data-id');
  }
  if(text)return{node:text};
  if(stars.length){
    var best=null,bd=Infinity;
    stars.forEach(function(s){var r=s.querySelector('rect').getBoundingClientRect(),d=Math.hypot(r.left+r.width/2-x,r.top+r.height/2-y);if(d<bd){bd=d;best=s}});
    return{star:best.getAttribute('data-star')};
  }
  return{};
}
function startDrag(g){
  g.ids=subtree(g.nodeId).filter(function(i){return N[i]&&N[i].visible});
  g.start=g.ids.map(function(i){return{x:N[i].x,y:N[i].y,ox:(S.off[i]||{x:0}).x,oy:(S.off[i]||{y:0}).y}});
  svg.classList.add('panning');
  try{if(navigator.vibrate)navigator.vibrate(12)}catch(e){}
}
svg.addEventListener('pointermove',function(e){
  if(!ptrs[e.pointerId])return;
  var pos=svgPoint(e);ptrs[e.pointerId]=pos;
  if(!gesture)return;
  if(gesture.type==='pinch'){
    var ids=Object.keys(ptrs);if(ids.length<2)return;
    var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    legendOnMove();camMoved();
    var k=Math.max(minK(),Math.min(3.2,gesture.k0*d/gesture.d0)),r=k/gesture.k0;
    S.cam=clampCam({k:k,x:mx-(gesture.mx0-gesture.cam0.x)*r,y:my-(gesture.my0-gesture.cam0.y)*r});applyCam();return;
  }
  var dx=pos.x-gesture.x0,dy=pos.y-gesture.y0;
  if(!gesture.moved&&Math.hypot(dx,dy)<5)return;
  gesture.moved=true;
  if(gesture.lp){clearTimeout(gesture.lp);gesture.lp=null}
  if(gesture.type==='drag-pending'){gesture.type='drag';startDrag(gesture)}
  if(gesture.type==='drag'){
    gesture.ids.forEach(function(i,ix){var s=gesture.start[ix],wx=dx/S.cam.k,wy=dy/S.cam.k;S.off[i]={x:s.ox+wx,y:s.oy+wy};N[i].tx=s.x+wx;N[i].ty=s.y+wy;setPos(N[i],s.x+wx,s.y+wy)});
    drawEdges();return;
  }
  svg.classList.add('panning');legendOnMove();camMoved();
  S.cam=clampCam({k:S.cam.k,x:gesture.cam0.x+dx,y:gesture.cam0.y+dy});applyCam();
});
function endPtr(e){
  if(!ptrs[e.pointerId])return;
  delete ptrs[e.pointerId];
  var g=gesture;
  if(g&&g.lp){clearTimeout(g.lp);g.lp=null}
  svg.classList.remove('panning');
  if(Object.keys(ptrs).length===0)gesture=null;
  else if(g&&g.type==='pinch'){gesture=null;return}
  if(g&&g.type==='drag'&&g.moved)saveOffsets();
  if(!g||g.type==='pinch'||g.moved||g.type==='drag')return;
  if(e.type==='pointercancel')return;
  var hitAt=pickAt(e.clientX,e.clientY);
  if(hitAt.star){toggleStar(hitAt.star);return}
  var tog=g.target.closest&&g.target.closest('.famtoggle');
  if(tog){toggleFamily(g.nodeId);return}
  if(hitAt.node){openNode(hitAt.node);return}
  if(g.nodeId){openNode(g.nodeId);return}
  if(S.focus||S.panel)closePanel();
}
svg.addEventListener('pointerup',endPtr);svg.addEventListener('pointercancel',endPtr);
svg.addEventListener('wheel',function(e){e.preventDefault();var dy=e.deltaY*(e.deltaMode===1?18:1);zoomAt(e.clientX,e.clientY,Math.exp(-dy*(e.ctrlKey?.008:.0016)))},{passive:false});
svg.addEventListener('keydown',function(e){
  var n=e.target.closest&&e.target.closest('.node');if(!n)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();openNode(n.getAttribute('data-id'))}
});
function toggleFamily(id){
  if(S.collapsed[id])delete S.collapsed[id];else S.collapsed[id]=1;
  layout(true);updateMarks();applyClasses();
  if(S.panel&&S.panel.kind==='card'&&S.panel.id===id)renderPanel();
  if(!S.focus)setTimeout(function(){fit()},40);
}
function toggleStar(id){
  if(mem.star[id])delete mem.star[id];else{mem.star[id]=1;delete mem.pass[id]}
  saveSel();updateMarks();applyClasses();rerenderKeep();
}
function togglePass(id){
  if(mem.pass[id])delete mem.pass[id];else{mem.pass[id]=1;delete mem.star[id]}
  saveSel();updateMarks();applyClasses();rerenderKeep();
}
function rerenderKeep(){if(!S.panel)return;var t=pbody.scrollTop,o=openDetails(),fl=$('#flist'),ft=fl?fl.scrollTop:0;renderPanel();restoreDetails(o);pbody.scrollTop=t;fl=$('#flist');if(fl)fl.scrollTop=ft}

/* ------- panel events ------- */
pbody.addEventListener('click',function(e){
  var t=e.target.closest('[data-open],[data-act],[data-fil],[data-reset],[data-copy],[data-clear],[data-unsel],[data-toggle],[data-export],[data-import-file],[data-import-paste]');if(!t)return;
  if(t.hasAttribute('data-open')){openNode(t.getAttribute('data-open'));return}
  if(t.hasAttribute('data-act')){var id=t.getAttribute('data-id');if(t.getAttribute('data-act')==='star')toggleStar(id);else togglePass(id);return}
  if(t.hasAttribute('data-toggle')){toggleFamily(t.getAttribute('data-toggle'));return}
  if(t.hasAttribute('data-fil')){var p=t.getAttribute('data-fil').split(':');var set=S.f[p[0]];if(set[p[1]])delete set[p[1]];else set[p[1]]=1;rerenderKeep();afterFilter();return}
  if(t.hasAttribute('data-reset')){S.f=emptyF();rerenderKeep();afterFilter();return}
  if(t.hasAttribute('data-copy')){copyList();return}
  if(t.hasAttribute('data-export')){xferText=exportString();var xb=$('#xferbox');if(xb)xb.value=xferText;downloadMarks(xferText);toast(_('Експортовано: atlas-marks.json і рядок нижче'));return}
  if(t.hasAttribute('data-import-file')){var fi=$('#importfile');if(fi)fi.click();return}
  if(t.hasAttribute('data-import-paste')){var xp=$('#xferbox');if(xp&&xp.value.trim())importMarks(xp.value,true);else toast(_('Спершу вставте рядок у поле нижче.'));return}
  if(t.hasAttribute('data-clear')){
    var snap=JSON.parse(JSON.stringify(mem));
    mem={star:{},pass:{},note:{}};saveSel();updateMarks();applyClasses();rerenderKeep();
    toastUndo(_('Очищено'),_('Повернути'),function(){mem=snap;saveSel();updateMarks();applyClasses();rerenderKeep()});
    return;
  }
  if(t.hasAttribute('data-unsel')){var u=t.getAttribute('data-unsel');delete mem.star[u];delete mem.pass[u];delete mem.note[u];saveSel();updateMarks();applyClasses();rerenderKeep();return}
});
pbody.addEventListener('change',function(e){
  if(e.target.id!=='importfile'||!e.target.files||!e.target.files[0])return;
  var rd=new FileReader();
  rd.onload=function(){importMarks(String(rd.result))};
  rd.onerror=function(){toast(_('Це не файл позначок атласу. Нічого не змінено.'))};
  rd.readAsText(e.target.files[0]);
});
/* One thread per card. Comments load only when the section opens, and only on the site. */
var GISCUS=/*GISCUS*/{};
pbody.addEventListener('toggle',function(e){
  var d=e.target;
  if(!d.classList||!d.classList.contains('comments')||!d.open)return;
  var slot=d.querySelector('.giscus-slot');
  if(!slot||slot.firstChild)return;
  if(!GISCUS.repo||!GISCUS.repoId||!GISCUS.categoryId||location.protocol==='file:'){
    /* From a file the site may still have them; on a site with an empty config nothing is coming. */
    slot.innerHTML='<p class="small">'+esc(location.protocol==='file:'?_('Коментарі з’являться на сайті.'):_('Коментарі поки вимкнені.'))+'</p>';return;
  }
  var box=document.createElement('div'),s=document.createElement('script');
  box.className='giscus';slot.appendChild(box);
  var at={'data-repo':GISCUS.repo,'data-repo-id':GISCUS.repoId,'data-category-id':GISCUS.categoryId,'data-mapping':'specific','data-term':slot.getAttribute('data-term'),'data-strict':'1','data-reactions-enabled':'1','data-emit-metadata':'0','data-input-position':'bottom','data-theme':'light','data-lang':LANG==='en'?'en':'uk','crossorigin':'anonymous'};
  if(GISCUS.category)at['data-category']=GISCUS.category;
  Object.keys(at).forEach(function(k){s.setAttribute(k,at[k])});
  s.src='https://giscus.app/client.js';s.async=true;
  slot.appendChild(s);
},true);
pbody.addEventListener('input',function(e){
  var id=e.target.getAttribute&&e.target.getAttribute('data-note');if(!id)return;
  var v=e.target.value;if(v.trim())mem.note[id]=v;else delete mem.note[id];saveSel();
});
/* With no panel open the toast keeps to the gap between the wings, above the Legend button, where it covers no label. A gap too narrow or off screen leaves it centred. */
function setToastGap(c){
  var a=-Infinity,b=Infinity,st=document.documentElement.style,l=0,r=0;
  if(S.mode==='desk'){
    D.families.forEach(function(f){var B=bboxOf(subtree(f.id));if(B.l>B.r)return;if(f.wing==='left')a=Math.max(a,B.r);else b=Math.min(b,B.l)});
    l=c.x+(a+7)*c.k+5;r=c.x+(b-7)*c.k-5;
  }
  var fits=r-l>=120&&l>=0&&r<=innerWidth;
  document.body.classList.toggle('toast-gap',fits);
  if(fits){st.setProperty('--toast-x',Math.round((l+r)/2)+'px');st.setProperty('--toast-w',Math.floor(r-l)+'px')}
  else{st.removeProperty('--toast-x');st.removeProperty('--toast-w')}
}
/* An open legend is taller than the closed button the toast normally clears. */
function placeToast(){setToastGap(S.cam);var e=$('#toast'),l=$('#legend');var r=l.getBoundingClientRect();e.style.bottom=S.mode==='desk'&&panel.hidden&&!l.classList.contains('min')&&r.bottom>innerHeight/2?Math.ceil(innerHeight-r.top+10)+'px':''}
function toast(t){var el2=$('#toast');el2.textContent=t;el2.hidden=false;placeToast();clearTimeout(toast.t);toast.t=setTimeout(function(){el2.hidden=true},2000)}
function toastUndo(t,label,fn){
  var el2=$('#toast');el2.innerHTML=esc(t)+' <span aria-hidden="true">·</span> <button type="button" id="toast-undo">'+esc(label)+'</button>';el2.hidden=false;placeToast();
  clearTimeout(toast.t);toast.t=setTimeout(function(){el2.hidden=true},10000);
  $('#toast-undo').addEventListener('click',function(){clearTimeout(toast.t);el2.hidden=true;fn()});
}
function copyList(){
  var text=selText();
  var ta=$('#copyout');if(ta)ta.value=text;
  function fallback(){
    if(!ta){return}ta.focus();ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}
    toast(ok?_('Скопійовано'):_('Не вдалося. Виділіть текст нижче вручну.'));
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){toast(_('Скопійовано'))},fallback)}else fallback();
}

/* ------- chrome ------- */
var CHROME=[['#map','aria-label',N_('Карта прийомів пропаганди та їхніх доказів')],['#titlebtn','aria-label',N_('Про карту')],['#search','placeholder',N_('Пошук по всьому тексту')],['#search','aria-label',N_('Пошук по всьому тексту')],['#btn-search','aria-label',N_('Пошук')],['#btn-filter','aria-label',N_('Фільтри')],['#btn-filter .lab','',N_('Фільтри')],['#btn-sel','aria-label',N_('Мій вибір')],['#btn-sel .lab','',N_('Мій вибір')],['#btn-about','aria-label',N_('Про карту')],['#btn-about .lab','',N_('Про карту')],['#legend','aria-label',N_('Умовні позначення')],['#zoom','aria-label',N_('Масштаб')],['#z-in','aria-label',N_('Наблизити')],['#z-out','aria-label',N_('Віддалити')],['#z-fit','aria-label',N_('Показати всю карту')],['#reset-layout','',N_('Скинути розташування')],['#panel-close','aria-label',N_('Закрити')]];
function chrome(){
  document.documentElement.lang=LANG;
  docTitle();
  CHROME.forEach(function(c){var e=$(c[0]);if(!e)return;if(c[1])e.setAttribute(c[1],_(c[2]));else e.textContent=_(c[2])});
  var small=innerWidth<=760;
  $('.t1').textContent=small?_('Атлас пропаганди'):_('Атлас прийомів пропаганди');
  $('#titlecount').textContent=D.techniques.length+' '+plural(D.techniques.length,'прийом','прийоми','прийомів')+' · '+D.proofs.length+' '+_('доказів')+(small?'':' · '+D.families.length+' '+_('родин'));
  ['#btn-lang','#panel-lang'].forEach(function(q){
    var lb=$(q);lb.hidden=!HAS_EN;lb.textContent=LANG==='en'?'УКР':'EN';
    lb.setAttribute('aria-label',LANG==='en'?'Українською':'In English');
  });
}
function buildLegend(){
  $('#legend').innerHTML='<button id="legmin" type="button"></button>'+legendHTML();
  $('#legmin').addEventListener('click',function(){setLegend(!$('#legend').classList.contains('min'))});
}
/* The map, the open card and the chosen filters stay; only the words change. */
function setLang(l){
  LANG=l;
  try{localStorage.setItem(LANGKEY,l)}catch(e){}
  var min=$('#legend').classList.contains('min'),keep=S.panel||S.focus;
  setData();chrome();buildLegend();buildScene();setLegend(min);
  if(S.panel)rerenderKeep();
  updateBack();
  if(!keep)fit(false);
  var sv=$('#search');if(sv&&sv.value.trim().length>1)runSearch(sv.value);
}
['#btn-lang','#panel-lang'].forEach(function(q){$(q).addEventListener('click',function(){setLang(LANG==='en'?'uk':'en')})});
$('#panel-close').addEventListener('click',closePanel);
$('#panel-back').addEventListener('click',navBack);
$('#titlebtn').addEventListener('click',function(){togglePanel('about')});
$('#btn-about').addEventListener('click',function(){togglePanel('about')});
$('#btn-filter').addEventListener('click',function(){togglePanel('filter')});
$('#btn-sel').addEventListener('click',function(){togglePanel('sel')});
$('#btn-search').addEventListener('click',function(){
  var on=document.body.classList.toggle('searching');
  if(on)$('#search').focus();else{$('#search').value='';runSearch('')}
});
function togglePanel(k){
  if(S.panel&&S.panel.kind===k){closePanel();return}
  S.focus=null;applyClasses();
  if(k==='about'){openNode('root');return}
  openPanel({kind:k});
  if(S.mode==='desk')animCam(camFor(allIds(),1.3));
}
$('#z-in').addEventListener('click',function(){zoomAt(innerWidth/2,innerHeight/2,1.35,true)});
$('#z-out').addEventListener('click',function(){zoomAt(innerWidth/2,innerHeight/2,1/1.35,true)});
$('#z-fit').addEventListener('click',function(){fit()});
$('#reset-layout').addEventListener('click',function(){S.off={};saveOffsets();layout(true);fit()});
var sInput=$('#search'),debT=0;
sInput.addEventListener('input',function(){clearTimeout(debT);debT=setTimeout(function(){runSearch(sInput.value)},90)});
sInput.addEventListener('keydown',function(e){
  var box=$('#results'),items=box.querySelectorAll('.res');
  if(e.key==='Enter'){var a=box.querySelector('.res.active')||items[0];if(a){e.preventDefault();openFromResult(a)}}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();var i=Array.prototype.indexOf.call(items,box.querySelector('.res.active'));
    if(i>=0)items[i].classList.remove('active');i+=e.key==='ArrowDown'?1:-1;if(i<0)i=items.length-1;if(i>=items.length)i=0;
    if(items[i]){items[i].classList.add('active');items[i].scrollIntoView({block:'nearest'})}
  }
});
function openFromResult(a){
  var id=a.getAttribute('data-open');closeResults();
  if(S.mode==='phone'){sInput.value='';runSearch('');document.body.classList.remove('searching')}
  var q=S.q;openNode(id);
  if(q.length>1)Array.prototype.forEach.call(pbody.querySelectorAll('details'),function(d){if(d.textContent.toLowerCase().indexOf(q)>=0)d.open=true});
}
$('#results').addEventListener('click',function(e){var a=e.target.closest('.res');if(a)openFromResult(a)});
sInput.addEventListener('focus',function(){if(sInput.value.trim().length>1)runSearch(sInput.value)});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    var box=$('#results');
    if(!box.hidden){box.hidden=true;if(document.activeElement===sInput){sInput.value='';runSearch('');sInput.blur();document.body.classList.remove('searching')}return}
    if(document.body.classList.contains('searching')){document.body.classList.remove('searching');sInput.value='';runSearch('');return}
    if(S.panel||S.focus)closePanel();
    return;
  }
  if(e.key==='/'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){e.preventDefault();document.body.classList.add('searching');sInput.focus()}
});
document.addEventListener('change',function(e){
  if(e.target.id==='crosstoggle'||e.target.id==='crosstoggle2'){document.body.classList.toggle('nocross',!e.target.checked);var a=$('#crosstoggle'),b=$('#crosstoggle2');if(a)a.checked=e.target.checked;if(b)b.checked=e.target.checked}
});

/* sheet grip */
(function(){
  var g=$('#grip'),st=null;
  g.addEventListener('pointerdown',function(e){st={y:e.clientY,h:panel.getBoundingClientRect().height};try{g.setPointerCapture(e.pointerId)}catch(x){}panel.style.transition='none'});
  g.addEventListener('pointermove',function(e){if(!st)return;var h=Math.max(120,Math.min(innerHeight-52,st.h+(st.y-e.clientY)));document.documentElement.style.setProperty('--sheet',h+'px');cutLabels()});
  function end(e){if(!st)return;panel.style.transition='';var h=panel.getBoundingClientRect().height,H=innerHeight;var moved=Math.abs(e.clientY-st.y);st=null;
    if(!moved){document.documentElement.style.setProperty('--sheet',h<H*.7?'90dvh':'56dvh');cutLabels();return}
    if(h<H*.24){closePanel();return}
    document.documentElement.style.setProperty('--sheet',h>H*.72?'90dvh':h>H*.46?'56dvh':'36dvh');cutLabels()}
  g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
  /* The sheet moves without the camera: its height settles after the snap, and it slides in with the card. */
  panel.addEventListener('transitionend',function(e){if(e.target===panel&&(e.propertyName==='height'||e.propertyName==='transform'))cutLabels()});
})();

var rsT=0;
addEventListener('resize',function(){clearTimeout(rsT);rsT=setTimeout(function(){
  var mode=innerWidth<=760?'phone':'desk';
  if(mode!==S.mode){buildScene();if(S.panel)renderPanel()}
  fit(false);
},120)});

/* ------- start ------- */
function start(){
  chrome();
  buildLegend();
  buildScene();
  setLegend(false);
  fit(false);
  setLegend(true);
  for(var i in N){if(N[i].visible)setPos(N[i],N[i].tx,N[i].ty)}
  drawEdges();
  var h=cardFromHash(readHash());
  if(h){Nav.list.push({kind:'card',id:h,scroll:0,open:[]});Nav.cur=1;Nav.silent=true;openNode(h);Nav.silent=false;updateBack()}
  try{history.replaceState({i:Nav.cur},'')}catch(x){}
  window.__atlas={S:S,N:N,fit:fit,open:openNode,mem:function(){return mem},selText:selText,nav:Nav,minK:minK,applyCam:applyCam,data:function(){return D},lang:function(){return LANG},nodes:function(){return N},ready:true};
}
var fontSpec=['400 14px "Plex Serif"','700 14px "Plex Serif"','italic 400 14px "Plex Serif"','italic 700 14px "Plex Serif"','400 10px "Plex Mono"','700 10px "Plex Mono"'];
Promise.all(fontSpec.map(function(f){return document.fonts.load(f,'Прийом')})).then(start,start);
})();
