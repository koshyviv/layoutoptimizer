import { Plan, Block } from './types';
import { generateId } from './utils';

// Demo data to showcase the UI without backend
export const createDemoPlan = (): Plan => {
  const blocks: Block[] = [
    {
      id: generateId(),
      key: 'inbound',
      x: 4,
      y: 6,
      w: 24,
      h: 12,
      meta: {
        kpis: {
          throughput: 75,
          utilization: 0.85
        },
        notes: ['Receiving dock area', '6 dock doors']
      }
    },
    {
      id: generateId(),
      key: 'depalletizer',
      x: 30,
      y: 8,
      w: 12,
      h: 8,
      meta: {
        kpis: {
          throughput: 75,
          efficiency: 0.92
        }
      }
    },
    {
      id: generateId(),
      key: 'pallet_asrs',
      x: 4,
      y: 22,
      w: 32,
      h: 18,
      meta: {
        kpis: {
          capacity: 15000,
          utilization: 0.78,
          throughput: 120
        },
        notes: ['15K pallet positions', 'Automated crane system']
      }
    },
    {
      id: generateId(),
      key: 'tote_asrs',
      x: 40,
      y: 22,
      w: 24,
      h: 12,
      meta: {
        kpis: {
          capacity: 8000,
          utilization: 0.82,
          throughput: 200
        }
      }
    },
    {
      id: generateId(),
      key: 'gtp',
      x: 68,
      y: 18,
      w: 18,
      h: 12,
      meta: {
        kpis: {
          stations: 8,
          throughput: 180,
          efficiency: 0.88
        }
      }
    },
    {
      id: generateId(),
      key: 'picking',
      x: 38,
      y: 44,
      w: 26,
      h: 16,
      meta: {
        kpis: {
          zones: 12,
          throughput: 150,
          accuracy: 0.995
        }
      }
    },
    {
      id: generateId(),
      key: 'consolidation',
      x: 68,
      y: 44,
      w: 20,
      h: 14,
      meta: {
        kpis: {
          stations: 6,
          throughput: 140
        }
      }
    },
    {
      id: generateId(),
      key: 'palletizer',
      x: 92,
      y: 48,
      w: 12,
      h: 8,
      meta: {
        kpis: {
          throughput: 85,
          efficiency: 0.94
        }
      }
    },
    {
      id: generateId(),
      key: 'outbound',
      x: 92,
      y: 6,
      w: 24,
      h: 12,
      meta: {
        kpis: {
          throughput: 85,
          docks: 8
        },
        notes: ['Shipping dock area', '8 dock doors']
      }
    },
    {
      id: generateId(),
      key: 'charging',
      x: 90,
      y: 32,
      w: 8,
      h: 6,
      meta: {
        kpis: {
          stations: 4,
          capacity: 20
        }
      }
    },
    {
      id: generateId(),
      key: 'qc',
      x: 4,
      y: 44,
      w: 16,
      h: 10,
      meta: {
        kpis: {
          stations: 3,
          throughput: 50
        }
      }
    },
    {
      id: generateId(),
      key: 'maintenance',
      x: 24,
      y: 44,
      w: 12,
      h: 8,
      meta: {
        kpis: {
          bays: 2,
          utilization: 0.65
        }
      }
    }
  ];

  return {
    id: 'demo-plan-a',
    blocks,
    score: 0.847,
    scores: {
      travel: 0.82,
      adj: 0.89,
      safety: 0.91,
      compact: 0.78
    },
    ruleFindings: [
      'All OSHA safety clearances met',
      'Forklift aisle widths comply with WA truck specifications',
      'Consider 6" flue spaces for optimal fire safety'
    ]
  };
};

export const createDemoOptimizationResult = () => {
  const basePlan = createDemoPlan();
  
  return {
    plans: [
      basePlan,
      {
        ...basePlan,
        id: 'demo-plan-b',
        score: 0.823,
        scores: {
          travel: 0.78,
          adj: 0.85,
          safety: 0.93,
          compact: 0.82
        }
      },
      {
        ...basePlan,
        id: 'demo-plan-c',
        score: 0.801,
        scores: {
          travel: 0.85,
          adj: 0.81,
          safety: 0.88,
          compact: 0.75
        }
      }
    ],
    selectedPlanId: 'demo-plan-a',
    isOptimizing: false
  };
};
