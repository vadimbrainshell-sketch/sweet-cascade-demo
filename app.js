const loadingStarted=performance.now();
const loadingRotation=(Math.random()-.5)*16;
const loadingPositions=[];
document.querySelectorAll('.loading-icons i').forEach((icon,index)=>{
 const hover=document.createElement('span');hover.className='loading-hover';
 hover.append(icon.querySelector('img'));icon.append(hover);
 let position={x:0,y:0},bestGap=-1;
 for(let attempt=0;attempt<64;attempt++){
  const angle=(-90+index*40+loadingRotation+(Math.random()-.5)*20)*Math.PI/180;
  const radius=26+Math.random()*14;
  const candidate={x:Math.max(-37,Math.min(37,Math.cos(angle)*radius)),y:Math.sin(angle)*radius};
  const gap=Math.min(...loadingPositions.map(p=>Math.hypot(candidate.x-p.x,candidate.y-p.y)));
  if(gap>bestGap){position=candidate;bestGap=gap;}
  if(gap>=20)break;
 }
 loadingPositions.push(position);
 for(const [name,value] of Object.entries({
  '--x':`calc(var(--loader-unit) * ${position.x.toFixed(2)})`,
  '--y':`calc(var(--loader-unit) * ${position.y.toFixed(2)})`,
  '--bob':`calc(var(--loader-unit) * ${(2.6+Math.random()*.9).toFixed(2)})`,
  '--sway':`calc(var(--loader-unit) * ${(.7+Math.random()*.6).toFixed(2)})`,
  '--turn':`${(-18+Math.random()*36).toFixed(1)}deg`,
  '--delay':`${(.5+Math.random()*.22).toFixed(2)}s`,
  '--float':`${(3.1+Math.random()*1).toFixed(2)}s`,
  '--spin-time':`${(26+Math.random()*14).toFixed(2)}s`,
  '--spin-direction':Math.random()<.5?'normal':'reverse',
  '--phase':`${(-Math.random()*4).toFixed(2)}s`,
 }))icon.style.setProperty(name,value);
});

const loadingCover=document.getElementById('loading');
if(loadingCover){
 const progress=document.createElement('div');progress.className='loading-progress';
 progress.innerHTML='<div class="loading-progress-track" role="progressbar" aria-label="Loading game" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="loading-progress-fill"></span></div><div class="loading-progress-caption"><span>LOADING</span></div>';
 loadingCover.append(progress);
}
function setLoadingProgress(percent){
 const cover=document.getElementById('loading'),bar=cover?.querySelector('[role="progressbar"]');if(!bar)return;
 const value=Math.max(Number(bar.getAttribute('aria-valuenow'))||0,Math.min(100,Math.floor(percent)));
 bar.setAttribute('aria-valuenow',String(value));bar.style.setProperty('--progress',value+'%');
}
const loadingTemplate=document.getElementById('loading')?.cloneNode(true);
function showSessionLoading(){
 if(document.getElementById('loading')||!loadingTemplate)return ()=>{};
 const cover=loadingTemplate.cloneNode(true),game=document.getElementById('game-layout');
 cover.setAttribute('aria-label','Restoring game session');cover.classList.add('loading-restoring');cover.querySelector('[role="progressbar"]')?.removeAttribute('aria-valuenow');document.body.appendChild(cover);
 if(game)game.inert=true;
 return ()=>{cover.remove();if(game)game.inert=false;};
}

let finishLoadingPromise;
function finishLoading(ready=()=>true){return finishLoadingPromise??=finishLoadingOnce(ready);}
async function finishLoadingOnce(ready){
 const cover=document.getElementById('loading');if(!cover)return;
 await Promise.all([...cover.querySelectorAll('.loading-icons img')].map(img=>img.decode().catch(()=>{})));
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,2200-(performance.now()-loadingStarted))));
 if(!ready())throw Error('Session lost during loader');
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const flights=Array.from(cover.querySelectorAll('.loading-icons i')).map((icon,index)=>{
   icon.querySelectorAll('.loading-hover,img').forEach(part=>part.style.animationPlayState='paused');
   // Start at the actual current pose, including when loading finishes during the intro.
   const pose=getComputedStyle(icon).transform;
   icon.style.animation='none';icon.style.transform=pose;
   return icon.animate([{transform:pose},{transform:'translate(0,0) scale(.2) rotate(0deg)'}],{
    duration:480,delay:(index%3)*20,easing:'cubic-bezier(.55,0,.65,1)',fill:'forwards',
   }).finished;
  });
  await Promise.all(flights);
  await cover.querySelector('.loading-brand').animate([
   {transform:'scale(1)',offset:0},
   {transform:'scale(1.16)',offset:.3},
   {transform:'scale(.98)',offset:.62},
   {transform:'scale(1.025)',offset:.82},
   {transform:'scale(1)',offset:1},
  ],{duration:540,easing:'ease-in-out',fill:'forwards'}).finished;
  await cover.animate([{opacity:1},{opacity:0}],{duration:180,fill:'forwards'}).finished;
 }
 if(!ready())throw Error('Session lost during loader');
 cover.remove();
}

function showLoadingError(message){
 const cover=document.getElementById('loading');if(cover){cover.getAnimations().forEach(a=>a.cancel());cover.style.opacity='1';}
 const text=document.getElementById('loadingText');if(!text)return;
 text.hidden=false;text.textContent=message||'Unable to load the game.';
 const button=document.createElement('button');button.className='loading-reload';button.textContent='Reload';
 button.addEventListener('click',()=>location.reload());text.append(document.createElement('br'),button);
}

// Percent of declared readiness tasks, not a fabricated byte-download estimate.
function createLoadingProgress(taskIds,render){
 const expected=new Set(taskIds),done=new Set();
 render(0);
 return id=>{if(!expected.has(id)||done.has(id))return;done.add(id);render(Math.floor(done.size/expected.size*100));};
}

const preparationDone=createLoadingProgress(['scene','font','audio','renderer','boosters','ice','candies','pink','donut','session','frame'],setLoadingProgress);
let startupFailure=false;
async function prepareTask(id,work){
 let timer;
 try{const result=await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Preparation timed out: '+id)),45000);})]);if(!startupFailure)preparationDone(id);return result;}
 catch(error){failStartup('Unable to prepare '+id+'. Please reload.');throw error;}
 finally{clearTimeout(timer);}
}
function failStartup(message){if(startupFailure)return;startupFailure=true;document.querySelector('#game').inert=true;showLoadingError(message);}
async function revealGame(ready){
 if(startupFailure||!ready())throw Error('Game session is not ready.');
 await finishLoading(()=>!startupFailure&&ready());
 if(startupFailure||!ready())throw Error('Connection lost during loading.');
 document.querySelector('#game').inert=false;
}

const N=7;
const clone=x=>structuredClone(x);
const adjacent=(a,b)=>Math.abs(a%7-b%7)+Math.abs(Math.floor(a/7)-Math.floor(b/7))===1;
function neighbours(i){return [i-7,i+7,i%7?i-1:-1,i%7<6?i+1:-1].filter(j=>j>=0&&j<49);}
function matches(board){
 const runs=[];
 for(let axis=0;axis<2;axis++)for(let line=0;line<7;line++){
  let group=[],color=-1;
  const flush=()=>{if(group.length>=3)runs.push({cells:[...group],axis,color});};
  for(let k=0;k<=7;k++){let i=axis? k*7+line:line*7+k,c=k<7?board[i]:null;
   let col=c&&c.kind!=='ice'&&c.kind!=='bomb'&&c.kind!=='rocket'?c.color:-1;
   if(col!==color||col===-1){flush();group=[];color=col;}if(col!==-1)group.push(i);
  }
 }
 return runs;
}
function matchArea(board,runs){
 const out=new Set();
 for(const r of runs){r.cells.forEach(i=>out.add(i));if(r.cells.length===4){for(let k=0;k<7;k++)out.add(r.axis?k*7+r.cells[0]%7:Math.floor(r.cells[0]/7)*7+k);}if(r.cells.length>=5)board.forEach((c,i)=>{if(c?.color===r.color&&c.kind!=='ice')out.add(i);});}
 for(const a of runs)for(const b of runs)if(a.axis!==b.axis&&a.color===b.color&&a.cells.some(i=>b.cells.includes(i))){let cells=[...a.cells,...b.cells],xs=cells.map(i=>i%7),ys=cells.map(i=>Math.floor(i/7));for(let y=Math.min(...ys);y<=Math.max(...ys);y++)for(let x=Math.min(...xs);x<=Math.max(...xs);x++)out.add(y*7+x);}
 return out;
}
function validSwap(board,a,b){if(!adjacent(a,b)||!board[a]||!board[b]||board[a].kind==='ice'||board[b].kind==='ice')return false;if([board[a],board[b]].some(c=>['bomb','rocket'].includes(c.kind)))return true;const copy=[...board];[copy[a],copy[b]]=[copy[b],copy[a]];return matches(copy).some(r=>r.cells.includes(a)||r.cells.includes(b));}
function moves(board){const out=[];for(let i=0;i<49;i++)for(const j of [i+1,i+7])if(j<49&&validSwap(board,i,j))out.push([i,j]);return out;}
const payout=(bet,chains,mult)=>Math.max(0,Math.round(bet*5*Math.max(chains*(mult||1)-1,0))/100);
class DemoRGS{
 constructor(saved){this.s=saved||{version:0,balance:10000,bet:1,mode:'base',meter:0,board:[],bonus:null,history:[],seed:192741,id:0};if(!this.s.board.length)this.s.board=this.fresh();for(const c of this.s.board)if(c.kind==='ice')c.maxHp??=c.hp;this.cache=new Map();if(!moves(this.s.board).length){this.s.board=this.reshuffle(this.s.board);this.s.version++;}}
 rng(){let x=this.s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.s.seed=x>>>0;return this.s.seed/4294967296;}
 candy(special=true){const s=this.s;const c={id:++s.id,color:Math.floor(this.rng()*6),kind:'candy'};if(special){let r=this.rng(),rich=s.mode==='enhanced';if(r<(rich?.095:.035)){c.kind=this.rng()<.5?'bomb':'rocket';c.dir=Math.floor(this.rng()*4);}else if(r<(rich?.18:.07)){c.mult=[2,3,5,10][Math.floor(this.rng()*4)];}else if(r<(rich?.20:s.mode==='luck'?.105:.085))c.magic=true;if(s.mode==='mayhem')c.mult=[2,5,10,20][Math.floor(this.rng()*4)];}return c;}
 // Presentation-only refill bias. Only newly spawned candies change; survivors persist.
 showcaseRefill(board,spawned,step){const chance=[.7,.6,.35][step]||0;if(!chance||this.rng()>=chance)return;const options=[];for(const i of spawned){if(board[i]?.kind!=='candy')continue;for(const axis of [1,7])for(let offset=-2;offset<=0;offset++){const cells=[i+offset*axis,i+(offset+1)*axis,i+(offset+2)*axis];if(cells.some(j=>j<0||j>=49)||axis===1&&cells.some(j=>Math.floor(j/7)!==Math.floor(i/7)))continue;const others=cells.filter(j=>j!==i).map(j=>board[j]);if(others.every(c=>c?.kind==='candy')&&others[0].color===others[1].color)options.push({i,color:others[0].color});}}if(options.length){const chosen=options[Math.floor(this.rng()*options.length)];board[chosen.i].color=chosen.color;}}
 fresh(){let b=[];for(let i=0;i<49;i++){let c;do{c=this.candy(false);}while((i%7>1&&b[i-1].color===c.color&&b[i-2].color===c.color)||(i>=14&&b[i-7].color===c.color&&b[i-14].color===c.color));b.push(c);}return moves(b).length?b:this.fresh();}
 snapshot(){return clone(this.s);}
 reshuffle(board){const slots=board.map((c,i)=>c.kind==='ice'?-1:i).filter(i=>i>=0),pieces=slots.map(i=>board[i]);for(let attempt=0;attempt<256;attempt++){const shuffled=[...pieces];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}const next=[...board];slots.forEach((i,k)=>next[i]=shuffled[k]);if(!matches(next).length&&moves(next).length)return next;}throw Error('Could not find a playable shuffle. Please try again.');}
 cost(){return this.s.bet*({base:1,luck:2,enhanced:50,mayhem:1000}[this.s.mode]);}
 mode(mode){if(this.s.bonus)throw Error('A bonus is already active.');this.s.mode=mode;this.s.board.forEach(c=>{delete c.mult;});if(mode==='mayhem')this.s.board.forEach(c=>{if(c.kind==='candy')c.mult=[2,5,10][Math.floor(this.rng()*3)];});if(mode==='enhanced')for(let i=0;i<3;i++){let j=Math.floor(this.rng()*49);this.s.board[j].kind=i%2?'rocket':'bomb';this.s.board[j].dir=0;}this.s.version++;return this.snapshot();}
 bonusStart(){const s=this.s;s.bonus={moves:5,chains:0,mult:0,win:0,bet:s.bet,base:clone(s.board),meter:s.meter};s.board=this.fresh();for(let i=35;i<49;i++)s.board[i]={id:++s.id,kind:'ice',hp:2,mult:[2,3,5,10][Math.floor(this.rng()*4)],color:-1};for(const c of s.board)if(c.kind==='ice')c.maxHp=c.hp;if(!moves(s.board).length)s.board=this.reshuffle(s.board);s.mode='base';}
 buy(){if(this.s.bonus)throw Error('A bonus is already active.');if(this.s.balance<this.s.bet*100)throw Error('Not enough demo credits.');this.s.balance-=this.s.bet*100;this.bonusStart();this.s.version++;return this.snapshot();}
 play(a,b,requestId=crypto.randomUUID(),version=this.s.version){
  if(this.cache.has(requestId))return clone(this.cache.get(requestId));
  const s=this.s;if(version!==s.version)throw Error('The game state has changed. Please try again.');if(!validSwap(s.board,a,b))return {accepted:false,events:[],state:this.snapshot()};
  const cost=s.bonus?0:this.cost();if(s.balance<cost)throw Error('Not enough demo credits.');s.balance-=cost;
  let chains=s.bonus?.chains||0,mult=s.bonus?.mult||0,bonus=s.bonus,roundBet=bonus?.bet||s.bet,magic=0;
  if(bonus)bonus.moves--;
  const events=[],board=s.board;[board[a],board[b]]=[board[b],board[a]];
  events.push({type:'swap',a,b,board:clone(board),moves:bonus?.moves});
  let armed=new Set([a,b].filter(i=>['bomb','rocket'].includes(board[i].kind)).map(i=>board[i].id));
  for(let step=0;step<250;step++){
   const runs=matches(board),area=matchArea(board,runs),effects=[];
   board.forEach((c,i)=>{if(!armed.has(c?.id))return;area.add(i);if(c.kind==='bomb'){effects.push({kind:'bomb',i});for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let x=i%7+dx,y=Math.floor(i/7)+dy;if(x>=0&&x<7&&y>=0&&y<7)area.add(y*7+x);}}else{let [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][c.dir];effects.push({kind:'rocket',i,dir:c.dir});let x=i%7+dx,y=Math.floor(i/7)+dy;while(x>=0&&x<7&&y>=0&&y<7){let j=y*7+x;area.add(j);if(board[j]?.kind==='ice')break;x+=dx;y+=dy;}}});
   if(!area.size)break;
   const destroy=new Set(),nextArmed=new Set(),damage=new Map();
   for(const i of area){let c=board[i];if(!c)continue;if(c.kind==='ice'){damage.set(i,(damage.get(i)||0)+1);continue;}if(['bomb','rocket'].includes(c.kind)&&!armed.has(c.id)){nextArmed.add(c.id);continue;}destroy.add(i);}
   for(const i of destroy)for(const j of neighbours(i)){let c=board[j];if(c?.kind==='ice')damage.set(j,(damage.get(j)||0)+1);if(c&&['bomb','rocket'].includes(c.kind)&&!destroy.has(j)&&!armed.has(c.id))nextArmed.add(c.id);}
   const brokenIce=[];for(const [i,d]of damage){board[i].hp-=d;if(board[i].hp<=0){mult+=board[i].mult;brokenIce.push(i);}}
   for(const i of destroy){const c=board[i];if(c.mult)mult+=c.mult;if(c.magic){magic++;if(bonus)bonus.moves++;}}
   chains+=Math.floor(destroy.size/3);
   const win=payout(roundBet,chains,mult);
   events.push({type:'destroy',step,runs,effects,cells:[...destroy],ice:brokenIce,damage:[...damage.keys()],armed:[...nextArmed],chains,mult:mult||1,win,moves:bonus?.moves,magic,board:clone(board)});
   for(const i of [...destroy,...brokenIce])board[i]=null;
   const spawned=[];for(let col=0;col<7;col++){let bottom=6;while(bottom>=0){if(board[bottom*7+col]?.kind==='ice'){bottom--;continue;}let top=bottom;while(top>0&&board[(top-1)*7+col]?.kind!=='ice')top--;const survivors=[];for(let row=bottom;row>=top;row--)if(board[row*7+col])survivors.push(board[row*7+col]);for(let row=bottom;row>=top;row--){const i=row*7+col;board[i]=survivors[bottom-row]||this.candy();if(bottom-row>=survivors.length)spawned.push(i);}bottom=top-1;}}this.showcaseRefill(board,spawned,step);
   events.push({type:'fall',board:clone(board)});armed=nextArmed;
   if(step===249)throw Error('This demo round could not be completed. Please try again.');
  }
  const win=payout(roundBet,chains,mult);
  let bonusEnded=false,bonusStarted=false;
  if(bonus){Object.assign(bonus,{chains,mult,win});if(bonus.moves===0){s.balance+=win;s.board=bonus.base;s.meter=bonus.meter;s.bonus=null;bonusEnded=true;}}
  else{s.balance+=win;s.meter+=magic;if(s.mode==='enhanced')s.board.forEach(c=>{delete c.mult;});if(s.meter>=3){s.meter-=3;this.bonusStart();bonusStarted=true;}}
  // Demo-only dead-board policy. Production RGS must supply its approved transition.
  if(!moves(s.board).length){s.board=this.reshuffle(s.board);events.push({type:'shuffle',reason:'noMoves',terminal:true,board:clone(s.board)});}
  s.balance=Math.round(s.balance*100)/100;
  s.version++;s.history.unshift({id:requestId,bet:roundBet,cost,win,chains,mult:mult||1,bonus:!!bonus,time:Date.now()});s.history=s.history.slice(0,50);
  const result={accepted:true,events,win,bonusStarted,bonusEnded,state:this.snapshot()};this.cache.set(requestId,clone(result));return result;
 }
}

/* Decode once per file, with bounded concurrency and an alternate codec. */
class GameAudioLoader {
 constructor(context,{fetchFile=(...args)=>fetch(...args),timeout=18000,concurrency=3,formats=['wav','mp3'],urlFor=(file,format)=>`assets/audio/${encodeURIComponent(file)}.${format}`,onFailure=()=>{}}={}){
  if(!Number.isInteger(concurrency)||concurrency<1||!Number.isFinite(timeout)||timeout<=0||!formats.length)throw Error('Invalid audio loader settings');
  this.concurrency=concurrency;this.formats=[...formats];this.urlFor=urlFor;
  this.context=context;this.fetchFile=fetchFile;this.timeout=timeout;this.onFailure=onFailure;
  this.cache=new Map();this.queue=[];this.running=0;this.failures=[];this.recoveries=[];
 }
 load(file){
  if(!this.cache.has(file))this.cache.set(file,this.decode(file));
  return this.cache.get(file);
 }
 pump(){
  while(this.running<this.concurrency&&this.queue.length){const job=this.queue.shift();
   if(job.signal.aborted){job.reject(Error('Audio preparation timed out'));continue;}
   this.running++;
   // Timed-out decodes still occupy a slot until the browser actually finishes.
   Promise.resolve().then(()=>this.context.decodeAudioData(job.bytes)).then(job.resolve,()=>job.reject(Error('Browser could not decode audio'))).finally(()=>{this.running--;this.pump();});
  }
 }
 async attempt(file,format){
  const controller=new AbortController();let timer;
  try{return await Promise.race([
   (async()=>{
    const response=await this.fetchFile(this.urlFor(file,format),{signal:controller.signal,cache:format==='mp3'?'reload':'default'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const type=response.headers?.get('content-type')||'';
    if(/text\/html|application\/json/i.test(type))throw Error('Server returned '+(/html/i.test(type)?'HTML':'JSON')+' instead of audio');
    const bytes=await response.arrayBuffer();if(bytes.byteLength<32)throw Error('Empty audio');
    const decoded=await new Promise((resolve,reject)=>{this.queue.push({bytes,signal:controller.signal,resolve,reject});this.pump();});
    if(!decoded||!Number.isFinite(decoded.duration)||decoded.duration<=0)throw Error('Empty decoded audio');
    return decoded;
   })(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Audio preparation timed out'));},this.timeout);})
  ]);}finally{clearTimeout(timer);}
 }
 async decode(file){
  const attempts=[];
  for(const format of this.formats){
   try{const buffer=await this.attempt(file,format);if(attempts.length)this.recoveries.push({file,attempts});return buffer;}catch(error){
    const message=String(error?.message??error);
    const safe=/^(HTTP \d{3}|Empty audio|Empty decoded audio|Browser could not decode audio|Server returned (HTML|JSON) instead of audio|Audio preparation timed out)$/.test(message)?message:'Audio download failed';
    attempts.push({format,error:safe});
   }
  }
  const failure={file,attempts};this.failures.push(failure);
  console.warn('Audio unavailable:',file,attempts);
  try{this.onFailure(failure);}catch{}
  return null;
 }
}

const AUDIO_FILES={
  "swap": {
    "wav": "public/audio/match3-rich/swap.wav",
    "mp3": "public/audio/match3-rich/swap.mp3"
  },
  "pop": {
    "wav": "public/audio/match3-reference-open/pop.wav",
    "mp3": "public/audio/match3-reference-open/pop.mp3"
  },
  "pop1": {
    "wav": "public/audio/match3-reference-open/pop1.wav",
    "mp3": "public/audio/match3-reference-open/pop1.mp3"
  },
  "pop2": {
    "wav": "public/audio/match3-reference-open/pop2.wav",
    "mp3": "public/audio/match3-reference-open/pop2.mp3"
  },
  "pop3": {
    "wav": "public/audio/match3-reference-open/pop3.wav",
    "mp3": "public/audio/match3-reference-open/pop3.mp3"
  },
  "pop4": {
    "wav": "public/audio/match3-reference-open/pop4.wav",
    "mp3": "public/audio/match3-reference-open/pop4.mp3"
  },
  "pop5": {
    "wav": "public/audio/match3-reference-open/pop5.wav",
    "mp3": "public/audio/match3-reference-open/pop5.mp3"
  },
  "land": {
    "wav": "public/audio/match3-soft/land.wav",
    "mp3": "public/audio/match3-soft/land.mp3"
  },
  "magic": {
    "wav": "public/audio/match3-selected/magic.wav",
    "mp3": "public/audio/match3-selected/magic.mp3"
  },
  "multiplier": {
    "wav": "public/audio/match3-selected/multiplier.wav",
    "mp3": "public/audio/match3-selected/multiplier.mp3"
  },
  "iceHit": {
    "wav": "public/audio/match3-selected/iceHit.wav",
    "mp3": "public/audio/match3-selected/iceHit.mp3"
  },
  "ice": {
    "wav": "public/audio/user-ice/break.wav",
    "mp3": "public/audio/user-ice/break.mp3"
  },
  "bonus": {
    "wav": "public/audio/match3-selected/bonus.wav",
    "mp3": "public/audio/match3-selected/bonus.mp3"
  },
  "transition": {
    "wav": "public/audio/match3-selected/transition.wav",
    "mp3": "public/audio/match3-selected/transition.mp3"
  },
  "win": {
    "wav": "public/audio/match3-selected/win.wav",
    "mp3": "public/audio/match3-selected/win.mp3"
  },
  "winMega": {
    "wav": "public/audio/match3-selected/winMega.wav",
    "mp3": "public/audio/match3-selected/winMega.mp3"
  },
  "winEpic": {
    "wav": "public/audio/match3-selected/winEpic.wav",
    "mp3": "public/audio/match3-selected/winEpic.mp3"
  },
  "winEnd": {
    "wav": "public/audio/match3-selected/winEnd.wav",
    "mp3": "public/audio/match3-selected/winEnd.mp3"
  },
  "music": {
    "wav": "public/audio/runtime/music.wav",
    "mp3": "public/audio/runtime/music.mp3"
  },
  "select": {
    "wav": "public/audio/match3-selected/select.wav",
    "mp3": "public/audio/match3-selected/select.mp3"
  },
  "click": {
    "wav": "public/audio/match3-selected/click.wav",
    "mp3": "public/audio/match3-selected/click.mp3"
  },
  "invalid": {
    "wav": "public/audio/match3-selected/invalid.wav",
    "mp3": "public/audio/match3-selected/invalid.mp3"
  },
  "bomb": {
    "wav": "public/audio/match3-selected/bomb.wav",
    "mp3": "public/audio/match3-selected/bomb.mp3"
  },
  "rocket": {
    "wav": "public/audio/match3-rocket-bright/rocket.wav",
    "mp3": "public/audio/match3-rocket-bright/rocket.mp3"
  },
  "rocketCharge": {
    "wav": "public/audio/match3-selected/rocketCharge.wav",
    "mp3": "public/audio/match3-selected/rocketCharge.mp3"
  },
  "donutAppear": {
    "wav": "public/audio/casual-v12/donutAppear.wav",
    "mp3": "public/audio/casual-v12/donutAppear.mp3"
  },
  "donutShot": {
    "wav": "public/audio/match3-selected/donutShot.wav",
    "mp3": "public/audio/match3-selected/donutShot.mp3"
  },
  "donutEnd": {
    "wav": "public/audio/match3-selected/donutEnd.wav",
    "mp3": "public/audio/match3-selected/donutEnd.mp3"
  },
  "boosterAppear": {
    "wav": "public/audio/match3-selected/boosterAppear.wav",
    "mp3": "public/audio/match3-selected/boosterAppear.mp3"
  },
  "shuffle": {
    "wav": "public/audio/match3-selected/shuffle.wav",
    "mp3": "public/audio/match3-selected/shuffle.mp3"
  },
  "hint": {
    "wav": "public/audio/match3-selected/hint.wav",
    "mp3": "public/audio/match3-selected/hint.mp3"
  },
  "donutSpin": {
    "wav": "public/audio/match3-selected/donutSpin.wav",
    "mp3": "public/audio/match3-selected/donutSpin.mp3"
  },
  "fuse": {
    "wav": "public/audio/match3-selected/fuse.wav",
    "mp3": "public/audio/match3-selected/fuse.mp3"
  },
  "rocketPop": {
    "wav": "public/audio/match3-gem3/rocket-pop.wav",
    "mp3": "public/audio/match3-gem3/rocket-pop.mp3"
  },
  "bombEpic": {
    "wav": "public/audio/match3-bomb-epic/bomb.wav",
    "mp3": "public/audio/match3-bomb-epic/bomb.mp3"
  },
  "pop6": {
    "wav": "public/audio/match3-reference-open/pop6.wav",
    "mp3": "public/audio/match3-reference-open/pop6.mp3"
  },
  "pop7": {
    "wav": "public/audio/match3-reference-open/pop7.wav",
    "mp3": "public/audio/match3-reference-open/pop7.mp3"
  },
  "pop8": {
    "wav": "public/audio/match3-reference-open/pop8.wav",
    "mp3": "public/audio/match3-reference-open/pop8.mp3"
  },
  "pop9": {
    "wav": "public/audio/match3-reference-open/pop9.wav",
    "mp3": "public/audio/match3-reference-open/pop9.mp3"
  },
  "pop10": {
    "wav": "public/audio/match3-reference-open/pop10.wav",
    "mp3": "public/audio/match3-reference-open/pop10.mp3"
  },
  "donutPop": {
    "wav": "public/audio/match3-gem3/rocket-pop.wav",
    "mp3": "public/audio/match3-gem3/rocket-pop.mp3"
  }
};

class MusicLoop {
 constructor(context,buffer,gain){Object.assign(this,{context,buffer,gain});this.source=null;this.offset=0;this.generation=0;this.wanted=false;}
 async setPlaying(wanted){
  this.wanted=!!wanted;const generation=++this.generation;
  if(!wanted){this.pause();return;}
  if(!this.buffer||this.source)return;
  try{await this.context.resume();}catch{return;}
  if(generation!==this.generation||!this.wanted||this.source||this.context.state!=='running')return;
  const source=this.context.createBufferSource();source.buffer=this.buffer;source.loop=true;source.connect(this.gain);
  this.source=source;this.started=this.context.currentTime;source.start(0,this.offset%this.buffer.duration);
  source.onended=()=>{if(this.source===source)this.source=null;source.disconnect();};
 }
 pause(){const source=this.source;if(!source)return;this.offset=(this.offset+this.context.currentTime-this.started)%this.buffer.duration;this.source=null;try{source.stop();}catch{}source.disconnect();}
}

// User-selected Match 3 pack cues. Music and donut appearance remain unchanged.
const CASCADE_NOTE_STEPS=Object.freeze([0,2,4,5,6,7,8,9,10,11,12]);
class Sound{
 get enabled(){return this._enabled;}
 set enabled(value){this._enabled=!!value;if(!value){this.cancelCelebration();for(const source of this.voices||[])try{source.stop();}catch{}}this.syncMusic();}
 get music(){return this._music;}
 set music(value){this._music=!!value;this.syncMusic();}
 syncMusic(){this.musicLoop?.setPlaying(this.music&&this.enabled&&this.unlocked&&!document.hidden);}
 constructor(){this.enabled=true;this.music=true;this.ctx=null;this.beat=0;this.timer=null;this.cascade=0;this.lastLand=-1;this.popVariant=-1;this.unlocked=false;document.addEventListener('visibilitychange',()=>{if(document.hidden){this.cancelCelebration();for(const v of this.voices||[])try{v.stop();}catch{}this.ctx?.suspend().catch(()=>{});}else if(this.unlocked)this.ctx?.resume().catch(()=>{});this.syncMusic();});}
 prepareContext(){if(this.ctx)return;this.ctx=new AudioContext();this.bus=this.ctx.createGain();this.bus.gain.value=.455;this.limiter=this.ctx.createDynamicsCompressor();this.limiter.threshold.value=-14;this.limiter.knee.value=12;this.limiter.ratio.value=5;this.limiter.attack.value=.003;this.limiter.release.value=.12;this.bus.connect(this.limiter).connect(this.ctx.destination);this.musicGain=this.ctx.createGain();this.musicGain.gain.value=.15;this.musicGain.connect(this.ctx.destination);}
 loadSamples(){return this.loading??=this.prepareSamples();}
 async prepareSamples(){this.samples={};this.unavailable=[];try{this.prepareContext();const loader=this.audioLoader=new GameAudioLoader(this.ctx,{urlFor:(name,format)=>AUDIO_FILES[name][format],timeout:16000,concurrency:3});await Promise.all(Object.keys(AUDIO_FILES).map(async name=>{const buffer=await loader.load(name);if(buffer)this.samples[name]=buffer;else this.unavailable.push(name);}));this.musicLoop=new MusicLoop(this.ctx,this.samples.music,this.musicGain);this.syncMusic();}catch{this.unavailable=Object.keys(AUDIO_FILES);}return {unavailable:this.unavailable};}
 sample(name,step=0){if(!this.ctx||!this.enabled||document.hidden)return false;const level=Math.min(CASCADE_NOTE_STEPS.length-1,Math.max(0,Math.floor(step))),key=name==='pop'&&level>0?'pop'+level:name;const buffer=this.samples?.[key];if(!buffer)return false;const now=this.ctx.currentTime;this.lastSample??={};const gap={land:.16,magic:.25,ice:.12,iceHit:.16,multiplier:.18,donutShot:.035,select:.1,boosterAppear:.12}[name]??0;if(now-(this.lastSample[name]??-100)<gap)return true;this.lastSample[name]=now;const src=this.ctx.createBufferSource(),gain=this.ctx.createGain();src.buffer=buffer;src.cue=key;// Candy 1 stays unchanged; the quiet reference note rises across cascade steps.
if(name==='rocketPop')src.playbackRate.value=1+Math.min(6,Math.max(0,step))*.035;
if(name==='donutShot')src.playbackRate.value=.98+(step%4)*.035;gain.gain.value=({swap:1.65,pop:1,rocketPop:.72,donutPop:.72,land:.5,magic:.65,multiplier:.8,iceHit:.65,ice:.85,bonus:.9,transition:.8,win:.9,winMega:.9,winEpic:.9,winEnd:.8,bomb:1,bombEpic:1.1,rocket:1,rocketCharge:.6,donutAppear:.75,donutShot:.55,donutEnd:.7,fuse:.6,select:.5,hint:.4}[name]??.8);src.connect(gain).connect(this.bus);this.voices??=new Set();this.voices.add(src);src.start();src.onended=()=>{this.voices.delete(src);src.disconnect();gain.disconnect();};return true;}
 cancelCelebration(){this.celebrationToken=(this.celebrationToken||0)+1;for(const src of this.voices||[])if(['win','winMega','winEpic'].includes(src.cue))try{src.stop();}catch{}}
 loop(name){
  if(!this.ctx||!this.enabled||document.hidden||!this.samples?.[name])return ()=>{};
  const src=this.ctx.createBufferSource(),gain=this.ctx.createGain(),now=this.ctx.currentTime;src.buffer=this.samples[name];src.loop=true;src.cue=name;
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.65,now+.04);src.connect(gain).connect(this.bus);this.voices??=new Set();this.voices.add(src);
  src.onended=()=>{this.voices.delete(src);src.disconnect();gain.disconnect();};src.start();let stopped=false;
  return ()=>{if(stopped)return;stopped=true;const t=this.ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.linearRampToValueAtTime(0,t+.055);try{src.stop(t+.06);}catch{}};
 }
 async celebrate(ratio=0){this.cancelCelebration();const token=this.celebrationToken;const cues=['win'];if(ratio>=25)cues.push('winMega');if(ratio>=50)cues.push('winEpic');for(const cue of cues){if(token!==this.celebrationToken||!this.enabled)return;this.play(cue);await new Promise(resolve=>setTimeout(resolve,(this.samples?.[cue]?.duration??.5)*1000));}}
 unlock(){this.unlocked=true;try{this.prepareContext();this.ctx.resume().catch(()=>{});this.syncMusic();}catch{}}
 tone(freq,duration=.12,type='sine',gain=.15,delay=0,end=null){if(!this.ctx||!this.enabled||document.hidden)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(this.bus);o.start(t);o.stop(t+duration+.02);}
 noise(duration=.2,gain=.12,high=1500){if(!this.ctx||!this.enabled||document.hidden)return;let n=this.ctx.sampleRate*duration,buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate),a=buf.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);let src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=buf;f.type='lowpass';f.frequency.value=high;g.gain.value=gain;src.connect(f).connect(g).connect(this.bus);src.start();}
 play(name,step=0){if(this.unavailable?.includes(name))return;if(this.sample(name,step))return;if(name==='iceHit')name='ice';if(name==='transition'||name==='winEnd')name='magic';if(name==='multiplier')name='click';if(name==='shuffle')name='magic';if(name==='swap'){this.tone(450,.09,'sine',.2,0,900);}if(name==='invalid'){this.tone(220,.13,'triangle',.12,0,130);}if(name==='pop'){const semitones=CASCADE_NOTE_STEPS;const pitch=2**(semitones[Math.min(semitones.length-1,Math.max(0,step))]/12),f=480*pitch;this.tone(f*1.55,.095,'sine',.31,0,f*.52);this.tone(f*.65,.14,'sine',.13,.018,f*.32);this.noise(.035,.045,2600);this.tone(660*pitch,.23,'sine',.085,.025);this.tone(990*pitch,.15,'sine',.033,.045);if(step>1)this.tone(1320*pitch,.19,'sine',.025,.075);}if(name==='land'&&this.ctx){const now=this.ctx.currentTime;if(now-this.lastLand<.025)return;this.lastLand=now;const pitch=2**(Math.min(step,10)*1.2/12)*(1+(Math.random()-.5)*.1);this.tone(310*pitch,.075,'sine',.15,0,145*pitch);this.tone(155*pitch,.105,'sine',.095,.025,225*pitch);this.tone(730*pitch,.045,'sine',.025,.008,450*pitch);this.noise(.022,.023,1200);}if(name==='ice'){this.noise(.24,.22,7000);this.tone(1900,.25,'sine',.06);}if(name==='bomb'||name==='bombEpic'){this.noise(.4,.5,800);this.tone(160,.35,'sine',.5,0,35);}if(name==='rocket'){this.noise(.3,.3,4000);this.tone(250,.25,'triangle',.1,0,1800);}if(name==='magic'||name==='win'||name==='bonus'){[0,4,7,12,16].forEach((n,i)=>this.tone(523.25*2**(n/12),.4,'sine',.12,i*.085));}if(name==='click')this.tone(700,.045,'sine',.1,0,400);}
 tick(){this.syncMusic();}
}

