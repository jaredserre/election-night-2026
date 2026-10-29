import fs from 'node:fs/promises';

const WATCH_PATH='data/watchlist.json';
const RESULTS_PATH='data/races.json';
const TIMELINE_PATH='data/timeline.json';
const config=JSON.parse(await fs.readFile('config.json','utf8'));
const watch=JSON.parse(await fs.readFile(WATCH_PATH,'utf8'));
let previous={races:[]};
try{previous=JSON.parse(await fs.readFile(RESULTS_PATH,'utf8'));}catch{}
const previousById=new Map((previous.races||[]).map(r=>[r.id,r]));
let timeline={events:[]};
try{timeline=JSON.parse(await fs.readFile(TIMELINE_PATH,'utf8'));}catch{}
if(!Array.isArray(timeline.events)) timeline.events=[];
const output={lastUpdated:previous.lastUpdated||null,races:[]};
const override=process.env.NBC_RESULTS_URL || config?.nbc?.resultsUrl || '';
const electionDate=config.electionDate || '2026-11-03';

const candidateUrls=[override,
  `https://www.nbcnews.com/politics/2026-elections/results/${electionDate}`,
  'https://www.nbcnews.com/politics/2026-elections/results'
].filter(Boolean);

const headers={'user-agent':'Mozilla/5.0 (compatible; ElectionNightDashboard/1.0; +GitHub Pages)','accept':'text/html,application/json;q=0.9,*/*;q=0.8'};
async function fetchText(url){const r=await fetch(url,{headers,redirect:'follow'});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return {text:await r.text(),type:r.headers.get('content-type')||'',url:r.url};}
const arr=v=>Array.isArray(v)?v:(v==null?[]:[v]);
const first=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!=='');
const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function party(v){const p=String(v||'').toUpperCase();if(p==='D'||p.startsWith('DEM'))return'D';if(p==='R'||p==='GOP'||p.startsWith('REP'))return'R';return'I';}
function walk(o,out=[]){if(!o||typeof o!=='object')return out;if(Array.isArray(o)){for(const x of o)walk(x,out);return out;} const keys=Object.keys(o).map(k=>k.toLowerCase()); const hasCand=keys.some(k=>/candidate|contestant/.test(k)); const hasRace=keys.some(k=>/race|contest|office/.test(k)); if(hasCand&&hasRace)out.push(o); for(const v of Object.values(o))walk(v,out);return out;}
function jsonCandidates(html){const found=[]; const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1].trim()).filter(Boolean); for(const s of scripts){if(!(s.startsWith('{')||s.startsWith('[')))continue;try{found.push(JSON.parse(s));}catch{}} return found;}
function racesFromJson(root){const candidates=walk(root); const seen=new Set(); return candidates.filter(x=>{let sig;try{sig=JSON.stringify(x).slice(0,1000)}catch{return false}if(seen.has(sig))return false;seen.add(sig);return true;});}
function cands(r){return arr(first(r.candidates,r.candidate,r.contestants,r.results,r?.race?.candidates,r?.contest?.candidates));}
function cname(c){return String(first(c.name,c.fullName,c.candidateName,c.displayName,c?.candidate?.name,[c.firstName,c.lastName].filter(Boolean).join(' '),'')).trim();}
function cvotes(c){return Number(first(c.votes,c.voteCount,c.totalVotes,c.rawVotes,c?.results?.votes,0))||0;}
function cpct(c){return Number(first(c.percent,c.votePercent,c.votePercentage,c.percentage,c.pct,c?.results?.percent,0))||0;}
function cwin(c){const v=first(c.winner,c.isWinner,c.projected,c.called,c?.results?.winner,false);return v===true||v===1||String(v).toLowerCase()==='true'||String(v).toUpperCase()==='X';}
function cparty(c){return party(first(c.party,c.partyCode,c.partyId,c?.candidate?.party,''));}
function rtext(r){return clean([first(r.office,r.officeName,r.raceName,r.title,r.name,r?.race?.name,''),first(r.state,r.stateCode,r.statePostal,''),first(r.district,r.districtNumber,r.seat,'')].join(' '));}
function reporting(r){const x=first(r.percentReporting,r.reportingPercent,r.expectedVotePercentage,r.eevp,r.percentIn,r?.results?.percentReporting);return Number(x)||0;}
function scoreRace(w,r){let s=0;const t=rtext(r),office=clean(w.office);if(office&&t.includes(office))s+=3;const st=clean(w.statePostal||w.state);if(st&&t.includes(st))s+=2;const d=clean(w.district);if(d&&t.includes(d))s+=2;const rn=cands(r).map(c=>clean(cname(c)));for(const wc of w.candidates||[]){const n=clean(wc.name);if(n&&rn.some(x=>x===n||x.includes(n)||n.includes(x)))s+=5;}return s;}

