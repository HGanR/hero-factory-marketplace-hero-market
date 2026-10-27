import { fileURLToPath } from 'node:url';
if (process.env.VERCEL_ENV === 'production') {
  throw new Error('This target is for protected Preview deployments only. Do not promote it over the website.');
}
export default {
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  experimental: { cpus: 2 },
  async redirects() {
    return ['/app/dashboard', '/troo-town', '/wallet-dashboard'].map(source => ({ source, destination: `https://troothhurtz.app${source}`, permanent: false }));
  }
};
