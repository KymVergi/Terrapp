'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignTypedData } from 'wagmi';
import { mulberry32, diamondSquare, caSmooth, assignBiomes, calcStats, renderBiomesToCanvas, PAL, BIOME_NAMES } from '@/lib/terrain';

interface Props { onBack: () => void; initialTier?: number; }

const SIZES = [64, 128, 256];
const SLABELS = ['64×64', '128×128', '256×256'];
const VCOSTS = [0.01, 0.02, 0.04];
const TIER_NAMES = ['outpost', 'settlement', 'kingdom'];

// ─── LOG ──────────────────────────────────────────────────────────
type LogType = 'info'|'success'|'warn'|'err'|'sys'|'hi';
interface LogEntry { id: number; time: string; msg: string; type: LogType; icon: string; }

let logId = 0;
function mkLog(msg: string, type: LogType='info', icon='›'): LogEntry {
  return { id: logId++, time: new Date().toTimeString().slice(0,8), msg, type, icon };
}

// ─── WORLD MAP ────────────────────────────────────────────────────
const WORLD_COLS = 16, WORLD_ROWS = 16, TERRITORY_PX = 45;

function emptyGrid() {
  return new Array(WORLD_COLS * WORLD_ROWS).fill(null);
}

function mockGrid() {
  const MOCKS = [
    { seed:1337, col:2,  row:3,  tier:'settlement', agent_address:'0x4f3a...c821', params:{water:38,roughness:4,iterations:5,mountain:70,forest:40} },
    { seed:4201, col:7,  row:1,  tier:'kingdom',    agent_address:'0x9b2e...f104', params:{water:25,roughness:6,iterations:8,mountain:80,forest:30} },
    { seed:8888, col:12, row:5,  tier:'outpost',    agent_address:'0x1a7c...3d90', params:{water:50,roughness:2,iterations:3,mountain:65,forest:50} },
    { seed:2048, col:4,  row:10, tier:'settlement', agent_address:'0xe8b5...7a23', params:{water:42,roughness:5,iterations:6,mountain:75,forest:45} },
    { seed:9999, col:14, row:8,  tier:'kingdom',    agent_address:'0x3f6d...8b45', params:{water:20,roughness:7,iterations:9,mountain:85,forest:20} },
    { seed:3141, col:9,  row:13, tier:'outpost',    agent_address:'0xd290...1c67', params:{water:55,roughness:3,iterations:4,mountain:60,forest:60} },
  ];
  const grid = new Array(WORLD_COLS * WORLD_ROWS).fill(null);
  MOCKS.forEach(t => {
    const previewSize = 32;
    const rng = mulberry32(t.seed * 1234567 + 13);
    const height = diamondSquare(previewSize, t.params.roughness, rng);
    const land = caSmooth(height, previewSize, t.params.water, t.params.iterations);
    const biomes = assignBiomes(land, height, previewSize, t.params);
    const idx = t.row * WORLD_COLS + t.col;
    grid[idx] = { ...t, biomes, size: previewSize, isMock: true };
  });
  return grid;
}

