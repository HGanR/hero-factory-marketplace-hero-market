"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { SYMBOL_TO_COINGECKO_ID } from "@/lib/market/symbolMap";

interface CryptoBubble {
  id: string;
  currency: string;
  symbol: string;
  name: string;
  isEnabled: boolean;
  displayOrder: number;
  color?: string;
  icon?: string;
}

const DEFAULT_COINS: Omit<CryptoBubble, 'id'>[] = [
  { currency: 'BTC', symbol: '₿', name: 'Bitcoin', isEnabled: true, displayOrder: 1, color: '#f7931a', icon: 'bitcoin' },
  { currency: 'ETH', symbol: 'Ξ', name: 'Ethereum', isEnabled: true, displayOrder: 2, color: '#627eea', icon: 'ethereum' },
  { currency: 'USDT', symbol: '₮', name: 'Tether', isEnabled: true, displayOrder: 3, color: '#26a17b', icon: 'tether' },
  { currency: 'BNB', symbol: 'BNB', name: 'Binance Coin', isEnabled: true, displayOrder: 4, color: '#f3ba2f', icon: 'binance' },
  { currency: 'SOL', symbol: '◎', name: 'Solana', isEnabled: true, displayOrder: 5, color: '#9945ff', icon: 'solana' },
  { currency: 'ADA', symbol: 'ADA', name: 'Cardano', isEnabled: false, displayOrder: 6, color: '#0033ad', icon: 'cardano' },
  { currency: 'XRP', symbol: '✕', name: 'Ripple', isEnabled: false, displayOrder: 7, color: '#23292f', icon: 'ripple' },
  { currency: 'DOT', symbol: '●', name: 'Polkadot', isEnabled: false, displayOrder: 8, color: '#e6007a', icon: 'polkadot' },
  { currency: 'LINK', symbol: 'LINK', name: 'Chainlink', isEnabled: false, displayOrder: 9, color: '#375bd2', icon: 'chainlink' },
  { currency: 'AVAX', symbol: 'AVAX', name: 'Avalanche', isEnabled: false, displayOrder: 10, color: '#e84142', icon: 'avalanche' },
];

// Popular coins that can be added via dropdown
const POPULAR_COINS = [
  { currency: 'DOGE', symbol: 'Ð', name: 'Dogecoin', color: '#c2a633' },
  { currency: 'SHIB', symbol: 'SHIB', name: 'Shiba Inu', color: '#f84c4c' },
  { currency: 'LTC', symbol: 'Ł', name: 'Litecoin', color: '#345d9d' },
  { currency: 'TRX', symbol: 'TRX', name: 'TRON', color: '#ff060a' },
  { currency: 'MATIC', symbol: 'MATIC', name: 'Polygon', color: '#8247e5' },
  { currency: 'UNI', symbol: 'UNI', name: 'Uniswap', color: '#ff007a' },
  { currency: 'AAVE', symbol: 'AAVE', name: 'Aave', color: '#b6509e' },
  { currency: 'SUSHI', symbol: 'SUSHI', name: 'SushiSwap', color: '#fa52a0' },
  { currency: 'COMP', symbol: 'COMP', name: 'Compound', color: '#00d395' },
  { currency: 'MKR', symbol: 'MKR', name: 'Maker', color: '#1aab9b' },
  { currency: 'YFI', symbol: 'YFI', name: 'Yearn Finance', color: '#0074fa' },
  { currency: 'BAL', symbol: 'BAL', name: 'Balancer', color: '#1e1e1e' },
  { currency: 'CRV', symbol: 'CRV', name: 'Curve DAO Token', color: '#40649f' },
  { currency: 'REN', symbol: 'REN', name: 'Ren', color: '#080817' },
  { currency: 'OMG', symbol: 'OMG', name: 'OMG Network', color: '#101010' },
];

