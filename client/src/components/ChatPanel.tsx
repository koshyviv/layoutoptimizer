import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { apiService } from '@/lib/api';
import { cn } from '@/lib/utils';

// Modern conversational chat panel with AI assistant
const ChatPanel: React.FC = () => {
  const { 
    chatMessages, 
    addMessage, 
    setLoading, 
    isLoading 
  } = useAppStore();
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    addMessage({
      role: 'user',
      content: userMessage,
      type: 'text'
    });

    setLoading(true);
    setIsTyping(true);

    try {
      // Simulate AI processing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const response = await apiService.chat(userMessage, {
        messages: chatMessages
      });
      
      setIsTyping(false);
      
      // Add AI response
      addMessage({
        role: 'assistant',
        content: response.message,
        type: response.action || 'text'
      });
      
      // Handle any actions triggered by the AI
      if (response.action && response.data) {
        // TODO: Handle synthesize, optimize, validate actions
        console.log('AI Action:', response.action, response.data);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      setIsTyping(false);
      addMessage({
        role: 'assistant',
        content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
        type: 'text'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    "I need help with a 75 pallet/hour warehouse",
    "Show me GTP and ASRS options",
    "Optimize for safety and efficiency"
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-warehouse rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">Warehouse Layout Expert</p>
          </div>
        </div>
        <Badge variant="success" className="text-xs">
          <div className="w-2 h-2 bg-success-500 rounded-full mr-2" />
          Online
        </Badge>
      </div>

      {/* Messages */}
      <div className="panel-content px-4 py-4">
        <div className="space-y-4">
          <AnimatePresence>
            {chatMessages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div className={cn(
                  "flex items-start space-x-3 max-w-[85%]",
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                )}>
                  {/* Avatar */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-warehouse-100 text-warehouse-700'
                  )}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  
                  {/* Message Bubble */}
                  <div className={cn(
                    "rounded-2xl px-4 py-3 shadow-sm",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-muted-foreground rounded-bl-md'
                  )}>
                    {message.role === 'assistant' ? (
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-code:text-inherit prose-pre:bg-muted/50 prose-pre:text-inherit">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                    {message.type !== 'text' && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {message.type}
                      </Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex justify-start"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-warehouse-100 text-warehouse-700 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Actions */}
        {chatMessages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 space-y-2"
          >
            <p className="text-xs text-muted-foreground font-medium mb-3">
              Quick Start:
            </p>
            {quickActions.map((action, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                onClick={() => setInput(action)}
                className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-between group"
              >
                <span>{action}</span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex space-x-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your warehouse requirements..."
            className="flex-1 resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;