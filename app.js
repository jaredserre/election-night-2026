const PARTY={D:{name:'Democrat',color:'var(--dem)'},R:{name:'Republican',color:'var(--gop)'},I:{name:'Independent / Other',color:'var(--other)'}};
let races=[];
const $=s=>document.querySelector(s);
const fmt=n=>Number(n||0).toLocaleString();
const party=p=>PARTY[p]||PARTY.I;

async function load(){
  try{
    const [r,c,t]=await Promise.all([
      fetch('data/races.json?'+Date.now()).then(x=>x.json()),
      fetch('data/control.json?'+Date.now()).then(x=>x.json()),
      fetch('data/timeline.json?'+Date.now()).then(x=>x.json())
    ]);
    races=r.races||[]; renderControl(c); renderTimeline(t.events||[]); renderRaces(); renderSummary();
    const d=r.lastUpdated?new Date(r.lastUpdated):null;
    const stamp=d&&!isNaN(d)?`Updated ${d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}`:'Not updated yet';
    $('#lastUpdated').textContent=stamp; $('#footerUpdated').textContent=stamp;
  }catch(e){$('#raceGrid').innerHTML='<div class="empty-state"><h3>Could not load data</h3><p>Check that the data JSON files are valid and committed to GitHub.</p></div>';console.error(e)}
}
function renderControl(c){
  [['house',c.house],['senate',c.senate]].forEach(([k,v])=>{
    const cap=k[0].toUpperCase()+k.slice(1), called=v.democratic+v.republican+(v.other||0), outstanding=Math.max(0,v.total-called);
    $('#'+k+'D').textContent=v.democratic; $('#'+k+'R').textContent=v.republican; $('#'+k+'Need').textContent=v.majority+' for control';
    $('#'+k+'Called').textContent=called+' called'; $('#'+k+'Outstanding').textContent=outstanding+' outstanding';
    $('#'+k+'DemBar').style.width=(v.democratic/v.total*100)+'%'; $('#'+k+'GopBar').style.width=(v.republican/v.total*100)+'%'; $('#'+k+'OtherBar').style.width=((v.other||0)/v.total*100)+'%';
  });
}
function candidateHTML(c){const p=party(c.party);return `<div class="candidate"><span class="party-stripe" style="background:${p.color}"></span><div><div class="candidate-name">${esc(c.name)}${c.incumbent?'<span class="incumbent" title="Incumbent">INC</span>':''}</div><div class="candidate-meta">${p.name}${c.winner?' • WINNER':''}</div></div><div class="candidate-result"><div class="candidate-pct">${Number(c.percent||0).toFixed(1)}%</div><div class="candidate-votes">${fmt(c.votes)} votes</div></div></div>`}
function renderRaces(){
  const f=$('#filterSelect').value; let list=races.filter(r=>f==='all'||(f==='called'&&r.called)||(f==='uncalled'&&!r.called)||String(r.office).toLowerCase()===f);
  $('#raceCount').textContent=list.length; $('#emptyState').hidden=races.length!==0;
  $('#raceGrid').innerHTML=list.map(r=>{const winner=(r.candidates||[]).find(c=>c.winner);const color=winner?party(winner.party).color:'var(--other)';return `<article class="race-card ${r.called?'called':''}" style="--winner:${color}"><div class="race-top"><div><div class="race-label">${esc(r.label)}</div><div class="race-sub">${esc(r.state||'')} ${r.office?'• '+esc(r.office):''}</div></div><span class="badge ${r.called?'called':''}">${r.called?(winner?'CALLED '+winner.party:'CALLED'):'UNCALLED'}</span></div>${(r.candidates||[]).map(candidateHTML).join('')}<div class="race-foot"><span>${Number(r.reporting||0).toFixed(1)}% reporting</span>${r.ddhqUrl?`<a class="ddhq" href="${safeUrl(r.ddhqUrl)}" target="_blank" rel="noopener">View on DDHQ ↗</a>`:''}</div></article>`}).join('');
}
function renderTimeline(events){const time=e=>{if(e.time)return e.time;if(!e.timestamp)return '';const d=new Date(e.timestamp);return isNaN(d)?'':d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'});};$('#timeline').innerHTML=events.length?events.map(e=>`<div class="timeline-item"><div class="timeline-time">${esc(time(e))}</div><div>${esc(e.text)}</div></div>`).join(''):'<div class="panel-empty">Race calls will appear here automatically as NBC News calls tracked races.</div>'}
function renderSummary(){const called=races.filter(r=>r.called),inc=races.flatMap(r=>r.candidates||[]).filter(c=>c.incumbent),incWon=inc.filter(c=>c.winner);const flips=races.filter(r=>r.called&&r.previousParty&&r.candidates?.find(c=>c.winner)?.party!==r.previousParty);$('#summary').innerHTML=[['Races called',called.length+' / '+races.length],['Outstanding',races.length-called.length],['Incumbents tracked',inc.length],['Incumbents called winners',incWon.length],['Party flips',flips.length]].map(x=>`<div class="summary-row"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}
function esc(s=''){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function safeUrl(u){try{const x=new URL(u);return x.protocol==='https:'?esc(x.href):'#'}catch{return '#'}}
$('#filterSelect').addEventListener('change',renderRaces);
$('#themeToggle').addEventListener('click',()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');localStorage.setItem('electionTheme',dark?'dark':'light');$('#themeToggle').innerHTML=dark?'☀ <span>Day</span>':'☾ <span>Night</span>'});
if(localStorage.getItem('electionTheme')==='dark'||(!localStorage.getItem('electionTheme')&&matchMedia('(prefers-color-scheme:dark)').matches)){$('body').classList.add('dark');$('#themeToggle').innerHTML='☀ <span>Day</span>'}
$('#addRaceBtn').addEventListener('click',()=>$('#raceDialog').showModal());
$('#generateBtn').addEventListener('click',()=>{const f=new FormData($('#raceForm'));const obj={id:String(f.get('label')).toLowerCase().replace(/[^a-z0-9]+/g,'-'),label:f.get('label'),office:f.get('office'),state:f.get('state'),statePostal:String(f.get('statePostal')||'').toUpperCase(),district:f.get('district')||null,apRaceId:f.get('apRaceId')||null,reporting:0,called:false,previousParty:null,ddhqUrl:f.get('ddhq'),candidates:[{name:f.get('c1name'),party:f.get('c1party'),incumbent:f.has('c1inc'),apCandidateId:f.get('c1apid')||null,votes:0,percent:0,winner:false},{name:f.get('c2name'),party:f.get('c2party'),incumbent:f.has('c2inc'),apCandidateId:f.get('c2apid')||null,votes:0,percent:0,winner:false}]};$('#jsonOutput').textContent=JSON.stringify(obj,null,2);$('#jsonOutputWrap').hidden=false});
$('#copyJson').addEventListener('click',async()=>{await navigator.clipboard.writeText($('#jsonOutput').textContent);$('#copyJson').textContent='Copied!';setTimeout(()=>$('#copyJson').textContent='Copy',1200)});
load();
// Refresh the browser view automatically. GitHub Pages serves the newest JSON after each updater commit.
setInterval(load, 60 * 1000);
