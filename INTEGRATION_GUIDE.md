# Enhanced Building Components Integration Guide

This guide shows how to integrate the new Stairs, Floors, and Wall Demolition features into your Oasis page.

## ✅ Completed Steps

1. **Created Component Library** (`components/EnhancedBuildingComponents.tsx`)
   - Stairs component with configurable steps
   - Floor component with material types
   - EditableCube with wall demolition
   - UI Configurators (StairsConfigurator, FloorConfigurator, WallDemolitionControls)

2. **Created Draggable Panel System** (`components/DraggableOasisControls.tsx`)
   - DraggableOasisControls component with smooth dragging
   - EnhancedBuildingTools component for organized UI
   - Visual feedback during dragging
   - Boundary constraints to keep panel in viewport

3. **Added Imports** to `pages/oasis.tsx` (line 10-19)
   ```typescript
   import { 
     Stairs as EnhancedStairs, 
     Floor as EnhancedFloor, 
     EditableCube, 
     WallDemolitionControls, 
     StairsConfigurator, 
     FloorConfigurator,
     StairsConfig,
     FloorConfig
   } from '@/components/EnhancedBuildingComponents';
   import { DraggableOasisControls, EnhancedBuildingTools } from '@/components/DraggableOasisControls';
   ```

3. **Added State Variables** (lines 3593-3601)
   ```typescript
   // Enhanced building components state
   const [enhancedStairs, setEnhancedStairs] = useState<any[]>([]);
   const [floors, setFloors] = useState<any[]>([]);
   const [editableCubes, setEditableCubes] = useState<any[]>([]);
   const [selectedStairs, setSelectedStairs] = useState<number | null>(null);
   const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
   const [showStairsConfigurator, setShowStairsConfigurator] = useState(false);
   const [showFloorConfigurator, setShowFloorConfigurator] = useState(false);
   const [showWallDemolition, setShowWallDemolition] = useState(false);
   ```

4. **Updated Cube Initialization** with wall properties (lines 3615-3676)
   - Added `walls: { front: true, back: true, left: true, right: true }`
   - Added `hasCeiling: true`
   - Added `hasFloor: true`

5. **Added Event Handlers** (lines 4116-4192)
   - `handleAddStairs(config)` - Adds stairs for 10 TROO
   - `handleAddFloor(config)` - Adds floor for 10 TROO
   - `handleToggleWall(cubeId, wall)` - Toggles individual walls
   - `handleToggleCeiling(cubeId)` - Toggles ceiling
   - `handleToggleFloor(cubeId)` - Toggles floor
   - `handleRemoveStairs(stairsId)` - Removes stairs for 5 TROO
   - `handleRemoveFloor(floorId)` - Removes floor for 5 TROO

## 🔧 Remaining Steps

### Step 1: Add UI Controls to Control Panel

Find the Oasis Controls section (search for "Oasis Controls" or look for the control panel div) and add these buttons:

```typescript
{/* Enhanced Building Tools */}
<div className="mb-4">
  <h4 className="text-sm font-medium mb-2">🏗️ Enhanced Building</h4>
  <div className="space-y-2">
    <button
      onClick={() => setShowStairsConfigurator(!showStairsConfigurator)}
      className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition-all"
    >
      🪜 Add Stairs (10 TROO)
    </button>
    <button
      onClick={() => setShowFloorConfigurator(!showFloorConfigurator)}
      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold transition-all"
    >
      🏗️ Add Floor (10 TROO)
    </button>
    {selectedCube && (
      <button
        onClick={() => setShowWallDemolition(!showWallDemolition)}
        className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold transition-all"
      >
        🔨 Wall Demolition
      </button>
    )}
  </div>
</div>

{/* Stairs Configurator */}
{showStairsConfigurator && (
  <div className="mb-4">
    <StairsConfigurator onAdd={handleAddStairs} />
  </div>
)}

{/* Floor Configurator */}
{showFloorConfigurator && (
  <div className="mb-4">
    <FloorConfigurator onAdd={handleAddFloor} />
  </div>
)}

{/* Wall Demolition Controls */}
{showWallDemolition && selectedCube && (
  <div className="mb-4">
    <WallDemolitionControls
      cubeId={selectedCube}
      walls={cubes.find(c => c.id === selectedCube)?.walls || { front: true, back: true, left: true, right: true }}
      hasCeiling={cubes.find(c => c.id === selectedCube)?.hasCeiling || true}
      hasFloor={cubes.find(c => c.id === selectedCube)?.hasFloor || true}
      onToggleWall={handleToggleWall}
      onToggleCeiling={handleToggleCeiling}
      onToggleFloor={handleToggleFloor}
    />
  </div>
)}
```

