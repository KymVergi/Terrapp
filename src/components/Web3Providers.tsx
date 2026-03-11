'use client';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
  appName: 'TERRARIA',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'terraria-dev',
  chains: [base, baseSepolia],
  ssr: true,
});

const queryClient = new QueryClient();

// Custom dark theme matching TERRARIA aesthetic
const terrariaTheme = darkTheme({
  accentColor: '#e8e8ff',
  accentColorForeground: '#07070a',
  borderRadius: 'none',
  fontStack: 'system',
  overlayBlur: 'small',
});

// Override more styles
const customTheme = {
  ...terrariaTheme,
  colors: {
    ...terrariaTheme.colors,
    modalBackground: '#0d0d12',
    modalBorder: '#18181f',
    menuItemBackground: '#121218',
    profileForeground: '#0d0d12',
    profileAction: '#121218',
    profileActionHover: '#18181f',
    connectButtonBackground: '#07070a',
    connectButtonInnerBackground: '#0d0d12',
    connectButtonText: '#e8e8ff',
    connectButtonTextError: '#ff3344',
    actionButtonBorder: '#222230',
    actionButtonBorderMobile: '#222230',
    actionButtonSecondaryBackground: '#121218',
    closeButton: '#44444f',
    closeButtonBackground: '#18181f',
    downloadBottomCardBackground: '#0d0d12',
    downloadTopCardBackground: '#121218',
    error: '#ff3344',
    generalBorder: '#18181f',
    generalBorderDim: '#121218',
    standby: '#ffaa00',
  },
  fonts: {
    body: '"Share Tech Mono", monospace',
  },
  radii: {
    actionButton: '0px',
    connectButton: '0px',
    menuButton: '0px',
    modal: '0px',
    modalMobile: '0px',
  },
};

export default function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
