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
  // Aliases with the same complete codec chain share one fetch and AudioBuffer.
  const key=JSON.stringify(this.formats.map(format=>this.urlFor(file,format)));
  if(!this.cache.has(key))this.cache.set(key,this.decode(file));
  return this.cache.get(key);
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
  "winnerBigFanfare": {
    "wav": "public/audio/winner-user-v1/big.wav",
    "mp3": "public/audio/winner-user-v1/big.mp3"
  },
  "winnerEpicFanfare": {
    "wav": "public/audio/winner-user-v1/epic.wav",
    "mp3": "public/audio/winner-user-v1/epic.mp3"
  },
  "winnerMegaFanfare": {
    "wav": "public/audio/winner-user-v1/mega.wav",
    "mp3": "public/audio/winner-user-v1/mega.mp3"
  },
  "winnerRoyalFanfare": {
    "wav": "public/audio/winner-user-v1/royal.wav",
    "mp3": "public/audio/winner-user-v1/royal.mp3"
  },
  "winnerApplause": {
    "wav": "public/audio/winner-v1/applause.wav",
    "mp3": "public/audio/winner-v1/applause.mp3"
  },
  "winnerCount": {
    "wav": "public/audio/winner-v1/count.wav",
    "mp3": "public/audio/winner-v1/count.mp3"
  },
  "winnerChange": {
    "wav": "public/audio/winner-v1/change.wav",
    "mp3": "public/audio/winner-v1/change.mp3"
  },
  "magicAppear": {
    "wav": "public/audio/magic-appear/soft.wav",
    "mp3": "public/audio/magic-appear/soft.mp3"
  },
  "flightWhoosh": {
    "wav": "public/audio/optimized-nov7/flightWhoosh.wav",
    "mp3": "public/audio/optimized-nov7/flightWhoosh.mp3"
  },
  "sparkles": {
    "wav": "public/audio/sparkles/bright-star-1.wav",
    "mp3": "public/audio/sparkles/bright-star-1.mp3"
  },
  "swap": {
    "wav": "public/audio/optimized-nov7/flightWhoosh.wav",
    "mp3": "public/audio/optimized-nov7/flightWhoosh.mp3"
  },
  "pop": {
    "wav": "public/audio/optimized-nov7/pop.wav",
    "mp3": "public/audio/optimized-nov7/pop.mp3"
  },
  "pop1": {
    "wav": "public/audio/optimized-nov7/pop1.wav",
    "mp3": "public/audio/optimized-nov7/pop1.mp3"
  },
  "pop2": {
    "wav": "public/audio/optimized-nov7/pop2.wav",
    "mp3": "public/audio/optimized-nov7/pop2.mp3"
  },
  "pop3": {
    "wav": "public/audio/optimized-nov7/pop3.wav",
    "mp3": "public/audio/optimized-nov7/pop3.mp3"
  },
  "pop4": {
    "wav": "public/audio/optimized-nov7/pop4.wav",
    "mp3": "public/audio/optimized-nov7/pop4.mp3"
  },
  "pop5": {
    "wav": "public/audio/optimized-nov7/pop5.wav",
    "mp3": "public/audio/optimized-nov7/pop5.mp3"
  },
  "land": {
    "wav": "public/audio/optimized-nov7/land.wav",
    "mp3": "public/audio/optimized-nov7/land.mp3"
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
    "wav": "public/audio/optimized-nov7/iceHit.wav",
    "mp3": "public/audio/optimized-nov7/iceHit.mp3"
  },
  "ice": {
    "wav": "public/audio/user-ice/break.wav",
    "mp3": "public/audio/user-ice/break.mp3"
  },
  "bonus": {
    "wav": "public/audio/optimized-nov7/bonus.wav",
    "mp3": "public/audio/optimized-nov7/bonus.mp3"
  },
  "transition": {
    "wav": "public/audio/match3-selected/transition.wav",
    "mp3": "public/audio/match3-selected/transition.mp3"
  },
  "win": {
    "wav": "public/audio/match3-selected/win.wav",
    "mp3": "public/audio/match3-selected/win.mp3"
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
    "wav": "public/audio/optimized-nov7/select.wav",
    "mp3": "public/audio/optimized-nov7/select.mp3"
  },
  "click": {
    "wav": "public/audio/optimized-nov7/click.wav",
    "mp3": "public/audio/optimized-nov7/click.mp3"
  },
  "invalid": {
    "wav": "public/audio/optimized-nov7/invalid.wav",
    "mp3": "public/audio/optimized-nov7/invalid.mp3"
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
    "wav": "public/audio/optimized-nov7/boosterAppear.wav",
    "mp3": "public/audio/optimized-nov7/boosterAppear.mp3"
  },
  "shuffle": {
    "wav": "public/audio/optimized-nov7/shuffle.wav",
    "mp3": "public/audio/optimized-nov7/shuffle.mp3"
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
    "wav": "public/audio/optimized-nov7/fuse.wav",
    "mp3": "public/audio/optimized-nov7/fuse.mp3"
  },
  "rocketPop": {
    "wav": "public/audio/optimized-nov7/rocketPop.wav",
    "mp3": "public/audio/optimized-nov7/rocketPop.mp3"
  },
  "bombEpic": {
    "wav": "public/audio/match3-bomb-epic/bomb.wav",
    "mp3": "public/audio/match3-bomb-epic/bomb.mp3"
  },
  "pop6": {
    "wav": "public/audio/optimized-nov7/pop6.wav",
    "mp3": "public/audio/optimized-nov7/pop6.mp3"
  },
  "pop7": {
    "wav": "public/audio/optimized-nov7/pop7.wav",
    "mp3": "public/audio/optimized-nov7/pop7.mp3"
  },
  "pop8": {
    "wav": "public/audio/optimized-nov7/pop8.wav",
    "mp3": "public/audio/optimized-nov7/pop8.mp3"
  },
  "pop9": {
    "wav": "public/audio/optimized-nov7/pop9.wav",
    "mp3": "public/audio/optimized-nov7/pop9.mp3"
  },
  "pop10": {
    "wav": "public/audio/optimized-nov7/pop10.wav",
    "mp3": "public/audio/optimized-nov7/pop10.mp3"
  },
  "donutPop": {
    "wav": "public/audio/optimized-nov7/rocketPop.wav",
    "mp3": "public/audio/optimized-nov7/rocketPop.mp3"
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
 // Music has its own channel and preference; enabled controls sound effects only.
 syncMusic(){
  const playing=this.music&&this.unlocked&&!document.hidden;
  // Mute the dedicated output as well as stopping the loop. A suspended or
  // interrupted audio device must not retain an audible music channel.
  if(this.musicGain)this.musicGain.gain.value=playing?.15:0;
  this.musicLoop?.setPlaying(playing);
 }
 constructor(){this.enabled=true;this.music=true;this.ctx=null;this.beat=0;this.timer=null;this.cascade=0;this.lastLand=-1;this.popVariant=-1;this.unlocked=false;
  const restore=()=>{if(this.unlocked&&!document.hidden)this.resumeAudio();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.suspendAudio();else restore();});
  window.addEventListener('pagehide',()=>this.suspendAudio());window.addEventListener('pageshow',restore);window.addEventListener('focus',restore);
  // iOS may require a fresh user gesture after an interruption. Retry within
  // every tap/key gesture, not just the first gesture of the entire session.
  for(const type of ['pointerdown','touchend','keydown'])document.addEventListener(type,restore,{capture:true,passive:true});
 }
 suspendAudio(){
  this.musicLoop?.setPlaying(false);
  // Suspending preserves active fanfares and their AudioContext clock.
  // Stopping sources here made a resumed winner continue silently.
  this.ctx?.suspend().catch(()=>{}).finally(()=>{if(!document.hidden&&this.unlocked)this.resumeAudio();});
 }
 async resumeAudio(){
  if(!this.ctx||!this.unlocked||document.hidden)return;
  try{if(this.ctx.state!=='running')await this.ctx.resume();if(!document.hidden)this.syncMusic();}catch{}
 }
 prepareContext(){if(this.ctx)return;this.ctx=new AudioContext();this.bus=this.ctx.createGain();this.bus.gain.value=.455;this.limiter=this.ctx.createDynamicsCompressor();this.limiter.threshold.value=-14;this.limiter.knee.value=12;this.limiter.ratio.value=5;this.limiter.attack.value=.003;this.limiter.release.value=.12;this.bus.connect(this.limiter).connect(this.ctx.destination);this.musicGain=this.ctx.createGain();this.musicGain.gain.value=.15;this.musicGain.connect(this.ctx.destination);}
 loadSamples(){return this.loading??=this.prepareSamples();}
 async prepareSamples(){this.samples={};this.unavailable=[];try{this.prepareContext();const loader=this.audioLoader=new GameAudioLoader(this.ctx,{urlFor:(name,format)=>AUDIO_FILES[name][format],timeout:16000,concurrency:3});await Promise.all(Object.keys(AUDIO_FILES).map(async name=>{const buffer=await loader.load(name);if(buffer)this.samples[name]=buffer;else this.unavailable.push(name);}));this.musicLoop=new MusicLoop(this.ctx,this.samples.music,this.musicGain);this.syncMusic();}catch{this.unavailable=Object.keys(AUDIO_FILES);}return {unavailable:this.unavailable};}
 sample(name,step=0){if(!this.ctx||!this.enabled||document.hidden)return false;const level=Math.min(CASCADE_NOTE_STEPS.length-1,Math.max(0,Math.floor(step))),key=name==='pop'&&level>0?'pop'+level:name;const buffer=this.samples?.[key];if(!buffer)return false;const now=this.ctx.currentTime;this.lastSample??={};const gap={magicAppear:.5,flightWhoosh:.12,land:.16,magic:.25,ice:.12,iceHit:.16,multiplier:.18,donutShot:.035,select:.1,boosterAppear:.12}[name]??0;if(now-(this.lastSample[name]??-100)<gap)return true;this.lastSample[name]=now;const src=this.ctx.createBufferSource(),gain=this.ctx.createGain();src.buffer=buffer;src.cue=key;// Candy 1 stays unchanged; the quiet reference note rises across cascade steps.
if(name==='rocketPop')src.playbackRate.value=1+Math.min(6,Math.max(0,step))*.035;
if(name==='donutShot')src.playbackRate.value=.98+(step%4)*.035;gain.gain.value=({sparkles:.42,magicAppear:.65,flightWhoosh:.8,swap:1.65,pop:1,rocketPop:.72,donutPop:.72,land:.5,magic:.65,multiplier:.8,iceHit:.65,ice:.85,bonus:.9,transition:.8,win:.9,winMega:.9,winEpic:.9,winEnd:.8,bomb:1,bombEpic:1.1,rocket:1,rocketCharge:.6,donutAppear:.75,donutShot:.55,donutEnd:.7,fuse:.6,select:.5,hint:.4}[name]??.8);src.connect(gain).connect(this.bus);this.voices??=new Set();this.voices.add(src);src.start();src.onended=()=>{this.voices.delete(src);src.disconnect();gain.disconnect();};return true;}
 cancelCelebration(){this.celebrationToken=(this.celebrationToken||0)+1;for(const src of this.voices||[])if(['win','winMega','winEpic'].includes(src.cue))try{src.stop();}catch{}}
 beginSparkles(){
  if(!this.sparkleUsers)this.stopSparkleBed=this.loop('sparkles',{volume:.42,fadeOut:.18});
  this.sparkleUsers=(this.sparkleUsers||0)+1;let released=false;
  return ()=>{if(released)return;released=true;this.sparkleUsers=Math.max(0,this.sparkleUsers-1);if(!this.sparkleUsers){this.stopSparkleBed?.();this.stopSparkleBed=null;}};
 }
 loop(name,{volume=.65,fadeOut=.055}={}){
  if(!this.ctx||!this.enabled||document.hidden||!this.samples?.[name])return ()=>{};
  const src=this.ctx.createBufferSource(),gain=this.ctx.createGain(),now=this.ctx.currentTime;src.buffer=this.samples[name];src.loop=true;src.cue=name;
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.04);src.connect(gain).connect(this.bus);this.voices??=new Set();this.voices.add(src);
  src.onended=()=>{this.voices.delete(src);src.disconnect();gain.disconnect();};src.start();let stopped=false;
  return ()=>{if(stopped)return;stopped=true;const t=this.ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.linearRampToValueAtTime(0,t+fadeOut);try{src.stop(t+fadeOut+.005);}catch{}};
 }

 unlock(){this.unlocked=true;try{this.prepareContext();this.resumeAudio();}catch{}}
 tone(freq,duration=.12,type='sine',gain=.15,delay=0,end=null){if(!this.ctx||!this.enabled||document.hidden)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(this.bus);o.start(t);o.stop(t+duration+.02);}
 noise(duration=.2,gain=.12,high=1500){if(!this.ctx||!this.enabled||document.hidden)return;let n=this.ctx.sampleRate*duration,buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate),a=buf.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);let src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=buf;f.type='lowpass';f.frequency.value=high;g.gain.value=gain;src.connect(f).connect(g).connect(this.bus);src.start();}
 play(name,step=0){if(this.unavailable?.includes(name))return;if(this.sample(name,step))return;if(name==='iceHit')name='ice';if(name==='transition'||name==='winEnd')name='magic';if(name==='multiplier')name='click';if(name==='shuffle')name='magic';if(name==='swap'){this.tone(450,.09,'sine',.2,0,900);}if(name==='invalid'){this.tone(220,.13,'triangle',.12,0,130);}if(name==='pop'){const semitones=CASCADE_NOTE_STEPS;const pitch=2**(semitones[Math.min(semitones.length-1,Math.max(0,step))]/12),f=480*pitch;this.tone(f*1.55,.095,'sine',.31,0,f*.52);this.tone(f*.65,.14,'sine',.13,.018,f*.32);this.noise(.035,.045,2600);this.tone(660*pitch,.23,'sine',.085,.025);this.tone(990*pitch,.15,'sine',.033,.045);if(step>1)this.tone(1320*pitch,.19,'sine',.025,.075);}if(name==='land'&&this.ctx){const now=this.ctx.currentTime;if(now-this.lastLand<.025)return;this.lastLand=now;const pitch=2**(Math.min(step,10)*1.2/12)*(1+(Math.random()-.5)*.1);this.tone(310*pitch,.075,'sine',.15,0,145*pitch);this.tone(155*pitch,.105,'sine',.095,.025,225*pitch);this.tone(730*pitch,.045,'sine',.025,.008,450*pitch);this.noise(.022,.023,1200);}if(name==='ice'){this.noise(.24,.22,7000);this.tone(1900,.25,'sine',.06);}if(name==='bomb'||name==='bombEpic'){this.noise(.4,.5,800);this.tone(160,.35,'sine',.5,0,35);}if(name==='rocket'){this.noise(.3,.3,4000);this.tone(250,.25,'triangle',.1,0,1800);}if(name==='magic'||name==='win'||name==='bonus'){[0,4,7,12,16].forEach((n,i)=>this.tone(523.25*2**(n/12),.4,'sine',.12,i*.085));}if(name==='click')this.tone(700,.045,'sine',.1,0,400);}
 tick(){this.syncMusic();}
}

// A swipe must never count as a dismiss/continue tap.
function bindConfirmedTap(element,activate){
 let touch=null;
 const cancel=()=>{touch=null;};
 const move=e=>{if(touch?.id===e.pointerId&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>10)touch.dragged=true;};
 const down=e=>{if(!e.isPrimary||e.button!==0){cancel();return;}e.preventDefault();e.stopImmediatePropagation();touch={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false};element.setPointerCapture?.(e.pointerId);};
 const up=e=>{if(touch?.id!==e.pointerId)return;move(e);const tap=!touch.dragged;cancel();e.preventDefault();e.stopImmediatePropagation();if(tap)activate();};
 const click=e=>{e.preventDefault();e.stopImmediatePropagation();if(e.detail===0)activate();};
 const hidden=()=>{if(document.hidden)cancel();};
 element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',cancel);element.addEventListener('lostpointercapture',cancel);element.addEventListener('click',click);
 window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);
 return ()=>{for(const [type,fn]of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',cancel],['lostpointercapture',cancel],['click',click]])element.removeEventListener(type,fn);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);};
}

function mountTouchGuard(){
 let finger=null,press=null,blockedClick=null;
 const reset=()=>{finger=press=blockedClick=null;};
 const start=e=>{finger=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,target:e.target}:null;};
 const move=e=>{
  if(!finger||e.touches.length!==1)return; // Keep accessibility pinch zoom available.
  const t=e.touches[0],dx=t.clientX-finger.x,dy=t.clientY-finger.y;finger.x=t.clientX;finger.y=t.clientY;
  const target=finger.target;
  if(target.closest?.('input[type=range]'))return;
  // Allow native vertical scrolling only while a dialog can consume this motion.
  if(Math.abs(dy)>Math.abs(dx)&&target.closest?.('dialog,[role=dialog],[role=alertdialog],#rgs-debug')){
   for(let el=target;el&&el!==document.body;el=el.parentElement){
    if(/auto|scroll/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+1&&((dy<0&&el.scrollTop+el.clientHeight<el.scrollHeight-1)||(dy>0&&el.scrollTop>0)))return;
   }
  }
  if(e.cancelable)e.preventDefault();
 };
 const down=e=>{blockedClick=null;press=e.isPrimary?{id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false}:null;};
 const pointerMove=e=>{if(press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10)press.dragged=true;};
 const up=e=>{pointerMove(e);if(press?.id===e.pointerId&&press.dragged)blockedClick={until:performance.now()+700};press=null;};
 const click=e=>{if(e.detail!==0&&blockedClick&&performance.now()<blockedClick.until){e.preventDefault();e.stopImmediatePropagation();}blockedClick=null;};
 const hidden=()=>{if(document.hidden)reset();};
 document.addEventListener('touchstart',start,{capture:true,passive:true});document.addEventListener('touchmove',move,{capture:true,passive:false});
 for(const [type,fn]of [['pointerdown',down],['pointermove',pointerMove],['pointerup',up],['click',click]])document.addEventListener(type,fn,true);
 window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden);
 return ()=>{document.removeEventListener('touchstart',start,true);document.removeEventListener('touchmove',move,true);for(const [type,fn]of [['pointerdown',down],['pointermove',pointerMove],['pointerup',up],['click',click]])document.removeEventListener(type,fn,true);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);};
}

