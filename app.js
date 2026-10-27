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
 bonusStart(){const s=this.s;s.bonus={moves:5,chains:0,mult:0,win:0,bet:s.bet,base:clone(s.board),meter:s.meter};s.board=this.fresh();for(let i=35;i<49;i++)s.board[i]={id:++s.id,kind:'ice',hp:2+Math.floor(this.rng()*2),mult:[2,3,5,10][Math.floor(this.rng()*4)],color:-1};for(const c of s.board)if(c.kind==='ice')c.maxHp=c.hp;if(!moves(s.board).length)s.board=this.reshuffle(s.board);s.mode='base';}
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

// User-recorded reference samples with procedural fallbacks for unisolated events.
class Sound{
 get enabled(){return this._enabled;}
 set enabled(value){this._enabled=!!value;if(!value){this.cancelCelebration();for(const source of this.voices||[])try{source.stop();}catch{}}this.syncMusic();}
 get music(){return this._music;}
 set music(value){this._music=!!value;this.syncMusic();}
 syncMusic(){if(!this.musicAudio)return;if(this.music&&this.enabled&&!document.hidden){if(this.musicAudio.paused&&!this.musicPending){this.musicPending=true;this.musicAudio.play().catch(()=>{}).finally(()=>{this.musicPending=false;});}}else this.musicAudio.pause();}
 constructor(){this.enabled=true;this.music=true;this.ctx=null;this.beat=0;this.timer=null;this.cascade=0;this.lastLand=-1;this.popVariant=-1;}
 async loadSamples(){this.samples={};try{const encoded=await (await fetch('public/audio/reference-samples.json')).json();const decoder=new OfflineAudioContext(1,1,44100);await Promise.all(Object.entries(encoded).map(async([name,value])=>{const raw=Uint8Array.from(atob(value),c=>c.charCodeAt(0));this.samples[name]=await decoder.decodeAudioData(raw.buffer);}));}catch(e){console.warn('Reference audio unavailable; using procedural fallback',e);}}
 sample(name,step=0){if(!this.ctx||!this.enabled)return false;const level=Math.min(5,Math.max(0,Math.floor(step))),key=name==='pop'&&level>0?'pop'+level:name;const buffer=this.samples?.[key];if(!buffer)return false;const now=this.ctx.currentTime;this.lastSample??={};const gap={land:.16,magic:.25,ice:.12,iceHit:.16,multiplier:.18}[name]??0;if(now-(this.lastSample[name]??-100)<gap)return true;this.lastSample[name]=now;const src=this.ctx.createBufferSource(),gain=this.ctx.createGain();src.buffer=buffer;src.cue=key;if(name==='pop'){if(level===0)this.popVariant=(this.popVariant+1)%3;src.playbackRate.value=2**(Math.max(0,this.popVariant)*.5/12);}gain.gain.value=({swap:2.5,pop:1.7,land:2,magic:.9,multiplier:1.2,iceHit:.65,ice:.85,bonus:1.2,transition:1.1,win:1.1,winMega:1.1,winEpic:1.1,winEnd:1.1}[name]??1);src.connect(gain).connect(this.bus);this.voices??=new Set();this.voices.add(src);src.start();src.onended=()=>{this.voices.delete(src);src.disconnect();gain.disconnect();};return true;}
 cancelCelebration(){this.celebrationToken=(this.celebrationToken||0)+1;for(const src of this.voices||[])if(['win','winMega','winEpic'].includes(src.cue))try{src.stop();}catch{}}
 async celebrate(ratio=0){this.cancelCelebration();const token=this.celebrationToken;const cues=['win'];if(ratio>=25)cues.push('winMega');if(ratio>=50)cues.push('winEpic');for(const cue of cues){if(token!==this.celebrationToken||!this.enabled)return;this.play(cue);await new Promise(resolve=>setTimeout(resolve,(this.samples?.[cue]?.duration??.5)*1000));}}
 unlock(){if(!this.ctx){this.ctx=new AudioContext();this.bus=this.ctx.createGain();this.bus.gain.value=.35;this.limiter=this.ctx.createDynamicsCompressor();this.limiter.threshold.value=-14;this.limiter.knee.value=12;this.limiter.ratio.value=5;this.limiter.attack.value=.003;this.limiter.release.value=.12;this.bus.connect(this.limiter).connect(this.ctx.destination);}this.ctx.resume();if(!this.musicAudio){this.musicAudio=new Audio('public/audio/background-music.mp3');this.musicAudio.loop=true;this.musicAudio.volume=.15;document.addEventListener('visibilitychange',()=>this.syncMusic());}this.syncMusic();if(!this.timer)this.timer=setInterval(()=>this.tick(),320);}
 tone(freq,duration=.12,type='sine',gain=.15,delay=0,end=null){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(this.bus);o.start(t);o.stop(t+duration+.02);}
 noise(duration=.2,gain=.12,high=1500){if(!this.ctx||!this.enabled)return;let n=this.ctx.sampleRate*duration,buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate),a=buf.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);let src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=buf;f.type='lowpass';f.frequency.value=high;g.gain.value=gain;src.connect(f).connect(g).connect(this.bus);src.start();}
 play(name,step=0){if(this.sample(name,step))return;if(name==='iceHit')name='ice';if(name==='transition'||name==='winEnd')name='magic';if(name==='multiplier')name='click';if(name==='shuffle')name='magic';if(name==='swap'){this.tone(450,.09,'sine',.2,0,900);}if(name==='invalid'){this.tone(220,.13,'triangle',.12,0,130);}if(name==='pop'){const semitones=[0,2,4,7,9,12,14,16,19,21,24];const pitch=2**(semitones[Math.min(semitones.length-1,Math.max(0,step))]/12),f=480*pitch;this.tone(f*1.55,.095,'sine',.31,0,f*.52);this.tone(f*.65,.14,'sine',.13,.018,f*.32);this.noise(.035,.045,2600);this.tone(660*pitch,.23,'sine',.085,.025);this.tone(990*pitch,.15,'sine',.033,.045);if(step>1)this.tone(1320*pitch,.19,'sine',.025,.075);}if(name==='land'&&this.ctx){const now=this.ctx.currentTime;if(now-this.lastLand<.025)return;this.lastLand=now;const pitch=2**(Math.min(step,10)*1.2/12)*(1+(Math.random()-.5)*.1);this.tone(310*pitch,.075,'sine',.15,0,145*pitch);this.tone(155*pitch,.105,'sine',.095,.025,225*pitch);this.tone(730*pitch,.045,'sine',.025,.008,450*pitch);this.noise(.022,.023,1200);}if(name==='ice'){this.noise(.24,.22,7000);this.tone(1900,.25,'sine',.06);}if(name==='bomb'){this.noise(.4,.5,800);this.tone(160,.35,'sine',.5,0,35);}if(name==='rocket'){this.noise(.3,.3,4000);this.tone(250,.25,'triangle',.1,0,1800);}if(name==='magic'||name==='win'||name==='bonus'){[0,4,7,12,16].forEach((n,i)=>this.tone(523.25*2**(n/12),.4,'sine',.12,i*.085));}if(name==='click')this.tone(700,.045,'sine',.1,0,400);}
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

