import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap,
  Target,
  Shield,
  Maximize,
  Route,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { formatNumber, formatPercentage, getColorForScore, getBgColorForScore } from '@/lib/utils';

// Modern insights panel with KPI dashboards and visualizations
const InsightsPanel: React.FC = () => {
  const { 
    currentPlan, 
    optimizationResult, 
    validationResult,
    selectPlan,
    isSidebarCollapsed,
    setSidebarCollapsed
  } = useAppStore();

  // Mock data for demonstration - in real app this comes from the plan
  const kpiData = currentPlan ? {
    travel: currentPlan.scores.travel,
    adjacency: currentPlan.scores.adj,
    safety: currentPlan.scores.safety,
    compactness: currentPlan.scores.compact,
    overall: currentPlan.score
  } : null;

  const radarData = kpiData ? [
    { subject: 'Travel', A: kpiData.travel * 100, fullMark: 100, id: 'travel' },
    { subject: 'Adjacency', A: kpiData.adjacency * 100, fullMark: 100, id: 'adjacency' },
    { subject: 'Safety', A: kpiData.safety * 100, fullMark: 100, id: 'safety' },
    { subject: 'Compactness', A: kpiData.compactness * 100, fullMark: 100, id: 'compactness' },
  ] : [];

  const planComparison = optimizationResult?.plans.slice(0, 3).map((plan, index) => ({
    name: `Plan ${String.fromCharCode(65 + index)}`,
    travel: plan.scores.travel * 100,
    adjacency: plan.scores.adj * 100,
    safety: plan.scores.safety * 100,
    compactness: plan.scores.compact * 100,
    overall: plan.score * 100,
  })) || [];

  const throughputData = [
    { time: '6AM', pallets: 45, totes: 120 },
    { time: '9AM', pallets: 75, totes: 180 },
    { time: '12PM', pallets: 85, totes: 200 },
    { time: '3PM', pallets: 70, totes: 160 },
    { time: '6PM', pallets: 55, totes: 140 },
    { time: '9PM', pallets: 30, totes: 80 },
  ];

  const KPICard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color = "blue" 
  }: {
    title: string;
    value: number;
    change?: number;
    icon: any;
    color?: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="interactive"
    >
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg bg-${color}-100 text-${color}-600 flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{formatPercentage(value)}</p>
              </div>
            </div>
            {change !== undefined && (
              <div className={`flex items-center space-x-1 ${change >= 0 ? 'text-success-600' : 'text-safety-600'}`}>
                {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  {change >= 0 ? '+' : ''}{formatPercentage(Math.abs(change))}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3">
            <Progress 
              value={value * 100} 
              className={`h-2 ${getBgColorForScore(value)}`}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const ValidationItem = ({ 
    type, 
    message, 
    suggestion 
  }: {
    type: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }) => {
    const icons = {
      error: AlertTriangle,
      warning: AlertTriangle,
      info: CheckCircle
    };
    const colors = {
      error: 'text-safety-600 bg-safety-100',
      warning: 'text-yellow-600 bg-yellow-100', 
      info: 'text-success-600 bg-success-100'
    };
    const Icon = icons[type];

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${colors[type]}`}>
          <Icon className="w-3 h-3" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{message}</p>
          {suggestion && (
            <p className="text-xs text-muted-foreground mt-1">{suggestion}</p>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-sm border-l border-border/50 w-full">
      {/* Collapse/Expand Button */}
      <div className="absolute top-4 -left-3 z-20">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          className="h-8 w-6 p-0 bg-card border border-border/50 shadow-sm hover:shadow-md"
        >
          {isSidebarCollapsed ? 
            <ChevronLeft className="w-3 h-3" /> : 
            <ChevronRight className="w-3 h-3" />
          }
        </Button>
      </div>

      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <BarChart className="w-4 h-4 text-white" />
          </div>
          {!isSidebarCollapsed && (
            <div>
              <h2 className="font-semibold text-foreground">Insights</h2>
              <p className="text-xs text-muted-foreground">Performance Analytics</p>
            </div>
          )}
        </div>
        {!isSidebarCollapsed && currentPlan && (
          <Badge variant="info" className="text-xs">
            Plan {currentPlan.id}
          </Badge>
        )}
      </div>

      {/* Content */}
      {!isSidebarCollapsed && (
        <div className="panel-content p-4 space-y-6">
        {/* KPI Cards */}
        {kpiData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Key Performance Indicators</h3>
            <div className="grid grid-cols-2 gap-3">
              <KPICard
                title="Travel Efficiency"
                value={kpiData.travel}
                icon={Route}
                color="blue"
                change={0.05}
              />
              <KPICard
                title="Adjacency Score"
                value={kpiData.adjacency}
                icon={Target}
                color="green"
                change={-0.02}
              />
              <KPICard
                title="Safety Compliance"
                value={kpiData.safety}
                icon={Shield}
                color="red"
                change={0.08}
              />
              <KPICard
                title="Space Utilization"
                value={kpiData.compactness}
                icon={Maximize}
                color="purple"
                change={0.03}
              />
            </div>

            {/* Overall Score */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Overall Score</CardTitle>
                <CardDescription>Weighted composite of all metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl font-bold text-gradient-warehouse">
                    {formatPercentage(kpiData.overall)}
                  </span>
                  <Badge variant="success" className="text-sm">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Excellent
                  </Badge>
                </div>
                <Progress value={kpiData.overall * 100} className="h-3" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Performance Radar */}
        {radarData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Performance Profile</CardTitle>
                <CardDescription>Multi-dimensional analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10 }}
                      tickCount={6}
                    />
                    <Radar 
                      name="Score" 
                      dataKey="A" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Plan Comparison */}
        {planComparison.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Plan Comparison</CardTitle>
                <CardDescription>Compare optimization alternatives</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={planComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value: any) => [`${value.toFixed(1)}%`, '']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar dataKey="overall" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center mt-3 space-x-2">
                  {planComparison.map((plan, index) => {
                    const planId = optimizationResult?.plans[index]?.id;
                    const isSelected = currentPlan?.id === planId;
                    return (
                      <Button
                        key={plan.name}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => planId && selectPlan(planId)}
                      >
                        {plan.name}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Throughput Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Throughput Capacity</CardTitle>
              <CardDescription>Daily volume handling</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="pallets" 
                    stackId="1" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totes" 
                    stackId="1" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-center mt-3 space-x-4 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>Pallets/hr</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Totes/hr</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Validation Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Validation Results</CardTitle>
              <CardDescription>Rule compliance and recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {validationResult?.findings.length > 0 ? (
                validationResult.findings.map((finding, index) => (
                  <ValidationItem
                    key={index}
                    type={finding.type}
                    message={finding.message}
                    suggestion={finding.suggestion}
                  />
                ))
              ) : currentPlan ? (
                <>
                  <ValidationItem
                    type="info"
                    message="All safety clearances met"
                    suggestion="OSHA 1910.176 compliance verified"
                  />
                  <ValidationItem
                    type="info"
                    message="Forklift aisle widths adequate"
                    suggestion="13 ft aisles for wide-aisle trucks"
                  />
                  <ValidationItem
                    type="warning"
                    message="Consider fire safety spacing"
                    suggestion="6 inch flue spaces recommended for sprinkler systems"
                  />
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Validation results will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Empty State */}
        {!currentPlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <BarChart className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No Data Yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Start a conversation to generate your first warehouse layout and see detailed insights here.
            </p>
          </motion.div>
        )}
        </div>
      )}
    </div>
  );
};

export default InsightsPanel;