const palette=['#32cfff','#ff70b5','#ffe240','#76e42e','#ef2940','#cc38f5'];
function frameTexture(){const c=document.createElement('canvas');c.width=c.height=711;const g=c.getContext('2d');const rect=(x,y,w,h,r)=>{g.beginPath();g.roundRect(x,y,w,h,r);};
 const edge=711,inner=23.4;let grad=g.createLinearGradient(0,0,edge,edge);grad.addColorStop(0,'#c2efff');grad.addColorStop(.3,'#3c7cde');grad.addColorStop(.65,'#7dbeff');grad.addColorStop(1,'#d9f4ff');g.fillStyle=grad;rect(0,0,edge,edge,23);g.fill();g.save();rect(6.5,6.5,698,698,19);g.clip();g.fillStyle='#4779dd';g.fillRect(0,0,edge,edge);g.fillStyle='#83b9ff';for(let x=-edge;x<edge*2;x+=26){g.beginPath();g.moveTo(x,0);g.lineTo(x+12,0);g.lineTo(x+12-edge,edge);g.lineTo(x-edge,edge);g.fill();}g.restore();g.strokeStyle='#c9eaff';g.lineWidth=2.6;rect(5.2,5.2,700.6,700.6,20);g.stroke();g.strokeStyle='#234ca7';g.lineWidth=3.9;rect(19.4,19.4,672,672,10);g.stroke();g.fillStyle='#10182e';rect(inner,inner,664,664,8);g.fill();let shine=g.createLinearGradient(0,0,0,21);shine.addColorStop(0,'#ffffffa0');shine.addColorStop(1,'#ffffff00');g.fillStyle=shine;rect(12,4,687,18,9);g.fill();return PIXI.Texture.from(c);}
function candyTexture(type){const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.translate(80,80);let color=palette[type],p=new Path2D();
 if(type===0){p.moveTo(-26,-40);p.bezierCurveTo(20,-52,42,-20,38,10);p.bezierCurveTo(34,51,-8,51,-28,24);p.bezierCurveTo(-51,-1,-48,-28,-26,-40);}
 if(type===1){p.ellipse(0,0,39,48,-.28,0,Math.PI*2);}
 if(type===2){p.moveTo(-43,28);p.lineTo(18,-47);p.bezierCurveTo(70,-1,38,64,-43,28);}
 if(type===3){p.roundRect(-43,-41,86,82,23);}
 if(type===4){p.moveTo(0,-50);p.bezierCurveTo(20,-31,48,-9,42,20);p.bezierCurveTo(36,57,-35,57,-42,20);p.bezierCurveTo(-47,-9,-20,-31,0,-50);}
 if(type===5){for(let i=0;i<10;i++){let a=i*Math.PI/5-Math.PI/2,r=i%2?29:51;let px=Math.cos(a)*r,py=Math.sin(a)*r;if(!i)p.moveTo(px,py);else p.lineTo(px,py);}p.closePath();}
 x.shadowColor='#0009';x.shadowBlur=8;x.shadowOffsetY=7;x.fillStyle='#301236';x.fill(p);x.shadowColor='transparent';let gr=x.createLinearGradient(-20,-50,35,50);gr.addColorStop(0,'#ffffff');gr.addColorStop(.12,color);gr.addColorStop(.60,color);gr.addColorStop(1,'#65113f');x.fillStyle=gr;x.fill(p);x.lineWidth=3;x.strokeStyle=color;x.stroke(p);
 x.save();x.clip(p);let gl=x.createRadialGradient(-20,-28,0,-15,-25,66);gl.addColorStop(0,'#ffffffc9');gl.addColorStop(.32,'#ffffff4a');gl.addColorStop(.7,'#ffffff00');x.fillStyle=gl;x.fillRect(-60,-60,120,120);x.fillStyle='#ffffff77';x.beginPath();x.ellipse(-19,-28,18,7,-.55,0,Math.PI*2);x.fill();x.strokeStyle='#ffffff70';x.lineWidth=3;x.beginPath();x.ellipse(4,5,32,32,.2,.25,1.2);x.stroke();
 if(type===2){x.strokeStyle='#fffbd1';x.lineWidth=3;for(let a=-.7;a<1.8;a+=.6){x.beginPath();x.moveTo(-25,22);x.lineTo(-25+66*Math.cos(a),22-66*Math.sin(a));x.stroke();}}if(type===1){x.strokeStyle='#a64009';x.lineWidth=2;x.beginPath();x.ellipse(1,-4,22,30,-.25,0,Math.PI*2);x.stroke();}x.restore();return PIXI.Texture.from(c);}
function specialTexture(kind,dir=0){const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.translate(80,80);x.shadowColor='#00173888';x.shadowBlur=8;x.shadowOffsetY=6;
 if(kind==='bomb'){let g=x.createRadialGradient(-14,-18,2,0,0,49);g.addColorStop(0,'#f28dbd');g.addColorStop(.35,'#aa225b');g.addColorStop(1,'#41102f');x.fillStyle=g;x.beginPath();x.arc(0,6,42,0,Math.PI*2);x.fill();x.strokeStyle='#ffd37b';x.lineWidth=7;x.beginPath();x.moveTo(3,-35);x.quadraticCurveTo(6,-60,25,-48);x.stroke();x.fillStyle='#fff6a7';x.beginPath();x.arc(28,-49,7,0,Math.PI*2);x.fill();x.strokeStyle='#ffd4e4';x.lineWidth=4;x.beginPath();x.arc(-4,2,28,3.5,4.6);x.stroke();}
 else if(kind==='rocket'){x.rotate(dir*Math.PI/2);let g=x.createLinearGradient(-25,0,25,0);g.addColorStop(0,'#b82874');g.addColorStop(.45,'#fff1ed');g.addColorStop(1,'#f32e86');x.fillStyle=g;x.beginPath();x.moveTo(0,-54);x.quadraticCurveTo(-31,-30,-24,31);x.lineTo(24,31);x.quadraticCurveTo(31,-30,0,-54);x.fill();x.fillStyle='#ffd951';x.beginPath();x.moveTo(-22,12);x.lineTo(-40,44);x.lineTo(-15,35);x.lineTo(0,58);x.lineTo(15,35);x.lineTo(40,44);x.lineTo(22,12);x.fill();x.fillStyle='#4bd5ff';x.beginPath();x.arc(0,-10,12,0,Math.PI*2);x.fill();}
 else{let g=x.createLinearGradient(-50,-50,50,50);g.addColorStop(0,'#e5ffff');g.addColorStop(.35,'#79ddff');g.addColorStop(1,'#3173cc');x.fillStyle=g;x.beginPath();x.roundRect(-48,-48,96,96,15);x.fill();x.strokeStyle='#eaffff';x.lineWidth=4;x.stroke();x.strokeStyle='#ffffff66';x.lineWidth=8;x.beginPath();x.moveTo(-35,23);x.lineTo(18,-35);x.stroke();}
 return PIXI.Texture.from(c);}

// Painted liquid curtains and independent downward highlight loops.
// Coordinates measured on the clean architecture's 1717 x 916 source.
function createFountain({cx=1582,architecture=null,scale=1,offset=0}={}){
 const TAU=Math.PI*2;
 const sheets=[
  {name:'crown',cx,y:431,bottom:529,top:26,base:91,lip:-31,phase:.25},
  {name:'upper',cx,y:528,bottom:636,top:106,base:119,rimRise:17,phase:1.3},
  {name:'lower',cx,y:631,bottom:736,top:146,base:163,rimRise:19.5,bottomBow:24,phase:2.7}
 ];
 function outline(g,s){
  const {cx:x,y,bottom:b,top:a,base:w,lip}=s;
  g.beginPath();g.moveTo(x-a,y);
  // Measured outer rim: low at the sides, a shallow elliptical rise at the back.
  if(s.rimRise)g.ellipse(x,y,a,s.rimRise,0,Math.PI,TAU);
  else if(lip<0)g.bezierCurveTo(x-a*.6,y+lip,x+a*.6,y+lip,x+a,y);
  else g.bezierCurveTo(x-a*.73,y+lip,x+a*.73,y+lip,x+a,y);
  const shoulder=s.name==='crown'?y-12:y+4;
  g.bezierCurveTo(x+w*.98,shoulder,x+w,b-26,x+w,b);
  // The lower sheet meets the pool along its perspective curve: higher at
  // the sides, deeper in the centre, without covering the front stone rim.
  g.quadraticCurveTo(x,b+(s.bottomBow??5),x-w,b);
  g.bezierCurveTo(x-w,b-26,x-w*.98,shoulder,x-a,y);g.closePath();
 }
 // Static colour/alpha artwork is cached separately from the travelling marks.
 for(const s of sheets){
  s.left=Math.floor(s.cx-s.base-3);s.topY=Math.floor(s.y-(s.rimRise??Math.max(0,-s.lip))-3);
  const c=document.createElement('canvas');c.width=Math.ceil(s.base*2+6);c.height=Math.ceil(s.bottom-s.topY+(s.bottomBow??5)/2+4);
  const g=c.getContext('2d'),pixels=g.createImageData(c.width,c.height);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   const v=Math.max(0,Math.min(1,(y+s.topY-s.y)/(s.bottom-s.y))),width=s.top+(s.base-s.top)*Math.sqrt(v);
   const edge=Math.min(1,Math.abs(x+s.left-s.cx)/width),dense=Math.pow(edge,2.1);
   const edgeU=Math.min(1,Math.abs(x+s.left-s.cx)/s.base);
   const contactY=s.bottom+(s.bottomBow??5)/2*(1-edgeU*edgeU);
   const contactFade=Math.max(0,Math.min(1,(contactY-(y+s.topY))/2));
   const a=((.52+.34*Math.pow(v,.85))*(.89+.11*dense)+.08*dense)*contactFade;
   const i=(y*c.width+x)*4;pixels.data[i]=230-17*dense;pixels.data[i+1]=135-26*dense;pixels.data[i+2]=173-20*dense;pixels.data[i+3]=Math.round(a*255);
  }
  g.putImageData(pixels,0,0);g.globalCompositeOperation='destination-in';g.translate(-s.left,-s.topY);outline(g,s);g.fillStyle='white';g.fill();s.art=c;
 }
 // Each ribbon keeps its shape while descending and expanding. Bake that
 // silhouette once; only position, width and opacity change during playback.
 for(const s of sheets){
  const noise=n=>{const v=Math.sin(n*127.1+s.phase*19.3)*43758.5453;return v-Math.floor(v)};
  s.marks=Array.from({length:12},(_,seed)=>{
   const row=Math.floor(seed/3),lane=seed%3;
   const laneX=(lane-1)*.66+(noise(seed+31)-.5)*.12,lenRatio=.12+Math.pow(noise(seed+17),1.2)*.77;
   const thickness=5.5+noise(seed+42)*4;
   const edge=t=>-12*(laneX+(t-.5)*lenRatio)**2+1.1*Math.sin(t*Math.PI+seed*.7);
   const left=edge(0),right=edge(1),control=2*edge(.5)-(left+right)/2;
   const top=Math.floor(Math.min(left,right,control)-thickness-2),bottom=Math.ceil(Math.max(left,right,control)+2);
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=(bottom-top)*2;
   const g=canvas.getContext('2d');g.scale(2,2);g.translate(0,-top);
   const fade=g.createLinearGradient(0,0,128,0),a=.44+noise(seed+8)*.16;
   fade.addColorStop(0,'rgba(255,237,243,0)');fade.addColorStop(.19,'rgba(255,237,243,'+a+')');fade.addColorStop(.78,'rgba(255,237,243,'+a+')');fade.addColorStop(1,'rgba(255,237,243,0)');
   g.strokeStyle=fade;g.lineCap='round';
   const stroke=offset=>{g.beginPath();g.moveTo(0,left-offset);g.quadraticCurveTo(64,control-offset,128,right-offset);g.stroke();};
   for(let band=0;band<12;band++){const strength=(band+.5)/12;g.globalAlpha=Math.pow(strength,1.8)*.7;g.lineWidth=thickness/12+.3;stroke(thickness*(1-strength));}
   g.globalAlpha=1;g.lineWidth=1.05;stroke(0);
   return {canvas,top,height:bottom-top,laneX,lenRatio,phase:row/4+s.phase*.17+noise(seed)*.055};
  });
 }
 function marks(g,s,time){
  g.save();outline(g,s);g.clip();
  for(const m of s.marks){const phase=(time*.16+m.phase)%1,v=phase*1.34-.18;
   const width=s.top+(s.base-s.top)*Math.sqrt(Math.max(0,v)),len=width*m.lenRatio;
   g.globalAlpha=Math.sin(phase*Math.PI);
   g.drawImage(m.canvas,s.cx+m.laneX*width-len/2,s.y+v*(s.bottom-s.y)+m.top,len,m.height);
  }g.restore();
 }
 // Clip surface waves to the actual pink pixels, excluding stone rims and stems.
 const pools=[{cx:cx-6,y:528,rx:91,ry:12},{cx:cx-8,y:634,rx:132,ry:16},{cx:cx-16,y:739,rx:174,ry:16}];
 let architecturePixels;
 if(architecture){const c=document.createElement('canvas');c.width=1717;c.height=916;const g=c.getContext('2d');g.drawImage(architecture,-offset/scale,0,architecture.width/scale,architecture.height/scale);architecturePixels=g.getImageData(0,0,c.width,c.height).data;}
 for(const p of pools){p.x=Math.floor(p.cx-p.rx-2);p.top=p.y-p.ry-2;const c=document.createElement('canvas');c.width=p.rx*2+4;c.height=p.ry*2+4;const g=c.getContext('2d');
  if(architecturePixels){const pixels=g.createImageData(c.width,c.height);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const ax=p.x+x,ay=p.top+y;if(ax<0||ax>=1717||ay<0||ay>=916)continue;const i=(ay*1717+ax)*4,r=architecturePixels[i],green=architecturePixels[i+1],b=architecturePixels[i+2],j=(y*c.width+x)*4;pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=255;pixels.data[j+3]=architecturePixels[i+3]*Math.max(0,Math.min(1,(r-green-25)/15,(b-green-7)/10));}g.putImageData(pixels,0,0);}
  else{g.fillStyle='white';g.beginPath();g.ellipse(c.width/2,c.height/2,p.rx,p.ry,0,0,TAU);g.fill();}
  p.mask=c;p.layer=document.createElement('canvas');p.layer.width=c.width;p.layer.height=c.height;
 }
 function surfaceWaves(g,time){for(let index=0;index<pools.length;index++){const p=pools[index],q=p.layer.getContext('2d');q.clearRect(0,0,p.layer.width,p.layer.height);q.globalCompositeOperation='source-over';q.lineWidth=1.15;
  for(let ring=0;ring<3;ring++){const u=(time*.19+ring/3+index*.21)%1;q.strokeStyle=`rgba(255,226,236,${.52*Math.sin(u*Math.PI)})`;q.beginPath();q.ellipse(p.cx-p.x,p.y-p.top,(.24+.76*u)*p.rx,2+u*(p.ry-1),0,0,TAU);q.stroke();}
  q.globalCompositeOperation='destination-in';q.drawImage(p.mask,0,0);q.globalCompositeOperation='source-over';g.drawImage(p.layer,p.x,p.top);
 }}
 // Foam floats on the receiving pool, not on the curtain's cutout edge.
 // Use the same measured liquid mask as the ripples to occlude stone stems/rims.
 function foam(g,s,p,time){
  const q=p.layer.getContext('2d');q.clearRect(0,0,p.layer.width,p.layer.height);
  q.globalCompositeOperation='source-over';q.save();q.translate(-p.x,-p.top);
  const bow=(s.bottomBow??5)/2,noise=n=>{const v=Math.sin(n*91.17+s.phase*23.4)*17293.73;return v-Math.floor(v)};
  const count=Math.ceil(s.base*2/19);
  for(let i=0;i<count;i++){
   const u=-.94+(i+.5+(noise(i)-.5)*.55)/count*1.88;
   const phase=time*(.8+noise(i+11)*.25)+i*2.31+s.phase;
   const swell=.78+.22*Math.sin(phase);
   const x=s.cx+u*s.base+Math.sin(phase*.73)*1.2;
   const y=s.bottom+bow*(1-u*u)-4.4+(noise(i+21)-.5)*2.1+Math.cos(phase)*.45;
   const rx=(5+noise(i+7)*6.5)*swell,ry=1.4+noise(i+17)*1.1;
   // Diffuse pink contact patch; varied gaps keep it from becoming an outline.
   q.save();q.translate(x,y);q.scale(rx*1.5,ry*1.8);
   const haze=q.createRadialGradient(0,0,0,0,0,1);
   haze.addColorStop(0,`rgba(255,215,230,${.24*swell})`);haze.addColorStop(1,'rgba(255,215,230,0)');
   q.fillStyle=haze;q.fillRect(-1,-1,2,2);q.restore();
   // Flattened, overlapping lobes read as foam in the pool's perspective.
   for(let j=0;j<3;j++){
    const ox=(j-1)*rx*.48,oy=(noise(i*3+j+40)-.5)*ry;
    const a=(.28+noise(i+j+60)*.16)*swell;
    const tint=q.createLinearGradient(0,y-ry*1.8,0,y+ry*1.8);
    tint.addColorStop(0,'rgba(255,242,239,0)');tint.addColorStop(.38,`rgba(255,236,239,${a})`);tint.addColorStop(1,'rgba(255,207,225,0)');
    q.fillStyle=tint;q.beginPath();q.ellipse(x+ox,y+oy,rx*(.42+noise(i+j+80)*.15),ry*(.65+noise(i+j+90)*.4),0,0,TAU);q.fill();
   }
   if(i%3===0){const life=(time*.18+noise(i+31))%1,a=Math.sin(life*Math.PI)*.24;
    q.strokeStyle=`rgba(255,241,239,${a})`;q.lineWidth=.65;q.beginPath();q.ellipse(x-rx*.35,y-ry*.7,1+life*.8,.65+life*.3,0,0,TAU);q.stroke();
   }
  }
  q.restore();q.globalCompositeOperation='destination-in';q.drawImage(p.mask,0,0);q.globalCompositeOperation='source-over';g.drawImage(p.layer,p.x,p.top);
 }
 function paint(g,time,only){
  for(const [index,s] of sheets.entries()){
   if(!only||only==='body')g.drawImage(s.art,s.left,s.topY);
   if(!only||only==='highlights')marks(g,s,time);
   if(!only||only==='impacts'){
    // Broad subdued contact arcs, where the curtain lands on the next bowl.
    const p=pools[index],q=p.layer.getContext('2d');q.clearRect(0,0,p.layer.width,p.layer.height);q.globalCompositeOperation='source-over';q.save();q.translate(-p.x,-p.top);
    outline(q,s);q.clip();q.beginPath();q.ellipse(s.cx,s.bottom,s.base+9,s.bottomBow?13:6,0,0,TAU);q.clip();
    for(let i=0;i<2;i++){const u=(time*.53+s.phase+i*.5)%1;q.strokeStyle=`rgba(255,213,224,${Math.sin(u*Math.PI)*.18})`;q.lineWidth=1;q.beginPath();q.ellipse(s.cx,s.bottom,s.base-5+u*12,(s.bottomBow?9:1.4)+u*3,0,0,TAU);q.stroke();}q.restore();
    q.globalCompositeOperation='destination-in';q.drawImage(p.mask,0,0);q.globalCompositeOperation='source-over';g.drawImage(p.layer,p.x,p.top);
   }
  }
  if(!only||only==='surface')surfaceWaves(g,time);
  if(!only||only==='foam')sheets.forEach((s,i)=>foam(g,s,pools[i],time));
 }
 return {paint,sheets:sheets.map(({name,cx,y,bottom,top,base})=>({name,cx,y,bottom,top,base}))};
}

// Separate painted sprites, bent in horizontal strips. Roots stay fixed.
function createGardenPlants(atlas){
 const rects=[[28,298,680,320],[756,192,662,430],[1470,277,680,340]];
 const sprites=rects.map(([x,y,w,h])=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(atlas,x,y,w,h,0,0,w,h);return c});
 const back=[
  {sprite:0,x:35,y:560,w:330,h:180,p:0},{sprite:1,x:60,y:540,w:185,h:175,p:1.2},
  {sprite:2,x:350,y:703,w:260,h:163,p:2.3},
  ...[600,835,1080,1320].map((x,i)=>({sprite:i%3===1?2:0,x,y:870,w:330,h:165,p:i*.8+1})),
  {sprite:0,x:1530,y:858,w:360,h:205,p:2.4},{sprite:1,x:1590,y:850,w:220,h:205,p:4.1},
  {sprite:2,x:1750,y:860,w:270,h:150,p:5}
 ];
 const front=[{sprite:2,x:32,y:850,w:180,h:100,p:1.1},{sprite:0,x:475,y:850,w:160,h:90,p:3.3},{sprite:2,x:1488,y:850,w:230,h:125,p:2.1}];
 // Bend states are shared by all plants of the same artwork. At the largest
 // on-screen height their quantization is below .26 design pixels.
 const bends=sprites.map(im=>Array.from({length:41},(_,index)=>{
  const w=360,h=Math.ceil(im.height/im.width*w),pad=8;
  const c=document.createElement('canvas');c.width=w+pad*2;c.height=h;
  const ctx=c.getContext('2d'),sway=(index-20)/20*h*.024,bands=48;
  for(let row=0;row<bands;row++){const v=row/bands;ctx.drawImage(im,0,v*im.height,im.width,im.height/bands,pad+sway*(1-v)*(1-v),v*h,w,h/bands+.3);}
  return {canvas:c,w,h,pad};
 }));
 function paint(g,items,time){for(const q of items){const im=sprites[q.sprite],x=q.x-q.w/2,y=q.y-q.h;
  // Only the leafy top moves: max ~4-5 design pixels, period 5.6-7 seconds.
  const phase=Math.sin(time*Math.PI*2/(5.6+q.p*.28)+q.p),a=bends[q.sprite][Math.round(phase*20)+20];
  g.drawImage(a.canvas,x-a.pad*q.w/a.w,y,q.w*(a.w+a.pad*2)/a.w,q.h);
 }}
 return{paintBack:(g,t)=>paint(g,back,t),paintFront:(g,t)=>paint(g,front,t),count:back.length+front.length};
}

