
// ── COLORS ──────────────────────────────────────────────────────
const COLORS=[
  {id:'c1',hex:'#E05A3A',name:'Помаранч'},
  {id:'c2',hex:'#3A7BD5',name:'Синій'},
  {id:'c3',hex:'#2D9E6B',name:'Зелений'},
  {id:'c4',hex:'#9B59B6',name:'Фіолет'},
  {id:'c5',hex:'#D4A017',name:'Жовтий'},
  {id:'c6',hex:'#E05E87',name:'Рожевий'},
  {id:'c7',hex:'#607D8B',name:'Сланець'},
];
const cHex=id=>COLORS.find(c=>c.id===id)?.hex||'#D4A017';
const cName=id=>COLORS.find(c=>c.id===id)?.name||'';
// returns true if color needs dark text for contrast
function isLightColor(hex){
  const r=parseInt(hex.slice(1,3),16);
  const g=parseInt(hex.slice(3,5),16);
  const b=parseInt(hex.slice(5,7),16);
  // perceived luminance
  return (r*299+g*587+b*114)/1000 > 155;
}

// ── STATE ────────────────────────────────────────────────────────
// task: {id, name, mins, colorId}
let tasks=[], presets=[], dlTime='18:00', dlName='', planMode='deadline', startAt=null, startImmediately=false;
let defaultColorId='c5'; // yellow
let selMode=false, selectedIds=new Set();
let tlOrder=[], tlCollapsed={}, tlSelected=null, tlDragSrc=null, groupNames={};

function uid(){return Math.random().toString(36).slice(2,8)}

// ── PERSIST ──────────────────────────────────────────────────────
function save(){
  localStorage.setItem('kmt6',JSON.stringify({tasks,presets,dlTime,dlName,planMode,startAt,startImmediately,defaultColorId,tlOrder,tlCollapsed,groupNames}));
}
function load(){
  try{
    const d=JSON.parse(localStorage.getItem('kmt6')||'{}');
    tasks=d.tasks||[];presets=d.presets||defPresets();
    dlTime=d.dlTime||'18:00';dlName=d.dlName||'';
    planMode=d.planMode==='start'?'start':'deadline';
    startAt=Number.isInteger(d.startAt)?d.startAt:null;
    startImmediately=Boolean(d.startImmediately);
    defaultColorId=d.defaultColorId||'c5';
    tlOrder=d.tlOrder||[];tlCollapsed=d.tlCollapsed||{};
    groupNames=d.groupNames||{};
  }catch(e){tasks=[];presets=defPresets()}
}
function defPresets(){return[
  {id:'p1',name:'🚿 Ранок',tasks:[
    {id:uid(),name:'Підйом / душ',mins:20,colorId:'c1'},
    {id:uid(),name:'Сніданок',mins:15,colorId:'c5'},
    {id:uid(),name:'Зібратись',mins:10,colorId:'c1'},
  ]},
  {id:'p2',name:'🐾 Джек + дорога',tasks:[
    {id:uid(),name:'Прогулянка з Джеком',mins:25,colorId:'c3'},
    {id:uid(),name:'Доїхати',mins:30,colorId:'c2'},
  ]},
]}

// ── THEME ────────────────────────────────────────────────────────
let dark=localStorage.getItem('kmt6_t')==='dark';
function applyTheme(){
  dark?document.documentElement.setAttribute('data-dark',''):document.documentElement.removeAttribute('data-dark');
  document.querySelector('[onclick="toggleTheme()"] span').textContent=dark?'☀️':'🌙';
}
function toggleTheme(){dark=!dark;localStorage.setItem('kmt6_t',dark?'dark':'light');applyTheme();closeMenu()}

// ── TASK NUMBERING ──────────────────────────────────────────────
let showTaskNum=localStorage.getItem('kmt6_num')==='1';
function applyNumbering(){
  const chk=document.getElementById('ddNumCheck');
  if(chk) chk.textContent=showTaskNum?'✓':'';
  document.getElementById('taskListInner')?.classList.toggle('show-num',showTaskNum);
}
function toggleNumbering(){
  showTaskNum=!showTaskNum;
  localStorage.setItem('kmt6_num',showTaskNum?'1':'0');
  applyNumbering();
  closeMenu();
}

// ── MENU ─────────────────────────────────────────────────────────
function toggleMenu(){document.getElementById('dropdown').classList.toggle('open')}
function closeMenu(){document.getElementById('dropdown').classList.remove('open')}
document.addEventListener('click',e=>{
  if(!e.target.closest('[onclick="toggleMenu()"]')&&!e.target.closest('#dropdown'))closeMenu()
});

// ── TABS ─────────────────────────────────────────────────────────
let tlTickInterval=null;
function switchTab(tab,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-'+tab).classList.add('active');
  if(tab==='tl'){
    renderTimeline();
    if(tlTickInterval)clearInterval(tlTickInterval);
    tlTickInterval=setInterval(renderTimeline,30000);
  } else if(tlTickInterval){
    clearInterval(tlTickInterval);
    tlTickInterval=null;
  }
  document.getElementById('scrollArea').scrollTop=0;
}