// Winner audio is owned by the overlay. No delayed fanfare timers escape it.
// Four consecutive phrases from the user-supplied Sound_16748.mp3.
// The gaps are removed in the assets; decoded duration owns each stage clock.
const WINNER_FANFARES=[{name:'winnerBigFanfare',end:4.68},{name:'winnerEpicFanfare',end:4.59},{name:'winnerMegaFanfare',end:6.24},{name:'winnerRoyalFanfare',end:4.39}];
class WinnerAudio {
 constructor(sound){this.sound=sound;this.voices=new Set();this.envelopes=new WeakMap();}
 duration(index){const cue=WINNER_FANFARES[index];return (this.sound.samples?.[cue.name]?.duration??cue.end)*1000;}
 elapsed(fallback){return this.fanfare?.src?Math.max(0,(this.sound.ctx.currentTime-this.fanfare.src.startedAt)*1000):fallback;}
 voice(name,{volume=.8,loop=false,rate=1,fadeIn=.025,fadeOut=.09}={}){
  const s=this.sound;if(!s.ctx||!s.enabled||document.hidden||!s.samples?.[name])return null;
  const src=s.ctx.createBufferSource(),gain=s.ctx.createGain();src.buffer=s.samples[name];src.loop=loop;src.playbackRate.value=rate;src.cue=name;src.winner=true;src.startedAt=s.ctx.currentTime;src.connect(gain).connect(s.bus);gain.gain.setValueAtTime(0,s.ctx.currentTime);gain.gain.linearRampToValueAtTime(volume,s.ctx.currentTime+fadeIn);
  s.voices??=new Set();s.voices.add(src);this.voices.add(src);src.onended=()=>{s.voices.delete(src);this.voices.delete(src);src.disconnect();gain.disconnect();};src.start();
  let stopped=false;return {src,gain,stop:()=>{if(stopped)return;stopped=true;const t=s.ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.linearRampToValueAtTime(0,t+fadeOut);try{src.stop(t+fadeOut+.01);}catch{}}};
 }
 tier(index,changed=true){this.fanfare?.stop();this.change?.stop();this.accent=0;this.motionIndex=-1;this.motionTime=0;this.fanfare=this.voice(WINNER_FANFARES[index].name,{volume:index===3?1:.85,fadeIn:.005,fadeOut:.12});if(changed)this.change=this.voice('winnerChange',{volume:.25});}
 count(progress){
  if(!this.sound.enabled||document.hidden)return;
  if(!this.counting||!this.voices.has(this.counting.src))this.counting=this.voice('winnerCount',{loop:true,volume:.24,rate:.82});
  this.counting?.src.playbackRate.setTargetAtTime(.82+Math.max(0,Math.min(1,progress))*.66,this.sound.ctx.currentTime,.12);
 }
 finish(){this.counting?.stop();this.counting=null;this.end?.stop();this.end=this.voice('winEnd',{volume:.55});}
 level(){
  // One continuous bed across all tiers; resume only if visibility/mute stopped it.
  if(!this.crowd||!this.voices.has(this.crowd.src))this.crowd=this.voice('winnerApplause',{loop:true,volume:.32,fadeIn:.25,fadeOut:.3});
  const src=this.fanfare?.src;if(!src||!this.voices.has(src)||!this.sound.enabled||document.hidden){this.accent=0;return 0;}
  const buffer=src.buffer;let curve=this.envelopes.get(buffer);
  if(!curve){const samples=buffer.getChannelData(0),size=Math.max(1,Math.floor(buffer.sampleRate*.025));curve=[];let peak=.001;for(let i=0;i<samples.length;i+=size){let sum=0;for(let j=i;j<Math.min(samples.length,i+size);j++)sum+=samples[j]*samples[j];const v=Math.sqrt(sum/size);curve.push(v);peak=Math.max(peak,v);}curve=curve.map(v=>v/peak);this.envelopes.set(buffer,curve);}
  const time=this.sound.ctx.currentTime-src.startedAt,index=Math.floor(time/.025),value=curve[index]??0;
  const rise=index!==this.motionIndex?Math.max(0,value-(curve[Math.max(0,index-3)]??0)):0;
  this.accent=Math.min(1,Math.max((this.accent??0)*Math.exp(-Math.max(0,time-this.motionTime)/.14),rise*1.8));
  this.motionTime=time;this.motionIndex=index;return value;
 }
 stop(){this.counting?.stop();this.fanfare?.stop();this.change?.stop();this.end?.stop();this.crowd?.stop();this.counting=this.fanfare=this.change=this.end=this.crowd=null;}
}