// Royal garden v14. Fixed 1920 x 1080 pixels; the stage only scales uniformly down.
// Sky/clouds sit behind real alpha architecture, never a guessed skyline mask.
async function mountKingdom(element) {
  const W=1920,H=1080,S=1080/916,OX=(1920-1717*S)/2,TAU=Math.PI*2;
  const urls=['public/kingdom/royal-v6/architecture.png','public/kingdom/skyline.png','public/kingdom/royal-v6/plants.png'];
  const [background,skyline,plantAtlas]=await Promise.all(urls.map(url=>new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`Background asset: ${url}`));img.src=url;
  })));
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.className='kingdom-scene';canvas.setAttribute('aria-hidden','true');element.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const cloud=surface(360,150),brush=cloud.getContext('2d');
  brush.filter='blur(3px)';
  const tint=brush.createLinearGradient(0,20,0,135);tint.addColorStop(0,'#fffaf5');tint.addColorStop(1,'#e3eaf4');brush.fillStyle=tint;
  brush.beginPath();brush.ellipse(174,100,143,27,0,0,TAU);brush.ellipse(95,85,49,34,0,0,TAU);brush.ellipse(151,61,54,43,0,0,TAU);brush.ellipse(209,80,55,39,0,0,TAU);brush.ellipse(264,98,48,23,0,0,TAU);brush.fill();
  const plants=createGardenPlants(plantAtlas);
  const flagTexture=surface(320,136),ft=flagTexture.getContext('2d');
  let time=0,last=0,frame=0,previousPaint=-Infinity,disposed=false,manual=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const cloudSpecs=[
    {x:10,y:15,s:1.00,v:10,a:.72},{x:740,y:45,s:.9,v:9,a:.65},{x:1510,y:5,s:1.15,v:8,a:.65},
    {x:340,y:160,s:.8,v:10,a:.64},{x:1220,y:220,s:1.05,v:9,a:.62},
    {x:30,y:325,s:.85,v:10,a:.60},{x:810,y:390,s:.7,v:11,a:.56},{x:1560,y:410,s:.9,v:9,a:.58},
    {x:420,y:530,s:.9,v:8,a:.52},{x:1380,y:590,s:.75,v:10,a:.50},{x:80,y:660,s:.7,v:9,a:.46}
  ];
  const flags=[{x:196,y:65,w:145,h:55,phase:0},{x:624,y:316,w:90,h:37,phase:2.3},{x:864,y:196,w:110,h:43,phase:4.1},{x:1101,y:316,w:88,h:35,phase:1.3}];
  function paintSky(g){const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#65bfea');sky.addColorStop(.65,'#99d9f5');sky.addColorStop(1,'#c3eafb');g.fillStyle=sky;g.fillRect(0,0,W,H);}
  function paintClouds(g){for(const c of cloudSpecs){const x=((c.x+time*c.v+450)%2820)-450;g.globalAlpha=c.a;g.drawImage(cloud,x,c.y,360*c.s,150*c.s);}g.globalAlpha=1;}
  function paintFlagShape(g,{x,y,w,h},p){
    ft.clearRect(0,0,320,136);ft.globalCompositeOperation='source-over';ft.fillStyle='#451553';ft.fillRect(0,0,320,136);
    ft.globalAlpha=1;ft.drawImage(skyline,16,42,146,55);ft.globalAlpha=1;
    const shade=ft.createLinearGradient(0,0,320,0);
    for(let j=0;j<=32;j++){const u=j/32,s=-Math.sin(p-u*6.2)*(1-Math.exp(-u*7));shade.addColorStop(u,s>0?`rgba(255,243,234,${s*.13})`:`rgba(73,46,90,${-s*.10})`);}
    ft.fillStyle=shade;ft.fillRect(0,0,320,136);
    const edge=(u,bottom)=>{const e=1-Math.exp(-u*7),a=p-u*6.2;return [x+w*u,y+Math.sin(a)*h*.12*e+h*(bottom?1-u*.5:u*.5)*(1+Math.cos(a)*.045*e)];};
    g.save();g.beginPath();g.moveTo(...edge(0,false));for(let i=1;i<=64;i++)g.lineTo(...edge(i/64,false));for(let i=63;i>=0;i--)g.lineTo(...edge(i/64,true));g.closePath();g.clip();
    for(let i=0;i<32;i++){const u=i/32,e=1-Math.exp(-u*7),a=p-u*6.2;g.drawImage(flagTexture,u*320,0,11,136,x+w*u,y+Math.sin(a)*h*.12*e,w/32+1,h*(1+Math.cos(a)*.045*e));}g.restore();
  }
  // The same loop/artwork drives every flag. Store it at the largest displayed
  // size; smaller flags reuse the frames and retain their individual phase.
  const flagFrames=Array.from({length:128},(_,i)=>{const c=surface(160,80);paintFlagShape(c.getContext('2d'),{x:0,y:10,w:145,h:55},i*TAU/128);return c;});
  function paintFlags(g){g.save();g.translate(OX,0);g.scale(S,S);for(const f of flags){const phase=((time*TAU/7.6+f.phase)%TAU+TAU)%TAU;g.drawImage(flagFrames[Math.round(phase/TAU*128)%128],f.x,f.y-f.h*10/55,f.w*160/145,f.h*80/55);}g.restore();}
  const fountain=createFountain({cx:1628,architecture:background,scale:S,offset:OX});
  function paintGlaze(g){g.save();g.translate(OX,0);g.scale(S,S);fountain.paint(g,time);g.restore();}
  const painters={sky:paintSky,clouds:paintClouds,flags:paintFlags,plantsBack:g=>plants.paintBack(g,time),architecture:g=>g.drawImage(background,0,0,W,H),plantsFront:g=>plants.paintFront(g,time),glaze:paintGlaze};
  function paintScene(g,only){for(const [name,paint]of Object.entries(painters))if(!only||name===only)paint(g);}
  function draw(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);paintScene(ctx);}
  function tick(now){frame=0;if(disposed||manual||document.hidden||reduced.matches)return;if(last)time+=Math.min((now-last)/1000,.05);last=now;if(now-previousPaint>=1000/30){draw();previousPaint=now;}frame=requestAnimationFrame(tick);}
  function resume(){cancelAnimationFrame(frame);frame=0;last=0;previousPaint=-Infinity;if(!disposed&&!document.hidden){draw();if(!manual&&!reduced.matches)frame=requestAnimationFrame(tick);}}
  document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);

  resume();element.dataset.kingdomReady='true';element.dataset.kingdomVersion='royal-v15-cached';
  if(new URLSearchParams(location.search).has('qa'))window.kingdomQA={
    renderAt(seconds){manual=true;cancelAnimationFrame(frame);frame=0;time=seconds;draw();},
    resume(){manual=false;resume();},
    exportLayer(name,seconds=time){const old=time;time=seconds;const out=surface(W,H);paintScene(out.getContext('2d'),name);time=old;return out.toDataURL('image/png');},
    get state(){return {time,running:!!frame,reduced:reduced.matches,layers:Object.keys(painters),width:W,height:H,sheets:fountain.sheets,plants:plants.count};},background,canvas
  };
  return ()=>{disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);canvas.remove();};
}





function rgsNumber(value,field,{integer=false,min=0}={}){
 if(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))value=Number(value.trim());
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||(integer&&!Number.isSafeInteger(value)))throw Error('Invalid '+field+'.');return value;
}
function readFreeRounds(raw,stake,previous=null,decimals=2){
 if(raw==null)return null;
 const counter=rgsNumber(raw.counter,'free rounds counter',{integer:true}),quantity=rgsNumber(raw.quantity,'free rounds quantity',{integer:true,min:1});
 if(previous&&(quantity!==previous.quantity||counter<previous.counter))throw Error('Free rounds progress is inconsistent.');
 const retained=stake==null&&previous&&quantity===previous.quantity&&counter>=previous.counter;
 const bet=retained?previous.bet:rgsNumber(stake,'free rounds stake',{min:Number.MIN_VALUE});
 let knownWin=previous?previous.knownWin:0,completeTotal=previous?previous.completeTotal:counter===0;
 // Startup total already includes all settled rounds before restore. Read it
 // once, then accumulate only newly accepted round results.
 if(!previous&&Object.hasOwn(raw,'total_win')){
  try{const amount=rgsNumber(raw.total_win,'free rounds restored total'),factor=10**decimals;
   if(!Number.isInteger(decimals)||decimals<0||decimals>8||!Number.isSafeInteger(Math.round(amount*factor)))throw Error('Invalid restored total precision.');
   knownWin=amount;completeTotal=true;
  }catch{knownWin=null;completeTotal=false;}
 }
 return {counter,quantity,remaining:Math.max(0,quantity-counter),bet,knownWin,completeTotal,retainedStake:!!retained};
}
function settleFreeRounds(previous,raw,stake,win,decimals=2){
 if(!previous&&!raw)return {active:null,completed:null};
 const award=raw?readFreeRounds(raw,stake,previous):{...previous,counter:previous.quantity,remaining:0};
 const precision=Number.isInteger(decimals)&&decimals>=0&&decimals<=8?decimals:2,factor=10**precision;
 const sum=Math.round(award.knownWin*factor)+Math.round(win*factor);
 award.knownWin=award.knownWin!==null&&Number.isSafeInteger(sum)?sum/factor:null;
 if(raw?.win!==undefined){try{const amount=rgsNumber(raw.win,'free rounds total');award.knownWin=Number.isSafeInteger(Math.round(amount*factor))?amount:null;award.completeTotal=award.knownWin!==null;}catch{award.knownWin=null;award.completeTotal=false;}}
 return award.remaining?{active:award,completed:null}:{active:null,completed:award};
}

// One outstanding request. Never reconnect or replay a mutation automatically.
class RgsTransport {
 constructor({url,WebSocketImpl=globalThis.WebSocket,document:doc=globalThis.document,window:win=globalThis.window,timeout=15000,onFault=()=>{}}){
  Object.assign(this,{url,WebSocketImpl,doc,win,timeout,onFault});this.pending=null;this.fault=null;this.unknownOutcome=false;this.logged=new Set();
  this.visibility=()=>{this.arm();};this.offline=()=>this.fail('Connection lost.');
  doc?.addEventListener('visibilitychange',this.visibility);win?.addEventListener('pageshow',this.visibility);win?.addEventListener('offline',this.offline);
 }
 get healthy(){return !this.fault&&this.ws?.readyState===1;}
 async connect(){
  if(this.ws)throw Error('Session already started');
  const ws=this.ws=new this.WebSocketImpl(this.url);
  await new Promise((resolve,reject)=>{
   this.opening={resolve,reject};this.openTimer=setTimeout(()=>this.fail('Connection timed out.'),this.timeout);
   ws.onopen=()=>{clearTimeout(this.openTimer);this.opening=null;resolve();};
   ws.onerror=()=>this.fail('Connection lost.');ws.onclose=()=>this.fail('Connection closed.');
   ws.onmessage=e=>this.receive(e.data);
  });
 }
 request(payload){
  if(!this.healthy)return Promise.reject(Error(this.fault||'Not connected'));
  if(this.pending)return Promise.reject(Error('A request is already pending'));
  return new Promise((resolve,reject)=>{
   const p=this.pending={payload,resolve,reject,mutation:payload.set==='bet'&&payload.action!=='reset'};
   this.arm();try{this.ws.send(JSON.stringify(payload));}catch{this.fail('Could not send request.');}
  });
 }
 arm(){
  const p=this.pending;if(!p)return;clearTimeout(p.timer);
  if(!this.doc?.hidden)p.timer=setTimeout(()=>{if(this.pending===p&&!this.doc?.hidden)this.fail('Server response timed out.');},this.timeout);
 }
 receive(data){
  if(this.fault)return;
  const p=this.pending;if(!p)return; // A duplicate cannot resolve another request without its echoed fields.
  let reply;try{reply=JSON.parse(data);}catch{this.fail('Invalid server response.');return;}
  if(reply.on?.set==='game_log')return;
  const equal=(a,b)=>a===b||(a&&b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>equal(a[k],b[k])));
  if(!equal(reply.on,p.payload)){this.fail('Server response does not match the pending request.');return;}
  clearTimeout(p.timer);this.pending=null;
  if(reply.error!==undefined&&reply.error!==false&&reply.error!==0){p.reject(Error('RGS rejected the request ('+String(reply.error)+').'));this.fail('RGS rejected the request.');return;}
  p.resolve(reply);
 }
 log(category,message){
  if(!this.healthy||this.logged.has(category)||this.logged.size>=20)return;
  this.logged.add(category);try{this.ws.send(JSON.stringify({set:'game_log',message:String(message).slice(0,240)}));}catch{}
 }
 fail(message){
  if(this.fault)return;
  const safeReasons={'Server response timed out.':'Foreground request timed out.','Connection lost.':'WebSocket error or network offline; cause unavailable.','Connection closed.':'WebSocket closed.','Server response does not match the pending request.':'Reply did not match the pending request.'};
  this.log('session-fault',(safeReasons[message]||'Game data validation failed.')+' Pending='+String(this.pending?.payload.set||'none')+'. Play blocked; no request repeated.');this.fault=message;
  clearTimeout(this.openTimer);this.opening?.reject(Error(message));this.opening=null;
  if(this.pending){const p=this.pending;this.unknownOutcome||=p.mutation;clearTimeout(p.timer);this.pending=null;p.reject(Error(message));}
  if(this.ws&&this.ws.readyState<2)this.ws.close();this.onFault(message,this.unknownOutcome);
 }
 dispose(){this.doc?.removeEventListener('visibilitychange',this.visibility);this.win?.removeEventListener('pageshow',this.visibility);this.win?.removeEventListener('offline',this.offline);this.fail('Session closed.');}
}

// Server matrices are column-major; presentation arrays are row-major.
function rgsMatrix(reels){
 if(!Array.isArray(reels)||reels.length!==7||reels.some(c=>!Array.isArray(c)||c.length!==7))throw Error('Expected a 7 × 7 server board.');
 return Array.from({length:49},(_,i)=>{const c=reels[i%7][Math.floor(i/7)];if(c===0)return null;const v=typeof c==='number'?{id:c}:c;if(!v||!Number.isInteger(v.id)||v.id<1||v.id>19)throw Error('Unknown server symbol.');return {...v};});
}
function rgsMove(a,b){
 if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=49||b>=49||Math.abs(a%7-b%7)+Math.abs(Math.floor(a/7)-Math.floor(b/7))!==1)throw Error('Choose two adjacent symbols.');
 const i=Math.min(a,b);return {column:i%7,row:Math.floor(i/7),direction:Math.abs(a-b)===1?'right':'down'};
}
function rgsHelpers(events,board){
 const h=events.findLast(e=>e.type==='helper');if(!h)throw Error('Server did not return available moves.');
 const cells=rgsMatrix(h.reels),pairs=[];
 cells.forEach((c,i)=>{if(!c)return;if(board[i]?.serverId!==c.id)throw Error('Helper does not match the final board.');for(const [key,j] of [['right',i+1],['down',i+7]])if(c[key]){rgsMove(i,j);pairs.push([i,j]);}});
 return pairs;
}
class RgsBoardAdapter {
 constructor(){this.nextId=0;}
 piece(raw,old){
  if(!raw)return null;const type=raw.id;
  if(type===18)throw Error('Server shuffle is not supported by the test client yet.');
  const c={id:old?.id??++this.nextId,serverId:type,activated:raw.activated??0};
  if(raw.multiplier!==undefined){if(!Number.isFinite(raw.multiplier)||raw.multiplier<0)throw Error('Invalid symbol multiplier.');c.mult=raw.multiplier;}
  if(type<=12)Object.assign(c,{kind:'candy',color:(type-1)%6,magic:type>6});
  else if(type<=16)Object.assign(c,{kind:'rocket',dir:type-13,color:0});
  else if(type===19){
   if(!Number.isInteger(raw.health)||raw.health<1)throw Error('Ice destruction requires a verified server collection event.');
   Object.assign(c,{kind:'ice',hp:raw.health,maxHp:Math.max(old?.maxHp??2,raw.health),color:0});
  }else Object.assign(c,{kind:'bomb',color:1});
  return c;
 }
 initial(reels){const board=rgsMatrix(reels).map(c=>this.piece(c));if(board.some(c=>!c))throw Error('Incomplete initial board.');return board;}
 replay(previous,bet,requested,{mult=1,meter=0,allowMissingHelpers=false}={}){
  if(!bet||!Array.isArray(bet.events))throw Error('Missing server result.');
  const start=rgsMatrix(bet.reels);if(start.some((c,i)=>c?.id!==previous[i]?.serverId))throw Error('Server board differs from the displayed board.');
  if(start.some((c,i)=>c?.id===19&&c.health!==previous[i]?.hp))throw Error('Server ice health changed between moves without a damage event.');
  let board=start.map((c,i)=>this.piece(c,previous[i])),events=[],step=0,win=0,accepted=false,phase='ready',fired=new Map(),damage=new Map(),magicCells=[],collected=[],regularGroups=[];
  if(JSON.stringify(board)!==JSON.stringify(previous))events.push({type:'properties',board:structuredClone(board)});
  const properties=mask=>{
   let changed=false;
   mask.forEach((c,i)=>{if(!c||c.multiplier===undefined)return;if(c.id!==board[i]?.serverId)throw Error('Multiplier refers to a different symbol.');
    if(c.id===19)throw Error('Ice multiplier collection is not verified yet.');
    const next=this.piece({...c,activated:c.activated??board[i].activated},board[i]);
    if(next.mult!==board[i].mult){board[i]=next;changed=true;}
   });
   if(changed)events.push({type:'properties',board:structuredClone(board)});
  };
  for(const e of bet.events){
   if(e.type==='helper')continue;
   if(e.type==='symbol_counter'){
    if(!accepted||phase!=='ready'||!Number.isInteger(e.count)||e.count<0||e.count>3)throw Error('Invalid magic progress event.');
    const mask=rgsMatrix(e.reels),indices=mask.flatMap((c,i)=>c?[i]:[]);
    if(!indices.length||indices.some(i=>mask[i].id<7||mask[i].id>12||mask[i].id!==board[i]?.serverId))throw Error('Magic collection does not match the board.');
    meter=e.count;magicCells.push(...indices);continue;
   }
   if(e.type==='round_multiplier'){
    if(!accepted||phase!=='ready')throw Error('Unexpected multiplier event.');
    if(e.reels){const mask=rgsMatrix(e.reels);properties(mask);mask.forEach((c,i)=>{if(c){if(!(c.multiplier>0))throw Error('Invalid collected multiplier.');collected.push(i);}});}
    if(e.accumulated!==undefined){if(!Number.isFinite(e.accumulated)||e.accumulated<0)throw Error('Invalid accumulated multiplier.');mult=e.accumulated||1;events.push({type:'progress',mult,meter,board:structuredClone(board)});}
    // csw1 also emits zero-count markers between collection and the final
    // accumulated value. They do not change the displayed multiplier.
    if(!e.reels&&e.accumulated===undefined&&e.count!==0)throw Error('Empty multiplier event.');continue;
   }
   if(e.type==='ice'){
    if(!accepted||phase!=='ready')throw Error('Unexpected ice damage event.');
    rgsMatrix(e.reels).forEach((c,i)=>{if(!c)return;const old=board[i];if(c.id!==19||old?.kind!=='ice')throw Error('Ice damage does not match the board.');
     // Updated csw1 omits health in the final hit. Confirm removal against
     // the subsequent clean snapshot; do not turn this marker into a piece.
     const next=c.health===undefined?{...old,hp:0}:this.piece(c,old),hp=damage.get(i)?.hp??old.hp;
     if(c.multiplier!==old.mult)throw Error('Invalid ice damage multiplier.');
     if(next.hp>=hp||next.mult!==old.mult)throw Error('Invalid ice damage state.');damage.set(i,next);
    });continue;
   }
   if(e.type==='bet'){
    if(accepted||phase!=='ready')throw Error('Unexpected swap sequence.');
    const mask=rgsMatrix(e.reels),pair=mask.flatMap((c,i)=>c?[i]:[]);
    if(pair.length!==2)throw Error('Invalid server swap.');const [a,b]=pair;rgsMove(a,b);
    const expected=rgsMove(...requested);if(JSON.stringify(rgsMove(a,b))!==JSON.stringify(expected))throw Error('Server swapped a different pair.');
    if(pair.some(i=>mask[i].id!==board[i]?.serverId))throw Error('Swap mask differs from board.');
    [board[a],board[b]]=[board[b],board[a]];accepted=true;events.push({type:'swap',a,b,board:structuredClone(board)});continue;
   }
   if(['regular','arrow','bomb'].includes(e.type)){
    if(!accepted||phase!=='ready')throw Error('Unexpected match sequence.');
    const mask=rgsMatrix(e.reels);
    properties(mask);
    if(e.type==='regular')regularGroups.push(mask.flatMap((c,i)=>c?[i]:[]));
    if(e.type==='arrow'||e.type==='bomb')mask.forEach((c,i)=>{
     if(c?.activated===1&&((e.type==='arrow'&&c.id>=13&&c.id<=16)||(e.type==='bomb'&&c.id===17)))fired.set(i,{kind:e.type==='arrow'?'rocket':'bomb',i,dir:c.id-13});
    });
    if(e.win!==undefined){if(!Number.isFinite(e.win)||e.win<0)throw Error('Invalid event win.');win+=e.win;}continue;
   }
   if(e.type==='tumble'&&e.action==='clean'){
    if(!accepted||phase!=='ready')throw Error('Unexpected clean sequence.');
    const clean=rgsMatrix(e.reels),cells=[],ice=[],effects=[...fired.values()];fired.clear();
    clean.forEach((c,i)=>{
     if(board[i]?.kind==='ice'){
      if(!c){if(damage.get(i)?.hp!==0)throw Error('Ice removed without a destruction event.');ice.push(i);return;}
      if(c.id!==19||c.health!==(damage.get(i)?.hp??board[i].hp)||c.multiplier!==board[i].mult)throw Error('Server ice health conflict: damage event and clean snapshot disagree.');
     }
     if(!c&&board[i])cells.push(i);else if(c&&!board[i])throw Error('Clean created a new symbol.');else if(c&&c.id!==board[i]?.serverId)throw Error('Clean replaced a surviving symbol.');
    });
    if([...magicCells,...collected].some(i=>!cells.includes(i)))throw Error('Collected symbol was not destroyed.');
    board=clean.map((c,i)=>this.piece(c,board[i]));
    events.push({type:'destroy',cells,ice,regularGroups,damage:[...damage.keys()],magicCells:[...new Set(magicCells)],collected:[...new Set(collected)],meter,armed:[],effects,step:step++,win:Math.round(win*100)/100,mult,board:structuredClone(board)});damage.clear();magicCells=[];collected=[];regularGroups=[];phase='clean';continue;
   }
   if(e.type==='tumble'&&e.action==='fall'){
    if(phase!=='clean')throw Error('Unexpected fall sequence.');
    const raw=rgsMatrix(e.reels),next=Array(49).fill(null);
    for(let x=0;x<7;x++){
     let top=0;
     for(let end=0;end<=7;end++)if(end===7||board[end*7+x]?.kind==='ice'){
      const survivors=[];for(let y=top;y<end;y++)if(board[y*7+x])survivors.push(board[y*7+x]);
      const first=end-survivors.length;
      for(let y=top;y<end;y++){const i=y*7+x,old=survivors[y-first];if(y<first){if(raw[i])throw Error('Gravity filled an empty cell.');}else{if(!raw[i]||old.serverId!==raw[i].id||raw[i].id===19)throw Error('Gravity differs from server board.');next[i]=this.piece(raw[i],old);}}
      if(end<7){const i=end*7+x,old=board[i];if(raw[i]?.id!==19||raw[i].health!==old.hp||raw[i].multiplier!==old.mult)throw Error('Server ice health conflict or displaced ice during gravity.');next[i]=this.piece(raw[i],old);}top=end+1;
     }
    }
    board=next;phase='fall';continue;
   }
   if(e.type==='tumble'&&e.action==='new'){
    if(phase!=='fall')throw Error('Unexpected refill sequence.');
    rgsMatrix(e.reels).forEach((c,i)=>{if(c){if(board[i])throw Error('Refill overwrote a survivor.');board[i]=this.piece(c);}});
    if(board.some(c=>!c))throw Error('Incomplete refill.');events.push({type:'fall',board:structuredClone(board)});phase='ready';continue;
   }
   throw Error('Unsupported RGS event: '+String(e.type)+(e.action?' / '+e.action:''));
  }
  if(phase!=='ready'||damage.size||magicCells.length||collected.length)throw Error('Incomplete cascade sequence.');
  // A complete confirmed move can be shown without next-move suggestions.
  // This never makes that board playable; the caller must stop new requests.
  const helpersMissing=!bet.events.some(e=>e.type==='helper');
  const helpers=helpersMissing&&allowMissingHelpers&&accepted?[]:rgsHelpers(bet.events,board);
  if(!accepted&&bet.events.some(e=>e.type!=='helper'))throw Error('Invalid rejected move.');
  return {accepted,board,events,helpers,meter,mult,helpersMissing};
 }
}