let response=null, errors=[];
for(const url of candidateUrls){try{response=await fetchText(url);break}catch(e){errors.push(`${url}: ${e.message}`)}}
if(!response)throw new Error(`Could not fetch an NBC results page. Set NBC_RESULTS_URL in config.json or as a repository variable when NBC publishes its 2026 results endpoint. ${errors.join(' | ')}`);
let roots=[];
if(response.type.includes('json')){try{roots=[JSON.parse(response.text)]}catch{}}
else roots=jsonCandidates(response.text);
const races=roots.flatMap(racesFromJson);
if(!races.length)throw new Error(`NBC page fetched (${response.url}), but no recognizable public structured race payload was found. Last good dashboard data was left untouched. When NBC's live 2026 results payload is published, set NBC_RESULTS_URL if necessary.`);
let matched=0;
for(const w of watch.races||[]){
  const prior=previousById.get(w.id);
  const result=structuredClone(w);
  result.reporting=prior?.reporting||0; result.called=prior?.called||false; result.nbcMatchStatus='not-found';
  result.candidates=(result.candidates||[]).map(c=>{const pc=(prior?.candidates||[]).find(x=>clean(x.name)===clean(c.name));return {...c,votes:pc?.votes||0,percent:pc?.percent||0,winner:pc?.winner||false};});
  let best=null,bestScore=0; for(const r of races){const sc=scoreRace(w,r);if(sc>bestScore){best=r;bestScore=sc}}
  if(best&&bestScore>=5){matched++;result.nbcMatchStatus='matched';result.reporting=reporting(best);const nc=cands(best);const total=nc.reduce((a,c)=>a+cvotes(c),0);result.called=nc.some(cwin);for(const c of result.candidates||[]){const n=clean(c.name);let x=nc.find(z=>{const zn=clean(cname(z));return zn===n||zn.includes(n)||n.includes(zn)});if(!x)x=nc.find(z=>cparty(z)===c.party);if(!x)continue;c.votes=cvotes(x);c.percent=cpct(x)||(total?c.votes/total*100:0);c.winner=cwin(x);}}
  output.races.push(result);
}
if((watch.races||[]).length && matched===0)throw new Error('NBC structured data was found, but none of the configured watchlist races matched. No file was overwritten. Check race names/state/district or the NBC adapter diagnostics.');
output.lastUpdated=new Date().toISOString();output.source={name:'NBC News public election results',url:response.url,matchedWatchlistRaces:matched,totalWatchlistRaces:(watch.races||[]).length,note:'Public browser-delivered NBC data; endpoint/schema may change.'};
function winnerOf(r){return (r?.candidates||[]).find(c=>c.winner)||null;}
function eventKey(type,raceId,party=''){return `${type}:${raceId}:${party}`;}
const existingKeys=new Set(timeline.events.map(e=>e.key).filter(Boolean));
const detectedAt=new Date().toISOString();
let addedEvents=0;
for(const current of output.races){
  const prior=previousById.get(current.id);
  const winner=winnerOf(current);
  if(!winner || !current.called) continue;
  if(prior && !prior.called){
    const key=eventKey('race_call',current.id,winner.party);
    if(!existingKeys.has(key)){timeline.events.push({key,type:'race_call',timestamp:detectedAt,raceId:current.id,race:current.label||current.title||current.id,winner:winner.name,party:winner.party,text:`NBC News calls ${current.label||current.title||current.id} for ${winner.name} (${winner.party}).`});existingKeys.add(key);addedEvents++;}
    if(current.previousParty && winner.party && winner.party!==current.previousParty){
      const flipKey=eventKey('party_flip',current.id,winner.party);
      if(!existingKeys.has(flipKey)){const partyName=winner.party==='D'?'Democrats':winner.party==='R'?'Republicans':'An independent/other candidate';timeline.events.push({key:flipKey,type:'party_flip',timestamp:detectedAt,raceId:current.id,race:current.label||current.title||current.id,winner:winner.name,party:winner.party,text:`${partyName} flip ${current.label||current.title||current.id}.`});existingKeys.add(flipKey);addedEvents++;}
    }
    const defeated=(current.candidates||[]).find(c=>c.incumbent && !c.winner);
    if(defeated){const defeatKey=eventKey('incumbent_defeat',current.id,winner.party);if(!existingKeys.has(defeatKey)){timeline.events.push({key:defeatKey,type:'incumbent_defeat',timestamp:detectedAt,raceId:current.id,race:current.label||current.title||current.id,winner:winner.name,party:winner.party,text:`Incumbent ${defeated.name} (${defeated.party}) is defeated in ${current.label||current.title||current.id}; NBC News calls the race for ${winner.name} (${winner.party}).`});existingKeys.add(defeatKey);addedEvents++;}}
  }
}
timeline.events.sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
timeline.events=timeline.events.slice(0,250);
timeline.lastUpdated=detectedAt;
output.lastUpdated=detectedAt;output.source={name:'NBC News public election results',url:response.url,matchedWatchlistRaces:matched,totalWatchlistRaces:(watch.races||[]).length,note:'Public browser-delivered NBC data; endpoint/schema may change.'};
await fs.writeFile(RESULTS_PATH,JSON.stringify(output,null,2)+'\n');
await fs.writeFile(TIMELINE_PATH,JSON.stringify(timeline,null,2)+'\n');
console.log(`NBC updater: matched ${matched}/${(watch.races||[]).length}; added ${addedEvents} timeline event(s); discovered ${races.length} structured race-like objects from ${response.url}`);