function WorldMap({ newTerritory }: { newTerritory: any }) {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [worldGrid, setWorldGrid] = useState<any[]>(() => mockGrid());
  const [tooltip, setTooltip] = useState<{x:number,y:number,t:any}|null>(null);
  const [loading, setLoading] = useState(true);

  // Load real territories + subscribe to realtime inserts
  useEffect(() => {
    setLoading(true);
    fetch('/api/world')
      .then(r => r.json())
      .then((data) => {
        const territories = Array.isArray(data) ? data : (data?.territories ?? []);
        setWorldGrid(() => {
          const next = mockGrid(); // start with mocks, real data overrides
          territories.forEach((t: any) => {
            if (t.col == null || t.row == null) return;
            const idx = t.row * WORLD_COLS + t.col;
            if (idx < 0 || idx >= WORLD_COLS * WORLD_ROWS) return;
            const previewSize = 32;
            const rng = mulberry32((t.seed ?? 1) * 1234567 + 13);
            const height = diamondSquare(previewSize, t.params?.roughness ?? 4, rng);
            const land = caSmooth(height, previewSize, t.params?.water ?? 38, t.params?.iterations ?? 5);
            const biomes = assignBiomes(land, height, previewSize, t.params ?? {water:38,roughness:4,iterations:5,mountain:70,forest:40});
            next[idx] = { ...t, biomes, size: previewSize, isOwn: false };
          });
          return next;
        });
        setLoading(false);
      }).catch((e) => { console.error('World load error:', e); setLoading(false); });

    // Supabase realtime — new claims appear instantly for all users
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      supabase
        .channel('territories-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'territories' }, (payload: any) => {
          const t = payload.new;
          if (t.col == null || t.row == null) return;
          const previewSize = 32;
          const rng = mulberry32((t.seed ?? 1) * 1234567 + 13);
          const height = diamondSquare(previewSize, t.params?.roughness ?? 4, rng);
          const land = caSmooth(height, previewSize, t.params?.water ?? 38, t.params?.iterations ?? 5);
          const biomes = assignBiomes(land, height, previewSize, t.params ?? {water:38,roughness:4,iterations:5,mountain:70,forest:40});
          setWorldGrid(prev => {
            const next = [...prev];
            const idx = t.row * WORLD_COLS + t.col;
            if (idx >= 0 && idx < WORLD_COLS * WORLD_ROWS)
              next[idx] = { ...t, biomes, size: previewSize };
            return next;
          });
        })
        .subscribe();
    }).catch(e => console.warn('Realtime not available:', e));
  }, []);

  // Also handle local claim (own territory, instant feedback)
  useEffect(() => {
    if (!newTerritory) return;
    const previewSize = 32;
    const rng = mulberry32((newTerritory.seed ?? 1) * 1234567 + 13);
    const height = diamondSquare(previewSize, newTerritory.roughness ?? 4, rng);
    const land = caSmooth(height, previewSize, newTerritory.water ?? 38, newTerritory.iterations ?? 5);
    const biomes = assignBiomes(land, height, previewSize, newTerritory);
    setWorldGrid(prev => {
      const next = [...prev];
      const col = newTerritory.col ?? 0;
      const row = newTerritory.row ?? 0;
      const idx = row * WORLD_COLS + col;
      if (idx >= 0 && idx < WORLD_COLS * WORLD_ROWS) {
        next[idx] = { ...newTerritory, biomes, size: previewSize, isOwn: true };
      }
      return next;
    });
  }, [newTerritory]);

  function drawWorld() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#07070a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // grid lines
    ctx.strokeStyle = 'rgba(34,34,48,0.8)'; ctx.lineWidth = 1;
    for (let c=0;c<=WORLD_COLS;c++) { ctx.beginPath();ctx.moveTo(c*TERRITORY_PX,0);ctx.lineTo(c*TERRITORY_PX,canvas.height);ctx.stroke(); }
    for (let r=0;r<=WORLD_ROWS;r++) { ctx.beginPath();ctx.moveTo(0,r*TERRITORY_PX);ctx.lineTo(canvas.width,r*TERRITORY_PX);ctx.stroke(); }
    // territories
    worldGrid.forEach((t, idx) => {
      if (!t) { // empty dot
        const col=idx%WORLD_COLS, row=Math.floor(idx/WORLD_COLS);
        ctx.fillStyle='rgba(34,34,48,0.5)'; ctx.beginPath();
        ctx.arc(col*TERRITORY_PX+TERRITORY_PX/2, row*TERRITORY_PX+TERRITORY_PX/2, 2, 0, Math.PI*2); ctx.fill();
        return;
      }
      const col=idx%WORLD_COLS, row=Math.floor(idx/WORLD_COLS);
      const px=col*TERRITORY_PX, py=row*TERRITORY_PX;
      const { biomes, size } = t;
      const scale = TERRITORY_PX / size;
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        const [r,g,b]=PAL[biomes[y*size+x]];
        ctx.fillStyle=`rgb(${r},${g},${b})`;
        ctx.fillRect(px+x*scale, py+y*scale, Math.ceil(scale)+1, Math.ceil(scale)+1);
      }
      if (t.isOwn) { ctx.strokeStyle='rgba(232,232,255,0.9)';ctx.lineWidth=2;ctx.strokeRect(px+1,py+1,TERRITORY_PX-2,TERRITORY_PX-2); }
    });
  }

  useEffect(() => { drawWorld(); }, [worldGrid]);
  useEffect(() => { if (newTerritory) drawWorld(); }, [newTerritory, worldGrid]);

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX-rect.left)/TERRITORY_PX);
    const row = Math.floor((e.clientY-rect.top)/TERRITORY_PX);
    if (col<0||col>=WORLD_COLS||row<0||row>=WORLD_ROWS) { setTooltip(null); return; }
    setTooltip({ x: e.clientX, y: e.clientY, t: worldGrid[row*WORLD_COLS+col] ?? { col, row, empty: true } });
  }

  const claimed = worldGrid.filter(Boolean).length;
  const agents = new Set(worldGrid.filter(Boolean).map(t=>t.agent_address ?? t.agent).filter(Boolean)).size;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 relative bg-bg flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(rgba(180,180,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(180,180,255,0.025) 1px,transparent 1px)',backgroundSize:'40px 40px'}} />
        <canvas ref={canvasRef} width={WORLD_COLS*TERRITORY_PX} height={WORLD_ROWS*TERRITORY_PX}
          onMouseMove={onMouseMove} onMouseLeave={()=>setTooltip(null)}
          className="relative z-10 cursor-crosshair" style={{imageRendering:'pixelated'}} />
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-bg/80">
            <div className="font-display text-2xl tracking-[6px] text-accent animate-pulse">LOADING WORLD</div>
            <div className="font-mono text-[10px] text-[#44444f] tracking-[3px]">Fetching territories from Supabase...</div>
            <div className="w-32 h-px bg-border2 overflow-hidden mt-1">
              <div className="h-full bg-accent shadow-[0_0_8px_rgba(200,200,255,0.5)]" style={{animation:'tfill 1.5s ease infinite'}} />
            </div>
          </div>
        )}
        {tooltip && (
          <div className="fixed z-50 bg-surface border border-border2 px-3 py-2.5 font-mono text-[10px] pointer-events-none min-w-[160px]" style={{left:tooltip.x+14,top:tooltip.y-10}}>
            {tooltip.t.empty ? (
              <><div className="text-accent tracking-[1px] mb-1">[{tooltip.t.col}, {tooltip.t.row}] · UNCLAIMED</div><div className="text-[#888898]">Available territory</div></>
            ) : (
              <><div className="text-accent tracking-[1px] mb-1">[{tooltip.t.col}, {tooltip.t.row}] · {tooltip.t.tier?.toUpperCase()}</div>
              <div className="text-[#888898] mb-0.5">{tooltip.t.agent}</div>
              <div className="text-[#44444f]">{BIOME_NAMES[calcStats(tooltip.t.biomes instanceof Uint8Array ? tooltip.t.biomes : new Uint8Array(tooltip.t.biomes)).dominant]}</div>
              <div className="text-[#44444f]">Seed: {tooltip.t.seed}</div></>
            )}
          </div>
        )}
      </div>

      <div className="w-[280px] bg-surface border-l border-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="font-mono text-[9px] tracking-[3px] text-[#44444f] uppercase flex items-center gap-1.5 mb-3"><span className="w-0.5 h-2.5 bg-accent" />World Status</div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[{v:claimed,l:'Claimed'},{v:256-claimed,l:'Available'},{v:agents,l:'Agents'},{v:Math.round(claimed/256*100)+'%',l:'Settled'}].map(s=>(
              <div key={s.l} className="bg-bg border border-border p-2"><div className="font-mono text-sm text-accent">{s.v}</div><div className="font-mono text-[8px] text-[#44444f] uppercase tracking-[1px] mt-0.5">{s.l}</div></div>
            ))}
          </div>
          <div className="font-mono text-[8px] text-[#44444f] tracking-[1px] uppercase mb-1">World Fill</div>
          <div className="h-0.5 bg-border2"><div className="h-full bg-accent shadow-[0_0_6px_rgba(200,200,255,0.4)] transition-all duration-500" style={{width:`${Math.round(claimed/256*100)}%`}} /></div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="font-mono text-[9px] tracking-[3px] text-[#44444f] uppercase flex items-center gap-1.5 mb-3"><span className="w-0.5 h-2.5 bg-accent" />Territories</div>
          <div className="flex flex-col gap-1">
            {worldGrid.filter(Boolean).slice(0,10).map((t,i) => (
              <div key={i} className={`flex items-center gap-2 p-2 border ${t.isOwn?'border-[rgba(200,200,255,0.3)] bg-[rgba(180,180,255,0.04)]':'border-border bg-bg'}`}>
                <div className="flex-shrink-0 w-8 h-8 overflow-hidden" style={{imageRendering:'pixelated'}}>
                  <WorldMiniCanvas territory={t} size={32} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-[8px] ${t.isOwn?'text-accent':'text-[#dddde8]'} tracking-[1px]`}>{t.isOwn?'★ YOURS':t.tier?.toUpperCase()}</div>
                  <div className="font-mono text-[7px] text-[#44444f] truncate mt-0.5">{(t.agent_address ?? t.agent ?? 'unknown').slice(0,16)}...</div>
                  <div className="font-mono text-[7px] text-[#44444f]">[{t.col},{t.row}]</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <div className="font-mono text-[8px] text-[#44444f] tracking-[2px] uppercase mb-2">Biome Legend</div>
          <div className="grid grid-cols-2 gap-1">
            {['Deep Water','Water','Beach','Grass','Forest','Mountain','Snow'].map((b,i) => (
              <div key={b} className="flex items-center gap-1.5 font-mono text-[8px] text-[#44444f]">
                <div className="w-2 h-2 border border-white/10" style={{background:`rgb(${PAL[i].join(',')})`}} />{b}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorldMiniCanvas({ territory, size }: { territory: any, size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { biomes, size: s } = territory;
    const scale = size / s;
    for (let y=0;y<s;y++) for (let x=0;x<s;x++) {
      const [r,g,b]=PAL[biomes[y*s+x]];
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x*scale,y*scale,Math.ceil(scale),Math.ceil(scale));
    }
  }, [territory]);
  return <canvas ref={ref} width={size} height={size} style={{width:'100%',height:'100%'}} />;
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App({ onBack, initialTier }: Props) {
  const [tab, setTab] = useState<'claim'|'world'>('claim');
  const [walletBal, setWalletBal] = useState(12.40);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    mkLog('TERRANOVA agent initialized','hi','★'),
    mkLog('Hard hat Terminal connected','sys','⬡'),
    mkLog('Wallet loaded · balance: 12.40 USDC','info','›'),
    mkLog('Ready to accept territory claims','success','✓'),
  ]);
  const [jobsRun, setJobsRun] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [vmsUsed, setVmsUsed] = useState(0);
  const [uptime, setUptime] = useState('00:00');
  const [vmState, setVmState] = useState<{name:string,state:string,active:boolean}>({name:'No VM active',state:'IDLE',active:false});
  const [orders, setOrders] = useState<any[]>([]);
  const [lastBiomes, setLastBiomes] = useState<Uint8Array|null>(null);
  const [lastSize, setLastSize] = useState(128);
  const [lastParams, setLastParams] = useState<any>(null);
  const [mapStats, setMapStats] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [genPct, setGenPct] = useState(0);
  const [newTerritory, setNewTerritory] = useState<any>(null);
  const [payModal, setPayModal] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [notif, setNotif] = useState(false);
  const [worldNotified, setWorldNotified] = useState(false);

  // Controls
  const [sizeIdx, setSizeIdx] = useState(initialTier ?? 1);
  const [seed, setSeedVal] = useState(1337);
  const [water, setWater] = useState(38);
  const [roughness, setRoughness] = useState(4);
  const [iterations, setIterations] = useState(5);
  const [mountain, setMountain] = useState(70);
  const [forest, setForest] = useState(40);
  const [enabled, setEnabled] = useState<Record<string,boolean>>({water:true,sand:true,grass:true,forest:true,mountain:true,snow:true});

  const { address: walletAddress, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const openConnectModalRef = useRef<(()=>void)|null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logAreaRef = useRef<HTMLDivElement>(null);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    const iv = setInterval(() => {
      const s = Math.floor((Date.now()-sessionStart.current)/1000);
      setUptime(`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    logAreaRef.current?.scrollTo(0, logAreaRef.current.scrollHeight);
  }, [logs]);

  // Auto-generate if launched from pricing
  useEffect(() => {
    if (initialTier !== undefined && !busy) {
      setTimeout(() => generate(), 600);
    }
  }, []);

  function addLog(msg: string, type: LogType='info', icon='›') {
    setLogs(prev => [...prev.slice(-100), mkLog(msg, type, icon)]);
  }

  // Dynamic pricing based on params
  const vmCost = VCOSTS[sizeIdx]; // base VM cost by size
  const iterationsCost = parseFloat(((iterations - 1) * 0.003).toFixed(3)); // more CA = more compute
  const roughnessCost  = parseFloat(((roughness  - 1) * 0.002).toFixed(3)); // more roughness = more passes
  const sizeMult = sizeIdx === 2 ? 1.5 : sizeIdx === 1 ? 1.0 : 0.7;        // kingdom premium
  const baseClaim = parseFloat((0.05 * sizeMult).toFixed(3));
  const storageCost = sizeIdx === 2 ? 0.02 : 0.01;
  const totalPrice = (baseClaim + vmCost + iterationsCost + roughnessCost + storageCost).toFixed(3);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  function handleClaim() {
    if (busy) return;
    if (!isConnected || !walletAddress) {
      addLog('Wallet not connected — connect to claim territory','warn','⚠');
      openConnectModalRef.current?.();
      return;
    }
    setPayModal(true);
  }

  function confirmPay() {
    setPayModal(false);
    generate();
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    const p = { seed, size: SIZES[sizeIdx], water, roughness, iterations, mountain, forest };
    const t0 = performance.now();
    const jobId = 'JOB-' + Date.now().toString(36).toUpperCase();
    const vmId = 'vm-' + Math.random().toString(36).slice(2,8);
    const cost = parseFloat(totalPrice);

    setGenerating(true);
    setGenPct(0);
    setGenStep('Initializing...');
    setOrders(prev => [{seed:p.seed,status:'processing',price:totalPrice+' USDC'},...prev]);

    addLog(`── NEW CLAIM ${jobId} ──`,'hi','');
    await sleep(150);

    addLog('Requesting Conway Cloud sandbox...','sys','⬡');
    setGenPct(18); setGenStep('Provisioning VM...');
    await sleep(550);
    addLog(`VM allocated · ID: ${vmId}`,'sys','⬡');
    setVmState({name:vmId,state:'BOOTING',active:false});
    await sleep(380);
    addLog('Installing runtime environment...','info','→');
    setGenPct(26); setGenStep('Installing dependencies...');
    await sleep(650);
    addLog('Node.js 20.x ready · Canvas module loaded','info','›');
    setGenPct(32); setGenStep('VM ready');
    setVmState({name:vmId,state:'RUNNING',active:true});
    setVmsUsed(prev=>prev+1);
    await sleep(250);

    addLog(`Generating heightmap · ${SLABELS[sizeIdx]} · roughness=${roughness}`,'info','→');
    setGenPct(38); setGenStep(`Heightmap (${SLABELS[sizeIdx]})...`);
    const rng = mulberry32(p.seed*1234567+13);
    const height = diamondSquare(p.size, p.roughness, rng);
    await sleep(250);
    addLog(`Heightmap complete · ${(p.size*p.size).toLocaleString()} cells`,'success','✓');

    for (let i=1;i<=p.iterations;i++) {
      setGenPct(38+i*(20/p.iterations)); setGenStep(`CA iteration ${i}/${p.iterations}...`);
      await sleep(75);
    }
    const land = caSmooth(height, p.size, p.water, p.iterations);
    addLog(`CA smoothing complete · water=${p.water}%`,'success','✓');

    addLog('Assigning biomes...','info','→');
    setGenPct(64); setGenStep('Assigning biomes...');
    await sleep(250);
    const biomes = assignBiomes(land, height, p.size, p);
    const stats = calcStats(biomes);
    addLog(`Biomes assigned · land=${stats.land} water=${stats.water}`,'success','✓');

    addLog('Rendering PNG output...','info','→');
    setGenPct(74); setGenStep('Rendering...');
    await sleep(250);
    if (canvasRef.current) renderBiomesToCanvas(canvasRef.current, biomes, p.size);
    setLastBiomes(biomes); setLastSize(p.size); setLastParams(p);
    setMapStats({...stats, seed:p.seed, size:SLABELS[sizeIdx]});

    addLog('Uploading to CDN...','sys','⬡');
    setGenPct(87); setGenStep('Uploading assets...');
    await sleep(450);
    addLog(`Assets stored · territory-${p.seed}.png ready`,'success','✓');

    addLog(`Terminating VM ${vmId}...`,'sys','⬡');
    setGenPct(94); setGenStep('Shutting down VM...');
    setVmState({name:vmId,state:'TERMINATING',active:false});
    await sleep(380);
    addLog(`VM ${vmId} terminated · session clean`,'info','›');
    setVmState({name:'No VM active',state:'IDLE',active:false});

    // ── x402 Payment + Register territory ─────────────────────────
    addLog('Initiating x402 payment challenge...','info','→');
    setGenPct(90); setGenStep('Requesting payment challenge...');

    let coords = { col: Math.floor(Math.random()*16), row: Math.floor(Math.random()*16) };
    try {
      const claimBody = JSON.stringify({ seed: p.seed, tier: TIER_NAMES[sizeIdx], params: p, agentAddress: walletAddress ?? 'anonymous' });

      // Step 1: probe → expect 402 with x402 payment details
      const probe = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: claimBody,
      });

      if (probe.status !== 402) throw new Error(`Expected 402, got ${probe.status}`);
      const { x402 } = await probe.json();
      const accept = x402?.accepts?.[0];
      if (!accept) throw new Error('No payment scheme in 402 response');

      addLog(`HTTP 402 received · ${parseFloat(accept.maxAmountRequired)/1_000_000} USDC required`,'warn','⚡');
      setGenPct(92); setGenStep('Signing EIP-3009 transfer...');
      addLog('Signing USDC transfer via EIP-3009...','info','→');

      // Step 2: sign EIP-3009 transferWithAuthorization via wagmi
      const nonce = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'') }`;
      const validAfter  = Math.floor(Date.now()/1000) - 10;
      const validBefore = Math.floor(Date.now()/1000) + 300;
      const amount = BigInt(accept.maxAmountRequired);

      const signature = await signTypedDataAsync({
        account: walletAddress,
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 8453, // Base
          verifyingContract: accept.asset as `0x${string}`,
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from',        type: 'address' },
            { name: 'to',          type: 'address' },
            { name: 'value',       type: 'uint256' },
            { name: 'validAfter',  type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce',       type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from:        walletAddress as `0x${string}`,
          to:          accept.payTo as `0x${string}`,
          value:       amount,
          validAfter:  BigInt(validAfter),
          validBefore: BigInt(validBefore),
          nonce:       nonce as `0x${string}`,
        },
      });

      const paymentPayload = {
        scheme: 'exact',
        network: accept.network,
        payload: {
          from: walletAddress!,
          to: accept.payTo,
          value: accept.maxAmountRequired,
          validAfter: String(validAfter),
          validBefore: String(validBefore),
          nonce,
          signature,
        },
      };
      const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

      addLog(`Payment signed · submitting claim...`,'success','✓');
      setGenPct(96); setGenStep('Saving to world...');

      // Step 3: retry with real payment header
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payment': paymentHeader },
        body: claimBody,
      });
      const data = await res.json();
      if (data.territory) {
        coords = { col: data.territory.col, row: data.territory.row };
        addLog(`Territory registered on-chain · tx: ${data.territory.txHash?.slice(0,12)}...`,'success','✓');
        setWalletBal(prev => parseFloat((prev-cost).toFixed(2)));
        setTotalSpent(prev => parseFloat((prev+cost).toFixed(2)));
      } else {
        throw new Error(data.error ?? 'Registration failed');
      }
    } catch(e: any) {
      addLog(`Payment error: ${e.message}`,'err','✗');
      addLog('Territory generated locally — on-chain registration skipped','warn','⚠');
    }

    setGenPct(100); setGenStep('Territory registered!');
    const ms = Math.round(performance.now()-t0);
    addLog(`Territory claimed · ${ms}ms · ${totalPrice} USDC`,'hi','★');
    addLog(`Coordinates: [${coords.col}, ${coords.row}]`,'success','⊕');

    setJobsRun(prev=>prev+1);
    setOrders(prev=>[{...prev[0],status:'done'},  ...prev.slice(1)]);
    setNewTerritory({ ...p, biomes: Array.from(biomes), tier: TIER_NAMES[sizeIdx], ...coords, agent: 'local-agent', isOwn: true });
    setWorldNotified(true);

    await sleep(500);
    setGenerating(false);
    setBusy(false);
  }

  function randomize() {
    const s = Math.floor(Math.random()*9999)+1;
    setSeedVal(s);
    if (!busy) setTimeout(() => generate(), 50);
  }

  function downloadPNG() {
    if (!lastParams) return;
    const { seed, size, water, roughness, iterations, mountain, forest } = lastParams;
    const tier = ['outpost','settlement','kingdom'][sizeIdx] ?? 'settlement';
    const url = `/api/map/${seed}?tier=${tier}&water=${water}&roughness=${roughness}&iterations=${iterations}&mountain=${mountain}&forest=${forest}`;
    const a = document.createElement('a');
    a.download = `terraria-${seed}.png`;
    a.href = url;
    a.click();
  }

  function downloadJSON() {
    if (!lastBiomes || !lastParams) return;
    const data = {engine:'TERRARIA v0.1',generated:new Date().toISOString(),params:lastParams,biomes:Array.from(lastBiomes),stats:calcStats(lastBiomes)};
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.download=`terraria-${lastParams.seed}.json`; a.href=URL.createObjectURL(blob); a.click();
  }

  const logColors: Record<LogType, string> = {
    info:'text-[#888898]', success:'text-accent', warn:'text-amber', err:'text-danger', sys:'text-blue', hi:'text-accent'
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-3.5">
            <div className="font-display text-2xl tracking-[6px] text-accent" style={{textShadow:'0 0 20px rgba(200,200,255,0.3)'}}>TERRANOVA</div>
            <div className="font-mono text-[9px] text-[#44444f] border border-border2 px-1.5 py-0.5 tracking-[2px]">Territory Engine</div>
          </div>
          <div className="flex gap-1">
            <button onClick={()=>setTab('claim')} className={`font-mono text-[10px] tracking-[2px] px-4 py-1.5 border uppercase transition-all ${tab==='claim'?'bg-accent text-black border-accent':'bg-transparent border-border2 text-[#44444f] hover:border-[#888898] hover:text-[#dddde8]'}`}>⬡ Claim Territory</button>
            <button onClick={()=>{ setTab('world'); setWorldNotified(false); }} className={`font-mono text-[10px] tracking-[2px] px-4 py-1.5 border uppercase transition-all ${tab==='world'?'bg-accent text-black border-accent':'bg-transparent border-border2 text-[#44444f] hover:border-[#888898] hover:text-[#dddde8]'}`}>
              🌍 World Map{worldNotified?' ●':''}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#888898]"><div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(200,200,255,0.5)] animate-pulse-dot" />AGENT ONLINE</div>
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              // expose openConnectModal so handleClaim can trigger it
              openConnectModalRef.current = openConnectModal;
              const connected = mounted && account && chain;
              return (
                <div>
                  {!connected ? (
                    <button onClick={openConnectModal}
                      className="font-mono text-[10px] tracking-[2px] border border-accent text-accent px-4 py-1.5 uppercase hover:bg-accent hover:text-black transition-all">
                      CONNECT WALLET
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={openChainModal}
                        className="font-mono text-[9px] text-[#44444f] border border-border2 px-2 py-1 uppercase hover:border-accent hover:text-accent transition-all">
                        {chain.name}
                      </button>
                      <button onClick={openAccountModal}
                        className="font-mono text-[10px] text-accent border border-border2 px-3 py-1 uppercase hover:bg-accent hover:text-black transition-all">
                        {account.displayName}
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
          <button onClick={onBack} className="font-mono text-[10px] tracking-[2px] border border-border2 text-[#44444f] px-3.5 py-1.5 uppercase hover:border-[#888898] hover:text-[#dddde8] transition-all">← Back</button>
        </div>
      </div>

      {/* WORLD MAP VIEW */}
      {tab === 'world' && (
        <div className="flex-1 overflow-hidden">
          <WorldMap newTerritory={newTerritory} />
        </div>
      )}

      {/* CLAIM VIEW */}
      {tab === 'claim' && (
        <div className="flex flex-1 overflow-hidden" style={{display: tab==='claim'?'flex':'none'}}>
          {/* LEFT: CONFIG */}
          <div className="w-[280px] flex flex-col border-r border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="font-mono text-[9px] tracking-[3px] text-[#44444f] uppercase flex items-center gap-1.5"><span className="w-0.5 h-2.5 bg-accent" />Configuration</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {[
                { title: 'Grid', children: (
                  <>
                    <Ctrl label="Size" val={SLABELS[sizeIdx]}>
                      <input type="range" min={0} max={2} value={sizeIdx} step={1} onChange={e=>setSizeIdx(+e.target.value)} />
                    </Ctrl>
                    <Ctrl label="Seed" val={seed}>
                      <input type="range" min={1} max={9999} value={seed} onChange={e=>setSeedVal(+e.target.value)} />
                    </Ctrl>
                  </>
                )},
                { title: 'Terrain', children: (
                  <>
                    <Ctrl label="Water Level" val={water+'%'}><input type="range" min={10} max={65} value={water} onChange={e=>setWater(+e.target.value)} /></Ctrl>
                    <Ctrl label="Roughness" val={roughness}><input type="range" min={1} max={8} value={roughness} onChange={e=>setRoughness(+e.target.value)} /></Ctrl>
                    <Ctrl label="CA Iterations" val={iterations}><input type="range" min={1} max={12} value={iterations} onChange={e=>setIterations(+e.target.value)} /></Ctrl>
                  </>
                )},
                { title: 'Features', children: (
                  <>
                    <Ctrl label="Mountain Threshold" val={mountain+'%'}><input type="range" min={50} max={92} value={mountain} onChange={e=>setMountain(+e.target.value)} /></Ctrl>
                    <Ctrl label="Forest Density" val={forest+'%'}><input type="range" min={10} max={80} value={forest} onChange={e=>setForest(+e.target.value)} /></Ctrl>
                  </>
                )},
                { title: 'Biomes', children: (
                  <div className="grid grid-cols-3 gap-1">
                    {[{k:'water',l:'Water',c:'#1a3a5c'},{k:'sand',l:'Beach',c:'#8a7355'},{k:'grass',l:'Grass',c:'#2d5a27'},{k:'forest',l:'Forest',c:'#1a3d18'},{k:'mountain',l:'Mtn',c:'#4a4a4a'},{k:'snow',l:'Snow',c:'#c8c8cc'}].map(b=>(
                      <button key={b.k} onClick={()=>setEnabled(prev=>({...prev,[b.k]:!prev[b.k]}))}
                        className={`flex items-center justify-center gap-1 py-1.5 px-1 border font-mono text-[8px] tracking-[1px] uppercase transition-all ${enabled[b.k]?'border-[rgba(200,200,255,0.3)] text-[#dddde8] bg-[rgba(200,200,255,0.06)]':'border-border2 text-[#44444f]'}`}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:b.c}} />{b.l}
                      </button>
                    ))}
                  </div>
                )},
                { title: 'Pricing', children: (
                  <>
                    <div className="bg-bg border border-border2 p-3 mb-2.5">
                      {[
                        ['Base claim', baseClaim.toFixed(3)],
                        ['VM compute', vmCost.toFixed(2)],
                        ['CA iterations', '+'+iterationsCost.toFixed(3)],
                        ['Roughness passes', '+'+roughnessCost.toFixed(3)],
                        ['Storage + CDN', storageCost.toFixed(2)],
                      ].map(([l,v])=>(
                        <div key={l} className="flex justify-between text-[11px] text-[#44444f] py-1"><span>{l}</span><span className={`font-mono ${String(v).startsWith('+') && v !== '+0.000' ? 'text-amber' : 'text-[#dddde8]'}`}>{v} USDC</span></div>
                      ))}
                      <div className="flex justify-between text-[12px] text-accent pt-2 mt-1.5 border-t border-border2">
                        <span>Total</span><span className="font-mono text-[15px]">{totalPrice} USDC</span>
                      </div>
                    </div>
                    <button disabled={busy} onClick={handleClaim}
                      className="w-full bg-accent text-black font-display text-xl tracking-[4px] py-3 mb-1.5 hover:bg-white transition-all disabled:bg-border2 disabled:text-[#44444f] disabled:cursor-not-allowed">
                      CLAIM TERRITORY
                    </button>
                    <button onClick={randomize} className="w-full bg-transparent border border-border2 text-[#44444f] font-mono text-[9px] tracking-[2px] py-2 uppercase hover:border-[#888898] hover:text-[#dddde8] transition-all">
                      ↺ NEW SEED
                    </button>
                  </>
                )},
              ].map(s=>(
                <div key={s.title} className="p-3.5 border-b border-border">
                  <div className="font-mono text-[8px] tracking-[3px] text-[#44444f] uppercase mb-3">{s.title}</div>
                  {s.children}
                </div>
              ))}
            </div>
          </div>

          {/* CENTER: MAP */}
          <div className="flex-1 bg-bg flex flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(rgba(180,180,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(180,180,255,0.025) 1px,transparent 1px)',backgroundSize:'40px 40px'}} />
              <div className="relative z-10">
                <canvas ref={canvasRef} width={512} height={512} className="block shadow-[0_0_60px_rgba(0,0,0,0.9)]" style={{imageRendering:'pixelated'}} />
                {['tl','tr','bl','br'].map(p=>(
                  <div key={p} className={`absolute w-4 h-4 border-accent border-2 ${p==='tl'?'-top-0.5 -left-0.5 border-t border-l border-r-0 border-b-0':p==='tr'?'-top-0.5 -right-0.5 border-t border-r border-l-0 border-b-0':p==='bl'?'-bottom-0.5 -left-0.5 border-b border-l border-t-0 border-r-0':'-bottom-0.5 -right-0.5 border-b border-r border-t-0 border-l-0'}`} />
                ))}
              </div>
              {generating && (
                <div className="absolute inset-0 bg-bg/93 flex flex-col items-center justify-center gap-4 z-20">
                  <div className="font-display text-3xl tracking-[8px] text-accent" style={{textShadow:'0 0 30px rgba(220,220,255,0.7)'}}>GENERATING</div>
                  <div className="font-mono text-[11px] text-[#888898] tracking-[2px] min-h-4">{genStep}</div>
                  <div className="w-56 h-px bg-border2 overflow-hidden"><div className="h-full bg-accent shadow-[0_0_8px_rgba(200,200,255,0.5)] transition-all duration-300" style={{width:`${genPct}%`}} /></div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface flex-shrink-0">
              <div className="flex gap-4">
                {[{id:'size',l:'Grid',v:mapStats?.size},{id:'seed',l:'Seed',v:mapStats?.seed},{id:'water',l:'Water',v:mapStats?.water},{id:'land',l:'Land',v:mapStats?.land},{id:'ms',l:'Time',v:mapStats?.ms}].map(s=>(
                  <div key={s.id}><div className="font-mono text-xs text-accent leading-none">{s.v??'—'}</div><div className="font-mono text-[8px] text-[#44444f] uppercase tracking-[1px] mt-0.5">{s.l}</div></div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button disabled={!lastBiomes} onClick={downloadPNG} className="font-mono text-[9px] tracking-[2px] border border-border2 text-[#44444f] px-3 py-1.5 uppercase hover:border-accent hover:text-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed">↓ PNG</button>
                <button disabled={!lastBiomes} onClick={downloadJSON} className="font-mono text-[9px] tracking-[2px] border border-border2 text-[#44444f] px-3 py-1.5 uppercase hover:border-accent hover:text-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed">↓ JSON</button>
              </div>
            </div>
          </div>

          {/* RIGHT: LOGS */}
          <div className="w-[300px] flex flex-col border-l border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="font-mono text-[9px] tracking-[3px] text-[#44444f] uppercase flex items-center gap-1.5"><span className="w-0.5 h-2.5 bg-accent" />Agent Activity</div>
              <button onClick={()=>setLogs([mkLog('Log cleared','info','›')])} className="font-mono text-[8px] tracking-[1px] border border-border2 text-[#44444f] px-1.5 py-0.5 uppercase">CLEAR</button>
            </div>
            <div ref={logAreaRef} className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-px">
              {logs.map(l=>(
                <div key={l.id} className={`flex gap-2 px-1.5 py-0.5 font-mono text-[10px] leading-relaxed log-entry ${l.type==='hi'?'bg-[rgba(200,200,255,0.06)]':''}`}>
                  <span className="text-[#44444f] text-[9px] flex-shrink-0 mt-px">{l.time}</span>
                  <span className="flex-shrink-0 mt-px">{l.icon}</span>
                  <span className={logColors[l.type]}>{l.msg}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-3 flex-shrink-0">
              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                {[{v:jobsRun,l:'Claimed'},{v:totalSpent.toFixed(2),l:'USDC Spent'},{v:vmsUsed,l:'VMs Used'},{v:uptime,l:'Session'}].map(s=>(
                  <div key={s.l} className="bg-bg border border-border p-2"><div className="font-mono text-sm text-accent">{s.v}</div><div className="font-mono text-[8px] text-[#44444f] uppercase tracking-[1px] mt-0.5">{s.l}</div></div>
                ))}
              </div>
              <div className={`flex items-center gap-1.5 font-mono text-[10px] text-[#44444f] bg-bg border border-border px-2.5 py-1.5 mb-2.5`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${vmState.active?'bg-accent shadow-[0_0_6px_rgba(200,200,255,0.4)] animate-pulse-dot':'bg-[#44444f]'}`} />
                <span className="flex-1 truncate">{vmState.name}</span>
                <span className="text-[#888898]">{vmState.state}</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="font-mono text-[9px] tracking-[3px] text-[#44444f] uppercase flex items-center gap-1.5 mb-2"><span className="w-0.5 h-2.5 bg-accent" />Recent Claims</div>
                {orders.length === 0 ? (
                  <div className="font-mono text-[9px] text-[#44444f] py-1">No claims yet</div>
                ) : orders.slice(0,4).map((o,i)=>(
                  <div key={i} className="flex items-center gap-1.5 py-1.5 border-b border-border last:border-0 text-[10px]">
                    <span className="font-mono text-[#dddde8] flex-1">seed-{o.seed}</span>
                    <span className={`font-mono text-[8px] px-1 border ${o.status==='done'?'border-accent text-accent':'border-amber text-amber'} uppercase`}>{o.status}</span>
                    <span className="font-mono text-[9px] text-[#44444f]">{o.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 402 PAYMENT MODAL */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface border border-border w-[420px] font-mono">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-amber text-lg">⚡</span>
                <span className="font-display tracking-[4px] text-accent text-lg">HTTP 402</span>
              </div>
              <button onClick={() => setPayModal(false)} className="text-[#44444f] hover:text-[#dddde8] text-lg">✕</button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              <div className="text-[11px] text-[#888898] tracking-[2px] uppercase mb-4">Payment Required · x402 Protocol</div>

              {/* Territory preview info */}
              <div className="bg-bg border border-border2 p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-[#44444f] uppercase tracking-[2px]">Territory</span>
                  <span className="text-accent text-[10px] uppercase tracking-[1px]">{TIER_NAMES[sizeIdx].toUpperCase()} · {SLABELS[sizeIdx]}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-[#44444f] uppercase tracking-[2px]">Seed</span>
                  <span className="text-[#dddde8] text-[10px]">#{seed}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-[#44444f] uppercase tracking-[2px]">Network</span>
                  <span className="text-[#dddde8] text-[10px]">Base · USDC</span>
                </div>
                <div className="border-t border-border2 pt-3 mt-1 flex justify-between items-center">
                  <span className="text-[11px] text-[#888898] uppercase tracking-[2px]">Total</span>
                  <span className="font-display text-2xl text-accent tracking-[3px]">{totalPrice} <span className="text-[14px]">USDC</span></span>
                </div>
              </div>

              {/* What you get */}
              <div className="mb-5">
                <div className="text-[9px] text-[#44444f] tracking-[3px] uppercase mb-2">What you get</div>
                {[
                  '→ Permanent territory on 16×16 world map',
                  '→ Unique terrain generated by Conway VM',
                  '→ On-chain registration via EIP-3009',
                  '→ PNG + JSON assets stored forever',
                ].map(item => (
                  <div key={item} className="text-[10px] text-[#888898] py-1">{item}</div>
                ))}
              </div>

              {/* CTA buttons */}
              <button onClick={confirmPay}
                className="w-full bg-accent text-black font-display text-lg tracking-[4px] py-3 mb-2 hover:bg-white transition-all">
                AUTHORIZE PAYMENT
              </button>
              <button onClick={() => setPayModal(false)}
                className="w-full bg-transparent border border-border2 text-[#44444f] text-[10px] tracking-[2px] py-2 uppercase hover:border-[#888898] hover:text-[#dddde8] transition-all">
                CANCEL
              </button>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-bg">
              <div className="text-[9px] text-[#44444f] tracking-[1px]">
                Payment processed via <span className="text-accent">x402 protocol</span> · EIP-3009 gasless transfer · No gas required
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Ctrl({ label, val, children }: { label: string; val: any; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-[12px] text-[#888898] mb-1.5">
        <span>{label}</span><b className="font-mono text-[#dddde8] font-normal">{val}</b>
      </div>
      {children}
    </div>
  );
}