const RGS_TEST_CONFIG=Object.freeze({url:'wss://dev.skyline-api.net/wss',game:'csw1'});
// final_win settles the in-game ice feature, not casino-awarded free rounds.
function finalBonus(bet,previous){
 const finals=bet?.events?.filter(e=>e.type==='final_win')??[];
 if(!finals.length)return null;
 if(finals.length!==1||!previous)throw Error('Unexpected bonus settlement.');
 const event=finals[0],index=bet.events.indexOf(event);
 if(bet.events.slice(index+1).some(e=>e.type!=='helper'))throw Error('Gameplay after bonus settlement.');
 if(!Number.isFinite(event.win)||event.win<0)throw Error('Invalid final bonus win.');
 if(event.matrix&&event.reels&&JSON.stringify(event.matrix)!==JSON.stringify(event.reels))throw Error('Conflicting bonus return boards.');
 return {event,index,matrix:event.matrix??event.reels};
}
function rgsFreeSpin(value,previous=null){
 if(value===undefined||value===null){if(previous)throw Error('Bonus completion/return contract is not verified yet.');return null;}
 const {counter,limit}=value;
 if(!Number.isInteger(counter)||!Number.isInteger(limit)||counter<0||limit<1||counter>limit)throw Error('Invalid server bonus progress.');
 if(previous&&(counter<previous.counter||limit<previous.limit))throw Error('Server bonus progress moved backwards.');
 return {counter,limit,moves:limit-counter};
}
class ServerRGS {
 constructor({transport,location=globalThis.location,onFault=()=>{}}={}){
  this.remote=true;this.ready=false;this.ctx=null;this.adapter=new RgsBoardAdapter();this.location=location;this.onFault=onFault;
  this.transport=transport||new RgsTransport({...RGS_TEST_CONFIG,onFault:(...args)=>{this.ready=false;onFault(...args);}});
  this.s={board:[],balance:0,bet:0,mode:'base',bonus:null,freeRounds:null,meter:0,mult:1,history:[],version:0};this.helpers=[];this.bets=[];
 }
 get playable(){return this.ready&&this.transport.healthy&&!this.transport.pending&&!this.s.bonus?.awaitingCompletion&&!this.s.awaitingMoves;}
 snapshot(){return structuredClone(this.s);}
 cost(){return this.s.bonus||this.s.freeRounds?0:this.s.bet;}
 moves(){return this.helpers.map(p=>[...p]);}
 fail(message,unknown=false){const known=['Invalid free rounds stake.','Invalid free rounds counter.','Invalid free rounds quantity.','Free rounds progress is inconsistent.','Awarded moves need an initial board context from RGS. Reset was not sent.','Award restoration requires a confirmed settled board.','Missing initial game context or bet.','Unexpected game configuration.'];if(known.includes(message))this.transport.log?.('rgs-validation',message+' Play blocked; request not repeated.');this.ready=false;this.transport.unknownOutcome||=unknown;this.transport.fail(message);}
 wallet(reply){const wallet=reply.wallet;if(!wallet||!Number.isFinite(wallet.balance)||wallet.balance<0)throw Error('Invalid server wallet.');if(wallet.currency!==undefined&&!/^[A-Z0-9]{2,8}$/.test(wallet.currency))throw Error('Invalid wallet currency.');if(wallet.decimals!==undefined&&(!Number.isInteger(wallet.decimals)||wallet.decimals<0||wallet.decimals>8))throw Error('Invalid wallet decimals.');return wallet;}
 async initialize(){
  try{
   await this.transport.connect();
   const location={};for(const key of ['href','protocol','host','hostname','pathname','search','hash'])location[key]=this.location?.[key]||'';
   const auth=await this.transport.request({set:'authentication',location});
   if(auth.authentication!==true||auth.is?.test!==true)throw Error('This client requires a confirmed RGS test session.');
   const game=await this.transport.request({set:'game',game:RGS_TEST_CONFIG.game});
   if(game.game?.tag!==RGS_TEST_CONFIG.game||game.game.layout?.width!==7||game.game.layout?.height!==7||!game.game.paytable)throw Error('Unexpected game configuration.');
   if(!Array.isArray(game.bets)||!game.bets.length||game.bets.some(b=>!Number.isFinite(b)||b<=0))throw Error('Invalid server bets.');
   this.bets=[...new Set(game.bets)].sort((a,b)=>a-b);this.config=game.game;
   // Casino awards are a separate protocol, not the in-game ice feature.
   const award=readFreeRounds(game.bonus,game.bonus?.bet_sum,null,game.wallet?.decimals??2);
   if(award?.knownWin===null)this.transport.log?.('award-total','Initial free rounds total is invalid. Wallet preserved; winnings displayed unavailable.');
   if(award?.remaining){
    const previous=game.previous;
    if(typeof previous?.ctx!=='string'||!previous.ctx)throw Error('Awarded moves need an initial board context from RGS. Reset was not sent.');
    if(!Array.isArray(previous.events)||previous.events.some(e=>e.type!=='helper')||previous.freespin)throw Error('Award restoration requires a confirmed settled board.');
    const board=this.adapter.initial(previous.reels);this.helpers=rgsHelpers(previous.events,board);this.ctx=previous.ctx;
    const wallet=this.wallet(game);this.s={...this.s,board,balance:wallet.balance,currency:wallet.currency,decimals:wallet.decimals??2,bet:award.bet,freeRounds:award};this.ready=this.transport.healthy;return this.snapshot();
   }
   const initialWallet=this.wallet(game);
   const reply=await this.transport.request({set:'bet',action:'reset'}),bet=reply.bet,wallet=this.wallet(reply);
   if(!bet||!Array.isArray(bet.events)||bet.events.some(e=>e.type!=='helper')||bet.total?.bet!==0||(bet.total?.win??0)!==0||wallet.balance!==initialWallet.balance)throw Error('Unexpected startup result.');
   if(typeof bet.ctx!=='string'||!bet.ctx||!this.bets.includes(bet.bet_sum))throw Error('Missing initial game context or bet.');
   const board=this.adapter.initial(bet.reels),helpers=rgsHelpers(bet.events,board);
   if(bet.freespin||board.some(c=>c.kind==='ice'))throw Error('Unexpected bonus during fresh-session reset.');
   this.ctx=bet.ctx;this.helpers=helpers;this.s={...this.s,board,balance:wallet.balance,currency:wallet.currency??initialWallet.currency,decimals:wallet.decimals??initialWallet.decimals??2,bet:bet.bet_sum};
   this.ready=this.transport.healthy;if(!this.ready)throw Error('Connection lost during startup.');return this.snapshot();
  }catch(e){this.fail(e.message);throw e;}
 }
 async setBet(value){
  if(!this.playable)throw Error('Session is not ready.');if(this.s.bonus||this.s.freeRounds)throw Error('The stake is locked during free moves.');if(!this.bets.includes(value))throw Error('Unsupported bet.');
  try{
   const reply=await this.transport.request({set:'options',bet_sum:value,ctx:this.ctx});
   if(reply.options?.bet_sum!==value)throw Error('Server did not confirm the selected bet.');
   this.ctx=reply.ctx||this.ctx;this.s.bet=value;return this.snapshot();
  }catch(e){this.fail(e.message);throw e;}
 }
 async play(a,b){
  if(!this.playable)throw Error('Session is not ready.');const move=rgsMove(a,b);
  if(this.s.board[a]?.kind==='ice'||this.s.board[b]?.kind==='ice')throw Error('Ice cannot be swapped.');
  // The latest server helper is authoritative. Invalid exchanges must not send
  // a bet: csw1 can return an unrelated/stale board for rejected moves after a
  // cascade. Keep ctx, board, balance and progress unchanged; the UI reverses
  // its visual preview. Do not relax response checks for moves we do submit.
  if(!this.helpers.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a))){
   // Local-only diagnostic: no session context, credentials or automatic request.
   this.lastRejectedMove={pair:[a,b],reason:'not-in-server-helper',board:structuredClone(this.s.board),helpers:this.moves()};
   return {accepted:false,rejectionReason:'not-in-server-helper',board:structuredClone(this.s.board),events:[],helpers:this.moves(),meter:this.s.meter,mult:this.s.mult,state:this.snapshot(),win:0};
  }
  let sent=false;
  try{
   sent=true;const reply=await this.transport.request({set:'bet',action:'move',...move,ctx:this.ctx});
   const bet=reply.bet,wallet=this.wallet(reply);
   if(bet?.bonus){const award=readFreeRounds(bet.bonus,bet.bet_sum,this.s.freeRounds);if(award.retainedStake)this.transport.log?.('award-stake','Free rounds reply omitted stake. Retained the confirmed award stake.');bet.bet_sum=award.bet;}
   if(typeof bet?.ctx!=='string'||!bet.ctx||!(this.bets.includes(bet.bet_sum)||this.s.freeRounds?.bet===bet.bet_sum))throw Error('Incomplete move response.');
   if(bet.bet_sum!==this.s.bet)throw Error('Server used a different bet.');
   const win=bet.total?.win??0,cost=bet.total?.bet;
   if(!Number.isFinite(win)||win<0||!Number.isFinite(cost)||cost<0)throw Error('Invalid server totals.');
   const settlement=finalBonus(bet,this.s.bonus);
   const bonus=settlement&&bet.freespin==null?null:rgsFreeSpin(bet.freespin,this.s.bonus),bonusStarted=!!bonus&&!this.s.bonus;
   if(settlement&&(cost!==0||(bonus&&bonus.moves!==0)))throw Error('Invalid bonus settlement progress or debit.');
   let result;
   if(bonusStarted){
    if(bonus.counter!==0||cost!==0||win!==0||wallet.balance!==this.s.balance||!Array.isArray(bet.events)||bet.events.some(e=>e.type!=='helper'))throw Error('Unverified bonus entry sequence.');
    const board=this.adapter.initial(bet.reels);
    if(board.some((c,i)=>(c.kind==='ice')!==(i>=35)))throw Error('Unexpected initial ice layout.');
    result={accepted:true,board,events:[],helpers:rgsHelpers(bet.events,board),meter:this.s.meter,mult:1};
   }else{
    if(!bonus&&!settlement&&this.s.board.some(c=>c.kind==='ice'))throw Error('Missing server bonus state.');
    let replayBet=bet;
    if(settlement){
     const events=bet.events.slice(0,settlement.index);
     // Helpers after final_win belong to the returned base board. The bonus
     // board no longer needs playable hints, only its final animation replay.
     if(!events.some(e=>e.type==='helper'))events.push({type:'helper',reels:Array.from({length:7},()=>Array(7).fill(0))});
     replayBet={...bet,events};
    }
    result=this.adapter.replay(this.s.board,replayBet,[a,b],{meter:this.s.meter,mult:this.s.bonus?this.s.mult:1,allowMissingHelpers:!settlement});
    if(bonus&&bonus.counter!==this.s.bonus.counter+(result.accepted?1:0))throw Error('Unexpected bonus move counter.');
   }
   if(settlement){
    if(!result.accepted)throw Error('Bonus settled without a confirmed move.');
    const board=this.adapter.initial(settlement.matrix);
    if(board.some(c=>c.kind==='ice'))throw Error('Bonus return board contains ice.');
    const helpers=bet.events.slice(settlement.index+1).filter(e=>e.type==='helper');
    if(helpers.length)result.helpers=rgsHelpers(helpers,board);
    else{
     const saved=this.s.bonus.base;
     const shape=c=>({serverId:c.serverId,activated:c.activated,mult:c.mult,kind:c.kind,magic:c.magic,dir:c.dir});
     if(!saved||JSON.stringify(board.map(shape))!==JSON.stringify(saved.map(shape))||!Array.isArray(this.s.bonus.baseHelpers))throw Error('Returned board needs server helpers.');
     result.helpers=structuredClone(this.s.bonus.baseHelpers);
    }
    result.board=board;result.meter=0;result.mult=1;
   }
   if(!result.accepted&&(win||cost))throw Error('Rejected swap has unexpected totals.');
   if(!result.accepted)result.mult=this.s.mult;
   const awardResult=result.accepted&&!bonusStarted?settleFreeRounds(this.s.freeRounds,bet.bonus,bet.bet_sum,win,this.s.decimals):{active:this.s.freeRounds,completed:null};
   if(awardResult.completed?.knownWin===null)this.transport.log?.('award-total','Final free rounds total is invalid. Wallet preserved; winnings displayed unavailable.');
   const baseHelpers=bonusStarted?this.moves():this.s.bonus?.baseHelpers;
   this.ctx=bet.ctx;this.helpers=result.helpers;
   const awaitingMoves=result.helpers.length===0&&!bonusStarted;
   if(awaitingMoves)this.transport.log?.('missing-next-moves','Confirmed move settled, but no next moves supplied. Further moves blocked; no reset or retry.');
   this.s={...this.s,awaitingMoves,freeRounds:awardResult.active,board:result.board,balance:wallet.balance,currency:wallet.currency??this.s.currency,version:this.s.version+1,meter:result.meter,mult:result.mult,
    bonus:!settlement&&bonus?{...bonus,base:bonusStarted?structuredClone(this.s.board):this.s.bonus.base,baseHelpers,bet:this.s.bet,mult:result.mult,lastMoveWin:win,awaitingCompletion:bonus.moves===0}:null,
    serverWarning:(bonus||this.s.freeRounds||bet.bonus)&&cost>0?'RGS issue: bonus move charged '+cost.toFixed(2):null,lastCost:cost};
   if(result.accepted&&!bonusStarted)this.s.history=[{time:Date.now(),cost,win,mult:result.mult,bonus:!!settlement||!!bonus||!!this.s.freeRounds||!!awardResult.completed,...(settlement?{bonusTotalWin:settlement.event.win}:{})},...this.s.history].slice(0,100);
   return {...result,state:this.snapshot(),win,bonusStarted,bonusEnded:!!settlement,bonusTotalWin:settlement?.event.win,freeRoundsCompleted:awardResult.completed};
  }catch(e){this.fail(e.message,sent);throw e;}
 }
}

// Presentation only: receives legal pairs, never queries RGS or moves pieces.
class SwipeHint {
 constructor(parent,position){
  this.position=position;this.layer=new PIXI.Container();this.layer.eventMode='none';this.layer.interactiveChildren=false;this.layer.label='swipe-hint';parent.addChild(this.layer);
  this.glow=new PIXI.Graphics();this.glow.filters=[new PIXI.BlurFilter({strength:5,quality:4})];this.glow.blendMode='add';
  this.trail=new PIXI.Graphics();this.trail.blendMode='add';
  this.caption=new PIXI.Container();const plate=new PIXI.Graphics().roundRect(-176,-27,352,54,24).fill({color:0x060c1b,alpha:.72});
  const text=new PIXI.Text({text:'SWIPE TO PLAY',style:{fontFamily:'LilitaOne',fontSize:30,fontWeight:'400',fill:0xffffff}});text.anchor.set(.5);this.caption.addChild(plate,text);
  this.hand=new PIXI.Container();
  const shape=()=>new PIXI.Graphics().moveTo(-7,35).lineTo(-7,9).bezierCurveTo(-7,-1,-3,-5,2,-5).bezierCurveTo(8,-5,10,0,10,8).lineTo(10,26)
   .bezierCurveTo(14,21,22,23,23,29).bezierCurveTo(28,24,36,27,36,33).bezierCurveTo(42,29,49,33,49,40)
   .lineTo(49,55).bezierCurveTo(49,63,45,69,39,71).lineTo(7,71).bezierCurveTo(1,70,-2,65,-6,58)
   .lineTo(-20,39).bezierCurveTo(-28,28,-17,23,-11,30).lineTo(-7,35).closePath();
  const shadow=shape().fill({color:0x040719,alpha:.55});shadow.position.set(2,4);shadow.filters=[new PIXI.BlurFilter({strength:3,quality:3})];
  const glove=shape().fill(0xffffff).stroke({color:0x3b294f,width:3.5,join:'round'});
  const cuff=new PIXI.Graphics().moveTo(9,64).quadraticCurveTo(25,67,40,63).stroke({color:0xe3ddeb,width:2,cap:'round'});
  this.hand.addChild(shadow,glove,cuff);this.hand.scale.set(.83);this.hand.rotation=-.14;
  this.layer.addChild(this.caption,this.glow,this.trail,this.hand);this.cursor=0;this.reset();
 }
 reset(delay=10000){this.idle=0;this.elapsed=0;this.delay=delay;this.pair=null;this.layer.visible=false;this.glow.clear();this.trail.clear();}
 tick(dt,allowed,getPairs){
  if(!allowed){this.reset();return;}
  this.idle+=dt;if(this.idle<this.delay)return;
  if(!this.pair){const pairs=getPairs();if(!pairs.length){this.layer.visible=false;return;}
   this.pair=[...pairs[this.cursor%pairs.length]];this.elapsed=0;
   const a=this.position(this.pair[0]),b=this.position(this.pair[1]);
   const top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
   this.caption.position.set(Math.max(201,Math.min(497,(a.x+b.x)/2)),top>130?top-87:Math.min(640,bottom+105));
  }
  this.elapsed+=dt;
  // Two swipes per pair, then show another currently legal move.
  if(this.elapsed>=4800){this.cursor++;this.pair=null;this.layer.visible=false;return;}
  const phase=this.elapsed%2400,a=this.position(this.pair[0]),b=this.position(this.pair[1]);
  const progress=t=>{const v=Math.max(0,Math.min(1,(t-330)/1000));return v*v*(3-2*v);};
  const p=progress(phase),alpha=Math.min(1,phase/160,Math.max(0,(1980-phase)/280));
  this.layer.visible=true;this.caption.alpha=Math.min(1,this.elapsed/200);this.hand.alpha=alpha;
  this.hand.position.set(a.x+(b.x-a.x)*p+4,a.y+(b.y-a.y)*p+10);
  this.hand.scale.set(.83*(1-.07*Math.sin(Math.PI*Math.min(1,phase/440))));
  this.glow.clear();this.trail.clear();
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
  // A tapered ribbon with a white core. Its tail follows the same eased motion
  // at an earlier time, so it stretches during a swipe and dies away at rest.
  const tail=progress(phase-480),length=p-tail,fade=alpha*Math.min(1,length*6);
  if(length>.003&&fade>0){
   const points=[],core=[];for(let i=0;i<=16;i++){const u=i/16,k=tail+length*u,w=Math.sin(Math.PI*u*.82)*7.5;
    points.push({x:a.x+dx*k,y:a.y+dy*k,w});}
   const polygon=width=>[...points.flatMap(v=>[v.x+nx*v.w*width,v.y+ny*v.w*width]),...points.toReversed().flatMap(v=>[v.x-nx*v.w*width,v.y-ny*v.w*width])];
   this.glow.poly(polygon(2.2)).fill({color:0xffdc64,alpha:.75*fade});
   this.trail.poly(polygon(1)).fill({color:0xfff2a4,alpha:.85*fade});this.trail.poly(polygon(.36)).fill({color:0xffffff,alpha:fade});
   const head={x:a.x+dx*p,y:a.y+dy*p};this.glow.circle(head.x,head.y,13).fill({color:0xffe488,alpha:.55*fade});
  }
 }
}

// Visual-only timing. Legal pairs are supplied by the game/RGS, never derived here.
const HINT_TIMING=Object.freeze({early:650,repeat:3300,hand:10000,duration:1100});
const clamp=x=>Math.max(0,Math.min(1,x));
function hintMotion(elapsed,order=0){
 const t=elapsed-order*90;
 if(t<0||t>=HINT_TIMING.duration)return {scale:1,y:0,squash:0,shine:-1};
 const swell=Math.sin(Math.PI*clamp(t/580));
 const jump=t<580?0:Math.sin(Math.PI*clamp((t-580)/350));
 const settle=t<930?0:Math.sin(Math.PI*clamp((t-930)/170));
 return {scale:1+.24*swell,y:-12*jump,squash:.065*settle-.035*jump,shine:t>=150&&t<=470?(t-150)/320:-1};
}
class SymbolHint {
 constructor(){this.reset();this.cursor=0;}
 reset(){this.idle=0;this.pair=null;this.elapsed=0;this.next=HINT_TIMING.early;}
 tick(dt,allowed,getPairs){
  if(!allowed){this.reset();return;}
  this.idle+=dt;if(this.idle>=HINT_TIMING.hand){this.pair=null;return;}
  if(!this.pair&&this.idle>=this.next){const pairs=getPairs();if(!pairs.length)return;this.pair=[...pairs[this.cursor++%pairs.length]];this.elapsed=0;}
  if(this.pair){this.elapsed+=dt;if(this.elapsed>=HINT_TIMING.duration+90){this.pair=null;this.next=this.idle+HINT_TIMING.repeat;}}
 }
 pose(index){const order=this.pair?.indexOf(index)??-1;return order<0?{scale:1,y:0,squash:0,shine:-1}:hintMotion(this.elapsed,order);}
}

// Radial displacement only. The pulse travels out from the last cleared group.
const BOARD_WAVE_MS=725;
function cascadeWaveAfter(events){
 let cleared=false,refilled=false,cascade=false,lastFall=-1;
 for(let i=0;i<events.length;i++){
  if(events[i].type==='destroy'){if(cleared&&refilled)cascade=true;cleared=true;refilled=false;}
  if(events[i].type==='fall'&&cleared){refilled=true;lastFall=i;}
 }
 return cascade?lastFall:-1;
}
function cascadeWaveOrigin(events,fallIndex=cascadeWaveAfter(events)){
 const cells=new Set();
 for(let i=fallIndex-1;i>=0;i--){const e=events[i];if(e.type==='fall')break;if(e.type==='destroy')for(const c of [...e.cells||[],...e.ice||[]])if(Number.isInteger(c)&&c>=0&&c<49)cells.add(c);}
 if(!cells.size)return {column:3,row:3};
 return {column:[...cells].reduce((sum,i)=>sum+i%7,0)/cells.size,row:[...cells].reduce((sum,i)=>sum+Math.floor(i/7),0)/cells.size};
}
function boardWavePose(elapsed,index,origin={column:3,row:3}){
 const col=index%7,row=Math.floor(index/7),dx=col-origin.column,dy=row-origin.row,d=Math.hypot(dx,dy),t=(elapsed/1.25-d*36)/260;
 if(t<=0||t>=1)return {x:0,y:0,sx:1,sy:1};
 const keys=[[0,0],[.27,1],[.67,-.12],[1,0]];
 let k=1;while(t>keys[k][0])k++;const a=keys[k-1],b=keys[k],p=(t-a[0])/(b[0]-a[0]),v=(1-Math.cos(Math.PI*p))/2;
 const pulse=a[1]+(b[1]-a[1])*v,ux=d>.001?dx/d:0,uy=d>.001?dy/d:-1;
 // Reduce the entire vector at the border, preserving its radial direction.
 let amplitude=16;
 if((col===0&&ux<0)||(col===6&&ux>0))amplitude=Math.min(amplitude,5/Math.abs(ux));
 if((row===0&&uy<0)||(row===6&&uy>0))amplitude=Math.min(amplitude,5/Math.abs(uy));
 return {x:ux*amplitude*pulse,y:uy*amplitude*pulse,sx:1,sy:1};
}

// Falling/landing deformation is separate from the shape-preserving cascade wave.
const LANDING_MS=240;
function landingImpact(distance){return Math.min(1, .65+Math.max(0,distance)/700);}
function landingPose(elapsed,impact=1,phase=0){
 const t=Math.max(0,Math.min(1,elapsed/LANDING_MS));
 const keys=[[0,-.14,.22,0],[.12,.20,-.22,0],[.34,-.10,.15,-5],[.56,.075,-.07,0],[.78,-.025,.025,-1],[1,0,0,0]];
 let k=1;while(k<keys.length-1&&t>keys[k][0])k++;
 const a=keys[k-1],b=keys[k],u=(t-a[0])/(b[0]-a[0]),v=(1-Math.cos(Math.PI*u))/2;
 const x=1+(a[1]+(b[1]-a[1])*v)*impact,y=1+(a[2]+(b[2]-a[2])*v)*impact;
 const hop=(a[3]+(b[3]-a[3])*v)*impact;
 return {sx:x,sy:y,y:40*(1-y)+hop,rotation:Math.sin(phase)*.028*Math.sin(Math.PI*t*3)*(1-t)**2*impact};
}

// Presentation only. A donut cannot add cells to an RGS result or create a piece.
function colorClearEffects(board,event,preferred=[]){
 const removed=new Set(event.cells||[]),seen=new Set(),out=[];
 const runs=event.runs??matches(board).filter(run=>(event.regularGroups||[]).some(group=>run.cells.every(i=>group.includes(i))));
 for(const run of runs){
  if(run.cells.length<5||seen.has(run.color)||!run.cells.every(i=>removed.has(i)))continue;
  const targets=board.flatMap((c,i)=>c?.kind==='candy'&&c.color===run.color?[i]:[]);
  if(!targets.length||!targets.every(i=>removed.has(i)))continue;
  const i=preferred.find(i=>run.cells.includes(i))??run.cells[Math.floor(run.cells.length/2)];
  seen.add(run.color);out.push({kind:'donut',i,color:run.color,targets});
 }
 return out;
}

// Presentation only: use confirmed cells and the same contact times as the visuals.
function clearAudioPlan({cells,effects,rocketCells,startAt,board}){
 const unique=[...new Set(cells)],plain=unique.filter(i=>!rocketCells.has(i));
 const rocketHits=unique.filter(i=>rocketCells.has(i)&&board[i]?.kind==='candy').sort((a,b)=>startAt(a)-startAt(b)||a-b);
 const donutTargets=new Set(effects.filter(e=>e.kind==='donut').flatMap(e=>e.targets??[]));
 const donutHits=unique.filter(i=>donutTargets.has(i)&&!rocketCells.has(i)&&board[i]?.kind==='candy');
 const blasts=[];
 // One accent for a confirmed batch of 4+ cells, at its last visual impact.
 // Bomb VFX already plays this cue. Rocket contacts still get individual dry pops.
 if(unique.length>3&&!effects.some(e=>e.kind==='bomb'))
  blasts.push(Math.max(...unique.map(i=>startAt(i)+(rocketCells.has(i)?125:380))));
 return {popAt:plain.length?Math.min(...plain.map(startAt)):null,blastTimes:[...new Set(blasts)],rocketHits,donutHits};
}

