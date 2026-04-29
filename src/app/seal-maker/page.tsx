"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";

// Simplified ERC20 ABI for direct token transfers
const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Payment configuration (Polygon only; Solana version in OLDSITE requires a different wallet stack)
const PAYMENT_CONFIG = {
  chainId: 137,
  tokenAddress: "0xa7927231898293377Ce676CFC9bbD551Cb845695" as `0x${string}`,
  recipientAddress: "0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF" as `0x${string}`,
  tokenSymbol: "TROO",
  networkName: "Polygon",
} as const;

const PAYMENT_AMOUNT = 60;

type ElementType = "text" | "arcText" | "circle" | "ring";

type Element = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  radius?: number;
  thickness?: number;
  rotation?: number;
  letterSpacing?: number;
  startAngle?: number;
  flipText?: boolean;
  bold?: boolean;
};

export default function SealMakerPage() {
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [plateSize, setPlateSize] = useState(160);
  const [plateShape, setPlateShape] = useState<"circle" | "square" | "triangle">("circle");
  const [selectedColor, setSelectedColor] = useState("#00D1FF");
  const [exportFormats, setExportFormats] = useState({ png: true, svg: true, jpg: true });
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  const stageRef = useRef<any>(null);

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const { writeContract: transferTokens, data: transferHash, isPending: isTransferPending } =
    useWriteContract();

  const { data: tokenBalance } = useReadContract({
    address: PAYMENT_CONFIG.tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: PAYMENT_CONFIG.chainId,
  });

  const { data: tokenDecimals } = useReadContract({
    address: PAYMENT_CONFIG.tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: PAYMENT_CONFIG.chainId,
  });

  const { isLoading: isTransferring, isSuccess: transferSuccess } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  useEffect(() => {
    if (transferSuccess) setPaymentCompleted(true);
  }, [transferSuccess]);

  useEffect(() => {
    // Konva relies on browser-only APIs. Rendering the Stage only after mount
    // prevents occasional hydration/mount issues where shapes don't appear.
    setCanvasReady(true);
  }, []);

  const decimalsNum = useMemo(() => {
    if (typeof tokenDecimals === "number") return tokenDecimals;
    if (typeof tokenDecimals === "bigint") return Number(tokenDecimals);
    return 18;
  }, [tokenDecimals]);

  const selectedEl = elements.find((el) => el.id === selectedElement);

  const handleWalletConnect = () => {
    const connector = connectors.find((c) => {
      const name = c.name.toLowerCase();
      return name.includes("metamask") || name.includes("injected");
    });
    if (connector) {
      connect({ connector });
      setShowWalletSelector(false);
    } else {
      alert("MetaMask wallet not found. Please install it first.");
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    e.evt.stopPropagation();
  };

  const generateElementId = () => `elem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const addElement = (type: ElementType) => {
    const newElement: Element = {
      id: generateElementId(),
      type,
      x: 260,
      y: 260,
      fill: selectedColor,
      fontSize: 28,
      fontFamily: "Arial",
      letterSpacing: 0,
      rotation: 0,
      bold: false,
      ...(type === "text" || type === "arcText" ? { text: "ADD TEXT HERE" } : {}),
      ...(type === "arcText" ? { startAngle: 0, flipText: false } : {}),
      ...(type === "circle" ? { radius: 50 } : {}),
      ...(type === "ring" ? { radius: 80, thickness: 2 } : {}),
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const updateElement = (id: string, updates: Partial<Element>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const deleteElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedElement(null);
  };

  const renderArcText = (element: Element) => {
    if (!element.text) return null;

    const chars = element.text.split("");
    const radius = plateSize - 20;
    const totalChars = chars.length;
    const baseCharWidth = (element.fontSize || 28) * 0.6;
    const charSpacing = element.letterSpacing || 0;
    const totalTextWidth = totalChars * baseCharWidth + (totalChars - 1) * charSpacing;
    const circumference = 2 * Math.PI * radius;
    const arcLength = Math.min(totalTextWidth, circumference * 0.8);
    const anglePerChar = (arcLength / circumference) * 360 / totalChars;
    const totalAngle = anglePerChar * (totalChars - 1);

    let startAngle = (element.startAngle || 0) - totalAngle / 2;
    if (element.flipText) startAngle = startAngle + 180;

    return (
      <Group key={element.id} x={element.x} y={element.y}>
        {chars.map((char, index) => {
          const angle = startAngle + index * anglePerChar;
          const radian = (angle * Math.PI) / 180;
          const charX = Math.cos(radian) * radius;
          const charY = Math.sin(radian) * radius;

          let textRotation = angle;
          if (textRotation > 90 && textRotation < 270) textRotation += 180;
          while (textRotation >= 360) textRotation -= 360;
          while (textRotation < 0) textRotation += 360;

          return (
            <Text
              key={index}
              x={charX}
              y={charY}
              text={char}
              fontSize={element.fontSize}
              fontFamily={element.fontFamily}
              fill={element.fill}
              fontStyle={element.bold ? "bold" : "normal"}
              rotation={textRotation}
              offsetX={(element.fontSize || 28) / 4}
              offsetY={(element.fontSize || 28) / 2}
              onClick={() => setSelectedElement(element.id)}
            />
          );
        })}
      </Group>
    );
  };

  const renderPlateShape = () => {
    const centerX = 260;
    const centerY = 260;
    switch (plateShape) {
      case "circle":
        return (
          <Circle
            x={centerX}
            y={centerY}
            radius={plateSize}
            stroke={selectedColor}
            strokeWidth={2}
            fill="transparent"
          />
        );
      case "square":
        return (
          <Rect
            x={centerX - plateSize}
            y={centerY - plateSize}
            width={plateSize * 2}
            height={plateSize * 2}
            stroke={selectedColor}
            strokeWidth={2}
            fill="transparent"
          />
        );
      case "triangle": {
        const height = plateSize * Math.sqrt(3);
        return (
          <Line
            points={[
              centerX,
              centerY - height * 0.6,
              centerX - plateSize,
              centerY + height * 0.4,
              centerX + plateSize,
              centerY + height * 0.4,
              centerX,
              centerY - height * 0.6,
            ]}
            stroke={selectedColor}
            strokeWidth={2}
            fill="transparent"
            closed
          />
        );
      }
      default:
        return null;
    }
  };

  const handlePayment = async () => {
    if (!address || !isConnected) {
      setShowWalletSelector(true);
      return;
    }

    if (chain?.id !== PAYMENT_CONFIG.chainId) {
      try {
        await switchChain({ chainId: PAYMENT_CONFIG.chainId });
      } catch {
        alert(`Please switch to ${PAYMENT_CONFIG.networkName} network in your wallet`);
        return;
      }
    }

    try {
      const amount = parseUnits(PAYMENT_AMOUNT.toString(), decimalsNum);
      const bal = typeof tokenBalance === "bigint" ? tokenBalance : 0n;
      if (bal < amount) {
        alert(
          `Insufficient ${PAYMENT_CONFIG.tokenSymbol} balance. You need ${PAYMENT_AMOUNT} ${PAYMENT_CONFIG.tokenSymbol}`
        );
        return;
      }

      await transferTokens({
        address: PAYMENT_CONFIG.tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [PAYMENT_CONFIG.recipientAddress, amount],
      });
    } catch (error) {
      console.error("Payment failed:", error);
      alert("Payment failed. Please try again.");
    }
  };

  const handleDownload = () => {
    if (!paymentCompleted) {
      alert("Please complete payment first");
      return;
    }
    if (!stageRef.current) return;

    const stage = stageRef.current;
    if (exportFormats.png) {
      const dataURL = stage.toDataURL({ pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `seal-design-${selectedColor.replace("#", "")}.png`;
      link.href = dataURL;
      link.click();
    }
    if (exportFormats.jpg) {
      const dataURL = stage.toDataURL({ pixelRatio: 2, mimeType: "image/jpeg" });
      const link = document.createElement("a");
      link.download = `seal-design-${selectedColor.replace("#", "")}.jpg`;
      link.href = dataURL;
      link.click();
    }
    if (exportFormats.svg) {
      alert("SVG export: Please use PNG format for best quality");
    }
  };

  const formatTokenBalance = () => {
    const bal = typeof tokenBalance === "bigint" ? tokenBalance : 0n;
    try {
      return formatUnits(bal, decimalsNum);
    } catch {
      return "0";
    }
  };

  const getElementDisplayName = (element: Element) => {
    switch (element.type) {
      case "text":
        return "Text";
      case "arcText":
        return "Arc Text";
      case "circle":
        return "Circle";
      case "ring":
        return "Ring";
      default:
        return "Element";
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-bold" style={{ color: "#00D1FF" }}>
            Seal Maker
          </h1>
          <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white underline">
            Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => (isConnected ? disconnect() : setShowWalletSelector(true))}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: "#00D1FF", color: "#1e293b", border: "none" }}
          >
            {isConnected
              ? `CONNECTED: ${address?.slice(0, 6)}...${address?.slice(-4)}`
              : "Connect Wallet"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 p-4 border-r border-slate-700 flex-shrink-0 flex flex-col overflow-hidden">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#00D1FF" }}>
            Elements
          </h2>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              onClick={() => addElement("text")}
              className="p-3 border border-slate-600 rounded-lg hover:border-blue-400 transition-colors"
              style={{ borderColor: "#00D1FF" }}
            >
              <div className="text-sm">Text</div>
            </button>
            <button
              onClick={() => addElement("arcText")}
              className="p-3 border border-slate-600 rounded-lg hover:border-blue-400 transition-colors"
              style={{ borderColor: "#00D1FF" }}
            >
              <div className="text-sm">Arc Text</div>
            </button>
            <button
              onClick={() => addElement("circle")}
              className="p-3 border border-slate-600 rounded-lg hover:border-blue-400 transition-colors"
              style={{ borderColor: "#00D1FF" }}
            >
              <div className="text-sm">Circle</div>
            </button>
            <button
              onClick={() => addElement("ring")}
              className="p-3 border border-slate-600 rounded-lg hover:border-blue-400 transition-colors"
              style={{ borderColor: "#00D1FF" }}
            >
              <div className="text-sm">Ring</div>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <h3 className="text-lg font-medium mb-2" style={{ color: "#00D1FF" }}>
              All elements
            </h3>
            <div className="space-y-2">
              {elements.map((element) => (
                <div
                  key={element.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedElement === element.id
                      ? "bg-blue-600"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                  onClick={() => setSelectedElement(element.id)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{getElementDisplayName(element)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteElement(element.id);
                      }}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                  {element.text ? (
                    <div className="text-xs text-gray-400 mt-1 truncate">{element.text}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-slate-800 overflow-hidden">
          <div className="relative">
            {canvasReady ? (
              <Stage
                ref={stageRef}
                width={520}
                height={520}
                scaleX={1}
                scaleY={1}
                x={0}
                y={0}
                onWheel={handleWheel}
                className="border border-slate-600"
              >
                <Layer>
                  {renderPlateShape()}
                  {elements.map((element) => {
                    if (element.type === "text") {
                      return (
                        <Text
                          key={element.id}
                          x={element.x}
                          y={element.y}
                          text={element.text}
                          fontSize={element.fontSize}
                          fontFamily={element.fontFamily}
                          fill={element.fill}
                          rotation={element.rotation}
                          fontStyle={element.bold ? "bold" : "normal"}
                          onClick={() => setSelectedElement(element.id)}
                          draggable
                          onDragEnd={(e) => {
                            updateElement(element.id, { x: e.target.x(), y: e.target.y() });
                          }}
                        />
                      );
                    }
                    if (element.type === "arcText") return renderArcText(element);
                    if (element.type === "circle") {
                      return (
                        <Circle
                          key={element.id}
                          x={element.x}
                          y={element.y}
                          radius={element.radius}
                          stroke={element.fill}
                          strokeWidth={2}
                          fill="transparent"
                          onClick={() => setSelectedElement(element.id)}
                          draggable
                          onDragEnd={(e) => {
                            updateElement(element.id, { x: e.target.x(), y: e.target.y() });
                          }}
                        />
                      );
                    }
                    if (element.type === "ring") {
                      return (
                        <Circle
                          key={element.id}
                          x={element.x}
                          y={element.y}
                          radius={element.radius}
                          stroke={element.fill}
                          strokeWidth={element.thickness}
                          fill="transparent"
                          onClick={() => setSelectedElement(element.id)}
                          draggable
                          onDragEnd={(e) => {
                            updateElement(element.id, { x: e.target.x(), y: e.target.y() });
                          }}
                        />
                      );
                    }
                    return null;
                  })}
                </Layer>
              </Stage>
            ) : (
              <div className="w-[520px] h-[520px] border border-slate-600 flex items-center justify-center text-slate-300">
                Loading design canvas…
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 p-4 border-l border-slate-700 flex-shrink-0 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#00D1FF" }}>
            Properties
          </h2>

          {/* Plate */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3" style={{ color: "#00D1FF" }}>
              Plate
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Size</label>
              <input
                type="range"
                min="100"
                max="200"
                value={plateSize}
                onChange={(e) => setPlateSize(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-400 mt-1">{plateSize}px</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Shape</label>
              <select
                value={plateShape}
                onChange={(e) => setPlateShape(e.target.value as "circle" | "square" | "triangle")}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
              >
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="triangle">Triangle</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Color</label>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-600"
              />
            </div>
          </div>

          {/* Element Properties */}
          {selectedEl ? (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3" style={{ color: "#00D1FF" }}>
                {getElementDisplayName(selectedEl)}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">X Position</label>
                <input
                  type="range"
                  min="0"
                  max="520"
                  value={selectedEl.x}
                  onChange={(e) => updateElement(selectedEl.id, { x: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">{selectedEl.x}px</div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Y Position</label>
                <input
                  type="range"
                  min="0"
                  max="520"
                  value={selectedEl.y}
                  onChange={(e) => updateElement(selectedEl.id, { y: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">{selectedEl.y}px</div>
              </div>

              {(selectedEl.type === "text" || selectedEl.type === "arcText") ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Text</label>
                    <input
                      type="text"
                      value={selectedEl.text || ""}
                      onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Font Size</label>
                    <input
                      type="range"
                      min="12"
                      max="72"
                      value={selectedEl.fontSize || 28}
                      onChange={(e) => updateElement(selectedEl.id, { fontSize: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-400 mt-1">{selectedEl.fontSize || 28}px</div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Font Family</label>
                    <select
                      value={selectedEl.fontFamily || "Arial"}
                      onChange={(e) => updateElement(selectedEl.id, { fontFamily: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                    >
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedEl.bold || false}
                        onChange={(e) => updateElement(selectedEl.id, { bold: e.target.checked })}
                        className="mr-2"
                      />
                      Bold
                    </label>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Letter Spacing</label>
                    <input
                      type="range"
                      min="-5"
                      max="20"
                      value={selectedEl.letterSpacing || 0}
                      onChange={(e) => updateElement(selectedEl.id, { letterSpacing: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-400 mt-1">{selectedEl.letterSpacing || 0}px</div>
                  </div>

                  {selectedEl.type === "text" ? (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Rotation</label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={selectedEl.rotation || 0}
                        onChange={(e) => updateElement(selectedEl.id, { rotation: Number(e.target.value) })}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-400 mt-1">{selectedEl.rotation || 0}°</div>
                    </div>
                  ) : null}

                  {selectedEl.type === "arcText" ? (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Start Angle</label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={selectedEl.startAngle || 0}
                          onChange={(e) => updateElement(selectedEl.id, { startAngle: Number(e.target.value) })}
                          className="w-full"
                        />
                        <div className="text-xs text-gray-400 mt-1">{selectedEl.startAngle || 0}°</div>
                      </div>

                      <div className="mb-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedEl.flipText || false}
                            onChange={(e) => updateElement(selectedEl.id, { flipText: e.target.checked })}
                            className="mr-2"
                          />
                          Flip Text (Bottom)
                        </label>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {selectedEl.type === "circle" ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Radius</label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={selectedEl.radius || 50}
                    onChange={(e) => updateElement(selectedEl.id, { radius: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-400 mt-1">{selectedEl.radius || 50}px</div>
                </div>
              ) : null}

              {selectedEl.type === "ring" ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Radius</label>
                    <input
                      type="range"
                      min="20"
                      max="200"
                      value={selectedEl.radius || 80}
                      onChange={(e) => updateElement(selectedEl.id, { radius: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-400 mt-1">{selectedEl.radius || 80}px</div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Thickness</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={selectedEl.thickness || 2}
                      onChange={(e) => updateElement(selectedEl.id, { thickness: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-400 mt-1">{selectedEl.thickness || 2}px</div>
                  </div>
                </>
              ) : null}

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Color</label>
                <input
                  type="color"
                  value={selectedEl.fill || selectedColor}
                  onChange={(e) => updateElement(selectedEl.id, { fill: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-600"
                />
              </div>
            </div>
          ) : null}

          {/* Export */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3" style={{ color: "#00D1FF" }}>
              Export
            </h3>

            <div className="space-y-2 mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportFormats.png}
                  onChange={(e) => setExportFormats((prev) => ({ ...prev, png: e.target.checked }))}
                  className="mr-2"
                />
                PNG
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportFormats.jpg}
                  onChange={(e) => setExportFormats((prev) => ({ ...prev, jpg: e.target.checked }))}
                  className="mr-2"
                />
                JPG
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportFormats.svg}
                  onChange={(e) => setExportFormats((prev) => ({ ...prev, svg: e.target.checked }))}
                  className="mr-2"
                />
                SVG
              </label>
            </div>

            <div className="space-y-3">
              {isConnected ? (
                <div className="text-sm text-gray-400">
                  Balance: {formatTokenBalance()} {PAYMENT_CONFIG.tokenSymbol}
                </div>
              ) : null}

              <button
                onClick={handlePayment}
                disabled={isTransferPending || isTransferring || paymentCompleted}
                className="w-full px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: paymentCompleted ? "#10B981" : "#00D1FF",
                  color: "#1e293b",
                  border: "none",
                }}
              >
                {isTransferPending || isTransferring
                  ? "Processing..."
                  : paymentCompleted
                    ? "✓ Payment Complete"
                    : `Pay ${PAYMENT_AMOUNT} ${PAYMENT_CONFIG.tokenSymbol}`}
              </button>

              <button
                onClick={handleDownload}
                disabled={!paymentCompleted}
                className="w-full px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: paymentCompleted ? "#00D1FF" : "#374151",
                  color: paymentCompleted ? "#1e293b" : "#9CA3AF",
                  border: "none",
                }}
              >
                Download Design
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Selector Modal */}
      {showWalletSelector ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-600 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4" style={{ color: "#00D1FF" }}>
              Connect Wallet
            </h3>
            <p className="text-gray-300 mb-6">
              Choose your wallet for {PAYMENT_CONFIG.networkName} ({PAYMENT_CONFIG.tokenSymbol})
            </p>
            <div className="space-y-3">
              <button
                onClick={handleWalletConnect}
                className="w-full px-4 py-3 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: "#00D1FF", color: "#1e293b", border: "none" }}
              >
                MetaMask / Injected
              </button>
              <button
                onClick={() => setShowWalletSelector(false)}
                className="w-full px-4 py-3 rounded-lg font-medium bg-slate-600 text-white hover:bg-slate-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