### Step 2: Render Components in 3D Canvas

Find where the cubes are mapped and rendered in the Canvas (look for `cubes.map((cube) =>` or similar). Add these new component renderers nearby:

```typescript
{/* Enhanced Stairs */}
{enhancedStairs.map((stair) => (
  <EnhancedStairs
    key={stair.id}
    position={stair.position}
    steps={stair.steps}
    stepWidth={stair.stepWidth}
    stepHeight={stair.stepHeight}
    stepDepth={stair.stepDepth}
    color={stair.color}
    rotation={stair.rotation}
    isSelected={selectedStairs === stair.id}
    onSelect={() => setSelectedStairs(selectedStairs === stair.id ? null : stair.id)}
  />
))}

{/* Enhanced Floors */}
{floors.map((floor) => (
  <EnhancedFloor
    key={floor.id}
    position={floor.position}
    width={floor.width}
    depth={floor.depth}
    color={floor.color}
    material={floor.material}
    isSelected={selectedFloor === floor.id}
    onSelect={() => setSelectedFloor(selectedFloor === floor.id ? null : floor.id)}
    label={`Floor (${floor.material})`}
  />
))}
```

### Step 3: Update Existing Cube Rendering (OPTIONAL)

If you want to use the new EditableCube component instead of the existing InteractiveCube, replace the cube rendering with:

```typescript
{cubes.map((cube) => (
  <EditableCube
    key={cube.id}
    position={cube.position}
    size={cube.size}
    color={cube.color}
    material={cube.material}
    walls={cube.walls}
    hasCeiling={cube.hasCeiling}
    hasFloor={cube.hasFloor}
    isSelected={selectedCube === cube.id}
    onSelect={() => setSelectedCube(selectedCube === cube.id ? null : cube.id)}
    label={cube.label}
  />
))}
```

### Step 4: Add Keyboard Controls for Moving Stairs and Floors

Find the keyboard event handler (search for `useEffect` with keyboard events) and add:

```typescript
case 'Delete':
case 'Backspace':
  if (selectedStairs !== null) {
    handleRemoveStairs(selectedStairs);
  } else if (selectedFloor !== null) {
    handleRemoveFloor(selectedFloor);
  }
  break;
```

### Step 5: Update Movement System

Update the `moveSelectedObject` function to handle stairs and floors. Add these cases:

```typescript
case 'stairs':
  currentObject = enhancedStairs.find(s => s.id === selectedObject.id);
  if (currentObject) {
    currentPosition = currentObject.position;
    updateFunction = (id, updates) => setEnhancedStairs(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }
  break;

case 'floor':
  currentObject = floors.find(f => f.id === selectedObject.id);
  if (currentObject) {
    currentPosition = currentObject.position;
    updateFunction = (id, updates) => setFloors(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }
  break;
```

## 📝 Features Summary

### Stairs
- **Cost**: 10 TROO to add, 5 TROO to remove
- **Configurable**: Steps (3-20), Width (1-5m), Rotation (0°, 90°, 180°, 270°), Color
- **Movable**: Select and move with WASD/Arrow keys
- **Removable**: Select and press Delete

### Floors
- **Cost**: 10 TROO to add, 5 TROO to remove
- **Configurable**: Width (2-20m), Depth (2-20m), Material (wood, tile, carpet, concrete), Color
- **Movable**: Select and move with WASD/Arrow keys
- **Removable**: Select and press Delete

### Wall Demolition
- **Per Cube**: Toggle individual walls (front, back, left, right)
- **Structure Control**: Toggle ceiling and floor visibility
- **Visual Feedback**: Green = Visible, Red = Demolished
- **Real-time Updates**: Changes apply immediately

## 🎮 Usage Instructions

1. **Add Stairs**: Click "Add Stairs" button, configure settings, click "Add Stairs (10 TROO)"
2. **Add Floor**: Click "Add Floor" button, configure settings, click "Add Floor (10 TROO)"
3. **Demolish Walls**: Select a cube, click "Wall Demolition", toggle walls/ceiling/floor
4. **Move Objects**: Select stairs/floor, use WASD/Arrow keys to move
5. **Remove Objects**: Select stairs/floor, press Delete key

## 🐛 Troubleshooting

If components don't render:
1. Check that imports are correct
2. Verify state variables are initialized
3. Ensure handlers are defined before JSX
4. Check that components are inside the `<Canvas>` component
5. Verify `@react-three/drei` is installed

## 📦 Dependencies

Make sure these are installed:
- `@react-three/fiber`
- `@react-three/drei`
- `three`
- `react`

All dependencies should already be in your project.

