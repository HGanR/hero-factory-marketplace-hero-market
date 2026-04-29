# Fixes and Integration Summary

## Critical Errors to Fix

### 1. musicUrl Undefined Error (Line 84)

**Location**: `hero-market/pages/oasis.tsx`

**Problem**: When rendering `InteractiveSpace`, the `musicUrl` prop may not be passed, causing it to be undefined.

**Search for**: When `<InteractiveSpace>` is rendered in JSX (around line 6000+)

**Solution**: Ensure all `InteractiveSpace` calls include:
```tsx
<InteractiveSpace
  // ... other props
  musicUrl={space.musicUrl || ''}
  musicName={space.musicName || ''}
  // ... rest of props
/>
```

### 2. handleCopyCube Not Defined Error (Line 5875)

**Location**: `hero-market/pages/oasis.tsx` around line 5875

**Problem**: Code references `handleCopyCube` but function was renamed to `handleCopySpace`.

**Solution**: Find and replace:
- Search for: `onCopyCube={handleCopyCube}`
- Replace with: `onCopyCube={handleCopySpace}`

And also find:
- Search for: `copiedCube={copiedCube}`
- Replace with: `copiedSpace={copiedSpace}`

## Asset Library Integration

### Step 1: Import the Components

Add to the top of `hero-market/pages/oasis.tsx`:

```tsx
import { AssetBrowser, AssetLibraryButton } from '@/components/AssetLibrary';
import { AssetPlacementManager } from '@/lib/assetLibrary';
```

### Step 2: Add State Variables

Add these state variables after the existing state declarations:

```tsx
const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
const placementManagerRef = useRef<AssetPlacementManager | null>(null);
```

### Step 3: Initialize Asset Placement Manager

Find the main `useEffect` that initializes the scene (around line 100+) and add:

```tsx
useEffect(() => {
  // ... existing scene initialization code ...
  
  // Initialize asset placement manager
  if (sceneRef.current) {
    placementManagerRef.current = new AssetPlacementManager(sceneRef.current, assetManager);
  }
  
  // ... rest of initialization
}, []);
```

### Step 4: Add Asset Selection Handler

Add this function to handle asset placement:

```tsx
const handleAssetSelect = async (assetId: string) => {
  if (!placementManagerRef.current || !isAuthenticated) {
    alert('Please connect your wallet to place assets');
    return;
  }

  try {
    // Place asset at random position on ground
    const x = (Math.random() - 0.5) * 20;
    const z = (Math.random() - 0.5) * 20;
    const y = 0; // On ground level

    await placementManagerRef.current.placeAsset(
      assetId,
      [x, y, z],
      [0, Math.random() * Math.PI * 2, 0],
      [1, 1, 1]
    );

    console.log('Asset placed successfully');
    
    // Optionally save world after placing asset
    // handleSaveWorld();
  } catch (error) {
    console.error('Failed to place asset:', error);
    alert('Failed to place asset. Make sure you have enough TROO tokens.');
  }
};
```

### Step 5: Add UI Components to JSX

Find the main return statement in the Oasis component (around line 6200+) and add before the closing tags:

```tsx
{/* Asset Library Button - positioned bottom right */}
<AssetLibraryButton onClick={() => setIsAssetLibraryOpen(true)} />

{/* Asset Browser Modal */}
<AssetBrowser
  isOpen={isAssetLibraryOpen}
  onClose={() => setIsAssetLibraryOpen(false)}
  onAssetSelect={handleAssetSelect}
/>
```

### Step 6: Save World After Asset Placement

Modify the `handleAssetSelect` function to also save the world data:

```tsx
const handleAssetSelect = async (assetId: string) => {
  // ... existing placement code ...

  // After successful placement
  if (placementManagerRef.current) {
    // Get all placed assets
    const placedAssets = placementManagerRef.current.getAllPlacedAssets();
    
    // Save to your world state or localStorage
    const worldData = {
      // ... existing world data ...
      placedAssets: placedAssets,
      updatedAt: Date.now()
    };
    
    // Save using your existing save function
    localStorage.setItem('oasis_current_world', JSON.stringify(worldData));
  }
};
```

## Quick Fix Script

If you want to quickly fix the handleCopyCube error:

```bash
cd hero-market/pages
sed -i '' 's/onCopyCube={handleCopyCube}/onCopyCube={handleCopySpace}/g' oasis.tsx
sed -i '' 's/copiedCube={copiedCube}/copiedSpace={copiedSpace}/g' oasis.tsx
```

## Verification

After making these changes:

1. Build the project: `npm run build`
2. Check for errors in the console
3. Test the asset library button
4. Try placing an asset
5. Verify the asset appears in the scene

## Need Help?

If you encounter errors:
1. Check browser console for specific error messages
2. Verify all imports are correct
3. Make sure `assetLibrary.ts` has the correct exports
4. Check that TROO payment hook is properly configured

## File Status

- ✅ `hero-market/components/AssetLibrary.tsx` - Created
- ✅ `hero-market/lib/assetLibrary.ts` - Already exists
- ⏳ `hero-market/pages/oasis.tsx` - Needs integration (you need to make the changes)