export default function CryptoWindowAdminPage() {
  const router = useRouter();
  const [cryptoBubbles, setCryptoBubbles] = useState<CryptoBubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedPopularCoin, setSelectedPopularCoin] = useState("");

  // Check for unmapped symbols
  const getUnmappedSymbols = () => {
    const enabledBubbles = cryptoBubbles.filter(b => b.isEnabled);
    return enabledBubbles.filter(bubble => !SYMBOL_TO_COINGECKO_ID[bubble.currency]);
  };

  const unmappedSymbols = getUnmappedSymbols();

  useEffect(() => {
    fetchCryptoBubbles();
  }, []);

  const fetchCryptoBubbles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/crypto-bubbles');
      const data = await response.json();

      if (response.ok) {
        if (data.bubbles.length === 0) {
          // Initialize with defaults if no bubbles exist
          await initializeDefaults();
        } else {
          setCryptoBubbles(data.bubbles);
        }
      } else {
        setError(data.error || 'Failed to fetch crypto bubbles');
      }
    } catch (err) {
      console.error('Error fetching crypto bubbles:', err);
      setError('Failed to load crypto bubble settings');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      const response = await fetch('/api/admin/crypto-bubbles/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bubbles: DEFAULT_COINS }),
      });

      if (response.ok) {
        await fetchCryptoBubbles(); // Reload after initialization
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to initialize defaults');
      }
    } catch (err) {
      console.error('Error initializing defaults:', err);
      setError('Failed to initialize default settings');
    }
  };

  const updateBubble = async (id: string, updates: Partial<CryptoBubble>) => {
    try {
      const response = await fetch('/api/admin/crypto-bubbles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update bubble');
        return false;
      }

      // Check if the update was persisted to database
      if (data.persisted === false) {
        setError('Update saved locally but not persisted to database. Changes may not be visible to other users.');
        // Still update local state for immediate feedback
      }

      // Update local state
      setCryptoBubbles(prev =>
        prev.map(bubble =>
          bubble.id === id ? { ...bubble, ...updates } : bubble
        )
      );
      return true;
    } catch (err) {
      console.error('Error updating bubble:', err);
      setError('Failed to update bubble');
      return false;
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(cryptoBubbles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update displayOrder for all items
    const updatedItems = items.map((item, index) => ({
      ...item,
      displayOrder: index + 1,
    }));

    setCryptoBubbles(updatedItems);

    // Save order changes
    try {
      for (const item of updatedItems) {
        await updateBubble(item.id, { displayOrder: item.displayOrder });
      }
    } catch (err) {
      console.error('Error saving order:', err);
      setError('Failed to save new order');
    }
  };

  const toggleEnabled = async (id: string, isEnabled: boolean) => {
    const success = await updateBubble(id, { isEnabled });
    if (success) {
      // Force refresh to ensure UI shows current state
      setTimeout(() => fetchCryptoBubbles(), 500);
    }
  };

  const updateColor = async (id: string, color: string) => {
    await updateBubble(id, { color });
  };

  const addPopularCoin = async () => {
    if (!selectedPopularCoin) return;

    const coinData = POPULAR_COINS.find(coin => coin.currency === selectedPopularCoin);
    if (!coinData) return;

    // Check if coin already exists
    const existingCoin = cryptoBubbles.find(bubble => bubble.currency === coinData.currency);
    if (existingCoin) {
      setError('This coin is already added');
      return;
    }

    const newBubble = {
      currency: coinData.currency,
      symbol: coinData.symbol,
      name: coinData.name,
      isEnabled: true,
      displayOrder: cryptoBubbles.length + 1,
      color: coinData.color,
    };

    try {
      console.log('Adding coin:', newBubble);
      const response = await fetch('/api/admin/crypto-bubbles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBubble),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        console.log('Coin added successfully');
        await fetchCryptoBubbles(); // Reload to get new bubble with ID
        setSelectedPopularCoin(""); // Reset selection
      } else {
        console.error('Failed to add coin:', data);
        setError(data.error || 'Failed to add coin');
      }
    } catch (err) {
      console.error('Error adding coin:', err);
      setError('Failed to add coin');
    }
  };

  const addNewBubble = async () => {
    const currency = prompt('Enter currency code (e.g., BTC):');
    if (!currency) return;

    const symbol = prompt('Enter currency symbol (e.g., ₿):');
    if (!symbol) return;

    const name = prompt('Enter currency name (e.g., Bitcoin):');
    if (!name) return;

    const newBubble = {
      currency: currency.toUpperCase(),
      symbol,
      name,
      isEnabled: true,
      displayOrder: cryptoBubbles.length + 1,
      color: '#6366f1',
    };

    try {
      const response = await fetch('/api/admin/crypto-bubbles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBubble),
      });

      if (response.ok) {
        await fetchCryptoBubbles(); // Reload to get new bubble with ID
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add new bubble');
      }
    } catch (err) {
      console.error('Error adding bubble:', err);
      setError('Failed to add new bubble');
    }
  };

  const deleteBubble = async (id: string) => {
    if (!confirm('Are you sure you want to delete this crypto bubble?')) return;

    try {
      const response = await fetch(`/api/admin/crypto-bubbles?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setCryptoBubbles(prev => prev.filter(bubble => bubble.id !== id));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete bubble');
      }
    } catch (err) {
      console.error('Error deleting bubble:', err);
      setError('Failed to delete bubble');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading crypto bubble settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/30">
        <h1 className="text-xl font-bold text-white">Crypto Window Admin</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin")}
            className="text-slate-400 hover:text-white"
          >
            Back to Admin
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-slate-400 hover:text-white"
          >
            Dashboard
          </button>
        </div>
      </nav>

      <main className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Crypto Bubble Display Settings</h2>
            <p className="text-slate-400">
              Configure which cryptocurrencies appear in the bubble display. Drag to reorder, toggle to enable/disable.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400">
              {error}
              <button
                onClick={() => setError("")}
                className="ml-2 text-red-300 hover:text-red-100"
              >
                ×
              </button>
            </div>
          )}

          {unmappedSymbols.length > 0 && (
            <div className="mb-4 p-4 bg-amber-500/20 border border-amber-500 rounded">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Unmapped Symbols Detected
                  </h3>
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    <p>The following enabled coins don't have CoinGecko mappings and won't display in the market view:</p>
                    <ul className="mt-1 list-disc list-inside">
                      {unmappedSymbols.map(symbol => (
                        <li key={symbol.currency} className="font-mono">
                          {symbol.currency} ({symbol.name})
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      Add mappings to <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">src/lib/market/symbolMap.ts</code> or contact development.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-black/50 rounded-lg border border-cyan-500/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Bubble Configuration</h3>
              <div className="flex items-center gap-3">
                {/* Popular Coins Dropdown */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPopularCoin}
                    onChange={(e) => setSelectedPopularCoin(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  >
                    <option value="">Select Popular Coin...</option>
                    {POPULAR_COINS.filter(coin =>
                      !cryptoBubbles.some(bubble => bubble.currency === coin.currency)
                    ).map(coin => (
                      <option key={coin.currency} value={coin.currency}>
                        {coin.symbol} {coin.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addPopularCoin}
                    disabled={!selectedPopularCoin}
                    className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed text-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Custom Coin Button */}
                <button
                  onClick={addNewBubble}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors text-sm"
                  title="Add a custom coin not in the popular list"
                >
                  Custom Coin
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400 mb-6">
              Use the dropdown to quickly add popular coins, or "Custom Coin" for coins not in the list.
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="crypto-bubbles">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {cryptoBubbles
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((bubble, index) => (
                        <Draggable key={bubble.id} draggableId={bubble.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                                snapshot.isDragging
                                  ? 'bg-cyan-500/20 border-cyan-400 shadow-lg'
                                  : bubble.isEnabled
                                    ? 'bg-slate-800/50 border-slate-700'
                                    : 'bg-slate-900/50 border-slate-800 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className="text-slate-400 cursor-move">⋮⋮</div>

                                <div
                                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                                  style={{ backgroundColor: bubble.color + '20', color: bubble.color }}
                                >
                                  {bubble.symbol}
                                </div>

                                <div>
                                  <div className="text-white font-semibold">{bubble.name}</div>
                                  <div className="text-slate-400 text-sm">{bubble.currency}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <label className="text-sm text-slate-400">Color:</label>
                                  <input
                                    type="color"
                                    value={bubble.color || '#6366f1'}
                                    onChange={(e) => updateColor(bubble.id, e.target.value)}
                                    className="w-8 h-8 rounded border border-slate-600"
                                  />
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={bubble.isEnabled}
                                    onChange={(e) => toggleEnabled(bubble.id, !bubble.isEnabled)}
                                    className="rounded border-slate-600"
                                  />
                                  <span className="text-sm text-slate-300">Enabled</span>
                                </label>

                                <button
                                  onClick={() => deleteBubble(bubble.id)}
                                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          <div className="mt-6 bg-black/50 rounded-lg border border-cyan-500/30 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Preview</h3>
            <p className="text-slate-400 mb-4">
              Enabled coins that will appear in the bubble display:
            </p>
            <div className="flex flex-wrap gap-3">
                    {cryptoBubbles
                      .filter(bubble => bubble.isEnabled)
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .slice(0, 15) // Show first 15 for preview
                      .map((bubble) => (
                  <div
                    key={bubble.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border"
                    style={{ borderColor: bubble.color, backgroundColor: bubble.color + '10' }}
                  >
                    <span style={{ color: bubble.color }}>{bubble.symbol}</span>
                    <span className="text-white text-sm">{bubble.currency}</span>
                  </div>
                ))}
              {cryptoBubbles.filter(bubble => bubble.isEnabled).length > 15 && (
                <div className="flex items-center px-3 py-2 text-slate-400 text-sm">
                  +{cryptoBubbles.filter(bubble => bubble.isEnabled).length - 15} more
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}