export * from "@/lib/revenue-os/market-signals/types";
export { redditConnector } from "@/lib/revenue-os/market-signals/redditConnector";
export { youtubeConnector } from "@/lib/revenue-os/market-signals/youtubeConnector";
export { aggregateRealMarketSignals } from "@/lib/revenue-os/market-signals/aggregateRealSignals";
export {
  mergeRealIntoStringBuckets,
  buildScoredInsightsBuckets,
  scoreRealSignals,
} from "@/lib/revenue-os/market-signals/scoring";
