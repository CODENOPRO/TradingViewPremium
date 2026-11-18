/* UI polish FX — hiệu ứng thanh khung thời gian (glide + spotlight + ink trượt). Chỉ thêm phần tử trang trí, không đụng logic. */
(function(){
  const group=document.querySelector('#topbar .timeframe-group'),fav=document.getElementById('timeframe-favourites');
  if(!group||!fav)return;
  const glide=document.createElement('i'),ink=document.createElement('i');
  glide.className='tf-glide';ink.className='tf-ink';glide.setAttribute('aria-hidden','true');ink.setAttribute('aria-hidden','true');
  group.prepend(glide,ink);
  const box=btn=>({x:btn.offsetLeft-fav.scrollLeft+fav.offsetLeft,y:btn.offsetTop+fav.offsetTop,w:btn.offsetWidth,h:btn.offsetHeight});
  const put=(el,b)=>{el.style.setProperty('--x',b.x+'px');el.style.setProperty('--y',b.y+'px');el.style.setProperty('--w',b.w+'px');el.style.setProperty('--h',b.h+'px');};
  let hovered=null;
  fav.addEventListener('pointerover',e=>{
    const btn=e.target.closest('.tf-btn');if(!btn||btn===hovered)return;hovered=btn;
    if(!glide.classList.contains('on')){glide.classList.add('snap');put(glide,box(btn));void glide.offsetWidth;glide.classList.remove('snap');glide.classList.add('on');}
    else put(glide,box(btn));
  });
  fav.addEventListener('pointermove',e=>{
    const btn=e.target.closest('.tf-btn');if(!btn)return;
    const r=btn.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
    glide.style.setProperty('--sx',(px*100).toFixed(1)+'%');
    btn.style.setProperty('--mx',((px-.5)*2).toFixed(2));btn.style.setProperty('--my',((py-.5)*2).toFixed(2));
  });
  fav.addEventListener('pointerout',e=>{
    const btn=e.target.closest('.tf-btn');if(btn){btn.style.removeProperty('--mx');btn.style.removeProperty('--my');}
    if(!fav.contains(e.relatedTarget)){hovered=null;glide.classList.remove('on','press');}
  });
  fav.addEventListener('pointerdown',()=>glide.classList.add('press'));
  addEventListener('pointerup',()=>glide.classList.remove('press'));
  function syncInk(){
    const a=fav.querySelector('.tf-btn.active');
    if(!a){ink.classList.remove('on');return;}
    const b=box(a);put(ink,{x:b.x+b.w/2-10,y:b.y+b.h-5,w:20,h:3});
    if(!ink.classList.contains('on')){ink.classList.add('snap');void ink.offsetWidth;ink.classList.remove('snap');ink.classList.add('on');}
  }
  new MutationObserver(()=>requestAnimationFrame(syncInk)).observe(fav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  fav.addEventListener('scroll',syncInk,{passive:true});addEventListener('resize',syncInk);
  document.fonts?.ready.then(syncInk);requestAnimationFrame(syncInk);setTimeout(syncInk,400);
})();