// Intermediate display values are permitted only when they reconcile with the confirmed total.
function multiplierArrivalValues(previous,total,values){
 const sum=values.reduce((a,b)=>a+b,0),base=total-sum;
 const additive=base===previous||(previous===1&&base===0);
 let accumulated=base;
 return values.map((value,i)=>{accumulated+=value;return i===values.length-1?total:additive?Math.max(1,accumulated):previous;});
}
function multiplierArc(from,to,t){
 const u=Math.max(0,Math.min(1,t)),bend=Math.min(120,Math.max(40,Math.abs(to.y-from.y)*.28));
 const control={x:(from.x+to.x)/2-bend,y:Math.min(from.y,to.y)-Math.min(90,bend)};
 return {x:(1-u)**2*from.x+2*(1-u)*u*control.x+u*u*to.x,y:(1-u)**2*from.y+2*(1-u)*u*control.y+u*u*to.y};
}
function pendingMultiplierCollection(events,index){
 for(let i=index+1;i<events.length;i++){
  if(events[i].type==='destroy')return (events[i].collected?.length??0)>0;
  if(['fall','swap','shuffle'].includes(events[i].type))return false;
 }
 return false;
}
class MultiplierFlights{
 constructor({target,animate,onArrival}){Object.assign(this,{target,animate,onArrival});this.bounceId=0;}
 async fly({from,value,total,fontSize=27}){
  const element=document.createElement('span');element.className='multiplier-flight';element.textContent='×'+value;
  element.style.fontSize=fontSize+'px';element.setAttribute('aria-hidden','true');document.body.appendChild(element);
  try{
   await this.animate(570,t=>{
    const r=this.target().getBoundingClientRect(),to={x:r.x+r.width/2,y:r.y+r.height/2};
    const q=multiplierArc(from,to,t*t*(3-2*t)),scale=1+.22*Math.sin(Math.PI*t)-.12*t;
    element.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%) scale(${scale})`;
    element.style.opacity=String(Math.min(1,t/.08));
   });
   element.remove();this.onArrival(total);
   const token=++this.bounceId,target=this.target();
   try{await this.animate(290,t=>{if(token!==this.bounceId)return;const spring=Math.sin(t*Math.PI*2)*Math.exp(-t*3);target.style.transform=`translateY(${-7*spring}px) scale(${1+.25*spring})`;});}
   finally{if(token===this.bounceId)target.style.transform='';}
  }finally{element.remove();}
 }
}


function pendingMagicCollection(events,index){
 for(let i=index+1;i<events.length;i++){
  if(events[i].type==='destroy')return !!events[i].magicCells?.length;
  if(['fall','swap','shuffle'].includes(events[i].type))return false;
 }
 return false;
}
function magicArrivalValues(previous,total,count){
 const additive=total===Math.min(3,previous+count);
 return Array.from({length:count},(_,i)=>i===count-1?total:additive?Math.min(3,previous+i+1):previous);
}
class MagicFlights{
 constructor({animate}){this.animate=animate;this.pulses=new WeakMap();}
 async fly({from,url,size,target,onArrival}){
  const layer=document.createElement('div');layer.className='magic-flight';layer.setAttribute('aria-hidden','true');
  const trail=Array.from({length:6},()=>{const dot=document.createElement('span');dot.className='magic-flight-spark';layer.append(dot);return dot;});
  const image=document.createElement('img');image.src=url;image.style.width=size+'px';image.style.height=size+'px';layer.append(image);document.body.append(layer);
  try{
   await this.animate(560,t=>{
    const r=target().getBoundingClientRect(),to={x:r.x+r.width/2,y:r.y+r.height/2};
    const point=u=>multiplierArc(from,to,u*u*(3-2*u));
    const p=point(t),scale=.64+.43*Math.sin(Math.PI*t)-.35*t;
    image.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${Math.sin(Math.PI*t)*18}deg) scale(${scale})`;
    image.style.opacity=String(t>.93?(1-t)/.07:1);
    trail.forEach((dot,j)=>{const u=Math.max(0,t-(j+1)*.025),q=point(u);dot.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%) scale(${(1-j/7)*size/70})`;dot.style.opacity=String((u>0?1:0)*(1-j/7)*.65*Math.sin(Math.PI*t));});
   });
   layer.remove();onArrival();
   const el=target(),token={};this.pulses.set(el,token);
   try{await this.animate(240,t=>{if(this.pulses.get(el)!==token)return;el.style.scale=String(1+.45*Math.sin(Math.PI*t)*Math.exp(-t));el.style.filter=`drop-shadow(0 0 ${12*Math.sin(Math.PI*t)}px #ffe08a)`;});}
   finally{if(this.pulses.get(el)===token){el.style.scale='';el.style.filter='';}}
  }finally{layer.remove();}
 }
}

// Presentation-only memory of confirmed broken ice. Never changes symbol properties or payouts.
class IceMultiplierMarks {
 constructor({parent,position,label}){Object.assign(this,{parent,position,label});this.values=new Map();this.labels=new Map();}
 remember(index,piece){if(piece?.kind==='ice'&&piece.mult>0)this.values.set(index,piece.mult);}
 clear(){this.values.clear();for(const label of this.labels.values())label.destroy();this.labels.clear();}
 sync(board,nodes){
  board.forEach((piece,index)=>{if(piece?.kind==='ice')this.values.delete(index);});
  for(const [index,label]of this.labels)if(!this.values.has(index)){label.destroy();this.labels.delete(index);}
  for(const n of nodes.values())if(n.multiplierLabel&&n.kind!=='ice'&&!n.clearing)n.multiplierLabel.visible=!this.values.has(n.index);
  for(const [index,value]of this.values){
   const piece=board[index];let label=this.labels.get(index);
   if(!label){label=this.label('×'+(piece?.mult||value),36,true);label.label='ice-cell-multiplier';label.cellIndex=index;label.alpha=.64;Object.assign(label,this.position(index));this.parent.addChild(label);this.labels.set(index,label);}
   label.text='×'+(piece?.mult||value);label.scale.set(1);if(label.width>80)label.scale.set(80/label.width);
   label.visible=!!piece&&piece.kind!=='ice';
  }
 }
 hide(index){const label=this.labels.get(index);if(label)label.visible=false;}
}

// Reference phases: fuse, white charge, tapered rays, scalloped pink/gold shock front.
// Presentation only: affected cells always come from the confirmed game event.
const BOOSTER_TIMING=Object.freeze({bombPrepare:300,bombCharge:480,bombFlash:280,bombWave:440,rocketPrepare:300,rocketCharge:400,rocketFlight:190,rocketTail:260});
function rocketVector(dir){return {x:[0,1,0,-1][dir],y:[-1,0,1,0][dir]};}
function rocketPoint(dir,along,side=0){const d=rocketVector(dir);return {x:d.x*along-d.y*side,y:d.y*along+d.x*side};}
function rocketFlight(origin,dir){const d=rocketVector(dir),distance=d.x>0?730-origin.x:d.x<0?origin.x+30:d.y>0?730-origin.y:origin.y+30;return {distance,duration:Math.max(220,distance/1.2)};}
function rocketTravel(t,distance){return (.2*t+.8*t*t)*distance;}
function rocketContactMs(origin,target,dir){
 const d=rocketVector(dir),dx=target.x-origin.x,dy=target.y-origin.y,along=dx*d.x+dy*d.y,side=dx*(-d.y)+dy*d.x;
 if(along<0||Math.abs(side)>1)return null;
 const f=rocketFlight(origin,dir),travel=Math.max(0,along-64),fraction=Math.min(1,travel/f.distance);
 const t=(-.2+Math.sqrt(.04+3.2*fraction))/1.6;
 return BOOSTER_TIMING.rocketPrepare+BOOSTER_TIMING.rocketCharge+t*f.duration;
}
function makeFuse(parent,textures){
 const root=new PIXI.Container();root.label='burning-fuse';parent.addChild(root);
 const glow=boosterSpark(root,textures.soft,0xff921e),flame=new PIXI.Graphics();root.addChild(flame);
 const sparks=Array.from({length:7},()=>boosterSpark(root,textures.glint,0xfff4b5));
 return {root,glow,flame,sparks};
}
function tickFuse(f,sprite,art,time,progress=0){
 // Measured tip of the candy fuse in bomb-v11.png. Follow the sprite's full transform.
 const lx=(art.w*.77-art.cx)*sprite.scale.x,ly=(art.h*.12-art.cy)*sprite.scale.y,a=sprite.rotation;
 f.root.position.set(sprite.x+lx*Math.cos(a)-ly*Math.sin(a),sprite.y+lx*Math.sin(a)+ly*Math.cos(a));
 const flicker=.85+.15*Math.sin(time*.041)+.08*Math.sin(time*.073),size=1+progress*.25;
 f.glow.width=f.glow.height=34*flicker*size;f.glow.alpha=.75;
 f.flame.clear().ellipse(0,-3*size,4.8*flicker*size,8.5*size).fill(0xff9b25).ellipse(0,-1.5*size,2.6*flicker*size,5.4*size).fill(0xfff4b5).circle(0,0,2).fill(0xffffff);
 f.sparks.forEach((s,j)=>{const t=(time*.003+j/7)%1,angle=j*2.399963,q=5+22*t;s.position.set(Math.cos(angle)*q,Math.sin(angle)*q-12*t);s.width=s.height=(5+j%3*2)*(1-t);s.alpha=(1-t)**1.5;s.rotation=angle+time*.006;});
}
let boosterTextures;
function boosterTextureSet(){
 if(boosterTextures)return boosterTextures;
 const texture=draw=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;draw(canvas.getContext('2d'));return PIXI.Texture.from(canvas);};
 const soft=texture(ctx=>{const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#fff');g.addColorStop(.12,'rgba(255,255,255,.97)');g.addColorStop(.36,'rgba(255,255,255,.5)');g.addColorStop(.7,'rgba(255,255,255,.10)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);});
 const smoke=texture(ctx=>{for(const [x,y,r]of [[40,71,29],[71,69,36],[66,40,27],[92,61,21]]){const g=ctx.createRadialGradient(x-5,y-7,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.55,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}});
 const star=texture(ctx=>{ctx.translate(64,64);ctx.shadowColor='white';ctx.shadowBlur=8;ctx.fillStyle='white';ctx.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,r=j%2?14:32;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();});
 const glint=texture(ctx=>{ctx.translate(64,64);ctx.shadowColor='white';ctx.shadowBlur=10;ctx.fillStyle='white';ctx.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4,r=j%2?5:55;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();});
 return boosterTextures={soft,smoke,star,glint};
}
function boosterSpark(parent,texture,tint,blend='add'){const s=new PIXI.Sprite(texture);s.anchor.set(.5);s.tint=tint;s.blendMode=blend;parent.addChild(s);return s;}
function boosterStarShape(g,x,y,r,angle,color,alpha){const points=[];for(let k=0;k<10;k++){const a=angle+k*Math.PI/5,len=k%2?r*.43:r;points.push(x+Math.cos(a)*len,y+Math.sin(a)*len);}g.poly(points).fill({color,alpha});}
class BoosterVFX {
 constructor({parent,position,node,art,animate,pause,sound,loop=()=>()=>{}}){Object.assign(this,{parent,position,node,art,animate,pause,sound,loop});this.textures=boosterTextureSet();}
 sprite(e){const n=this.node(e.i),s=n?.kind===e.kind?n.sprite:null,a=this.art(e.kind),v=new PIXI.Sprite(s?.texture||a.texture);
  if(s){v.anchor.copyFrom(s.anchor);v.scale.set(n.baseSpriteScale,n.baseSpriteScaleY);v.rotation=n.baseSpriteRotation;}
  else{v.anchor.set(a.cx/a.w,a.cy/a.h);v.width=84*a.w/a.size;v.height=84*a.h/a.size;v.rotation=e.kind==='rocket'?e.dir*Math.PI/2:0;}return v;
 }
 arm(n){if(n.armedMist||n.armedFuse||!['bomb','rocket'].includes(n.kind))return;if(n.kind==='bomb'){n.armedFuse=makeFuse(n,this.textures);return;}const cloud=new PIXI.Container();cloud.eventMode='none';n.addChildAt(cloud,0);n.armedMist={cloud,puffs:Array.from({length:9},(_,j)=>boosterSpark(cloud,this.textures.smoke,j%3?0xff8fe5:0xffffff,'normal'))};}
 tickArmed(n,time){if(n.armedFuse){tickFuse(n.armedFuse,n.sprite,this.art('bomb'),time);return;}if(!n.armedMist)return;const {puffs}=n.armedMist,dir=Math.round(n.baseSpriteRotation/(Math.PI/2))%4;for(let j=0;j<puffs.length;j++){const t=(time*.00125+j/9)%1,s=puffs[j],q=rocketPoint(dir,-34-18*t,(j%2?1:-1)*(5+17*t));s.position.set(q.x,q.y);s.width=20+20*t;s.height=18+17*t;s.alpha=Math.sin(Math.PI*t)*.55;s.rotation=dir*Math.PI/2+t*.5;}}
 async play(e){
  const group=new PIXI.Container(),haze=new PIXI.Container(),rays=new PIXI.Graphics(),detail=new PIXI.Graphics(),puffs=new PIXI.Graphics(),embers=new PIXI.Container(),sprite=this.sprite(e),p=this.position(e.i),n=this.node(e.i);
  group.label='booster-'+e.kind;sprite.label='booster-body';group.vfxPhase='prepare';group.eventMode='none';group.position.set(p.x,p.y);rays.blendMode=detail.blendMode='add';rays.filters=[new PIXI.BlurFilter({strength:3.2,quality:3})];group.addChild(haze,rays,puffs,detail,sprite,embers);puffs.label='candy-blast-puffs';this.parent.addChild(group);
  const aura=boosterSpark(haze,this.textures.soft,0xff24e8),core=boosterSpark(haze,this.textures.soft,0xffffff);aura.alpha=core.alpha=0;
  const sparks=Array.from({length:24},(_,j)=>{const s=boosterSpark(embers,j%3?this.textures.glint:this.textures.star,j%4?0xffc6fa:0xffed9b);s.alpha=0;return s;});
  const smoke=Array.from({length:14},(_,j)=>{const s=boosterSpark(haze,this.textures.smoke,j%3?0xff91e4:0xffe5fd,'normal');s.alpha=0;return s;});
  const base={x:sprite.scale.x,y:sprite.scale.y,rotation:sprite.rotation},origin=n;if(origin)origin.visible=false;
  const wash=new PIXI.ColorMatrixFilter();sprite.filters=[wash];const whiten=v=>{const k=1-v;wash.matrix=[k,0,0,0,v,0,k,0,0,v,0,0,k,0,v,0,0,0,1,0];};
  const light=(diameter,alpha,white=0)=>{aura.width=aura.height=diameter;aura.alpha=alpha;core.width=core.height=diameter*.5;core.alpha=white;};
  const burstSparks=t=>{sparks.forEach((s,j)=>{const a=j*2.399963,r=35+(65+(j%5)*22)*(1-(1-t)**2);s.position.set(Math.cos(a)*r,Math.sin(a)*r);s.width=s.height=(j%3?18:31)*(1-.65*t);s.rotation=a+t*(j%2?1:-1);s.alpha=Math.sin(Math.PI*Math.min(1,t*1.6))*(1-t)*.95;});};
  let stopFuse=()=>{};
  try{if(e.kind==='bomb'){
   const fuse=makeFuse(embers,this.textures);stopFuse=this.loop('fuse');
   await this.animate(BOOSTER_TIMING.bombPrepare,t=>{
    const crouch=t<.35?Math.sin(Math.PI*t/.35):0,pop=t>=.35?Math.sin(Math.PI*(t-.35)/.65):0;
    sprite.scale.set(base.x*(1+.24*crouch-.14*pop),base.y*(1-.23*crouch+.24*pop));
    sprite.y=6*crouch-10*pop;sprite.rotation=base.rotation+Math.sin(t*Math.PI*4)*.08*Math.sin(Math.PI*t);
    light(100+45*pop,.25+.35*pop);tickFuse(fuse,sprite,this.art('bomb'),t*BOOSTER_TIMING.bombPrepare,t*.3);
   });sprite.position.set(0,0);sprite.rotation=base.rotation;group.vfxPhase='charge';
   await this.animate(BOOSTER_TIMING.bombCharge,t=>{const pulse=Math.sin(t*Math.PI*6)*(.025+.035*t),scale=1+.15*t+pulse;sprite.scale.set(base.x*scale,base.y*scale);sprite.rotation=base.rotation+Math.sin(t*34)*.045*t;sprite.y=-3*Math.sin(t*Math.PI);whiten(Math.max(0,(t-.65)/.35));light(90+95*t,.18+.45*t,Math.max(0,t-.75)*2);tickFuse(fuse,sprite,this.art('bomb'),BOOSTER_TIMING.bombPrepare+t*BOOSTER_TIMING.bombCharge,.3+.7*t);});fuse.root.visible=false;stopFuse();
   group.vfxPhase='flash';await this.animate(BOOSTER_TIMING.bombFlash,t=>{whiten(1);const squeeze=1.18-.28*t;sprite.scale.set(base.x*squeeze,base.y*squeeze);light(180+80*t,.85,1);rays.clear();detail.clear();for(let j=0;j<13;j++){const a=j*2.399963+t*.22,r=46+(58+(j%4)*25)*Math.sin(Math.PI*(.25+.7*t)),w=2+(j%3)*1.8,dx=Math.cos(a),dy=Math.sin(a);rays.poly([-dy*w,dx*w,dx*r,dy*r,dy*w,-dx*w]).fill({color:0xff63ec,alpha:.65});detail.poly([-dy*w*.25,dx*w*.25,dx*r*.9,dy*r*.9,dy*w*.25,-dx*w*.25]).fill({color:0xffffff,alpha:.85});}});
   this.sound('bombEpic');sprite.visible=false;rays.clear();
   group.vfxPhase='burst';await this.animate(BOOSTER_TIMING.bombWave,t=>{
    // Layered rounded lobes: hot cream core, raspberry body, then a shrinking violet edge.
    puffs.clear();const travel=1-(1-t)**3,shrink=Math.max(0,1-Math.max(0,(t-.35)/.65)**1.4),rise=Math.min(1,t/.13);
    for(let j=0;j<12;j++){const a=j*Math.PI/6+.13,rad=26+99*travel,cx=Math.cos(a)*rad,cy=Math.sin(a)*rad-13*t,radius=(23+j%3*5)*rise*shrink;
     if(radius<.1)continue;const alpha=.86*(1-Math.max(0,(t-.65)/.35));
     puffs.ellipse(cx,cy,radius,radius*.88).fill({color:t<.45?0xf448a8:0xb66ce7,alpha});
     puffs.ellipse(cx-radius*.07,cy-radius*.13,radius*.81,radius*.69).fill({color:t<.35?0xffc7e1:0xeea6e9,alpha});
     puffs.ellipse(cx-radius*.16,cy-radius*.3,radius*.49,radius*.35).fill({color:0xfff1ce,alpha:alpha*(1-t)});
    }
    const r=24+151*(1-(1-t)**3),fade=(1-t)**1.25;light(290+140*t,1.15*fade,Math.max(0,1-t*5));detail.clear();rays.clear();const contour=[];for(let j=0;j<=120;j++){const a=j*Math.PI/60,radius=r*(1+.065*Math.sin(a*9+t*4)+.032*Math.sin(a*17-t*7));contour.push(Math.cos(a)*radius,Math.sin(a)*radius);}
    const inner=contour.map(v=>v*.76);
    rays.poly(contour).fill({color:0xf222d6,alpha:.58*fade}).poly(inner).cut();
    rays.poly(contour).stroke({color:0xb82aff,width:40*(1-t)+14,alpha:.42*fade});
    detail.poly(contour).stroke({color:0xff77e9,width:16*(1-t)+3,alpha:.9*fade});
    detail.poly(inner).stroke({color:0xffd29a,width:10*(1-t)+2,alpha:.9*fade});
    for(let j=0;j<9;j++){const a=j*Math.PI*2/9+t*.12;boosterStarShape(detail,Math.cos(a)*r,Math.sin(a)*r,(10+6*Math.sin(j*3))*(1-t),a+t,0xfff2cd,fade);}
    smoke.forEach((s,j)=>{const a=j*2.399963,rad=r*.72;s.position.set(Math.cos(a)*rad,Math.sin(a)*rad);s.width=s.height=38+55*t;s.alpha=.5*Math.sin(Math.PI*t)*(1-t);s.rotation=a;});burstSparks(t);
   });
  }else{
   const point=(along,side=0)=>rocketPoint(e.dir,along,side);this.sound('rocketCharge');
   const plume=(progress,travel=0)=>{smoke.forEach((s,j)=>{const t=(progress*1.3+j/14)%1,side=(j%2?1:-1)*(7+32*t),q=point(travel-34-17*t,side);s.position.set(q.x,q.y);s.width=45+30*t;s.height=34+27*t;s.alpha=Math.sin(Math.PI*t)*.95;s.rotation=j+progress;});};
   await this.animate(BOOSTER_TIMING.rocketPrepare,t=>{
    const press=Math.sin(Math.PI*t),wobble=Math.sin(t*Math.PI*5)*Math.sin(Math.PI*t);
    sprite.scale.set(base.x*(1+.22*press),base.y*(1-.21*press));
    const q=point(-11*press);sprite.position.set(q.x,q.y);sprite.rotation=base.rotation+.09*wobble;
    light(105+55*press,.22+.3*press);plume(t*.7);
   });sprite.rotation=base.rotation;group.vfxPhase='charge';
   await this.animate(BOOSTER_TIMING.rocketCharge,t=>{const bounce=Math.sin(t*Math.PI);sprite.scale.set(base.x*(1+.10*bounce-.14*t),base.y*(1-.08*bounce+.30*t));const q=point(-6*bounce);sprite.position.set(q.x,q.y);whiten(Math.max(0,(t-.7)/.3)*.35);light(110+50*t,.25+.25*t);plume(t);});this.sound('rocket');
   const {distance,duration:flightDuration}=rocketFlight(p,e.dir);
   group.vfxPhase='flight';await this.animate(flightDuration,t=>{const travel=rocketTravel(t,distance),q=point(travel),length=45+95*Math.min(1,t*4);sprite.position.set(q.x,q.y);sprite.scale.set(base.x*.84,base.y*1.34);whiten(.12);aura.position.set(q.x,q.y);core.position.set(q.x,q.y);light(115,.55,.3);detail.clear();rays.clear();const tip=point(travel-28),end=point(travel-28-length),left=point(travel-38,17),right=point(travel-38,-17);rays.poly([tip.x,tip.y,left.x,left.y,end.x,end.y,right.x,right.y]).fill({color:0xff32d5,alpha:.7});const l=point(travel-36,7),r=point(travel-36,-7),tail=point(travel-28-length*.77);detail.poly([tip.x,tip.y,l.x,l.y,tail.x,tail.y,r.x,r.y]).fill({color:0xffe6ff,alpha:.95});plume(.7+t,travel);smoke.forEach(s=>s.alpha*=1-t*.7);sparks.forEach((s,j)=>{const u=Math.max(0,t-j*.012),at=rocketTravel(u,distance),v=point(at-35,Math.sin(j*7.7)*13);s.position.set(v.x,v.y);s.width=s.height=j%4?9:18;s.alpha=(1-j/24)*.8;s.rotation=j;});});
   sprite.visible=false;
   const smokeEnd=smoke.map(s=>({alpha:s.alpha,x:s.scale.x,y:s.scale.y})),sparkEnd=sparks.map(s=>({x:s.x,y:s.y}));
   group.vfxPhase='tail';await this.animate(BOOSTER_TIMING.rocketTail,t=>{aura.alpha=core.alpha=0;rays.alpha=detail.alpha=(1-t)**2;smoke.forEach((s,j)=>{const p=smokeEnd[j];s.alpha=p.alpha*(1-t)**2;s.scale.set(p.x*(1+.3*t),p.y*(1+.3*t));});embers.alpha=(1-t)**2;sparks.forEach((s,j)=>{s.position.set(sparkEnd[j].x+Math.sin(j*7)*5*t,sparkEnd[j].y+5*t);});});
  }}finally{stopFuse();if(origin&&!origin.destroyed&&(e.preview||origin.kind!==e.kind))origin.visible=true;group.destroy({children:true});}
 }
}

// Small real 3D prop: curved icing and sprinkles share the same lighting and depth.
// Rendered only while the transient booster exists; gameplay remains in Pixi.
function createDonutProp(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)return null;
 try{return buildDonutProp(canvas,gl);}catch(error){gl.getExtension('WEBGL_lose_context')?.loseContext();return null;}
}
function buildDonutProp(canvas,gl){
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const vs=compile(gl.VERTEX_SHADER,`attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat3 rotation;varying vec3 normal;varying vec3 position;varying vec3 color;void main(){vec3 q=rotation*p;normal=rotation*n;position=q;color=c;float z=4.3-q.z;gl_Position=vec4(q.xy*3.25,(z-2.0)*1.0,z);}`);
 const fs=compile(gl.FRAGMENT_SHADER,`precision highp float;varying vec3 normal;varying vec3 position;varying vec3 color;uniform float charge;void main(){vec3 N=normalize(normal),V=normalize(vec3(0.,0.,4.3)-position);vec3 L=normalize(vec3(-.55,.8,1.25)),L2=normalize(vec3(.8,-.35,.8));float key=max(0.,dot(N,L)),fill=max(0.,dot(N,L2));float spec=pow(max(0.,dot(N,normalize(L+V))),55.);float gloss=pow(max(0.,dot(N,normalize(vec3(-.25,.55,1.8)+V))),135.);float rim=pow(1.-max(0.,dot(N,V)),3.);vec3 lit=color*(.33+key*.85+fill*.3)+vec3(1.,.88,.7)*spec*.95+vec3(1.)*gloss*.6+vec3(.25,.12,.04)*rim;lit+=charge*(vec3(.28,.095,.008)*(.3+key)+spec*.6);gl_FragColor=vec4(pow(lit,vec3(.4545)),1.);}`);
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const data=[];const norm=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);};const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const grid=(nu,nv,fn)=>{for(let u=0;u<nu;u++)for(let v=0;v<nv;v++){const a=fn(u/nu,v/nv),b=fn((u+1)/nu,v/nv),c=fn((u+1)/nu,(v+1)/nv),d=fn(u/nu,(v+1)/nv);for(const q of [a,b,c,a,c,d])data.push(...q);}};
 const surface=(u,v,r)=>{const R=.65+.009*Math.sin(u*5)+.006*Math.sin(u*9);return [(R+r*Math.cos(v))*Math.cos(u),(R+r*Math.cos(v))*Math.sin(u),r*Math.sin(v)*.79];};
 grid(88,32,(a,b)=>{const u=a*Math.PI*2,v=b*Math.PI*2,p=surface(u,v,.345),n=norm([Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u),Math.sin(v)/.79]);const gold=.8+.05*Math.cos(v*3);return [...p,...n,.76*gold,.29*gold,.025*gold];});
 const icePos=(a,b)=>{const u=a*Math.PI*2,edge=.32-.28*(.5+.5*Math.sin(u*9+.6))**6-.12*(.5+.5*Math.sin(u*13))**10,v=edge+(Math.PI-.22-edge)*b;return surface(u,v,.333+.033*Math.sin(Math.PI*b)**.35+.004*Math.sin(u*7)*Math.sin(v)**2);};
 grid(88,28,(a,b)=>{const p=icePos(a,b),pa=icePos(a+.0001,b),pb=icePos(a,b+.0001);const n=norm(cross(pa.map((v,i)=>v-p[i]),pb.map((v,i)=>v-p[i])));return [...p,...n,.46,.048,.014];});
 const palette=[[1,.015,.22],[.015,.72,1],[.34,.95,.005],[1,.67,.005],[1,.12,.015]];
 for(let j=0;j<27;j++){
  const u=j*2.399963,v=.43+((j*17)%29)/29*2.28,center=surface(u,v,.366),N=norm([Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u),Math.sin(v)/.79]),T=norm([-Math.sin(u),Math.cos(u),0]),B=norm(cross(N,T)),angle=j*1.77;
  for(let k=0;k<3;k++)center[k]+=N[k]*.045;
  const A=T.map((x,i)=>x*Math.cos(angle)+B[i]*Math.sin(angle)),C=T.map((x,i)=>-x*Math.sin(angle)+B[i]*Math.cos(angle));
  grid(12,8,(a,b)=>{const lon=a*Math.PI*2,lat=b*Math.PI,x=Math.cos(lon)*Math.sin(lat),y=Math.sin(lon)*Math.sin(lat),z=Math.cos(lat);const p=center.map((q,i)=>q+A[i]*x*.107+C[i]*y*.046+N[i]*z*.037),normal=norm(N.map((q,i)=>A[i]*x/.107+C[i]*y/.046+q*z/.037));return [...p,...normal,...palette[j%palette.length]];});
 }
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);gl.useProgram(program);
 for(const [name,offset]of [['p',0],['n',12],['c',24]]){const i=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,offset);}
 const rotation=gl.getUniformLocation(program,'rotation'),charge=gl.getUniformLocation(program,'charge');gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);gl.viewport(0,0,384,384);
 const texture=PIXI.Texture.from(canvas);
 const rotate=(p,yaw,pitch,roll)=>{const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw),y=p[1]*Math.cos(pitch)-z*Math.sin(pitch),zz=p[1]*Math.sin(pitch)+z*Math.cos(pitch);return [x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll),zz];};
 return {texture,draw(yaw,pitch,roll,light=0){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix3fv(rotation,false,new Float32Array([...rotate([1,0,0],yaw,pitch,roll),...rotate([0,1,0],yaw,pitch,roll),...rotate([0,0,1],yaw,pitch,roll)]));gl.uniform1f(charge,light);gl.drawArrays(gl.TRIANGLES,0,data.length/9);texture.source.update();},destroy(){texture.destroy(true);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}

// Measured from the supplied 25 fps recording (26.48–28.56 s).
const DONUT_TIMING=Object.freeze({appear:320,hover:460,charge:180,release:440,hold:660,fade:480});
const DONUT_LAUNCH_MS=DONUT_TIMING.appear+DONUT_TIMING.hover+DONUT_TIMING.charge;
function donutFlightDuration(from,to){return Math.min(320,180+Math.hypot(to.x-from.x,to.y-from.y)*.25);}
function donutSpinAngle(ms){const turn=Math.PI*2,release=DONUT_TIMING.release,hold=DONUT_TIMING.hold;if(ms<=release)return -.2+turn*Math.max(0,ms)/release;const t=Math.min(1,(ms-release)/hold);return -.2+turn+turn/release*hold*(t-t*t*.5);}
function donutFlightPlan(from,to){
 const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)-Math.PI/2;
 const phase=((angle+.2)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),delay=phase/(Math.PI*2)*DONUT_TIMING.release,t=delay/DONUT_TIMING.release;
 const size=.94+.76*(1-(1-t)**3)+.12*Math.sin(Math.PI*t),r=57*size;
 const start={x:from.x+Math.cos(angle)*r,y:from.y+Math.sin(angle)*r-3},tangent={x:-Math.sin(angle),y:Math.cos(angle)},reach=Math.max(64,d*.38);
 return {delay,duration:donutFlightDuration(from,to),start,c1:{x:start.x+tangent.x*reach,y:start.y+tangent.y*reach},c2:{x:to.x-dx*.18+tangent.x*24,y:to.y-dy*.18+tangent.y*24},end:{...to}};
}
function donutFlightPoint(plan,t){const u=Math.max(0,Math.min(1,t)),v=1-u;return {x:v*v*v*plan.start.x+3*v*v*u*plan.c1.x+3*v*u*u*plan.c2.x+u*u*u*plan.end.x,y:v*v*v*plan.start.y+3*v*v*u*plan.c1.y+3*v*u*u*plan.c2.y+u*u*u*plan.end.y};}
let donutTextures;
function donutTextureSet(){
 if(donutTextures)return donutTextures;
 const make=(draw,size=128)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);return PIXI.Texture.from(c);};
 const soft=make((g,s)=>{const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);for(const [t,a] of [[0,1],[.12,.95],[.3,.5],[.6,.12],[1,0]])r.addColorStop(t,`rgba(255,255,255,${a})`);g.fillStyle=r;g.fillRect(0,0,s,s);});
 const head=make((g,s)=>{const r=g.createRadialGradient(64,64,0,64,64,64);for(const [t,a]of [[0,1],[.5,1],[.65,.9],[.8,.25],[1,0]])r.addColorStop(t,`rgba(255,255,255,${a})`);g.fillStyle=r;g.fillRect(0,0,s,s);});
 const sprinkle=make(g=>{g.translate(64,64);g.rotate(-.35);const r=g.createLinearGradient(-15,-35,16,35);r.addColorStop(0,'#fff');r.addColorStop(.3,'#fff');r.addColorStop(.6,'#ccc');r.addColorStop(1,'#555');g.fillStyle=r;g.beginPath();g.ellipse(0,0,22,46,0,0,Math.PI*2);g.fill();g.fillStyle='#ffffffcc';g.beginPath();g.ellipse(-7,-13,5,20,.1,0,Math.PI*2);g.fill();});
 const shard=make(g=>{g.translate(64,64);g.shadowColor='white';g.shadowBlur=10;const r=g.createLinearGradient(-24,-30,22,30);r.addColorStop(0,'#ffffff');r.addColorStop(.4,'#ffffffa0');r.addColorStop(1,'#ffffff15');g.fillStyle=r;g.beginPath();g.moveTo(-27,-26);g.lineTo(26,-9);g.lineTo(-4,32);g.closePath();g.fill();g.strokeStyle='#ffffffb0';g.lineWidth=3;g.stroke();g.shadowBlur=0;g.beginPath();g.moveTo(-27,-26);g.lineTo(0,0);g.lineTo(26,-9);g.strokeStyle='#ffffff70';g.stroke();});
 const shine=make(g=>{const r=g.createLinearGradient(0,0,128,0);r.addColorStop(0,'#ffffff00');r.addColorStop(.32,'#ffffff00');r.addColorStop(.46,'#ffffffaa');r.addColorStop(.51,'#fff');r.addColorStop(.65,'#ffffff00');r.addColorStop(1,'#ffffff00');g.fillStyle=r;g.fillRect(0,0,128,128);});
 return donutTextures={soft,head,sprinkle,shard,shine};
}
function donutSprite(parent,texture,tint=0xffffff,size=100,blend='add'){const s=new PIXI.Sprite(texture);s.anchor.set(.5);s.tint=tint;s.width=s.height=size;s.blendMode=blend;parent.addChild(s);return s;}
class DonutVFX {
 constructor({parent,position,texture,animate,sound=()=>{},loop=()=>()=>{}}){Object.assign(this,{parent,position,texture,animate,sound,loop});this.textures=donutTextureSet();const prop=createDonutProp();this.props=prop?[prop]:[];this.hasProp=!!prop;}
 async play(e){
  const group=new PIXI.Container();group.label='booster-donut';group.eventMode='none';Object.assign(group,this.position(e.i));this.parent.addChild(group);
  const color=e.tint??0x39cfff,origin=this.position(e.i),zero={x:0,y:0};
  const marks=new PIXI.Graphics(),marksSoft=new PIXI.Graphics();marksSoft.filters=[new PIXI.BlurFilter({strength:6,quality:3})];marks.filters=[new PIXI.BlurFilter({strength:1.8,quality:3})];marks.blendMode=marksSoft.blendMode='add';group.addChild(marksSoft,marks);
  const outerGlow=donutSprite(group,this.textures.soft,0xff3b9e,340,'normal'),aura=donutSprite(group,this.textures.soft,0xffb52a,250),bloom=donutSprite(group,this.textures.soft,0xffec8b,130);
  outerGlow.label='donut-back-glow';const birthRing=new PIXI.Graphics(),birthRays=new PIXI.Graphics();birthRing.blendMode=birthRays.blendMode='add';birthRing.filters=[new PIXI.BlurFilter({strength:2.5,quality:3})];birthRays.filters=[new PIXI.BlurFilter({strength:4,quality:3})];group.addChild(birthRays,birthRing);
  const back=new PIXI.Container(),body=new PIXI.Container(),front=new PIXI.Container();group.addChild(back,body,front);body.label='booster-body';
  const prop=this.props.pop()??(this.hasProp?createDonutProp():null);
  const art=new PIXI.PerspectiveMesh({texture:this.texture,verticesX:16,verticesY:16}),reflection=new PIXI.PerspectiveMesh({texture:this.texture,verticesX:16,verticesY:16});body.addChild(art,reflection);const propSprite=prop?donutSprite(body,prop.texture,0xffffff,164,'normal'):null;if(prop){propSprite.label='donut-prop-3d';art.visible=false;reflection.visible=false;}
  const wash=new PIXI.ColorMatrixFilter();art.filters=[wash];const whiteFilter=new PIXI.ColorMatrixFilter();whiteFilter.matrix=[0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0];reflection.filters=[whiteFilter];reflection.blendMode='add';reflection.alpha=.4;
  const reflectionMask=donutSprite(body,this.textures.shine,0xffffff,200,'normal');reflectionMask.rotation=-.45;reflection.mask=reflectionMask;
  const core=donutSprite(group,this.textures.soft,color,55),whiteCore=donutSprite(group,this.textures.head,0xffffff,22);core.alpha=whiteCore.alpha=0;
  const targets=[...new Set(e.targets??[])].map(i=>{const p=this.position(i);const flight=new PIXI.Container();flight.label='donut-shot-'+i;group.addChild(flight);const tail=Array.from({length:18},()=>donutSprite(flight,this.textures.soft,0xffffff,36));const halo=donutSprite(flight,this.textures.soft,0xffffff,49),head=donutSprite(flight,this.textures.head,0xffffff,25);flight.visible=false;const target={x:p.x-origin.x,y:p.y-origin.y};return {i,...target,plan:donutFlightPlan(zero,target),flight,tail,halo,head};});
  const colors=[0xff75b7,0x57ecff,0xb7ff49,0xffe65b];
  const sprinkles=Array.from({length:28},(_,j)=>({sprite:donutSprite(front,this.textures.sprinkle,colors[j%4],12,'normal'),phase:j*2.399963,rate:.55+(j%5)*.13,r:52+j%7*4}));
  let propLight=0;const white=v=>{propLight=v;const k=1-v;wash.matrix=[k,0,0,0,v,0,k,0,0,v*.65,0,0,k,0,v*.18,0,0,0,1,0];};
  const light=(size,alpha)=>{outerGlow.width=outerGlow.height=size*1.48;outerGlow.alpha=alpha*.85;aura.width=aura.height=size;aura.alpha=alpha*.95;bloom.width=bloom.height=size*.55;bloom.alpha=alpha*.5;};
  const scatter=(time,expansion,alpha)=>{for(const p of sprinkles){const a=p.phase+time*p.rate,z=Math.sin(a),s=p.sprite,parent=z<0?back:front;if(s.parent!==parent)parent.addChild(s);s.position.set(Math.cos(a)*(p.r+expansion),z*(p.r*.65+expansion*.6)-8*Math.sin(time+p.phase));s.rotation=a*.7+p.phase;s.width=(9+4*(z+1)/2);s.height=15+6*(z+1)/2;s.alpha=alpha*(.45+.55*(z+1)/2);}};
  const pose=(yaw,pitch,roll,size,shine)=>{if(prop){prop.draw(yaw,pitch,-roll,propLight);body.scale.set(size);body.rotation=0;return;}const points=[];for(const [x,y]of [[-68,-68],[68,-68],[68,68],[-68,68]]){const xx=x*Math.cos(yaw),zz=-x*Math.sin(yaw),yy=y*Math.cos(pitch)-zz*Math.sin(pitch),z=y*Math.sin(pitch)+zz*Math.cos(pitch),k=350/(350-z);points.push(xx*k,yy*k);}art.setCorners(...points);reflection.setCorners(...points);body.scale.set(size);body.rotation=roll;reflectionMask.x=-110+220*shine;reflectionMask.y=0;};
  const mark=alpha=>{marks.clear();marksSoft.clear();for(const p of targets){marksSoft.roundRect(p.x-43,p.y-43,86,86,9).stroke({color,width:9,alpha:alpha*.5});marks.roundRect(p.x-43,p.y-43,86,86,9).stroke({color,width:2.5,alpha:alpha*.6});}};
  const fire=ms=>{for(const p of targets){const t=(ms-p.plan.delay)/p.plan.duration;p.flight.visible=t>=0&&t<1.25;if(t>=0&&!p.sounded){p.sounded=true;this.sound('donutShot',p.i);}if(!p.flight.visible)continue;const q=donutFlightPoint(p.plan,t),a=t<=1?1:Math.max(0,1-(t-1)/.25);p.head.position.set(q.x,q.y);p.halo.position.copyFrom(p.head.position);p.head.alpha=a;p.halo.alpha=a*.65;
   p.tail.forEach((s,j)=>{const u=t-(j+1)*.026,sample=donutFlightPoint(p.plan,u);s.visible=u>0;s.position.set(sample.x,sample.y);s.width=s.height=34-j*1.15;s.alpha=(1-j/18)**1.3*.32*a;});
  }};
  let stopSpin=()=>{};try{this.sound('donutAppear');
   group.vfxPhase='appear';await this.animate(DONUT_TIMING.appear,t=>{
    const s=t<.58?.12+1.24*Math.sin(t/.58*Math.PI/2):1.36-.24*(t-.58)/.42;
    body.y=-12*Math.sin(Math.PI*t);pose(.95*(1-t),-.28,-.38+.5*(1-(1-t)**3),s,t);white((1-t)**2*.72);
    const pulse=Math.sin(Math.PI*Math.min(1,t*1.3));light(230+100*Math.sin(Math.PI*t),.55+.65*pulse);scatter(t*1.5,12+18*pulse,.9*Math.sin(Math.PI*t));mark(Math.min(1,t*3));
    birthRing.clear();birthRays.clear();const r=22+133*(1-(1-t)**2),fade=Math.sin(Math.PI*t)*(1-t);
    birthRing.circle(0,0,r).stroke({color:0xffdb71,width:7*(1-t)+1,alpha:fade*.85});
    for(let j=0;j<10;j++){const a=j*Math.PI/5+t*.16,len=85+(j%3)*19,dx=Math.cos(a),dy=Math.sin(a),w=5*(1-t);birthRays.poly([dx*35-dy*w,dy*35+dx*w,dx*len,dy*len,dx*35+dy*w,dy*35-dx*w]).fill({color:j%2?0xffbd4c:0xff83cf,alpha:fade*.8});}
   });birthRing.clear();birthRays.clear();stopSpin=this.loop('donutSpin');
   group.vfxPhase='hover';await this.animate(DONUT_TIMING.hover,t=>{body.y=-5*Math.sin(t*Math.PI);pose(Math.sin(t*Math.PI*2)*.72,-.25+.18*Math.sin(t*Math.PI),.12-.28*Math.sin(t*Math.PI),1.12+.035*Math.sin(t*Math.PI),.2+.6*t);white(0);light(260+10*Math.sin(Math.PI*t),.55);scatter(1.5+t*2,7,.8);});
   group.vfxPhase='charge';await this.animate(DONUT_TIMING.charge,t=>{body.y=-3*t;pose(-.65*t,-.25+.3*t,.12-.32*t,1.12-.18*t,t);light(260+30*t,.55+.25*t);core.alpha=t;whiteCore.alpha=t;scatter(3.5+t*.7,7+5*t,.9);});
   group.vfxPhase='release';await this.animate(DONUT_TIMING.release,t=>{pose(-.65+1.15*t,.05-.3*t+.35*Math.sin(t*Math.PI),donutSpinAngle(t*DONUT_TIMING.release),.94+.76*(1-(1-t)**3)+.12*Math.sin(Math.PI*t),t);white(.22*t);light(290+30*t,.8);scatter(4.2+t*2,12+22*t,1);core.alpha=whiteCore.alpha=1-t;fire(t*DONUT_TIMING.release);mark(1-t*.25);});
   group.vfxPhase='hold';await this.animate(DONUT_TIMING.hold,t=>{fire(DONUT_TIMING.release+t*DONUT_TIMING.hold);pose(.5*Math.cos(t*Math.PI*2),-.25+.25*Math.sin(t*Math.PI),donutSpinAngle(DONUT_TIMING.release+t*DONUT_TIMING.hold),1.7-.1*t,.1+.85*t);white(.22+.15*Math.sin(t*Math.PI));light(320,.8*(1-t*.35));scatter(6.2+t*3,34+12*t,1-t*.4);mark(.75*(1-t));});
   stopSpin();group.vfxPhase='fade';
   const exitRoll=donutSpinAngle(DONUT_TIMING.release+DONUT_TIMING.hold);
   let exitSound=false;
   // A small anticipation, accelerating turn into the centre, then a candy burst.
   // Keep the flight/impact timeline intact: this starts only after the hold.
   await this.animate(DONUT_TIMING.fade,t=>{
    targets.forEach(p=>p.flight.visible=false);
    const anticipation=Math.min(1,t/.25),collapse=Math.max(0,Math.min(1,(t-.25)/.37));
    const size=t<.25?1.6+.16*Math.sin(anticipation*Math.PI/2):1.76*(1-collapse*collapse);
    pose(.5-.25*collapse,-.25+.35*collapse,exitRoll+Math.PI*2*collapse*collapse,Math.max(.001,size),1);
    body.y=-3-7*Math.sin(Math.PI*collapse);body.alpha=1;body.visible=t<.62;white(.22+.65*collapse);
    birthRing.clear();birthRays.clear();
    if(t<.62){
     light(320-170*collapse,.52+.28*collapse);
     scatter(9.2+collapse*4,46-70*collapse,.6+.4*collapse);
     core.width=core.height=55+45*collapse;core.alpha=collapse*.7;
     whiteCore.width=whiteCore.height=22+16*collapse;whiteCore.alpha=collapse*.75;
    }else{
     if(!exitSound){exitSound=true;this.sound('donutEnd');}
     const u=(t-.62)/.38,ease=1-(1-u)**3,tail=(1-u)**2;
     light(150+180*ease,.8*tail);
     core.width=core.height=100+110*ease;core.alpha=.8*tail;
     whiteCore.width=whiteCore.height=38+44*ease;whiteCore.alpha=tail;
     birthRing.circle(0,-3,18+105*ease).stroke({color:0xffd68b,width:5*(1-u)+.5,alpha:.65*tail});
     for(let j=0;j<8;j++){
      const a=j*Math.PI/4+.2,near=18+42*ease,far=near+28*(1-u),dx=Math.cos(a),dy=Math.sin(a);
      birthRays.moveTo(dx*near,dy*near-3).lineTo(dx*far,dy*far-3).stroke({color:j%2?0xff95cf:0xffecb0,width:3*(1-u)+.5,alpha:.65*tail});
     }
     for(const [j,p]of sprinkles.entries()){
      const s=p.sprite,a=p.phase+4,travel=(55+j%7*9)*ease;
      if(s.parent!==front)front.addChild(s);
      s.position.set(Math.cos(a)*(18+travel),Math.sin(a)*(18+travel)*.8-3+22*u*u);
      s.rotation=a+u*(j%2?3:-3);s.width=(5+j%3*2)*(1-.6*u);s.height=(9+j%4*2)*(1-.6*u);s.alpha=tail*.9;
     }
    }
   });
  }finally{stopSpin();group.destroy({children:true});if(prop){if(this.props.length<2)this.props.push(prop);else prop.destroy();}}
 }
}

