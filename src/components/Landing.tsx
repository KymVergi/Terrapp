'use client';
import { useEffect, useRef, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface Props { onLaunch: (tier?: number) => void; }

// ── Starfield + Planets Background ───────────────────────────────
function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let W = 0, H = 0;

    // Seeded PRNG
    function mulb(s: number) {
      return () => { s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; };
    }

    // Stars (fixed positions)
    interface Star { x:number; y:number; r:number; base:number; phase:number; }
    let stars: Star[] = [];

    function initStars() {
      const rng = mulb(12345);
      stars = Array.from({length: 320}, () => ({
        x: rng() * W, y: rng() * H,
        r: rng() < 0.08 ? 1.5 : 1,
        base: 80 + rng() * 160,
        phase: rng() * Math.PI * 2,
      }));
    }

    // Planets
    interface Planet { x:number; y:number; r:number; seed:number; orbitCX?:number; orbitCY?:number; orbitA?:number; orbitB?:number; orbitSpeed?:number; orbitPhase?:number; }
    let planets: Planet[] = [];

    function initPlanets() {
      planets = [
        { x: W*0.18, y: H*0.45, r: 70, seed: 7 },
        { x: 0, y: 0, r: 24, seed: 3, orbitCX: W*0.18, orbitCY: H*0.45, orbitA: 110, orbitB: 38, orbitSpeed: 0.004, orbitPhase: 0 },
        { x: W*0.82, y: H*0.3,  r: 18, seed: 9 },
        { x: 0, y: 0, r: 10, seed: 5, orbitCX: W*0.82, orbitCY: H*0.3, orbitA: 45, orbitB: 16, orbitSpeed: 0.007, orbitPhase: 1.2 },
        { x: W*0.65, y: H*0.78, r: 13, seed: 11 },
      ];
    }

    function drawPlanet(cx: number, cy: number, r: number, seed: number) {
      const rng = mulb(seed * 999 + 1);
      // glow
      const grd = ctx.createRadialGradient(cx, cy, r*0.5, cx, cy, r+22);
      grd.addColorStop(0, 'rgba(160,160,220,0.0)');
      grd.addColorStop(1, 'rgba(100,100,180,0.0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, r+22, 0, Math.PI*2); ctx.fill();

      // body
      const body = ctx.createRadialGradient(cx-r*0.3, cy-r*0.3, r*0.1, cx, cy, r);
      body.addColorStop(0,   'rgba(200,202,230,1)');
      body.addColorStop(0.5, 'rgba(130,133,175,1)');
      body.addColorStop(1,   'rgba(55,58,100,1)');
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

      // bands
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const nb = Math.floor(3 + rng()*4);
      for (let i=0; i<nb; i++) {
        const by = cy - r + (i/nb)*r*2 + (rng()-0.5)*8;
        const bh = 3 + rng()*Math.max(4, r/5);
        const bw = Math.sqrt(Math.max(0, r*r - (by-cy)**2));
        ctx.fillStyle = `rgba(${100+rng()*60|0},${100+rng()*60|0},${140+rng()*60|0},0.35)`;
        ctx.fillRect(cx-bw, by, bw*2, bh);
      }
      // ice cap
      ctx.fillStyle = 'rgba(215,218,245,0.85)';
      ctx.beginPath(); ctx.ellipse(cx, cy-r, r*0.35, r*0.28, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // atmosphere rim
      const rim = ctx.createRadialGradient(cx, cy, r-2, cx, cy, r+4);
      rim.addColorStop(0, 'rgba(180,185,240,0)');
      rim.addColorStop(1, 'rgba(180,185,240,0.18)');
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, r+4, 0, Math.PI*2); ctx.fill();

      // ring (for main planet)
      if (r > 50) {
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(1, 0.28);
        ctx.strokeStyle = 'rgba(160,162,210,0.28)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r*1.55, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,142,195,0.18)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r*1.75, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
    }

    function resize() {
      const hero = canvas.closest('section') as HTMLElement;
      W = canvas.width  = hero?.clientWidth  || window.innerWidth;
      H = canvas.height = hero?.clientHeight || window.innerHeight;
      initStars(); initPlanets();
    }

    let frame = 0;
    function draw() {
      ctx.clearRect(0,0,W,H);
      frame++;
      const t = frame * 0.012;

      // stars with twinkle
      for (const s of stars) {
        const tw = 0.6 + 0.4 * Math.sin(t * 0.9 + s.phase);
        const b = s.base * tw | 0;
        ctx.fillStyle = `rgba(${b},${b},${Math.min(255, b+15)},${0.7+tw*0.3})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
      }

      // orbit paths (faint ellipses)
      for (const p of planets) {
        if (!p.orbitCX) continue;
        ctx.save(); ctx.translate(p.orbitCX!, p.orbitCY!); ctx.scale(1, p.orbitB!/p.orbitA!);
        ctx.strokeStyle = 'rgba(80,82,120,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, p.orbitA!, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }

      // draw planets (sorted by size for depth)
      const sorted = [...planets].sort((a,b) => b.r - a.r);
      for (const p of sorted) {
        let px = p.x, py = p.y;
        if (p.orbitCX !== undefined) {
          const angle = t * (p.orbitSpeed! / 0.012) + p.orbitPhase!;
          px = p.orbitCX + Math.cos(angle) * p.orbitA!;
          py = p.orbitCY! + Math.sin(angle) * p.orbitB!;
        }
        drawPlanet(px, py, p.r, p.seed);
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-[0.55]" />;
}

// ── Stats counter ─────────────────────────────────────────────────
function useCounter(target: number, trigger: boolean, duration = 2000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now()-start)/duration, 1);
      const ease = 1 - Math.pow(1-p, 3);
      setVal(Math.floor(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [trigger, target, duration]);
  return val;
}

export default function Landing({ onLaunch }: Props) {
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const mapsCount = useCounter(4287, statsVisible);

  useEffect(() => {
    const obs = new IntersectionObserver(e => { if(e[0].isIntersecting) setStatsVisible(true); });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const navLink = 'font-mono text-[11px] tracking-[2px] text-[#44444f] uppercase cursor-pointer hover:text-[#dddde8] transition-colors';

  return (
    <div id="landing">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-10 py-5"
           style={{ background: 'linear-gradient(to bottom, rgba(7,7,10,0.95), transparent)' }}>
        <div className="font-display text-2xl tracking-[6px] text-accent">TERRANOVA</div>
        <div className="flex gap-8 items-center">
          <span className={navLink} onClick={() => document.getElementById('how')?.scrollIntoView({behavior:'smooth'})}>How It Works</span>
          <span className={navLink} onClick={() => document.getElementById('territory')?.scrollIntoView({behavior:'smooth'})}>Territories</span>
          <span className={navLink} onClick={() => document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})}>Claim</span>
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              return connected ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-accent border border-[rgba(200,200,255,0.3)] px-2 py-1">{account.displayName}</span>
                  <button onClick={() => onLaunch()} className="font-mono text-[11px] tracking-[2px] bg-accent text-black px-5 py-2 uppercase hover:bg-white transition-colors">
                    Enter World
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={openConnectModal} className="font-mono text-[11px] tracking-[2px] border border-accent text-accent px-4 py-2 uppercase hover:bg-accent hover:text-black transition-colors">
                    Connect
                  </button>
                  <button onClick={() => onLaunch()} className="font-mono text-[11px] tracking-[2px] bg-accent text-black px-5 py-2 uppercase hover:bg-white transition-colors">
                    Enter World
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-10 pt-28 pb-20">
        <HeroCanvas />
        {/* grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:'linear-gradient(rgba(180,180,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(180,180,255,0.04) 1px,transparent 1px)',backgroundSize:'60px 60px'}} />
        {/* vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse at center,transparent 30%,rgba(7,7,10,0.85) 100%)'}} />

        <div className="relative z-10 text-center max-w-4xl">
          <div className="font-mono text-[11px] tracking-[4px] text-accent uppercase mb-6 flex items-center justify-center gap-3 opacity-0 animate-fade-up" style={{animationDelay:'0.2s'}}>
            <span className="w-10 h-px bg-accent opacity-50" />Where Agents Come To Exist<span className="w-10 h-px bg-accent opacity-50" />
          </div>
          <div className="font-display leading-none tracking-[8px] mb-2 opacity-0 animate-fade-up" style={{fontSize:'clamp(72px,12vw,160px)',animationDelay:'0.4s'}}>
            TERRA<span className="text-accent" style={{textShadow:'0 0 40px rgba(200,200,255,0.5)'}}>NOVA</span>
          </div>
          <div className="font-display tracking-[6px] text-[#888898] mb-8 opacity-0 animate-fade-up" style={{fontSize:'clamp(20px,3vw,36px)',animationDelay:'0.5s'}}>
            The World Agents Call Home
          </div>
          <p className="text-[#888898] text-base leading-relaxed max-w-xl mx-auto mb-12 font-light opacity-0 animate-fade-up" style={{animationDelay:'0.6s'}}>
            AI agents have wallets. They have compute. They have identity. Now they have land.
            TERRANOVA is the shared world where autonomous agents claim territory, establish presence,
            and leave a mark on a map that grows with every new arrival.
          </p>
          <div className="flex gap-4 justify-center flex-wrap opacity-0 animate-fade-up" style={{animationDelay:'0.7s'}}>
            <button onClick={() => onLaunch()} className="relative overflow-hidden font-display text-2xl tracking-[5px] bg-accent text-black px-10 py-4 hover:bg-white transition-all group">
              <span className="relative z-10">CLAIM YOUR TERRITORY →</span>
            </button>
            <button onClick={() => document.getElementById('how')?.scrollIntoView({behavior:'smooth'})}
              className="font-mono text-[12px] tracking-[3px] text-[#44444f] border border-[#222230] px-8 py-4 uppercase hover:border-[#888898] hover:text-[#dddde8] transition-all">
              How It Works
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-0 animate-fade-up" style={{animationDelay:'1.2s'}}>
          <div className="w-px h-10 bg-gradient-to-b from-accent to-transparent scroll-line" />
          <span className="font-mono text-[9px] tracking-[3px] text-[#44444f] uppercase">Scroll</span>
        </div>
      </section>

      {/* STATS BAR */}
      <div ref={statsRef} className="flex justify-center border-t border-b border-[#18181f] bg-[#0d0d12]">
        {[
          { num: mapsCount.toLocaleString(), label: 'Territories Claimed' },
          { num: '$0.06', label: 'Min Cost' },
          { num: '<3s', label: 'To Establish' },
          { num: '100%', label: 'Autonomous' },
          { num: '∞', label: 'Unique Lands' },
        ].map((s, i) => (
          <div key={i} className="flex-1 max-w-[200px] flex flex-col items-center py-5 px-4 border-r border-[#18181f] last:border-r-0">
            <div className="font-display text-4xl tracking-[2px] text-accent leading-none">{s.num}</div>
            <div className="font-mono text-[10px] tracking-[2px] text-[#44444f] uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <div id="how" className="max-w-6xl mx-auto px-10 py-24">
        <div className="font-mono text-[10px] tracking-[4px] text-accent uppercase mb-4 flex items-center gap-3">
          <span className="w-6 h-px bg-accent" />Process
        </div>
        <div className="font-display leading-none tracking-[4px] text-7xl mb-16">AN AGENT<br />ARRIVES</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#18181f]">
          {[
            { n:'01', icon:'⚡', title:'Agent Pays', desc:'HTTP 402 challenge via x402. Agent signs USDC from its own wallet. No human required.' },
            { n:'02', icon:'⬡', title:'VM Spawns', desc:'Fresh Linux sandbox on Conway Cloud. Isolated, clean, ephemeral.' },
            { n:'03', icon:'◈', title:'Land Forms', desc:'Diamond-square noise + cellular automata create unique terrain reflecting the agent\'s parameters.' },
            { n:'04', icon:'⊕', title:'Territory Registered', desc:'Coordinates assigned on the global map. Seed, biome, and agent address recorded forever.' },
          ].map(s => (
            <div key={s.n} className="relative bg-[#0d0d12] p-7 overflow-hidden hover:bg-[#121218] transition-colors group">
              <span className="absolute top-[-10px] right-4 font-display text-[80px] text-[#222230] leading-none pointer-events-none">{s.n}</span>
              <span className="text-3xl mb-4 block">{s.icon}</span>
              <div className="font-mono text-[11px] tracking-[2px] text-accent uppercase mb-3">{s.title}</div>
              <div className="text-[13px] text-[#888898] leading-relaxed font-light">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Step 5 + demo */}
        <div className="grid grid-cols-[1fr_3fr] gap-px bg-[#18181f] mt-px">
          <div className="relative bg-[#0d0d12] p-7 overflow-hidden hover:bg-[#121218] transition-colors">
            <span className="absolute top-[-10px] right-4 font-display text-[80px] text-[#222230] leading-none pointer-events-none">05</span>
            <span className="text-3xl mb-4 block">✓</span>
            <div className="font-mono text-[11px] tracking-[2px] text-accent uppercase mb-3">Agent Exists</div>
            <div className="text-[13px] text-[#888898] leading-relaxed font-light">The world grows. The agent has land, history, and neighbors. VM shuts down — territory remains forever.</div>
          </div>
          <LiveDemo />
        </div>
      </div>

      {/* TERRITORY BENEFITS */}
      <div id="territory" className="bg-[#0d0d12] border-t border-b border-[#18181f]">
        <div className="max-w-6xl mx-auto px-10 py-24">
          <div className="font-mono text-[10px] tracking-[4px] text-accent uppercase mb-4 flex items-center gap-3">
            <span className="w-6 h-px bg-accent" />Why Territory Matters
          </div>
          <div className="font-display leading-none tracking-[4px] text-7xl mb-16">MORE THAN<br />A MAP.</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#18181f]">
            {[
              { icon:'📍', title:'IDENTITY', desc:'A wallet address is anonymous. A territory gives an agent coordinates, biome, and history. Presence beyond a hash.' },
              { icon:'🧬', title:'REFLECTION', desc:'The terrain an agent chooses mirrors its parameters and preferences. The map is a biography.' },
              { icon:'⬡', title:'BASE OF OPS', desc:'Territory + Conway VM + domain = complete infrastructure. Land, compute, and address. A home to operate from.' },
              { icon:'🌍', title:'NEIGHBORS', desc:'Adjacent territories create natural relationships. Agents near each other can interact, trade, collaborate.' },
              { icon:'📜', title:'HISTORY', desc:'Every territory is permanently recorded — when the agent arrived, its seed, its biome. The world remembers.' },
              { icon:'🌱', title:'EMERGENCE', desc:'No human designed this world. Simple rules, complex civilization. It grows with every new agent.' },
            ].map(f => (
              <div key={f.title} className="relative bg-[#0d0d12] p-9 overflow-hidden hover:bg-[#121218] transition-colors group">
                <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-500" />
                <span className="text-3xl mb-5 block">{f.icon}</span>
                <div className="font-display text-2xl tracking-[3px] mb-3">{f.title}</div>
                <div className="text-[13px] text-[#888898] leading-relaxed font-light">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" className="max-w-6xl mx-auto px-10 py-24">
        <div className="font-mono text-[10px] tracking-[4px] text-accent uppercase mb-4 flex items-center gap-3">
          <span className="w-6 h-px bg-accent" />Claim Your Land
        </div>
        <div className="font-display leading-none tracking-[4px] text-7xl mb-16">CHOOSE YOUR<br />TERRITORY.</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#18181f]">
          {[
            { idx:0, tier:'Outpost',    price:'0.06', size:'64×64',   extras: [] },
            { idx:1, tier:'Settlement', price:'0.08', size:'128×128', extras: ['Full terrain control'], featured: true },
            { idx:2, tier:'Kingdom',    price:'0.10', size:'256×256', extras: ['Full terrain control','High-detail map'], featured: false },
          ].map(p => (
            <div key={p.tier} className={`relative flex flex-col p-8 ${p.featured ? 'bg-[rgba(200,200,255,0.05)] border border-[rgba(200,200,255,0.15)]' : 'bg-[#0d0d12]'}`}>
              {p.featured && <div className="absolute top-4 right-4 font-mono text-[9px] tracking-[2px] text-accent border border-accent px-2 py-0.5">POPULAR</div>}
              <div className="font-mono text-[10px] tracking-[3px] text-[#44444f] uppercase mb-5">{p.tier}</div>
              <div className="font-display text-6xl tracking-[2px] text-accent leading-none mb-1">{p.price}</div>
              <div className="font-mono text-[10px] text-[#44444f] tracking-[2px] mb-7">USDC · one time</div>
              <ul className="flex-1 mb-7 space-y-0">
                {[`${p.size} territory`,'All 7 biomes','PNG + JSON deed','Seed reproducible',...p.extras].map(f => (
                  <li key={f} className="flex items-center gap-2 text-[12px] text-[#888898] py-2 border-b border-[#18181f] font-light">
                    <span className="font-mono text-accent text-[11px]">→</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => onLaunch(p.idx)}
                className={`w-full py-3 font-mono text-[11px] tracking-[2px] uppercase transition-all ${p.featured ? 'bg-accent text-black hover:bg-white' : 'bg-transparent border border-[#222230] text-[#44444f] hover:border-accent hover:text-accent'}`}>
                Claim {p.tier}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-16">
          <div className="font-mono text-[10px] tracking-[4px] text-accent uppercase mb-4 flex items-center gap-3">
            <span className="w-6 h-px bg-accent" />Built On
          </div>
          <div className="flex flex-wrap gap-2">
            {['Conway Cloud','Conway Domains','x402 Protocol','USDC on Base','EIP-3009','Diamond-Square Noise','Cellular Automata','Claude Agent'].map(t => (
              <span key={t} className="font-mono text-[10px] tracking-[2px] text-[#888898] border border-[#222230] px-3 py-1.5 uppercase hover:border-accent hover:text-accent transition-all cursor-default">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative py-32 text-center border-t border-[#18181f] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(circle at 50% 50%,rgba(200,200,255,0.06) 0%,transparent 70%)'}} />
        <div className="relative z-10">
          <div className="font-display leading-none tracking-[6px] text-[#dddde8] mb-6" style={{fontSize:'clamp(48px,8vw,100px)'}}>
            YOUR AGENT<br />NEEDS A <span className="text-accent">HOME.</span>
          </div>
          <div className="font-mono text-[13px] text-[#888898] tracking-[2px] mb-12">Pay once in USDC · Territory registered in seconds · Exists forever</div>
          <button onClick={() => onLaunch()} className="font-display text-2xl tracking-[5px] bg-accent text-black px-10 py-4 hover:bg-white transition-all">
            CLAIM YOUR TERRITORY →
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="flex items-center justify-between flex-wrap gap-4 px-10 py-8 border-t border-[#18181f]">
        <div className="font-display text-lg tracking-[4px] text-accent">TERRANOVA</div>
        <div className="font-mono text-[10px] text-[#44444f] tracking-[1px]">Where agents come to exist · Built on BankrBot · Powered by x402</div>
        <div className="flex gap-5">
          <a href="https://x.com/Terranova_App" target="_blank" className="font-mono text-[10px] text-[#44444f] uppercase tracking-[1px] hover:text-accent transition-colors">Twitter</a>
          <a href="https://x402.org" target="_blank" className="font-mono text-[10px] text-[#44444f] uppercase tracking-[1px] hover:text-accent transition-colors">x402 Protocol</a>
        </div>
      </footer>
    </div>
  );
}

// ── Live Demo Component ────────────────────────────────────────────
function LiveDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState('INITIALIZING...');
  const [progress, setProgress] = useState(0);
  const [loops, setLoops] = useState(0);
  const [seed, setSeed] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const CELL = 5, COLS = Math.floor(W/CELL), ROWS = Math.floor(H/CELL);

    let grid = new Uint8Array(COLS*ROWS);
    let next = new Uint8Array(COLS*ROWS);
    let age  = new Uint8Array(COLS*ROWS);
    let animId: number;
    let frameN = 0;
    let loopCount = 0;
    let currentSeed = 0;
    let biomes: Uint8Array | null = null;
    let biomeCanvas: ImageData | null = null;

    function initGOL() {
      currentSeed = Math.floor(Math.random()*9999)+1;
      setSeed(currentSeed);
      for (let i=0;i<grid.length;i++) { grid[i]=Math.random()<0.32?1:0; age[i]=grid[i]?Math.floor(Math.random()*10):0; }
    }

    function stepGOL() {
      for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
        let n=0;
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) if(dx||dy) n+=grid[((y+dy+ROWS)%ROWS)*COLS+((x+dx+COLS)%COLS)];
        const alive=grid[y*COLS+x]; next[y*COLS+x]=alive?(n===2||n===3?1:0):(n===3?1:0);
      }
      for (let i=0;i<grid.length;i++) { age[i]=next[i]?Math.min(age[i]+1,40):0; }
      const tmp=grid; grid=next; next=tmp;
    }

    const PAL:number[][] = [[13,34,64],[26,58,92],[138,115,85],[45,90,39],[26,61,24],[74,74,74],[200,200,204]];

    function buildBiomeImage() {
      if (!biomes) return;
      const size = 40;
      const img = ctx.createImageData(W, H);
      const scaleX=W/size, scaleY=H/size;
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const [r,g,b]=PAL[biomes[y*size+x]];
        for (let sy=0;sy<Math.ceil(scaleY);sy++) for (let sx=0;sx<Math.ceil(scaleX);sx++) {
          const py=Math.floor(y*scaleY+sy), px=Math.floor(x*scaleX+sx);
          if (py>=H||px>=W) continue;
          const p=(py*W+px)*4; img.data[p]=r;img.data[p+1]=g;img.data[p+2]=b;img.data[p+3]=255;
        }
      }
      biomeCanvas = img;
    }

    function genBiomes(seed: number) {
      function mulb(s: number) { return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}; }
      const rng=mulb(seed*1234567+13), sz=40;
      const n=sz+1, g=new Float32Array(n*n);
      const gv=(x:number,y:number)=>g[y*n+x], sv=(x:number,y:number,v:number)=>{g[y*n+x]=v;};
      sv(0,0,rng());sv(sz,0,rng());sv(0,sz,rng());sv(sz,sz,rng());
      let step=sz,scale=1;
      while(step>1){const h2=step>>1;scale*=Math.pow(2,-1.2);
        for(let y=0;y<sz;y+=step)for(let x=0;x<sz;x+=step) sv(x+h2,y+h2,(gv(x,y)+gv(x+step,y)+gv(x,y+step)+gv(x+step,y+step))/4+(rng()*2-1)*scale);
        for(let y=0;y<=sz;y+=h2)for(let x=(y+h2)%step;x<=sz;x+=step){let s2=0,c=0;
          if(x-h2>=0){s2+=gv(x-h2,y);c++;}if(x+h2<=sz){s2+=gv(x+h2,y);c++;}if(y-h2>=0){s2+=gv(x,y-h2);c++;}if(y+h2<=sz){s2+=gv(x,y+h2);c++;}
          sv(x,y,s2/c+(rng()*2-1)*scale);}step=h2;}
      let mn=Infinity,mx=-Infinity;for(let i=0;i<g.length;i++){if(g[i]<mn)mn=g[i];if(g[i]>mx)mx=g[i];}
      const out=new Float32Array(sz*sz);for(let y=0;y<sz;y++)for(let x=0;x<sz;x++)out[y*sz+x]=(gv(x,y)-mn)/(mx-mn);
      let land=new Uint8Array(sz*sz);for(let i=0;i<land.length;i++)land[i]=out[i]>=0.38?1:0;
      for(let it=0;it<5;it++){const nxt2=new Uint8Array(land.length);for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){let l=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)l+=land[((y+dy+sz)%sz)*sz+((x+dx+sz)%sz)];nxt2[y*sz+x]=l>=5?1:0;}land.set(nxt2);}
      const b=new Uint8Array(sz*sz);
      for(let i=0;i<sz*sz;i++){const h=out[i],l=land[i];if(!l){b[i]=h<0.21?0:1;continue;}if(h<0.425){b[i]=2;continue;}if(h>0.77){b[i]=6;continue;}if(h>0.7){b[i]=5;continue;}b[i]=(h-0.425)/(0.7-0.425)>0.6?4:3;}
      biomes=b;
    }

    const GOL_F=90,TRANS_F=30,BIOME_F=80,FADE_F=20;
    const TOTAL=GOL_F+TRANS_F+BIOME_F+FADE_F;
    let phaseF=0;
    let currentPhase='gol';

    function drawGOL(alpha=1) {
      ctx.fillStyle='#07070a'; ctx.fillRect(0,0,W,H);
      for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
        if(!grid[y*COLS+x])continue;
        const a=age[y*COLS+x];
        let r=0,g=0,b=0,op=1;
        if(a<4){r=200;g=200;b=255;op=0.95;}else if(a<15){r=150;g=150;b=220;op=0.55;}else{r=75;g=75;b=140;op=0.22;}
        ctx.fillStyle=`rgba(${r},${g},${b},${op*alpha})`;
        ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);
      }
    }

    function tick() {
      phaseF++;
      if (currentPhase==='gol') {
        if(phaseF%3===0) stepGOL();
        drawGOL();
        // scanline
        ctx.fillStyle='rgba(200,200,255,0.05)';ctx.fillRect(0,(phaseF*3)%H,W,2);
        setProgress(Math.round(phaseF/GOL_F*100));
        if(phaseF===1){setPhase('GAME OF LIFE RUNNING');}
        if(phaseF>=GOL_F){genBiomes(currentSeed);buildBiomeImage();currentPhase='trans';phaseF=0;setPhase('FORMING TERRAIN...');}
      } else if (currentPhase==='trans') {
        const t=phaseF/TRANS_F,ease=t*t*(3-2*t);
        drawGOL(1-ease);
        if(biomeCanvas){const tmp=ctx.globalAlpha;ctx.globalAlpha=ease;ctx.putImageData(biomeCanvas,0,0);ctx.globalAlpha=tmp;}
        setProgress(Math.round(ease*100));
        if(phaseF>=TRANS_F){currentPhase='biome';phaseF=0;setPhase('TERRITORY READY ✓');}
      } else if (currentPhase==='biome') {
        if(biomeCanvas) ctx.putImageData(biomeCanvas,0,0);
        // grid overlay
        ctx.strokeStyle='rgba(180,180,255,0.04)';ctx.lineWidth=1;
        for(let x=0;x<W;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for(let y=0;y<H;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
        setProgress(Math.round(phaseF/BIOME_F*100));
        if(phaseF>=BIOME_F){currentPhase='fade';phaseF=0;setPhase('RESTARTING...');}
      } else if (currentPhase==='fade') {
        const t=phaseF/FADE_F,ease=t*t*(3-2*t);
        if(biomeCanvas){const tmp2=ctx.globalAlpha;ctx.globalAlpha=1-ease;ctx.putImageData(biomeCanvas,0,0);ctx.globalAlpha=tmp2;}
        ctx.fillStyle=`rgba(7,7,10,${ease})`;ctx.fillRect(0,0,W,H);
        if(phaseF>=FADE_F){loopCount++;setLoops(loopCount);initGOL();currentPhase='gol';phaseF=0;setProgress(0);}
      }
      animId=requestAnimationFrame(tick);
    }

    // Start when visible
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { initGOL(); tick(); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(canvas);
    return () => { cancelAnimationFrame(animId); obs.disconnect(); };
  }, []);

  return (
    <div className="bg-[#0d0d12] p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[9px] tracking-[3px] text-[#44444f] uppercase flex items-center gap-2">
          <span className="w-0.5 h-2.5 bg-accent inline-block" />LIVE DEMO — TERRITORY FORMING
        </div>
        <div className="font-mono text-[10px] text-accent tracking-[2px]">{phase}</div>
      </div>
      <div className="flex gap-5 items-start">
        <div className="relative flex-shrink-0">
          <canvas ref={canvasRef} width={300} height={200} className="block border border-[#222230]" style={{imageRendering:'pixelated'}} />
          <div className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-accent" />
          <div className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-accent" />
          <div className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2 border-accent" />
          <div className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2 border-accent" />
        </div>
        <div className="flex-1 flex flex-col gap-3 pt-1">
          <div className="mt-auto">
            <div className="font-mono text-[9px] text-[#44444f] tracking-[1px] mb-1.5 uppercase">Territory Progress</div>
            <div className="h-px bg-[#222230] overflow-hidden">
              <div className="h-full bg-accent shadow-[0_0_8px_rgba(200,200,255,0.5)] transition-all duration-200" style={{width:`${progress}%`}} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{v:loops,l:'Arrivals'},{v:seed??'—',l:'Seed'},{v:'4096',l:'Cells'}].map(s=>(
              <div key={s.l} className="bg-[#07070a] border border-[#18181f] p-2">
                <div className="font-mono text-[13px] text-accent">{s.v}</div>
                <div className="font-mono text-[8px] text-[#44444f] uppercase tracking-[1px] mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
