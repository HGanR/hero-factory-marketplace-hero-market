"use client";

/**
 * Interior Editor Component
 * Design building interiors with rooms, doors, windows
 *
 * Copied from: /Users/apple/Desktop/3D Model Creation with Image and Audio Upload/InteriorEditor.tsx
 * Adjusted import paths for this repo.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import type { InteriorConfig, Room, Door, Window } from "./parametric-objects";

export function InteriorEditor({
  interior,
  onUpdate,
  buildingDimensions,
}: {
  interior?: InteriorConfig;
  onUpdate?: (interior: InteriorConfig) => void;
  buildingDimensions?: { width: number; height: number; depth: number };
}) {
  const [rooms, setRooms] = useState<Room[]>(interior?.rooms || []);
  const [doors, setDoors] = useState<Door[]>(interior?.doors || []);
  const [windows, setWindows] = useState<Window[]>(interior?.windows || []);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);

  const defaultDimensions = buildingDimensions || { width: 4, height: 6, depth: 3 };

  const addRoom = () => {
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: `Room ${rooms.length + 1}`,
      position: [0, 0, 0],
      dimensions: [2, 2.5, 2],
      material: { color: "#ffffff", metalness: 0, roughness: 0.8 },
    };
    const updated = [...rooms, newRoom];
    setRooms(updated);
    setSelectedRoom(newRoom.id);
    onUpdate?.({ enabled: true, rooms: updated, doors, windows });
  };

  const updateRoom = (id: string, updates: Partial<Room>) => {
    const updated = rooms.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setRooms(updated);
    onUpdate?.({ enabled: true, rooms: updated, doors, windows });
  };

  const deleteRoom = (id: string) => {
    const updated = rooms.filter((r) => r.id !== id);
    setRooms(updated);
    setSelectedRoom(null);
    onUpdate?.({ enabled: true, rooms: updated, doors, windows });
  };

  const addDoor = () => {
    const newDoor: Door = {
      id: `door-${Date.now()}`,
      position: [0, 0, 0],
      width: 0.8,
      height: 2,
      type: "single",
      material: { color: "#8b4513", metalness: 0.3, roughness: 0.5 },
    };
    const updated = [...doors, newDoor];
    setDoors(updated);
    setSelectedDoor(newDoor.id);
    onUpdate?.({ enabled: true, rooms, doors: updated, windows });
  };

  const updateDoor = (id: string, updates: Partial<Door>) => {
    const updated = doors.map((d) => (d.id === id ? { ...d, ...updates } : d));
    setDoors(updated);
    onUpdate?.({ enabled: true, rooms, doors: updated, windows });
  };

  const deleteDoor = (id: string) => {
    const updated = doors.filter((d) => d.id !== id);
    setDoors(updated);
    setSelectedDoor(null);
    onUpdate?.({ enabled: true, rooms, doors: updated, windows });
  };

  const addWindow = () => {
    const newWindow: Window = {
      id: `window-${Date.now()}`,
      position: [0, 1, 0],
      width: 0.8,
      height: 0.8,
      type: "double",
      material: {
        color: "#87ceeb",
        metalness: 0.8,
        roughness: 0.1,
        transparent: true,
        opacity: 0.7,
      },
    };
    const updated = [...windows, newWindow];
    setWindows(updated);
    setSelectedWindow(newWindow.id);
    onUpdate?.({ enabled: true, rooms, doors, windows: updated });
  };

  const updateWindow = (id: string, updates: Partial<Window>) => {
    const updated = windows.map((w) => (w.id === id ? { ...w, ...updates } : w));
    setWindows(updated);
    onUpdate?.({ enabled: true, rooms, doors, windows: updated });
  };

  const deleteWindow = (id: string) => {
    const updated = windows.filter((w) => w.id !== id);
    setWindows(updated);
    setSelectedWindow(null);
    onUpdate?.({ enabled: true, rooms, doors, windows: updated });
  };

  const currentRoom = rooms.find((r) => r.id === selectedRoom);
  const currentDoor = doors.find((d) => d.id === selectedDoor);
  const currentWindow = windows.find((w) => w.id === selectedWindow);

  return (
    <div className="space-y-4">
      <Alert className="border-cyan-700/50 bg-cyan-900/20">
        <AlertCircle className="h-4 w-4 text-cyan-400" />
        <AlertDescription className="text-cyan-300">
          Design building interior with rooms, doors, and windows
        </AlertDescription>
      </Alert>

      <div className="text-[11px] text-slate-400">
        Building envelope: {defaultDimensions.width}W × {defaultDimensions.height}H ×{" "}
        {defaultDimensions.depth}D
      </div>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rooms">Rooms ({rooms.length})</TabsTrigger>
          <TabsTrigger value="doors">Doors ({doors.length})</TabsTrigger>
          <TabsTrigger value="windows">Windows ({windows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-4">
          <Button onClick={addRoom} className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Plus className="h-4 w-4" />
            Add Room
          </Button>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {rooms.map((room) => (
              <Card
                key={room.id}
                className={`cursor-pointer transition ${
                  selectedRoom === room.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
                onClick={() => setSelectedRoom(room.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <Input
                      value={room.name}
                      onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                      className="text-sm flex-1 mr-2"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRoom(room.id);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {selectedRoom === room.id && currentRoom ? (
                    <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
                      <div className="space-y-2">
                        <Label className="text-xs">Position</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["X", "Y", "Z"] as const).map((axis, i) => (
                            <Input
                              key={axis}
                              type="number"
                              value={currentRoom.position[i]}
                              onChange={(e) => {
                                const pos = [...currentRoom.position] as [number, number, number];
                                pos[i] = parseFloat(e.target.value) || 0;
                                updateRoom(currentRoom.id, { position: pos });
                              }}
                              className="text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Dimensions (W × H × D)</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["Width", "Height", "Depth"] as const).map((lbl, i) => (
                            <Input
                              key={lbl}
                              type="number"
                              value={currentRoom.dimensions[i]}
                              onChange={(e) => {
                                const dims = [...currentRoom.dimensions] as [number, number, number];
                                dims[i] = parseFloat(e.target.value) || 1;
                                updateRoom(currentRoom.id, { dimensions: dims });
                              }}
                              className="text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Wall Color</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentRoom.material.color}
                            onChange={(e) =>
                              updateRoom(currentRoom.id, {
                                material: { ...currentRoom.material, color: e.target.value },
                              })
                            }
                            className="w-10 h-8 rounded cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Input
                            value={currentRoom.material.color}
                            onChange={(e) =>
                              updateRoom(currentRoom.id, {
                                material: { ...currentRoom.material, color: e.target.value },
                              })
                            }
                            className="text-xs flex-1"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Roughness</Label>
                        <Slider
                          value={[currentRoom.material.roughness ?? 0.8]}
                          onValueChange={([v]) =>
                            updateRoom(currentRoom.id, {
                              material: { ...currentRoom.material, roughness: v },
                            })
                          }
                          min={0}
                          max={1}
                          step={0.05}
                        />
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="doors" className="space-y-4">
          <Button onClick={addDoor} className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Plus className="h-4 w-4" />
            Add Door
          </Button>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {doors.map((door) => (
              <Card
                key={door.id}
                className={`cursor-pointer transition ${
                  selectedDoor === door.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
                onClick={() => setSelectedDoor(door.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <Select
                      value={door.type}
                      onValueChange={(value: any) => updateDoor(door.id, { type: value })}
                    >
                      <SelectTrigger className="text-xs flex-1 mr-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="double">Double</SelectItem>
                        <SelectItem value="sliding">Sliding</SelectItem>
                        <SelectItem value="glass">Glass</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDoor(door.id);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {selectedDoor === door.id && currentDoor ? (
                    <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
                      <div className="space-y-2">
                        <Label className="text-xs">Position</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["X", "Y", "Z"] as const).map((axis, i) => (
                            <Input
                              key={axis}
                              type="number"
                              value={currentDoor.position[i]}
                              onChange={(e) => {
                                const pos = [...currentDoor.position] as [number, number, number];
                                pos[i] = parseFloat(e.target.value) || 0;
                                updateDoor(currentDoor.id, { position: pos });
                              }}
                              className="text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Size</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-slate-400">Width</Label>
                            <Input
                              type="number"
                              value={currentDoor.width}
                              onChange={(e) =>
                                updateDoor(currentDoor.id, {
                                  width: parseFloat(e.target.value) || 0.8,
                                })
                              }
                              className="text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-400">Height</Label>
                            <Input
                              type="number"
                              value={currentDoor.height}
                              onChange={(e) =>
                                updateDoor(currentDoor.id, {
                                  height: parseFloat(e.target.value) || 2,
                                })
                              }
                              className="text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="windows" className="space-y-4">
          <Button onClick={addWindow} className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Plus className="h-4 w-4" />
            Add Window
          </Button>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {windows.map((window) => (
              <Card
                key={window.id}
                className={`cursor-pointer transition ${
                  selectedWindow === window.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
                onClick={() => setSelectedWindow(window.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Window</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex justify-between items-start mb-2">
                    <Select
                      value={window.type}
                      onValueChange={(value: any) => updateWindow(window.id, { type: value })}
                    >
                      <SelectTrigger className="text-xs flex-1 mr-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="double">Double</SelectItem>
                        <SelectItem value="bay">Bay</SelectItem>
                        <SelectItem value="glass">Glass</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWindow(window.id);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {selectedWindow === window.id && currentWindow ? (
                    <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
                      <div className="space-y-2">
                        <Label className="text-xs">Position</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["X", "Y", "Z"] as const).map((axis, i) => (
                            <Input
                              key={axis}
                              type="number"
                              value={currentWindow.position[i]}
                              onChange={(e) => {
                                const pos = [...currentWindow.position] as [number, number, number];
                                pos[i] = parseFloat(e.target.value) || 0;
                                updateWindow(currentWindow.id, { position: pos });
                              }}
                              className="text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}