const WINNER_TIERS=Object.freeze([
 {name:'Big Win',at:10,colors:[3,2]},
 {name:'Epic Win',at:25,colors:[5,1]},
 {name:'Mega Win',at:50,colors:[4,1]},
 {name:'Royal Win',at:100,colors:[2,5]}
]);
function winnerTier(amount,bet){if(!Number.isFinite(amount)||!Number.isFinite(bet)||bet<=0||amount<=bet*10)return -1;let tier=0;for(let i=1;i<WINNER_TIERS.length;i++)if(amount>=bet*WINNER_TIERS[i].at)tier=i;return tier;}
function winnerAward(result,before){
 const award=result.freeRoundsCompleted;
 if(award)return {amount:award.completeTotal&&Number.isFinite(award.knownWin)?award.knownWin:0,bet:award.bet??before.freeRounds?.bet??before.bet};
 return {amount:result.bonusEnded?(result.bonusTotalWin??result.win):before.bonus?0:result.win,bet:before.bonus?.bet??before.bet};
}
function winnerTimeline(amount,bet,durationFor=()=>4000,bonusComplete=false){const tier=winnerTier(amount,bet),max=bonusComplete&&Number.isFinite(amount)&&amount>=0&&Number.isFinite(bet)&&bet>0?Math.max(0,tier):tier;return Array.from({length:max+1},(_,i)=>({tier:i,target:i===max?amount:bet*WINNER_TIERS[i+1].at,duration:Math.max(600,durationFor(i))}));}
// Fast radial release (~250 ms), then a much slower curved drift.
function winnerFlightProgress(age,duration){const t=Math.max(0,Math.min(1,age/duration));return .68*(1-Math.exp(-age/.11))/(1-Math.exp(-duration/.11))+.32*t;}
function winnerEntrance(ms){const t=Math.max(0,Math.min(1,ms/1050)),u=Math.max(0,Math.min(1,(ms-750)/600));return t*t*(3-2*t)+.16*Math.sin(u*Math.PI);}
const WINNER_ART={
 plaque:'public/winner-v1/optimized/plaque.webp',trumpet:'public/winner-v1/optimized/trumpet.webp',
 titles:['public/winner-v1/optimized/title-big.webp','public/winner-v1/optimized/title-epic.webp','public/winner-v1/optimized/title-mega.webp','public/winner-v1/optimized/title-royal.webp'],
 candies:['public/optimized-v1/candy-blue.webp','public/optimized-v1/candy-orange-clean.webp','public/optimized-v1/candy-yellow.webp','public/optimized-v1/candy-green.webp','public/optimized-v1/candy-red.webp','public/optimized-v1/candy-purple.webp']
};
class WinnerOverlay {
 constructor({sound,game,onOpen=()=>{},onClose=()=>{}}){
  Object.assign(this,{game,onOpen,onClose});this.audio=new WinnerAudio(sound);this.active=false;
  this.root=document.createElement('div');this.root.className='winner-overlay';this.root.hidden=true;this.root.tabIndex=-1;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','Win celebration');
  this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');this.caption=document.createElement('p');this.caption.className='winner-caption';this.caption.textContent='TAP OR PRESS SPACE TO SKIP';this.live=document.createElement('span');this.live.className='winner-live';this.live.setAttribute('aria-live','polite');this.root.append(this.canvas,this.caption,this.live);document.body.append(this.root);this.ctx=this.canvas.getContext('2d');
  bindConfirmedTap(this.root,()=>this.interact());
  window.addEventListener('keydown',e=>{if(!this.active)return;if(['Space','Enter','Escape','Tab'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Space')this.swallowSpace=true;if(!e.repeat&&e.code!=='Tab')this.interact();}},true);
  window.addEventListener('keyup',e=>{if(e.code==='Space'&&(this.active||this.swallowSpace)){e.preventDefault();e.stopImmediatePropagation();this.swallowSpace=false;}},true);
  this.ready=this.load();
 }
 async load(){const load=async url=>{const img=new Image();img.src=url;await img.decode();return img};const [plaque,trumpet,titles,candies]=await Promise.all([load(WINNER_ART.plaque),load(WINNER_ART.trumpet),Promise.all(WINNER_ART.titles.map(load)),Promise.all(WINNER_ART.candies.map(load))]);this.images={plaque,trumpet,titles,candies};}
 async show({amount,bet,format=n=>n.toFixed(2),bonusComplete=false}){
  const timeline=winnerTimeline(amount,bet,i=>this.audio.duration(i),bonusComplete);if(!timeline.length||this.active)return false;await this.ready;
  this.onOpen();this.active=true;this.phase='counting';this.amount=amount;this.bet=bet;this.format=format;this.timeline=timeline;this.index=0;this.value=0;this.from=0;this.elapsed=0;this.stageTime=0;this.settleTime=0;this.closeTime=0;this.particles=[];this.emitTime=0;this.pulse=0;this.accent=0;this.lastMusicBurst=-1000;this.previousFocus=document.activeElement;this.previousInert=this.game.inert;this.game.inert=true;this.root.hidden=false;this.root.focus({preventScroll:true});this.caption.textContent='TAP OR PRESS SPACE TO SKIP';this.setTier(0,false);this.last=performance.now();
  return new Promise(resolve=>{this.resolve=resolve;this.frame=requestAnimationFrame(t=>this.tick(t));});
 }
 setTier(tier,changed=true){for(const p of this.particles)p.life=Math.min(p.life,p.age+.12);this.tier=tier;this.titleTime=0;this.root.dataset.tier=String(tier);this.audio.tier(tier,changed);this.live.textContent=WINNER_TIERS[tier].name;for(let i=0;i<32;i++)this.emit(i);}
 emit(seed=0){const colors=WINNER_TIERS[this.tier].colors,color=colors[(this.emitted??0)%2],angle=(this.emitted=(this.emitted??0)+1)*2.39996323+Math.random()*.3,dx=Math.cos(angle),dy=Math.sin(angle),radius=400+Math.random()*600,bend=(140+Math.random()*220)*(Math.random()<.5?-1:1),duration=3.6+Math.random()*1.1,life=duration*.55;this.particles.push({color,x0:640+dx*140,y0:380+dy*65,cx:640+dx*radius*.5-dy*bend,cy:380+dy*radius*.5+dx*bend,x1:640+dx*radius,y1:380+dy*radius,size:110+Math.random()*55,angle:seed*.6,spin:(Math.random()<.5?-1:1)*(6+Math.random()*6),age:0,life,duration});if(this.particles.length>144)this.particles.shift();}
 interact(){if(!this.active||this.phase==='closing')return;if(this.phase==='counting'){const final=this.timeline.at(-1).tier;if(this.tier!==final)this.setTier(final);this.finishCount();}else if(this.settleTime>500)this.phase='closing';}
 finishCount(){this.value=this.amount;this.phase='settled';this.settleTime=0;this.audio.finish();this.caption.textContent='TAP OR PRESS SPACE TO CONTINUE';this.live.textContent=WINNER_TIERS[this.tier].name+' '+this.format(this.amount);}
 tick(now){
  if(this.active&&document.hidden){this.last=now;this.frame=requestAnimationFrame(t=>this.tick(t));return;}
  if(!this.active)return;const dt=document.hidden?0:Math.min(50,Math.max(0,now-this.last));this.last=now;this.elapsed+=dt;this.titleTime+=dt;
  if(this.phase==='counting'){const stage=this.timeline[this.index];this.stageTime+=dt;const lead=this.index===0?450:0,audioTime=this.audio.elapsed(this.stageTime),p=Math.max(0,Math.min(1,(audioTime-lead)/(stage.duration-lead)));this.value=this.from+(stage.target-this.from)*(1-(1-p)**1.3);if(audioTime>lead)this.audio.count((this.index+p)/this.timeline.length);if(p>=1){this.from=stage.target;this.stageTime=0;if(++this.index<this.timeline.length)this.setTier(this.timeline[this.index].tier);else this.finishCount();}}
  if(this.phase==='settled'){this.settleTime+=dt;if(this.settleTime>2400)this.phase='closing';}
  if(this.phase==='closing'){this.closeTime+=dt;if(this.closeTime>=350){this.close();return;}}
  if(this.phase!=='closing'){this.emitTime+=dt;if(this.emitTime>160){this.emitTime=0;for(let i=0;i<2;i++)this.emit();}}
  for(const p of this.particles){p.age+=dt/1000;p.angle+=p.spin*dt/1000;}this.particles=this.particles.filter(p=>p.age<p.life);
  this.pulse+=(this.audio.level()-this.pulse)*Math.min(1,dt/65);this.accent=this.audio.accent??0;
  if(this.phase==='counting'&&this.accent>.5&&this.titleTime>450&&this.elapsed-(this.lastMusicBurst??-1000)>260){this.lastMusicBurst=this.elapsed;for(let i=0;i<3;i++)this.emit(i);}
  this.draw();this.frame=requestAnimationFrame(t=>this.tick(t));
 }
 draw(){
  const c=this.ctx,w=innerWidth,h=innerHeight,dpr=Math.min(2,devicePixelRatio||1);if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const fade=this.phase==='closing'?Math.max(0,1-this.closeTime/350):Math.min(1,this.elapsed/200);c.fillStyle=`rgba(10,9,29,${.77*fade})`;c.fillRect(0,0,w,h);
  const scale=w<h?Math.min(w*.4/780,h*.5/760):Math.min(w/1280,h/760)*.96/3;
  const flash=Math.max(0,1-Math.abs(this.elapsed-240)/460)*.76;if(flash>0){
   const radius=560*scale,light=c.createRadialGradient(w/2,h/2,0,w/2,h/2,radius);
   light.addColorStop(0,`rgba(255,249,223,${flash})`);light.addColorStop(.28,`rgba(255,224,161,${flash*.65})`);light.addColorStop(1,'rgba(255,212,142,0)');
   c.fillStyle=light;c.fillRect(w/2-radius,h/2-radius,radius*2,radius*2);
  }
  c.save();const pop=winnerEntrance(this.elapsed);c.translate(w/2,h/2);c.scale(scale*pop,scale*pop);c.translate(-640,-380);c.globalAlpha=fade;
  const glow=c.createRadialGradient(640,390,70,640,390,540);glow.addColorStop(0,this.tier===3?'#f8b63377':'#ec40d566');glow.addColorStop(1,'#b436c300');c.fillStyle=glow;c.fillRect(0,0,1280,760);
  for(const p of this.particles){const u=winnerFlightProgress(p.age,p.duration),v=1-u,x=v*v*p.x0+2*v*u*p.cx+u*u*p.x1,y=v*v*p.y0+2*v*u*p.cy+u*u*p.y1,fadeOut=Math.max(0,1-Math.max(0,p.age/p.life-.12)/.68);c.save();c.globalAlpha=fade*Math.min(.7,p.age*10)*fadeOut*fadeOut;c.translate(x,y);c.rotate(p.angle);const size=p.size*(.7+.3*Math.min(1,p.age/.18));c.drawImage(this.images.candies[p.color],-size/2,-size/2,size,size);c.restore();}
  const burst=Math.max(0,1-this.titleTime/600);if(burst>0){const tint=['#a7ff75','#eba5ff','#ff8a98','#ffdb6a'][this.tier],light=c.createRadialGradient(640,340,0,640,340,610);light.addColorStop(0,'#fff9e9');light.addColorStop(.25,tint);light.addColorStop(1,tint+'00');c.save();c.globalAlpha=fade*burst;c.fillStyle=light;c.fillRect(0,-270,1280,1250);c.restore();}
  for(const [side,y,angle]of [[1,295,25],[1,419,-7],[-1,295,25],[-1,419,-7]]){c.save();c.translate(side===1?340:940,y);c.scale(side,1);c.rotate((angle+this.accent*3.5)*Math.PI/180);const beat=1+this.pulse*.14+this.accent*.23;c.scale(beat,beat);const img=this.images.trumpet;c.drawImage(img,-285,-70,285,285*img.height/img.width);c.restore();}
  const plaque=this.images.plaque;c.drawImage(plaque,250,169,780,780*plaque.height/plaque.width);
  const title=this.images.titles[this.tier],tw=660,th=tw*title.height/title.width,bounce=1+.25*Math.sin(Math.min(1,this.titleTime/750)*Math.PI)+this.pulse*.08+this.accent*.18;c.save();c.translate(640,312-this.accent*15);c.scale(bounce,bounce);c.drawImage(title,-tw/2,-th/2,tw,th);c.restore();
  const text=this.format(this.value);let font=110;c.font=`${font}px LilitaOne`;while(c.measureText(text).width>650&&font>48){font-=2;c.font=`${font}px LilitaOne`;}c.textAlign='center';c.textBaseline='alphabetic';c.lineJoin='round';c.strokeStyle='#9b4b19';c.lineWidth=8;c.strokeText(text,640,478);const gold=c.createLinearGradient(0,385,0,485);gold.addColorStop(0,'#fff9de');gold.addColorStop(.6,'#ffe497');gold.addColorStop(1,'#eaa93d');c.fillStyle=gold;c.fillText(text,640,478);c.restore();
  this.root.dataset.phase=this.phase;this.root.dataset.amount=this.value.toFixed(4);this.caption.style.opacity=String(fade);
 }
 close(){cancelAnimationFrame(this.frame);this.audio.stop();this.active=false;this.root.hidden=true;this.game.inert=this.previousInert;this.particles=[];this.onClose();if(!this.game.inert&&this.previousFocus?.isConnected)this.previousFocus.focus?.({preventScroll:true});this.resolve?.(true);this.resolve=null;}
}

// Presentation only. The caller supplies the already confirmed bonus state.
class BonusIntro {
 constructor({game,sound,onOpen=()=>{}}){
  Object.assign(this,{game,sound,onOpen});this.active=false;this.continue=null;
  this.root=document.createElement('div');this.root.className='bonus-intro';this.root.hidden=true;this.root.tabIndex=-1;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','Ice bonus');
  this.root.innerHTML='<div class="bonus-intro-dim"></div><section class="bonus-intro-card"><h2>ICE BONUS</h2><div class="bonus-intro-art"><div class="bonus-intro-rays"></div></div><h3></h3><p>Break the ice and collect multipliers.<br>Each magic candy adds one extra move.</p><button id="bonus-intro-continue">TAP TO CONTINUE</button></section>';
  document.body.append(this.root);
  bindConfirmedTap(this.root,()=>this.proceed());
  window.addEventListener('keydown',e=>{if(!this.active||!['Space','Enter','Escape','Tab'].includes(e.code))return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Space')this.swallowSpace=true;if(!e.repeat&&e.code!=='Tab')this.proceed();},true);
  window.addEventListener('keyup',e=>{if(e.code==='Space'&&(this.active||this.swallowSpace)){e.preventDefault();e.stopImmediatePropagation();this.swallowSpace=false;}},true);
 }
 proceed(){if(this.root.dataset.phase==='waiting'){this.root.dataset.phase='returning';this.continue?.();this.continue=null;}}
 async show({moves,prepare}){
  if(this.active)return;this.active=true;this.onOpen();
  const previousFocus=document.activeElement,previousInert=this.game.inert;
  const elements=[...this.game.querySelectorAll('#board,.score>div,.score>b,#message,aside>.balance,aside>.meter-box,aside>.betbox,.controls,#bonus,.space-hint')];
  if(this.game.dataset.layout==='portrait'){const host=this.game.querySelector('.host');if(host)elements.push(host);}
  const stagger=(el,i)=>el.matches('.host')?elements.findIndex(n=>n.id==='board'):i;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,animations=[];
  const motion=(el,keys,ms,delay=0)=>{const a=el.animate(keys,{duration:reduced?1:ms,delay:reduced?0:delay,easing:'cubic-bezier(.22,.7,.25,1)',fill:'both'});animations.push(a);return a.finished;};
  this.game.inert=true;this.root.hidden=false;this.root.dataset.phase='outgoing';this.root.focus({preventScroll:true});
  const dim=this.root.querySelector('.bonus-intro-dim'),card=this.root.querySelector('.bonus-intro-card');dim.style.opacity='0';card.style.opacity='0';
  try{
   this.sound.play('transition');
   await Promise.all(elements.map((el,i)=>motion(el,[{translate:'0 0',opacity:1},{translate:'0 1200px',opacity:0}],650,(stagger(el,i)%3)*45)));
   // Update and capture offscreen, so the base board never jumps to bonus early.
   const url=await prepare();const board=this.root.querySelector('img')??new Image();board.alt='Your ice bonus board';board.src=url;await board.decode();this.root.querySelector('.bonus-intro-art').append(board);
   this.root.querySelector('h3').textContent=String(moves)+' FREE MOVES';this.root.dataset.phase='appearing';this.sound.play('bonus');
   await Promise.all([motion(dim,[{opacity:0},{opacity:1}],320),motion(card,[{opacity:0,transform:'translateY(35px) scale(.68)'},{opacity:1,transform:'translateY(-7px) scale(1.045)',offset:.7},{opacity:1,transform:'translateY(0) scale(1)'}],650)]);
   this.root.dataset.phase='waiting';await new Promise(resolve=>{this.continue=resolve;});
   this.sound.play('transition');
   await Promise.all([motion(card,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.12)'}],240),motion(dim,[{opacity:1},{opacity:0}],420),...elements.map((el,i)=>motion(el,[{translate:'0 1200px',opacity:0},{translate:'0 -9px',opacity:1,offset:.83},{translate:'0 0',opacity:1}],620,90+(stagger(el,i)%3)*30))]);
  }finally{
   animations.forEach(a=>a.cancel());this.root.hidden=true;this.root.dataset.phase='closed';this.game.inert=previousInert;this.active=false;this.continue=null;
   if(!previousInert&&previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});
  }
 }
}

function landingShakeStrength(count,elapsed=Infinity){return count<24||elapsed<6000?0:Math.min(9,6+(count-24)*.14);}
function winBounceStrength(gain,bet){return gain>0?Math.min(.34,.07+.065*Math.log2(1+gain/Math.max(.01,bet))):0;}

const palette=['#32cfff','#ff8216','#ffe240','#76e42e','#ef2940','#cc38f5'];
function frameTexture(){
 const c=document.createElement('canvas');c.width=c.height=711;
 const g=c.getContext('2d');
 const rect=(inset,r)=>{g.beginPath();g.roundRect(inset,inset,711-inset*2,711-inset*2,r);};
 // A uniform 15px rose-lilac rim. Keep the original board opening so cells,
 // hit targets and the rounded piece mask retain their existing geometry.
 g.shadowColor='#25153788';g.shadowBlur=6;g.shadowOffsetY=2;
 rect(8,25);g.fillStyle='#72518e';g.fill();g.shadowColor='transparent';
 const body=g.createLinearGradient(0,8,0,703);
 body.addColorStop(0,'#c59bd8');body.addColorStop(.035,'#b183c5');
 body.addColorStop(.5,'#ad7fc0');body.addColorStop(.965,'#a378b8');body.addColorStop(1,'#87619e');
 rect(9.5,23.5);g.fillStyle=body;g.fill();
 const bevel=g.createLinearGradient(0,10,0,701);
 bevel.addColorStop(0,'#ead4f1b0');bevel.addColorStop(.12,'#d5b4e340');bevel.addColorStop(.85,'#bb91ce30');bevel.addColorStop(1,'#62457670');
 rect(10.5,22.5);g.strokeStyle=bevel;g.lineWidth=1.5;g.stroke();
 rect(22.4,10.6);g.fillStyle='#684b8055';g.fill();
 rect(23.4,9.6);g.fillStyle='#29435c';g.fill();
 return PIXI.Texture.from(c);
}
function candyTexture(type){const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.translate(80,80);let color=palette[type],p=new Path2D();
 if(type===0){p.moveTo(-26,-40);p.bezierCurveTo(20,-52,42,-20,38,10);p.bezierCurveTo(34,51,-8,51,-28,24);p.bezierCurveTo(-51,-1,-48,-28,-26,-40);}
 if(type===1){p.ellipse(0,0,39,48,-.28,0,Math.PI*2);}
 if(type===2){p.ellipse(0,0,48,37,-.35,0,Math.PI*2);}
 if(type===3){p.moveTo(-7,-46);p.quadraticCurveTo(0,-54,10,-42);p.lineTo(44,27);p.quadraticCurveTo(51,43,32,45);p.lineTo(-36,38);p.quadraticCurveTo(-52,36,-43,20);p.closePath();}
 if(type===4){p.moveTo(0,-24);p.bezierCurveTo(-29,-62,-66,-19,-39,9);p.lineTo(0,48);p.lineTo(39,9);p.bezierCurveTo(66,-19,29,-62,0,-24);p.closePath();}
 if(type===5){p.moveTo(-34,-16);p.bezierCurveTo(-32,-53,32,-53,34,-16);p.lineTo(46,24);p.quadraticCurveTo(45,40,29,38);p.quadraticCurveTo(16,48,0,42);p.quadraticCurveTo(-16,48,-29,38);p.quadraticCurveTo(-47,40,-46,24);p.closePath();}
 x.shadowColor='#0009';x.shadowBlur=8;x.shadowOffsetY=7;x.fillStyle='#301236';x.fill(p);x.shadowColor='transparent';let gr=x.createLinearGradient(-20,-50,35,50);gr.addColorStop(0,'#ffffff');gr.addColorStop(.12,color);gr.addColorStop(.60,color);gr.addColorStop(1,'#65113f');x.fillStyle=gr;x.fill(p);x.lineWidth=3;x.strokeStyle=color;x.stroke(p);
 x.save();x.clip(p);let gl=x.createRadialGradient(-20,-28,0,-15,-25,66);gl.addColorStop(0,'#ffffffc9');gl.addColorStop(.32,'#ffffff4a');gl.addColorStop(.7,'#ffffff00');x.fillStyle=gl;x.fillRect(-60,-60,120,120);x.fillStyle='#ffffff77';x.beginPath();x.ellipse(-19,-28,18,7,-.55,0,Math.PI*2);x.fill();x.strokeStyle='#ffffff70';x.lineWidth=3;x.beginPath();x.ellipse(4,5,32,32,.2,.25,1.2);x.stroke();
 if(type===2){x.strokeStyle='#fffbd1';x.lineWidth=4;x.beginPath();for(let i=0;i<=64;i++){const a=i/64*Math.PI*4,r=2+i*.43,px=Math.cos(a)*r,py=Math.sin(a)*r*.78;if(i)x.lineTo(px,py);else x.moveTo(px,py);}x.stroke();}if(type===1){x.strokeStyle='#a64009';x.lineWidth=2;x.beginPath();x.ellipse(1,-4,22,30,-.25,0,Math.PI*2);x.stroke();}x.restore();return PIXI.Texture.from(c);}
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
  const urls=['public/optimized-v1/architecture.webp','public/optimized-v1/skyline.webp','public/optimized-v1/plants.webp'];
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
 trace(direction,payload){try{this.onTrace?.(direction,payload);}catch{/* Diagnostics must never affect a request. */}}
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
   this.arm();try{this.trace('out',payload);this.ws.send(JSON.stringify(payload));}catch{this.fail('Could not send request.');}
  });
 }
 arm(){
  const p=this.pending;if(!p)return;clearTimeout(p.timer);
  if(!this.doc?.hidden)p.timer=setTimeout(()=>{if(this.pending===p&&!this.doc?.hidden)this.fail('Server response timed out.');},this.timeout);
 }
 receive(data){
  // Record even late/unsolicited replies; validation below remains unchanged.
  if(this.onTrace)try{this.trace('in',JSON.parse(data));}catch{this.trace('client',{kind:'invalid-json',message:'Non-JSON response received.'});}
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
  this.logged.add(category);try{const payload={set:'game_log',message:String(message).slice(0,240)};this.trace('out',payload);this.ws.send(JSON.stringify(payload));}catch{}
 }
 fail(message){
  if(this.fault)return;
  this.trace('client',{kind:'fault',message,pending:this.pending?.payload??null});
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
 return Array.from({length:49},(_,i)=>{const c=reels[i%7][Math.floor(i/7)];if(c===0)return null;const v=typeof c==='number'?{id:c}:c;
  // csw1 also serializes empty mask cells as {id:0,multiplier:0}.
  // Only zero-valued empty markers are accepted; never discard real properties.
  if(v?.id===0&&Object.keys(v).every(k=>['id','multiplier','activated'].includes(k)&&v[k]===0))return null;
  if(!v||!Number.isInteger(v.id)||v.id<1||v.id>19)throw Error('Unknown server symbol.');return {...v};});
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
 replay(previous,bet,requested,{mult=1,meter=0,allowMissingHelpers=false,bonus=false}={}){
  if(!bet||!Array.isArray(bet.events))throw Error('Missing server result.');
  const start=rgsMatrix(bet.reels);if(start.some((c,i)=>c?.id!==previous[i]?.serverId))throw Error('Server board differs from the displayed board.');
  if(start.some((c,i)=>c?.id===19&&c.health!==previous[i]?.hp))throw Error('Server ice health changed between moves without a damage event.');
  let board=start.map((c,i)=>this.piece(c,previous[i])),events=[],step=0,win=0,accepted=false,phase='ready',fired=new Map(),damage=new Map(),magicCells=[],moveAwards=[],collected=[],regularGroups=[],payouts=[];
  if(JSON.stringify(board)!==JSON.stringify(previous))events.push({type:'properties',board:structuredClone(board)});
  const properties=mask=>{
   let changed=false;
   mask.forEach((c,i)=>{if(!c||c.multiplier===undefined)return;if(c.id!==board[i]?.serverId)throw Error('Multiplier refers to a different symbol.');
    if(c.id===19){if(c.multiplier!==board[i].mult||(c.health??0)!==(damage.get(i)?.hp??board[i].hp))throw Error('Ice multiplier collection is not verified yet.');return;}
    const next=this.piece({...c,activated:c.activated??board[i].activated},board[i]);
    if(next.mult!==board[i].mult){board[i]=next;changed=true;}
   });
   if(changed)events.push({type:'properties',board:structuredClone(board)});
  };
  for(const e of bet.events){
   if(e.type==='helper')continue;
   if(e.type==='symbol_counter'){
    // csw1 can continue counting after a bonus: captured level 2 reports 4.
    // Three is a HUD threshold, not a protocol maximum. Preserve the server
    // count; awards/bonus entry remain authoritative in ServerRGS.
    if(!accepted||phase!=='ready'||!Number.isSafeInteger(e.count)||e.count<0)throw Error('Invalid magic progress event.');
    const mask=rgsMatrix(e.reels),indices=mask.flatMap((c,i)=>c?[i]:[]);
    if(!indices.length||indices.some(i=>mask[i].id<7||mask[i].id>12||mask[i].id!==board[i]?.serverId))throw Error('Magic collection does not match the board.');
    if(bonus&&e.award!==undefined){
     if(!e.award||e.award.type!==undefined||!Number.isSafeInteger(e.award.number)||e.award.number<1)throw Error('Invalid bonus move award.');
     moveAwards.push({i:indices[0],number:e.award.number});
    }
    meter=e.count;magicCells.push(...indices);continue;
   }
   if(e.type==='round_multiplier'){
    if(!accepted||phase!=='ready')throw Error('Unexpected multiplier event.');
    if(e.reels){const mask=rgsMatrix(e.reels);properties(mask);mask.forEach((c,i)=>{if(c){if(!(c.multiplier>0))throw Error('Invalid collected multiplier.');if(c.id===19&&damage.get(i)?.hp!==0)throw Error('Ice multiplier collection is not verified yet.');collected.push(i);}});}
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
    if(e.win!==undefined){if(!Number.isFinite(e.win)||e.win<0)throw Error('Invalid event win.');win+=e.win;if(e.win>0){const cells=mask.flatMap((c,i)=>c?[i]:[]),colors=[...new Set(cells.map(i=>board[i]?.color).filter(c=>c>=0))];payouts.push({amount:e.win,cells,color:colors.length===1?colors[0]:null});}}continue;
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
    if(magicCells.some(i=>!cells.includes(i))||collected.some(i=>!cells.includes(i)&&!ice.includes(i)))throw Error('Collected symbol was not destroyed.');
    board=clean.map((c,i)=>this.piece(c,board[i]));
    events.push({type:'destroy',cells,ice,moveAwards,regularGroups,payouts,damage:[...damage.keys()],magicCells:[...new Set(magicCells)],collected:[...new Set(collected)],meter,armed:[],effects,step:step++,win:Math.round(win*100)/100,mult,board:structuredClone(board)});damage.clear();magicCells=[];moveAwards=[];collected=[];regularGroups=[];payouts=[];phase='clean';continue;
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
 // RGS confirmed: omitted win in final_win means zero (explicit invalid values do not).
 const win=Object.hasOwn(event,'win')?event.win:0;
 if(!Number.isFinite(win)||win<0)throw Error('Invalid final bonus win.');
 if(event.matrix&&event.reels&&JSON.stringify(event.matrix)!==JSON.stringify(event.reels))throw Error('Conflicting bonus return boards.');
 return {event,index,win,matrix:event.matrix??event.reels};
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
 get playable(){return this.ready&&this.transport.healthy&&!this.transport.pending&&!this.featurePending&&!this.s.pendingBonus&&!this.s.bonus?.awaitingCompletion&&!this.s.awaitingMoves;}
 snapshot(){return structuredClone(this.s);}
 cost(){return this.s.bonus||this.s.freeRounds?0:(this.modeOffer(this.s.mode)?.cost??this.s.bet);}
 moves(){return this.helpers.map(p=>[...p]);}
 modeOffer(value){
  const mode=value==='base'?'main':value;
  if(!['main','luck','enhanced'].includes(mode))return null;
  const multiplier=this.config?.mode_list?.[mode]?.bet_multiplier;
  return Number.isFinite(multiplier)&&multiplier>0?{mode:mode==='main'?'base':mode,serverMode:mode,multiplier,cost:this.s.bet*multiplier}:null;
 }
 async mode(value){
  const offer=this.modeOffer(value);
  if(!this.playable)throw Error('Session is not ready.');
  if(!offer)throw Error('This mode is not available.');
  if(this.s.bonus||this.s.freeRounds)throw Error('Finish the current free moves first.');
  if(offer.mode===this.s.mode)return this.snapshot();
  if(this.s.balance<offer.cost)throw Error('Insufficient balance.');
  this.featurePending=true;
  try{
   const options=await this.transport.request({set:'options',mode:offer.serverMode,ctx:this.ctx});
   if(options.options?.bet_sum!==this.s.bet||this.wallet(options).balance!==this.s.balance)throw Error('Invalid mode selection response.');
   // The emulator's mode flag invalidates the previous matrix. A distinct,
   // explicitly priced entry creates its new board; never send an old swap or
   // a supposedly free reset here. The server charges even action:reset.
   const reply=await this.transport.request({set:'bet',ctx:options.ctx||this.ctx}),bet=reply.bet,wallet=this.wallet(reply);
   const unit=10**(this.s.decimals??2),same=(a,b)=>Number.isFinite(a)&&Math.round(a*unit)===Math.round(b*unit);
   if(typeof bet?.ctx!=='string'||!bet.ctx||bet.bet_sum!==this.s.bet||bet.freespin||bet.bonus||!same(bet.total?.bet,offer.cost)||(bet.total?.win??0)!==0||!same(wallet.balance,this.s.balance-offer.cost)||!Array.isArray(bet.events)||bet.events.some(e=>e.type!=='helper'))throw Error('Server did not confirm the new mode board.');
   const board=this.adapter.initial(bet.reels),helpers=rgsHelpers(bet.events,board);
   if(!helpers.length||board.some(c=>c.kind==='ice'))throw Error('Invalid mode entry board.');
   this.ctx=bet.ctx;this.helpers=helpers;
   this.s={...this.s,mode:offer.mode,board,balance:wallet.balance,version:this.s.version+1,meter:0,mult:1,lastCost:bet.total.bet,awaitingMoves:false,serverWarning:null,
    history:[{time:Date.now(),cost:bet.total.bet,win:0,mult:1,mode:offer.mode,modeEntry:true},...this.s.history].slice(0,100)};
   return this.snapshot();
  }catch(e){this.fail(e.message,true);throw e;}finally{this.featurePending=false;}
 }
 iceOffer(){
  const offer=this.config?.buy_feature?.ice;
  return offer&&Number.isFinite(offer.bet_multiplier)&&offer.bet_multiplier>0&&Number.isSafeInteger(offer.free_spins)&&offer.free_spins>0?{multiplier:offer.bet_multiplier,moves:offer.free_spins,cost:this.s.bet*offer.bet_multiplier}:null;
 }
 async buy(){
  const offer=this.iceOffer();
  if(!this.playable||this.featurePending)throw Error('Session is not ready.');
  if(!offer)throw Error('Ice bonus purchase is not available.');
  if(this.s.mode!=='base')throw Error('Return to Normal play to buy the ice bonus.');
  if(this.s.bonus||this.s.freeRounds)throw Error('Finish the current free moves first.');
  if(this.s.balance<offer.cost)throw Error('Insufficient balance.');
  this.featurePending=true;
  try{
   const reply=await this.transport.request({set:'bet',buy_bonus:'ice',ctx:this.ctx}),bet=reply.bet,wallet=this.wallet(reply);
   const bonus=rgsFreeSpin(bet?.freespin),unit=10**(this.s.decimals??2),same=(a,b)=>Number.isFinite(a)&&Math.round(a*unit)===Math.round(b*unit);
   if(typeof bet?.ctx!=='string'||!bet.ctx||bet.bet_sum!==this.s.bet||!bonus||bonus.counter!==0||bonus.limit!==offer.moves||bet.bonus||!same(bet.total?.bet,offer.cost)||(bet.total?.win??0)!==0||!same(wallet.balance,this.s.balance-offer.cost)||!Array.isArray(bet.events)||bet.events.some(e=>e.type!=='helper'))throw Error('Server did not confirm the ice purchase.');
   const board=this.adapter.initial(bet.reels),helpers=rgsHelpers(bet.events,board);
   if(!helpers.length||board.some((c,i)=>(c.kind==='ice')!==(i>=35))||board.some(c=>c.kind==='ice'&&c.hp!==2))throw Error('Invalid purchased ice board.');
   const base=structuredClone(this.s.board),baseHelpers=this.moves();
   this.ctx=bet.ctx;this.helpers=helpers;
   this.s={...this.s,board,balance:wallet.balance,version:this.s.version+1,mult:1,lastCost:bet.total.bet,awaitingMoves:false,pendingBonus:null,serverWarning:null,
    bonus:{...bonus,base,baseHelpers,bet:this.s.bet,mult:1,lastMoveWin:0,awaitingCompletion:false},
    history:[{time:Date.now(),cost:bet.total.bet,win:0,mult:1,bonus:true,purchase:'ice'},...this.s.history].slice(0,100)};
   return this.snapshot();
  }catch(e){this.fail(e.message,true);throw e;}finally{this.featurePending=false;}
 }
 fail(message,unknown=false){const known=['Invalid free rounds stake.','Invalid free rounds counter.','Invalid free rounds quantity.','Free rounds progress is inconsistent.','Awarded moves need an initial board context from RGS. Reset was not sent.','Award restoration requires a confirmed settled board.','Missing initial game context or bet.','Unexpected game configuration.'];if(known.includes(message))this.transport.log?.('rgs-validation',message+' Play blocked; request not repeated.');this.ready=false;this.transport.unknownOutcome||=unknown;this.transport.fail(message);}
 wallet(reply){const wallet=reply.wallet;if(!wallet||!Number.isFinite(wallet.balance)||wallet.balance<0)throw Error('Invalid server wallet.');if(wallet.currency!==undefined&&!/^[A-Z0-9]{2,8}$/.test(wallet.currency))throw Error('Invalid wallet currency.');if(wallet.decimals!==undefined&&(!Number.isInteger(wallet.decimals)||wallet.decimals<0||wallet.decimals>8))throw Error('Invalid wallet decimals.');return wallet;}
 async initialize(){
  try{
   await this.transport.connect();
   const location={};for(const key of ['href','protocol','host','hostname','pathname','search','hash'])location[key]=this.location?.[key]||'';
   const auth=await this.transport.request({set:'authentication',location});
   if(auth.authentication!==true||auth.is?.test!==true)throw Error('This client requires a confirmed RGS test session.');
   this.sessionEnvironment=auth.is.test?'test':'production';
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
  if(this.s.mode!=='base')throw Error('Return to Normal play to change the base bet.');
  try{
   const reply=await this.transport.request({set:'options',bet_sum:value,ctx:this.ctx});
   if(reply.options?.bet_sum!==value)throw Error('Server did not confirm the selected bet.');
   this.ctx=reply.ctx||this.ctx;this.s.bet=value;return this.snapshot();
  }catch(e){this.fail(e.message);throw e;}
 }
 async enterBonus(){
  if(!this.s.pendingBonus||this.enteringBonus||!this.ready||!this.transport.healthy||this.transport.pending)throw Error('Bonus entry is not ready.');
  const pair=this.helpers[0];if(!pair)throw Error('Bonus entry needs a confirmed server move.');
  this.enteringBonus=true;
  try{return await this.resolveMove(...pair,true);}finally{this.enteringBonus=false;}
 }
 async play(a,b){return this.resolveMove(a,b,false);}
 async resolveMove(a,b,entering=false){
  if(entering?(!this.enteringBonus||!this.s.pendingBonus||!this.ready||!this.transport.healthy||this.transport.pending):!this.playable)throw Error('Session is not ready.');const move=rgsMove(a,b);
  if(this.s.board[a]?.kind==='ice'||this.s.board[b]?.kind==='ice')throw Error('Ice cannot be swapped.');
  // The latest server helper is authoritative. Invalid exchanges must not send
  // a bet: csw1 can return an unrelated/stale board for rejected moves after a
  // cascade. Keep ctx, board, balance and progress unchanged; the UI reverses
  // its visual preview. Do not relax response checks for moves we do submit.
  if(!this.helpers.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a))){
   // Local-only diagnostic: no session context, credentials or automatic request.
   this.lastRejectedMove={pair:[a,b],reason:'not-in-server-helper',board:structuredClone(this.s.board),helpers:this.moves()};
   this.transport.trace?.('client',{kind:'rejected-local-move',...this.lastRejectedMove});
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
   const previousBonus=this.s.bonus;
   const bonus=settlement&&bet.freespin==null?null:rgsFreeSpin(bet.freespin,previousBonus?{...previousBonus,limit:previousBonus.serverLimit??previousBonus.limit}:null),bonusStarted=!!bonus&&!previousBonus;
   // An awarded transition is a distinct request, never another paid swap.
   if(entering&&(!bonusStarted||bonus.limit!==this.s.pendingBonus.number||bet.bonus))throw Error('Server did not confirm the awarded bonus entry.');
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
    result=this.adapter.replay(this.s.board,replayBet,[a,b],{meter:this.s.meter,mult:this.s.bonus?this.s.mult:1,allowMissingHelpers:!settlement,bonus:!!previousBonus});
    if(bonus&&bonus.counter!==this.s.bonus.counter+(result.accepted?1:0))throw Error('Unexpected bonus move counter.');
   }
   if(bonus&&previousBonus){
    const added=result.events.reduce((sum,e)=>sum+(e.moveAwards??[]).reduce((n,a)=>n+a.number,0),0);
    if(!Number.isSafeInteger(previousBonus.limit+added))throw Error('Invalid bonus move award.');
    // award is immediate; freespin.limit may catch up on the next response.
    // Preserve raw progress for validation and do not add that catch-up twice.
    bonus.serverLimit=bonus.limit;bonus.limit=Math.max(bonus.limit,previousBonus.limit+added);bonus.moves=bonus.limit-bonus.counter;
    if(settlement&&bonus.moves!==0)throw Error('Bonus settled with awarded moves remaining.');
    let shownMoves=previousBonus.moves-(result.accepted?1:0);
    for(const e of result.events){if(e.type==='swap')e.moves=shownMoves;if(e.type==='destroy'){shownMoves+=(e.moveAwards??[]).reduce((n,a)=>n+a.number,0);e.moves=shownMoves;}}
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
   let pendingBonus=null;
   if(result.accepted&&!bonus&&!settlement){
    const awards=bet.events.filter(e=>e.type==='symbol_counter'&&e.award);
    for(const e of awards){
     if(e.award.type!=='ice_bonus'||!Number.isSafeInteger(e.award.number)||e.award.number<1)throw Error('Unsupported bonus award.');
     if(pendingBonus&&(pendingBonus.type!==e.award.type||pendingBonus.number!==e.award.number))throw Error('Conflicting bonus awards.');
     pendingBonus={type:e.award.type,number:e.award.number};
    }
   }
   if(!result.accepted)result.mult=this.s.mult;
   const awardResult=result.accepted&&!bonusStarted?settleFreeRounds(this.s.freeRounds,bet.bonus,bet.bet_sum,win,this.s.decimals):{active:this.s.freeRounds,completed:null};
   if(awardResult.completed?.knownWin===null)this.transport.log?.('award-total','Final free rounds total is invalid. Wallet preserved; winnings displayed unavailable.');
   const baseHelpers=bonusStarted?this.moves():this.s.bonus?.baseHelpers;
   this.ctx=bet.ctx;this.helpers=result.helpers;
   const awaitingMoves=result.helpers.length===0&&!bonusStarted;
   if(awaitingMoves)this.transport.log?.('missing-next-moves','Confirmed move settled, but no next moves supplied. Further moves blocked; no reset or retry.');
   this.s={...this.s,pendingBonus,awaitingMoves,freeRounds:awardResult.active,board:result.board,balance:wallet.balance,currency:wallet.currency??this.s.currency,version:this.s.version+1,meter:result.meter,mult:result.mult,
    bonus:!settlement&&bonus?{...bonus,base:bonusStarted?structuredClone(this.s.board):this.s.bonus.base,baseHelpers,bet:this.s.bet,mult:result.mult,lastMoveWin:win,awaitingCompletion:bonus.moves===0}:null,
    serverWarning:(bonus||this.s.freeRounds||bet.bonus)&&cost>0?'RGS issue: bonus move charged '+cost.toFixed(2):null,lastCost:cost};
   if(result.accepted&&!bonusStarted)this.s.history=[{time:Date.now(),cost,win,mult:result.mult,bonus:!!settlement||!!bonus||!!this.s.freeRounds||!!awardResult.completed,...(settlement?{bonusTotalWin:settlement.win}:{})},...this.s.history].slice(0,100);
   return {...result,state:this.snapshot(),win,bonusStarted,bonusEnded:!!settlement,bonusTotalWin:settlement?.win,freeRoundsCompleted:awardResult.completed};
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
 const unique=[...new Set(cells)];
 const rocketHits=unique.filter(i=>rocketCells.has(i)&&board[i]?.kind==='candy').sort((a,b)=>startAt(a)-startAt(b)||a-b);
 const donutTargets=new Set(effects.filter(e=>e.kind==='donut').flatMap(e=>e.targets??[]));
 const donutHits=unique.filter(i=>donutTargets.has(i)&&!rocketCells.has(i)&&board[i]?.kind==='candy');
 const plain=unique.filter(i=>!rocketCells.has(i)&&!donutHits.includes(i));
 const blasts=[];
 // One accent for a confirmed batch of 4+ cells, at its last visual impact.
 // Bomb VFX already plays this cue. Rocket contacts still get individual dry pops.
 if(unique.length>3&&!effects.some(e=>e.kind==='bomb'))
  blasts.push(Math.max(...unique.map(i=>startAt(i)+(rocketCells.has(i)?125:380))));
 const sparkles=unique.length>=4&&!rocketCells.size&&!effects.some(e=>e.kind==='bomb'||e.kind==='rocket');
 return {sparkles,popAt:plain.length?Math.min(...plain.map(startAt)):null,blastTimes:[...new Set(blasts)],rocketHits,donutHits};
}

// A short ribbon follows the same arc as its collectible; stars drift off its tail.
class FlightTrail{
 constructor(color='#ffd965'){
  const ns='http://www.w3.org/2000/svg',make=name=>document.createElementNS(ns,name);
  this.root=make('svg');this.root.classList.add('collection-trail');this.root.setAttribute('aria-hidden','true');
  this.lines=[...Array(3)].map((_,i)=>{const p=make('path');p.setAttribute('fill','none');p.setAttribute('stroke',i===2?'#fff8e9':color);p.setAttribute('stroke-linecap','round');this.root.append(p);return p;});
  this.stars=Array.from({length:40},(_,j)=>{const p=make('path');p.setAttribute('d','M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22 Z');p.setAttribute('fill',j%4===0?'#fff9e9':color);this.root.append(p);return p;});
  document.body.append(this.root);
 }
 tick(point,t,size=40){
  const tail=Math.min(t,.26),points=Array.from({length:18},(_,j)=>point(t-tail+j/17*tail));
  const path=points.map((p,j)=>`${j?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),fade=Math.min(1,t/.12,(1-t)/.12);
  this.lines.forEach((p,j)=>{p.setAttribute('d',path);p.setAttribute('stroke-width',String(size*[.23,.10,.025][j]));p.setAttribute('opacity',String(fade*[.13,.48,.85][j]));});
  this.stars.forEach((p,j)=>{const born=j/(this.stars.length-1)*.82,age=(t-born)/.32;if(age<0||age>1){p.setAttribute('opacity','0');return;}const q=point(born),a=j*2.399963,r=size*(.12+age*.50),s=size*(.045+(j%4)*.014)*Math.sin(Math.PI*age);p.setAttribute('transform',`translate(${q.x+Math.cos(a)*r},${q.y+Math.sin(a)*r+age*size*.15}) rotate(${j*31+age*65}) scale(${s})`);p.setAttribute('opacity',String((1-age)*fade));});
 }
 destroy(){this.root.remove();}
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
 constructor({target,animate,onArrival,sound=()=>()=>{}}){Object.assign(this,{target,animate,onArrival,sound});this.bounceId=0;}
 async fly({from,value,total,fontSize=27}){
  const trail=new FlightTrail('#ffd65b'),stopSound=this.sound();
  const element=document.createElement('span');element.className='multiplier-flight';element.textContent='×'+value;
  element.style.fontSize=fontSize+'px';element.setAttribute('aria-hidden','true');document.body.appendChild(element);
  try{
   await this.animate(570,t=>{
    const r=this.target().getBoundingClientRect(),to={x:r.x+r.width/2,y:r.y+r.height/2};
    const point=u=>multiplierArc(from,to,u*u*(3-2*u));trail.tick(point,t,fontSize*1.3);
    const q=point(t),scale=1+.22*Math.sin(Math.PI*t)-.12*t;
    element.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%) scale(${scale})`;
    element.style.opacity=String(Math.min(1,t/.08));
   });
   element.remove();trail.destroy();stopSound();this.onArrival(total);
   const token=++this.bounceId,target=this.target();
   try{await this.animate(290,t=>{if(token!==this.bounceId)return;const spring=Math.sin(t*Math.PI*2)*Math.exp(-t*3);target.style.transform=`translateY(${-7*spring}px) scale(${1+.25*spring})`;});}
   finally{if(token===this.bounceId)target.style.transform='';}
  }finally{element.remove();trail.destroy();stopSound();}
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
 constructor({animate,sound=()=>()=>{}}){this.animate=animate;this.sound=sound;this.pulses=new WeakMap();}
 async fly({from,url,size,target,onArrival,color}){
  const layer=document.createElement('div');layer.className='magic-flight';layer.setAttribute('aria-hidden','true');
  const trail=new FlightTrail(color),stopSound=this.sound();
  const image=document.createElement('img');image.src=url;image.style.width=size+'px';image.style.height=size+'px';layer.append(image);document.body.append(layer);
  try{
   await this.animate(560,t=>{
    const r=target().getBoundingClientRect(),to={x:r.x+r.width/2,y:r.y+r.height/2};
    const point=u=>multiplierArc(from,to,u*u*(3-2*u));
    const p=point(t),scale=.64+.43*Math.sin(Math.PI*t)-.35*t;
    image.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${Math.sin(Math.PI*t)*18}deg) scale(${scale})`;
    image.style.opacity=String(t>.93?(1-t)/.07:1);
    trail.tick(point,t,size);
   });
   layer.remove();trail.destroy();stopSound();onArrival();
   const el=target(),token={};this.pulses.set(el,token);
   try{await this.animate(240,t=>{if(this.pulses.get(el)!==token)return;el.style.scale=String(1+.45*Math.sin(Math.PI*t)*Math.exp(-t));el.style.filter=`drop-shadow(0 0 ${12*Math.sin(Math.PI*t)}px #ffe08a)`;});}
   finally{if(this.pulses.get(el)===token){el.style.scale='';el.style.filter='';}}
  }finally{layer.remove();trail.destroy();stopSound();}
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
   if(!label){label=this.label('×'+(piece?.mult||value),36,true);label.label='ice-cell-multiplier';label.cellIndex=index;label.alpha=.8;Object.assign(label,this.position(index));this.parent.addChild(label);this.labels.set(index,label);}
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

// Bake white alpha glows once. Canvas2D.filter is not available in every mobile
// browser; three separable box passes approximate a Gaussian without GPU filters.
function softAlphaCanvas(source,sigma){
 const width=source.width,height=source.height,out=document.createElement('canvas');out.width=width;out.height=height;
 const ctx=out.getContext('2d'),pixels=source.getContext('2d').getImageData(0,0,width,height);
 if(sigma<=0){ctx.putImageData(pixels,0,0);return out;}
 let a=new Float32Array(width*height),b=new Float32Array(a.length);
 for(let i=0;i<a.length;i++)a[i]=pixels.data[i*4+3];
 const ideal=Math.sqrt(4*sigma*sigma+1);let low=Math.floor(ideal);if(low%2===0)low--;
 const high=low+2,m=Math.round((12*sigma*sigma-3*low*low-12*low-9)/(-4*low-4));
 const pass=(radius,horizontal)=>{
  const major=horizontal?height:width,minor=horizontal?width:height,stride=horizontal?1:width,divisor=radius*2+1;
  for(let line=0;line<major;line++){
   const base=horizontal?line*width:line;let sum=0;
   for(let j=0;j<=radius&&j<minor;j++)sum+=a[base+j*stride];
   for(let j=0;j<minor;j++){b[base+j*stride]=sum/divisor;const remove=j-radius,add=j+radius+1;if(remove>=0)sum-=a[base+remove*stride];if(add<minor)sum+=a[base+add*stride];}
  }
  [a,b]=[b,a];
 };
 for(let i=0;i<3;i++){const radius=((i<m?low:high)-1)/2;pass(radius,true);pass(radius,false);}
 for(let i=0;i<a.length;i++){pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=255;pixels.data[i*4+3]=Math.round(a[i]);}
 ctx.putImageData(pixels,0,0);return out;
}

// Presentation only. Each candy has its own translucent sugar-fragment silhouette.
const CLEAR_COLORS=['#00baff','#ff7812','#ffd21a','#59e911','#ff243b','#bf20ff'];
function clearParticlePath(g,type){
 g.beginPath();
 if(type===0){g.moveTo(-16,-28);g.lineTo(22,-20);g.quadraticCurveTo(30,-18,27,-8);g.lineTo(19,24);g.quadraticCurveTo(17,31,8,28);g.lineTo(-25,20);g.quadraticCurveTo(-31,18,-28,8);g.lineTo(-23,-21);g.quadraticCurveTo(-22,-29,-16,-28);g.closePath();}
 if(type===1){g.ellipse(0,0,26,28,.3,0,Math.PI*2);}
 if(type===2){g.ellipse(0,0,29,23,-.35,0,Math.PI*2);}
 if(type===3){g.moveTo(-7,-25);g.quadraticCurveTo(0,-34,9,-22);g.lineTo(26,15);g.quadraticCurveTo(31,26,17,26);g.lineTo(-20,26);g.quadraticCurveTo(-32,25,-26,13);g.closePath();}
 if(type===4){g.moveTo(0,-13);g.bezierCurveTo(-19,-38,-39,-13,-24,6);g.bezierCurveTo(-17,16,-5,25,0,29);g.bezierCurveTo(5,25,17,16,24,6);g.bezierCurveTo(39,-13,19,-38,0,-13);g.closePath();}
 if(type===5){g.moveTo(-20,-12);g.bezierCurveTo(-18,-32,18,-32,20,-12);g.lineTo(28,15);g.quadraticCurveTo(27,24,17,23);g.quadraticCurveTo(9,30,0,25);g.quadraticCurveTo(-10,30,-18,23);g.quadraticCurveTo(-29,24,-28,15);g.closePath();}
}
class SymbolClearVFX{
 constructor({parent,background,position,animate}){
  Object.assign(this,{parent,background,position,animate});
  const texture=draw=>{const c=document.createElement('canvas');c.width=c.height=128;draw(c.getContext('2d'));return PIXI.Texture.from(c);};
  this.soft=texture(g=>{const r=g.createRadialGradient(64,64,0,64,64,64);for(const [t,a]of [[0,1],[.22,.65],[.55,.2],[1,0]])r.addColorStop(t,`rgba(255,255,255,${a})`);g.fillStyle=r;g.fillRect(0,0,128,128);});
  this.spark=texture(g=>{g.translate(64,64);g.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4-Math.PI/2,r=j%2?7:48;j?g.lineTo(Math.cos(a)*r,Math.sin(a)*r):g.moveTo(Math.cos(a)*r,Math.sin(a)*r);}g.closePath();g.shadowColor='white';g.shadowBlur=8;g.fillStyle='#fff';g.fill();});
  this.fragments=Array.from({length:6},(_,type)=>texture(g=>{
   g.translate(64,64);clearParticlePath(g,type);const fill=g.createLinearGradient(-23,-26,24,29);fill.addColorStop(0,'#ffffffa0');fill.addColorStop(.35,'#ffffff35');fill.addColorStop(1,'#ffffff08');g.fillStyle=fill;g.fill();g.strokeStyle='#ffffffe0';g.lineWidth=2.4;g.shadowColor='white';g.shadowBlur=5;g.stroke();g.shadowBlur=0;
   g.beginPath();if(type===0){g.moveTo(-16,-28);g.lineTo(-15,13);g.lineTo(19,24);g.moveTo(-15,13);g.lineTo(22,-20);}else if(type===1){g.moveTo(-24,-6);g.bezierCurveTo(-4,0,13,-8,20,-17);g.moveTo(-22,13);g.bezierCurveTo(-3,18,18,9,25,-1);g.moveTo(-13,23);g.quadraticCurveTo(4,25,19,15);}else if(type===2){for(let j=0;j<=42;j++){const a=j/42*Math.PI*3,r=2+j/42*18,x=Math.cos(a)*r,y=Math.sin(a)*r*.75;j?g.lineTo(x,y):g.moveTo(x,y);}}else if(type===3){g.moveTo(0,-20);g.lineTo(19,17);g.lineTo(-20,17);g.closePath();}else if(type===4){g.moveTo(-18,3);g.lineTo(14,-15);g.moveTo(-16,8);g.quadraticCurveTo(-7,18,0,22);}else{g.ellipse(0,-12,19,12,0,0,Math.PI*2);g.moveTo(-13,-3);g.lineTo(-18,23);g.moveTo(10,-2);g.lineTo(17,23);}g.strokeStyle='#ffffff85';g.lineWidth=1.8;g.stroke();
  }));
  // This glow never changes shape: bake the three blurred layers once.
  const cell=document.createElement('canvas');cell.width=cell.height=320;
  const c=cell.getContext('2d');
  for(const [blur,size,radius,alpha,line]of [[24,80,12,.78,0],[16,86,11,.85,11],[5.2,86,10,.9,3.5]]){
   const mask=document.createElement('canvas');mask.width=mask.height=320;const g=mask.getContext('2d');g.scale(2,2);g.translate(80,80);g.beginPath();g.roundRect(-size/2,-size/2,size,size,radius);g.fillStyle=g.strokeStyle=`rgba(255,255,255,${alpha})`;g.lineWidth=line;if(line)g.stroke();else g.fill();c.drawImage(softAlphaCanvas(mask,blur),0,0);
  }
  this.cellTexture=PIXI.Texture.from(cell);
 }
 sprite(parent,texture,tint,size,blend='add'){const s=new PIXI.Sprite(texture);s.anchor.set(.5);s.tint=tint;s.width=s.height=size;s.blendMode=blend;parent.addChild(s);return s;}
 async cell(i,color){
  const layer=new PIXI.Container();layer.label='clear-cell-glow';layer.eventMode='none';Object.assign(layer,this.position(i));this.background.addChild(layer);
  this.sprite(layer,this.cellTexture,color,160,'normal');
  try{await this.animate(790,t=>{layer.alpha=Math.min(1,t/.12)*(1-Math.max(0,(t-.50)/.50)**1.4);});}finally{layer.destroy({children:true});}
 }
 async hit(i,type,sparkles=false){
  const color=CLEAR_COLORS[type],layer=new PIXI.Container();layer.label='symbol-impact-'+type;layer.sparkles=sparkles;layer.eventMode='none';Object.assign(layer,this.position(i));this.parent.addChild(layer);
  const haze=this.sprite(layer,this.soft,color,104,'normal'),flash=this.sprite(layer,this.soft,0xffffff,40);
  const dust=Array.from({length:8},()=>this.sprite(layer,this.soft,color,40));
  const chips=Array.from({length:sparkles?28:23},(_,j)=>({s:this.sprite(layer,sparkles?this.spark:this.fragments[type],color,40),size:sparkles?12+j%4*3:(38+j%5*6)*(.9+(j*17%11)/50),a:j*2.399963+i*.37,r:24+(j*17%47),spin:(j%2?1:-1)*(.6+j%4*.3)}));
  try{await this.animate(790,t=>{
   const out=1-(1-t)**3;haze.width=haze.height=80+45*out;haze.alpha=(1-t)**1.7*.95;flash.width=flash.height=35+15*out;flash.alpha=Math.max(0,1-t*7)*.85;
   dust.forEach((s,j)=>{const a=j*2.399963,r=(14+j%4*9)*out;s.position.set(Math.cos(a)*r,Math.sin(a)*r-35*t);s.width=s.height=30+30*t;s.alpha=Math.sin(Math.PI*t)*(1-t)*.27;});
   chips.forEach(({s,a,r,spin,size},j)=>{s.position.set(Math.cos(a)*(r*out+(sparkles?8:0)),Math.sin(a)*(r*.8*out+(sparkles?8:0))-36*t*t);s.rotation=a+spin*t;s.width=size*(1-.45*t);s.height=sparkles?s.width:s.width*(.76+.24*Math.cos(t*4+j));s.alpha=Math.min(1,t/.045)*(1-t)**.85*(sparkles?.55+.45*Math.sin(t*16+j)**2:1);});
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
  const canvas=softAlphaCanvas(mask,blur*R);
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
 constructor(dpr=1,displayScale=1){this.resize(dpr,displayScale);}
 resize(dpr=1,displayScale=1){
  this.minimum=Math.max(1,Math.min(2,displayScale));
  const next=Math.max(this.minimum,Math.min(2,dpr*displayScale));
  const changed=next!==this.resolution;this.resolution=next;this.reset();return changed?next:null;
 }
 reset(){this.elapsed=0;this.frames=0;this.slow=0;}
 sample(ms,active=true){
  if(!active||!Number.isFinite(ms)||ms<=0||ms>120){this.reset();return null;}
  this.elapsed+=ms;this.frames++;if(ms>24)this.slow++;
  if(this.elapsed<2000)return null;
  const overloaded=this.frames>=20&&this.elapsed/this.frames>22&&this.slow/this.frames>.25;
  this.reset();if(!overloaded||this.resolution<=this.minimum)return null;
  this.resolution=Math.max(this.minimum,this.resolution-.25);return this.resolution;
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

// Two uniformly scaled compositions; renderer coordinates remain square in both.
function mountLayout(element){
 let frame,previousPortrait;
 const rotate=document.getElementById('rotate-screen');
 const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
  const viewport=window.visualViewport,insets=getComputedStyle(document.body);
  const viewportWidth=viewport?.width??innerWidth,viewportHeight=viewport?.height??innerHeight;
  const left=parseFloat(insets.paddingLeft)||0,top=parseFloat(insets.paddingTop)||0;
  const w=Math.max(1,viewportWidth-left-(parseFloat(insets.paddingRight)||0));
  const h=Math.max(1,viewportHeight-top-(parseFloat(insets.paddingBottom)||0));
  const portrait=viewportHeight>=viewportWidth,blocked=false,width=portrait?720:1920,height=portrait?1120:1080,scale=Math.min(1,w/width,h/height);
  element.dataset.layout=portrait?'portrait':'landscape';element.dataset.orientationBlocked='false';
  document.body.dataset.orientation=element.dataset.layout;if(rotate)rotate.hidden=true;
  element.style.setProperty('--stage-scale',String(scale));
  element.style.left=(left+(w-width*scale)/2+(viewport?.offsetLeft||0))+'px';
  element.style.top=(top+(h-height*scale)/2+(viewport?.offsetTop||0))+'px';
  if(previousPortrait!==portrait){previousPortrait=portrait;window.dispatchEvent(new CustomEvent('gameorientationchange',{detail:{blocked,layout:element.dataset.layout}}));}
 });};
 window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);document.fonts?.ready.then(resize);resize();
 return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);};
}


// Each letter is an independent sprite. The moving highlight uses its exact alpha.
async function mountRoyalCandyLogo(host,{canAnimate=()=>true}={}){
 const load=async url=>{const img=new Image();img.src=url;await img.decode();return img;};
 const [base,royal,candy]=await Promise.all([
  load('public/optimized-v1/logo-base.webp'),
  load('public/optimized-v1/logo-royal.webp'),
  load('public/optimized-v1/logo-candy.webp')
 ]);
 host.replaceChildren();host.setAttribute('role','img');host.setAttribute('aria-label','Royal Candy — Match & Win');
 const root=document.createElement('div');root.className='royal-logo';root.setAttribute('aria-hidden','true');host.append(root);
 base.className='royal-logo-base';base.alt='';root.append(base);
 const layers=[];
 function row(img,word,cuts,placements){
  cuts=cuts.map(x=>Math.round(x*img.width/2172));
  const source=document.createElement('canvas');source.width=img.width;source.height=img.height;
  const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const data=ctx.getImageData(0,0,img.width,img.height).data;
  const glyphs=[...word].map((letter,i)=>{
   let left=cuts[i+1],right=cuts[i],top=img.height,bottom=0;
   for(let py=0;py<img.height;py++)for(let px=cuts[i];px<cuts[i+1];px++)if(data[(py*img.width+px)*4+3]>100){left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
   if(right<left)throw Error('Missing logo letter: '+letter);
   left=Math.max(cuts[i],left-3);right=Math.min(cuts[i+1]-1,right+3);top=Math.max(0,top-3);bottom=Math.min(img.height-1,bottom+3);
   const canvas=document.createElement('canvas');canvas.width=right-left+1;canvas.height=bottom-top+1;
   canvas.getContext('2d').drawImage(img,left,top,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
   return {letter,canvas};
  });
  for(const [index,g] of glyphs.entries()){
   const [placedX,y,width,height,angle]=placements[index];
   const x=placedX-20; // Centre both words slightly left within the candy frame.
   const wrap=document.createElement('div');wrap.className='royal-logo-letter';wrap.dataset.letter=g.letter;wrap.dataset.row=word;
   Object.assign(wrap.style,{left:x/1536*100+'%',top:y/1024*100+'%',width:width/1536*100+'%',height:height/1024*100+'%'});
   g.canvas.className='royal-logo-glyph';
   const shine=document.createElement('canvas');shine.width=g.canvas.width;shine.height=g.canvas.height;shine.className='royal-logo-shine';
   const art=document.createElement('div');art.style.cssText='position:absolute;inset:0;transform:rotate('+angle+'deg)';art.append(g.canvas,shine);wrap.append(art);root.append(wrap);layers.push({wrap,canvas:g.canvas,shine,letter:g.letter,row:word,x,y,width,height,angle});
  }
 }
 // Hand-set positions follow the approved generated lettering, not equal-width typesetting.
 row(royal,'ROYAL',[0,440,884,1299,1756,2172],[[265,245,250,285,-3],[490,253,257,275,-3],[689,245,240,285,1],[890,253,248,278,2],[1112,255,210,280,3]]);
 row(candy,'CANDY',[0,435,877,1311,1727,2172],[[168,512,290,280,-5],[422,513,270,275,-2],[660,509,255,278,0],[894,512,260,275,2],[1112,519,248,275,5]]);
 // Crown stays in front of R, including when the first pair lifts.
 const crown=base.cloneNode();crown.className='royal-logo-base royal-logo-crown';crown.style.clipPath='polygon(7% 0,33% 0,32% 22%,13% 31.4%,7% 24%)';root.append(crown);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let timer=0,raf=0,start=0,animations=[],disposed=false;
 const delay=i=>(i%5)*135;
 function cancel(){cancelAnimationFrame(raf);raf=0;for(const a of animations)a.cancel();animations=[];for(const l of layers)l.shine.getContext('2d').clearRect(0,0,l.shine.width,l.shine.height);root.dataset.animating='false';}
 function schedule(ms=12000){clearTimeout(timer);if(!disposed&&!document.hidden&&!reduced.matches)timer=setTimeout(()=>schedule(play()?12000:1000),ms);}
 function highlight(layer,progress){
  const c=layer.shine,ctx=c.getContext('2d'),w=c.width,h=c.height;
  if(progress<=0||progress>=1){if(layer.lit){ctx.clearRect(0,0,w,h);layer.lit=false;}return;}
  ctx.clearRect(0,0,w,h);layer.lit=true;
  ctx.globalCompositeOperation='source-over';ctx.drawImage(layer.canvas,0,0);ctx.globalCompositeOperation='source-in';
  // One light band in logo coordinates, shared by both words. Invert each
  // animated glyph's transform so its mask never restarts a separate sweep.
  const unit=root.clientWidth/1536,m=new DOMMatrix(getComputedStyle(layer.wrap).transform);
  const radians=-layer.angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  const local=(px,py)=>{
   let x=(px-layer.x-layer.width*.5-m.e/unit)/m.a+layer.width*.5;
   let y=(py-layer.y-layer.height*.8-m.f/unit)/m.d+layer.height*.8;
   x-=layer.width*.5;y-=layer.height*.5;
   return [(x*cos-y*sin+layer.width*.5)*w/layer.width,(x*sin+y*cos+layer.height*.5)*h/layer.height];
  };
  const bandX=-520+progress*2220,a=local(bandX,0),b=local(bandX+420,70),g=ctx.createLinearGradient(...a,...b);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.2,'rgba(255,250,236,.06)');g.addColorStop(.4,'rgba(255,253,246,.32)');g.addColorStop(.55,'rgba(255,255,255,.66)');g.addColorStop(.7,'rgba(255,253,246,.3)');g.addColorStop(.9,'rgba(255,250,236,.05)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
 }
 function tick(now){
  if(document.hidden||reduced.matches||!canAnimate()){cancel();return;}
  const elapsed=now-start;for(const layer of layers)highlight(layer,(elapsed-40)/1350);
  if(elapsed<1600)raf=requestAnimationFrame(tick);else cancel();
 }
 function play(){
  cancel();if(disposed||document.hidden||reduced.matches||!canAnimate())return false;
  root.dataset.animating='true';start=performance.now();
  animations=layers.map((l,i)=>l.wrap.animate([
   {transform:'translateY(0) scale(1)',offset:0},
   {transform:'translateY(-4.5%) scale(1.035)',offset:.42},
   {transform:'translateY(.4%) scale(.998)',offset:.85},
   {transform:'translateY(0) scale(1)',offset:1}
  ],{duration:1040,delay:delay(i),easing:'cubic-bezier(.4,0,.25,1)',fill:'none'}));
  raf=requestAnimationFrame(tick);return true;
 }
 const visibility=()=>{cancel();schedule(1800);};document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',visibility);
 const hide=()=>{clearTimeout(timer);cancel();},show=()=>schedule(1800);
 const destroy=()=>{disposed=true;clearTimeout(timer);cancel();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',visibility);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);};
 window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
 host.logoController={play,cancel,destroy,layers};schedule(2200);return host.logoController;
}

// Small illustrations reuse the game's textures; no extra raster atlas or animation loop.
function rulesMarkup(serverMode){
 const art={green:'public/optimized-v1/candy-green.webp',pink:'public/optimized-v1/candy-orange-clean.webp',yellow:'public/optimized-v1/candy-yellow.webp',purple:'public/optimized-v1/candy-purple.webp',bomb:'public/optimized-v1/bomb.webp',rocket:'public/optimized-v1/rocket.webp',donut:'public/optimized-v1/donut.webp',ice:'public/optimized-v1/ice-damaged.webp'};
 const candy=(name,extra='')=>`<span class="rule-symbol ${extra}"><img src="${art[name]}" alt="" width="64" height="64"></span>`;
 const row=(name,count)=>Array.from({length:count},()=>candy(name)).join('');
 const card=(label,visual,title,text)=>`<article class="rule-card"><div class="rule-picture" role="img" aria-label="${label}">${visual}</div><h3>${title}</h3><p>${text}</p></article>`;
 return `<h2>HOW TO PLAY</h2><p class="modal-subtitle">A sweet move can start a royal cascade.</p><div class="rules-grid">
 ${card('Swap two neighbouring candies',candy('green')+'<span class="rule-arrow">↔</span>'+candy('pink'),'Swap & match','Slide a candy into a neighbouring cell. Match 3 or more of the same colour. An invalid swap returns to its starting position.')}
 ${card('Three matching green candies',row('green',3),'Keep the cascade going','Matched candies disappear. New candies fall into the gaps and can create another match.')}
 ${card('Four yellow candies clear a line',row('yellow',4)+'<span class="rule-line"></span>','4 in a line','A straight match of 4 clears a row or column.')}
 ${card('Five pink candies and a colour-clearing donut','<div class="rule-mini-row">'+row('pink',5)+'</div>'+candy('donut'),'5 in a line','A straight match of 5 or more triggers the donut and clears candies of that colour.')}
 ${card('Rocket and bomb boosters',candy('rocket')+candy('bomb'),'A bigger blast','Swap a booster with a neighbour. Rockets clear in their direction; bombs blast the surrounding area. Other clears can trigger boosters too.')}
 ${card('Three glowing magic candies fill the bonus meter',row('purple',3).replaceAll('rule-symbol ','rule-symbol rule-magic '),'Collect the magic','Collect 3 glowing magic candies to unlock the Ice Bonus.')}
 ${card('Damaged ice containing a multiplier',candy('ice')+'<span class="rule-mult">×30</span>','Break the ice','Ice takes 2 hits. Clear nearby candies or hit it with a booster. Collect multipliers as the ice breaks.')}
 ${card('Magic candy and one extra move',candy('purple','rule-magic')+'<span class="rule-extra">+1</span>','Free moves','Play the ice field without paying for each move. Magic candies award extra moves. The bonus finishes with your total win.')}
 </div><section class="rules-controls"><h3>Quick controls</h3><p><kbd>SPACE</kbd> Make an automatic move · hold to repeat</p><p><b>Turbo</b> speeds up play. <b>Auto</b> plays the number of moves you choose. Adjust your bet with <b>− / +</b> or tap the bet panel.</p></section>
 <details class="rules-details"><summary>Bets, modes & winnings</summary><p>${serverMode?'Each paid move uses the price displayed in the bet panel. Extra Luck costs 2× the base bet; Enhanced Moves costs 50×. Switching modes starts a new board for the price shown in the confirmation. The Ice Bonus purchase price is shown before you confirm.':'Normal play costs 1×, Extra Luck 2×, Enhanced Moves 50× and Multi Mayhem 1000× your base bet per move. The Ice Bonus costs 100× for 5 starting free moves.'}</p><p>${serverMode?'Winnings, multipliers and the remaining free moves follow the game result. A match does not necessarily award a win.':'In this demo, each group of 3 cleared candies counts as one chain. Payout = bet × 0.05 × max(chains × multiplier sum − 1, 0). A single match of 3 without a continuation pays nothing.'}</p></details>
 <p class="modal-footnote">${serverMode?'Test credits · Reload starts a new test session.':'Demo credits · Your progress is saved in this browser.'}</p>`;
}

// Local, bounded diagnostics. Never retain contexts/authentication or send requests.
function redactRgs(value){
 const secret=/^(ctx|seed|signin|cookie|set_cookie|set-cookie|authorization|token|access_token|refresh_token|password|secret|eval)$/i;
 if(Array.isArray(value))return value.map(redactRgs);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,secret.test(k)?'[REDACTED]':k==='location'?'[REDACTED]':redactRgs(v)]));
 return value;
}
class RgsDebugLog{
 constructor({limit=120,maxBytes=4*1024*1024,onChange=()=>{}}={}){Object.assign(this,{limit,maxBytes,onChange});this.entries=[];this.sequence=0;this.transaction=0;this.bytes=0;}
 add(direction,payload){
  if(direction==='out'&&payload.set!=='game_log')this.transaction++;
  const entry={id:++this.sequence,time:new Date().toISOString(),transaction:this.transaction,direction,payload:redactRgs(payload)};
  entry.bytes=JSON.stringify(entry).length*2;this.entries.push(entry);this.bytes+=entry.bytes;
  while(this.entries.length>1&&(this.entries.length>this.limit||this.bytes>this.maxBytes))this.bytes-=this.entries.shift().bytes;
  this.onChange(entry);return entry;
 }
 clear(){this.entries=[];this.bytes=0;this.onChange();}
 export(entries=this.entries){return JSON.stringify({game:'csw1',capturedAt:new Date().toISOString(),redacted:true,messages:entries.map(({bytes,...e})=>e)},null,2);}
 lastMove(){
  const request=this.entries.findLast(e=>e.direction==='out'&&e.payload.set==='bet');
  if(!request)return this.export();
  const previous=this.entries.findLast(e=>e.id<request.id&&e.direction==='in'&&e.payload.bet);
  return this.export(this.entries.filter(e=>e===previous||e.transaction===request.transaction||e.id>request.id));
 }
}
function mountRgsDebug({transport,board,serverMode}){
 const root=document.createElement('section');root.id='rgs-debug';root.setAttribute('aria-label','RGS diagnostics');
 root.innerHTML='<div class="rgs-debug-head"><b>RGS LOG</b><button type="button" data-debug="collapse" aria-expanded="true">Свернуть</button></div><div class="rgs-debug-body"><p class="rgs-debug-note"></p><div class="rgs-debug-actions"><button type="button" data-debug="turn">Копировать ход</button><button type="button" data-debug="all">Весь лог</button><button type="button" data-debug="clear">Очистить</button></div><select size="5" aria-label="Сообщения RGS"></select><button type="button" data-debug="one">Копировать сообщение</button><textarea readonly spellcheck="false" aria-label="JSON сообщения RGS"></textarea><p class="rgs-debug-feedback" role="status"></p></div>';
 document.body.append(root);
 const select=root.querySelector('select'),details=root.querySelector('textarea'),feedback=root.querySelector('.rgs-debug-feedback');
 root.querySelector('.rgs-debug-note').textContent=serverMode?'Команды → / ответы ←. «Ход» включает предыдущее поле, запрос, ответ и ошибку. Секреты скрыты.':'Локальное демо: запросов RGS нет. Панель запишет обмен при запуске серверной игры.';
 let frame=0,selected=null,follow=true;
 const log=new RgsDebugLog({onChange:()=>{if(!frame)frame=requestAnimationFrame(render);}});
 const summary=e=>{const p=e.payload,b=p.bet,q=p.on??p,events=b?.events?.map(e=>e.type).filter((v,i,a)=>a.indexOf(v)===i).join(', ');return `${e.id} ${e.time.slice(11,19)} ${e.direction==='out'?'→':e.direction==='in'?'←':'!'} ${q.set??p.kind??''} ${q.action??''}${q.column!==undefined?' ['+q.column+','+q.row+'] '+q.direction:''}${p.message?' '+p.message:''}${events?' · '+events:''}`;};
 function render(){frame=0;select.replaceChildren();for(const e of log.entries){const option=document.createElement('option');option.value=String(e.id);option.textContent=summary(e);select.append(option);}if(follow)selected=log.entries.at(-1)?.id;const entry=log.entries.find(e=>e.id===selected)??log.entries.at(-1);selected=entry?.id;select.value=String(selected??'');details.value=entry?JSON.stringify(entry.payload,null,2):'';if(follow)select.scrollTop=select.scrollHeight;}
 select.addEventListener('change',()=>{selected=Number(select.value);follow=selected===log.entries.at(-1)?.id;render();});
 async function copy(text){try{await navigator.clipboard.writeText(text);feedback.textContent='Скопировано';}catch{details.value=text;details.focus();details.select();try{if(!document.execCommand('copy'))throw Error();feedback.textContent='Скопировано';}catch{feedback.textContent='Текст выделен — нажмите «Копировать» или Ctrl+C.';}}}
 root.querySelector('[data-debug=turn]').onclick=()=>copy(log.lastMove());
 root.querySelector('[data-debug=all]').onclick=()=>copy(log.export());
 root.querySelector('[data-debug=one]').onclick=()=>copy(details.value);
 root.querySelector('[data-debug=clear]').onclick=()=>{log.clear();feedback.textContent='Локальный журнал очищен';};
 root.querySelector('[data-debug=collapse]').onclick=e=>{const collapsed=root.classList.toggle('collapsed');e.currentTarget.textContent=collapsed?'Развернуть':'Свернуть';e.currentTarget.setAttribute('aria-expanded',String(!collapsed));};
 const place=()=>{const r=board.getBoundingClientRect(),room=r.left-16,compact=room<220;root.classList.toggle('compact',compact);root.style.left=(compact?8:Math.max(8,r.left-Math.min(350,room)-8))+'px';root.style.top=(compact?8:Math.max(8,r.top))+'px';root.style.width=(compact?Math.min(350,innerWidth-16):Math.min(350,room))+'px';root.style.maxHeight=Math.max(120,innerHeight-(compact?8:Math.max(8,r.top))-8)+'px';};
 const resize=new ResizeObserver(place);resize.observe(board);window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);window.addEventListener('gameorientationchange',()=>requestAnimationFrame(place));place();
 if(innerHeight>=innerWidth){root.classList.add('collapsed');root.querySelector('[data-debug=collapse]').textContent='Развернуть';root.querySelector('[data-debug=collapse]').setAttribute('aria-expanded','false');}
 if(transport)transport.onTrace=(direction,payload)=>log.add(direction,payload);
 log.add('client',{kind:'session',mode:serverMode?'RGS':'local-demo',url:location.origin+location.pathname});
 return log;
}

async function startGame(){
const $=s=>document.querySelector(s), money=n=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:state?.decimals??2,maximumFractionDigits:state?.decimals??2}):'—';
mountLayout($('#game'));
const orientationBlocked=()=>$('#game').dataset.orientationBlocked==='true';
const sceneReady=prepareTask('scene',async()=>{await Promise.all([mountKingdom($('#game')),mountRoyalCandyLogo($('.brand'),{canAnimate:()=>startupComplete&&!busy&&!$('#dialog').open}),...[...document.images].map(img=>img.decode())]);}).then(()=>null,error=>error);
const params=new URLSearchParams(location.search),serverMode=params.get('mode')!=='demo';
const visualPreview=!serverMode&&params.get('preview')==='vfx';
const KEY='sweet-cascade-v1';let saved;if(!visualPreview)try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}

const rgs=serverMode?new ServerRGS({onFault:message=>{if(!startupComplete)failStartup(message==='Awarded moves need an initial board context from RGS. Reset was not sent.'?'RGS did not provide the board context for your free moves. Waiting for a server fix.':'Connection could not be prepared. Please reload.');else queueMicrotask(showConnectionFault);}}):new DemoRGS(saved),sound=new Sound();let state=rgs.snapshot(),busy=serverMode,held=false,auto=0,speed=1,selected=null,displayWin=state.bonus?.win||0,displayMult=state.bonus?.mult||1,lastInput=Date.now();
if(params.get('rgslog')!=='0'&&(serverMode||params.has('qa')||params.get('rgslog')==='1'))mountRgsDebug({transport:rgs.transport,board:$('#board'),serverMode});
let startupComplete=false,roundRunning=false,fastRequested=false,persistentTurbo=false,autoTimer=null;
const winner=new WinnerOverlay({sound,game:$('#game'),onOpen:()=>{hold.cancel();fastRequested=false;updateSpeed();swipeHint.reset();symbolHint.reset();},onClose:()=>{lastInput=Date.now();}});
const bonusIntro=new BonusIntro({sound,game:$('#game'),onOpen:()=>{stop();swipeHint.reset();symbolHint.reset();}});
const sessionReady=prepareTask('session',async()=>serverMode?await rgs.initialize():rgs.snapshot()).then(value=>({value}),error=>({error}));
await Promise.all([prepareTask('font',()=>Promise.all([document.fonts.load('700 28px Alexandria'),document.fonts.load('400 30px LilitaOne')])),prepareTask('audio',()=>sound.loadSamples()),prepareTask('winners',()=>winner.ready)]);
const sceneError=await sceneReady;if(sceneError)throw sceneError;
const renderBudget=new RenderBudget(devicePixelRatio,$('#board').getBoundingClientRect().width/711);const app=new PIXI.Application();await prepareTask('renderer',()=>app.init({width:711,height:711,backgroundAlpha:0,antialias:true,resolution:renderBudget.resolution,autoDensity:true,preference:'webgl'}));$('#board').appendChild(app.canvas);
let densityFrame=0;const syncBoardDensity=()=>{cancelAnimationFrame(densityFrame);densityFrame=requestAnimationFrame(()=>{const density=renderBudget.resize(devicePixelRatio,app.canvas.getBoundingClientRect().width/711);if(density!==null)app.renderer.resize(711,711,density);});};
window.addEventListener('resize',syncBoardDensity);window.visualViewport?.addEventListener('resize',syncBoardDensity);

const stage=new PIXI.Container();app.stage.addChild(stage);const boardOffset=(711-(6*94+92))/2-20;stage.position.set(boardOffset,boardOffset);const frame=new PIXI.Sprite(frameTexture());frame.position.set(-boardOffset,-boardOffset);stage.addChild(frame);const bg=new PIXI.Graphics();stage.addChild(bg);
for(let i=0;i<49;i++){const x=20+i%7*94,y=20+Math.floor(i/7)*94;bg.roundRect(x,y,92,92,9).fill((Math.floor(i/7)+i%7)%2?0x1b2742:0x142039).stroke({color:0x34405e,width:1});}
const hoverCell=new PIXI.Graphics().roundRect(-45,-45,90,90,8).fill(0x405b89);hoverCell.label='cell-hover-fill';hoverCell.alpha=0;hoverCell.eventMode='none';bg.addChild(hoverCell);let hoveredCell=null,hoverOpacity=0;
const pieces=new PIXI.Container(),fx=new PIXI.Container();pieces.label="board-pieces";pieces.eventMode="none";fx.label="board-effects";stage.addChild(pieces,fx);const textures=Array.from({length:6},(_,i)=>candyTexture(i)),special={bomb:specialTexture('bomb'),ice:specialTexture('ice'),rocket:Array.from({length:4},(_,i)=>specialTexture('rocket',i))};const nodes=new Map();let visual=[];const anims=[],particles=[];
const candyBounds=[],iceTextures=[],boosterArt={};
await prepareTask('boosters',async()=>{for(const [kind,url]of [['bomb','public/optimized-v1/bomb.webp'],['rocket','public/optimized-v1/rocket.webp']]){const texture=await PIXI.Assets.load(url),w=texture.width,h=texture.height,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.source.resource,0,0);const pixels=ctx.getImageData(0,0,w,h).data;let left=w,top=h,right=0,bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}boosterArt[kind]={texture,w,h,cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};}});
try{const atlas=await prepareTask('ice',()=>PIXI.Assets.load('public/optimized-v1/ice-atlas.webp'));for(const [i,frame]of [0,2].entries())iceTextures[i]=new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(frame*256,0,256,256)});}catch(e){throw e;}
iceTextures[1]=await prepareTask('damaged-ice',()=>PIXI.Assets.load('public/optimized-v1/ice-damaged.webp'));
function symbolGlow(n,color=0xffefac,alpha=.65,spread=1.1,blur=7){const g=bakedSymbolGlow(n.sprite,n.baseSpriteScale,n.baseSpriteScaleY,blur);g.tint=color;g.glowSpread=spread;g.blendMode="add";g.alpha=alpha;n.addChildAt(g,0);(n.glows??=[]).push(g);return g;}
function signature(c){return [c.kind,c.color,c.hp,c.magic,c.mult,c.dir].join(':');}
// Runtime candies are 256px; keep bounds in texture pixels for every consumer.
// Glows, fragments, hint masks and magic flights share these exact alpha edges.
await prepareTask('candies',async()=>{
 for(const [type,url]of [[0,'public/optimized-v1/candy-blue.webp'],[1,'public/optimized-v1/candy-orange-clean.webp'],[2,'public/optimized-v1/candy-yellow.webp'],[3,'public/optimized-v1/candy-green.webp'],[4,'public/optimized-v1/candy-red.webp'],[5,'public/optimized-v1/candy-purple.webp']]){
  const texture=await PIXI.Assets.load(url),w=texture.width,h=texture.height;
  texture.source.scaleMode='linear';
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.source.resource,0,0);
  const pixels=ctx.getImageData(0,0,w,h).data;let left=w,top=h,right=-1,bottom=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right<left)throw Error('Empty candy sprite: '+url);
  textures[type]=texture;candyBounds[type]={cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};
 }
});
const pos=i=>({x:66+i%7*94,y:66+Math.floor(i/7)*94});
const swipeHint=new SwipeHint(stage,pos);
let hintSoundPlayed=false;
document.addEventListener('click',e=>{if(e.target.closest('#settings,#history,#rules,#auto,#bonus,#close,[data-count],[data-mode]')){sound.unlock();sound.play('click');}},true);
const symbolHint=new SymbolHint();
const symbolClearVFX=new SymbolClearVFX({parent:fx,background:bg,position:pos,animate});
let boardWaveElapsed=-1,boardWaveOrigin={column:3,row:3};
async function settleBoard(origin=boardWaveOrigin){boardWaveOrigin={...origin};try{await animate(BOARD_WAVE_MS,t=>{boardWaveElapsed=t*BOARD_WAVE_MS;});}finally{boardWaveElapsed=-1;}}
const boosterVFX=new BoosterVFX({parent:fx,position:pos,node:i=>nodes.get(visual[i]?.id),art:kind=>boosterArt[kind],animate,pause,sound:name=>sound.play(name),loop:name=>sound.loop(name)});
const donutTexture=await prepareTask('donut',()=>PIXI.Assets.load('public/optimized-v1/donut.webp'));
const donutVFX=new DonutVFX({parent:fx,position:pos,texture:donutTexture,animate,sound:(name,step)=>sound.play(name,step),loop:name=>sound.loop(name)});
document.addEventListener('pointerdown',()=>swipeHint.reset(),{capture:true});
document.addEventListener('keydown',()=>swipeHint.reset(),{capture:true});
document.addEventListener('pointerdown',()=>symbolHint.reset(),{capture:true});
document.addEventListener('keydown',()=>symbolHint.reset(),{capture:true});
function tween(obj,to,ms=200,ease=t=>1-(1-t)**3){const from={};for(const k in to)from[k]=obj[k];return new Promise(resolve=>anims.push({obj,to,from,ms:ms/speed,t:0,ease,resolve}));}
function pause(ms){return tween({v:0},{v:1},ms);}
function animate(ms,update){let value=0;const clock={get progress(){return value;},set progress(v){value=v;update(v);}};update(0);return tween(clock,{progress:1},ms,t=>t);}
const multiplierFlights=new MultiplierFlights({sound:()=>{sound.play('flightWhoosh');return ()=>{};},target:()=>$('#mult-value'),animate,onArrival:total=>{displayMult=total;hud();sound.play('multiplier');}});
function flyMultiplier(i,value,total){const r=app.canvas.getBoundingClientRect(),p=stage.toGlobal(pos(i)),from={x:r.left+p.x*r.width/711,y:r.top+p.y*r.height/711};return multiplierFlights.fly({from,value,total,fontSize:Math.max(18,35*r.width/711)});}
const magicFlights=new MagicFlights({animate,sound:()=>{sound.play('flightWhoosh');return ()=>{};}}),magicImages=new Map();
function flyMagic(i,c,total){
 const r=app.canvas.getBoundingClientRect(),p=stage.toGlobal(pos(i)),from={x:r.left+p.x*r.width/711,y:r.top+p.y*r.height/711};
 if(!magicImages.has(c.color)){
  const texture=textures[c.color],frame=texture.frame,b=candyBounds[c.color],canvas=document.createElement('canvas');canvas.width=canvas.height=160;
  const ctx=canvas.getContext('2d'),side=b?.size??frame.width;
  ctx.drawImage(texture.source.resource,frame.x+(b?b.cx-side/2:0),frame.y+(b?b.cy-side/2:0),side,side,0,0,160,160);
  magicImages.set(c.color,canvas.toDataURL());
 }
 const slot=Math.max(0,Math.min(2,total-1));
 return magicFlights.fly({from,url:magicImages.get(c.color),color:CLEAR_COLORS[c.color],size:Math.max(28,80*r.width/711),target:()=>$('#meter').getClientRects().length?$('#meter').querySelectorAll('.meter-target')[slot]:$('#meter-title'),onArrival:()=>{state.meter=total;hud();sound.play('magic');}});
}
function label(text,size=28,color='#ffffff'){const t=new PIXI.Text({text,style:{fontFamily:'LilitaOne',fontSize:size,fontWeight:'400',fill:color}});t.anchor.set(.5);return t;}
function multiplierLabel(text,size=36,muted=false){
 const t=new PIXI.Text({text,style:{fontFamily:'LilitaOne',fontSize:size,fontWeight:'400',fill:muted?'#cbdde9':'#ffe69b',stroke:{color:muted?'#3f5278':'#63346f',width:muted?3.5:4.5,join:'round'},dropShadow:{color:muted?'#293c60':'#44204d',blur:0,distance:muted?1.5:2.5,angle:Math.PI/2,alpha:muted?.3:.7},padding:5}});
 t.anchor.set(.5);if(t.width>76)t.scale.set(76/t.width);t.baseLabelScale=t.scale.x;return t;
}
const iceMarkLayer=new PIXI.Container();iceMarkLayer.label='ice-multiplier-marks';iceMarkLayer.eventMode='none';stage.addChildAt(iceMarkLayer,stage.getChildIndex(fx));
const iceMarks=new IceMultiplierMarks({parent:iceMarkLayer,position:pos,label:multiplierLabel});
function make(c){const n=new PIXI.Container();n.cid=c.id;n.signature=signature(c);n.kind=c.kind;n.color=c.color;let texture=c.kind==='candy'?textures[c.color]:c.kind==='rocket'?special.rocket[c.dir]:c.kind==='ice'&&iceTextures.length?iceTextures[c.hp<=1?1:0]:special[c.kind];const s=new PIXI.Sprite(texture||textures[c.color]);s.anchor.set(.5);s.width=s.height=c.kind==='ice'&&iceTextures.length?104:80;if(c.kind==='candy'&&candyBounds[c.color]){const b=candyBounds[c.color];s.anchor.set(b.cx/texture.width,b.cy/texture.height);s.width=80*texture.width/b.size*(c.color===1?.92:1);s.height=80*texture.height/b.size*(c.color===1?.92:1);}if(boosterArt[c.kind]){const art=boosterArt[c.kind];s.texture=art.texture;s.anchor.set(art.cx/art.w,art.cy/art.h);s.width=84*art.w/art.size;s.height=84*art.h/art.size;if(c.kind==='rocket')s.rotation=c.dir*Math.PI/2;}n.baseSpriteScale=s.scale.x;n.baseSpriteScaleY=s.scale.y;n.baseSpriteRotation=s.rotation;n.phase=(Number(c.id)*2.399963)||Math.random()*6.28;n.idleRate=.85+((Number(c.id)*.618)%1)*.35;n.addChild(s);n.sprite=s;n.eventMode='none';if(c.kind==='bomb'||c.kind==='rocket'){const aura=symbolGlow(n,0xffc75a,.6,1.16,6),rim=symbolGlow(n,0xfff0b0,.72,1.055,1.8);aura.label='booster-idle-aura';rim.label='booster-idle-rim';}if(c.magic)n.magicRing=symbolGlow(n,0xffdf73,.9,1.22,3.5);if(c.mult){const b=multiplierLabel('×'+c.mult,c.kind==='ice'?36:35,c.kind==='ice');b.position.set(0,0);n.multiplierLabel=b;if(c.kind==='ice'){const damage=c.hp<=1?1:0;b.visible=damage>0;b.alpha=.64;n.addChild(b);s.alpha=damage===0?1:.94;}else n.addChild(b);}if(c.kind==='ice'&&!iceTextures.length&&c.hp<=1){const cracks=new PIXI.Graphics().moveTo(-25,-42).lineTo(2,-9).lineTo(-16,8).lineTo(22,40).stroke({color:0xd8fbff,width:3});n.addChild(cracks);}pieces.addChild(n);nodes.set(c.id,n);return n;}

function updateHintShine(n,phase){
 if(phase<0||busy||n.clearing||n.whiteOverlay){if(n.hintShine)n.hintShine.visible=false;if(n.hintMask){n.hintMask.visible=false;n.hintMask.clear();}return;}
 if(!n.hintShine){const sprite=bakedSymbolGlow(n.sprite,n.baseSpriteScale,n.baseSpriteScaleY,0);sprite.blendMode='add';const mask=new PIXI.Graphics();n.addChild(mask,sprite);sprite.mask=mask;n.hintShine=sprite;n.hintMask=mask;}
 const shine=n.hintShine;shine.visible=true;n.hintMask.visible=true;shine.position.copyFrom(n.sprite.position);shine.scale.set(n.sprite.scale.x*shine.glowScaleX,n.sprite.scale.y*shine.glowScaleY);shine.rotation=n.sprite.rotation;shine.alpha=.8*Math.sin(Math.PI*phase);
 const x=-95+190*phase;n.hintMask.clear().poly([x-28,-80,x-5,-80,x+55,80,x+32,80]).fill(0xffffff);
}
function draw(board){const ids=new Set(board.filter(Boolean).map(c=>c.id));for(const[id,n]of nodes)if(!ids.has(id)){n.destroy({children:true});nodes.delete(id);}board.forEach((c,i)=>{if(!c)return;let n=nodes.get(c.id);if(n&&n.signature!==signature(c)){n.destroy({children:true});nodes.delete(c.id);n=null;}if(!n)n=make(c);n.index=i;Object.assign(n,pos(i));});visual=clone(board);iceMarks.sync(board,nodes);}
async function presentBonus(){
 displayWin=0;displayMult=1;
 await bonusIntro.show({moves:state.bonus.moves,prepare:()=>{draw(state.board);hud();app.render();return app.renderer.extract.canvas({target:app.stage}).toDataURL('image/png');}});
 lastInput=Date.now();
}
const boardMask=new PIXI.Graphics().roundRect(20,20,658,658,8).fill(0xffffff);stage.addChild(boardMask);pieces.mask=boardMask;
async function fall(board){
 const ids=new Set(board.filter(Boolean).map(c=>c.id));for(const[id,n]of nodes)if(!ids.has(id)){n.destroy({children:true});nodes.delete(id);}
 let magicArrivalPlayed=false,fallingCount=0,shakeStarted=false;const jobs=[],newCount=Array(7).fill(0),ranks=Array(7).fill(0);
 board.forEach((c,i)=>{if(!nodes.has(c.id))newCount[i%7]++;});
 board.forEach((c,i)=>{
  const newMagic=!!c.magic&&!nodes.has(c.id);let n=nodes.get(c.id),p=pos(i),col=i%7;
  if(n&&n.signature!==signature(c)){const previousPosition={x:n.x,y:n.y};n.destroy({children:true});nodes.delete(c.id);n=make(c);Object.assign(n,previousPosition);}
  if(!n){n=make(c);n.x=p.x;n.y=66-(newCount[col]-ranks[col]++)*94;}
  n.index=i;const distance=Math.abs(n.y-p.y);
  if(distance>1){fallingCount++;jobs.push((async()=>{
   await pause(col*5);const duration=Math.min(280,100+Math.sqrt(distance)*3.6),fromY=n.y,impact=landingImpact(distance);
   await animate(duration,t=>{const stretch=t*t*impact;n.y=fromY+(p.y-fromY)*t*t-40*.22*stretch;n.scale.set(1-.14*stretch,1+.22*stretch);});
   if(!shakeStarted&&landingShakeStrength(fallingCount)){shakeStarted=true;shakeBoard(fallingCount);}
   if(newMagic&&!magicArrivalPlayed){magicArrivalPlayed=true;sound.play('magicAppear');}
   // Ordinary landings remain silent.
   try{await animate(LANDING_MS,t=>{const pose=landingPose(t*LANDING_MS,impact,n.phase);n.scale.set(pose.sx,pose.sy);n.y=p.y+pose.y;n.rotation=pose.rotation;});}
   finally{n.scale.set(1);n.rotation=0;n.y=p.y;}
  })());}
 });
 await Promise.all(jobs);visual=clone(board);iceMarks.sync(board,nodes);
}
let boardShake,winBounce,lastHudWin=displayWin,lastBoardShake=-Infinity;
function shakeBoard(count){
 const now=performance.now(),strength=landingShakeStrength(count,now-lastBoardShake);if(!strength||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 lastBoardShake=now;
 boardShake?.cancel();const el=$('#board');el.dataset.impact=String(count);
 boardShake=el.animate([{translate:'0 0'},{translate:`${-strength*.35}px ${strength}px`},{translate:`${strength*.55}px ${-strength*.7}px`},{translate:`${-strength*.3}px ${strength*.45}px`},{translate:`${strength*.15}px ${-strength*.2}px`},{translate:'0 0'}],{duration:360,easing:'ease-out'});
}
function bounceWin(gain){
 const strength=winBounceStrength(gain,state.bonus?.bet??state.bet);if(!strength||!startupComplete||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 winBounce?.cancel();const el=$('#win');el.dataset.bounce=String(strength);
 winBounce=el.animate([{scale:'1',translate:'0 0'},{scale:String(1+strength),translate:`0 ${-strength*24}px`,offset:.24},{scale:String(1-strength*.16),translate:'0 1px',offset:.53},{scale:String(1+strength*.18),translate:'0 -1px',offset:.72},{scale:'1',translate:'0 0'}],{duration:460+strength*320,easing:'ease-out'});
}
function burst(i,color,count=16){let p=pos(i);for(let k=0;k<count;k++){const g=new PIXI.Graphics(),r=2+Math.random()*4;const tint=k%5===0?0xffffff:color;if(k%5===0){g.moveTo(0,-r*2).lineTo(r*.5,-r*.5).lineTo(r*2,0).lineTo(r*.5,r*.5).lineTo(0,r*2).lineTo(-r*.5,r*.5).lineTo(-r*2,0).lineTo(-r*.5,-r*.5).closePath().fill(tint);}else g.circle(0,0,r).fill(tint);g.circle(0,0,r*2.5).fill({color:tint,alpha:.11});g.x=p.x;g.y=p.y;g.blendMode='add';fx.addChild(g);const a=Math.random()*Math.PI*2,v=65+Math.random()*155;particles.push({g,vx:Math.cos(a)*v,vy:Math.sin(a)*v-65,life:.45+Math.random()*.4,total:.85});}}
function cellGlow(i){const c=visual[i];return symbolClearVFX.cell(i,c?.kind==='ice'?0xb7edff:CLEAR_COLORS[c?.color]??0xffdc86);}
async function dissolveSymbol(i,onImpact=()=>{},quick=false,sparkles=false,sparkleAudio=true){
 const shrink=quick?85:270,rebound=quick?40:110,fade=quick?80:115;
 const c=visual[i],n=nodes.get(c?.id);if(!n)return;iceMarks.hide(i);n.clearing=true;updateHintShine(n,-1);if(n.hintShine){n.hintShine.mask=null;n.hintShine.destroy();n.hintMask.destroy();n.hintShine=n.hintMask=null;}
 cellGlow(i);n.white={v:0};n.whiteOverlay=symbolGlow(n,0xffffff,0,1,0);n.whiteOverlay.blendMode='normal';n.whiteOverlay.label='clear-white-silhouette';n.addChild(n.whiteOverlay);
 const color=c.kind==='ice'?0xb7edff:CLEAR_COLORS[c.color]??0xffdc86;
 const halo=symbolGlow(n,color,0,1.32,9),rim=symbolGlow(n,color,0,1.13,3.4);halo.blendMode='normal';rim.blendMode='add';halo.label='clear-color-halo';rim.label='clear-color-rim';
 await Promise.all([tween(n.scale,{x:.5,y:.5},shrink,t=>t*t),tween(n.white,{v:1},shrink),tween(halo,{alpha:.95},Math.min(200,shrink)),tween(rim,{alpha:.8},shrink)]);
 await tween(n.scale,{x:.64,y:.64},rebound,t=>1-(1-t)**2);
 if(c.kind==='candy'){const stopSparkles=sparkles&&sparkleAudio?sound.beginSparkles():()=>{};symbolClearVFX.hit(i,c.color,sparkles).finally(stopSparkles);}else{popFlash(i,color);burst(i,color,c.kind==='ice'?36:32);}
 onImpact(c);
 await Promise.all([tween(n.scale,{x:.02,y:.02},fade,t=>t*t),tween(n,{alpha:0},fade)]);
}
function popFlash(i,color){const g=new PIXI.Graphics();for(let r=40;r>0;r-=4)g.circle(0,0,r).fill({color:r<14?0xffffff:color,alpha:r<14?.7:.1});Object.assign(g,pos(i));g.blendMode='add';fx.addChild(g);g.scale.set(.1);tween(g.scale,{x:1.5,y:1.5},100).then(()=>tween(g.scale,{x:.2,y:.2},180));tween(g,{alpha:0},330).then(()=>g.destroy());}
function showCombinationWin({amount,cells,color}){
 if(!(amount>0)||!cells.length)return;
 const coords=cells.map(pos),x=coords.reduce((v,p)=>v+p.x,0)/coords.length,y=Math.min(...coords.map(p=>p.y))-12;
 const winColor=(CLEAR_COLORS[color]??'#ffe69b').replace(/[0-9a-f]{2}/gi,channel=>Math.round(parseInt(channel,16)*.82).toString(16).padStart(2,'0')),winScale=1.15;
 const t=multiplierLabel(money(amount),36);t.label='combination-win';t.style.stroke={color:'#ffffff',width:4.5,join:'round'};t.style.dropShadow={color:'#44204d',blur:3,distance:2,angle:Math.PI/2,alpha:.35};t.style.fill=winColor;t.position.set(Math.max(85,Math.min(625,x)),Math.max(46,y));fx.addChild(t);
 const sy=t.y;t.scale.set(.75*winScale);
 animate(1000,u=>{if(t.destroyed)return;const enter=Math.min(1,u/.15);t.scale.set(winScale*(.75+.25*(1-(1-enter)**3)));t.y=sy-42*u;t.alpha=u<.65?1:Math.max(0,(1-u)/.35);}).finally(()=>t.destroy());
}
function float(text,i,color='#ffffff'){const isMultiplier=text.startsWith('×'),muted=isMultiplier&&visual[i]?.kind==='ice';let t=isMultiplier?multiplierLabel(text,36,muted):label(text,30,color);if(muted)t.alpha=.7;Object.assign(t,pos(i));fx.addChild(t);tween(t,{y:t.y-70,alpha:0},800).then(()=>t.destroy());}
async function shuffleBoard(board){sound.play('shuffle');float('SHUFFLE',24);const moving=()=>[...nodes.values()].filter(n=>n.kind!=='ice');await Promise.all(moving().map(n=>Promise.all([tween(n,{x:350,y:350,rotation:Math.PI,alpha:0},400),tween(n.scale,{x:.1,y:.1},400)])));draw(board);for(const n of moving()){n.rotation=0;n.scale.set(.1);n.alpha=0;}await Promise.all(moving().map(n=>Promise.all([tween(n.scale,{x:1,y:1},300),tween(n,{alpha:1},250)])));}
async function effect(e){return e.kind==='donut'?donutVFX.play({...e,tint:palette[e.color]??palette[0]}):boosterVFX.play(e);}
function updateConnectionIndicator(){const status=serverMode&&rgs.transport.healthy&&rgs.sessionEnvironment?rgs.sessionEnvironment:'offline';const dot=$('#connection');dot.dataset.status=status;dot.title=dot.ariaLabel=({production:'Production RGS connected',test:'Test RGS connected',offline:'No RGS connection'})[status];}
function hud(winGain){const gain=winGain??Math.max(0,displayWin-lastHudWin);lastHudWin=displayWin;if(gain>0)bounceWin(gain);updateConnectionIndicator();const b=state.bonus,award=state.freeRounds;$('#balance').textContent=money(state.balance);$('#bet').textContent=money(serverMode&&!b&&!award?rgs.cost():state.bet);$('#bet-label').textContent=serverMode&&state.mode!=='base'?'BET ×'+rgs.modeOffer(state.mode).multiplier:'BET';$('#win').textContent=money(displayWin);$('#mult-value').textContent='×'+displayMult;$('#win-label').textContent=b?'BONUS WIN':'WIN';$('#meter-title').textContent=b?'MOVES LEFT: '+b.moves:'ICE BONUS';$('#moves-label').textContent=b?'Magic candy = +1 move':'Collect 3 magic candies';$('#bonus-progress').hidden=!!(b||award);const collected=Math.max(0,Math.min(3,Number(state.meter)||0));$('#meter-fill').style.width=(collected/3*100)+'%';$('#meter').setAttribute('aria-valuenow',String(collected));$('#meter-count').textContent=collected+' / 3';$('#game').classList.toggle('bonus-active',!!b);for(const id of ['minus','plus','bonus'])$('#'+id).disabled=busy||!!b;if(serverMode){for(const id of ['minus','plus','auto'])$('#'+id).disabled=busy||!rgs.playable||(id!=='auto'&&(!!(b||award)||state.mode!=='base'));$('#bonus').disabled=busy||!rgs.playable||!!(b||award)||!(rgs.iceOffer()||rgs.modeOffer('luck')||rgs.modeOffer('enhanced'));$('#bonus').title=rgs.iceOffer()?'Buy ice bonus':'Not available in this RGS version';$('#mult').style.visibility='visible';if(b||award){$('#win-label').textContent='LAST MOVE WIN';}}if(award){$('#meter-title').textContent='FREE MOVES: '+award.remaining+(b?' · ICE: '+b.moves:'');$('#moves-label').textContent=(award.completeTotal?'TOTAL WON ':'WON SINCE RELOAD ')+(state.currency?state.currency+' ':'')+money(award.knownWin);$('#minus').disabled=$('#plus').disabled=true;}$('#bet-open').disabled=busy||!!(b||award)||(serverMode&&(!rgs.playable||state.mode!=='base'));$('#bet-open').setAttribute('aria-label','Choose base bet, current '+money(state.bet));$('#bet-open').title=serverMode&&state.mode!=='base'?'Return to Normal play to change the base bet.':'';$('#auto').classList.toggle('active',auto>0);$('#auto').setAttribute('aria-pressed',String(auto>0));$('#auto').title=auto?'Remaining: '+auto:'Autoplay';}
function persist(){if(serverMode||visualPreview)return;localStorage.setItem(KEY,JSON.stringify(rgs.snapshot()));}
let toastTimer;function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function updateSpeed(){speed=persistentTurbo||held||fastRequested?1.8:1;}
const hold=bindHoldInput(null,new HoldInput({act:()=>{if(roundRunning){if(!hold.active)fastRequested=true;updateSpeed();}else play();},canAct:()=>startupComplete&&!winner.active&&!bonusIntro.active&&!orientationBlocked()&&!document.hidden&&!$('#dialog').open&&(!serverMode||rgs.transport.healthy)&&(roundRunning||(!busy&&(!serverMode||rgs.playable))),onHeld:value=>{held=value;updateSpeed();},onManual:()=>{auto=0;clearTimeout(autoTimer);hud();}}),{reserveSpace:true,ownsSpace:()=>!document.activeElement?.closest?.('#rgs-debug')&&!winner.active&&!bonusIntro.active,cancel:()=>{stop();cancelDrag();}});
function stop(){hold.cancel();held=false;auto=0;fastRequested=false;updateSpeed();clearTimeout(autoTimer);hud();}
function modal(html){swipeHint.reset();symbolHint.reset();stop();const dialog=$('#dialog');$('#dialog-content').innerHTML=html;$('#dialog-content').scrollTop=0;dialog.classList.toggle('rules-dialog',html.includes('rules-grid'));dialog.setAttribute('aria-label',$('#dialog-content h2')?.textContent||'Royal Candy');dialog.scrollTop=0;if(!dialog.open)dialog.showModal();}
function close(){sound.cancelCelebration();$('#dialog').close();lastInput=Date.now();}$('#close').onclick=close;$('#dialog').addEventListener('close',()=>sound.cancelCelebration());
document.addEventListener('pointerdown',()=>sound.unlock(),{once:true});
let pointer=null;
function restoreDrag(d=pointer){if(!d)return;for(const i of [d.i,d.neighbor]){const n=nodes.get(visual[i]?.id);if(n)Object.assign(n,pos(i));}}
function cancelDrag(){if(!pointer)return;restoreDrag();pointer=null;select(null);}
window.addEventListener('gameorientationchange',e=>{if(e.detail.blocked)stop();cancelDrag();swipeHint.reset();symbolHint.reset();});
function down(i,e){if(orientationBlocked()||busy||(serverMode&&!rgs.playable)||$('#dialog').open||!visual[i]||visual[i]?.kind==='ice')return;sound.unlock();lastInput=Date.now();pointer={i,x:e.global.x,y:e.global.y,target:null,moved:false,second:selected!==null&&selected!==i?selected:null};select(i);}
function drag(e){if(!pointer||busy)return;const d=pointer,dx=e.global.x-d.x,dy=e.global.y-d.y;if(Math.hypot(dx,dy)<8&&!d.moved)return;d.moved=true;const horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy;const j=d.i+(horizontal?Math.sign(delta):Math.sign(delta)*7);const valid=j>=0&&j<49&&Math.abs(j%7-d.i%7)+Math.abs(Math.floor(j/7)-Math.floor(d.i/7))===1&&visual[j]?.kind!=='ice';if(valid&&!d.swishPlayed){sound.play('swap');d.swishPlayed=true;}d.target=valid&&Math.abs(delta)>32?j:null;if(d.neighbor!==undefined&&d.neighbor!==j){const old=nodes.get(visual[d.neighbor]?.id);if(old)Object.assign(old,pos(d.neighbor));}d.neighbor=valid?j:undefined;const n=nodes.get(visual[d.i]?.id),origin=pos(d.i);if(!n)return;const amount=valid?Math.min(94,Math.abs(delta)):Math.min(18,Math.abs(delta)*.2);n.x=origin.x+(horizontal?Math.sign(delta)*amount:0);n.y=origin.y+(horizontal?0:Math.sign(delta)*amount);if(valid){const other=nodes.get(visual[j]?.id),dest=pos(j),progress=Math.min(1,amount/70);other.x=dest.x+(origin.x-dest.x)*progress;other.y=dest.y+(origin.y-dest.y)*progress;}pieces.setChildIndex(n,pieces.children.length-1);}
function up(i,e){if(!pointer||busy)return;const d=pointer;if(e)drag(e);const target=d.moved?d.target:d.second;pointer=null;select(null);if(target!==null){play(d.i,target,d.swishPlayed===true);}else{restoreDrag(d);if(!d.moved)select(d.i);}}
// Resolve input against fixed cells, never animated sprite/halo bounds or draw order.
function cellAt(point){const local=stage.toLocal(point),col=Math.floor((local.x-20)/94),row=Math.floor((local.y-20)/94);return col>=0&&col<7&&row>=0&&row<7?row*7+col:null;}
app.stage.eventMode='static';app.stage.hitArea=new PIXI.Rectangle(0,0,711,711);app.stage.on('pointerdown',e=>{if(pointer)return;const i=cellAt(e.global);if(i!==null)down(i,e);});app.stage.on('globalpointermove',e=>{hoveredCell=cellAt(e.global);app.canvas.style.cursor=hoveredCell!==null&&visual[hoveredCell]?.kind!=='ice'?'pointer':'default';drag(e);});app.canvas.addEventListener('pointerleave',()=>{hoveredCell=null;});app.stage.on('pointerup',e=>{if(pointer)up(pointer.i,e);});app.stage.on('pointerupoutside',cancelDrag);app.canvas.addEventListener('pointercancel',cancelDrag);
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
  if(!result.accepted){sound.play('invalid');const na=nodes.get(visual[a]?.id),nb=nodes.get(visual[b]?.id);if(na&&nb){if(!previewSwap)await Promise.all([tween(na,pos(b),110),tween(nb,pos(a),110)]);await Promise.all([tween(na,pos(a),150),tween(nb,pos(b),150)]);}return;}
  persist();state.balance=serverMode?result.state.balance:before.balance-(before.bonus?0:before.bet*({base:1,luck:2,enhanced:50,mayhem:1000}[before.mode]));if(auto&&!before.bonus)auto--;hud();
  const waveAfter=cascadeWaveAfter(result.events),collectionFlights=[];let pendingMult=0,pendingMagic=0,plannedMult=displayMult,plannedMeter=state.meter,previousCascadeWin=before.bonus?.win||0;
  for(const [eventIndex,e] of result.events.entries()){if(e.type==='properties'){if(e.board.some(c=>c?.magic&&!visual.some(old=>old?.id===c.id&&old.magic)))sound.play('magicAppear');draw(e.board);}if(e.type==='progress'){if(!pendingMult&&!pendingMultiplierCollection(result.events,eventIndex)){if(e.mult>displayMult)sound.play('multiplier');displayMult=e.mult;}if(!pendingMagic&&!pendingMagicCollection(result.events,eventIndex)){state.meter=e.meter;plannedMeter=e.meter;}hud();}if(e.type==='swap'){const swapA=e.a??a,swapB=e.b??b;if(!swishPlayed)sound.play('swap');if(state.bonus&&Number.isInteger(e.moves))state.bonus.moves=e.moves;hud();let na=nodes.get(visual[swapA]?.id),nb=nodes.get(visual[swapB]?.id);if(!previewSwap)await Promise.all([tween(na,pos(swapB),165),tween(nb,pos(swapA),165)]);visual=clone(e.board);nodes.get(visual[swapA].id).index=swapA;nodes.get(visual[swapB].id).index=swapB;iceMarks.sync(visual,nodes);}
   if(e.type==='destroy'){const cells=[...e.cells,...e.ice],effects=[...e.effects,...colorClearEffects(visual,e,[b,a])];
    const arrivals=new Map();effects.forEach((v,j)=>{if(v.kind==='donut')for(const i of v.targets||[]){const flight=donutFlightPlan(pos(v.i),pos(i)),ms=j*75+DONUT_LAUNCH_MS+flight.delay+flight.duration;arrivals.set(i,Math.min(arrivals.get(i)??Infinity,ms));}});
    const rocketCells=new Set();for(const [j,v] of effects.entries())if(v.kind==='rocket')for(const i of cells){const hit=rocketContactMs(pos(v.i),pos(i),v.dir);if(hit!==null){const ms=j*75+hit;arrivals.set(i,Math.min(arrivals.get(i)??Infinity,ms));rocketCells.add(i);}}
    const impactAt=Math.max(0,...effects.map((v,j)=>v.kind==='donut'?0:j*75+(v.kind==='bomb'?BOOSTER_TIMING.bombPrepare+BOOSTER_TIMING.bombCharge+BOOSTER_TIMING.bombFlash:BOOSTER_TIMING.rocketPrepare+BOOSTER_TIMING.rocketCharge+BOOSTER_TIMING.rocketFlight*.55)));
    const startAt=i=>arrivals.get(i)??Math.max(0,impactAt-380);
    const collectors=[...new Set(cells)].filter(i=>(visual[i]?.kind==='candy'||serverMode&&visual[i]?.kind==='ice')&&visual[i].mult>0&&(!serverMode||e.collected?.includes(i))).sort((a,b)=>(startAt(a)+(rocketCells.has(a)?125:380))-(startAt(b)+(rocketCells.has(b)?125:380))||a-b);
    const arrivalValues=multiplierArrivalValues(plannedMult,e.mult,collectors.map(i=>visual[i].mult));plannedMult=e.mult;
    const magicCollectors=state.bonus?[]:[...new Set(cells)].filter(i=>visual[i]?.magic&&(!serverMode||e.magicCells?.includes(i))).sort((a,b)=>startAt(a)-startAt(b)||a-b);
    const magicTotal=serverMode&&Number.isInteger(e.meter)?e.meter:Math.min(3,plannedMeter+magicCollectors.length),magicValues=magicArrivalValues(plannedMeter,magicTotal,magicCollectors.length);plannedMeter=magicTotal;
    const audioPlan=clearAudioPlan({cells,effects,rocketCells,startAt,board:visual});
    const donutRemaining=new Set(audioPlan.donutHits),cascadeWinGain=Math.max(0,e.win-previousCascadeWin);
    const payouts=e.payouts??(!serverMode&&e.win>previousCascadeWin?[{amount:Math.round((e.win-previousCascadeWin)*100)/100,cells:e.cells,color:e.runs?.[0]?.color??null}]:[]);previousCascadeWin=e.win;
    const pendingPayouts=payouts.map(p=>({...p,remaining:new Set(p.cells.filter(i=>cells.includes(i)))}));

    const blastSounds=Promise.all(audioPlan.blastTimes.map(async ms=>{if(ms)await pause(ms);sound.play('bomb');}));
    const effectsDone=Promise.all(effects.map(async(v,j)=>{if(j)await pause(j*75);return effect(v);}));
    const clearSound=(async()=>{const delay=audioPlan.popAt??(cells.length?Math.min(...cells.map(startAt)):0);if(delay>0)await pause(delay);sound.cascade=Math.max(0,e.step);if(audioPlan.popAt!==null)sound.play('pop',sound.cascade);await pause(380);if(e.ice.length)sound.play('ice');else if(e.damage.length)sound.play('iceHit');})();
    // Projectiles start each confirmed cell's collapse only on contact.
    await Promise.all(cells.map(async i=>{const delay=startAt(i);if(delay)await pause(delay);const hitIndex=audioPlan.rocketHits.indexOf(i);if(hitIndex>=0)sound.play('rocketPop',hitIndex);await dissolveSymbol(i,c=>{
     for(const p of pendingPayouts)if(p.remaining.delete(i)&&!p.remaining.size)showCombinationWin(p);
     if(donutRemaining.delete(i)&&!donutRemaining.size){sound.play('donutPop');sound.play('sparkles');}
     if(c.kind==='ice')iceMarks.remember(i,c);
     if(c.magic&&(!serverMode||e.magicCells?.includes(i))){const rank=magicCollectors.indexOf(i);if(rank>=0){pendingMagic++;collectionFlights.push((async()=>{try{if(rank)await pause(rank*80);await flyMagic(i,c,magicValues[rank]);}finally{pendingMagic--;}})());}else{sound.play('magic');const awarded=e.moveAwards?.find(a=>a.i===i)?.number;float(serverMode?(awarded?'+'+awarded+' MOVE'+(awarded===1?'':'S'):'★'):'+1 MOVE',i);}}if(c.mult&&(!serverMode||e.collected?.includes(i))){const rank=collectors.indexOf(i);if(rank>=0){const n=nodes.get(c.id);if(n?.multiplierLabel)n.multiplierLabel.visible=false;pendingMult++;collectionFlights.push((async()=>{try{if(rank)await pause(rank*85);await flyMultiplier(i,c.mult,arrivalValues[rank]);}finally{pendingMult--;}})());}else float('×'+c.mult,i);}
    },rocketCells.has(i),audioPlan.sparkles,!audioPlan.donutHits.length);}));await clearSound;
    await Promise.all([effectsDone,blastSounds]);
    for(const i of cells){const id=visual[i]?.id,n=nodes.get(id);if(n){n.destroy({children:true});nodes.delete(id);}visual[i]=null;}
    for(const i of e.damage)if(!e.ice.includes(i)){const old=nodes.get(visual[i]?.id);if(old){old.destroy({children:true});nodes.delete(visual[i].id);}let c=e.board[i],n=make(c);n.index=i;Object.assign(n,pos(i));burst(i,0xb7edff,14);tween(n.scale,{x:1.08,y:.93},65).then(()=>tween(n.scale,{x:1,y:1},140));visual[i]=clone(c);}
    if(e.armed.length)sound.play('boosterAppear');for(const id of e.armed){const n=nodes.get(id);if(n){boosterVFX.arm(n);}}
    if(!pendingMagic&&serverMode&&Number.isInteger(e.meter))state.meter=e.meter;if(!pendingMult){if(e.mult>displayMult)sound.play('multiplier');displayMult=e.mult;}displayWin=e.win;if(state.bonus&&Number.isInteger(e.moves))state.bonus.moves=e.moves;hud(cascadeWinGain);if(e.step>=2){$('#message').textContent=['SWEET CASCADE!','GREAT CHAIN!','SWEET CASCADE!'][Math.min(2,Math.floor(e.step/3))];$('#message').style.opacity=1;}await pause(45);
   }if(e.type==='fall'){await fall(e.board);if(eventIndex===waveAfter)await settleBoard(cascadeWaveOrigin(result.events,waveAfter));}if(e.type==='shuffle')await shuffleBoard(e.board);
  }
  await Promise.all(collectionFlights);
  // Present only settled paid wins or the confirmed bonus total, never cumulative bonus moves.
  const completedAward=result.freeRoundsCompleted,confirmedAwardTotal=completedAward?.completeTotal&&Number.isFinite(completedAward.knownWin);
  if(!completedAward||confirmedAwardTotal)await winner.show({...winnerAward(result,serverMode&&!before.bonus&&!before.freeRounds?{...before,bet:before.bet*(rgs.modeOffer(before.mode)?.multiplier??1)}:before),format:money,bonusComplete:!!result.bonusEnded||!!confirmedAwardTotal});
  // Finish the triggering cascade and collection flights first. A confirmed
  // symbol_counter award then requests the zero-cost entry, with no fake swap.
  if(serverMode&&result.state.pendingBonus){
   stop();state=result.state;displayWin=result.win;displayMult=state.mult??1;draw(state.board);hud();
   result=await rgs.enterBonus();
  }
  if(result.bonusStarted||result.bonusEnded)iceMarks.clear();
  state=result.state;displayWin=result.bonusTotalWin??result.win;if(result.freeRoundsCompleted||result.bonusEnded)stop();if(serverMode){displayMult=state.mult??1;if(state.bonus?.awaitingCompletion||state.serverWarning)stop();}if(!result.bonusStarted){draw(state.board);hud();}if(serverMode&&state.awaitingMoves){stop();showMissingMoves();}else if(result.bonusStarted){await presentBonus();}
  else if(serverMode&&state.bonus?.awaitingCompletion){modal('<h2>BONUS REVIEW PAUSED</h2><p>All reported moves are used. The return to the base game is awaiting server verification. No further move will be sent.</p><button class="modal-action" id="continue">OK</button>');$('#continue').onclick=close;}
  else if(completedAward&&!confirmedAwardTotal)toast('Free moves complete. Total winnings unavailable.');

 }catch(e){stop();if(serverMode){rgs.fail(e.message,true);showConnectionFault();}else{console.error(e);toast(e.message);}}finally{busy=false;roundRunning=false;fastRequested=false;updateSpeed();state=rgs.snapshot();hud();if(auto>0&&(!serverMode||rgs.playable)&&!$('#dialog').open&&!document.hidden)autoTimer=setTimeout(()=>{if(auto>0&&!document.hidden&&!$('#dialog').open)play();},220/speed);}
}
$('#sound').onclick=()=>{sound.unlock();sound.enabled=!sound.enabled;$('#sound').style.opacity=sound.enabled?1:.45;};$('#turbo').onclick=()=>{persistentTurbo=!persistentTurbo;updateSpeed();$('#turbo').classList.toggle('active',persistentTurbo);$('#turbo').setAttribute('aria-pressed',String(persistentTurbo));sound.play('click');};
const bets=[.1,.2,.5,1,2,5,10,20,50,100];
const betOptions=()=>serverMode?rgs.bets:bets;
const canChangeFeature=()=>!busy&&!state.bonus&&!state.freeRounds&&(!serverMode||rgs.playable);
const canChangeBet=()=>canChangeFeature()&&(!serverMode||state.mode==='base');
function showServerFeatures(){
 if(!canChangeFeature())return;
 const ice=state.mode==='base'?rgs.iceOffer():null,names={base:'Normal play',luck:'Extra Luck',enhanced:'Enhanced Moves',ice:'Ice Bonus'};
 const offers=[...['base','luck','enhanced'].map(mode=>rgs.modeOffer(mode)).filter(Boolean),...(ice?[{...ice,mode:'ice'}]:[])];
 const amount=cost=>money(cost)+(state.currency?' '+state.currency:'');
 modal('<h2>CHOOSE A MODE</h2><p class="modal-subtitle">A little more magic for your next move.</p><div class="cards">'+offers.map(o=>'<button class="card" data-mode="'+o.mode+'" '+(o.mode===state.mode?'disabled':'')+'><b>'+names[o.mode]+'</b><span>'+(o.mode==='ice'?o.moves+' free moves':o.multiplier+'× base bet · '+amount(o.cost)+' per move')+'</span><span>'+(o.mode===state.mode?'ACTIVE':(o.mode==='ice'?'Buy for ':'Start for ')+amount(o.cost))+'</span></button>').join('')+'</div>'+(state.mode!=='base'?'<p>Return to Normal play to change the base bet or buy the Ice Bonus.</p>':''));
 document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{
  const o=offers.find(o=>o.mode===button.dataset.mode),purchase=o.mode==='ice';
  $('#dialog-content').innerHTML='<div class="confirm-art" data-feature="'+o.mode+'" aria-hidden="true"></div><h2>'+names[o.mode]+'</h2><p>'+(purchase?o.moves+' free moves. One-time price: <b>'+amount(o.cost)+'</b>. Bonus moves do not charge another bet.':'Start a new board for <b>'+amount(o.cost)+'</b>. Each following move costs <b>'+amount(o.cost)+'</b>. The current board is replaced.')+'</p><button id="feature-confirm" class="modal-action" '+(state.balance<o.cost?'disabled':'')+'>'+(purchase?'BUY FOR ':'START FOR ')+amount(o.cost)+'</button>'+(state.balance<o.cost?'<p>Insufficient balance</p>':'');
  $('#feature-confirm').onclick=async()=>{
   if(!canChangeFeature())return;
   busy=true;$('#feature-confirm').disabled=true;hud();sound.unlock();
   try{state=await (purchase?rgs.buy():rgs.mode(o.mode));displayWin=0;displayMult=1;iceMarks.clear();close();if(purchase)await presentBonus();else{draw(state.board);hud();sound.play('click');}}
   catch(e){if(!rgs.transport.healthy)showConnectionFault();else toast(e.message);}
   finally{busy=false;hud();}
  };
 });
}

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
 modal('<h2 id="bet-dialog-title">CHOOSE BET</h2><p class="modal-subtitle">'+(serverMode&&state.mode!=='base'?'Select base bet · '+rgs.modeOffer(state.mode).multiplier+'× per move':'Select your bet per move')+'</p><div class="choices bet-choices" role="group" aria-labelledby="bet-dialog-title">'+betOptions().map(value=>'<button data-bet="'+value+'" aria-pressed="'+(value===state.bet)+'">'+money(value)+'</button>').join('')+'</div>');
 document.querySelectorAll('[data-bet]').forEach(button=>button.onclick=async()=>{
  if(!canChangeBet())return;
  const buttons=[...document.querySelectorAll('[data-bet]')];buttons.forEach(b=>b.disabled=true);
  const selected=await chooseBet(Number(button.dataset.bet));
  // A pending server selection must not close a different dialog opened meanwhile.
  if(!$('#dialog-content').contains(button))return;
  if(selected)close();else buttons.forEach(b=>b.disabled=false);
 });
};
$('#bonus').onclick=()=>{if(serverMode){showServerFeatures();return;}if(busy||state.bonus)return;modal('<h2>CHOOSE A MODE</h2><p class="modal-subtitle">A little more magic for your next move.</p><div class="cards">'+[['base','Normal play','1× per move'],['luck','Extra Luck','2× per move · more magic candies'],['enhanced','Enhanced Moves','50× per move · bombs, rockets and multipliers'],['ice','Ice Bonus','100× · buy 5 free moves'],['mayhem','Multi Mayhem','1000× per move · multiplier board']].map(([id,name,desc])=>`<button class="card" data-mode="${id}"><b>${name}</b><span>${desc}</span><span>${money(state.bet*({base:1,luck:2,enhanced:50,ice:100,mayhem:1000}[id]))} credits</span></button>`).join('')+'</div>');document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{const mode=b.dataset.mode;$('#dialog-content').innerHTML='<h2>'+b.querySelector('b').textContent+'</h2><p>'+ (mode==='ice'?'Cost: '+money(state.bet*100)+' demo credits.':'Changing mode is free. Your next move uses the selected price.')+'</p><button id="confirm" class="modal-action">CONFIRM</button>';$('#confirm').onclick=async()=>{if(busy)return;busy=true;try{state=mode==='ice'?rgs.buy():rgs.mode(mode);persist();displayWin=0;displayMult=1;close();if(mode==='ice')await presentBonus();else{draw(state.board);hud();sound.play('click');}}catch(e){toast(e.message);}finally{busy=false;hud();}};});};
$('#auto').onclick=()=>{if(serverMode&&!rgs.playable)return;if(auto){stop();return;}modal('<h2>AUTOPLAY</h2><p class="modal-subtitle">Choose how many paid moves to play.</p><p class="modal-note">Tap Auto again to stop after the current move.</p><div class="choices">'+[5,10,25,50,100,250,500,1000].map(n=>`<button data-count="${n}">${n}</button>`).join('')+'</div>');document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{auto=Number(b.dataset.count);close();hud();if(!busy)play();});};
$('#settings').onclick=()=>{modal('<h2>SETTINGS</h2><p class="modal-subtitle">Make yourself at home.</p><div class="settings-list"><label class="setting-row"><span><b>Sound effects</b><small>Swaps, candy pops & celebrations</small></span><input id="sfx-check" type="checkbox" '+(sound.enabled?'checked':'')+'><span class="setting-switch" aria-hidden="true"></span></label><label class="setting-row"><span><b>Music</b><small>A little melody for your kingdom</small></span><input id="music-check" type="checkbox" '+(sound.music?'checked':'')+'><span class="setting-switch" aria-hidden="true"></span></label></div><button id="history" class="modal-action secondary-action" type="button">Move history <span aria-hidden="true">→</span></button><p class="modal-footnote">'+(serverMode?'Test credits · Reload starts a new session.':'Your board and bonus progress are saved in this browser.')+'</p>');$('#history').onclick=showHistory;$('#sfx-check').onchange=e=>{sound.unlock();sound.enabled=e.target.checked;};$('#music-check').onchange=e=>{sound.unlock();sound.music=e.target.checked;};};
const showHistory=()=>modal('<h2>MOVE HISTORY</h2><p class="modal-subtitle">Your last 20 moves at a glance.</p>'+(state.history.length?'<div class="history-scroll"><table><thead><tr><th>Time</th><th>Cost</th><th>Win</th><th>Multiplier</th></tr></thead><tbody>'+state.history.slice(0,20).map(h=>`<tr><td>${new Date(h.time).toLocaleTimeString('en-US')}${h.bonus?'<small class="history-bonus">BONUS</small>':''}</td><td>${money(h.cost)}</td><td class="history-win">${money(h.win)}</td><td>×${h.mult}</td></tr>`).join('')+'</tbody></table></div>':'<div class="modal-empty"><img src="public/optimized-v1/candy-yellow.webp" width="72" height="72" alt=""><h3>Your story starts with a move</h3><p>Completed moves will appear here.</p></div>'));
$('#rules').onclick=()=>modal(rulesMarkup(serverMode));
window.addEventListener('keydown',e=>{if(e.code==='Escape')stop();});
app.ticker.add(t=>{const density=renderBudget.sample(t.elapsedMS,startupComplete&&!document.hidden&&!orientationBlocked()&&!$("#dialog").open);if(density!==null)app.renderer.resize(711,711,density);let dt=Math.min(t.deltaMS,50);const hintsAllowed=!busy&&!pointer&&!held&&!auto&&!document.hidden&&!$('#dialog').open&&state.board.length===49&&(!serverMode||rgs.playable);const legalHints=()=>serverMode?rgs.moves():moves(state.board);swipeHint.tick(dt,hintsAllowed,legalHints);if(!hintsAllowed)hintSoundPlayed=false;if(swipeHint.layer.visible&&!hintSoundPlayed){sound.play('hint');hintSoundPlayed=true;}symbolHint.tick(dt,hintsAllowed,legalHints);const hoverActive=hoveredCell!==null&&!busy&&!pointer;hoverOpacity+=(Number(hoverActive)-hoverOpacity)*Math.min(1,dt/110);if(hoverActive)Object.assign(hoverCell,pos(hoveredCell));hoverCell.alpha=hoverOpacity*.94;for(let i=anims.length-1;i>=0;i--){const a=anims[i];a.t+=dt;let p=Math.min(a.t/a.ms,1),e=a.ease(p);if(!a.obj.destroyed)for(const k in a.to)a.obj[k]=a.from[k]+(a.to[k]-a.from[k])*e;if(p===1){anims.splice(i,1);a.resolve();}}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt/1000;p.g.x+=p.vx*dt/1000;p.g.y+=p.vy*dt/1000;p.vy+=460*dt/1000;p.g.alpha=Math.max(0,p.life/p.total);p.g.rotation+=dt*.003;if(p.life<=0){p.g.destroy();particles.splice(i,1);}}for(const n of nodes.values()){boosterVFX.tickArmed(n,performance.now());if(n.whiteOverlay)n.whiteOverlay.alpha=n.white.v;if(['candy','bomb','rocket'].includes(n.kind)){const phase=performance.now()*.0019*n.idleRate+n.phase;const amp=1;const hint=n.clearing?{scale:1,y:0,squash:0,shine:-1}:symbolHint.pose(n.index),wave=boardWavePose(boardWaveElapsed,n.index,boardWaveOrigin);const emphasis=(selected===n.index?1.045:1)*hint.scale;n.sprite.x=wave.x;n.sprite.y=Math.sin(phase)*2.1*amp+hint.y+wave.y;n.sprite.rotation=n.baseSpriteRotation+Math.sin(phase*.79)*.016*amp;n.sprite.scale.set(n.baseSpriteScale*emphasis*(1+Math.sin(phase*1.17)*.016*amp+hint.squash),n.baseSpriteScaleY*emphasis*(1-Math.sin(phase*1.17)*.016*amp-hint.squash));updateHintShine(n,hint.shine);if(n.multiplierLabel){const b=n.multiplierLabel;b.position.copyFrom(n.sprite.position);b.rotation=n.sprite.rotation-n.baseSpriteRotation;b.scale.set((b.baseLabelScale??1)*n.sprite.scale.x/n.baseSpriteScale,(b.baseLabelScale??1)*n.sprite.scale.y/n.baseSpriteScaleY);}}for(const g of n.glows||[]){g.position.copyFrom(n.sprite.position);g.rotation=n.sprite.rotation;g.scale.set(n.sprite.scale.x*g.glowScaleX*g.glowSpread,n.sprite.scale.y*g.glowScaleY*g.glowSpread);}}});

