import React from 'react';
import { motion } from 'framer-motion';
import ChatPanel from './components/ChatPanel';
import CanvasPanel from './components/CanvasPanel';
import InsightsPanel from './components/InsightsPanel';
import Header from './components/Header';
import { useAppStore } from '@/lib/store';

// Main application component with modern three-panel layout inspired by YC companies
const App: React.FC = () => {
  const { isLoading, isSidebarCollapsed, isChatSidebarCollapsed } = useAppStore();

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />
      
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel - Left (28% as per requirements, collapsible) */}
        <motion.div 
          initial={{ x: -300, opacity: 0 }}
          animate={{ 
            x: 0, 
            opacity: 1
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`panel border-r border-border/50 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 ease-in-out ${
            isChatSidebarCollapsed ? 'w-[60px] min-w-[60px] max-w-[60px]' : 'w-[28%] min-w-[300px]'
          }`}
        >
          <ChatPanel />
        </motion.div>

        {/* Canvas Panel - Center (flex-1) */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="flex-1 relative bg-background overflow-hidden min-w-0"
          style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%' }}
        >
          <CanvasPanel />
          
          {/* Loading overlay */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-lg font-medium text-muted-foreground">
                  Optimizing layout...
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Insights Panel - Right (responsive width) */}
        <motion.div 
          initial={{ x: 300, opacity: 0 }}
          animate={{ 
            x: 0, 
            opacity: 1
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`panel overflow-hidden transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? 'w-[60px] min-w-[60px] max-w-[60px]' : 'w-[24%] min-w-[280px]'
          }`}
        >
          <InsightsPanel />
        </motion.div>
      </div>
    </div>
  );
};

export default App;