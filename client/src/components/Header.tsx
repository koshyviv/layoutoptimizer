import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutGrid, 
  Zap, 
  Download, 
  Settings, 
  HelpCircle,
  Sparkles,
  Play
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { createDemoPlan, createDemoOptimizationResult } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

const Header: React.FC = () => {
  const { 
    currentPlan, 
    optimizationResult, 
    isLoading,
    setPlan,
    setOptimizationResult,
    addMessage
  } = useAppStore();
  const hasOptimizations = optimizationResult?.plans.length > 0;

  const loadDemo = () => {
    const demoPlan = createDemoPlan();
    const demoOptimization = createDemoOptimizationResult();
    
    setPlan(demoPlan);
    setOptimizationResult(demoOptimization);
    
    addMessage({
      role: 'assistant',
      content: '🎉 Here\'s your optimized warehouse layout! I\'ve designed a 120×64m facility handling 75 pallets/hour in and out, with integrated ASRS systems and GTP stations. The layout achieves an 84.7% optimization score with excellent safety compliance.',
      type: 'plan'
    });
  };

  return (
    <motion.header 
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="h-16 bg-card/95 backdrop-blur-md border-b border-border/50 px-6 flex items-center justify-between"
    >
      {/* Logo and Title */}
      <div className="flex items-center space-x-4">
        <motion.div
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          className="w-10 h-10 bg-gradient-warehouse rounded-lg flex items-center justify-center shadow-glow-warehouse"
        >
          <LayoutGrid className="w-5 h-5 text-white" />
        </motion.div>
        
        <div>
          <h1 className="text-xl font-bold text-gradient-warehouse">
            WarehouseAI
          </h1>
          <p className="text-xs text-muted-foreground">
            AI-Powered Layout Optimization
          </p>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center space-x-3">
        {currentPlan && (
          <Badge variant="success" className="animate-fade-in">
            <Sparkles className="w-3 h-3 mr-1" />
            Layout Ready
          </Badge>
        )}
        
        {hasOptimizations && (
          <Badge variant="info" className="animate-fade-in">
            {optimizationResult.plans.length} Variants
          </Badge>
        )}
        
        {isLoading && (
          <Badge variant="warning" className="animate-pulse">
            <div className="w-2 h-2 bg-current rounded-full animate-pulse mr-2" />
            Processing
          </Badge>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {!currentPlan && (
          <Button
            variant="warehouse"
            size="sm"
            onClick={loadDemo}
            className="animate-pulse-glow"
          >
            <Play className="w-4 h-4 mr-2" />
            Try Demo
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="interactive-subtle"
          disabled={!currentPlan || isLoading}
        >
          <Zap className="w-4 h-4 mr-2" />
          Optimize
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="interactive-subtle"
          disabled={!currentPlan}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        
        <div className="w-px h-6 bg-border/50" />
        
        <Button
          variant="ghost"
          size="sm"
          className="interactive-subtle"
        >
          <Settings className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="interactive-subtle"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
      </div>
    </motion.header>
  );
};

export default Header;