// ── TIME UTILS ───────────────────────────────────────────────────
const t2m=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
const m2t=m=>{m=((m%1440)+1440)%1440;return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`};
const fmtM=m=>m<60?`${m}хв`:m%60?`${Math.floor(m/60)}г ${m%60}хв`:`${Math.floor(m/60)}год`;
function taskWord(n){
  const n10=n%10,n100=n%100;
  if(n100>=11&&n100<=14)return'задач';
  if(n10===1)return'задача';
  if(n10>=2&&n10<=4)return'задачі';
  return'задач';
}

function updateTotalLabel(){
  const m=tasks.reduce((s,t)=>s+t.mins,0);
  document.getElementById('totalLabel').textContent=m?` · ${fmtM(m)}`:'';
  updateStartModePreview();
}

function setPlanMode(mode){
  planMode=mode==='start'?'start':'deadline';
  save();applyPlanMode();
}
function togglePlanMode(){
  setPlanMode(planMode==='deadline'?'start':'deadline');
}
function setStartImmediately(checked){
  startImmediately=checked;
  save();updateStartModePreview();
}
function applyPlanMode(){
  const starting=planMode==='start';
  document.getElementById('modeToggleEmoji').textContent=starting?'🚀':'⏰';
  document.getElementById('modeToggleText').textContent=starting?'Почати зараз':'Зробити до події';
  document.getElementById('deadlineCard').hidden=starting;
  document.getElementById('startCard').hidden=!starting;
  document.getElementById('startNowCheck').checked=startImmediately;
  updateStartModePreview();
}
function updateStartModePreview(){
  const buffer=startImmediately?1:5;
  const lockedStart=startAt!==null;
  const start=lockedStart?startAt:nowMin()+buffer;
  const total=tasks.reduce((sum,task)=>sum+task.mins,0);
  const startTime=document.getElementById('startModeTime');
  const finishTime=document.getElementById('startModeFinish');
  const duration=document.getElementById('startModeDuration');
  if(!startTime||!finishTime||!duration)return;
  document.getElementById('startModeLabel').textContent=lockedStart
    ?'СТАРТ ЗАФІКСОВАНО'
    :`Початок через ${buffer} ${buffer===1?'хвилину':'хвилин'}`;
  startTime.textContent=`Старт о ${m2t(start)}`;
  finishTime.textContent=total?m2t(start+total):'—';
  duration.textContent=total?`(${fmtM(total)})`:'Додай задачі';
}

// ── SELECTION MODE ───────────────────────────────────────────────
function enterSelMode(id){
  selMode=true;selectedIds=new Set([id]);
  document.getElementById('taskCard').classList.add('sel-mode');
  renderTaskList();updateSelBar();
}
// Instant version used mid-swipe: flips state and paints just the one row,
// without touching the rest of the DOM — a full renderTaskList() here would
// tear this row out from under the finger before its spring-back plays.
function enterSelModeLight(id,row){
  selMode=true;selectedIds=new Set([id]);
  document.getElementById('taskCard').classList.add('sel-mode');
  if(row){
    row.classList.add('selected');
    const tk=tasks.find(x=>x.id===id);
    if(tk) row.style.setProperty('--task-color',cHex(tk.colorId));
  }
  updateSelBar();
}
function exitSelMode(){
  selMode=false;selectedIds.clear();
  document.getElementById('taskCard').classList.remove('sel-mode');
  renderTaskList();
  document.getElementById('selBar').classList.remove('active');
}
function toggleSelect(id){
  if(selectedIds.has(id))selectedIds.delete(id);
  else selectedIds.add(id);
  updateSelBar();
  const row=document.querySelector(`[data-tid="${id}"]`);
  if(row){
    const t=tasks.find(t=>t.id===id);
    row.classList.toggle('selected',selectedIds.has(id));
    row.style.setProperty('--task-color',cHex(t.colorId));
  }
}
function updateSelBar(){
  const bar=document.getElementById('selBar');
  bar.classList.toggle('active',selMode);
  document.getElementById('selCount').textContent=`${selectedIds.size} вибрано`;
  const idxs=tasks.map((t,i)=>selectedIds.has(t.id)?i:-1).filter(i=>i>-1);
  const upBtn=document.getElementById('selUpBtn'), downBtn=document.getElementById('selDownBtn');
  if(upBtn) upBtn.disabled = idxs.length===0 || idxs[0]===0;
  if(downBtn) downBtn.disabled = idxs.length===0 || idxs[idxs.length-1]===tasks.length-1;
}

// move all selected tasks up (-1) or down (+1) by one position, keeping their relative order
// ── FLIP ANIMATION HELPERS (reused by moveSelection and drag&drop) ──
function captureRowPositions(){
  const map=new Map();
  document.querySelectorAll('#taskListInner .task-row').forEach(r=>{
    map.set(r.dataset.tid, r.getBoundingClientRect().top);
  });
  return map;
}
function playFlipAnimation(firstRects){
  document.querySelectorAll('#taskListInner .task-row').forEach(r=>{
    const first=firstRects.get(r.dataset.tid);
    if(first==null) return;
    const last=r.getBoundingClientRect().top;
    const delta=first-last;
    if(delta){
      r.style.transition='none';
      r.style.transform=`translateY(${delta}px)`;
      requestAnimationFrame(()=>{
        r.style.transition='transform .22s cubic-bezier(.4,0,.2,1)';
        r.style.transform='';
      });
      r.addEventListener('transitionend',()=>{ r.style.transition=''; },{once:true});
    }
  });
}

function moveSelection(dir){
  const idxs=tasks.map((t,i)=>selectedIds.has(t.id)?i:-1).filter(i=>i>-1);
  if(idxs.length===0) return;
  if(dir<0 && idxs[0]===0) return;
  if(dir>0 && idxs[idxs.length-1]===tasks.length-1) return;

  const firstRects=captureRowPositions();

  if(dir<0){
    for(const i of idxs){
      [tasks[i-1],tasks[i]]=[tasks[i],tasks[i-1]];
    }
  } else {
    for(let k=idxs.length-1;k>=0;k--){
      const i=idxs[k];
      [tasks[i],tasks[i+1]]=[tasks[i+1],tasks[i]];
    }
  }
  save();renderTaskList();updateSelBar();
  if(navigator.vibrate) navigator.vibrate(15);
  playFlipAnimation(firstRects);
}

// ── TASK DRAG & DROP (selection mode, via the ⠿ handle) ──────────
// Lessons learned from earlier attempts, applied here:
// - Listeners are attached ONCE to the list container (guarded by a flag),
//   never inside makeTaskRow — re-attaching on every render caused duplicate
//   handlers that fought each other after the first drag.
// - The handle only exists in selection mode, and the row-level swipe gesture
//   is already disabled in selection mode, so there is no gesture race here.
// - The dragged row visibly follows the finger the whole time (not just a
//   static faded state), so nothing "jumps" only at the end.
// - The reorder + full re-render happens once on drop; FLIP animates the
//   rows that moved as a result, reusing the same helpers as the ↑/↓ buttons.
function getDropPosition(row, clientY){
  const rect=row.getBoundingClientRect();
  return clientY < rect.top + rect.height/2 ? 'above' : 'below';
}
function clearDropIndicators(){
  document.querySelectorAll('#taskListInner .task-row').forEach(r=>{
    r.classList.remove('drop-above','drop-below');
  });
}

let taskDragScrollSpeed=0, taskDragScrollRAF=null;
function startTaskDragAutoScroll(){
  if(taskDragScrollRAF) return;
  const scrollArea=document.getElementById('scrollArea');
  function step(){
    if(taskDragScrollSpeed!==0) scrollArea.scrollTop+=taskDragScrollSpeed;
    taskDragScrollRAF=requestAnimationFrame(step);
  }
  taskDragScrollRAF=requestAnimationFrame(step);
}
function stopTaskDragAutoScroll(){
  if(taskDragScrollRAF){ cancelAnimationFrame(taskDragScrollRAF); taskDragScrollRAF=null; }
  taskDragScrollSpeed=0;
}

function setupTaskDrag(){
  if(setupTaskDrag._done) return; // attach once — never per-render
  setupTaskDrag._done=true;
  const inner=document.getElementById('taskListInner');

  let dragId=null, dragRow=null, dragStartY=0, dropTarget=null, dropPos='below';

  function begin(clientY, row){
    if(!selMode) return;
    dragId=row.dataset.tid;
    dragRow=row;
    dragStartY=clientY;
    dropTarget=null;
    row.style.transition='none';
    row.style.zIndex='50';
    row.classList.add('drag-src');
    if(navigator.vibrate) navigator.vibrate(20);
  }
  function move(clientY, ev){
    if(!dragRow) return;
    if(ev && ev.cancelable) ev.preventDefault();
    const dy=clientY-dragStartY;
    dragRow.style.transform=`translateY(${dy}px)`;

    clearDropIndicators();
    const els=document.elementsFromPoint(dragRow.getBoundingClientRect().left+20, clientY);
    const targetRow=els.find(el=>el.classList && el.classList.contains('task-row') && el!==dragRow);
    if(targetRow){
      dropTarget=targetRow;
      dropPos=getDropPosition(targetRow, clientY);
      targetRow.classList.add(dropPos==='above'?'drop-above':'drop-below');
    } else {
      dropTarget=null;
    }

    const scrollArea=document.getElementById('scrollArea');
    const sRect=scrollArea.getBoundingClientRect();
    const edge=60;
    if(clientY < sRect.top+edge){
      taskDragScrollSpeed=-Math.round((edge-(clientY-sRect.top))/2)-2;
    } else if(clientY > sRect.bottom-edge){
      taskDragScrollSpeed=Math.round((edge-(sRect.bottom-clientY))/2)+2;
    } else {
      taskDragScrollSpeed=0;
    }
    startTaskDragAutoScroll();
  }
  function end(){
    if(!dragRow) return;
    stopTaskDragAutoScroll();
    const row=dragRow, id=dragId, target=dropTarget, pos=dropPos;
    dragRow=null; dragId=null; dropTarget=null;

    row.style.transition='';
    row.style.transform='';
    row.style.zIndex='';
    row.classList.remove('drag-src');
    clearDropIndicators();

    if(target && target.dataset.tid!==id){
      const firstRects=captureRowPositions();
      const srcIdx=tasks.findIndex(x=>x.id===id);
      if(srcIdx===-1) return;
      const [moved]=tasks.splice(srcIdx,1);
      let ti=tasks.findIndex(x=>x.id===target.dataset.tid);
      const insertAt = pos==='above' ? ti : ti+1;
      tasks.splice(insertAt,0,moved);
      save(); renderTaskList(); updateSelBar();
      playFlipAnimation(firstRects);
    }
  }

  inner.addEventListener('touchstart', e=>{
    const handle=e.target.closest('.task-drag-handle');
    if(!handle) return;
    const row=handle.closest('.task-row');
    if(!row) return;
    e.stopPropagation();
    begin(e.touches[0].clientY, row);
  },{passive:true});
  inner.addEventListener('touchmove', e=>{
    if(!dragRow) return;
    e.stopPropagation();
    move(e.touches[0].clientY, e);
  },{passive:false});
  inner.addEventListener('touchend', e=>{
    if(!dragRow) return;
    e.stopPropagation();
    end();
  });

  inner.addEventListener('mousedown', e=>{
    const handle=e.target.closest('.task-drag-handle');
    if(!handle) return;
    const row=handle.closest('.task-row');
    if(!row) return;
    e.preventDefault();
    begin(e.clientY, row);
    const onMove=me=>move(me.clientY, me);
    const onUp=()=>{ end(); window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
  });
}

// ── COLOR SHEET ──────────────────────────────────────────────────
let colorSheetMode=''; // 'bulk' | 'default' | taskId

function openColorSheet(mode){
  colorSheetMode=mode;
  const title=mode==='bulk'?'Колір для вибраних':mode==='default'?'Колір нових задач':'Колір задачі';
  document.getElementById('sheetTitle').textContent=title;
  const grid=document.getElementById('colorGrid');
  grid.innerHTML='';
  COLORS.forEach(c=>{
    const opt=document.createElement('div');opt.className='color-option';
    const currentId=mode==='default'?defaultColorId:mode==='bulk'?null:tasks.find(t=>t.id===mode)?.colorId;
    opt.innerHTML=`<div class="color-swatch${c.id===currentId?' sel':''}" style="background:${c.hex}" data-cid="${c.id}"></div><div class="color-name">${c.name}</div>`;
    opt.querySelector('.color-swatch').addEventListener('click',()=>applyColor(c.id));
    grid.appendChild(opt);
  });
  document.getElementById('colorSheet').classList.add('open');
  closeMenu();
}
function closeColorSheet(e){
  if(!e||e.target===document.getElementById('colorSheet'))
    document.getElementById('colorSheet').classList.remove('open');
}
function applyColor(cid){
  if(typeof colorSheetMode==='string'&&colorSheetMode.startsWith('preset_')){
    const tid=colorSheetMode.slice(7);
    const t=presetEditTasks.find(t=>t.id===tid);
    if(t){t.colorId=cid;renderPresetEditList();}
    closeColorSheet();return;
  }
  if(colorSheetMode==='default'){
    defaultColorId=cid;
    // apply to all empty (no name yet) tasks
    let changed=false;
    tasks.forEach(t=>{ if(!t.name.trim()){t.colorId=cid;changed=true;} });
    save();
    if(changed) renderTaskList();
    else updateNewColorPill();
  } else if(colorSheetMode==='bulk'){
    selectedIds.forEach(id=>{const t=tasks.find(t=>t.id===id);if(t)t.colorId=cid});
    save();exitSelMode();showToast('Колір змінено');
  } else {
    const t=tasks.find(t=>t.id===colorSheetMode);
    if(t){t.colorId=cid;save();renderTaskList();}
  }
  closeColorSheet();
}

function updateNewColorPill(){
  document.getElementById('newColorDot').style.background=cHex(defaultColorId);
  document.getElementById('newColorName').textContent=cName(defaultColorId);
}

// ── ACTION HISTORY (up to 5 steps) ───────────────────────────────
let actionHistory=[]; // array of {tasks, dlTime, dlName} snapshots, newest last
const MAX_HISTORY=5;

function pushHistory(){
  actionHistory.push({
    tasks:JSON.parse(JSON.stringify(tasks)),
    dlTime,dlName
  });
  if(actionHistory.length>MAX_HISTORY) actionHistory.shift();
  updateUndoBtn();
}

function updateUndoBtn(){
  const btn=document.getElementById('ddUndo');
  if(!btn) return;
  if(actionHistory.length){
    btn.style.display='';
    document.getElementById('ddUndoText').textContent=` Скасувати (${actionHistory.length})`;
  } else {
    btn.style.display='none';
  }
}

function undoAction(){
  if(!actionHistory.length) return;
  const snap=actionHistory.pop();
  tasks=snap.tasks; dlTime=snap.dlTime; dlName=snap.dlName;
  save(); renderTaskList(); updateTotalLabel();
  updateDlTimeDisplay();
  document.getElementById('dlName').value=dlName;
  updateUndoBtn();
  showToast(actionHistory.length?`Відновлено · ще ${actionHistory.length}`:'Відновлено');
}

// wrap save to push history before any real change
const _origSave=save;
function saveWithHistory(){
  pushHistory();
  _origSave();
}

// ── CLEAR EVENT ───────────────────────────────────────────────────
function clearEvent(){
  if(!confirm('Очистити подію і всі задачі?')) return;
  pushHistory();
  tasks=[]; dlTime='18:00'; dlName='';
  save(); exitSelMode(); renderTaskList();
  updateDlTimeDisplay();
  document.getElementById('dlName').value='';
  closeMenu();
}

// ── SORT BY COLOR ─────────────────────────────────────────────────
function sortByColor(){
  pushHistory();
  // preserve color order of first appearance
  const colorOrder=[];
  tasks.forEach(t=>{ if(!colorOrder.includes(t.colorId)) colorOrder.push(t.colorId); });
  tasks.sort((a,b)=>colorOrder.indexOf(a.colorId)-colorOrder.indexOf(b.colorId));
  save(); renderTaskList();
  closeMenu();
  showToast('Задачі відсортовано по кольору');
}

// ── DELETE WITH UNDO (kept for single/bulk delete toast) ─────────
let undoTimer=null;

function deleteTasksWithUndo(ids){
  pushHistory();
  const count=ids.length;
  tasks=tasks.filter(t=>!ids.includes(t.id));
  save();renderTaskList();updateTotalLabel();
  exitSelMode();
  clearTimeout(undoTimer);
  showUndoToast(count===1?'Задачу видалено':`${count} задач видалено`);
  undoTimer=setTimeout(()=>{hideUndoToast()},3200);
}

function bulkDelete(){
  deleteTasksWithUndo([...selectedIds]);
}

function undoDelete(){
  clearTimeout(undoTimer);
  undoAction();
  hideUndoToast();
}

// ── RENDER TASK LIST ─────────────────────────────────────────────
function renderTaskList(){
  const inner=document.getElementById('taskListInner');
  inner.innerHTML='';
  tasks.forEach((t,i)=>inner.appendChild(makeTaskRow(t,i)));
  updateTotalLabel();
  updateNewColorPill();
  setupTaskDrag();
}

// ── SHARED: duration stepper with editable number ────────────────
function makeDurWrap(obj, key, onchange){
  // obj[key] = minutes
  const wrap=document.createElement('div');wrap.className='dur-wrap';
  const bm=document.createElement('button');bm.className='dur-btn';bm.textContent='−';

  const vl=document.createElement('input');
  vl.className='dur-val';
  vl.type='number';
  vl.min=5;vl.step=5;
  vl.value=obj[key];

  const bp=document.createElement('button');bp.className='dur-btn';bp.textContent='＋';

  function setVal(v){
    v=Math.max(5,Math.round(v/5)*5);
    obj[key]=v;
    vl.value=v;
    if(onchange) onchange(v);
  }

  bm.addEventListener('click',e=>{e.stopPropagation();setVal(obj[key]-5)});
  bp.addEventListener('click',e=>{e.stopPropagation();setVal(obj[key]+5)});

  vl.addEventListener('focus',()=>{vl.select()});
  vl.addEventListener('blur',()=>{
    const v=parseInt(vl.value)||5;
    setVal(v);
  });
  vl.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();vl.blur();}
  });
  // stop tap from triggering row long-press
  vl.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
  vl.addEventListener('mousedown',e=>e.stopPropagation());

  // prevent focus steal on desktop
  bm.addEventListener('mousedown',e=>e.preventDefault());
  bp.addEventListener('mousedown',e=>e.preventDefault());
  // on mobile: after tap refocus the active textarea so keyboard stays
  [bm,bp].forEach(btn=>btn.addEventListener('touchend',()=>{
    const active=document.activeElement;
    if(active&&active.tagName==='TEXTAREA'){
      setTimeout(()=>active.focus(),0);
    }
  },{passive:true}));

  wrap.append(bm,vl,bp);
  return wrap;
}

function makeTaskRow(t,i){
  const row=document.createElement('div');
  row.className='task-row'+(selMode?' sel-mode-row':'')+(selectedIds.has(t.id)?' selected':'');
  row.dataset.tid=t.id;
  row.style.setProperty('--task-color',cHex(t.colorId));

  // left: color dot always visible; number shows when numbering is on
  const left=document.createElement('div');left.className='task-left';
  const num=document.createElement('div');num.className='task-num';num.textContent=i+1;
  const dot=document.createElement('div');dot.className='color-dot';dot.style.background=cHex(t.colorId);
  left.append(num,dot);

  // tap dot = open color picker (not in sel mode)
  left.addEventListener('click',e=>{
    if(selMode)return;
    e.stopPropagation();
    openColorSheet(t.id);
  });

  // name — textarea for multiline (max 3 lines visually, then fades out)
  const inp=document.createElement('textarea');inp.className='task-name-inp';
  inp.placeholder='Задача...';inp.value=t.name;
  inp.rows=1;
  const nameWrapRef=document.createElement('div');nameWrapRef.className='task-name-wrap';
  nameWrapRef.appendChild(inp);
  const LINE_H=22.4; // 16px * 1.4 line-height
  const PAD_V=16; // 8px top + 8px bottom padding
  const MAX_LINES=3;
  const MAX_H=Math.round(LINE_H*MAX_LINES+PAD_V);
  function autoResize(){
    inp.style.height='auto';
    const full=inp.scrollHeight;
    inp.style.height=Math.min(full, MAX_H)+'px';
    const isClamped=full>MAX_H+1;
    inp.classList.toggle('clamped', isClamped);
    nameWrapRef.classList.toggle('clamped', isClamped);
  }

  // ── DURATION DETECTION ──
  const DUR_RE=/(\d+)\s*(хвилин(?:а|и|у|ах)?|хв|мін(?:ута|ути|уту)?|годин(?:а|и|у|ах)?|год|г)(?!\p{L})/u;
  let durHintEl=null, durHintMins=null, durHintMatch=null;

  function removeDurHint(){
    if(durHintEl){
      if(durHintEl._cleanupPos) durHintEl._cleanupPos();
      durHintEl.remove();durHintEl=null;
    }
    durHintMins=null;durHintMatch=null;
  }

  function checkDurHint(){
    const val=inp.value;
    const m=val.match(DUR_RE);
    if(!m){removeDurHint();return;}
    const num=parseInt(m[1]);
    const unit=m[2].toLowerCase();
    let mins;
    if(unit.startsWith('г')||unit.startsWith('год')){
      mins=num*60;
    } else {
      mins=num;
    }
    if(mins<1||mins>600){removeDurHint();return;}
    if(durHintMins===mins&&durHintEl)return; // already showing same
    removeDurHint();
    durHintMins=mins;durHintMatch=m[0];
    // show hint bubble near dur-wrap
    durHintEl=document.createElement('div');
    durHintEl.className='dur-hint';
    durHintEl.style.cssText+='display:flex;align-items:center;gap:8px;padding-right:8px';

    const hintText=document.createElement('span');
    hintText.textContent=`⏱ ${fmtM(mins)}`;

    const hintApply=document.createElement('span');
    hintApply.textContent='застосувати';
    hintApply.style.cssText='opacity:.7;font-weight:500;font-size:13px';

    const hintX=document.createElement('button');
    hintX.textContent='✕';
    hintX.style.cssText='background:rgba(255,255,255,.18);border:none;color:inherit;border-radius:5px;width:22px;height:22px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--font)';
    hintX.addEventListener('mousedown',e=>e.preventDefault());
    hintX.addEventListener('click',e=>{
      e.stopPropagation();
      removeDurHint();
      inp.focus();
    });

    durHintEl.append(hintText, hintApply, hintX);

    function applyHint(){
      t.mins=mins;
      t.name=inp.value.replace(durHintMatch,'').replace(/\s{2,}/g,' ').trim();
      inp.value=t.name;
      const dv=dur.querySelector('.dur-val');
      if(dv) dv.value=mins;
      save();updateTotalLabel();autoResize();
      removeDurHint();
    }

    durHintEl.addEventListener('click',e=>{
      if(e.target===hintX) return;
      e.stopPropagation();
      applyHint();
    });
    document.body.appendChild(durHintEl);

    function positionHint(){
      if(!durHintEl) return;
      const anchor=durWrapContainer.getBoundingClientRect();
      const margin=8;
      // measure after appended (has real size now)
      const hintW=durHintEl.offsetWidth;
      const hintH=durHintEl.offsetHeight;
      // preferred: centered above the duration stepper
      let left=anchor.left+anchor.width/2-hintW/2;
      let top=anchor.top-hintH-8;
      // clamp horizontally to viewport
      const maxLeft=window.innerWidth-hintW-margin;
      if(left>maxLeft) left=maxLeft;
      if(left<margin) left=margin;
      // if it would go above the viewport (e.g. row near top of screen), show it below the stepper instead
      if(top<margin){
        top=anchor.bottom+8;
      }
      durHintEl.style.left=left+'px';
      durHintEl.style.top=top+'px';
      // point the little arrow at the stepper's center, clamped inside the bubble
      const arrowLeft=Math.max(14,Math.min(hintW-14,(anchor.left+anchor.width/2)-left));
      durHintEl.style.setProperty('--arrow-left',arrowLeft+'px');
      if(top>anchor.top){
        // hint is below anchor: flip arrow to point up from the top of the bubble
        durHintEl.classList.add('dur-hint-flip');
      } else {
        durHintEl.classList.remove('dur-hint-flip');
      }
    }
    positionHint();
    const repos=()=>positionHint();
    window.addEventListener('scroll',repos,true);
    window.addEventListener('resize',repos);
    durHintEl._cleanupPos=()=>{
      window.removeEventListener('scroll',repos,true);
      window.removeEventListener('resize',repos);
    };
    // store apply fn for Enter key
    durHintEl._apply=applyHint;
  }

  inp.addEventListener('input',e=>{t.name=e.target.value;save();autoResize();checkDurHint()});
  inp.addEventListener('blur',()=>{ setTimeout(removeDurHint,150); });
  requestAnimationFrame(autoResize);
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      if(durHintEl&&durHintEl._apply){
        // apply hint
        durHintEl._apply();
        // flash animation on the dur-wrap
        const dw=durWrapContainer.querySelector('.dur-wrap');
        if(dw){
          dw.style.transition='background .08s';
          dw.style.background='color-mix(in srgb,var(--text) 18%,var(--surface2))';
          setTimeout(()=>{dw.style.background='';},180);
        }
        // auto-open next task after short delay
        setTimeout(()=>{
          const newT={id:uid(),name:'',mins:15,colorId:defaultColorId};
          tasks.splice(i+1,0,newT);save();renderTaskList();
          setTimeout(()=>{
            const rows=document.querySelectorAll('.task-row');
            if(rows[i+1])rows[i+1].querySelector('.task-name-inp')?.focus();
          },20);
        },120);
        return;
      }
      const newT={id:uid(),name:'',mins:15,colorId:defaultColorId};
      tasks.splice(i+1,0,newT);save();renderTaskList();
      setTimeout(()=>{
        const rows=document.querySelectorAll('.task-row');
        if(rows[i+1])rows[i+1].querySelector('.task-name-inp')?.focus();
      },20);
    }
    if(e.key==='Backspace'&&inp.value===''&&tasks.length>1){
      e.preventDefault();
      tasks.splice(i,1);save();renderTaskList();
      setTimeout(()=>{
        const rows=document.querySelectorAll('.task-row');
        if(rows[i-1])rows[i-1].querySelector('.task-name-inp')?.focus();
      },20);
    }
  });
  inp.addEventListener('focus',()=>{
    setTimeout(()=>inp.scrollIntoView({behavior:'smooth',block:'center'}),320);
  });

  // duration wrapper (for hint positioning)
  const durWrapContainer=document.createElement('div');
  durWrapContainer.style.cssText='position:relative;flex-shrink:0';
  const dur=makeDurWrap(t,'mins',()=>{save();updateTotalLabel();});
  durWrapContainer.appendChild(dur);

  // delete
  const del=document.createElement('button');del.className='task-del';del.textContent='✕';
  del.addEventListener('click',e=>{e.stopPropagation();deleteTasksWithUndo([t.id]);});

  // drag handle (selection mode only)
  const dragHandle=document.createElement('div');dragHandle.className='task-drag-handle';dragHandle.textContent='⠿';

  // ── SWIPE RIGHT TO SELECT ──
  // Swiping the row to the right (like Todoist) nudges it aside, springs back,
  // and enters selection mode with this task selected. A short tap in selection
  // mode toggles selection. Vertical movement is left alone so list scrolling
  // is never intercepted.
  let swStartX=0, swStartY=0, swDx=0, swActive=false, swIsScroll=false, swFired=false, swPending=false, swAwaitingSelect=false;
  const SWIPE_MAX=88;

  function swStart(x,y){
    if(selMode || swAwaitingSelect) return; // swipe only enters selection mode — it does nothing once already inside it
    swStartX=x; swStartY=y; swDx=0; swActive=false; swIsScroll=false; swFired=false; swPending=true;
    row.style.transition='none';
  }
  function swMove(x,y,ev){
    if(!swPending) return;
    const dx=x-swStartX, dy=y-swStartY;
    if(!swActive && !swIsScroll){
      if(Math.abs(dy)>10 && Math.abs(dy)>Math.abs(dx)){ swIsScroll=true; return; }
      if(dx>10 && Math.abs(dx)>Math.abs(dy)){
        swActive=true;
        // select immediately as soon as the swipe is recognized — don't wait
        // for the row to finish springing back. This only flips state/classes;
        // it must NOT re-render the list, or this row would be torn out of
        // the DOM mid-animation and the spring-back would never be seen.
        if(!selMode){
          swFired=true;
          if(navigator.vibrate) navigator.vibrate(30);
          enterSelModeLight(t.id, row);
        }
      }
    }
    if(!swActive || swIsScroll) return;
    if(ev && ev.cancelable) ev.preventDefault();
    swDx = dx<0 ? 0 : Math.min(dx, SWIPE_MAX + (dx-SWIPE_MAX)*0.15); // slight rubber-band past the trigger point
    row.style.transform=`translateX(${swDx}px)`;
  }
  const SWIPE_RETURN_MS=650;
  function swEnd(){
    if(!swPending) return;
    swPending=false;
    row.style.transition=`transform ${SWIPE_RETURN_MS}ms cubic-bezier(.22,1,.36,1)`;
    row.style.transform='';
    swActive=false; swIsScroll=false;
    if(swFired){
      swAwaitingSelect=true;
      // full re-render is deferred until the spring-back animation has played out
      setTimeout(()=>{ swAwaitingSelect=false; renderTaskList(); updateSelBar(); }, SWIPE_RETURN_MS);
    }
  }

  row.addEventListener('touchstart', e=>{
    if(e.target.closest('.task-drag-handle')) return; // the handle owns this touch — drag&drop only
    if(e.target.closest('.task-name-inp')===inp && document.activeElement===inp) return; // don't hijack text selection while actively editing
    const t0=e.touches[0]; swStart(t0.clientX,t0.clientY);
  },{passive:true});
  row.addEventListener('touchmove', e=>{
    const t0=e.touches[0]; swMove(t0.clientX,t0.clientY,e);
  },{passive:false});
  row.addEventListener('touchend', swEnd);

  row.addEventListener('mousedown', e=>{
    if(e.button!==0) return;
    if(e.target.closest('.task-drag-handle')) return;
    if(e.target.closest('.task-name-inp')===inp && document.activeElement===inp) return;
    swStart(e.clientX,e.clientY);
    const onMove=me=>swMove(me.clientX,me.clientY,me);
    const onUp=()=>{ swEnd(); window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
  });

  row.addEventListener('click', e=>{
    if(swFired) return; // swipe already handled entering selection mode
    if(e.target.closest('.task-drag-handle')) return; // handle owns its own gesture
    if(selMode) toggleSelect(t.id);
  });

  row.append(left,nameWrapRef,durWrapContainer,dragHandle,del);
  return row;
}

// (task drag&drop removed — use the ↑/↓ buttons in selection mode to reorder tasks)

// ── ADD TASK ─────────────────────────────────────────────────────
function addTask(){
  if(selMode)return;
  tasks.push({id:uid(),name:'',mins:15,colorId:defaultColorId});
  save();renderTaskList();
  setTimeout(()=>{
    const rows=document.querySelectorAll('.task-row');
    if(rows.length)rows[rows.length-1].querySelector('.task-name-inp')?.focus();
  },20);
}

// ── CLEAR ALL ────────────────────────────────────────────────────
function clearAll(){
  if(!confirm('Очистити всі задачі?'))return;
  tasks=[];
  groupNames={};
  tlOrder=[];tlCollapsed={};tlSelected=null;startAt=null;
  document.querySelectorAll('.tl-name-inp').forEach(input=>{input.value=''});
  save();exitSelMode();renderTaskList();renderEmptyTimeline('Подію очищено');closeMenu();
}

// ── PRESETS ──────────────────────────────────────────────────────
let presetsMode='manage'; // 'manage' | 'pick'
let editingPreset=null; // preset being edited (or null = new)

function openPresets(mode='manage'){
  presetsMode=mode;
  closeMenu();
  document.getElementById('presetsSheetTitle').textContent=mode==='pick'?'Вибрати пресет':'Пресети';
  renderPresetList();
  document.getElementById('presetsSheet').classList.add('open');
}
function closePresetsSheet(e){
  if(!e||e.target===document.getElementById('presetsSheet'))
    document.getElementById('presetsSheet').classList.remove('open');
}

function renderPresetList(){
  const list=document.getElementById('presetList');
  list.innerHTML='';
  if(!presets.length){
    list.innerHTML='<div style="color:var(--text3);font-size:14px;padding:16px 0;text-align:center">Немає пресетів. Натисни «＋ Новий»</div>';
    return;
  }
  presets.forEach(p=>{
    const tot=p.tasks.reduce((s,t)=>s+t.mins,0);
    const dots=p.tasks.slice(0,6).map(t=>`<div style="width:8px;height:8px;border-radius:50%;background:${cHex(t.colorId)};flex-shrink:0"></div>`).join('');

    const item=document.createElement('div');item.className='preset-item';
    item.style.cssText='display:flex;align-items:center;gap:10px;background:var(--surface2);border-radius:var(--r-sm);padding:14px 16px;margin-bottom:8px;cursor:pointer';

    const info=document.createElement('div');info.style.flex='1';
    info.innerHTML=`<div class="preset-name">${p.name}</div><div style="display:flex;gap:4px;align-items:center;margin-top:5px">${dots}<span class="preset-meta" style="margin-left:4px">${p.tasks.length} задач · ${fmtM(tot)}</span></div>`;

    const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;flex-shrink:0';

    if(presetsMode==='manage'){
      const editBtn=document.createElement('button');
      editBtn.style.cssText='width:40px;height:40px;border-radius:10px;border:none;background:var(--surface2);color:var(--text2);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0';
      editBtn.textContent='✏️';
      editBtn.addEventListener('click',e=>{e.stopPropagation();openPresetEdit(p)});

      const delBtn=document.createElement('button');
      delBtn.style.cssText='width:40px;height:40px;border-radius:10px;border:none;background:#FFE5E5;color:#D63031;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0';
      delBtn.textContent='✕';
      delBtn.addEventListener('click',e=>{e.stopPropagation();deletePresetWithUndo(p)});

      btns.append(editBtn,delBtn);
      // in manage mode tapping info area also opens edit
      info.style.cursor='pointer';
      info.addEventListener('click',()=>openPresetEdit(p));
    } else {
      // pick mode — tap = add to tasks
      item.addEventListener('click',()=>{
        p.tasks.forEach(pt=>tasks.push({id:uid(),name:pt.name,mins:pt.mins,colorId:pt.colorId}));
        save();renderTaskList();closePresetsSheet();showToast(`Додано: ${p.name}`);
      });
    }

    item.append(info,btns);
    list.appendChild(item);
  });

  // save current as preset (manage mode)
  if(presetsMode==='manage'&&tasks.length){
    const saveBtn=document.createElement('button');
    saveBtn.style.cssText='width:100%;padding:14px;border:1.5px dashed var(--border);border-radius:var(--r-sm);background:transparent;font-size:14px;font-weight:600;color:var(--text3);cursor:pointer;font-family:var(--font);margin-top:4px';
    saveBtn.textContent='＋ Зберегти поточні задачі як пресет';
    saveBtn.addEventListener('click',()=>openPresetEdit(null));
    list.appendChild(saveBtn);
  }
}

function startNewPreset(){ openPresetEdit(null); }
let presetEditTasks=[];

function openPresetEdit(p){
  editingPreset=p;
  // new preset: start with one empty task; existing: copy its tasks
  presetEditTasks=p?JSON.parse(JSON.stringify(p.tasks)):[{id:uid(),name:'',mins:15,colorId:defaultColorId}];
  document.getElementById('presetEditName').value=p?p.name:'';
  renderPresetEditList();
  document.getElementById('presetEditSheet').classList.add('open');
}
function closePresetEdit(e){
  if(!e||e.target===document.getElementById('presetEditSheet'))
    document.getElementById('presetEditSheet').classList.remove('open');
}

function renderPresetEditList(){
  const list=document.getElementById('presetEditTaskList');
  list.innerHTML='';
  presetEditTasks.forEach((t,i)=>{
    const row=document.createElement('div');row.className='preset-edit-row';

    const dot=document.createElement('div');dot.className='preset-edit-dot';
    dot.style.background=cHex(t.colorId);
    dot.addEventListener('click',()=>openColorSheet('preset_'+t.id));

    const inp=document.createElement('input');inp.className='preset-edit-inp';
    inp.placeholder='Задача...';inp.value=t.name;
    inp.addEventListener('input',e=>{t.name=e.target.value});

    const dur=makeDurWrap(t,'mins',null);
    // compact dur for preset editor
    dur.querySelectorAll&&setTimeout(()=>{
      dur.querySelectorAll('.dur-btn').forEach(b=>{b.style.width='32px';b.style.height='36px';b.style.fontSize='18px'});
      const dv=dur.querySelector('.dur-val');if(dv){dv.style.width='40px';dv.style.height='36px';dv.style.fontSize='13px';}
    },0);

    const del=document.createElement('button');
    del.style.cssText='width:32px;height:32px;border-radius:8px;border:none;background:#FFE5E5;color:#D63031;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--font)';
    del.textContent='✕';
    del.addEventListener('click',()=>{
      if(presetEditTasks.length<=1){showToast('Має бути хоча б одна задача');return}
      presetEditTasks.splice(i,1);renderPresetEditList();
    });

    row.append(dot,inp,dur,del);
    list.appendChild(row);
  });
}

function addPresetTask(){
  presetEditTasks.push({id:uid(),name:'',mins:15,colorId:defaultColorId});
  renderPresetEditList();
  setTimeout(()=>{
    const inps=document.querySelectorAll('.preset-edit-inp');
    if(inps.length) inps[inps.length-1].focus();
  },20);
}

function savePresetEdit(){
  const name=document.getElementById('presetEditName').value.trim();
  if(!name){document.getElementById('presetEditName').focus();return}
  if(editingPreset){
    editingPreset.name=name;
    editingPreset.tasks=JSON.parse(JSON.stringify(presetEditTasks));
  } else {
    presets.push({id:uid(),name,tasks:JSON.parse(JSON.stringify(presetEditTasks))});
  }
  save();
  document.getElementById('presetEditSheet').classList.remove('open');
  renderPresetList();
  showToast(editingPreset?'Пресет оновлено':'Пресет збережено');
}

// ── BUILD TIMELINE ───────────────────────────────────────────────
function buildTimeline(){
  if(planMode==='deadline')dlName=document.getElementById('dlName').value.trim()||'Подія';
  else startAt=nowMin()+(startImmediately?1:5);
  save();
  if(!tasks.length){showToast('Спочатку додай задачі');return}
  const seen=[];tasks.forEach(t=>{if(!seen.includes(t.colorId))seen.push(t.colorId)});
  tlOrder=seen;tlCollapsed={};tlSelected=null;save();
  switchTab('tl',document.querySelector('[data-tab="tl"]'));
}

// ── RENDER TIMELINE ──────────────────────────────────────────────
function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes()}
// distance forward from a to b on a 24h wraparound clock (0..1439)
function fwdDiff(a,b){return ((b-a)%1440+1440)%1440}

function renderEmptyTimeline(message='Додай задачі, щоб побудувати таймлайн'){
  document.getElementById('tlStart').textContent='—';
  document.getElementById('tlEndTime').textContent='—';
  document.getElementById('tlEndName').textContent='';
  document.getElementById('tlStartLabel').textContent='Таймлайн';
  document.getElementById('tlEndLabel').textContent='';
  const banner=document.getElementById('tlNowBanner');
  banner.innerHTML='';banner.classList.remove('show','waiting','done');
  const container=document.getElementById('tlGroups');
  container.innerHTML=`<div class="tl-empty">${escH(message)}</div>`;
  requestAnimationFrame(()=>container.querySelector('.tl-empty')?.classList.add('show'));
}

function renderTimeline(){
  const dlM=t2m(dlTime);
  const total=tasks.reduce((s,t)=>s+t.mins,0);
  if(!tasks.length){renderEmptyTimeline();return}
  const nowM=nowMin();
  const startM=planMode==='start'?(startAt??nowM+5):dlM-total;
  const endM=planMode==='start'?startM+total:dlM;
  const endName=planMode==='start'?'Завершення задач':dlName;

  document.getElementById('tlStart').textContent=m2t(startM);
  document.getElementById('tlStartLabel').textContent=planMode==='start'?`Старт через ${startImmediately?1:5} хв`:'Починати о';
  document.getElementById('tlEndLabel').textContent=planMode==='start'?'Завершиш о':'Дедлайн';
  document.getElementById('tlEndTime').textContent=m2t(endM);
  document.getElementById('tlEndName').textContent=endName;

  // group tasks by colorId, in tlOrder
  const groups=tlOrder.map(cid=>({
    colorId:cid,
    hex:cHex(cid),
    tasks:tasks.filter(t=>t.colorId===cid),
  })).filter(g=>g.tasks.length);

  const totalForPx=total||1;
  // smaller blocks: ~2px per minute, min 64px per group
  const PX=Math.min(3.5,Math.max(1.8,180/Math.max(totalForPx,30)));
  const container=document.getElementById('tlGroups');
  container.innerHTML='';

  // figure out which task (if any) is happening right now, walking the full sequence
  let activeTaskId=null;
  {
    let walk=startM;
    for(const cid of tlOrder){
      const gtasks=tasks.filter(t=>t.colorId===cid);
      for(const t of gtasks){
        const tStart=walk,tEnd=walk+t.mins;
        if(total>0&&fwdDiff(startM,nowM)>=fwdDiff(startM,tStart)&&fwdDiff(startM,nowM)<fwdDiff(startM,tEnd)){
          activeTaskId=t.id;
        }
        walk+=t.mins;
      }
    }
  }

  // status banner: before start / in progress / done
  const banner=document.getElementById('tlNowBanner');
  if(banner){
    banner.classList.remove('show','waiting','done');
    if(total>0){
      const elapsed=fwdDiff(startM,nowM);
      if(elapsed<0||nowM===startM){
        // shouldn't happen due to wraparound, kept for safety
      }
      if(fwdDiff(startM,nowM)<total){
        if(activeTaskId){
          const at=tasks.find(t=>t.id===activeTaskId);
          banner.innerHTML=`<span class="tl-now-dot"></span>Зараз: ${escH(at?.name)||'Задача'}`;
          banner.classList.add('show');
        }
      } else {
        // either before start (haven't reached startM yet today) or already past deadline
        const toStart=fwdDiff(nowM,startM);
        const sinceEnd=fwdDiff(endM,nowM);
        if(toStart<=720){
          banner.innerHTML=`<span class="tl-now-dot"></span>До початку: ${fmtM(toStart)}`;
          banner.classList.add('show','waiting');
        } else if(sinceEnd<=720){
          banner.innerHTML=`<span class="tl-now-dot"></span>${planMode==='start'?'Усі задачі завершені':'Час вийшов'}`;
          banner.classList.add('show','done');
        }
      }
    }
  }

  let cur=startM;
  groups.forEach(g=>{
    const gTot=g.tasks.reduce((s,t)=>s+t.mins,0);
    const gStart=cur;
    const colorName=COLORS.find(c=>c.id===g.colorId)?.name||'';

    const grpEl=document.createElement('div');grpEl.className='tl-group';

    const isCol=tlCollapsed[g.colorId];

    // calc each task's start time
    let taskCur=gStart;
    const subList=g.tasks.map((t,idx)=>{
      const tStart=taskCur;
      taskCur+=t.mins;
      const nextIsNow=g.tasks[idx+1]&&g.tasks[idx+1].id===activeTaskId;
      return `<div class="tl-task-row${t.id===activeTaskId?' tl-now':''}${nextIsNow?' before-now':''}">
        <span class="tl-task-start">${m2t(tStart)}</span>
        <span class="tl-task-name">${escH(t.name)||'Задача'}</span>
        <span class="tl-task-dur">${fmtM(t.mins)}</span>
      </div>`;
    }).join('');

    const tasksMaxH=Math.max(600,Math.round(gTot*2.4)); // generous cap so a normal task list never gets clipped when expanded; only extreme cases scroll
    const blk=document.createElement('div');
    blk.className='tl-block'+(isCol?' collapsed':'')+(tlSelected===g.colorId?' sel':'');
    blk.dataset.cid=g.colorId;
    blk.style.background=g.hex;
    blk.innerHTML=`<div class="tl-inner">
      <div class="tl-top">
        <div>
          <div class="tl-title-row">
            <div class="tl-time">${m2t(gStart)}</div>
            <input class="tl-name-inp" data-cid="${g.colorId}" value="${escH(groupNames[g.colorId]||'')}" placeholder="${colorName}" maxlength="24">
          </div>
          <div class="tl-dur-label">${fmtM(gTot)}</div>
        </div>
        <div class="tl-actions">
          <button class="tl-act tl-drag">⠿</button>
          <button class="tl-act tl-del">✕</button>
        </div>
      </div>
      <div class="tl-tasks-wrap"><div class="tl-tasks-inner" style="max-height:${tasksMaxH}px"><div class="tl-tasks">${subList}</div></div></div>
      <div class="tl-summary"><div class="tl-summary-inner"><div class="tl-summary-text">${g.tasks.length} ${taskWord(g.tasks.length)} · ${fmtM(gTot)}</div></div></div>
      <div class="tl-foot">
        <button class="tl-toggle" aria-label="${isCol?'Розгорнути блок':'Згорнути блок'}">${isCol?'⤢':'згорнути'}</button>
      </div>
    </div>`;

    const nameInp=blk.querySelector('.tl-name-inp');
    nameInp.addEventListener('click',e=>e.stopPropagation());
    nameInp.addEventListener('mousedown',e=>e.stopPropagation());
    nameInp.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
    nameInp.addEventListener('change',()=>{
      const v=nameInp.value.trim();
      if(v)groupNames[g.colorId]=v;else delete groupNames[g.colorId];
      save();
    });
    nameInp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nameInp.blur()}});

    // long press select
    let lpt=null;
    const ss=()=>{lpt=setTimeout(()=>{tlSelected=tlSelected===g.colorId?null:g.colorId;renderTimeline();if(navigator.vibrate)navigator.vibrate(25)},420)};
    const cs=()=>clearTimeout(lpt);
    blk.addEventListener('touchstart',ss,{passive:true});blk.addEventListener('touchend',cs);blk.addEventListener('touchmove',cs,{passive:true});
    blk.addEventListener('mousedown',ss);blk.addEventListener('mouseup',cs);
    blk.addEventListener('click',()=>{if(tlSelected===g.colorId){tlSelected=null;renderTimeline()}});

    const tog=blk.querySelector('.tl-toggle');
    const wrapEl0=blk.querySelector('.tl-tasks-wrap');
    const innerEl0=blk.querySelector('.tl-tasks-inner');
    const checkClip=()=>{
      if(innerEl0&&wrapEl0){
        wrapEl0.classList.toggle('clipped',innerEl0.scrollHeight>innerEl0.clientHeight+1);
      }
    };
    // make the open/close speed scale with content height so tall blocks don't feel rushed
    const setToggleSpeed=()=>{
      if(!wrapEl0)return;
      const contentH=blk.querySelector('.tl-tasks')?.scrollHeight||0;
      const dur=Math.min(640,Math.max(280,contentH*0.9));
      wrapEl0.style.transitionDuration=dur+'ms';
    };
    setToggleSpeed();
    if(tog)tog.addEventListener('click',e=>{
      e.stopPropagation();
      const willCollapse=!blk.classList.contains('collapsed');
      tlCollapsed[g.colorId]=willCollapse;
      save();
      setToggleSpeed();
      blk.classList.toggle('collapsed',willCollapse);
      tog.textContent=willCollapse?'⤢':'згорнути';
      tog.setAttribute('aria-label',willCollapse?'Розгорнути блок':'Згорнути блок');
      if(!willCollapse)setTimeout(checkClip,parseFloat(wrapEl0?.style.transitionDuration)||340);
    });
    blk.addEventListener('click',()=>{
      if(blk.classList.contains('collapsed')&&tlSelected!==g.colorId){
        tlCollapsed[g.colorId]=false;
        save();
        setToggleSpeed();
        blk.classList.remove('collapsed');
        if(tog){tog.textContent='згорнути';tog.setAttribute('aria-label','Згорнути блок')}
        setTimeout(checkClip,parseFloat(wrapEl0?.style.transitionDuration)||340);
      }
    });

    blk.querySelector('.tl-del').addEventListener('click',e=>{
      e.stopPropagation();
      tasks=tasks.filter(t=>t.colorId!==g.colorId);
      tlOrder=tlOrder.filter(c=>c!==g.colorId);
      tlSelected=null;save();renderTimeline();
    });

    // drag
    const dragBtn=blk.querySelector('.tl-drag');
    let tdTarget=null, tlGhostEl=null;
    dragBtn.addEventListener('touchstart',e=>{
      if(tlSelected!==g.colorId)return;
      e.preventDefault();
      tlDragSrc=g.colorId;blk.classList.add('drag-src');
      tlGhostEl=document.createElement('div');
      tlGhostEl.style.cssText=`position:fixed;z-index:999;background:var(--text);color:var(--bg);padding:10px 18px;border-radius:12px;font-size:14px;font-weight:700;pointer-events:none;opacity:.9;transform:scale(1.05);box-shadow:0 8px 24px rgba(0,0,0,.25)`;
      tlGhostEl.textContent=groupNames[g.colorId]||colorName;
      document.body.appendChild(tlGhostEl);
      const touch=e.touches[0];
      tlGhostEl.style.left=(touch.clientX-40)+'px';
      tlGhostEl.style.top=(touch.clientY-20)+'px';
    },{passive:false});
    dragBtn.addEventListener('touchmove',e=>{
      if(!tlDragSrc)return;
      e.preventDefault();
      const touch=e.touches[0];
      if(tlGhostEl){
        tlGhostEl.style.left=(touch.clientX-40)+'px';
        tlGhostEl.style.top=(touch.clientY-20)+'px';
      }
      const els=document.elementsFromPoint(touch.clientX,touch.clientY);
      const target=els.find(el=>el.classList.contains('tl-block')&&el!==blk);
      document.querySelectorAll('.tl-block').forEach(b=>b.classList.remove('drag-over'));
      tdTarget=target?target.dataset.cid:null;
      if(target)target.classList.add('drag-over');
    },{passive:false});
    dragBtn.addEventListener('touchend',()=>{
      blk.classList.remove('drag-src');
      document.querySelectorAll('.tl-block').forEach(b=>b.classList.remove('drag-over'));
      if(tlGhostEl){tlGhostEl.remove();tlGhostEl=null;}
      if(tlDragSrc&&tdTarget&&tlDragSrc!==tdTarget){
        const si=tlOrder.indexOf(tlDragSrc),ti=tlOrder.indexOf(tdTarget);
        if(si>-1&&ti>-1){tlOrder.splice(si,1);tlOrder.splice(ti,0,tlDragSrc)}
        save();renderTimeline();
      }
      tlDragSrc=null;tdTarget=null;
    });
    dragBtn.addEventListener('mousedown',()=>{if(tlSelected===g.colorId)blk.draggable=true});
    blk.addEventListener('dragstart',e=>{tlDragSrc=g.colorId;blk.classList.add('drag-src');e.dataTransfer.effectAllowed='move'});
    blk.addEventListener('dragend',()=>{blk.draggable=false;blk.classList.remove('drag-src');tlDragSrc=null;document.querySelectorAll('.tl-block').forEach(b=>b.classList.remove('drag-over'))});
    blk.addEventListener('dragover',e=>{e.preventDefault();blk.classList.add('drag-over')});
    blk.addEventListener('dragleave',()=>blk.classList.remove('drag-over'));
    blk.addEventListener('drop',e=>{
      e.preventDefault();blk.classList.remove('drag-over');
      if(tlDragSrc&&tlDragSrc!==g.colorId){
        const si=tlOrder.indexOf(tlDragSrc),ti=tlOrder.indexOf(g.colorId);
        if(si>-1&&ti>-1){tlOrder.splice(si,1);tlOrder.splice(ti,0,tlDragSrc)}
        save();renderTimeline();
      }
    });

    grpEl.appendChild(blk);container.appendChild(grpEl);

    if(!isCol){
      const tasksEl=blk.querySelector('.tl-tasks');
      const wrapEl=blk.querySelector('.tl-tasks-wrap');
      if(tasksEl&&wrapEl&&tasksEl.scrollHeight>tasksEl.clientHeight+1){
        wrapEl.classList.add('clipped');
      }
    }

    cur+=gTot;
  });

  const cap=document.createElement('div');cap.className='tl-cap';
  const capLabel=planMode==='start'?'Завершення':'Дедлайн';
  cap.innerHTML=`<div><div class="tl-cap-lbl">${capLabel}</div><div class="tl-cap-name">${escH(endName)}</div></div><div class="tl-cap-time">${m2t(endM)}</div>`;
  container.appendChild(cap);
}

// ── UTILS ────────────────────────────────────────────────────────
function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function showUndoToast(msg){
  hideUndoToast();
  document.getElementById('undoMsg').textContent=msg;
  document.getElementById('undoToast').classList.add('show');
  const ring=document.getElementById('undoRing');
  ring.classList.remove('animating');
  ring.style.strokeDashoffset='0';
  void ring.getBoundingClientRect();
  ring.classList.add('animating');
  ring.style.strokeDashoffset='88';
}
function hideUndoToast(){
  document.getElementById('undoToast').classList.remove('show');
  const ring=document.getElementById('undoRing');
  ring.classList.remove('animating');
  ring.style.strokeDashoffset='0';
}

document.getElementById('dlName').addEventListener('input',e=>{dlName=e.target.value;save()});

// ── CUSTOM TIME PICKER ────────────────────────────────────────────
function updateDlTimeDisplay(){
  document.getElementById('dlTimeDisplay').textContent=dlTime;
}

function openTimePicker(){
  const [h,m]=dlTime.split(':').map(Number);
  buildDrum('tpHours', 0, 23, h);
  // minutes: 0,5,10,...55
  buildDrumMins(m);
  // prefill manual inputs
  document.getElementById('tpHInp').value=String(h).padStart(2,'0');
  document.getElementById('tpMInp').value=String(Math.round(m/5)*5%60).toString().padStart(2,'0');
  setupManualInputs();
  document.getElementById('timePickerSheet').classList.add('open');
}

function buildDrum(id, min, max, selected){
  const drum=document.getElementById(id);
  drum.innerHTML='';
  for(let i=min;i<=max;i++){
    const item=document.createElement('div');
    item.className='tp-item';
    item.textContent=String(i).padStart(2,'0');
    item.dataset.val=i;
    drum.appendChild(item);
  }
  requestAnimationFrame(()=>{
    drum.scrollTop=(selected-min)*44;
    updateDrumHighlight(drum);
  });
  drum.addEventListener('scroll',()=>{
    updateDrumHighlight(drum);
    syncManualFromDrums();
  },{passive:true});
}

function buildDrumMins(selectedMin){
  const drum=document.getElementById('tpMins');
  drum.innerHTML='';
  const steps=[0,5,10,15,20,25,30,35,40,45,50,55];
  steps.forEach(v=>{
    const item=document.createElement('div');
    item.className='tp-item';
    item.textContent=String(v).padStart(2,'0');
    item.dataset.val=v;
    drum.appendChild(item);
  });
  // find closest step
  const closest=steps.reduce((a,b)=>Math.abs(b-selectedMin)<Math.abs(a-selectedMin)?b:a,0);
  const idx=steps.indexOf(closest);
  requestAnimationFrame(()=>{
    drum.scrollTop=idx*44;
    updateDrumHighlight(drum);
  });
  drum.addEventListener('scroll',()=>{
    updateDrumHighlight(drum);
    syncManualFromDrums();
  },{passive:true});
}

function updateDrumHighlight(drum){
  const center=drum.scrollTop+drum.clientHeight/2;
  drum.querySelectorAll('.tp-item').forEach(item=>{
    const itemCenter=item.offsetTop+22;
    const dist=Math.abs(center-itemCenter);
    if(dist<22){
      item.style.color='var(--text)';item.style.fontSize='26px';item.style.fontWeight='700';
    } else if(dist<66){
      item.style.color='var(--text2)';item.style.fontSize='22px';item.style.fontWeight='600';
    } else {
      item.style.color='var(--text3)';item.style.fontSize='18px';item.style.fontWeight='500';
    }
  });
}

function getSelectedVal(drumId){
  const drum=document.getElementById(drumId);
  const idx=Math.round(drum.scrollTop/44);
  const items=drum.querySelectorAll('.tp-item');
  const item=items[Math.min(idx,items.length-1)];
  return item?parseInt(item.dataset.val):0;
}

function scrollDrumTo(drumId, val){
  const drum=document.getElementById(drumId);
  const items=[...drum.querySelectorAll('.tp-item')];
  const idx=items.findIndex(it=>parseInt(it.dataset.val)===val);
  if(idx>-1){
    drum.scrollTop=idx*44; // instant, no smooth
    updateDrumHighlight(drum);
  }
}

function syncManualFromDrums(){
  const h=getSelectedVal('tpHours');
  const m=getSelectedVal('tpMins');
  document.getElementById('tpHInp').value=String(h).padStart(2,'0');
  document.getElementById('tpMInp').value=String(m).padStart(2,'0');
}

function setupManualInputs(){
  const hInp=document.getElementById('tpHInp');
  const mInp=document.getElementById('tpMInp');

  // hours: 2 digits then auto-jump to minutes
  hInp.oninput=()=>{
    let v=hInp.value.replace(/\D/g,'');
    if(v.length>2) v=v.slice(-2);
    hInp.value=v;
    if(v.length===2){
      const n=Math.min(23,Math.max(0,parseInt(v)||0));
      hInp.value=String(n).padStart(2,'0');
      // instant scroll, no smooth — avoids animation conflict
      const drum=document.getElementById('tpHours');
      drum.scrollTop=n*44;
      updateDrumHighlight(drum);
      mInp.focus();mInp.select();
    }
    // don't scroll on first digit — wait for second
  };
  hInp.onfocus=()=>hInp.select();

  // minutes: snap to nearest 5
  mInp.oninput=()=>{
    let v=mInp.value.replace(/\D/g,'');
    if(v.length>2) v=v.slice(-2);
    mInp.value=v;
    if(v.length===2){
      let n=parseInt(v)||0;
      n=Math.min(59,Math.max(0,n));
      const snap=Math.round(n/5)*5%60;
      scrollDrumTo('tpMins',snap);
    }
  };
  mInp.onblur=()=>{
    let n=parseInt(mInp.value)||0;
    n=Math.min(59,Math.max(0,n));
    const snap=Math.round(n/5)*5%60;
    mInp.value=String(snap).padStart(2,'0');
    scrollDrumTo('tpMins',snap);
  };
  mInp.onfocus=()=>mInp.select();
}

function confirmTimePicker(){
  const h=getSelectedVal('tpHours');
  const m=getSelectedVal('tpMins');
  dlTime=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  save();updateDlTimeDisplay();
  document.getElementById('timePickerSheet').classList.remove('open');
}

function closeTimePicker(e){
  if(!e||e.target===document.getElementById('timePickerSheet'))
    document.getElementById('timePickerSheet').classList.remove('open');
}

function undoLastDeletion(){
  if(presetUndoStack) undoPresetDelete();
  else undoDelete();
}

let presetUndoStack=null, presetUndoTimer=null;

function deletePresetWithUndo(p){
  presetUndoStack=JSON.parse(JSON.stringify(p));
  presets=presets.filter(x=>x.id!==p.id);
  save();renderPresetList();
  clearTimeout(presetUndoTimer);
  showUndoToast(`Пресет «${p.name}» видалено`);
  presetUndoTimer=setTimeout(()=>{presetUndoStack=null;hideUndoToast()},3200);
}

function undoPresetDelete(){
  if(!presetUndoStack) return;
  clearTimeout(presetUndoTimer);
  presets.push(presetUndoStack);
  presetUndoStack=null;
  save();renderPresetList();
  hideUndoToast();
  showToast('Пресет відновлено');
}
function exportJSON(){
  const data={
    version:1,
    event:{ name:dlName, time:dlTime },
    tasks:JSON.parse(JSON.stringify(tasks)),
    presets:JSON.parse(JSON.stringify(presets)),
  };
  const json=JSON.stringify(data,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safeName=(dlName||'подія').replace(/[^\wа-яёіїє\s]/gi,'').trim().replace(/\s+/g,'_')||'подія';
  a.href=url;
  a.download=`${safeName}_${dlTime.replace(':','-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeMenu();
}

// ── EXPORT / IMPORT ──────────────────────────────────────────────
function triggerImport(){
  closeMenu();
  document.getElementById('importFileInput').value='';
  document.getElementById('importFileInput').click();
}

function importJSON(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!data.version||!data.tasks){showToast('Невірний формат файлу');return}
      pushHistory();
      if(data.event){
        dlName=data.event.name||'';
        dlTime=data.event.time||'18:00';
      }
      tasks=data.tasks.map(t=>({
        id:uid(),
        name:t.name||'',
        mins:t.mins||15,
        colorId:t.colorId||'c5',
      }));
      if(data.presets&&Array.isArray(data.presets)){
        // merge: add presets that don't exist by name
        data.presets.forEach(p=>{
          if(!presets.find(x=>x.name===p.name)){
            presets.push({id:uid(),name:p.name,tasks:(p.tasks||[]).map(t=>({id:uid(),name:t.name||'',mins:t.mins||15,colorId:t.colorId||'c5'}))});
          }
        });
      }
      save();renderTaskList();updateDlTimeDisplay();
      document.getElementById('dlName').value=dlName;
      updateUndoBtn();
      showToast(`Імпортовано: ${dlName||'подія'}`);
    }catch(err){
      showToast('Помилка читання файлу');
    }
  };
  reader.readAsText(file);
}
load();applyTheme();applyNumbering();applyPlanMode();renderTaskList();
updateDlTimeDisplay();
document.getElementById('dlName').value=dlName;
setInterval(updateStartModePreview,10000);
if(tasks.length&&tlOrder.length){
  switchTab('tl',document.querySelector('[data-tab="tl"]'));
}

// Block browser text selection everywhere except inputs
document.addEventListener('selectstart', e=>{
  if(!e.target.matches('input,textarea')) e.preventDefault();
});
document.addEventListener('contextmenu', e=>{
  if(!e.target.matches('input,textarea')) e.preventDefault();
});
