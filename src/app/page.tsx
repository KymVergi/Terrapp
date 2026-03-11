'use client';
import { useState } from 'react';
import Landing from '@/components/Landing';
import App from '@/components/App';
import Transition from '@/components/Transition';

export default function Home() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [transitioning, setTransitioning] = useState(false);
  const [pendingTier, setPendingTier] = useState<number | undefined>();
  const [transMsg, setTransMsg] = useState('Booting agent...');

  function launchApp(tier?: number) {
    const TIER_NAMES = ['OUTPOST', 'SETTLEMENT', 'KINGDOM'];
    setTransMsg(tier !== undefined ? `Loading ${TIER_NAMES[tier]} tier...` : 'Entering world...');
    setPendingTier(tier);
    setTransitioning(true);
    setTimeout(() => {
      setView('app');
      setTransitioning(false);
    }, 1400);
  }

  function goBack() {
    setTransMsg('Returning...');
    setTransitioning(true);
    setTimeout(() => {
      setView('landing');
      setTransitioning(false);
    }, 1400);
  }

  return (
    <>
      <Transition active={transitioning} message={transMsg} />
      {view === 'landing' && <Landing onLaunch={launchApp} />}
      {view === 'app'     && <App onBack={goBack} initialTier={pendingTier} />}
    </>
  );
}
