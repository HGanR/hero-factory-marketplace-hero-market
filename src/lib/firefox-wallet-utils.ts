// Firefox-specific wallet utilities
export const firefoxWalletUtils = {
  // Detect if running in Firefox
  isFirefox: typeof window !== 'undefined' &&
    navigator.userAgent.toLowerCase().indexOf('firefox') > -1,

  // Check for wallet availability with Firefox-specific timing
  detectWallets: async (): Promise<{
    hasMetaMask: boolean;
    hasGenericWallet: boolean;
    extensionReady: boolean;
  }> => {
    if (!firefoxWalletUtils.isFirefox) {
      return {
        hasMetaMask: !!window.ethereum?.isMetaMask,
        hasGenericWallet: !!window.ethereum,
        extensionReady: true,
      };
    }

    // Firefox needs more time for extension initialization
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const hasMetaMask = !!window.ethereum?.isMetaMask;
      const hasGenericWallet = !!window.ethereum;

      if (hasMetaMask || hasGenericWallet) {
        return {
          hasMetaMask,
          hasGenericWallet,
          extensionReady: true,
        };
      }

      // Wait longer between attempts for Firefox
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    return {
      hasMetaMask: false,
      hasGenericWallet: false,
      extensionReady: false,
    };
  },

  // Get Firefox-specific error message
  getErrorMessage: (error: any): string => {
    if (!firefoxWalletUtils.isFirefox) return error?.message || 'Unknown error';

    const message = error?.message || '';

    if (message.includes('Extension context invalidated')) {
      return 'Firefox extension issue. Refresh the page and try again.';
    }

    if (message.includes('No Ethereum provider') || error?.name === 'ConnectorNotFoundError') {
      return 'Firefox: No Web3 wallet detected. Install MetaMask and refresh the page.';
    }

    if (message.includes('timeout') || message.includes('TimeoutError')) {
      return 'Firefox connection timeout. Extensions take longer to load. Please wait and try again.';
    }

    return message || 'Firefox wallet connection failed. Try refreshing the page.';
  },

  // Firefox-specific troubleshooting steps
  getTroubleshootingSteps: (): string[] => {
    if (!firefoxWalletUtils.isFirefox) return [];

    return [
      'Refresh the page (Firefox extensions initialize slowly)',
      'Restart Firefox completely',
      'Try Chrome or Edge instead',
      'Reinstall MetaMask extension',
      'Disable other Firefox extensions temporarily',
      'Check Firefox is updated to latest version',
    ];
  },

  // Log Firefox-specific debugging info
  logDebugInfo: () => {
    if (!firefoxWalletUtils.isFirefox) return;

    console.log('🔍 Firefox Wallet Debug Info:', {
      firefoxVersion: navigator.userAgent.match(/Firefox\/(\d+)/)?.[1] || 'unknown',
      hasEthereum: typeof window.ethereum !== 'undefined',
      isMetaMask: window.ethereum?.isMetaMask,
      providersCount: (window.ethereum as any)?.providers?.length || 0,
      userAgent: navigator.userAgent,
      location: window.location.href,
      timestamp: new Date().toISOString(),
    });
  },
};