// Presentation only. Each candy has its own translucent sugar-fragment silhouette.
const CLEAR_COLORS=['#00baff','#ff249b','#ffd21a','#59e911','#ff243b','#bf20ff'];
function clearParticlePath(g,type){
 g.beginPath();
 if(type===0){g.moveTo(-25,-21);g.lineTo(27,-12);g.lineTo(-3,28);g.closePath();}
 if(type===1){g.arc(0,0,25,-2.7,1.8);g.bezierCurveTo(-5,15,12,15,13,0);g.bezierCurveTo(13,-12,0,-15,-12,-9);g.closePath();}
 if(type===2){g.moveTo(-25,20);g.lineTo(9,-29);g.quadraticCurveTo(40,2,15,22);g.quadraticCurveTo(-3,33,-25,20);g.closePath();}
 if(type===3){g.roundRect(-22,-23,44,46,8);}
 if(type===4){g.moveTo(0,-28);g.bezierCurveTo(10,-11,26,-6,22,12);g.bezierCurveTo(18,34,-23,29,-24,8);g.bezierCurveTo(-25,-7,-9,-16,0,-28);g.closePath();}
 if(type===5){for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,r=j%2?13:29;g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}g.closePath();}
}
class SymbolClearVFX{
 constructor({parent,background,position,animate}){
  Object.assign(this,{parent,background,position,animate});
  const texture=draw=>{const c=document.createElement('canvas');c.width=c.height=128;draw(c.getContext('2d'));return PIXI.Texture.from(c);};
  this.soft=texture(g=>{const r=g.createRadialGradient(64,64,0,64,64,64);for(const [t,a]of [[0,1],[.22,.65],[.55,.2],[1,0]])r.addColorStop(t,`rgba(255,255,255,${a})`);g.fillStyle=r;g.fillRect(0,0,128,128);});
  this.fragments=Array.from({length:6},(_,type)=>texture(g=>{
   g.translate(64,64);clearParticlePath(g,type);const fill=g.createLinearGradient(-23,-26,24,29);fill.addColorStop(0,'#ffffffa0');fill.addColorStop(.35,'#ffffff35');fill.addColorStop(1,'#ffffff08');g.fillStyle=fill;g.fill();g.strokeStyle='#ffffffe0';g.lineWidth=2.4;g.shadowColor='white';g.shadowBlur=5;g.stroke();g.shadowBlur=0;
   g.beginPath();if(type===0){g.moveTo(-25,-21);g.lineTo(0,0);g.lineTo(27,-12);g.moveTo(0,0);g.lineTo(-3,28);}else if(type===2){g.moveTo(-19,17);g.lineTo(10,-20);g.moveTo(-19,17);g.lineTo(17,12);}else if(type===3){g.roundRect(-15,-16,30,32,4);}else{g.moveTo(-13,-7);g.quadraticCurveTo(-8,-20,4,-17);}g.strokeStyle='#ffffff85';g.lineWidth=1.8;g.stroke();
  }));
  // This glow never changes shape: bake the three blurred layers once.
  const cell=document.createElement('canvas');cell.width=cell.height=320;
  const c=cell.getContext('2d');c.scale(2,2);c.translate(80,80);
  c.filter='blur(24px)';c.fillStyle='rgba(255,255,255,.78)';c.beginPath();c.roundRect(-40,-40,80,80,12);c.fill();
  c.filter='blur(16px)';c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=11;c.beginPath();c.roundRect(-43,-43,86,86,11);c.stroke();
  c.filter='blur(5.2px)';c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=3.5;c.beginPath();c.roundRect(-43,-43,86,86,10);c.stroke();
  this.cellTexture=PIXI.Texture.from(cell);
 }
 sprite(parent,texture,tint,size,blend='add'){const s=new PIXI.Sprite(texture);s.anchor.set(.5);s.tint=tint;s.width=s.height=size;s.blendMode=blend;parent.addChild(s);return s;}
 async cell(i,color){
  const layer=new PIXI.Container();layer.label='clear-cell-glow';layer.eventMode='none';Object.assign(layer,this.position(i));this.background.addChild(layer);
  this.sprite(layer,this.cellTexture,color,160,'normal');
  try{await this.animate(790,t=>{layer.alpha=Math.min(1,t/.12)*(1-Math.max(0,(t-.50)/.50)**1.4);});}finally{layer.destroy({children:true});}
 }
 async hit(i,type){
  const color=CLEAR_COLORS[type],layer=new PIXI.Container();layer.label='symbol-impact-'+type;layer.eventMode='none';Object.assign(layer,this.position(i));this.parent.addChild(layer);
  const haze=this.sprite(layer,this.soft,color,104,'normal'),flash=this.sprite(layer,this.soft,0xffffff,40);
  const dust=Array.from({length:8},()=>this.sprite(layer,this.soft,color,40));
  const chips=Array.from({length:23},(_,j)=>({s:this.sprite(layer,this.fragments[type],color,40),size:(38+j%5*6)*(.9+(j*17%11)/50),a:j*2.399963+i*.37,r:24+(j*17%47),spin:(j%2?1:-1)*(.6+j%4*.3)}));
  try{await this.animate(790,t=>{
   const out=1-(1-t)**3;haze.width=haze.height=80+45*out;haze.alpha=(1-t)**1.7*.95;flash.width=flash.height=35+15*out;flash.alpha=Math.max(0,1-t*7)*.85;
   dust.forEach((s,j)=>{const a=j*2.399963,r=(14+j%4*9)*out;s.position.set(Math.cos(a)*r,Math.sin(a)*r-35*t);s.width=s.height=30+30*t;s.alpha=Math.sin(Math.PI*t)*(1-t)*.27;});
   chips.forEach(({s,a,r,spin,size},j)=>{s.position.set(Math.cos(a)*r*out,Math.sin(a)*r*.8*out-36*t*t);s.rotation=a+spin*t;s.width=size*(1-.45*t);s.height=s.width*(.76+.24*Math.cos(t*4+j));s.alpha=Math.min(1,t/.045)*(1-t)**.85;});
  });}finally{layer.destroy({children:true});}
 }
}

// Cache the alpha silhouette and its soft edge once per artwork/size/blur.
// Animated transforms and tint remain cheap sprite properties, without per-frame
// filter framebuffers for every glowing/clearing symbol.
const bakedGlows=new WeakMap();
function bakedSymbolGlow(source,baseX,baseY,blur=7){
 const texture=source.texture,frame=texture.frame,R=2;
 const width=frame.width*Math.abs(baseX),height=frame.height*Math.abs(baseY);
 const key=[width.toFixed(3),height.toFixed(3),blur].join(':');
 let cache=bakedGlows.get(texture);if(!cache)bakedGlows.set(texture,cache=new Map());
 let art=cache.get(key);
 if(!art){
  const pad=Math.ceil(blur*3+2),w=Math.ceil(width+pad*2),h=Math.ceil(height+pad*2);
  const mask=document.createElement('canvas');mask.width=w*R;mask.height=h*R;
  const m=mask.getContext('2d');m.drawImage(texture.source.resource,frame.x,frame.y,frame.width,frame.height,pad*R,pad*R,width*R,height*R);
  m.globalCompositeOperation='source-in';m.fillStyle='#fff';m.fillRect(0,0,mask.width,mask.height);
  const canvas=document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height;
  const g=canvas.getContext('2d');if(blur)g.filter=`blur(${blur*R}px)`;g.drawImage(mask,0,0);
  art={texture:PIXI.Texture.from(canvas),pad,w,h,width,height};cache.set(key,art);
 }
 const sprite=new PIXI.Sprite(art.texture);
 sprite.anchor.set((art.pad+source.anchor.x*art.width)/art.w,(art.pad+source.anchor.y*art.height)/art.h);
 sprite.glowScaleX=1/(R*Math.abs(baseX));sprite.glowScaleY=1/(R*Math.abs(baseY));
 sprite.scale.set(source.scale.x*sprite.glowScaleX,source.scale.y*sprite.glowScaleY);
 sprite.rotation=source.rotation;sprite.eventMode='none';return sprite;
}

// Keep logical coordinates/art unchanged. On sustained missed frames, lower
// only the board framebuffer density in small steps; never oscillate in-session.
class RenderBudget{
 constructor(dpr=1){this.resolution=Math.max(1,Math.min(2,dpr));this.reset();}
 reset(){this.elapsed=0;this.frames=0;this.slow=0;}
 sample(ms,active=true){
  if(!active||!Number.isFinite(ms)||ms<=0||ms>120){this.reset();return null;}
  this.elapsed+=ms;this.frames++;if(ms>24)this.slow++;
  if(this.elapsed<2000)return null;
  const overloaded=this.frames>=20&&this.elapsed/this.frames>22&&this.slow/this.frames>.25;
  this.reset();if(!overloaded||this.resolution<=1)return null;
  this.resolution=Math.max(1,this.resolution-.25);return this.resolution;
 }
}

class HoldInput {
 constructor({act,canAct=()=>true,onHeld=()=>{},onManual=()=>{},threshold=320,interval=90,setTimer=(...args)=>setTimeout(...args),clearTimer=id=>clearTimeout(id)}){Object.assign(this,{act,canAct,onHeld,onManual,threshold,interval,setTimer,clearTimer});this.sources=new Set();this.generation=0;this.active=false;}
 press(source){
  if(this.sources.has(source))return;const first=this.sources.size===0;this.sources.add(source);if(!first)return;
  const generation=++this.generation;this.onManual();if(this.canAct())this.act();
  if(generation!==this.generation||!this.sources.size)return;
  this.timer=this.setTimer(()=>{if(generation!==this.generation||!this.sources.size)return;this.active=true;this.onHeld(true);this.pulse(generation);},this.threshold);
 }
 pulse(generation){if(generation!==this.generation||!this.sources.size)return;if(this.canAct())this.act();if(generation===this.generation&&this.sources.size)this.timer=this.setTimer(()=>this.pulse(generation),this.interval);}
 release(source){this.sources.delete(source);if(!this.sources.size)this.cancel();}
 cancel(){++this.generation;this.clearTimer(this.timer);this.sources.clear();this.active=false;this.onHeld(false);}
}
function bindHoldInput(button,controller,{cancel=()=>controller.cancel(),ownsSpace=()=>true,reserveSpace=false,window:win=window,document:doc=document}={}){
 let pointerId=null;
 button?.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||button.disabled||pointerId!==null)return;e.preventDefault();pointerId=e.pointerId;button.setPointerCapture(e.pointerId);controller.press('pointer');});
 const release=e=>{if(e.pointerId!==pointerId)return;pointerId=null;controller.release('pointer');};
 button?.addEventListener('pointerup',release);button?.addEventListener('pointercancel',release);button?.addEventListener('lostpointercapture',release);
 button?.addEventListener('click',e=>{if(e.detail===0&&!button.disabled&&!controller.sources.size){controller.press('accessible');controller.release('accessible');}});
 // Reserve both edges: Space must never activate a focused HUD/modal button.
 win.addEventListener('keydown',e=>{if(e.code!=='Space'||!ownsSpace())return;const t=e.target;if(!reserveSpace&&t!==button&&(t.isContentEditable||t.closest?.('input,textarea,select,button,a,[contenteditable=true],[role=dialog],dialog')))return;e.preventDefault();if(e.repeat)return;controller.press('space');},reserveSpace);
 win.addEventListener('keyup',e=>{if(e.code==='Space'){controller.release('space');if(e.target===button||(reserveSpace&&ownsSpace()))e.preventDefault();}},reserveSpace);
 const cancelAll=()=>{pointerId=null;cancel();};win.addEventListener('blur',cancelAll);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)cancelAll();});
 return controller;
}

// One 1920 x 1080 landscape composition. Fit as a unit; never cover-crop it.
function mountLayout(element){
 let frame,previousBlocked;
 const rotate=document.getElementById('rotate-screen');
 const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
  const viewport=window.visualViewport,insets=getComputedStyle(document.body);
  const left=parseFloat(insets.paddingLeft)||0,top=parseFloat(insets.paddingTop)||0;
  const w=Math.max(1,(viewport?.width??innerWidth)-left-(parseFloat(insets.paddingRight)||0));
  const h=Math.max(1,(viewport?.height??innerHeight)-top-(parseFloat(insets.paddingBottom)||0));
  const blocked=w<h,scale=Math.min(1,w/1920,h/1080);
  element.dataset.layout='landscape';element.dataset.orientationBlocked=String(blocked);
  document.body.dataset.orientation=blocked?'portrait':'landscape';if(rotate)rotate.hidden=!blocked;
  element.style.setProperty('--stage-scale',String(scale));
  element.style.left=(left+(w-1920*scale)/2+(viewport?.offsetLeft||0))+'px';
  element.style.top=(top+(h-1080*scale)/2+(viewport?.offsetTop||0))+'px';
  if(previousBlocked!==blocked){previousBlocked=blocked;window.dispatchEvent(new CustomEvent('gameorientationchange',{detail:{blocked}}));}
 });};
 window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);document.fonts?.ready.then(resize);resize();
 return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);};
}


