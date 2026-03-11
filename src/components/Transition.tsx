'use client';

export default function Transition({ active, message }: { active: boolean; message: string }) {
  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-bg transition-opacity duration-300 ${active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="font-display text-5xl tracking-[12px] text-accent" style={{ textShadow: '0 0 40px rgba(200,200,255,0.6), 0 0 80px rgba(200,200,255,0.3)', animation: active ? 'glitch 0.4s infinite' : 'none' }}>
        TERRANOVA
      </div>
      <div className="w-48 h-px bg-border2 overflow-hidden">
        {active && <div className="h-full bg-accent shadow-[0_0_8px_rgba(200,200,255,0.5)]" style={{ animation: 'tfill 1.2s ease forwards' }} />}
      </div>
      <div className="font-mono text-[11px] tracking-[3px] text-[#44444f] uppercase">{message}</div>
      <style>{`@keyframes tfill { from{width:0%} to{width:100%} }`}</style>
    </div>
  );
}
