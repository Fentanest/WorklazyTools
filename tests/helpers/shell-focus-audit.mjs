/** Read-only geometry audit of actual keyboard focus; never logs field values. */
export async function beginFocusAudit(page) {
  return page.evaluate(() => {
    const ids=new WeakMap();let sequence=0;
    const id=el=>{if(!ids.has(el))ids.set(el,++sequence);return ids.get(el);};
    const visible=el=>{const s=getComputedStyle(el);return el.getClientRects().length>0&&s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0'&&!el.closest('[inert],[aria-hidden=true]');};
    const fields='input,textarea,select,[role=combobox],[role=switch],[role=checkbox],[role=radio],[role=slider],[role=spinbutton]';
    const field=el=>el.matches(fields)&&el.type!=='hidden'&&el.type!=='file'&&!el.classList.contains('sr-only')&&getComputedStyle(el).clip==='auto';
    const eligible=el=>visible(el)&&el.tabIndex>=0&&!el.matches(':disabled')&&!(el.type==='radio'&&!el.checked&&document.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`));
    const expected=[...document.querySelectorAll(fields)].filter(el=>eligible(el)&&field(el)).map(id);
    const first=[...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].find(eligible);
    if(!first)throw Error('No keyboard entry point');
    first.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
    window.__shellFocusAudit={id,visible,field,first:id(first)};
    return {expected,first:id(first),initial:{innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio}};
  });
}

export async function settledFocus(page) {
  await page.evaluate(async()=>{
    let old=scrollY,stable=0;
    for(let i=0;i<90;i++){
      await new Promise(requestAnimationFrame);
      if(Math.abs(scrollY-old)<.1)stable++;else stable=0;
      old=scrollY;if(stable>=3)break;
    }
  });
  return page.evaluate(()=>{
    const el=document.activeElement,a=window.__shellFocusAudit;
    if(!el||el===document.body)return {key:0,field:false};
    const rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
    const overlap=(r,b)=>Math.max(0,Math.min(r.right,b.right)-Math.max(r.left,b.left))*Math.max(0,Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top));
    const r=el.getBoundingClientRect();
    const bars=[...document.querySelectorAll('.mobile-header,.wl-topbar,.app-topbar,.bottom-tabs')]
      .filter(b=>a.visible(b)&&['fixed','sticky'].includes(getComputedStyle(b).position)&&!b.contains(el))
      .map(b=>({selector:b.className,rect:rect(b.getBoundingClientRect())}));
    const clipped={left:Math.max(0,r.left),right:Math.min(innerWidth,r.right),top:Math.max(0,r.top),bottom:Math.min(innerHeight,r.bottom)};
    const viewportArea=Math.max(0,clipped.right-clipped.left)*Math.max(0,clipped.bottom-clipped.top);
    const intersections=bars.map(b=>({...b,area:overlap(clipped,b.rect)})).filter(b=>b.area>0);
    const blocked=intersections.reduce((sum,b)=>sum+b.area,0),remaining=Math.max(0,viewportArea-blocked);
    return {key:a.id(el),field:a.field(el)&&a.visible(el),tag:el.tagName,type:el.type||el.getAttribute('role')||'',
      label:el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.labels?.[0]?.textContent?.trim()||'',rect:rect(r),scrollY,
      viewport:{width:innerWidth,height:innerHeight},bars:intersections,blockedArea:blocked,
      partial:blocked>.5,fullyObscured:viewportArea>0&&remaining<.5,
      outsideViewport:viewportArea===0,visibleRatio:r.width*r.height>0?remaining/(r.width*r.height):0};
  });
}

export async function auditTabCycle(page,direction,first,maxSteps=800) {
  const rows=[];let returned=false;
  for(let step=0;step<maxSteps;step++){
    await page.keyboard.press(direction==='forward'?'Tab':'Shift+Tab');
    const row=await settledFocus(page);rows.push({...row,step,direction});
    if(row.key===first){returned=true;break;}
  }
  if(!returned)throw Error('Keyboard traversal did not complete a cycle');
  return rows;
}