async function startGame(){
const $=s=>document.querySelector(s), money=n=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:state?.decimals??2,maximumFractionDigits:state?.decimals??2}):'—';
mountLayout($('#game'));
const orientationBlocked=()=>$('#game').dataset.orientationBlocked==='true';
const sceneReady=prepareTask('scene',async()=>{await Promise.all([mountKingdom($('#game')),...[...document.images].map(img=>img.decode())]);}).then(()=>null,error=>error);
const params=new URLSearchParams(location.search),serverMode=params.get('mode')!=='demo';
const visualPreview=!serverMode&&params.get('preview')==='vfx';
const KEY='sweet-cascade-v1';let saved;if(!visualPreview)try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}
if(visualPreview)$('#connection').textContent='● Local demo · VFX preview · No RGS';
const rgs=serverMode?new ServerRGS({onFault:message=>{if(!startupComplete)failStartup(message==='Awarded moves need an initial board context from RGS. Reset was not sent.'?'RGS did not provide the board context for your free moves. Waiting for a server fix.':'Connection could not be prepared. Please reload.');else queueMicrotask(showConnectionFault);}}):new DemoRGS(saved),sound=new Sound();let state=rgs.snapshot(),busy=serverMode,held=false,auto=0,speed=1,selected=null,displayWin=state.bonus?.win||0,displayMult=state.bonus?.mult||1,lastInput=Date.now();
let startupComplete=false,roundRunning=false,fastRequested=false,persistentTurbo=false,autoTimer=null;
const sessionReady=prepareTask('session',async()=>serverMode?await rgs.initialize():rgs.snapshot()).then(value=>({value}),error=>({error}));
await Promise.all([prepareTask('font',()=>Promise.all([document.fonts.load('700 28px Alexandria'),document.fonts.load('400 30px LilitaOne')])),prepareTask('audio',()=>sound.loadSamples())]);
const sceneError=await sceneReady;if(sceneError)throw sceneError;
const renderBudget=new RenderBudget(devicePixelRatio);const app=new PIXI.Application();await prepareTask('renderer',()=>app.init({width:711,height:711,backgroundAlpha:0,antialias:true,resolution:renderBudget.resolution,autoDensity:true,preference:'webgl'}));$('#board').appendChild(app.canvas);
const stage=new PIXI.Container();app.stage.addChild(stage);stage.position.set(5.4,5.4);const frame=new PIXI.Sprite(frameTexture());frame.position.set(-5.4,-5.4);stage.addChild(frame);const bg=new PIXI.Graphics();stage.addChild(bg);
for(let i=0;i<49;i++){const x=20+i%7*94,y=20+Math.floor(i/7)*94;bg.roundRect(x,y,92,92,9).fill((Math.floor(i/7)+i%7)%2?0x1b2742:0x142039).stroke({color:0x34405e,width:1});}
const hoverCell=new PIXI.Graphics().roundRect(-45,-45,90,90,8).fill(0x405b89);hoverCell.label='cell-hover-fill';hoverCell.alpha=0;hoverCell.eventMode='none';bg.addChild(hoverCell);let hoveredCell=null,hoverOpacity=0;
const pieces=new PIXI.Container(),fx=new PIXI.Container();pieces.label="board-pieces";fx.label="board-effects";stage.addChild(pieces,fx);const textures=Array.from({length:6},(_,i)=>candyTexture(i)),special={bomb:specialTexture('bomb'),ice:specialTexture('ice'),rocket:Array.from({length:4},(_,i)=>specialTexture('rocket',i))};const nodes=new Map();let visual=[];const anims=[],particles=[];
const candyBounds=[],iceTextures=[],boosterArt={};
await prepareTask('boosters',async()=>{for(const [kind,url]of [['bomb','public/bomb-v11.png'],['rocket','public/rocket-v11-final.png']]){const texture=await PIXI.Assets.load(url),w=texture.width,h=texture.height,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.source.resource,0,0);const pixels=ctx.getImageData(0,0,w,h).data;let left=w,top=h,right=0,bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}boosterArt[kind]={texture,w,h,cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};}});
try{const atlas=await prepareTask('ice',()=>PIXI.Assets.load('public/ice.png'));for(const [i,frame]of [0,2].entries())iceTextures[i]=new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(frame*512,0,512,512)});}catch(e){throw e;}
iceTextures[1]=await prepareTask('damaged-ice',()=>PIXI.Assets.load('public/ice-damaged-v2.png'));
function symbolGlow(n,color=0xffefac,alpha=.65,spread=1.1,blur=7){const g=bakedSymbolGlow(n.sprite,n.baseSpriteScale,n.baseSpriteScaleY,blur);g.tint=color;g.glowSpread=spread;g.blendMode="add";g.alpha=alpha;n.addChildAt(g,0);(n.glows??=[]).push(g);return g;}
function signature(c){return [c.kind,c.color,c.hp,c.magic,c.mult,c.dir].join(':');}
try {const atlas=await prepareTask('candies',()=>PIXI.Assets.load('public/candies.png'));const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(atlas.source.resource,0,0);for(let i=0;i<6;i++){const ox=i%3*512,oy=Math.floor(i/3)*512;const pixels=ctx.getImageData(ox,oy,512,512).data;let left=512,top=512,right=0,bottom=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}candyBounds[i]={cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};textures[i]=new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(ox,oy,512,512)});}}catch(e){throw e;}
try{const candy=await prepareTask('pink',()=>PIXI.Assets.load('public/pink-candy.png'));const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(candy.source.resource,0,0,512,512);const data=ctx.getImageData(0,0,512,512).data;let left=512,top=512,right=0,bottom=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}textures[1]=candy;candyBounds[1]={cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};}catch(e){throw e;}
const pos=i=>({x:66+i%7*94,y:66+Math.floor(i/7)*94});
const swipeHint=new SwipeHint(stage,pos);
let hintSoundPlayed=false;
document.addEventListener('click',e=>{if(e.target.closest('#settings,#history,#rules,#auto,#bonus,#close,[data-count],[data-mode]')){sound.unlock();sound.play('click');}},true);
const symbolHint=new SymbolHint();
const symbolClearVFX=new SymbolClearVFX({parent:fx,background:bg,position:pos,animate});
let boardWaveElapsed=-1,boardWaveOrigin={column:3,row:3};
async function settleBoard(origin=boardWaveOrigin){boardWaveOrigin={...origin};try{await animate(BOARD_WAVE_MS,t=>{boardWaveElapsed=t*BOARD_WAVE_MS;});}finally{boardWaveElapsed=-1;}}
const boosterVFX=new BoosterVFX({parent:fx,position:pos,node:i=>nodes.get(visual[i]?.id),art:kind=>boosterArt[kind],animate,pause,sound:name=>sound.play(name),loop:name=>sound.loop(name)});
const donutTexture=await prepareTask('donut',()=>PIXI.Assets.load('public/donut-v1.png'));
const donutVFX=new DonutVFX({parent:fx,position:pos,texture:donutTexture,animate,sound:(name,step)=>sound.play(name,step),loop:name=>sound.loop(name)});
document.addEventListener('pointerdown',()=>swipeHint.reset(),{capture:true});
document.addEventListener('keydown',()=>swipeHint.reset(),{capture:true});
document.addEventListener('pointerdown',()=>symbolHint.reset(),{capture:true});
document.addEventListener('keydown',()=>symbolHint.reset(),{capture:true});
function tween(obj,to,ms=200,ease=t=>1-(1-t)**3){const from={};for(const k in to)from[k]=obj[k];return new Promise(resolve=>anims.push({obj,to,from,ms:ms/speed,t:0,ease,resolve}));}
function pause(ms){return tween({v:0},{v:1},ms);}
function animate(ms,update){let value=0;const clock={get progress(){return value;},set progress(v){value=v;update(v);}};update(0);return tween(clock,{progress:1},ms,t=>t);}
const multiplierFlights=new MultiplierFlights({target:()=>$('#mult-value'),animate,onArrival:total=>{displayMult=total;hud();sound.play('multiplier');}});
function flyMultiplier(i,value,total){const r=app.canvas.getBoundingClientRect(),p=stage.toGlobal(pos(i)),from={x:r.left+p.x*r.width/711,y:r.top+p.y*r.height/711};return multiplierFlights.fly({from,value,total,fontSize:Math.max(18,35*r.width/711)});}
const magicFlights=new MagicFlights({animate}),magicImages=new Map();
function flyMagic(i,c,total){
 const r=app.canvas.getBoundingClientRect(),p=stage.toGlobal(pos(i)),from={x:r.left+p.x*r.width/711,y:r.top+p.y*r.height/711};
 if(!magicImages.has(c.color)){
  const texture=textures[c.color],frame=texture.frame,b=candyBounds[c.color],canvas=document.createElement('canvas');canvas.width=canvas.height=160;
  const ctx=canvas.getContext('2d'),side=b?.size??frame.width;
  ctx.drawImage(texture.source.resource,frame.x+(b?b.cx-side/2:0),frame.y+(b?b.cy-side/2:0),side,side,0,0,160,160);
  magicImages.set(c.color,canvas.toDataURL());
 }
 const slot=Math.max(0,Math.min(2,total-1));
 return magicFlights.fly({from,url:magicImages.get(c.color),size:Math.max(28,80*r.width/711),target:()=>$('#meter').getClientRects().length?$('#meter').querySelectorAll('.meter-target')[slot]:$('#meter-title'),onArrival:()=>{state.meter=total;hud();sound.play('magic');}});
}
function label(text,size=28,color='#ffffff'){const t=new PIXI.Text({text,style:{fontFamily:'LilitaOne',fontSize:size,fontWeight:'400',fill:color}});t.anchor.set(.5);return t;}
function multiplierLabel(text,size=36,muted=false){
 const t=new PIXI.Text({text,style:{fontFamily:'LilitaOne',fontSize:size,fontWeight:'400',fill:muted?'#cbdde9':'#ffe69b',stroke:{color:muted?'#3f5278':'#63346f',width:muted?3.5:4.5,join:'round'},dropShadow:{color:muted?'#293c60':'#44204d',blur:0,distance:muted?1.5:2.5,angle:Math.PI/2,alpha:muted?.3:.7},padding:5}});
 t.anchor.set(.5);if(t.width>76)t.scale.set(76/t.width);t.baseLabelScale=t.scale.x;return t;
}
const iceMarkLayer=new PIXI.Container();iceMarkLayer.label='ice-multiplier-marks';iceMarkLayer.eventMode='none';stage.addChildAt(iceMarkLayer,stage.getChildIndex(fx));
const iceMarks=new IceMultiplierMarks({parent:iceMarkLayer,position:pos,label:multiplierLabel});
function make(c){const n=new PIXI.Container();n.cid=c.id;n.signature=signature(c);n.kind=c.kind;n.color=c.color;let texture=c.kind==='candy'?textures[c.color]:c.kind==='rocket'?special.rocket[c.dir]:c.kind==='ice'&&iceTextures.length?iceTextures[c.hp<=1?1:0]:special[c.kind];const s=new PIXI.Sprite(texture||textures[c.color]);s.anchor.set(.5);s.width=s.height=c.kind==='ice'&&iceTextures.length?104:80;if(c.kind==='candy'&&candyBounds[c.color]){const b=candyBounds[c.color];s.anchor.set(b.cx/512,b.cy/512);s.width=s.height=80*512/b.size*(c.color===1?.92:1);}if(boosterArt[c.kind]){const art=boosterArt[c.kind];s.texture=art.texture;s.anchor.set(art.cx/art.w,art.cy/art.h);s.width=84*art.w/art.size;s.height=84*art.h/art.size;if(c.kind==='rocket')s.rotation=c.dir*Math.PI/2;}n.baseSpriteScale=s.scale.x;n.baseSpriteScaleY=s.scale.y;n.baseSpriteRotation=s.rotation;n.phase=(Number(c.id)*2.399963)||Math.random()*6.28;n.idleRate=.85+((Number(c.id)*.618)%1)*.35;n.addChild(s);n.sprite=s;n.eventMode='static';n.cursor=c.kind==='ice'?'default':'pointer';n.on('pointerdown',e=>down(n.index,e));n.on('pointerup',e=>up(n.index,e));if(c.kind==='bomb'||c.kind==='rocket'){const aura=symbolGlow(n,0xffc75a,.6,1.16,6),rim=symbolGlow(n,0xfff0b0,.72,1.055,1.8);aura.label='booster-idle-aura';rim.label='booster-idle-rim';}if(c.magic)n.magicRing=symbolGlow(n,0xffdf73,.9,1.22,3.5);if(c.mult){const b=multiplierLabel('×'+c.mult,c.kind==='ice'?36:35,c.kind==='ice');b.position.set(0,0);n.multiplierLabel=b;if(c.kind==='ice'){const damage=c.hp<=1?1:0;b.visible=damage>0;b.alpha=.64;n.addChild(b);s.alpha=damage===0?1:.94;}else n.addChild(b);}if(c.kind==='ice'&&!iceTextures.length&&c.hp<=1){const cracks=new PIXI.Graphics().moveTo(-25,-42).lineTo(2,-9).lineTo(-16,8).lineTo(22,40).stroke({color:0xd8fbff,width:3});n.addChild(cracks);}pieces.addChild(n);nodes.set(c.id,n);return n;}

function updateHintShine(n,phase){
 if(phase<0||busy||n.clearing||n.whiteFilter){if(n.hintShine)n.hintShine.visible=false;if(n.hintMask){n.hintMask.visible=false;n.hintMask.clear();}return;}
 if(!n.hintShine){const sprite=new PIXI.Sprite(n.sprite.texture);sprite.anchor.copyFrom(n.sprite.anchor);const white=new PIXI.ColorMatrixFilter();white.matrix=[0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0];sprite.filters=[white];sprite.blendMode='add';const mask=new PIXI.Graphics();n.addChild(mask,sprite);sprite.mask=mask;n.hintShine=sprite;n.hintMask=mask;}
 const shine=n.hintShine;shine.visible=true;n.hintMask.visible=true;shine.position.copyFrom(n.sprite.position);shine.scale.copyFrom(n.sprite.scale);shine.rotation=n.sprite.rotation;shine.alpha=.8*Math.sin(Math.PI*phase);
 const x=-95+190*phase;n.hintMask.clear().poly([x-28,-80,x-5,-80,x+55,80,x+32,80]).fill(0xffffff);
}
function draw(board){const ids=new Set(board.filter(Boolean).map(c=>c.id));for(const[id,n]of nodes)if(!ids.has(id)){n.destroy({children:true});nodes.delete(id);}board.forEach((c,i)=>{if(!c)return;let n=nodes.get(c.id);if(n&&n.signature!==signature(c)){n.destroy({children:true});nodes.delete(c.id);n=null;}if(!n)n=make(c);n.index=i;Object.assign(n,pos(i));});visual=clone(board);iceMarks.sync(board,nodes);}
const boardMask=new PIXI.Graphics().roundRect(20,20,658,658,8).fill(0xffffff);stage.addChild(boardMask);pieces.mask=boardMask;
async function fall(board){
 const ids=new Set(board.filter(Boolean).map(c=>c.id));for(const[id,n]of nodes)if(!ids.has(id)){n.destroy({children:true});nodes.delete(id);}
 const jobs=[],newCount=Array(7).fill(0),ranks=Array(7).fill(0);
 board.forEach((c,i)=>{if(!nodes.has(c.id))newCount[i%7]++;});
 board.forEach((c,i)=>{
  let n=nodes.get(c.id),p=pos(i),col=i%7;
  if(n&&n.signature!==signature(c)){const previousPosition={x:n.x,y:n.y};n.destroy({children:true});nodes.delete(c.id);n=make(c);Object.assign(n,previousPosition);}
  if(!n){n=make(c);n.x=p.x;n.y=66-(newCount[col]-ranks[col]++)*94;}
  n.index=i;const distance=Math.abs(n.y-p.y);
  if(distance>1)jobs.push((async()=>{
   await pause(col*5);const duration=Math.min(280,100+Math.sqrt(distance)*3.6),fromY=n.y,impact=landingImpact(distance);
   await animate(duration,t=>{const stretch=t*t*impact;n.y=fromY+(p.y-fromY)*t*t-40*.22*stretch;n.scale.set(1-.14*stretch,1+.22*stretch);});
   // Falling is silent: the swipe belongs to the player's move, not each cascade.
   try{await animate(LANDING_MS,t=>{const pose=landingPose(t*LANDING_MS,impact,n.phase);n.scale.set(pose.sx,pose.sy);n.y=p.y+pose.y;n.rotation=pose.rotation;});}
   finally{n.scale.set(1);n.rotation=0;n.y=p.y;}
  })());
 });
 await Promise.all(jobs);visual=clone(board);iceMarks.sync(board,nodes);
}
function burst(i,color,count=16){let p=pos(i);for(let k=0;k<count;k++){const g=new PIXI.Graphics(),r=2+Math.random()*4;const tint=k%5===0?0xffffff:color;if(k%5===0){g.moveTo(0,-r*2).lineTo(r*.5,-r*.5).lineTo(r*2,0).lineTo(r*.5,r*.5).lineTo(0,r*2).lineTo(-r*.5,r*.5).lineTo(-r*2,0).lineTo(-r*.5,-r*.5).closePath().fill(tint);}else g.circle(0,0,r).fill(tint);g.circle(0,0,r*2.5).fill({color:tint,alpha:.11});g.x=p.x;g.y=p.y;g.blendMode='add';fx.addChild(g);const a=Math.random()*Math.PI*2,v=65+Math.random()*155;particles.push({g,vx:Math.cos(a)*v,vy:Math.sin(a)*v-65,life:.45+Math.random()*.4,total:.85});}}
function cellGlow(i){const c=visual[i];return symbolClearVFX.cell(i,c?.kind==='ice'?0xb7edff:CLEAR_COLORS[c?.color]??0xffdc86);}
async function dissolveSymbol(i,onImpact=()=>{},quick=false){
 const shrink=quick?85:270,rebound=quick?40:110,fade=quick?80:115;
 const c=visual[i],n=nodes.get(c?.id);if(!n)return;iceMarks.hide(i);n.clearing=true;updateHintShine(n,-1);if(n.hintShine){n.hintShine.mask=null;n.hintShine.destroy();n.hintMask.destroy();n.hintShine=n.hintMask=null;}
 cellGlow(i);n.white={v:0};n.whiteFilter=new PIXI.ColorMatrixFilter();n.whiteBlur=new PIXI.BlurFilter({strength:0,quality:1});n.sprite.filters=[n.whiteFilter,n.whiteBlur];
 const color=c.kind==='ice'?0xb7edff:CLEAR_COLORS[c.color]??0xffdc86;
 const halo=symbolGlow(n,color,0,1.32,9),rim=symbolGlow(n,color,0,1.13,3.4);halo.blendMode='normal';rim.blendMode='add';halo.label='clear-color-halo';rim.label='clear-color-rim';
 await Promise.all([tween(n.scale,{x:.5,y:.5},shrink,t=>t*t),tween(n.white,{v:1},shrink),tween(halo,{alpha:.95},Math.min(200,shrink)),tween(rim,{alpha:.8},shrink)]);
 await tween(n.scale,{x:.64,y:.64},rebound,t=>1-(1-t)**2);
 if(c.kind==='candy')symbolClearVFX.hit(i,c.color);else{popFlash(i,color);burst(i,color,c.kind==='ice'?36:32);}
 onImpact(c);
 await Promise.all([tween(n.scale,{x:.02,y:.02},fade,t=>t*t),tween(n,{alpha:0},fade)]);
}
function popFlash(i,color){const g=new PIXI.Graphics();for(let r=40;r>0;r-=4)g.circle(0,0,r).fill({color:r<14?0xffffff:color,alpha:r<14?.7:.1});Object.assign(g,pos(i));g.blendMode='add';fx.addChild(g);g.scale.set(.1);tween(g.scale,{x:1.5,y:1.5},100).then(()=>tween(g.scale,{x:.2,y:.2},180));tween(g,{alpha:0},330).then(()=>g.destroy());}
function float(text,i,color='#ffffff'){const isMultiplier=text.startsWith('×'),muted=isMultiplier&&visual[i]?.kind==='ice';let t=isMultiplier?multiplierLabel(text,36,muted):label(text,30,color);if(muted)t.alpha=.7;Object.assign(t,pos(i));fx.addChild(t);tween(t,{y:t.y-70,alpha:0},800).then(()=>t.destroy());}
async function shuffleBoard(board){sound.play('shuffle');float('SHUFFLE',24);const moving=()=>[...nodes.values()].filter(n=>n.kind!=='ice');await Promise.all(moving().map(n=>Promise.all([tween(n,{x:350,y:350,rotation:Math.PI,alpha:0},400),tween(n.scale,{x:.1,y:.1},400)])));draw(board);for(const n of moving()){n.rotation=0;n.scale.set(.1);n.alpha=0;}await Promise.all(moving().map(n=>Promise.all([tween(n.scale,{x:1,y:1},300),tween(n,{alpha:1},250)])));}
async function effect(e){return e.kind==='donut'?donutVFX.play({...e,tint:palette[e.color]??palette[0]}):boosterVFX.play(e);}
function hud(){const b=state.bonus,award=state.freeRounds;$('#balance').textContent=money(state.balance);$('#bet').textContent=money(state.bet);$('#win').textContent=money(displayWin);$('#mult-value').textContent='×'+displayMult;$('#win-label').textContent=b?'BONUS WIN':'WIN';$('#mode').textContent=b?'FROSTED FACTORY':({base:'NORMAL PLAY',luck:'EXTRA LUCK · ×2',enhanced:'ENHANCED MOVES · ×50',mayhem:'MULTI MAYHEM · ×1000'}[state.mode]);$('#meter-title').textContent=b?'MOVES LEFT: '+b.moves:'ICE BONUS';$('#moves-label').textContent=b?'Magic candy = +1 move':'Collect 3 magic candies';$('#bonus-progress').hidden=!!(b||award);const collected=Math.max(0,Math.min(3,Number(state.meter)||0));$('#meter-fill').style.width=(collected/3*100)+'%';$('#meter').setAttribute('aria-valuenow',String(collected));$('#meter-count').textContent=collected+' / 3';$('#game').classList.toggle('bonus-active',!!b);for(const id of ['minus','plus','bonus'])$('#'+id).disabled=busy||!!b;if(serverMode){for(const id of ['minus','plus','auto'])$('#'+id).disabled=busy||!rgs.playable||(id!=='auto'&&!!(b||award));$('#bonus').disabled=true;$('#bonus').title='Not available in this RGS version';$('#mult').style.visibility='visible';if(b||award){$('#win-label').textContent='LAST MOVE WIN';}$('#connection').textContent=state.bonus?.awaitingCompletion?'● Bonus end awaiting server verification':state.serverWarning|| (rgs.playable?'● Test server · '+(state.currency||'credits'):(rgs.transport.fault?'● RGS session stopped':'● Connecting…'));}if(award){$('#meter-title').textContent='FREE MOVES: '+award.remaining+(b?' · ICE: '+b.moves:'');$('#moves-label').textContent=(award.completeTotal?'TOTAL WON ':'WON SINCE RELOAD ')+(state.currency?state.currency+' ':'')+money(award.knownWin);$('#minus').disabled=$('#plus').disabled=true;}$('#bet-open').disabled=busy||!!(b||award)||(serverMode&&!rgs.playable);$('#bet-open').setAttribute('aria-label','Choose bet, current '+money(state.bet));$('#auto').classList.toggle('active',auto>0);$('#auto').setAttribute('aria-pressed',String(auto>0));$('#auto').title=auto?'Remaining: '+auto:'Autoplay';}
function persist(){if(serverMode||visualPreview)return;localStorage.setItem(KEY,JSON.stringify(rgs.snapshot()));}
let toastTimer;function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function updateSpeed(){speed=persistentTurbo||held||fastRequested?1.8:1;}
const hold=bindHoldInput(null,new HoldInput({act:()=>{if(roundRunning){if(!hold.active)fastRequested=true;updateSpeed();}else play();},canAct:()=>startupComplete&&!orientationBlocked()&&!document.hidden&&!$('#dialog').open&&(!serverMode||rgs.transport.healthy)&&(roundRunning||(!busy&&(!serverMode||rgs.playable))),onHeld:value=>{held=value;updateSpeed();},onManual:()=>{auto=0;clearTimeout(autoTimer);hud();}}),{reserveSpace:true,ownsSpace:()=>true,cancel:()=>{stop();cancelDrag();}});
function stop(){hold.cancel();held=false;auto=0;fastRequested=false;updateSpeed();clearTimeout(autoTimer);hud();}
function modal(html){swipeHint.reset();stop();$('#dialog-content').innerHTML=html;$('#dialog').showModal();}
function close(){sound.cancelCelebration();$('#dialog').close();lastInput=Date.now();}$('#close').onclick=close;$('#dialog').addEventListener('close',()=>sound.cancelCelebration());
document.addEventListener('pointerdown',()=>sound.unlock(),{once:true});
let pointer=null;
function restoreDrag(d=pointer){if(!d)return;for(const i of [d.i,d.neighbor]){const n=nodes.get(visual[i]?.id);if(n)Object.assign(n,pos(i));}}
function cancelDrag(){if(!pointer)return;restoreDrag();pointer=null;select(null);}
window.addEventListener('gameorientationchange',e=>{if(e.detail.blocked){stop();cancelDrag();swipeHint.reset();symbolHint.reset();}});
function down(i,e){if(orientationBlocked()||busy||(serverMode&&!rgs.playable)||$('#dialog').open||!visual[i]||visual[i]?.kind==='ice')return;sound.unlock();lastInput=Date.now();pointer={i,x:e.global.x,y:e.global.y,target:null,moved:false,second:selected!==null&&selected!==i?selected:null};select(i);}
function drag(e){if(!pointer||busy)return;const d=pointer,dx=e.global.x-d.x,dy=e.global.y-d.y;if(Math.hypot(dx,dy)<8&&!d.moved)return;d.moved=true;const horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy;const j=d.i+(horizontal?Math.sign(delta):Math.sign(delta)*7);const valid=j>=0&&j<49&&Math.abs(j%7-d.i%7)+Math.abs(Math.floor(j/7)-Math.floor(d.i/7))===1&&visual[j]?.kind!=='ice';if(valid&&!d.swishPlayed){sound.play('swap');d.swishPlayed=true;}d.target=valid&&Math.abs(delta)>32?j:null;if(d.neighbor!==undefined&&d.neighbor!==j){const old=nodes.get(visual[d.neighbor]?.id);if(old)Object.assign(old,pos(d.neighbor));}d.neighbor=valid?j:undefined;const n=nodes.get(visual[d.i]?.id),origin=pos(d.i);if(!n)return;const amount=valid?Math.min(94,Math.abs(delta)):Math.min(18,Math.abs(delta)*.2);n.x=origin.x+(horizontal?Math.sign(delta)*amount:0);n.y=origin.y+(horizontal?0:Math.sign(delta)*amount);if(valid){const other=nodes.get(visual[j]?.id),dest=pos(j),progress=Math.min(1,amount/70);other.x=dest.x+(origin.x-dest.x)*progress;other.y=dest.y+(origin.y-dest.y)*progress;}pieces.setChildIndex(n,pieces.children.length-1);}
function up(i,e){if(!pointer||busy)return;const d=pointer;if(e)drag(e);const target=d.moved?d.target:d.second;pointer=null;select(null);if(target!==null){play(d.i,target,d.swishPlayed===true);}else{restoreDrag(d);if(!d.moved)select(d.i);}}
app.stage.eventMode='static';app.stage.hitArea=new PIXI.Rectangle(0,0,700,700);app.stage.on('globalpointermove',e=>{const col=Math.floor((e.global.x-25.4)/94),row=Math.floor((e.global.y-25.4)/94);hoveredCell=col>=0&&col<7&&row>=0&&row<7?row*7+col:null;drag(e);});app.canvas.addEventListener('pointerleave',()=>{hoveredCell=null;});app.stage.on('pointerup',e=>{if(pointer)up(pointer.i,e);});app.stage.on('pointerupoutside',cancelDrag);app.canvas.addEventListener('pointercancel',cancelDrag);
function select(i){if(i!==null&&i!==selected)sound.play('select');selected=i;}
async function play(a,b,swishPlayed=false){if(orientationBlocked()||!startupComplete||busy||(serverMode&&!rgs.playable)||pointer||$('#dialog').open)return;sound.unlock();sound.cancelCelebration();sound.cascade=0;lastInput=Date.now();if(a===undefined){const m=serverMode?rgs.moves():moves(state.board);if(!m.length){stop();toast('No moves available. Reload to start a new test session.');return;}[a,b]=m[Math.floor(Math.random()*m.length)];}if(!Number.isInteger(a)||!Number.isInteger(b)||!visual[a]||!visual[b]||visual[a].kind==='ice'||visual[b].kind==='ice'||Math.abs(a%7-b%7)+Math.abs(Math.floor(a/7)-Math.floor(b/7))!==1){restoreDrag({i:a,neighbor:b});return;}busy=true;roundRunning=true;swipeHint.reset();symbolHint.reset();for(const n of nodes.values())updateHintShine(n,-1);select(null);hud();$('#message').style.opacity=0;
 try{let before=rgs.snapshot(),result;const previewSwap=serverMode;
  try{const response=rgs.play(a,b,crypto.randomUUID(),state.version);
   if(previewSwap){if(!swishPlayed){sound.play('swap');swishPlayed=true;}const na=nodes.get(visual[a].id),nb=nodes.get(visual[b].id),pa=pos(a),pb=pos(b);
    const distance=Math.max(Math.hypot(na.x-pb.x,na.y-pb.y),Math.hypot(nb.x-pa.x,nb.y-pa.y));
    const preview=distance>1?Promise.all([tween(na,pb,165*distance/94),tween(nb,pa,165*distance/94)]):Promise.resolve();
    [result]=await Promise.all([response,preview]);
   }else result=await response;
  }catch(e){if(!serverMode)rgs.s=before;throw e;}
  if(!before.bonus){iceMarks.clear();iceMarks.sync(visual,nodes);}
  if(!result.accepted){sound.play('invalid');if(result.rejectionReason==='not-in-server-helper')toast('This move is not in the server’s available moves.');const na=nodes.get(visual[a]?.id),nb=nodes.get(visual[b]?.id);if(na&&nb){if(!previewSwap)await Promise.all([tween(na,pos(b),110),tween(nb,pos(a),110)]);await Promise.all([tween(na,pos(a),150),tween(nb,pos(b),150)]);}return;}
  persist();state.balance=serverMode?result.state.balance:before.balance-(before.bonus?0:before.bet*({base:1,luck:2,enhanced:50,mayhem:1000}[before.mode]));if(auto&&!before.bonus)auto--;hud();
  const waveAfter=cascadeWaveAfter(result.events),collectionFlights=[];let pendingMult=0,pendingMagic=0,plannedMult=displayMult,plannedMeter=state.meter;
  for(const [eventIndex,e] of result.events.entries()){if(e.type==='properties'){draw(e.board);}if(e.type==='progress'){if(!pendingMult&&!pendingMultiplierCollection(result.events,eventIndex)){if(e.mult>displayMult)sound.play('multiplier');displayMult=e.mult;}if(!pendingMagic&&!pendingMagicCollection(result.events,eventIndex)){state.meter=e.meter;plannedMeter=e.meter;}hud();}if(e.type==='swap'){const swapA=e.a??a,swapB=e.b??b;if(!swishPlayed)sound.play('swap');if(state.bonus&&Number.isInteger(e.moves))state.bonus.moves=e.moves;hud();let na=nodes.get(visual[swapA]?.id),nb=nodes.get(visual[swapB]?.id);if(!previewSwap)await Promise.all([tween(na,pos(swapB),165),tween(nb,pos(swapA),165)]);visual=clone(e.board);nodes.get(visual[swapA].id).index=swapA;nodes.get(visual[swapB].id).index=swapB;iceMarks.sync(visual,nodes);}
   if(e.type==='destroy'){const cells=[...e.cells,...e.ice],effects=[...e.effects,...colorClearEffects(visual,e,[b,a])];
    const arrivals=new Map();effects.forEach((v,j)=>{if(v.kind==='donut')for(const i of v.targets||[]){const flight=donutFlightPlan(pos(v.i),pos(i)),ms=j*75+DONUT_LAUNCH_MS+flight.delay+flight.duration;arrivals.set(i,Math.min(arrivals.get(i)??Infinity,ms));}});
    const rocketCells=new Set();for(const [j,v] of effects.entries())if(v.kind==='rocket')for(const i of cells){const hit=rocketContactMs(pos(v.i),pos(i),v.dir);if(hit!==null){const ms=j*75+hit;arrivals.set(i,Math.min(arrivals.get(i)??Infinity,ms));rocketCells.add(i);}}
    const impactAt=Math.max(0,...effects.map((v,j)=>v.kind==='donut'?0:j*75+(v.kind==='bomb'?BOOSTER_TIMING.bombPrepare+BOOSTER_TIMING.bombCharge+BOOSTER_TIMING.bombFlash:BOOSTER_TIMING.rocketPrepare+BOOSTER_TIMING.rocketCharge+BOOSTER_TIMING.rocketFlight*.55)));
    const startAt=i=>arrivals.get(i)??Math.max(0,impactAt-380);
    const collectors=[...new Set(cells)].filter(i=>visual[i]?.kind==='candy'&&visual[i].mult>0&&(!serverMode||e.collected?.includes(i))).sort((a,b)=>(startAt(a)+(rocketCells.has(a)?125:380))-(startAt(b)+(rocketCells.has(b)?125:380))||a-b);
    const arrivalValues=multiplierArrivalValues(plannedMult,e.mult,collectors.map(i=>visual[i].mult));plannedMult=e.mult;
    const magicCollectors=state.bonus?[]:[...new Set(cells)].filter(i=>visual[i]?.magic&&(!serverMode||e.magicCells?.includes(i))).sort((a,b)=>startAt(a)-startAt(b)||a-b);
    const magicTotal=serverMode&&Number.isInteger(e.meter)?e.meter:Math.min(3,plannedMeter+magicCollectors.length),magicValues=magicArrivalValues(plannedMeter,magicTotal,magicCollectors.length);plannedMeter=magicTotal;
    const audioPlan=clearAudioPlan({cells,effects,rocketCells,startAt,board:visual});
    const blastSounds=Promise.all(audioPlan.blastTimes.map(async ms=>{if(ms)await pause(ms);sound.play('bomb');}));
    const effectsDone=Promise.all(effects.map(async(v,j)=>{if(j)await pause(j*75);return effect(v);}));
    const clearSound=(async()=>{const delay=audioPlan.popAt??(cells.length?Math.min(...cells.map(startAt)):0);if(delay>0)await pause(delay);sound.cascade=Math.max(0,e.step);if(audioPlan.popAt!==null)sound.play('pop',sound.cascade);await pause(380);if(e.ice.length)sound.play('ice');else if(e.damage.length)sound.play('iceHit');})();
    // Projectiles start each confirmed cell's collapse only on contact.
    await Promise.all(cells.map(async i=>{const delay=startAt(i);if(delay)await pause(delay);const hitIndex=audioPlan.rocketHits.indexOf(i);if(hitIndex>=0)sound.play('rocketPop',hitIndex);await dissolveSymbol(i,c=>{
     if(audioPlan.donutHits.includes(i))sound.play('donutPop');
     if(c.kind==='ice')iceMarks.remember(i,c);
     if(c.magic&&(!serverMode||e.magicCells?.includes(i))){const rank=magicCollectors.indexOf(i);if(rank>=0){pendingMagic++;collectionFlights.push((async()=>{try{if(rank)await pause(rank*80);await flyMagic(i,c,magicValues[rank]);}finally{pendingMagic--;}})());}else{sound.play('magic');float(serverMode?'★':'+1 MOVE',i);}}if(c.mult&&(!serverMode||e.collected?.includes(i))){const rank=collectors.indexOf(i);if(rank>=0){const n=nodes.get(c.id);if(n?.multiplierLabel)n.multiplierLabel.visible=false;pendingMult++;collectionFlights.push((async()=>{try{if(rank)await pause(rank*85);await flyMultiplier(i,c.mult,arrivalValues[rank]);}finally{pendingMult--;}})());}else float('×'+c.mult,i);}
    },rocketCells.has(i));}));await clearSound;
    await Promise.all([effectsDone,blastSounds]);
    for(const i of cells){const id=visual[i]?.id,n=nodes.get(id);if(n){n.destroy({children:true});nodes.delete(id);}visual[i]=null;}
    for(const i of e.damage)if(!e.ice.includes(i)){const old=nodes.get(visual[i]?.id);if(old){old.destroy({children:true});nodes.delete(visual[i].id);}let c=e.board[i],n=make(c);n.index=i;Object.assign(n,pos(i));burst(i,0xb7edff,14);tween(n.scale,{x:1.08,y:.93},65).then(()=>tween(n.scale,{x:1,y:1},140));visual[i]=clone(c);}
    if(e.armed.length)sound.play('boosterAppear');for(const id of e.armed){const n=nodes.get(id);if(n){boosterVFX.arm(n);}}
    if(!pendingMagic&&serverMode&&Number.isInteger(e.meter))state.meter=e.meter;if(!pendingMult){if(e.mult>displayMult)sound.play('multiplier');displayMult=e.mult;}displayWin=e.win;if(state.bonus&&Number.isInteger(e.moves))state.bonus.moves=e.moves;hud();if(e.step>=2){$('#message').textContent=['SWEET CASCADE!','GREAT CHAIN!','SWEET CASCADE!'][Math.min(2,Math.floor(e.step/3))];$('#message').style.opacity=1;}await pause(45);
   }if(e.type==='fall'){await fall(e.board);if(eventIndex===waveAfter)await settleBoard(cascadeWaveOrigin(result.events,waveAfter));}if(e.type==='shuffle')await shuffleBoard(e.board);
  }
  await Promise.all(collectionFlights);
  if(result.bonusStarted||result.bonusEnded)iceMarks.clear();
  state=result.state;displayWin=result.bonusTotalWin??result.win;if(result.freeRoundsCompleted||result.bonusEnded)stop();if(serverMode){displayMult=state.mult??1;if(state.bonus?.awaitingCompletion||state.serverWarning)stop();}draw(state.board);hud();if(serverMode&&state.awaitingMoves){stop();showMissingMoves();}else if(result.bonusStarted){sound.play('bonus');modal('<h2>FROSTED FACTORY</h2><p>'+state.bonus.moves+' free moves. Break the ice and collect multipliers.</p><button class="modal-action" id="continue">START BONUS</button>');$('#continue').onclick=()=>{sound.play('transition');close();};displayWin=0;displayMult=1;}
  else if(serverMode&&state.bonus?.awaitingCompletion){modal('<h2>BONUS REVIEW PAUSED</h2><p>All reported moves are used. The return to the base game is awaiting server verification. No further move will be sent.</p><button class="modal-action" id="continue">OK</button>');$('#continue').onclick=close;}
  else if(result.bonusEnded){const total=result.bonusTotalWin??result.win;sound.celebrate(total/(before.bonus?.bet||state.bet));modal('<h2>BONUS COMPLETE</h2><p>Total win</p><h1>'+money(total)+'</h1><button class="modal-action" id="continue">CONTINUE</button>');$('#continue').onclick=()=>{sound.play('winEnd');close();};}
  else if(result.freeRoundsCompleted){const award=result.freeRoundsCompleted;modal('<h2>FREE MOVES COMPLETE</h2><p>'+(award.completeTotal?'TOTAL WON':'WON SINCE RELOAD')+'</p><h1>'+money(award.knownWin)+'</h1><button class="modal-action" id="continue">CONTINUE</button>');$('#continue').onclick=close;}
  else if(result.win>=state.bet*15){sound.celebrate(result.win/state.bet);float('+'+money(result.win),24);await pause(450);}
 }catch(e){stop();if(serverMode){rgs.fail(e.message,true);showConnectionFault();}else{console.error(e);toast(e.message);}}finally{busy=false;roundRunning=false;fastRequested=false;updateSpeed();state=rgs.snapshot();hud();if(auto>0&&(!serverMode||rgs.playable)&&!$('#dialog').open&&!document.hidden)autoTimer=setTimeout(()=>{if(auto>0&&!document.hidden&&!$('#dialog').open)play();},220/speed);}
}
$('#sound').onclick=()=>{sound.unlock();sound.enabled=!sound.enabled;$('#sound').style.opacity=sound.enabled?1:.45;};$('#turbo').onclick=()=>{persistentTurbo=!persistentTurbo;updateSpeed();$('#turbo').classList.toggle('active',persistentTurbo);$('#turbo').setAttribute('aria-pressed',String(persistentTurbo));sound.play('click');};
const bets=[.1,.2,.5,1,2,5,10,20,50,100];
const betOptions=()=>serverMode?rgs.bets:bets;
const canChangeBet=()=>!busy&&!state.bonus&&!state.freeRounds&&(!serverMode||rgs.playable);
async function chooseBet(value){
 if(!canChangeBet()||!betOptions().includes(value))return false;
 if(value===state.bet)return true;
 busy=true;hud();
 try{if(serverMode)await rgs.setBet(value);else rgs.s.bet=value;state=rgs.snapshot();persist();sound.play('click');return true;}
 catch(e){if(serverMode)showConnectionFault();else toast(e.message);return false;}
 finally{busy=false;hud();}
}
function changeBet(dir){const options=betOptions(),i=options.indexOf(state.bet);return chooseBet(options[Math.max(0,Math.min(options.length-1,i+dir))]);}
$('#minus').onclick=()=>changeBet(-1);$('#plus').onclick=()=>changeBet(1);
$('#bet-open').onclick=()=>{
 if(!canChangeBet())return;
 modal('<h2 id="bet-dialog-title">CHOOSE BET</h2><p class="modal-subtitle">Select your bet per move</p><div class="choices bet-choices" role="group" aria-labelledby="bet-dialog-title">'+betOptions().map(value=>'<button data-bet="'+value+'" aria-pressed="'+(value===state.bet)+'">'+money(value)+'</button>').join('')+'</div>');
 document.querySelectorAll('[data-bet]').forEach(button=>button.onclick=async()=>{
  if(!canChangeBet())return;
  const buttons=[...document.querySelectorAll('[data-bet]')];buttons.forEach(b=>b.disabled=true);
  const selected=await chooseBet(Number(button.dataset.bet));
  // A pending server selection must not close a different dialog opened meanwhile.
  if(!$('#dialog-content').contains(button))return;
  if(selected)close();else buttons.forEach(b=>b.disabled=false);
 });
};
$('#bonus').onclick=()=>{if(serverMode||busy||state.bonus)return;modal('<h2>CHOOSE A MODE</h2><div class="cards">'+[['base','Normal play','1× per move'],['luck','Extra Luck','2× per move · more magic candies'],['enhanced','Enhanced Moves','50× per move · bombs, rockets and multipliers'],['ice','Frosted Factory','100× · buy 5 free moves'],['mayhem','Multi Mayhem','1000× per move · multiplier board']].map(([id,name,desc])=>`<button class="card" data-mode="${id}"><b>${name}</b><span>${desc}</span><span>${money(state.bet*({base:1,luck:2,enhanced:50,ice:100,mayhem:1000}[id]))} credits</span></button>`).join('')+'</div>');document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{const mode=b.dataset.mode;$('#dialog-content').innerHTML='<h2>'+b.querySelector('b').textContent+'</h2><p>'+ (mode==='ice'?'Cost: '+money(state.bet*100)+' demo credits.':'Changing mode is free. Your next move uses the selected price.')+'</p><button id="confirm" class="modal-action">CONFIRM</button>';$('#confirm').onclick=()=>{try{state=mode==='ice'?rgs.buy():rgs.mode(mode);persist();displayWin=0;displayMult=1;draw(state.board);hud();close();sound.play(mode==='ice'?'bonus':'click');}catch(e){toast(e.message);}};});};
$('#auto').onclick=()=>{if(serverMode&&!rgs.playable)return;if(auto){stop();return;}modal('<h2>AUTOPLAY</h2><p>Choose the number of paid moves. Stopping autoplay lets the current move finish.</p><div class="choices">'+[5,10,25,50,100,250,500,1000].map(n=>`<button data-count="${n}">${n}</button>`).join('')+'</div>');document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{auto=Number(b.dataset.count);close();hud();if(!busy)play();});};
$('#settings').onclick=()=>{modal('<h2>SETTINGS</h2><label><input id="sfx-check" type="checkbox" '+(sound.enabled?'checked':'')+'> Sound effects</label><label><input id="music-check" type="checkbox" '+(sound.music?'checked':'')+'> Background music</label><p>'+(serverMode?'Reload starts a new RGS test session.':'Your board and bonus progress are saved in this browser.')+'</p>');$('#sfx-check').onchange=e=>{sound.unlock();sound.enabled=e.target.checked;};$('#music-check').onchange=e=>{sound.unlock();sound.music=e.target.checked;};};
$('#history').onclick=()=>modal('<h2>MOVE HISTORY</h2><table><tr><th>Time</th><th>Cost</th><th>Win</th><th>Multiplier</th></tr>'+state.history.slice(0,20).map(h=>`<tr><td>${new Date(h.time).toLocaleTimeString('en-US')}</td><td>${h.bonus?'Bonus · ':''}${money(h.cost)}</td><td>${money(h.win)}</td><td>×${h.mult}</td></tr>`).join('')+'</table>');
$('#rules').onclick=()=>serverMode?modal('<h2>SWEET CASCADE · RGS TEST</h2><p>Swap adjacent symbols. Press Space to use a move suggested by the server. Cascades, wins and your balance come from the test RGS.</p><p>Magic collection, symbol multipliers, ice damage and ice breaking are connected. The final bonus result returns the server-confirmed base board without another stake. Extra bet modes and bonus purchases are unavailable.</p><p>Reload starts a fresh test session. After a connection failure, the last move is never submitted again automatically.</p>'):modal('<h2>SWEET CASCADE</h2><p>Swap adjacent candies to match 3 or more. You can also move a rocket or bomb. Invalid swaps return without charging credits.</p><p>A line of 4 clears a row or column. A line of 5 or more clears that color. Intersections clear their bounding rectangle. Rockets fire in the arrow direction; bombs clear a 3×3 area.</p><p>Every 3 candies destroyed in a cascade step count as one chain. Demo payout: bet × 0.05 × max(chains × multiplier sum − 1, 0). A single match of 3 with no continuation pays nothing.</p><p>Collect 3 magic candies to trigger the ice bonus. Wins and multipliers accumulate during the bonus. Each destroyed magic candy adds one move.</p><p>Press Space for an automatic move; hold to repeat. The board persists between moves and after reloading.</p><p>This client demo uses test generation, no real money and no declared RTP. Final mathematics and unresolved edge cases require the production RGS.</p>');
window.addEventListener('keydown',e=>{if(e.code==='Escape')stop();});
app.ticker.add(t=>{const density=renderBudget.sample(t.elapsedMS,startupComplete&&!document.hidden&&!orientationBlocked()&&!$("#dialog").open);if(density!==null)app.renderer.resize(711,711,density);let dt=Math.min(t.deltaMS,50);const hintsAllowed=!busy&&!pointer&&!held&&!auto&&!document.hidden&&!$('#dialog').open&&state.board.length===49&&(!serverMode||rgs.playable);const legalHints=()=>serverMode?rgs.moves():moves(state.board);swipeHint.tick(dt,hintsAllowed,legalHints);if(!hintsAllowed)hintSoundPlayed=false;if(swipeHint.layer.visible&&!hintSoundPlayed){sound.play('hint');hintSoundPlayed=true;}symbolHint.tick(dt,hintsAllowed,legalHints);const hoverActive=hoveredCell!==null&&!busy&&!pointer;hoverOpacity+=(Number(hoverActive)-hoverOpacity)*Math.min(1,dt/110);if(hoverActive)Object.assign(hoverCell,pos(hoveredCell));hoverCell.alpha=hoverOpacity*.94;for(let i=anims.length-1;i>=0;i--){const a=anims[i];a.t+=dt;let p=Math.min(a.t/a.ms,1),e=a.ease(p);if(!a.obj.destroyed)for(const k in a.to)a.obj[k]=a.from[k]+(a.to[k]-a.from[k])*e;if(p===1){anims.splice(i,1);a.resolve();}}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt/1000;p.g.x+=p.vx*dt/1000;p.g.y+=p.vy*dt/1000;p.vy+=460*dt/1000;p.g.alpha=Math.max(0,p.life/p.total);p.g.rotation+=dt*.003;if(p.life<=0){p.g.destroy();particles.splice(i,1);}}for(const n of nodes.values()){boosterVFX.tickArmed(n,performance.now());if(n.whiteFilter){const v=n.white.v,k=1-v;n.whiteBlur.strength=.8*v;n.whiteFilter.matrix=[k,0,0,0,v,0,k,0,0,v,0,0,k,0,v,0,0,0,1,0];}if(['candy','bomb','rocket'].includes(n.kind)){const phase=performance.now()*.0019*n.idleRate+n.phase;const amp=1;const hint=n.clearing?{scale:1,y:0,squash:0,shine:-1}:symbolHint.pose(n.index),wave=boardWavePose(boardWaveElapsed,n.index,boardWaveOrigin);const emphasis=(selected===n.index?1.045:1)*hint.scale;n.sprite.x=wave.x;n.sprite.y=Math.sin(phase)*2.1*amp+hint.y+wave.y;n.sprite.rotation=n.baseSpriteRotation+Math.sin(phase*.79)*.016*amp;n.sprite.scale.set(n.baseSpriteScale*emphasis*(1+Math.sin(phase*1.17)*.016*amp+hint.squash),n.baseSpriteScaleY*emphasis*(1-Math.sin(phase*1.17)*.016*amp-hint.squash));updateHintShine(n,hint.shine);if(n.multiplierLabel){const b=n.multiplierLabel;b.position.copyFrom(n.sprite.position);b.rotation=n.sprite.rotation-n.baseSpriteRotation;b.scale.set((b.baseLabelScale??1)*n.sprite.scale.x/n.baseSpriteScale,(b.baseLabelScale??1)*n.sprite.scale.y/n.baseSpriteScaleY);}}for(const g of n.glows||[]){g.position.copyFrom(n.sprite.position);g.rotation=n.sprite.rotation;g.scale.set(n.sprite.scale.x*g.glowScaleX*g.glowSpread,n.sprite.scale.y*g.glowScaleY*g.glowSpread);}}});

