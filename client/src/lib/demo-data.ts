import { Plan, Block } from './types';
import { generateId } from './utils';

// Demo data to showcase the UI without backend
export const createDemoPlan = (): Plan => {
  return createDemoPlanVariant('A');
};

export const createDemoPlanVariant = (variant: 'A' | 'B' | 'C'): Plan => {
  // Create a deliberately suboptimal starting layout for dramatic optimization gains
  if (variant === 'A') {
    return createSuboptimalStartingLayout();
  }
  
  // Base offsets for optimized variants
  const variantOffsets = {
    B: { x: 0, y: 0 },
    C: { x: 1, y: -1 }
  };
  
  const offset = variantOffsets[variant];
  
  // OPTIMIZED LAYOUTS - SPINE-AWARE POSITIONING (spine at y=30, height=6)
  const blocks: Block[] = [
    {
      id: generateId(),
      key: 'inbound',
      x: 4 + offset.x,
      y: 5 + offset.y, // ABOVE spine
      w: 20,
      h: 10,
      meta: {
        kpis: {
          throughput: 85,
          utilization: 0.92
        },
        notes: ['Receiving dock area', '4 dock doors']
      }
    },
    {
      id: generateId(),
      key: 'depalletizer',
      x: 28 + offset.x,
      y: 5 + offset.y, // ABOVE spine, adjacent to inbound
      w: 10,
      h: 8,
      meta: {
        kpis: {
          throughput: 85,
          efficiency: 0.96
        }
      }
    },
    {
      id: generateId(),
      key: 'pallet_asrs',
      x: 42 + offset.x,
      y: 5 + offset.y, // ABOVE spine, near depalletizer
      w: 28,
      h: 20,
      meta: {
        kpis: {
          capacity: 12000,
          utilization: 0.85,
          throughput: 140
        },
        notes: ['12K pallet positions', 'Automated crane system']
      }
    },
    {
      id: generateId(),
      key: 'tote_asrs',
      x: 74 + offset.x,
      y: 5 + offset.y, // ABOVE spine
      w: 20,
      h: 20,
      meta: {
        kpis: {
          capacity: 6000,
          utilization: 0.88,
          throughput: 220
        }
      }
    },
    {
      id: generateId(),
      key: 'gtp',
      x: 74 + offset.x,
      y: 40 + offset.y, // BELOW spine, near tote_asrs
      w: 20,
      h: 12,
      meta: {
        kpis: {
          stations: 6,
          throughput: 200,
          efficiency: 0.94
        }
      }
    },
    {
      id: generateId(),
      key: 'picking',
      x: 30 + offset.x,
      y: 40 + offset.y, // BELOW spine
      w: 24,
      h: 14,
      meta: {
        kpis: {
          zones: 10,
          throughput: 170,
          accuracy: 0.997
        }
      }
    },
    {
      id: generateId(),
      key: 'consolidation',
      x: 58 + offset.x,
      y: 40 + offset.y, // BELOW spine, near picking
      w: 14,
      h: 12,
      meta: {
        kpis: {
          stations: 5,
          throughput: 160
        }
      }
    },
    {
      id: generateId(),
      key: 'outbound',
      x: 4 + offset.x,
      y: 40 + offset.y, // BELOW spine
      w: 20,
      h: 10,
      meta: {
        kpis: {
          throughput: 95,
          docks: 4
        },
        notes: ['Shipping dock area', '4 dock doors']
      }
    }
  ];

  // Variant-specific scores and findings
  const variantData = {
    A: {
      score: 0.623,
      scores: { travel: 0.58, adj: 0.64, safety: 0.72, compact: 0.56 },
      findings: [
        'Suboptimal layout with poor adjacencies',
        'High travel distances between related stations',
        'Inefficient space utilization'
      ]
    },
    B: {
      score: 0.891,
      scores: { travel: 0.89, adj: 0.92, safety: 0.94, compact: 0.82 },
      findings: [
        'Optimized adjacency between inbound and depalletizer',
        'Reduced travel distances by 34%',
        'Improved material flow efficiency',
        'Enhanced safety clearances'
      ]
    },
    C: {
      score: 0.874,
      scores: { travel: 0.86, adj: 0.88, safety: 0.96, compact: 0.84 },
      findings: [
        'Alternative layout with compact footprint',
        'Excellent safety compliance',
        'Good adjacency optimization',
        'Space-efficient design'
      ]
    }
  };

  const data = variantData[variant];

  return {
    id: `demo-plan-${variant.toLowerCase()}`,
    blocks,
    score: data.score,
    scores: data.scores,
    ruleFindings: data.findings
  };
};

