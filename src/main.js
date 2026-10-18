import './style.css';
const desktop = matchMedia('(min-width: 1024px) and (any-pointer: fine)');
const experience = document.querySelector('#experience');
const fallback = document.querySelector('#desktop-fallback');
let viewer, initializing = false;
const status = message => { document.querySelector('#scene-status').textContent = message; };
async function enter() {
  experience.hidden = !desktop.matches; fallback.hidden = desktop.matches;
  if (viewer) { viewer.setActive(desktop.matches); return; }
  if (!desktop.matches || initializing) return;
  initializing = true;
  try {
    const { RoomExperience } = await import('./viewer.js');
    viewer = await RoomExperience.create(document.querySelector('#scene'), phase => {
      document.body.dataset.phase = phase;
      status({off:'The PlayStation 5 is off. Press its power button.',boot:'PlayStation starting. The television is turning on.',ready:'Hover over the Cyberpunk game case to remove its disc.',inserting:'The Cyberpunk disc is entering the PS5.',loading:'Cyberpunk is loading.',home:'Cyberpunk home. Choose App, Web, FOSS, or DevOps.'}[phase]);
    });
    document.querySelector('#loading').classList.add('ready');document.querySelector('#loading').setAttribute('aria-hidden','true');viewer.setActive(desktop.matches);
    document.querySelector('#power-control').addEventListener('click', () => viewer.powerOn());
    const gameCase=document.querySelector('#case-control'), disc=document.querySelector('#disc-control'); let leaveTimer;
    for(const control of [gameCase,disc]) {
      const enterDisc=()=>{clearTimeout(leaveTimer);viewer.hoverDisc(true);};
      control.addEventListener('pointerenter',enterDisc);control.addEventListener('focus',enterDisc);
      control.addEventListener('pointerleave',()=>{leaveTimer=setTimeout(()=>{if(!gameCase.matches(':hover')&&!disc.matches(':hover')&&document.activeElement!==disc)viewer.hoverDisc(false);},180);});
    }
    gameCase.addEventListener('click',()=>viewer.hoverDisc(true));
    disc.addEventListener('click',()=>viewer.insertDisc());
    document.querySelectorAll('[data-aoi]').forEach(button=>{
      const select=()=>{viewer.selectAOI(Number(button.dataset.aoi));document.querySelectorAll('[data-aoi]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));};
      button.addEventListener('pointerenter',select);button.addEventListener('focus',select);button.addEventListener('click',select);
    });
  } catch(error) {console.error('Scene initialization failed:',error);document.querySelector('#error').hidden=false;document.querySelector('#loading').hidden=true;}
}
document.querySelector('#reload').addEventListener('click',()=>location.reload());desktop.addEventListener('change',enter);enter();