function showMissingMoves(){
 $('#game').inert=true;if($('#dialog').open)close();const panel=$('#rgs-status');panel.hidden=false;
 panel.querySelector('h2').textContent='NO NEXT MOVES';
 panel.querySelector('p').textContent='The last move is complete and its result is shown. The server did not provide the next available moves. Reload starts a new test session.';
 panel.querySelector('button').hidden=false;panel.querySelector('button').focus();
}
function showConnectionFault(){
 updateConnectionIndicator();
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
 window.sweetCascade.previewWinner=(ratio=125)=>preview(()=>winner.show({amount:state.bet*ratio,bet:state.bet,format:money}));
 if(visualPreview){
  window.sweetCascade.previewMassFall=(count=28)=>preview(async()=>{const board=clone(visual);[...nodes.values()].filter(n=>n.kind==='candy').slice(0,count).forEach(n=>{n.y-=188;});await fall(board);});
  window.sweetCascade.previewWinBounce=(gain=5)=>preview(async()=>{const previous=displayWin;try{displayWin+=gain;hud(gain);await pause(900);}finally{displayWin=previous;hud(0);}});
 }
 if(visualPreview)window.sweetCascade.previewBonusEntry=()=>preview(async()=>{const before=state,win=displayWin,mult=displayMult,demo=new DemoRGS(clone(state));demo.bonusStart();state=demo.snapshot();try{await presentBonus();}finally{state=before;displayWin=win;displayMult=mult;draw(state.board);hud();}});
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



mountTouchGuard();
try{await startGame();}catch(error){failStartup('The game could not finish loading. Please reload.');console.error('Startup blocked:',error?.message);}