// All coordinates use the background artwork's 1672 x 941 design space.
// A single cover transform keeps the separate artwork attached on every viewport.
async function mountKingdom(element) {
  const urls=['public/kingdom/castle-layer.png','public/kingdom/skyline.png'];
  const images=await Promise.all(urls.map(url=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Background asset: ${url}`));image.src=url;
  })));
  const [background,skyline]=images;
  const canvas=document.createElement('canvas');canvas.className='kingdom-scene';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');element.appendChild(canvas);
  const clouds=document.createElement('canvas');clouds.width=1672;clouds.height=941;
  const cloudCtx=clouds.getContext('2d');
  const pennants=document.createElement('canvas');pennants.width=3344;pennants.height=1882;
  const flagCtx=pennants.getContext('2d');
  flagCtx.scale(2,2);flagCtx.imageSmoothingQuality='high';
  // Flat rectangular cloth and printed logo are deformed together at render time.
  const cloth=document.createElement('canvas');cloth.width=320;cloth.height=136;
  const clothCtx=cloth.getContext('2d');
  const cloud=document.createElement('canvas');cloud.width=360;cloud.height=150;
  const brush=cloud.getContext('2d');brush.filter='blur(4px)';
  const tint=brush.createLinearGradient(0,20,0,135);tint.addColorStop(0,'#fffefa');tint.addColorStop(1,'#d9e8fa');brush.fillStyle=tint;
  brush.beginPath();brush.ellipse(174,100,143,27,0,0,Math.PI*2);brush.ellipse(95,85,49,34,0,0,Math.PI*2);brush.ellipse(151,61,54,43,0,0,Math.PI*2);brush.ellipse(209,80,55,39,0,0,Math.PI*2);brush.ellipse(264,98,48,23,0,0,Math.PI*2);brush.fill();
  let width=1,height=1,ratio=1,time=0,last=0,frame=0,previousPaint=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function resize(){width=element.clientWidth;height=element.clientHeight;ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);draw();}
  function drawFlag(x,y,w,h,phase){
    // Start with a straight, full cloth surface; no pre-bent silhouette mask.
    const steps=80,phaseAt=time*1.35+phase;
    clothCtx.globalCompositeOperation='source-over';clothCtx.clearRect(0,0,320,136);

    const lighting=clothCtx.createLinearGradient(0,0,320,0);
    for(let i=0;i<=80;i++){
      const u=i/80,envelope=1-Math.exp(-u*7),angle=phaseAt-u*7.4;
      // The bright ridge and shaded trough travel with the SAME deformation phase.
      const light=21-Math.sin(angle)*7*envelope-Math.sin(angle*1.65+.6)*2*envelope;
      lighting.addColorStop(u,`hsl(283 61% ${light}%)`);
    }
    clothCtx.fillStyle=lighting;clothCtx.fillRect(0,0,320,136);
    clothCtx.globalCompositeOperation='source-atop';
    // Print onto the cloth BEFORE slicing: logo and fabric share the same wave.
    clothCtx.drawImage(skyline,16,43,145,54);
    const inkLight=clothCtx.createLinearGradient(0,0,320,0);
    for(let i=0;i<=40;i++){
      const u=i/40,shade=-Math.sin(phaseAt-u*7.4)*(1-Math.exp(-u*7));
      inkLight.addColorStop(u,shade>0?`rgba(255,235,245,${shade*.12})`:`rgba(65,0,28,${-shade*.16})`);
    }
    clothCtx.fillStyle=inkLight;clothCtx.fillRect(0,0,320,136);
    const vertical=clothCtx.createLinearGradient(0,0,0,136);
    vertical.addColorStop(0,'rgba(255,220,235,.12)');vertical.addColorStop(.4,'rgba(255,220,235,0)');vertical.addColorStop(1,'rgba(85,5,42,.12)');
    clothCtx.fillStyle=vertical;clothCtx.fillRect(0,0,320,136);
    // One smooth deformed triangular silhouette trims slice overdraw at the rim.
    const edge=(u,bottom)=>{
      const envelope=1-Math.exp(-u*7),angle=phaseAt-u*7.4;
      const wave=(Math.sin(angle)*.15+Math.sin(angle*1.65+.6)*.025)*h*envelope;
      const stretch=1+Math.cos(angle+.6)*.10*envelope;
      return [x+w*u,y+wave+h*(bottom?1-u*.5:u*.5)*stretch];
    };
    flagCtx.save();flagCtx.beginPath();flagCtx.moveTo(...edge(0,false));
    for(let i=1;i<=steps;i++)flagCtx.lineTo(...edge(i/steps,false));
    for(let i=steps-1;i>=0;i--)flagCtx.lineTo(...edge(i/steps,true));
    flagCtx.closePath();flagCtx.clip();
    for(let i=0;i<steps;i++){
      const u=i/steps,v=(i+1)/steps;
      // The wave builds quickly beyond the fixed hoist, crossing the whole cloth.
      const envelope=1-Math.exp(-u*7);
      const angle=phaseAt-u*7.4;
      const wave=(Math.sin(angle)*.15+Math.sin(angle*1.65+.6)*.025)*h*envelope;
      const stretch=1+Math.cos(angle+.6)*.10*envelope;
      flagCtx.drawImage(cloth,320*u,0,320/steps+1,136,x+w*u,y+wave,w/steps+.55,h*stretch);
    }
    flagCtx.restore();
  }
  function drawClouds(){
    cloudCtx.clearRect(0,0,1672,941);cloudCtx.globalCompositeOperation='source-over';
    const layers=[{x:340,y:40,s:.70,v:15,a:.55},{x:830,y:90,s:.85,v:13,a:.53},{x:1320,y:45,s:.65,v:15,a:.5},{x:540,y:205,s:.58,v:17,a:.48},{x:1070,y:170,s:.95,v:12,a:.54},{x:1510,y:270,s:.63,v:16,a:.48},{x:150,y:310,s:.55,v:18,a:.44}];
    for(const c of layers){const x=((c.x+time*c.v+400)%2472)-400;cloudCtx.globalAlpha=c.a;cloudCtx.drawImage(cloud,x,c.y,360*c.s,150*c.s);}
    cloudCtx.globalAlpha=1;
    ctx.drawImage(clouds,0,0);
  }
  function draw(){
    const scale=Math.max(width/1672,height/941),ox=(width-1672*scale)/2,oy=(height-941*scale)/2;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    ctx.translate(ox,oy);ctx.scale(scale,scale);
    const skyTint=ctx.createLinearGradient(0,0,0,700);skyTint.addColorStop(0,'#24aafa');skyTint.addColorStop(1,'#86dcf5');
    ctx.fillStyle=skyTint;ctx.fillRect(0,0,1672,941);
    drawClouds();
    flagCtx.clearRect(0,0,1672,941);flagCtx.globalCompositeOperation='source-over';
    // Attachment edges sit on the RIGHT side of each pole, below its finial.
    drawFlag(576,38,100,41,0);drawFlag(1190,253,76,32,2.1);drawFlag(1065,402,44,18,4.3);

    ctx.drawImage(pennants,0,0,1672,941);
    // Small stationary fabric sleeves bridge the protected pole edge and cloth.
    // They sit below finials and never move across the gold pole or roof.
    ctx.fillStyle='#451553';
    for(const [x,y,w,h] of [[578,41,6,27],[1192,256,6,20],[1067,404,4,11]]){
      ctx.beginPath();ctx.roundRect(x,y,w,h,1);ctx.fill();
    }
    // Architecture, including the poles, occludes the cloth attachments naturally.
    ctx.drawImage(background,0,0,1672,941);
  }
  function tick(now){frame=0;if(document.hidden)return;
    if(last)time+=Math.min((now-last)/1000,.05);last=now;
    if(now-previousPaint>=32){draw();previousPaint=now;}
    if(!reduced.matches)frame=requestAnimationFrame(tick);
  }
  function resume(){cancelAnimationFrame(frame);last=0;if(!document.hidden){draw();if(!reduced.matches)frame=requestAnimationFrame(tick);}}
  const observer=new ResizeObserver(resize);observer.observe(element);
  document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
  resize();resume();element.dataset.kingdomReady='true';
  if(new URLSearchParams(location.search).has('qa'))window.kingdomQA={
    renderAt(seconds){cancelAnimationFrame(frame);time=seconds;draw();},
    background,canvas
  };
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);canvas.remove();};
}

const $=s=>document.querySelector(s), money=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
await mountKingdom($('#game')).catch(error=>console.warn('Kingdom background fallback',error));
const KEY='sweet-cascade-v1';let saved;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}
const rgs=new DemoRGS(saved),sound=new Sound();let state=rgs.snapshot(),busy=false,held=false,auto=0,speed=1,selected=null,displayWin=state.bonus?.win||0,displayMult=state.bonus?.mult||1,lastInput=Date.now();
await Promise.all([document.fonts.load('700 28px Alexandria'),sound.loadSamples()]);
const app=new PIXI.Application();await app.init({width:711,height:711,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,preference:'webgl'});$('#board').appendChild(app.canvas);
const stage=new PIXI.Container();app.stage.addChild(stage);stage.position.set(5.4,5.4);const frame=new PIXI.Sprite(frameTexture());frame.position.set(-5.4,-5.4);stage.addChild(frame);const bg=new PIXI.Graphics();stage.addChild(bg);
for(let i=0;i<49;i++){const x=20+i%7*94,y=20+Math.floor(i/7)*94;bg.roundRect(x,y,92,92,9).fill((Math.floor(i/7)+i%7)%2?0x1b2742:0x142039).stroke({color:0x34405e,width:1});}
const hoverCell=new PIXI.Graphics().roundRect(-43,-43,86,86,10).fill(0x9abfff);hoverCell.filters=[new PIXI.BlurFilter({strength:5,quality:4})];hoverCell.alpha=0;hoverCell.eventMode='none';bg.addChild(hoverCell);let hoveredCell=null,hoverOpacity=0;
const pieces=new PIXI.Container(),fx=new PIXI.Container();stage.addChild(pieces,fx);const textures=Array.from({length:6},(_,i)=>candyTexture(i)),special={bomb:specialTexture('bomb'),ice:specialTexture('ice'),rocket:Array.from({length:4},(_,i)=>specialTexture('rocket',i))};const nodes=new Map();let visual=[];const anims=[],particles=[];
const candyBounds=[],iceTextures=[],boosterArt={};
try{const atlas=await PIXI.Assets.load('public/boosters.png');const w=atlas.width/2,h=atlas.height,canvas=document.createElement('canvas');canvas.width=atlas.width;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(atlas.source.resource,0,0);for(let k=0;k<2;k++){const pixels=ctx.getImageData(k*w,0,w,h).data;let left=w,top=h,right=0,bottom=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}boosterArt[k===0?'bomb':'rocket']={texture:new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(k*w,0,w,h)}),w,h,cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};}}catch(e){console.warn('Fallback booster art',e);}
try{const atlas=await PIXI.Assets.load('public/ice.png');for(let i=0;i<3;i++)iceTextures[i]=new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(i*512,0,512,512)});}catch(e){console.warn('Fallback ice art',e);}
function symbolGlow(n,color=0xffefac,alpha=.65,spread=1.1,blur=7){const source=n.sprite,g=new PIXI.Sprite(source.texture);g.anchor.copyFrom(source.anchor);g.scale.copyFrom(source.scale);const rgb=new PIXI.Color(color).toArray(),white=new PIXI.ColorMatrixFilter();white.matrix=[0,0,0,0,rgb[0],0,0,0,0,rgb[1],0,0,0,0,rgb[2],0,0,0,1,0];g.filters=[white,new PIXI.BlurFilter({strength:blur,quality:4})];g.glowSpread=spread;g.blendMode='add';g.alpha=alpha;n.addChildAt(g,0);(n.glows??=[]).push(g);return g;}
function signature(c){return [c.kind,c.color,c.hp,c.magic,c.mult,c.dir].join(':');}
try {const atlas=await PIXI.Assets.load('public/candies.png');const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(atlas.source.resource,0,0);for(let i=0;i<6;i++){const ox=i%3*512,oy=Math.floor(i/3)*512;const pixels=ctx.getImageData(ox,oy,512,512).data;let left=512,top=512,right=0,bottom=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}candyBounds[i]={cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};textures[i]=new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(ox,oy,512,512)});}}catch(e){console.warn('Using procedural fallback candy art',e);}
try{const candy=await PIXI.Assets.load('public/pink-candy.png');const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(candy.source.resource,0,0,512,512);const data=ctx.getImageData(0,0,512,512).data;let left=512,top=512,right=0,bottom=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}textures[1]=candy;candyBounds[1]={cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left+1,bottom-top+1)};}catch(e){console.warn('Pink candy fallback',e);}
const pos=i=>({x:66+i%7*94,y:66+Math.floor(i/7)*94});
function tween(obj,to,ms=200,ease=t=>1-(1-t)**3){const from={};for(const k in to)from[k]=obj[k];return new Promise(resolve=>anims.push({obj,to,from,ms:ms/speed,t:0,ease,resolve}));}
function pause(ms){return tween({v:0},{v:1},ms);}
function label(text,size=28,color='#ffffff'){const t=new PIXI.Text({text,style:{fontFamily:'Alexandria',fontSize:size,fontWeight:'800',fill:color,stroke:{color:'#293352',width:4},dropShadow:{color:'#071024',blur:2,distance:3,alpha:.7}}});t.anchor.set(.5);return t;}
function make(c){const n=new PIXI.Container();n.cid=c.id;n.signature=signature(c);n.kind=c.kind;n.color=c.color;let texture=c.kind==='candy'?textures[c.color]:c.kind==='rocket'?special.rocket[c.dir]:c.kind==='ice'&&iceTextures.length?iceTextures[Math.max(0,Math.min(2,(c.maxHp??3)-c.hp))]:special[c.kind];const s=new PIXI.Sprite(texture||textures[c.color]);s.anchor.set(.5);s.width=s.height=c.kind==='ice'&&iceTextures.length?104:80;if(c.kind==='candy'&&candyBounds[c.color]){const b=candyBounds[c.color];s.anchor.set(b.cx/512,b.cy/512);s.width=s.height=80*512/b.size*(c.color===1?.92:1);}if(boosterArt[c.kind]){const art=boosterArt[c.kind];s.texture=art.texture;s.anchor.set(art.cx/art.w,art.cy/art.h);s.width=84*art.w/art.size;s.height=84*art.h/art.size;if(c.kind==='rocket')s.rotation=c.dir*Math.PI/2;}n.baseSpriteScale=s.scale.x;n.baseSpriteScaleY=s.scale.y;n.baseSpriteRotation=s.rotation;n.phase=(Number(c.id)*2.399963)||Math.random()*6.28;n.idleRate=.85+((Number(c.id)*.618)%1)*.35;n.addChild(s);n.sprite=s;n.eventMode='static';n.cursor=c.kind==='ice'?'default':'pointer';n.on('pointerdown',e=>down(n.index,e));n.on('pointerup',e=>up(n.index,e));if(c.magic)n.magicRing=symbolGlow(n,0xffdf73,.9,1.22,3.5);if(c.mult){const b=label('×'+c.mult,c.kind==='ice'?25:27,'#fff7a5');b.position.set(0,0);n.multiplierLabel=b;if(c.kind==='ice'){const damage=(c.maxHp??3)-c.hp;b.visible=damage>0;b.alpha=damage===1?.85:1;n.addChildAt(b,0);s.alpha=damage===0?1:damage===1?.85:.65;if(damage>0){const mask=new PIXI.Graphics().rect(-60,-60,120,120).fill(0xffffff);const hole=damage===1?[-18,-10,-3,-18,7,-5,2,9,-11,15,-23,2]:[-34,-16,-12,-30,2,-22,24,-29,34,-8,23,6,31,24,9,32,-6,22,-27,29,-36,8];mask.poly(hole).cut();n.addChild(mask);s.mask=mask;}}else n.addChild(b);}if(c.kind==='ice'&&!iceTextures.length&&c.hp<3){const cracks=new PIXI.Graphics().moveTo(-25,-42).lineTo(2,-9).lineTo(-16,8).lineTo(22,40).stroke({color:0xd8fbff,width:3});n.addChild(cracks);}pieces.addChild(n);nodes.set(c.id,n);return n;}
function draw(board){const ids=new Set(board.filter(Boolean).map(c=>c.id));for(const[id,n]of nodes)if(!ids.has(id)){n.destroy({children:true});nodes.delete(id);}board.forEach((c,i)=>{if(!c)return;let n=nodes.get(c.id);if(n&&n.signature!==signature(c)){n.destroy({children:true});nodes.delete(c.id);n=null;}if(!n)n=make(c);n.index=i;Object.assign(n,pos(i));});visual=clone(board);}
const boardMask=new PIXI.Graphics().roundRect(20,20,658,658,8).fill(0xffffff);stage.addChild(boardMask);pieces.mask=boardMask;
async function fall(board){const ids=new Set(board.filter(Boolean).map(c=>c.id));for(const[id,n]of nodes)if(!ids.has(id)){n.destroy({children:true});nodes.delete(id);}let landingPlayed=false;const jobs=[],newCount=Array(7).fill(0),ranks=Array(7).fill(0);board.forEach((c,i)=>{if(!nodes.has(c.id))newCount[i%7]++;});board.forEach((c,i)=>{let n=nodes.get(c.id),p=pos(i),col=i%7;if(!n){n=make(c);n.x=p.x;n.y=66-(newCount[col]-ranks[col]++)*94;}n.index=i;const distance=Math.abs(n.y-p.y);if(distance>1){jobs.push((async()=>{await pause(col*7);const duration=160+Math.sqrt(distance)*9;await Promise.all([tween(n,{y:p.y+5},duration,t=>t*t),tween(n.scale,{x:.81,y:1.24},duration*.48)]);if(!landingPlayed){landingPlayed=true;sound.play('land',sound.cascade);}await Promise.all([tween(n,{y:p.y+3},55),tween(n.scale,{x:1.22,y:.76},55)]);await Promise.all([tween(n,{y:p.y-4},85),tween(n.scale,{x:.93,y:1.10},85)]);await Promise.all([tween(n,{y:p.y+1},80),tween(n.scale,{x:1.045,y:.95},80)]);await Promise.all([tween(n,{y:p.y},95),tween(n.scale,{x:1,y:1},95)]);})());}});await Promise.all(jobs);visual=clone(board);}
function burst(i,color,count=16){let p=pos(i);for(let k=0;k<count;k++){const g=new PIXI.Graphics(),r=2+Math.random()*4;const tint=k%5===0?0xffffff:color;if(k%5===0){g.moveTo(0,-r*2).lineTo(r*.5,-r*.5).lineTo(r*2,0).lineTo(r*.5,r*.5).lineTo(0,r*2).lineTo(-r*.5,r*.5).lineTo(-r*2,0).lineTo(-r*.5,-r*.5).closePath().fill(tint);}else g.circle(0,0,r).fill(tint);g.circle(0,0,r*2.5).fill({color:tint,alpha:.11});g.x=p.x;g.y=p.y;g.blendMode='add';fx.addChild(g);const a=Math.random()*Math.PI*2,v=65+Math.random()*155;particles.push({g,vx:Math.cos(a)*v,vy:Math.sin(a)*v-65,life:.45+Math.random()*.4,total:.85});}}
function cellGlow(i){const c=visual[i],color=c?.kind==='ice'?0xb7edff:palette[c?.color]??0xffdc86;const light=color;const glow=new PIXI.Container();Object.assign(glow,pos(i));bg.addChild(glow);const wash=new PIXI.Graphics().circle(0,0,42).fill({color,alpha:.68});wash.filters=[new PIXI.BlurFilter({strength:14,quality:4})];wash.blendMode='normal';const halo=new PIXI.Graphics().roundRect(-44,-44,88,88,9).stroke({color:light,width:5,alpha:.55});halo.filters=[new PIXI.BlurFilter({strength:5,quality:4})];halo.blendMode='add';const outline=new PIXI.Graphics().roundRect(-44,-44,88,88,9).stroke({color,width:2.5,alpha:.9});outline.filters=[new PIXI.BlurFilter({strength:.9,quality:3})];glow.addChild(wash,halo,outline);glow.alpha=0;tween(glow,{alpha:1},100).then(()=>pause(300)).then(()=>tween(glow,{alpha:0},220)).then(()=>glow.destroy({children:true}));}
function popFlash(i){const g=new PIXI.Graphics();for(let r=40;r>0;r-=4)g.circle(0,0,r).fill({color:r<14?0xffffff:0x5ee0ff,alpha:r<14?.7:.1});Object.assign(g,pos(i));g.blendMode='add';fx.addChild(g);g.scale.set(.1);tween(g.scale,{x:1.5,y:1.5},100).then(()=>tween(g.scale,{x:.2,y:.2},180));tween(g,{alpha:0},330).then(()=>g.destroy());}
function float(text,i,color='#ffef9c'){let t=label(text,30,color);Object.assign(t,pos(i));fx.addChild(t);tween(t,{y:t.y-70,alpha:0},800).then(()=>t.destroy());}
async function shuffleBoard(board){sound.play('shuffle');float('SHUFFLE',24);const moving=()=>[...nodes.values()].filter(n=>n.kind!=='ice');await Promise.all(moving().map(n=>Promise.all([tween(n,{x:350,y:350,rotation:Math.PI,alpha:0},400),tween(n.scale,{x:.1,y:.1},400)])));draw(board);for(const n of moving()){n.rotation=0;n.scale.set(.1);n.alpha=0;}await Promise.all(moving().map(n=>Promise.all([tween(n.scale,{x:1,y:1},300),tween(n,{alpha:1},250)])));}
async function effect(e){let p=pos(e.i);if(e.kind==='bomb'){sound.play('bomb');let ring=new PIXI.Graphics().circle(0,0,20).stroke({color:0xffd67b,width:12});Object.assign(ring,p);fx.addChild(ring);tween(ring.scale,{x:7,y:7},330);tween(ring,{alpha:0},330).then(()=>ring.destroy());await tween(stage,{x:11.4,y:2.4},40);await tween(stage,{x:1.4,y:9.4},50);await tween(stage,{x:5.4,y:5.4},60);}else{sound.play('rocket');let trail=new PIXI.Graphics();let dx=[0,1,0,-1][e.dir],dy=[-1,0,1,0][e.dir];trail.moveTo(p.x,p.y).lineTo(p.x+dx*700,p.y+dy*700).stroke({color:0xfff6ac,width:16,alpha:.85});fx.addChild(trail);tween(trail,{alpha:0},300).then(()=>trail.destroy());}}
function hud(){const b=state.bonus;$('#balance').textContent=money(state.balance);$('#bet').textContent=money(state.bet);$('#cost').textContent=b?'FREE MOVE':money(rgs.cost())+' per move';$('#win').textContent=money(displayWin);$('#mult').textContent=displayMult+'×';$('#win-label').textContent=b?'BONUS WIN':'WIN';$('#mode').textContent=b?'FROSTED FACTORY':({base:'NORMAL PLAY',luck:'EXTRA LUCK · ×2',enhanced:'ENHANCED MOVES · ×50',mayhem:'MULTI MAYHEM · ×1000'}[state.mode]);$('#meter-title').textContent=b?'MOVES LEFT: '+b.moves:'ICE BONUS';$('#moves-label').textContent=b?'Magic candy = +1 move':'Collect 3 magic candies';$('#meter').style.display=b?'none':'flex';[...$('#meter').children].forEach((e,i)=>e.classList.toggle('on',i<state.meter));$('#game').classList.toggle('bonus-active',!!b);for(const id of ['minus','plus','bonus'])$('#'+id).disabled=busy||!!b;$('#play').disabled=busy;$('#auto').classList.toggle('active',auto>0);$('#auto').title=auto?'Remaining: '+auto:'Autoplay';}
function persist(){localStorage.setItem(KEY,JSON.stringify(rgs.snapshot()));}
let toastTimer;function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function stop(){held=false;auto=0;hud();}
function modal(html){stop();$('#dialog-content').innerHTML=html;$('#dialog').showModal();}
function close(){sound.cancelCelebration();$('#dialog').close();lastInput=Date.now();}$('#close').onclick=close;$('#dialog').addEventListener('close',()=>sound.cancelCelebration());
document.addEventListener('pointerdown',()=>sound.unlock(),{once:true});
let pointer=null;
function restoreDrag(d=pointer){if(!d)return;for(const i of [d.i,d.neighbor]){const n=nodes.get(visual[i]?.id);if(n)Object.assign(n,pos(i));}}
function cancelDrag(){if(!pointer)return;restoreDrag();pointer=null;select(null);}
function down(i,e){if(busy||$('#dialog').open||visual[i]?.kind==='ice')return;sound.unlock();lastInput=Date.now();pointer={i,x:e.global.x,y:e.global.y,target:null,moved:false,second:selected!==null&&selected!==i?selected:null};select(i);}
function drag(e){if(!pointer||busy)return;const d=pointer,dx=e.global.x-d.x,dy=e.global.y-d.y;if(Math.hypot(dx,dy)<8&&!d.moved)return;d.moved=true;const horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy;const j=d.i+(horizontal?Math.sign(delta):Math.sign(delta)*7);const valid=j>=0&&j<49&&Math.abs(j%7-d.i%7)+Math.abs(Math.floor(j/7)-Math.floor(d.i/7))===1&&visual[j]?.kind!=='ice';if(valid&&!d.swishPlayed){sound.play('swap');d.swishPlayed=true;}d.target=valid&&Math.abs(delta)>32?j:null;if(d.neighbor!==undefined&&d.neighbor!==j){const old=nodes.get(visual[d.neighbor]?.id);if(old)Object.assign(old,pos(d.neighbor));}d.neighbor=valid?j:undefined;const n=nodes.get(visual[d.i]?.id),origin=pos(d.i);if(!n)return;const amount=valid?Math.min(94,Math.abs(delta)):Math.min(18,Math.abs(delta)*.2);n.x=origin.x+(horizontal?Math.sign(delta)*amount:0);n.y=origin.y+(horizontal?0:Math.sign(delta)*amount);if(valid){const other=nodes.get(visual[j]?.id),dest=pos(j),progress=Math.min(1,amount/70);other.x=dest.x+(origin.x-dest.x)*progress;other.y=dest.y+(origin.y-dest.y)*progress;}pieces.setChildIndex(n,pieces.children.length-1);}
function up(i,e){if(!pointer||busy)return;const d=pointer;if(e)drag(e);const target=d.moved?d.target:d.second;pointer=null;select(null);if(target!==null){play(d.i,target,d.swishPlayed===true);}else{restoreDrag(d);if(!d.moved)select(d.i);}}
app.stage.eventMode='static';app.stage.hitArea=new PIXI.Rectangle(0,0,700,700);app.stage.on('globalpointermove',e=>{const col=Math.floor((e.global.x-25.4)/94),row=Math.floor((e.global.y-25.4)/94);hoveredCell=col>=0&&col<7&&row>=0&&row<7?row*7+col:null;drag(e);});app.canvas.addEventListener('pointerleave',()=>{hoveredCell=null;});app.stage.on('pointerup',e=>{if(pointer)up(pointer.i,e);});app.stage.on('pointerupoutside',cancelDrag);app.canvas.addEventListener('pointercancel',cancelDrag);
function select(i){selected=i;}
async function play(a,b,swishPlayed=false){if(busy||pointer||$('#dialog').open)return;sound.unlock();sound.cancelCelebration();sound.cascade=0;lastInput=Date.now();if(a===undefined){const m=moves(state.board);if(!m.length){stop();toast('No moves available. The board needs a reshuffle.');return;}[a,b]=m[Math.floor(Math.random()*m.length)];}busy=true;select(null);hud();$('#message').style.opacity=0;
 try{let before=rgs.snapshot(),result;try{result=rgs.play(a,b,crypto.randomUUID(),state.version);}catch(e){rgs.s=before;throw e;}
  if(!result.accepted){sound.play('invalid');const na=nodes.get(visual[a]?.id),nb=nodes.get(visual[b]?.id);if(na&&nb){await Promise.all([tween(na,pos(b),110),tween(nb,pos(a),110)]);await Promise.all([tween(na,pos(a),150),tween(nb,pos(b),150)]);}return;}
  persist();state.balance=before.balance-(before.bonus?0:before.bet*({base:1,luck:2,enhanced:50,mayhem:1000}[before.mode]));if(auto&&!before.bonus)auto--;hud();
  for(const e of result.events){if(e.type==='swap'){if(!swishPlayed)sound.play('swap');if(state.bonus)state.bonus.moves=e.moves;hud();let na=nodes.get(visual[a]?.id),nb=nodes.get(visual[b]?.id);await Promise.all([tween(na,pos(b),165),tween(nb,pos(a),165)]);visual=clone(e.board);nodes.get(visual[a].id).index=a;nodes.get(visual[b].id).index=b;}
   if(e.type==='destroy'){const cells=[...e.cells,...e.ice];cells.forEach(cellGlow);await Promise.all(e.effects.map(effect));sound.cascade=Math.max(0,e.step);sound.play('pop',sound.cascade);
    // Anticipation: 50% scale, whitening and halo together; then a fast rebound.
    await Promise.all(cells.map(async i=>{const n=nodes.get(visual[i]?.id);if(!n)return;n.white={v:0};n.whiteFilter=new PIXI.ColorMatrixFilter();n.whiteBlur=new PIXI.BlurFilter({strength:0,quality:4});n.sprite.filters=[n.whiteFilter,n.whiteBlur];const halo=symbolGlow(n,0xffffff,0);await Promise.all([tween(n.scale,{x:.5,y:.5},270,t=>t*t),tween(n.white,{v:1},270),tween(halo,{alpha:.55},270)]);await tween(n.scale,{x:.64,y:.64},110,t=>1-(1-t)**2);}));
    if(e.ice.length)sound.play('ice');else if(e.damage.length)sound.play('iceHit');
    await Promise.all(cells.map(async i=>{const c=visual[i],n=nodes.get(c?.id);if(!n)return;popFlash(i);burst(i,c.kind==='ice'?0xb7edff:palette[c.color],c.kind==='ice'?36:32);if(c.magic){sound.play('magic');float(state.bonus?'+1 MOVE':'★',i);if(!state.bonus)state.meter=Math.min(3,state.meter+1);}if(c.mult)float('×'+c.mult,i);return Promise.all([tween(n.scale,{x:.02,y:.02},115,t=>t*t),tween(n,{alpha:0},115)]);}));
    for(const i of cells){const id=visual[i]?.id,n=nodes.get(id);if(n){n.destroy({children:true});nodes.delete(id);}visual[i]=null;}
    for(const i of e.damage)if(!e.ice.includes(i)){const old=nodes.get(visual[i]?.id);if(old){old.destroy({children:true});nodes.delete(visual[i].id);}let c=e.board[i],n=make(c);n.index=i;Object.assign(n,pos(i));burst(i,0xb7edff,14);tween(n.scale,{x:1.08,y:.93},65).then(()=>tween(n.scale,{x:1,y:1},140));visual[i]=clone(c);}
    for(const id of e.armed){const n=nodes.get(id);if(n){if(!n.armedGlow)n.armedGlow=symbolGlow(n,0xffdc86,.85);float('✦',n.index);}}
    if(e.mult>displayMult)sound.play('multiplier');displayWin=e.win;displayMult=e.mult;if(state.bonus)state.bonus.moves=e.moves;hud();if(e.step>=2){$('#message').textContent=['SWEET CASCADE!','GREAT CHAIN!','SWEET CASCADE!'][Math.min(2,Math.floor(e.step/3))];$('#message').style.opacity=1;}await pause(90);
   }if(e.type==='fall')await fall(e.board);if(e.type==='shuffle')await shuffleBoard(e.board);
  }
  state=result.state;displayWin=result.win;draw(state.board);hud();if(result.bonusStarted){sound.play('bonus');modal('<h2>FROSTED FACTORY</h2><p>5 free moves. Break the ice and collect multipliers. Magic candies award extra moves.</p><button class="modal-action" id="continue">START BONUS</button>');$('#continue').onclick=()=>{sound.play('transition');close();};displayWin=0;displayMult=1;}
  else if(result.bonusEnded){sound.celebrate(result.win/(before.bonus?.bet||state.bet));modal('<h2>BONUS COMPLETE</h2><p>Total win</p><h1>'+money(result.win)+'</h1><button class="modal-action" id="continue">CONTINUE</button>');$('#continue').onclick=()=>{sound.play('winEnd');close();};}
  else if(result.win>=state.bet*15){sound.celebrate(result.win/state.bet);float('+'+money(result.win),24);await pause(450);}
 }catch(e){console.error(e);stop();toast(e.message);}finally{busy=false;state=rgs.snapshot();hud();if((held||auto>0)&&!$('#dialog').open&&!document.hidden)setTimeout(()=>play(),220/speed);}
}
$('#play').onclick=()=>play();$('#sound').onclick=()=>{sound.unlock();sound.enabled=!sound.enabled;$('#sound').style.opacity=sound.enabled?1:.45;};$('#turbo').onclick=()=>{speed=speed===1?1.8:1;$('#turbo').classList.toggle('active',speed!==1);sound.play('click');};
const bets=[.1,.2,.5,1,2,5,10,20,50,100];function changeBet(dir){if(busy||state.bonus)return;let i=bets.indexOf(state.bet);rgs.s.bet=bets[Math.max(0,Math.min(bets.length-1,i+dir))];state=rgs.snapshot();persist();hud();sound.play('click');}$('#minus').onclick=()=>changeBet(-1);$('#plus').onclick=()=>changeBet(1);
$('#bonus').onclick=()=>{if(busy||state.bonus)return;modal('<h2>CHOOSE A MODE</h2><div class="cards">'+[['base','Normal play','1× per move'],['luck','Extra Luck','2× per move · more magic candies'],['enhanced','Enhanced Moves','50× per move · bombs, rockets and multipliers'],['ice','Frosted Factory','100× · buy 5 free moves'],['mayhem','Multi Mayhem','1000× per move · multiplier board']].map(([id,name,desc])=>`<button class="card" data-mode="${id}"><b>${name}</b><span>${desc}</span><span>${money(state.bet*({base:1,luck:2,enhanced:50,ice:100,mayhem:1000}[id]))} credits</span></button>`).join('')+'</div>');document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{const mode=b.dataset.mode;$('#dialog-content').innerHTML='<h2>'+b.querySelector('b').textContent+'</h2><p>'+ (mode==='ice'?'Cost: '+money(state.bet*100)+' demo credits.':'Changing mode is free. Your next move uses the selected price.')+'</p><button id="confirm" class="modal-action">CONFIRM</button>';$('#confirm').onclick=()=>{try{state=mode==='ice'?rgs.buy():rgs.mode(mode);persist();displayWin=0;displayMult=1;draw(state.board);hud();close();sound.play(mode==='ice'?'bonus':'click');}catch(e){toast(e.message);}};});};
$('#auto').onclick=()=>{if(auto){stop();return;}modal('<h2>AUTOPLAY</h2><p>Choose the number of paid moves. Stopping autoplay lets the current move finish.</p><div class="choices">'+[5,10,25,50,100,250,500,1000].map(n=>`<button data-count="${n}">${n}</button>`).join('')+'</div>');document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{auto=Number(b.dataset.count);close();hud();if(!busy)play();});};
$('#settings').onclick=()=>{modal('<h2>SETTINGS</h2><label><input id="sfx-check" type="checkbox" '+(sound.enabled?'checked':'')+'> Sound effects</label><label><input id="music-check" type="checkbox" '+(sound.music?'checked':'')+'> Background music</label><p>Your board and bonus progress are saved in this browser.</p>');$('#sfx-check').onchange=e=>{sound.unlock();sound.enabled=e.target.checked;};$('#music-check').onchange=e=>{sound.unlock();sound.music=e.target.checked;};};
$('#history').onclick=()=>modal('<h2>MOVE HISTORY</h2><table><tr><th>Time</th><th>Cost</th><th>Win</th><th>Multiplier</th></tr>'+state.history.slice(0,20).map(h=>`<tr><td>${new Date(h.time).toLocaleTimeString('en-US')}</td><td>${h.bonus?'Bonus':money(h.cost)}</td><td>${money(h.win)}</td><td>×${h.mult}</td></tr>`).join('')+'</table>');
$('#rules').onclick=()=>modal('<h2>SWEET CASCADE</h2><p>Swap adjacent candies to match 3 or more. You can also move a rocket or bomb. Invalid swaps return without charging credits.</p><p>A line of 4 clears a row or column. A line of 5 or more clears that color. Intersections clear their bounding rectangle. Rockets fire in the arrow direction; bombs clear a 3×3 area.</p><p>Every 3 candies destroyed in a cascade step count as one chain. Demo payout: bet × 0.05 × max(chains × multiplier sum − 1, 0). A single match of 3 with no continuation pays nothing.</p><p>Collect 3 magic candies to trigger the ice bonus. Wins and multipliers accumulate during the bonus. Each destroyed magic candy adds one move.</p><p>Press Space for an automatic move; hold to repeat. The board persists between moves and after reloading.</p><p>This client demo uses test generation, no real money and no declared RTP. Final mathematics and unresolved edge cases require the production RGS.</p>');
window.addEventListener('keydown',e=>{if(e.code==='Escape'){stop();return;}if(e.code!=='Space'||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||$('#dialog').open)return;e.preventDefault();if(e.repeat)return;held=true;if(!busy)play();});window.addEventListener('keyup',e=>{if(e.code==='Space')held=false;});window.addEventListener('blur',()=>{held=false;cancelDrag();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();cancelDrag();}});
app.ticker.add(t=>{let dt=Math.min(t.deltaMS,50);const hoverActive=hoveredCell!==null&&!busy&&!pointer;hoverOpacity+=(Number(hoverActive)-hoverOpacity)*Math.min(1,dt/110);if(hoverActive)Object.assign(hoverCell,pos(hoveredCell));hoverCell.alpha=hoverOpacity*(.17+.045*Math.sin(performance.now()*.0032));for(let i=anims.length-1;i>=0;i--){const a=anims[i];a.t+=dt;let p=Math.min(a.t/a.ms,1),e=a.ease(p);if(!a.obj.destroyed)for(const k in a.to)a.obj[k]=a.from[k]+(a.to[k]-a.from[k])*e;if(p===1){anims.splice(i,1);a.resolve();}}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt/1000;p.g.x+=p.vx*dt/1000;p.g.y+=p.vy*dt/1000;p.vy+=460*dt/1000;p.g.alpha=Math.max(0,p.life/p.total);p.g.rotation+=dt*.003;if(p.life<=0){p.g.destroy();particles.splice(i,1);}}for(const n of nodes.values()){if(n.whiteFilter){const v=n.white.v,k=1-v;n.whiteBlur.strength=.8*v;n.whiteFilter.matrix=[k,0,0,0,v,0,k,0,0,v,0,0,k,0,v,0,0,0,1,0];}if(['candy','bomb','rocket'].includes(n.kind)){const phase=performance.now()*.0019*n.idleRate+n.phase;const amp=1;const emphasis=selected===n.index?1.045:1;n.sprite.y=Math.sin(phase)*2.1*amp;n.sprite.rotation=n.baseSpriteRotation+Math.sin(phase*.79)*.016*amp;n.sprite.scale.set(n.baseSpriteScale*emphasis*(1+Math.sin(phase*1.17)*.016*amp),n.baseSpriteScaleY*emphasis*(1-Math.sin(phase*1.17)*.016*amp));if(n.multiplierLabel){const b=n.multiplierLabel;b.position.copyFrom(n.sprite.position);b.rotation=n.sprite.rotation-n.baseSpriteRotation;b.scale.set(n.sprite.scale.x/n.baseSpriteScale,n.sprite.scale.y/n.baseSpriteScaleY);}}for(const g of n.glows||[]){g.position.copyFrom(n.sprite.position);g.rotation=n.sprite.rotation;g.scale.set(n.sprite.scale.x*g.glowSpread,n.sprite.scale.y*g.glowSpread);}}});
draw(state.board);hud();persist();window.sweetCascade={rgs,play,get state(){return clone(state);},get busy(){return busy;},app};
// Reproducible visual QA is opt-in and never changes the normal game session.
if(new URLSearchParams(location.search).has('qa')){const qa=document.createElement('button');qa.textContent='VFX TEST';qa.style.cssText='position:fixed;bottom:50px;left:10px;z-index:5;background:#172944;padding:10px;border-radius:8px';document.body.append(qa);qa.onclick=async()=>{if(busy)return;busy=true;try{await effect({kind:'bomb',i:24});burst(24,0xffd65a,40);await pause(500);await effect({kind:'rocket',i:38,dir:0});await pause(500);await shuffleBoard(state.board);}finally{busy=false;}};}

