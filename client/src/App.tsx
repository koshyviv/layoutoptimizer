import React from 'react';
import { motion } from 'framer-motion';
import ChatPanel from './components/ChatPanel';
import CanvasPanel from './components/CanvasPanel';
import InsightsPanel from './components/InsightsPanel';
import Header from './components/Header';
import { useAppStore } from '@/lib/store';

// Main application component with modern three-panel layout inspired by YC companies
const App: React.FC = () => {
  const { isLoading, isSidebarCollapsed } = useAppStore();

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />
      
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel - Left (28% as per requirements) */}
        <motion.div 
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-[28%] panel border-r border-border/50 bg-card/95 backdrop-blur-sm"
        >
          <ChatPanel />
        </motion.div>

        {/* Canvas Panel - Center (flex-1) */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="flex-1 relative bg-background overflow-hidden"
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
            opacity: 1,
            width: isSidebarCollapsed ? '60px' : '24%'
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="panel overflow-hidden"
        >
          <InsightsPanel />
        </motion.div>
      </div>
    </div>
  );
};

export default App;