"use client";

import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/navigation";
import CryptoBubbles from "@/components/crypto/CryptoBubbles";

interface HighestVolumeCurrency {
  currency: string;
  name: string;
  priceUSD: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  chartData: Array<{ time: string; value: number }>;
}

interface CryptoBubble {
  id: string;
  currency: string;
  symbol: string;
  name: string;
  displayOrder: number;
  color?: string;
  icon?: string;
  isEnabled: boolean;
}

interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume: number;
  image: string;
}

export default function MarketIntelligencePage() {
  const router = useRouter();
  const [highestVolume, setHighestVolume] = useState<HighestVolumeCurrency | null>(null);
  const [marketData, setMarketData] = useState<HighestVolumeCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLimit, setSelectedLimit] = useState('10');

  // Crypto bubbles state
  const [cryptoBubbles, setCryptoBubbles] = useState<CryptoBubble[]>([]);
  const [marketCoins, setMarketCoins] = useState<MarketCoin[]>([]);
  const [bubblesLoading, setBubblesLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d'>('24h');
  const [focusedBubble, setFocusedBubble] = useState<{
    bubble: CryptoBubble;
    marketData?: MarketCoin;
  } | null>(null);
  const [dataFreshness, setDataFreshness] = useState<{
    lastUpdated: Date | null;
    status: 'live' | 'cached' | 'stale';
    cacheAge?: number;
  }>({ lastUpdated: null, status: 'live' });
  const [consultantNotes, setConsultantNotes] = useState<string>("");
  const [notesLoading, setNotesLoading] = useState(false);

  // Watchlist and cluster state
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'watchlist' | 'cluster'>('all');

  useEffect(() => {
    fetchMarketData();
  }, [selectedLimit]);

  useEffect(() => {
    let pollingTimer: any;

    async function fetchCryptoBubbles() {
      try {
        const response = await fetch('/api/admin/crypto-bubbles');
        const data = await response.json();
        if (data.success) {
          setCryptoBubbles(data.bubbles);
        }
      } catch (error) {
        console.error('Error fetching crypto bubbles:', error);
      }
    }

    async function fetchMarketCoins() {
      const enabledBubbles = cryptoBubbles.filter(b => b.isEnabled);
      if (enabledBubbles.length === 0) {
        setMarketCoins([]);
        setBubblesLoading(false);
        return;
      }

      const symbols = enabledBubbles.map(b => b.currency).join(',');
      try {
        const response = await fetch(`/api/market/bubbles?symbols=${encodeURIComponent(symbols)}&timeframe=${selectedTimeframe}`, {
          cache: 'no-store'
        });
        const data = await response.json();
        if (data.ok) {
          setMarketCoins(data.coins);
          // Update freshness status
          setDataFreshness({
            lastUpdated: new Date(),
            status: data.stale ? 'stale' : (data.cached ? 'cached' : 'live'),
            cacheAge: data.cacheAge
          });
        }
      } catch (error) {
        console.error('Error fetching market coins:', error);
      } finally {
        setBubblesLoading(false);
      }
    }

    async function refresh() {
      await fetchCryptoBubbles();
      await fetchMarketCoins();
    }

    refresh();
    pollingTimer = setInterval(refresh, 20000); // 20 seconds

    return () => {
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [cryptoBubbles.length > 0 ? cryptoBubbles.filter(b => b.isEnabled).length : 0, selectedTimeframe]);

  useEffect(() => {
    loadWatchlists();
    loadClusters();
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('Crypto bubbles loaded:', cryptoBubbles);
    console.log('Market coins loaded:', marketCoins);
  }, [cryptoBubbles, marketCoins]);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/crypto/highest-volume?limit=${selectedLimit}`);
      const data = await response.json();
      if (data.success) {
        setMarketData(data.currencies);
        if (data.currencies.length > 0) {
          setHighestVolume(data.currencies[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (change: number) => {
    return change >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const loadNotes = async (symbol: string) => {
    try {
      setNotesLoading(true);
      const response = await fetch(`/api/consultant-notes?symbol=${encodeURIComponent(symbol)}&timeframe=${selectedTimeframe}`);
      const data = await response.json();
      if (data.success) {
        setConsultantNotes(data.notes?.notes || "");
      }
    } catch (error) {
      console.error("Error loading notes:", error);
      setConsultantNotes("");
    } finally {
      setNotesLoading(false);
    }
  };

  const saveNotes = async (symbol: string, notes: string) => {
    try {
      const response = await fetch('/api/consultant-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe: selectedTimeframe,
          notes
        })
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("Error saving notes:", error);
      return false;
    }
  };

  const handleBubbleClick = async (bubble: CryptoBubble, marketData?: MarketCoin) => {
    setFocusedBubble({ bubble, marketData });
    await loadNotes(bubble.currency);
  };

  const closeFocusedBubble = () => {
    setFocusedBubble(null);
    setConsultantNotes("");
  };

  const handleNotesChange = async (newNotes: string) => {
    setConsultantNotes(newNotes);
    if (focusedBubble) {
      await saveNotes(focusedBubble.bubble.currency, newNotes);
    }
  };

  const loadWatchlists = async () => {
    try {
      const response = await fetch('/api/consultant-watchlists');
      const data = await response.json();
      if (data.success) {
        setWatchlists(data.watchlists);
      }
    } catch (error) {
      console.error("Error loading watchlists:", error);
    }
  };

  const loadClusters = async () => {
    try {
      const response = await fetch('/api/market/clusters');
      const data = await response.json();
      if (data.success) {
        setClusters(data.clusters);
      }
    } catch (error) {
      console.error("Error loading clusters:", error);
    }
  };

  // Filter bubbles based on current view mode
  const getFilteredBubbles = () => {
    if (viewMode === 'all') {
      return cryptoBubbles;
    }

    if (viewMode === 'watchlist' && selectedWatchlist) {
      const watchlist = watchlists.find(w => w.id === selectedWatchlist);
      if (watchlist) {
        return cryptoBubbles.filter(bubble => watchlist.symbols.includes(bubble.currency));
      }
    }

    if (viewMode === 'cluster' && selectedCluster) {
      const cluster = clusters.find(c => c.id === selectedCluster);
      if (cluster) {
        return cryptoBubbles.filter(bubble => cluster.symbols.includes(bubble.currency));
      }
    }

    return cryptoBubbles;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) {
      return `$${(volume / 1000000000).toFixed(1)}B`;
    } else if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  };

  return (
    <>
      <Head>
        <title>Crypto Market Intelligence - Hero Market</title>
        <meta name="description" content="Market data for analysis and client advisory. Not a trading venue. No execution." />
      </Head>

      <div className="min-h-screen bg-[#0f1419] text-white">
        {/* Header */}
        <header className="border-b border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Dashboard</span>
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-sm">₿</span>
                </div>
                <h1 className="text-xl font-bold">Crypto Market Intelligence</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                Market data for analysis and client advisory. Not a trading venue. No execution.
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-6">
              {/* Admin-selected Crypto Bubbles */}
              <div className="bg-[#1a2332] rounded-xl p-6 border border-gray-800 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Market Watch</h3>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          fetchMarketData();
                          // Force refresh crypto bubbles
                          fetch('/api/admin/crypto-bubbles')
                            .then(res => res.json())
                            .then(data => {
                              if (data.success) {
                                setCryptoBubbles(data.bubbles);
                              }
                            })
                            .catch(err => console.error('Error refreshing bubbles:', err));
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded mr-4"
                      >
                        Refresh Data
                      </button>
                      <span className="text-sm text-gray-400">Timeframe:</span>
                      <div className="flex bg-[#0f1419] rounded-lg p-1">
                        {[
                          { key: '1h', label: '1H' },
                          { key: '24h', label: '24H' },
                          { key: '7d', label: '7D' }
                        ].map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setSelectedTimeframe(key as '1h' | '24h' | '7d')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              selectedTimeframe === key
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Data Freshness Indicator */}
                    <div className="flex items-center space-x-3 text-xs">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        dataFreshness.status === 'live'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : dataFreshness.status === 'cached'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {dataFreshness.status === 'live' && '● Live'}
                        {dataFreshness.status === 'cached' && '○ Cached'}
                        {dataFreshness.status === 'stale' && '⚠ Stale'}
                      </div>
                      {dataFreshness.lastUpdated && (
                        <span className="text-gray-400">
                          {dataFreshness.lastUpdated.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* View Mode and Filters */}
                  <div className="flex items-center justify-between w-full mt-3">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">View:</span>
                        <div className="flex bg-[#0f1419] rounded-lg p-1">
                          <button
                            onClick={() => {
                              setViewMode('all');
                              setSelectedWatchlist(null);
                              setSelectedCluster(null);
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              viewMode === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                          >
                            All Coins
                          </button>
                          <button
                            onClick={() => setViewMode('watchlist')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              viewMode === 'watchlist'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                          >
                            Watchlist
                          </button>
                          <button
                            onClick={() => setViewMode('cluster')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              viewMode === 'cluster'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                          >
                            Clusters
                          </button>
                        </div>
                      </div>

                      {/* Watchlist/Cluster Selector */}
                      {viewMode === 'watchlist' && watchlists.length > 0 && (
                        <select
                          value={selectedWatchlist || ''}
                          onChange={(e) => setSelectedWatchlist(e.target.value || null)}
                          className="bg-[#0f1419] border border-gray-600 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select Watchlist</option>
                          {watchlists.map(watchlist => (
                            <option key={watchlist.id} value={watchlist.id}>
                              {watchlist.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {viewMode === 'cluster' && clusters.length > 0 && (
                        <select
                          value={selectedCluster || ''}
                          onChange={(e) => setSelectedCluster(e.target.value || null)}
                          className="bg-[#0f1419] border border-gray-600 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select Cluster</option>
                          {clusters.map(cluster => (
                            <option key={cluster.id} value={cluster.id}>
                              {cluster.displayName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                {bubblesLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="w-full flex justify-center">
                    <div className="w-[1240px] h-[600px] border border-gray-700 rounded-lg overflow-hidden bg-[#0f1419]/50">
                      <CryptoBubbles
                        limit={20}
                        animated={true}
                        showPrices={true}
                        className="w-full h-full p-4"
                        bubbles={getFilteredBubbles()}
                        marketCoins={marketCoins}
                        onBubbleClick={handleBubbleClick}
                        containerSize={{ width: 1200, height: 550 }}
                        sizeByValue={true}
                      />
                    </div>
                  </div>
                )}
              </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Highest Volume Card */}
            <div className="bg-[#1a2332] rounded-xl p-6 border border-gray-800">
              <h3 className="text-gray-400 text-sm mb-4">Highest Volume (24h)</h3>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-32 bg-gray-700 rounded mb-4"></div>
                  <div className="h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                </div>
              ) : highestVolume ? (
                <>
                  <div className="mb-4">
                    <svg className="w-full h-32" viewBox="0 0 300 100">
                      <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        points={highestVolume.chartData.map((point, i) =>
                          `${(i / (highestVolume.chartData.length - 1)) * 300},${100 - (point.value / Math.max(...highestVolume.chartData.map(p => p.value)) * 80)}`
                        ).join(' ')}
                      />
                    </svg>
                  </div>
                  <div className="text-3xl font-bold mb-2">USD {highestVolume.priceUSD.toLocaleString()}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-gray-400">{highestVolume.name} {highestVolume.currency}</div>
                    <div className={`flex items-center ${getStatusColor(highestVolume.priceChange24h)}`}>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      {highestVolume.priceChange24h.toFixed(2)}%
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-400">
                    Volume: {formatVolume(highestVolume.volume24h)}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No market data available
                </div>
              )}
            </div>

            {/* Market Overview */}
            <div className="bg-[#1a2332] rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Market Overview</h3>
                <select
                  value={selectedLimit}
                  onChange={(e) => setSelectedLimit(e.target.value)}
                  className="bg-[#0f1419] border border-gray-700 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="5">Top 5</option>
                  <option value="10">Top 10</option>
                  <option value="25">Top 25</option>
                  <option value="50">Top 50</option>
                </select>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center justify-between p-3 bg-gray-700 rounded">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-600 rounded-full mr-3"></div>
                        <div>
                          <div className="h-4 bg-gray-600 rounded w-16 mb-1"></div>
                          <div className="h-3 bg-gray-600 rounded w-12"></div>
                        </div>
                      </div>
                      <div>
                        <div className="h-4 bg-gray-600 rounded w-20 mb-1"></div>
                        <div className="h-3 bg-gray-600 rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {marketData.map((currency, index) => (
                    <div key={currency.currency} className="flex items-center justify-between p-3 bg-[#0f1419] rounded-lg hover:bg-gray-800 transition">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3 text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold">{currency.name}</div>
                          <div className="text-sm text-gray-400">{currency.currency}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${currency.priceUSD.toLocaleString()}</div>
                        <div className={`text-sm ${getStatusColor(currency.priceChange24h)}`}>
                          {currency.priceChange24h >= 0 ? '+' : ''}{currency.priceChange24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Market Stats */}
            <div className="bg-[#1a2332] rounded-xl p-6 border border-gray-800">
              <h3 className="text-xl font-bold mb-6">Market Statistics</h3>

              {loading ? (
                <div className="space-y-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded mb-2"></div>
                    <div className="h-8 bg-gray-700 rounded"></div>
                  </div>
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded mb-2"></div>
                    <div className="h-8 bg-gray-700 rounded"></div>
                  </div>
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded mb-2"></div>
                    <div className="h-8 bg-gray-700 rounded"></div>
                  </div>
                </div>
              ) : marketData.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Total Market Cap</div>
                    <div className="text-2xl font-bold">
                      ${marketData.reduce((sum, curr) => sum + (curr.marketCap || 0), 0).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-400 mb-1">24h Total Volume</div>
                    <div className="text-2xl font-bold">
                      ${marketData.reduce((sum, curr) => sum + curr.volume24h, 0).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-400 mb-1">Gainers/Losers</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">
                        ▲ {marketData.filter(c => c.priceChange24h > 0).length} Up
                      </span>
                      <span className="text-red-400">
                        ▼ {marketData.filter(c => c.priceChange24h < 0).length} Down
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-700">
                    <div className="text-xs text-gray-500 text-center">
                      Data updates every 5 minutes
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No statistics available
                </div>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-400">
                  Market Analysis Only
                </h3>
                <div className="mt-2 text-sm text-yellow-300">
                  <p>
                    This page provides market data for analysis and client advisory purposes only.
                    No trading, exchange, or execution services are offered through this platform.
                    All data is for informational purposes and should not be considered financial advice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Focused Bubble Modal */}
      {focusedBubble && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a2332] rounded-xl border border-gray-800 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Market Focus</h3>
              <button
                onClick={closeFocusedBubble}
                className="text-gray-400 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center mb-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mr-4"
                style={{
                  backgroundColor: focusedBubble.bubble.color ? focusedBubble.bubble.color + '20' : '#6366f120',
                  color: focusedBubble.bubble.color || '#6366f1',
                  boxShadow: focusedBubble.bubble.color ? `0 0 30px ${focusedBubble.bubble.color}40` : undefined,
                }}
              >
                {focusedBubble.bubble.symbol}
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">{focusedBubble.bubble.name}</h4>
                <p className="text-gray-400">{focusedBubble.bubble.currency}</p>
              </div>
            </div>

            {focusedBubble.marketData && (
              <div className="space-y-4">
                <div className="bg-[#0f1419] rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Current Price</div>
                  <div className="text-2xl font-bold text-white">
                    ${focusedBubble.marketData.price.toLocaleString()}
                  </div>
                  <div className={`text-sm mt-1 ${focusedBubble.marketData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {focusedBubble.marketData.change24h >= 0 ? '+' : ''}{focusedBubble.marketData.change24h.toFixed(2)}%
                    <span className="text-gray-400 ml-1">({selectedTimeframe})</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0f1419] rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Market Cap</div>
                    <div className="text-lg font-semibold text-white">
                      ${(focusedBubble.marketData.marketCap / 1000000000).toFixed(2)}B
                    </div>
                  </div>
                  <div className="bg-[#0f1419] rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">24h Volume</div>
                    <div className="text-lg font-semibold text-white">
                      ${(focusedBubble.marketData.volume / 1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>

                <div className="bg-[#0f1419] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-400">Consultant Notes</div>
                    {notesLoading && (
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-500 mr-1"></div>
                        Loading...
                      </div>
                    )}
                  </div>
                  <textarea
                    className="w-full bg-transparent border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Add private notes for client discussion..."
                    rows={4}
                    value={consultantNotes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Notes are private to you and automatically saved
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={closeFocusedBubble}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}