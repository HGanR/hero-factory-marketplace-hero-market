# Quick Start Code Snippets

Copy and paste these code blocks into your `pages/oasis.tsx` file.

## 1. Draggable Oasis Controls Panel (Replace your existing control panel)

Replace your existing Oasis Controls panel with this draggable version:

```typescript
{/* Draggable Oasis Controls Panel */}
<DraggableOasisControls
  isOpen={showOasisControls}
  onClose={() => setShowOasisControls(false)}
  position={oasisControlsPosition}
  isDragging={isDraggingOasisControls}
  onMouseDown={handleOasisControlsMouseDown}
>
  <EnhancedBuildingTools
    onToggleStairsConfigurator={() => setShowStairsConfigurator(!showStairsConfigurator)}
    onToggleFloorConfigurator={() => setShowFloorConfigurator(!showFloorConfigurator)}
    onToggleWallDemolition={() => setShowWallDemolition(!showWallDemolition)}
    selectedCube={selectedCube}
    showStairsConfigurator={showStairsConfigurator}
    showFloorConfigurator={showFloorConfigurator}
    showWallDemolition={showWallDemolition}
  />

  {/* Stairs Configurator Panel */}
  {showStairsConfigurator && (
    <div className="mb-4">
      <StairsConfigurator onAdd={handleAddStairs} />
    </div>
  )}

  {/* Floor Configurator Panel */}
  {showFloorConfigurator && (
    <div className="mb-4">
      <FloorConfigurator onAdd={handleAddFloor} />
    </div>
  )}

  {/* Wall Demolition Controls Panel */}
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
</DraggableOasisControls>
```

## 2. 3D Component Rendering (Add inside Canvas)

Find where your cubes are rendered in the `<Canvas>` component and add this code nearby:

```typescript
{/* Enhanced Stairs - Render all stairs */}
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

{/* Enhanced Floors - Render all floors */}
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

## 3. Keyboard Controls (OPTIONAL - Add to your keyboard event handler)

If you want to be able to delete stairs and floors with the Delete key, add this to your keyboard event handler:

```typescript
// In your useEffect with keyboard events, add this case:
case 'Delete':
case 'Backspace':
  if (selectedStairs !== null) {
    handleRemoveStairs(selectedStairs);
  } else if (selectedFloor !== null) {
    handleRemoveFloor(selectedFloor);
  }
  break;
```

## 4. Movement System (OPTIONAL - Add to moveSelectedObject function)

If you want to be able to move stairs and floors with WASD keys, add these cases to your `moveSelectedObject` function:

```typescript
case 'stairs':
  currentObject = enhancedStairs.find(s => s.id === selectedObject.id);
  if (currentObject) {
    currentPosition = currentObject.position;
    updateFunction = (id, updates) => setEnhancedStairs(prev => 
      prev.map(s => s.id === id ? { ...s, ...updates } : s)
    );
  }
  break;

case 'floor':
  currentObject = floors.find(f => f.id === selectedObject.id);
  if (currentObject) {
    currentPosition = currentObject.position;
    updateFunction = (id, updates) => setFloors(prev => 
      prev.map(f => f.id === id ? { ...f, ...updates } : f)
    );
  }
  break;
```

## Testing Checklist

After adding the code above, test these features:

### Draggable Panel
- [ ] Click to open Oasis Controls - panel appears
- [ ] Drag panel by header - panel moves smoothly
- [ ] Panel stays within viewport bounds
- [ ] Visual feedback during dragging (scale, shadow, cursor)
- [ ] Close button works - panel disappears

### Building Features
- [ ] Click "Add Stairs" button - configurator appears
- [ ] Configure stairs settings - sliders work
- [ ] Click "Add Stairs (10 TROO)" - stairs appear in world, TROO deducts
- [ ] Click "Add Floor" button - configurator appears  
- [ ] Configure floor settings - sliders work
- [ ] Click "Add Floor (10 TROO)" - floor appears in world, TROO deducts
- [ ] Select a cube - "Wall Demolition" button appears
- [ ] Click "Wall Demolition" - control panel appears
- [ ] Toggle walls - walls disappear/reappear immediately
- [ ] Toggle ceiling - ceiling disappears/reappears immediately
- [ ] Toggle floor - floor disappears/reappears immediately
- [ ] Select stairs - can move with WASD (if movement system added)
- [ ] Select floor - can move with WASD (if movement system added)
- [ ] Press Delete on selected stairs - removes for 5 TROO (if keyboard controls added)
- [ ] Press Delete on selected floor - removes for 5 TROO (if keyboard controls added)

## Need More Help?

See `INTEGRATION_GUIDE.md` for detailed explanations and troubleshooting.
