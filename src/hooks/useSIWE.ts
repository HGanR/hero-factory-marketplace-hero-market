import { useState } from 'react';
import { useSignMessage, useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

export function useSIWE() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();

  const authenticate = async () => {
    if (!address) {
      setError('No wallet connected');
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // Get nonce from server
      const nonceResponse = await fetch('/api/auth/siwe/nonce');
      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce');
      }

      const { nonce } = await nonceResponse.json();

      // Create SIWE message
      const message = [
        `${window.location.host} wants you to sign in with your Ethereum account:`,
        address,
        '',
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
        `Expiration Time: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}`, // 24 hours
      ].join('\n');

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Verify with server
      const verifyResponse = await fetch('/api/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, signature, nonce }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      // Success - refresh the page to pick up the new session
      router.refresh();

    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    authenticate,
    logout,
    isAuthenticating,
    error,
  };
}







