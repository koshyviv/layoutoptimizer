import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';
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
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { Block, MODULE_DEFINITIONS } from '@/lib/types';
import { cn, snapToGrid } from '@/lib/utils';
import Konva from 'konva';

// Interactive 2D canvas with warehouse layout editor
const CanvasPanel: React.FC = () => {
  const {
    currentPlan,
    canvasState,
    updateCanvasState,
    updateBlock,
    setSelectedBlocks,
    clearSelection
  } = useAppStore();

  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);

  // Update stage size on window resize
  useEffect(() => {
    const updateSize = () => {
      const container = stageRef.current?.container();
      if (container) {
        const { offsetWidth, offsetHeight } = container.parentElement!;
        setStageSize({ width: offsetWidth, height: offsetHeight });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
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
    const snappedX = canvasState.snapToGrid ? snapToGrid(x, canvasState.gridSize) : x;
    const snappedY = canvasState.snapToGrid ? snapToGrid(y, canvasState.gridSize) : y;
    
    updateBlock(blockId, { x: snappedX, y: snappedY });
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

  const renderBlock = (block: Block) => {
    const moduleInfo = MODULE_DEFINITIONS[block.key];
    const isSelected = canvasState.selectedBlockIds.includes(block.id);
    
    // Convert meters to pixels (20px per meter)
    const pixelX = block.x * 20;
    const pixelY = block.y * 20;
    const pixelW = block.w * 20;
    const pixelH = block.h * 20;

    return (
      <Group
        key={block.id}
        x={pixelX}
        y={pixelY}
        draggable
        onClick={(e) => handleBlockClick(block.id, e)}
        onDragMove={(e) => handleBlockDragMove(block.id, e)}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
      >
        {/* Main block rectangle */}
        <Rect
          width={pixelW}
          height={pixelH}
          fill={moduleInfo?.color || '#94a3b8'}
          stroke={isSelected ? '#3b82f6' : '#64748b'}
          strokeWidth={isSelected ? 3 : 1}
          cornerRadius={8}
          shadowBlur={isSelected ? 10 : 5}
          shadowColor={isSelected ? '#3b82f6' : '#00000020'}
          shadowOffset={{ x: 0, y: 2 }}
          opacity={0.9}
        />
        
        {/* Block label */}
        <Text
          x={8}
          y={8}
          text={moduleInfo?.name || block.key}
          fontSize={12}
          fontFamily="Inter, sans-serif"
          fontStyle="600"
          fill="white"
          shadowBlur={2}
          shadowColor="#00000080"
        />
        
        {/* Block dimensions */}
        <Text
          x={8}
          y={pixelH - 24}
          text={`${block.w}×${block.h}m`}
          fontSize={10}
          fontFamily="Inter, sans-serif"
          fill="white"
          opacity={0.8}
        />
        
        {/* Block icon/emoji */}
        {moduleInfo?.icon && (
          <Text
            x={pixelW - 24}
            y={8}
            text={moduleInfo.icon}
            fontSize={16}
          />
        )}
        
        {/* Selection handles */}
        {isSelected && (
          <>
            {/* Corner handles */}
            {[
              { x: 0, y: 0 },
              { x: pixelW - 6, y: 0 },
              { x: pixelW - 6, y: pixelH - 6 },
              { x: 0, y: pixelH - 6 }
            ].map((pos, i) => (
              <Rect
                key={i}
                x={pos.x}
                y={pos.y}
                width={6}
                height={6}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </>
        )}
      </Group>
    );
  };

  const renderRulers = () => {
    if (!canvasState.showMeasurements) return null;
    
    // TODO: Implement rulers
    return null;
  };

  return (
    <div className="relative h-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
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
        draggable={!isDragging}
      >
        <Layer>
          {/* Grid */}
          {renderGrid()}
          
          {/* Rulers */}
          {renderRulers()}
          
          {/* Blocks */}
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