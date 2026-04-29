declare global {
  interface Window {
    Jupiter: any;
  }
}

// CSS module declarations
declare module '@solana/wallet-adapter-react-ui/styles.css';

// Missing type definitions - prevent TypeScript from looking for @types packages
declare module 'ms' {
  const ms: (value: string | number) => number;
  export = ms;
}

declare module 'three' {
  const three: any;
  export = three;
  export * from 'three';
}

export {};