function showMissingMoves(){
 $('#game').inert=true;if($('#dialog').open)close();const panel=$('#rgs-status');panel.hidden=false;
 panel.querySelector('h2').textContent='NO NEXT MOVES';
 panel.querySelector('p').textContent='The last move is complete and its result is shown. The server did not provide the next available moves. Reload starts a new test session.';
 panel.querySelector('button').hidden=false;panel.querySelector('button').focus();
}
function showConnectionFault(){
 if(!serverMode||!rgs.transport.fault)return;stop();cancelDrag();$('#game').inert=true;if($('#dialog').open)close();
 if(document.hidden)return;
 const panel=$('#rgs-status');panel.hidden=false;panel.querySelector('h2').textContent='CONNECTION STOPPED';
 panel.querySelector('p').textContent=rgs.transport.fault+' '+(rgs.transport.unknownOutcome?'The last move could not be confirmed or displayed. It will not be sent again. ':'')+'Reload starts a new test session.';
 panel.querySelector('button').hidden=false;panel.querySelector('button').focus();
}
$('#rgs-reload').onclick=()=>location.reload();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)showConnectionFault();});
window.addEventListener('pageshow',()=>showConnectionFault());
draw(state.board);hud();persist();window.sweetCascade={rgs,play,get ready(){return startupComplete;},get renderResolution(){return app.renderer.resolution;},get audio(){return {unavailable:[...sound.unavailable],musicPlaying:!!sound.musicLoop?.source,musicVolume:sound.musicGain?.gain.value};},get state(){return clone(state);},get busy(){return busy;},get hint(){return {visible:swipeHint.layer.visible,pair:swipeHint.pair,elapsed:swipeHint.elapsed,symbolPair:symbolHint.pair,symbolElapsed:symbolHint.elapsed,idle:swipeHint.idle};},app};
// Reproducible visual QA is opt-in and never changes the normal game session.
if(params.has('qa')){
 const preview=async work=>{if(!startupComplete||busy)return;sound.unlock();busy=true;swipeHint.reset();symbolHint.reset();hud();try{await work();}finally{busy=false;hud();}};
 window.sweetCascade.previewBooster=(kind='bomb',dir=0)=>preview(()=>{const color=visual[24]?.color??0,targets=visual.flatMap((c,i)=>c?.kind==='candy'&&c.color===color?[i]:[]);return effect({kind,i:24,dir,color,targets,preview:true});});
 window.sweetCascade.previewLanding=()=>preview(async()=>{const targets=[...nodes.values()].filter(n=>n.kind!=='ice'&&n.index>=14&&n.index<35);await Promise.all(targets.map(async n=>{const p=pos(n.index);await pause(n.index%7*25);n.y=p.y-94;const from=n.y;await animate(200,t=>{n.y=from+94*t*t-40*.22*t*t;n.scale.set(1-.14*t*t,1+.22*t*t);});await animate(LANDING_MS,t=>{const q=landingPose(t*LANDING_MS,1,n.phase);n.y=p.y+q.y;n.scale.set(q.sx,q.sy);n.rotation=q.rotation;});n.y=p.y;n.scale.set(1);n.rotation=0;}));});
 window.sweetCascade.previewWave=index=>preview(()=>settleBoard(Number.isInteger(index)?{column:index%7,row:Math.floor(index/7)}:boardWaveOrigin));
 window.sweetCascade.waveOrigin=()=>({...boardWaveOrigin});
 window.sweetCascade.waveTime=()=>boardWaveElapsed;
 const qa=document.createElement('div');qa.id='vfx-qa';qa.style.cssText='position:fixed;bottom:50px;left:10px;z-index:5;display:flex;gap:5px';
 for(const [text,run] of [['BOMB',()=>window.sweetCascade.previewBooster('bomb')],['ROCKET',()=>window.sweetCascade.previewBooster('rocket',0)],['DONUT',()=>window.sweetCascade.previewBooster('donut')],['LANDING',()=>window.sweetCascade.previewLanding()],['WAVE',()=>window.sweetCascade.previewWave()]]){
  const button=document.createElement('button');button.textContent=text;button.style.cssText='background:#172944;padding:9px;border-radius:8px;font-size:11px';button.onclick=run;qa.append(button);
 }
 if(visualPreview){
  window.sweetCascade.previewArmed=()=>preview(async()=>{const before=clone(visual),demo=clone(visual);try{for(const [dir,i]of [17,25,31,23].entries())demo[i]={id:-9700-dir,kind:'rocket',dir,color:0};demo[24]={id:-9710,kind:'bomb',color:1};draw(demo);for(const i of [17,25,31,23,24])boosterVFX.arm(nodes.get(visual[i].id));await pause(2400);}finally{draw(before);}});
  window.sweetCascade.previewRocketSweep=(dir=1)=>preview(async()=>{const before=clone(visual),i=[45,21,3,27][dir],demo=visual.map((c,j)=>({...c,id:-9750-j}));demo[i]={id:-9720,kind:'rocket',dir,color:0};draw(demo);try{const e={kind:'rocket',i,dir,preview:true},targets=demo.flatMap((c,j)=>j!==i&&rocketContactMs(pos(i),pos(j),dir)!==null?[j]:[]);await Promise.all([effect(e),(async()=>{if(targets.length>3){await pause(Math.max(...targets.map(j=>rocketContactMs(pos(i),pos(j),dir)))+125);sound.play('bomb');}})(),...targets.map(async j=>{await pause(rocketContactMs(pos(i),pos(j),dir));if(demo[j]?.kind==='candy')sound.play('rocketPop',Math.abs(j%7-i%7)+Math.abs(Math.floor(j/7)-Math.floor(i/7))-1);await dissolveSymbol(j,()=>{},true);})]);await pause(450);}finally{draw(before);}});
  for(const [text,run]of [['ROCKET SWEEP',()=>window.sweetCascade.previewRocketSweep(1)],['ARMED',()=>window.sweetCascade.previewArmed()]]){const button=document.createElement('button');button.textContent=text;button.style.cssText='background:#175779;padding:9px;border-radius:8px;font-size:11px';button.onclick=run;qa.append(button);}
  window.sweetCascade.previewIce=()=>preview(async()=>{const board=clone(visual);try{const demo=clone(visual);demo[23]={id:-9801,kind:'ice',hp:2,maxHp:2,mult:10,color:-1};demo[25]={id:-9802,kind:'ice',hp:1,maxHp:2,mult:10,color:-1};draw(demo);await pause(3500);}finally{draw(board);}});
  window.sweetCascade.previewIceRefill=()=>preview(async()=>{
   const board=clone(visual),savedMarks=new Map(iceMarks.values);iceMarks.clear();
   try{const demo=clone(visual);for(const [i,m]of [[23,10],[25,50]])demo[i]={id:-9850-i,kind:'ice',hp:1,maxHp:2,mult:m,color:-1};draw(demo);await pause(650);
    await Promise.all([23,25].map(i=>dissolveSymbol(i,c=>iceMarks.remember(i,c))));
    for(const i of [23,25])demo[i]={id:-9950-i,kind:'candy',color:i===23?3:5};
    await fall(demo);await pause(1800);
   }finally{iceMarks.clear();iceMarks.values=savedMarks;draw(board);}
  });
  const iceRefillButton=document.createElement('button');iceRefillButton.textContent='ICE REFILL';iceRefillButton.style.cssText='background:#175779;padding:9px;border-radius:8px;font-size:11px';iceRefillButton.onclick=window.sweetCascade.previewIceRefill;qa.append(iceRefillButton);
  const icePreview=document.createElement('button');icePreview.textContent='ICE';icePreview.style.cssText='background:#175779;padding:9px;border-radius:8px;font-size:11px';icePreview.onclick=()=>window.sweetCascade.previewIce();qa.append(icePreview);
  window.sweetCascade.previewClears=()=>preview(async()=>{const board=clone(visual),indices=[15,16,17,18,19,20];try{for(let k=0;k<6;k++){const i=indices[k],old=nodes.get(visual[i]?.id);if(old){nodes.delete(visual[i].id);old.destroy({children:true});}const c={id:-9900-k,kind:'candy',color:k};visual[i]=c;const n=make(c);n.index=i;Object.assign(n,pos(i));}await pause(300);await Promise.all(indices.map(i=>dissolveSymbol(i)));await pause(800);}finally{draw(board);}});
  const clears=document.createElement('button');clears.textContent='SYMBOL POPS';clears.style.cssText='background:#743e7a;padding:9px;border-radius:8px;font-size:11px';clears.onclick=()=>window.sweetCascade.previewClears();qa.append(clears);
  window.sweetCascade.previewFive=async(count=5,withMultipliers=false,withMagic=false)=>{if(busy||!startupComplete)return;rgs.s.bonus=null;rgs.s.mode='base';rgs.s.meter=0;rgs.s.board=Array.from({length:49},(_,i)=>({id:++rgs.s.id,kind:'candy',color:(i%7+Math.floor(i/7)*2)%6}));for(const i of (count===4?[15,16,18,24]:[15,16,18,19,24]))rgs.s.board[i].color=2;rgs.s.board[17].color=4;if(withMagic)for(const i of [15,16,24])rgs.s.board[i].magic=true;if(withMultipliers){for(const [i,m]of [[15,2],[16,3],[24,5]])rgs.s.board[i].mult=m;}rgs.s.version++;state=rgs.snapshot();draw(state.board);displayWin=0;displayMult=1;hud();await play(24,17);};
  const five=document.createElement('button');five.textContent='FIVE MATCH';five.style.cssText='background:#743e7a;padding:9px;border-radius:8px;font-size:11px';five.onclick=()=>window.sweetCascade.previewFive();qa.append(five);
  window.sweetCascade.previewFour=()=>window.sweetCascade.previewFive(4);const four=document.createElement('button');four.textContent='ROW CLEAR';four.style.cssText=five.style.cssText;four.onclick=window.sweetCascade.previewFour;qa.append(four);
  window.sweetCascade.previewMagic=()=>window.sweetCascade.previewFive(4,false,true);const magicButton=document.createElement('button');magicButton.textContent='MAGIC';magicButton.style.cssText=five.style.cssText;magicButton.onclick=window.sweetCascade.previewMagic;qa.append(magicButton);
  window.sweetCascade.previewMultipliers=()=>window.sweetCascade.previewFive(4,true);const multButton=document.createElement('button');multButton.textContent='MULTIPLIERS';multButton.style.cssText=five.style.cssText;multButton.onclick=window.sweetCascade.previewMultipliers;qa.append(multButton);
 }
 document.body.append(qa);
}

const initialized=await sessionReady;if(initialized.error)throw initialized.error;state=initialized.value;draw(state.board);hud();
await prepareTask('frame',async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));app.render();});
$('#rgs-status').hidden=true;
await revealGame(()=>!serverMode||rgs.playable);startupComplete=true;busy=false;swipeHint.reset();symbolHint.reset();hud();
if(sound.unavailable.length){toast('Some audio could not load. You can continue playing.');for(const failure of sound.audioLoader?.failures||[])rgs.transport?.log('audio-'+failure.file,'Audio '+failure.file+': '+failure.attempts.map(a=>a.format+' '+a.error).join('; ')+'. Unavailable; game playable without this sound.');}
for(const recovery of sound.audioLoader?.recoveries||[])rgs.transport?.log('audio-'+recovery.file,'Audio '+recovery.file+': '+recovery.attempts.map(a=>a.format+' '+a.error).join('; ')+'. MP3 decoded successfully.');
if(state.freeRounds?.counter===0){modal('<h2>FREE MOVES</h2><p>'+state.freeRounds.remaining+' free moves at '+money(state.freeRounds.bet)+' '+(state.currency||'credits')+'</p><button class="modal-action" id="continue">CONTINUE</button>');$('#continue').onclick=close;}



}


try{await startGame();}catch(error){failStartup('The game could not finish loading. Please reload.');console.error('Startup blocked:',error?.message);}

