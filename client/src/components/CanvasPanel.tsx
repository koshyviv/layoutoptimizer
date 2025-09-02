import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Path } from 'react-konva';
import { motion } from 'framer-motion';
import { 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Grid, 
  Ruler, 
  RotateCw,
  Copy,
  Trash2,
  Settings,
  Route
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { Block, MODULE_DEFINITIONS } from '@/lib/types';
import { cn, snapToGrid } from '@/lib/utils';
import { PathMask, GridIndex, checkPlacementLegality, nudgeToNearestLegal } from '@/lib/grid';
import Konva from 'konva';

// Interactive 2D canvas with warehouse layout editor
const CanvasPanel: React.FC = () => {
  const {
    currentPlan,
    canvasState,
    updateCanvasState,
    updateBlock,
    setSelectedBlocks,
    clearSelection,
    isSidebarCollapsed,
    isChatSidebarCollapsed
  } = useAppStore();

  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);
  const [violations, setViolations] = useState<Record<string, string | undefined>>({});

  // Update stage size on window resize and sidebar changes
  useEffect(() => {
    const updateSize = () => {
      const container = stageRef.current?.container();
      if (container) {
        const parent = container.parentElement!;
        const { offsetWidth, offsetHeight } = parent;
        console.log('Canvas size update:', { offsetWidth, offsetHeight });
        setStageSize({ width: offsetWidth, height: offsetHeight });
      }
    };

    // Immediate update
    updateSize();
    
    // Also update after animations complete (300ms + buffer)
    const timeoutId = setTimeout(updateSize, 350);
    
    window.addEventListener('resize', updateSize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateSize);
    };
  }, [isSidebarCollapsed, isChatSidebarCollapsed]);

  // Animation loop for warehouse activity
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTime(prev => prev + 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    newScale = Math.max(0.1, Math.min(3, newScale)); // Clamp zoom

    updateCanvasState({
      zoom: newScale,
      pan: {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      }
    });
  };

  const handleStageClick = (e: any) => {
    // If clicked on empty area, clear selection
    if (e.target === e.target.getStage()) {
      clearSelection();
    }
  };

  const handleBlockClick = (blockId: string, e: any) => {
    e.cancelBubble = true;
    
    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Multi-select
      const selected = canvasState.selectedBlockIds;
      if (selected.includes(blockId)) {
        setSelectedBlocks(selected.filter(id => id !== blockId));
      } else {
        setSelectedBlocks([...selected, blockId]);
      }
    } else {
      // Single select
      setSelectedBlocks([blockId]);
    }
  };

  const handleBlockDragMove = (blockId: string, e: any) => {
    const { x, y } = e.target.position();
    // Convert pixels back to meters (20px per meter)
    const meterX = x / 20;
    const meterY = y / 20;
    const snappedX = canvasState.snapToGrid ? snapToGrid(meterX, canvasState.gridSize) : meterX;
    const snappedY = canvasState.snapToGrid ? snapToGrid(meterY, canvasState.gridSize) : meterY;
    
    updateBlock(blockId, { x: snappedX, y: snappedY });

    // Legality feedback while dragging
    const moving = currentPlan?.blocks.find(b => b.id === blockId);
    if (!currentPlan || !moving) return;
    const others = currentPlan.blocks.filter(b => b.id !== blockId).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
    const siteBounds = currentPlan.blocks.reduce((acc, block) => ({
      minX: Math.min(acc.minX, block.x),
      minY: Math.min(acc.minY, block.y),
      maxX: Math.max(acc.maxX, block.x + block.w),
      maxY: Math.max(acc.maxY, block.y + block.h)
    }), { minX: 0, minY: 0, maxX: 100, maxY: 60 });
    const site = { x: siteBounds.minX - 5, y: siteBounds.minY - 5, w: (siteBounds.maxX - siteBounds.minX) + 10, h: (siteBounds.maxY - siteBounds.minY) + 10 };
    const pathMask = buildPathMask(currentPlan);
    const candidate = { x: snappedX, y: snappedY, w: moving.w, h: moving.h };
    const minAisle = 3.0;
    const res = checkPlacementLegality(candidate, others, pathMask, { minAisle, site });
    setViolations(v => ({ ...v, [blockId]: res.ok ? undefined : res.reason }));
  };

  const handleBlockDragEnd = (blockId: string, e: any) => {
    const { x, y } = e.target.position();
    // Convert pixels back to meters and ensure final position is updated
    const meterX = x / 20;
    const meterY = y / 20;
    const snappedX = canvasState.snapToGrid ? snapToGrid(meterX, canvasState.gridSize) : meterX;
    const snappedY = canvasState.snapToGrid ? snapToGrid(meterY, canvasState.gridSize) : meterY;
    
    // Final legality enforcement; nudge to nearest legal cell if needed
    if (currentPlan) {
      const moving = currentPlan.blocks.find(b => b.id === blockId);
      if (moving) {
        const others = currentPlan.blocks.filter(b => b.id !== blockId).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
        const siteBounds = currentPlan.blocks.reduce((acc, block) => ({
          minX: Math.min(acc.minX, block.x),
          minY: Math.min(acc.minY, block.y),
          maxX: Math.max(acc.maxX, block.x + block.w),
          maxY: Math.max(acc.maxY, block.y + block.h)
        }), { minX: 0, minY: 0, maxX: 100, maxY: 60 });
        const site = { x: siteBounds.minX - 5, y: siteBounds.minY - 5, w: (siteBounds.maxX - siteBounds.minX) + 10, h: (siteBounds.maxY - siteBounds.minY) + 10 };
        const pathMask = buildPathMask(currentPlan);
        const minAisle = 3.0;
        const candidate = { x: snappedX, y: snappedY, w: moving.w, h: moving.h };
        const legal = checkPlacementLegality(candidate, others, pathMask, { minAisle, site });
        if (!legal.ok) {
          const nudged = nudgeToNearestLegal(candidate, others, pathMask, { minAisle, site }, 20);
          updateBlock(blockId, { x: nudged.x, y: nudged.y });
          setViolations(v => ({ ...v, [blockId]: undefined }));
        } else {
          updateBlock(blockId, { x: snappedX, y: snappedY });
          setViolations(v => ({ ...v, [blockId]: undefined }));
        }
      }
    } else {
      updateBlock(blockId, { x: snappedX, y: snappedY });
    }
    setIsDragging(false);
  };

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleResize = (blockId: string, corner: string, deltaX: number, deltaY: number) => {
    const block = currentPlan?.blocks.find(b => b.id === blockId);
    if (!block) return;

    let newW = block.w;
    let newH = block.h;
    let newX = block.x;
    let newY = block.y;

    const deltaMetersX = deltaX / 20;
    const deltaMetersY = deltaY / 20;

    switch (corner) {
      case 'bottom-right':
        newW = Math.max(2, block.w + deltaMetersX);
        newH = Math.max(2, block.h + deltaMetersY);
        break;
      case 'bottom-left':
        newW = Math.max(2, block.w - deltaMetersX);
        newH = Math.max(2, block.h + deltaMetersY);
        newX = block.x + (block.w - newW);
        break;
      case 'top-right':
        newW = Math.max(2, block.w + deltaMetersX);
        newH = Math.max(2, block.h - deltaMetersY);
        newY = block.y + (block.h - newH);
        break;
      case 'top-left':
        newW = Math.max(2, block.w - deltaMetersX);
        newH = Math.max(2, block.h - deltaMetersY);
        newX = block.x + (block.w - newW);
        newY = block.y + (block.h - newH);
        break;
    }

    if (canvasState.snapToGrid) {
      newW = snapToGrid(newW, canvasState.gridSize);
      newH = snapToGrid(newH, canvasState.gridSize);
      newX = snapToGrid(newX, canvasState.gridSize);
      newY = snapToGrid(newY, canvasState.gridSize);
    }

    updateBlock(blockId, { w: newW, h: newH, x: newX, y: newY });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  const zoomIn = () => {
    const newZoom = Math.min(canvasState.zoom * 1.2, 3);
    updateCanvasState({ zoom: newZoom });
  };

  const zoomOut = () => {
    const newZoom = Math.max(canvasState.zoom / 1.2, 0.1);
    updateCanvasState({ zoom: newZoom });
  };

  const resetView = () => {
    updateCanvasState({ zoom: 1, pan: { x: 0, y: 0 } });
  };

  const toggleGrid = () => {
    updateCanvasState({ showGrid: !canvasState.showGrid });
  };

  const toggleSnap = () => {
    updateCanvasState({ snapToGrid: !canvasState.snapToGrid });
  };

  const toggleConstraints = () => {
    updateCanvasState({ showConstraints: !canvasState.showConstraints });
  };

  // Helper function to ensure child elements are not draggable
  const makeNonDraggable = (element: any): any => {
    if (React.isValidElement(element)) {
      const props = { ...element.props, draggable: false };
      if (element.props.children) {
        props.children = React.Children.map(element.props.children, makeNonDraggable);
      }
      return React.cloneElement(element, props);
    }
    return element;
  };

  const renderGrid = () => {
    if (!canvasState.showGrid) return null;

    const lines = [];
    const gridSize = canvasState.gridSize * 20; // Convert to pixels
    const width = stageSize.width / canvasState.zoom;
    const height = stageSize.height / canvasState.zoom;

    // Vertical lines
    for (let i = 0; i < width; i += gridSize) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, height]}
          stroke="#e2e8f0"
          strokeWidth={0.5}
          opacity={0.5}
        />
      );
    }

    // Horizontal lines
    for (let i = 0; i < height; i += gridSize) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, width, i]}
          stroke="#e2e8f0"
          strokeWidth={0.5}
          opacity={0.5}
        />
      );
    }

    return lines;
  };

  const renderWarehouseEquipment = (block: Block) => {
    const moduleInfo = MODULE_DEFINITIONS[block.key];
    const isSelected = canvasState.selectedBlockIds.includes(block.id);
    
    // Convert meters to pixels (20px per meter)
    const pixelX = block.x * 20;
    const pixelY = block.y * 20;
    const pixelW = block.w * 20;
    const pixelH = block.h * 20;

    const equipment = [] as any[];

    // Base floor area with realistic warehouse flooring
    equipment.push(
      <Rect
        key="floor"
        width={pixelW}
        height={pixelH}
        fill="#f8f9fa"
        stroke="#e9ecef"
        strokeWidth={1}
        shadowBlur={3}
        shadowColor="#00000010"
        shadowOffset={{ x: 0, y: 1 }}
        draggable={false}
      />
    );

    // Equipment-specific visualizations
    switch (block.key) {
      case 'pallet_asrs':
        // Pallet ASRS with storage racks
        for (let i = 0; i < Math.floor(pixelW / 40); i++) {
          for (let j = 0; j < Math.floor(pixelH / 30); j++) {
            equipment.push(
              <Group key={`rack-${i}-${j}`}>
                {/* Rack structure */}
                <Rect
                  x={i * 40 + 5}
                  y={j * 30 + 5}
                  width={30}
                  height={20}
                  fill="#6b7280"
                  stroke="#374151"
                  strokeWidth={1}
                  draggable={false}
                />
                {/* Pallet positions */}
                <Rect
                  x={i * 40 + 8}
                  y={j * 30 + 8}
                  width={24}
                  height={14}
                  fill="#d97706"
                  opacity={0.7}
                  draggable={false}
                />
                {/* Vertical supports */}
                <Line
                  points={[i * 40 + 5, j * 30 + 5, i * 40 + 5, j * 30 + 25]}
                  stroke="#374151"
                  strokeWidth={2}
                  draggable={false}
                />
                <Line
                  points={[i * 40 + 35, j * 30 + 5, i * 40 + 35, j * 30 + 25]}
                  stroke="#374151"
                  strokeWidth={2}
                  draggable={false}
                />
              </Group>
            );
          }
        }
        // Crane system with animation
        equipment.push(
          <Line
            key="crane-rail"
            points={[10, pixelH/2, pixelW - 10, pixelH/2]}
            stroke="#ef4444"
            strokeWidth={4}
            dash={[10, 5]}
            draggable={false}
          />
        );
        // Animated crane position
        const cranePosition = pixelW/2 + Math.sin(animationTime) * 50;
        equipment.push(
          <Group key="crane-system" draggable={false}>
            <Rect
              x={cranePosition - 15}
              y={pixelH/2 - 8}
              width={30}
              height={16}
              fill="#ef4444"
              cornerRadius={4}
              shadowBlur={5}
              shadowColor="#dc2626"
              shadowOffset={{ x: 0, y: 2 }}
              draggable={false}
            />
            {/* Crane arm */}
            <Line
              points={[cranePosition, pixelH/2, cranePosition, pixelH/2 + 30]}
              stroke="#dc2626"
              strokeWidth={3}
              draggable={false}
            />
            {/* Moving load */}
            <Rect
              x={cranePosition - 8}
              y={pixelH/2 + 25}
              width={16}
              height={12}
              fill="#d97706"
              opacity={0.8}
              draggable={false}
            />
          </Group>
        );
        break;

      case 'tote_asrs':
        // Tote ASRS with smaller compartments
        for (let i = 0; i < Math.floor(pixelW / 25); i++) {
          for (let j = 0; j < Math.floor(pixelH / 20); j++) {
            equipment.push(
              <Rect
                key={`tote-${i}-${j}`}
                x={i * 25 + 3}
                y={j * 20 + 3}
                width={19}
                height={14}
                fill="#10b981"
                stroke="#047857"
                strokeWidth={1}
                opacity={0.8}
                draggable={false}
              />
            );
          }
        }
        break;

      case 'gtp':
        // Goods-to-Person stations
        const stations = Math.min(8, Math.floor(pixelW / 60));
        for (let i = 0; i < stations; i++) {
          const stationX = (i * pixelW / stations) + 10;
          equipment.push(
            <Group key={`gtp-station-${i}`}>
              {/* Workstation */}
              <Rect
                x={stationX}
                y={pixelH/2 - 15}
                width={40}
                height={30}
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth={2}
                cornerRadius={4}
              />
              {/* Display screen */}
              <Rect
                x={stationX + 5}
                y={pixelH/2 - 10}
                width={15}
                height={10}
                fill="#1f2937"
                cornerRadius={2}
              />
              {/* Conveyor */}
              <Rect
                x={stationX + 25}
                y={pixelH/2 - 5}
                width={12}
                height={20}
                fill="#6b7280"
                stroke="#374151"
                strokeWidth={1}
              />
            </Group>
          );
        }
        break;

      case 'picking':
        // Manual picking aisles
        const aisles = Math.floor(pixelH / 80);
        for (let i = 0; i < aisles; i++) {
          const aisleY = i * 80 + 20;
          // Shelving on both sides
          equipment.push(
            <Group key={`picking-aisle-${i}`}>
              <Rect
                x={10}
                y={aisleY}
                width={pixelW - 20}
                height={15}
                fill="#8b5cf6"
                opacity={0.6}
              />
              <Rect
                x={10}
                y={aisleY + 45}
                width={pixelW - 20}
                height={15}
                fill="#8b5cf6"
                opacity={0.6}
              />
              {/* Aisle path */}
              <Rect
                x={10}
                y={aisleY + 20}
                width={pixelW - 20}
                height={20}
                fill="#e5e7eb"
                stroke="#d1d5db"
                strokeWidth={1}
                dash={[5, 5]}
              />
            </Group>
          );
        }
        break;

      case 'inbound':
      case 'outbound':
        // Loading docks
        const docks = Math.min(6, Math.floor(pixelW / 80));
        for (let i = 0; i < docks; i++) {
          const dockX = i * (pixelW / docks);
          equipment.push(
            <Group key={`dock-${i}`}>
              {/* Dock door */}
              <Rect
                x={dockX + 10}
                y={5}
                width={60}
                height={pixelH - 10}
                fill={block.key === 'inbound' ? '#f97316' : '#ec4899'}
                stroke={block.key === 'inbound' ? '#ea580c' : '#db2777'}
                strokeWidth={2}
                opacity={0.8}
              />
              {/* Loading bay */}
              <Rect
                x={dockX + 20}
                y={15}
                width={40}
                height={20}
                fill="#374151"
                cornerRadius={4}
              />
              {/* Truck outline */}
              <Rect
                x={dockX + 15}
                y={-10}
                width={50}
                height={15}
                fill="none"
                stroke="#6b7280"
                strokeWidth={2}
                dash={[8, 4]}
              />
            </Group>
          );
        }
        break;

      case 'consolidation':
        // Packing stations
        const packStations = Math.min(6, Math.floor(pixelW / 70));
        for (let i = 0; i < packStations; i++) {
          const stationX = (i * pixelW / packStations) + 15;
          equipment.push(
            <Group key={`pack-station-${i}`}>
              <Rect
                x={stationX}
                y={pixelH/2 - 20}
                width={50}
                height={40}
                fill="#8b5cf6"
                stroke="#7c3aed"
                strokeWidth={2}
                cornerRadius={6}
              />
              {/* Animated conveyor belt */}
              <Rect
                x={stationX - 5}
                y={pixelH/2 - 5}
                width={60}
                height={10}
                fill="#4b5563"
                stroke="#374151"
                strokeWidth={1}
              />
              {/* Moving belt pattern */}
              <Line
                points={[
                  stationX - 5 + (animationTime * 10) % 20, pixelH/2,
                  stationX + 55, pixelH/2
                ]}
                stroke="#6b7280"
                strokeWidth={2}
                dash={[8, 8]}
              />
            </Group>
          );
        }
        break;

      case 'palletizer':
      case 'depalletizer':
        // Robotic equipment
        equipment.push(
          <Group key="robot-arm">
            {/* Base */}
            <Circle
              x={pixelW/2}
              y={pixelH/2}
              radius={20}
              fill="#6366f1"
              stroke="#4f46e5"
              strokeWidth={3}
            />
            {/* Arm segments */}
            <Line
              points={[pixelW/2, pixelH/2, pixelW/2 + 30, pixelH/2 - 15]}
              stroke="#4f46e5"
              strokeWidth={6}
              lineCap="round"
            />
            <Line
              points={[pixelW/2 + 30, pixelH/2 - 15, pixelW/2 + 50, pixelH/2 + 10]}
              stroke="#4f46e5"
              strokeWidth={4}
              lineCap="round"
            />
            {/* End effector */}
            <Rect
              x={pixelW/2 + 45}
              y={pixelH/2 + 5}
              width={10}
              height={10}
              fill="#1f2937"
              cornerRadius={2}
            />
          </Group>
        );
        break;

      case 'charging':
        // Charging stations for AMRs
        const chargers = Math.min(4, Math.floor(pixelW / 40));
        for (let i = 0; i < chargers; i++) {
          equipment.push(
            <Group key={`charger-${i}`}>
              <Rect
                x={i * 40 + 10}
                y={pixelH/2 - 10}
                width={25}
                height={20}
                fill="#6366f1"
                stroke="#4f46e5"
                strokeWidth={2}
                cornerRadius={4}
              />
              {/* Charging cable */}
              <Line
                points={[i * 40 + 22, pixelH/2 - 10, i * 40 + 22, pixelH/2 - 20]}
                stroke="#ef4444"
                strokeWidth={3}
                lineCap="round"
              />
            </Group>
          );
        }
        break;

      case 'aisle':
        // Main aisle with lane markings
        equipment.push(
          <Rect
            key="aisle-surface"
            width={pixelW}
            height={pixelH}
            fill="#f3f4f6"
            stroke="#d1d5db"
            strokeWidth={2}
          />
        );
        // Lane dividers
        equipment.push(
          <Line
            key="center-line"
            points={[0, pixelH/2, pixelW, pixelH/2]}
            stroke="#fbbf24"
            strokeWidth={3}
            dash={[20, 10]}
          />
        );
        // Side markings
        equipment.push(
          <Line
            key="side-line-1"
            points={[0, 5, pixelW, 5]}
            stroke="#fbbf24"
            strokeWidth={2}
          />
        );
        equipment.push(
          <Line
            key="side-line-2"
            points={[0, pixelH - 5, pixelW, pixelH - 5]}
            stroke="#fbbf24"
            strokeWidth={2}
          />
        );
        break;

      default:
        // Generic equipment
        equipment.push(
          <Rect
            key="generic"
            x={5}
            y={5}
            width={pixelW - 10}
            height={pixelH - 10}
            fill={moduleInfo?.color || '#94a3b8'}
            stroke="#64748b"
            strokeWidth={2}
            cornerRadius={8}
            opacity={0.8}
          />
        );
    }

    // Equipment labels and info
    equipment.push(
      <Group key="labels">
        {/* Equipment name */}
        <Rect
          x={5}
          y={5}
          width={Math.min(pixelW - 10, (moduleInfo?.name || block.key).length * 8 + 16)}
          height={24}
          fill="rgba(255, 255, 255, 0.95)"
          stroke="#d1d5db"
          strokeWidth={1}
          cornerRadius={4}
        />
        <Text
          x={13}
          y={12}
          text={moduleInfo?.name || block.key}
          fontSize={11}
          fontFamily="Inter, sans-serif"
          fontWeight="600"
          fill="#1f2937"
        />
        
        {/* Dimensions */}
        <Text
          x={8}
          y={pixelH - 20}
          text={`${block.w}×${block.h}m`}
          fontSize={9}
          fontFamily="Inter, sans-serif"
          fill="#6b7280"
        />
        
        {/* KPI badges */}
        {block.meta?.kpis && Object.keys(block.meta.kpis).length > 0 && (
          <>
            {Object.entries(block.meta.kpis).slice(0, 2).map(([key, value], index) => (
              <Group key={key}>
                <Rect
                  x={pixelW - 80}
                  y={5 + index * 20}
                  width={70}
                  height={16}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  cornerRadius={8}
                />
                <Text
                  x={pixelW - 75}
                  y={9 + index * 20}
                  text={`${key}: ${typeof value === 'number' ? (value < 1 ? (value * 100).toFixed(0) + '%' : value.toLocaleString()) : value}`}
                  fontSize={8}
                  fontFamily="Inter, sans-serif"
                  fill="#1e40af"
                />
              </Group>
            ))}
          </>
        )}
      </Group>
    );

    // Selection indicators
    if (isSelected) {
      equipment.push(
        <Group key="selection">
          <Rect
            width={pixelW}
            height={pixelH}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            dash={[10, 5]}
          />
          {/* Corner handles for resizing */}
          {[
            { x: 0, y: 0, corner: 'top-left', cursor: 'nw-resize' },
            { x: pixelW - 8, y: 0, corner: 'top-right', cursor: 'ne-resize' },
            { x: pixelW - 8, y: pixelH - 8, corner: 'bottom-right', cursor: 'se-resize' },
            { x: 0, y: pixelH - 8, corner: 'bottom-left', cursor: 'sw-resize' }
          ].map((handle, i) => (
            <Rect
              key={i}
              x={handle.x}
              y={handle.y}
              width={8}
              height={8}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={2}
              cornerRadius={2}
              draggable
              onDragStart={handleResizeStart}
              onDragMove={(e) => {
                const deltaX = e.target.x() - handle.x;
                const deltaY = e.target.y() - handle.y;
                handleResize(block.id, handle.corner, deltaX, deltaY);
              }}
              onDragEnd={handleResizeEnd}
              onMouseEnter={(e) => {
                e.target.getStage()!.container().style.cursor = handle.cursor;
              }}
              onMouseLeave={(e) => {
                e.target.getStage()!.container().style.cursor = 'default';
              }}
            />
          ))}
        </Group>
      );
    }

    // Violation overlay
    if (violations[block.id]) {
      equipment.push(
        <Group key="violation">
          <Rect
            width={pixelW}
            height={pixelH}
            fill="rgba(220,38,38,0.06)"
            stroke="#dc2626"
            strokeWidth={3}
            dash={[6, 6]}
          />
          <Text
            x={0}
            y={-14}
            text={violations[block.id] || ''}
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fill="#dc2626"
          />
        </Group>
      );
    }

    return (
      <Group
        key={block.id}
        x={pixelX}
        y={pixelY}
        draggable
        onClick={(e) => handleBlockClick(block.id, e)}
        onDragMove={(e) => handleBlockDragMove(block.id, e)}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(e) => handleBlockDragEnd(block.id, e)}
      >
        {equipment.map(makeNonDraggable)}
      </Group>
    );
  };

  // Legacy method for backward compatibility
  const renderBlock = renderWarehouseEquipment;

  const renderWarehouseFloor = () => {
    if (!currentPlan) return null;

    const floorElements = [];
    
    // Overall warehouse floor
    const bounds = currentPlan.blocks.reduce((acc, block) => ({
      minX: Math.min(acc.minX, block.x),
      minY: Math.min(acc.minY, block.y),
      maxX: Math.max(acc.maxX, block.x + block.w),
      maxY: Math.max(acc.maxY, block.y + block.h)
    }), { minX: 0, minY: 0, maxX: 100, maxY: 60 });

    const floorW = (bounds.maxX - bounds.minX + 10) * 20;
    const floorH = (bounds.maxY - bounds.minY + 10) * 20;
    const floorX = (bounds.minX - 5) * 20;
    const floorY = (bounds.minY - 5) * 20;

    // Main warehouse floor
    floorElements.push(
      <Rect
        key="warehouse-floor"
        x={floorX}
        y={floorY}
        width={floorW}
        height={floorH}
        fill="#f1f5f9"
        stroke="#cbd5e1"
        strokeWidth={2}
      />
    );

    // Floor grid pattern
    const gridSpacing = 40; // 2m grid
    for (let x = floorX; x <= floorX + floorW; x += gridSpacing) {
      floorElements.push(
        <Line
          key={`floor-grid-v-${x}`}
          points={[x, floorY, x, floorY + floorH]}
          stroke="#e2e8f0"
          strokeWidth={0.5}
          opacity={0.3}
        />
      );
    }
    for (let y = floorY; y <= floorY + floorH; y += gridSpacing) {
      floorElements.push(
        <Line
          key={`floor-grid-h-${y}`}
          points={[floorX, y, floorX + floorW, y]}
          stroke="#e2e8f0"
          strokeWidth={0.5}
          opacity={0.3}
        />
      );
    }

    return floorElements;
  };

  // Build a path mask from aisle blocks to prevent placement overlaps
  const buildPathMask = (plan?: { blocks: Block[] }) => {
    if (!plan) return new PathMask({ cellSize: 0.25, width: 200, height: 120 });
    const bounds = plan.blocks.reduce((acc, block) => ({
      minX: Math.min(acc.minX, block.x),
      minY: Math.min(acc.minY, block.y),
      maxX: Math.max(acc.maxX, block.x + block.w),
      maxY: Math.max(acc.maxY, block.y + block.h)
    }), { minX: 0, minY: 0, maxX: 100, maxY: 60 });
    const mask = new PathMask({ cellSize: 0.25, width: (bounds.maxX - bounds.minX) + 20, height: (bounds.maxY - bounds.minY) + 20 });
    for (const b of plan.blocks) {
      if (b.key === 'aisle') {
        mask.fillRect({ x: b.x, y: b.y, w: b.w, h: b.h }, 1);
      }
    }
    return mask;
  };

  const renderCentralSpine = () => {
    if (!currentPlan) return null;

    const spineElements = [];
    
    // Calculate the central spine position (horizontal through the middle)
    const bounds = currentPlan.blocks.reduce((acc, block) => ({
      minX: Math.min(acc.minX, block.x),
      minY: Math.min(acc.minY, block.y),
      maxX: Math.max(acc.maxX, block.x + block.w),
      maxY: Math.max(acc.maxY, block.y + block.h)
    }), { minX: 0, minY: 0, maxX: 100, maxY: 60 });

    const spineY = (bounds.minY + bounds.maxY) / 2;
    const spineStartX = bounds.minX - 5;
    const spineEndX = bounds.maxX + 5;
    const spineWidth = 3; // 3 meter wide main path

    // Main central spine - the primary material flow highway
    spineElements.push(
      <Rect
        key="central-spine"
        x={spineStartX * 20}
        y={(spineY - spineWidth/2) * 20}
        width={(spineEndX - spineStartX) * 20}
        height={spineWidth * 20}
        fill="#e5e7eb"
        stroke="#9ca3af"
        strokeWidth={2}
      />
    );

    // Central lane divider
    spineElements.push(
      <Line
        key="spine-centerline"
        points={[spineStartX * 20, spineY * 20, spineEndX * 20, spineY * 20]}
        stroke="#fbbf24"
        strokeWidth={3}
        dash={[30, 15]}
      />
    );

    // Edge markings
    spineElements.push(
      <Line
        key="spine-top-edge"
        points={[spineStartX * 20, (spineY - spineWidth/2) * 20, spineEndX * 20, (spineY - spineWidth/2) * 20]}
        stroke="#fbbf24"
        strokeWidth={2}
      />
    );
    spineElements.push(
      <Line
        key="spine-bottom-edge"
        points={[spineStartX * 20, (spineY + spineWidth/2) * 20, spineEndX * 20, (spineY + spineWidth/2) * 20]}
        stroke="#fbbf24"
        strokeWidth={2}
      />
    );

    // Direction arrows along the spine
    for (let x = spineStartX + 10; x < spineEndX - 10; x += 20) {
      spineElements.push(
        <Group key={`spine-arrow-${x}`}>
          <Line
            points={[
              x * 20 - 8, spineY * 20 - 4,
              x * 20 + 8, spineY * 20,
              x * 20 - 8, spineY * 20 + 4
            ]}
            stroke="#059669"
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            opacity={0.7}
          />
        </Group>
      );
    }

    // Speed and safety markings
    for (let x = spineStartX + 15; x < spineEndX - 15; x += 40) {
      spineElements.push(
        <Text
          key={`spine-speed-${x}`}
          x={x * 20}
          y={(spineY - spineWidth/2 - 0.5) * 20}
          text="8 km/h"
          fontSize={8}
          fontFamily="Inter, sans-serif"
          fontWeight="600"
          fill="#dc2626"
          align="center"
        />
      );
    }

    return spineElements;
  };

  const renderEquipmentConnections = () => {
    if (!currentPlan) return null;

    const connections = [];
    const bounds = currentPlan.blocks.reduce((acc, block) => ({
      minX: Math.min(acc.minX, block.x),
      minY: Math.min(acc.minY, block.y),
      maxX: Math.max(acc.maxX, block.x + block.w),
      maxY: Math.max(acc.maxY, block.y + block.h)
    }), { minX: 0, minY: 0, maxX: 100, maxY: 60 });

    const spineY = (bounds.minY + bounds.maxY) / 2;
    const spineWidth = 3;

    // Connect each equipment block to the central spine
    currentPlan.blocks.forEach((block, index) => {
      if (block.key === 'aisle') return; // Skip aisle blocks

      const blockCenterX = block.x + block.w / 2;
      const blockCenterY = block.y + block.h / 2;
      
      // Determine connection point on spine
      const spineConnectionX = blockCenterX;
      const spineConnectionY = spineY;
      
      // Connection path from equipment to spine
      const connectionWidth = 1.5; // 1.5m wide connection paths
      
      // Determine if equipment is above or below spine
      const isAbove = blockCenterY < spineY;
      const connectionY = isAbove ? 
        (block.y + block.h) : // Connect from bottom of equipment if above spine
        (block.y); // Connect from top of equipment if below spine
      
      // Perpendicular connection to spine
      connections.push(
        <Rect
          key={`connection-${index}`}
          x={(spineConnectionX - connectionWidth/2) * 20}
          y={Math.min(connectionY, spineY - spineWidth/2) * 20}
          width={connectionWidth * 20}
          height={Math.abs(connectionY - (spineY - (isAbove ? spineWidth/2 : -spineWidth/2))) * 20}
          fill="#d1d5db"
          stroke="#9ca3af"
          strokeWidth={1}
          opacity={0.8}
        />
      );

      // Connection markings
      connections.push(
        <Line
          key={`connection-line-${index}`}
          points={[
            spineConnectionX * 20, connectionY * 20,
            spineConnectionX * 20, (spineY + (isAbove ? -spineWidth/2 : spineWidth/2)) * 20
          ]}
          stroke="#6b7280"
          strokeWidth={2}
          dash={[8, 4]}
          opacity={0.6}
        />
      );

      // Entry/exit points with proper CAD-style symbols
      const entryY = spineY + (isAbove ? -spineWidth/2 : spineWidth/2);
      connections.push(
        <Circle
          key={`entry-point-${index}`}
          x={spineConnectionX * 20}
          y={entryY * 20}
          radius={6}
          fill="#059669"
          stroke="#047857"
          strokeWidth={2}
        />
      );

      // Equipment ID labels at connection points
      connections.push(
        <Group key={`connection-label-${index}`}>
          <Rect
            x={(spineConnectionX - 1) * 20}
            y={(connectionY + (isAbove ? -1.5 : 0.5)) * 20}
            width={40}
            height={16}
            fill="white"
            stroke="#6b7280"
            strokeWidth={1}
            cornerRadius={4}
            opacity={0.95}
          />
          <Text
            x={spineConnectionX * 20}
            y={(connectionY + (isAbove ? -1 : 1)) * 20}
            text={block.key.toUpperCase()}
            fontSize={8}
            fontFamily="Inter, sans-serif"
            fontWeight="600"
            fill="#374151"
            align="center"
            width={40}
          />
        </Group>
      );
    });

    return connections;
  };

  const renderSpineFlowPaths = () => {
    if (!currentPlan || !canvasState.showConstraints) return null;

    const paths = [];
    const bounds = currentPlan.blocks.reduce((acc, block) => ({
      minX: Math.min(acc.minX, block.x),
      minY: Math.min(acc.minY, block.y),
      maxX: Math.max(acc.maxX, block.x + block.w),
      maxY: Math.max(acc.maxY, block.y + block.h)
    }), { minX: 0, minY: 0, maxX: 100, maxY: 60 });

    const spineY = (bounds.minY + bounds.maxY) / 2;
    
    // Define material flow sequences along the spine
    const flowSequences = [
      {
        path: ['inbound', 'depalletizer', 'pallet_asrs'],
        color: '#3b82f6',
        width: 6,
        label: 'Pallet Flow',
        direction: 1 // Left to right
      },
      {
        path: ['tote_asrs', 'gtp', 'picking'],
        color: '#f59e0b',
        width: 4,
        label: 'Tote Flow',
        direction: 1
      },
      {
        path: ['picking', 'consolidation', 'palletizer'],
        color: '#8b5cf6',
        width: 5,
        label: 'Order Flow',
        direction: 1
      }
    ];

    flowSequences.forEach((sequence, seqIndex) => {
      for (let i = 0; i < sequence.path.length - 1; i++) {
        const fromBlock = currentPlan.blocks.find(b => b.key === sequence.path[i]);
        const toBlock = currentPlan.blocks.find(b => b.key === sequence.path[i + 1]);
        
        if (fromBlock && toBlock) {
          const fromX = (fromBlock.x + fromBlock.w / 2) * 20;
          const toX = (toBlock.x + toBlock.w / 2) * 20;
          
          // Create path along the spine
          const pathY = spineY * 20 + (seqIndex - 1) * 8; // Offset different flows vertically
          
          // Spine segment path
          paths.push(
            <Line
              key={`spine-flow-${seqIndex}-${i}`}
              points={[fromX, pathY, toX, pathY]}
              stroke={sequence.color}
              strokeWidth={sequence.width}
              opacity={0.7}
              lineCap="round"
              dash={[20, 10]}
              dashOffset={-animationTime * 30}
            />
          );

          // Flow direction arrows
          const midX = (fromX + toX) / 2;
          paths.push(
            <Group key={`spine-arrow-${seqIndex}-${i}`}>
              <Line
                points={[
                  midX - 10, pathY - 5,
                  midX + 10, pathY,
                  midX - 10, pathY + 5
                ]}
                stroke={sequence.color}
                strokeWidth={sequence.width - 1}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />
            </Group>
          );

          // Moving materials along spine
          const t = (animationTime + seqIndex * 2 + i) % 8 / 8;
          const materialX = fromX + t * (toX - fromX);
          paths.push(
            <Circle
              key={`spine-material-${seqIndex}-${i}`}
              x={materialX}
              y={pathY}
              radius={sequence.width - 2}
              fill={sequence.color}
              opacity={0.8}
              shadowBlur={4}
              shadowColor={sequence.color}
            />
          );
        }
      }

      // Flow sequence label
      const firstBlock = currentPlan.blocks.find(b => b.key === sequence.path[0]);
      const lastBlock = currentPlan.blocks.find(b => b.key === sequence.path[sequence.path.length - 1]);
      
      if (firstBlock && lastBlock) {
        const labelX = ((firstBlock.x + lastBlock.x + lastBlock.w) / 2) * 20;
        const labelY = spineY * 20 + (seqIndex - 1) * 8 - 15;
        
        paths.push(
          <Group key={`spine-label-${seqIndex}`}>
            <Rect
              x={labelX - 30}
              y={labelY - 8}
              width={60}
              height={16}
              fill="rgba(255, 255, 255, 0.95)"
              stroke={sequence.color}
              strokeWidth={1}
              cornerRadius={8}
            />
            <Text
              x={labelX}
              y={labelY - 2}
              text={sequence.label}
              fontSize={9}
              fontFamily="Inter, sans-serif"
              fontWeight="600"
              fill={sequence.color}
              align="center"
              width={60}
            />
          </Group>
        );
      }
    });

    return paths;
  };

  const renderConstraints = () => {
    if (!currentPlan || !canvasState.showConstraints) return null;

    const constraints = [];
    
    // Include spine flow paths
    constraints.push(...renderSpineFlowPaths());

    // Safety zones and clearances
    currentPlan.blocks.forEach((block, index) => {
      if (block.key === 'aisle') {
        const pixelX = block.x * 20;
        const pixelY = block.y * 20;
        const pixelW = block.w * 20;
        const pixelH = block.h * 20;
        
        // Forklift turning radius indicators
        constraints.push(
          <Circle
            key={`turn-radius-start-${index}`}
            x={pixelX + 30}
            y={pixelY + pixelH/2}
            radius={25}
            stroke="#fbbf24"
            strokeWidth={2}
            dash={[8, 4]}
            opacity={0.5}
          />
        );
        constraints.push(
          <Circle
            key={`turn-radius-end-${index}`}
            x={pixelX + pixelW - 30}
            y={pixelY + pixelH/2}
            radius={25}
            stroke="#fbbf24"
            strokeWidth={2}
            dash={[8, 4]}
            opacity={0.5}
          />
        );
        
        // Speed limit zones
        constraints.push(
          <Text
            key={`speed-limit-${index}`}
            x={pixelX + pixelW/2}
            y={pixelY + 10}
            text="10 km/h"
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fontWeight="600"
            fill="#dc2626"
            align="center"
          />
        );
      }
      
      // Equipment safety clearances
      if (['pallet_asrs', 'tote_asrs', 'palletizer', 'depalletizer'].includes(block.key)) {
        const pixelX = block.x * 20;
        const pixelY = block.y * 20;
        const pixelW = block.w * 20;
        const pixelH = block.h * 20;
        
        constraints.push(
          <Rect
            key={`safety-zone-${index}`}
            x={pixelX - 10}
            y={pixelY - 10}
            width={pixelW + 20}
            height={pixelH + 20}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2}
            dash={[6, 6]}
            opacity={0.4}
          />
        );
      }
    });

    return constraints;
  };

  const renderRulers = () => {
    if (!canvasState.showMeasurements) return null;
    
    // TODO: Implement rulers
    return null;
  };

  return (
    <div className="relative h-full bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 overflow-hidden">
      {/* Canvas Toolbar */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute top-4 left-4 z-10 flex items-center space-x-2"
      >
        <div className="flex items-center space-x-1 bg-card/90 backdrop-blur-sm rounded-lg border border-border/50 p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                className="h-8 w-8 p-0"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <div className="px-2 text-xs font-mono text-muted-foreground">
            {Math.round(canvasState.zoom * 100)}%
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border/50" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={canvasState.showGrid ? "default" : "ghost"}
                size="sm"
                onClick={toggleGrid}
                className="h-8 w-8 p-0"
              >
                <Grid className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={canvasState.snapToGrid ? "default" : "ghost"}
                size="sm"
                onClick={toggleSnap}
                className="h-8 w-8 p-0"
              >
                <Move className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Snap to Grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={canvasState.showConstraints ? "default" : "ghost"}
                size="sm"
                onClick={toggleConstraints}
                className="h-8 w-8 p-0"
              >
                <Route className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Show Constraints & Paths</TooltipContent>
          </Tooltip>
        </div>

        {canvasState.selectedBlockIds.length > 0 && (
          <div className="flex items-center space-x-1 bg-card/90 backdrop-blur-sm rounded-lg border border-border/50 p-1">
            <Badge variant="info" className="text-xs">
              {canvasState.selectedBlockIds.length} selected
            </Badge>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Canvas Stats */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute top-4 right-4 z-10"
      >
        <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border/50 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Blocks:</span>
            <span className="font-medium">{currentPlan?.blocks.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Score:</span>
            <span className="font-medium">{currentPlan?.score.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      </motion.div>

      {/* Main Canvas */}
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={canvasState.zoom}
        scaleY={canvasState.zoom}
        x={canvasState.pan.x}
        y={canvasState.pan.y}
        onWheel={handleWheel}
        onClick={handleStageClick}
        draggable={!isDragging && !isResizing}
      >
        <Layer>
          {/* Warehouse Floor */}
          {renderWarehouseFloor()}
          
          {/* Grid */}
          {renderGrid()}
          
          {/* Central Spine - The main material highway */}
          {renderCentralSpine()}
          
          {/* Equipment Connections to Spine */}
          {renderEquipmentConnections()}
          
          {/* Constraints and Flow Paths */}
          {renderConstraints()}
          
          {/* Rulers */}
          {renderRulers()}
          
          {/* Equipment */}
          {currentPlan?.blocks.map(renderBlock)}
        </Layer>
      </Stage>

      {/* Empty State */}
      {!currentPlan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-gradient-warehouse rounded-2xl mx-auto flex items-center justify-center shadow-glow-warehouse">
              <Grid className="w-12 h-12 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Ready to Design
              </h3>
              <p className="text-muted-foreground max-w-md">
                Start by describing your warehouse requirements in the chat. 
                I'll help you create an optimized layout.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CanvasPanel;