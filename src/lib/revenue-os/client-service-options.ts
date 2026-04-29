export const CLIENT_SERVICE_OPTIONS = [
  "NFT Line",
  "Website",
  "AI Agent",
  "Social Media Campaign",
  "Marketing",
  "3D World",
  "Crypto Coins",
  "Accounting",
  "Financial Readiness",
  "Grant Writing",
  "Trust",
  "Wills",
  "Seal Maker",
] as const;

export type ClientServiceOption = (typeof CLIENT_SERVICE_OPTIONS)[number];