// Create deliberately suboptimal starting layout - AVOIDING CENTRAL SPINE AT Y=30
function createSuboptimalStartingLayout(): Plan {
  const blocks: Block[] = [
    {
      id: generateId(),
      key: 'inbound',
      x: 5,
      y: 5,
      w: 18,
      h: 8,
      meta: {
        kpis: {
          throughput: 65,
          utilization: 0.72
        }
      }
    },
    {
      id: generateId(),
      key: 'depalletizer',
      x: 70, // Far from inbound - bad adjacency, ABOVE spine
      y: 5,
      w: 10,
      h: 8,
      meta: {
        kpis: {
          throughput: 65,
          efficiency: 0.78
        }
      }
    },
    {
      id: generateId(),
      key: 'pallet_asrs',
      x: 85, // Far from depalletizer, ABOVE spine
      y: 15,
      w: 20,
      h: 12,
      meta: {
        kpis: {
          capacity: 10000,
          utilization: 0.68,
          throughput: 95
        }
      }
    },
    {
      id: generateId(),
      key: 'tote_asrs',
      x: 5, // Poor placement, BELOW spine
      y: 40,
      w: 18,
      h: 10,
      meta: {
        kpis: {
          capacity: 5000,
          utilization: 0.75,
          throughput: 180
        }
      }
    },
    {
      id: generateId(),
      key: 'gtp',
      x: 85, // Far from tote_asrs, BELOW spine
      y: 40,
      w: 14,
      h: 8,
      meta: {
        kpis: {
          stations: 4,
          throughput: 150,
          efficiency: 0.82
        }
      }
    },
    {
      id: generateId(),
      key: 'picking',
      x: 30,
      y: 5, // ABOVE spine
      w: 20,
      h: 12,
      meta: {
        kpis: {
          zones: 8,
          throughput: 120,
          accuracy: 0.992
        }
      }
    },
    {
      id: generateId(),
      key: 'consolidation',
      x: 55,
      y: 40, // BELOW spine
      w: 16,
      h: 10,
      meta: {
        kpis: {
          stations: 4,
          throughput: 110
        }
      }
    },
    {
      id: generateId(),
      key: 'outbound',
      x: 30, // Poor position, BELOW spine
      y: 55,
      w: 18,
      h: 8,
      meta: {
        kpis: {
          throughput: 70,
          docks: 3
        }
      }
    }
  ];

  return {
    id: 'demo-plan-a',
    blocks,
    score: 0.623,
    scores: { travel: 0.58, adj: 0.64, safety: 0.72, compact: 0.56 },
    ruleFindings: [
      'Suboptimal layout with poor adjacencies',
      'High travel distances between related stations',
      'Inefficient space utilization'
    ]
  };
}

export const createDemoOptimizationResult = () => {
  const plans = [
    createDemoPlanVariant('B'), // Best optimized
    createDemoPlanVariant('C'), // Alternative
    createSuboptimalStartingLayout() // Show original for comparison
  ];
  
  return {
    plans,
    selectedPlanId: 'demo-plan-b',
    isOptimizing: false
  };
};

export const createDemoOptimizationResultOld = () => {
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
