import express from 'express';
import cors from 'cors';
import fs from 'fs';
import yaml from 'yaml';
import OpenAI from 'openai';

// Initialise the Express application
const app = express();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enable JSON body parsing and allow cross‑origin requests so the
// browser client can access the API while running on a different port.
app.use(cors());
app.use(express.json());

// Load rules from the YAML file.  These rules can be tweaked in
// `server/rules.yaml` without changing code.  If the file is missing
// or invalid the server will continue with an empty object.
let rules = {};
try {
  const raw = fs.readFileSync(new URL('./rules.yaml', import.meta.url), 'utf8');
  rules = yaml.parse(raw);
} catch (err) {
  console.warn('Warning: failed to load rules.yaml', err.message);
}

// -------------------------------
// Helper: simple tool functions
// -------------------------------
// Unit helpers
const FEET_TO_METERS = 0.3048;
const INCH_TO_METERS = 0.0254;

function coalesceNumber(value, fallback) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

// Estimate areas from throughput using YAML coefficients
function estimateAreasTool({ request }) {
  const coeff = rules?.area_coefficients || {};
  const t = request?.t || {};
  const areas = {
    pallet_asrs: coalesceNumber(t.palletsInPerH, 0) * coalesceNumber(coeff.pallet_asrs, 0.8),
    tote_asrs: coalesceNumber(t.totesPerH, 0) * coalesceNumber(coeff.tote_asrs, 0.3),
    gtp: coalesceNumber(t.totesPerH, 0) * coalesceNumber(coeff.gtp, 0.05),
    picking: coalesceNumber(t.ordersPerH, 0) * coalesceNumber(coeff.picking, 0.1),
    consolidation: coalesceNumber(t.ordersPerH, 0) * coalesceNumber(coeff.consolidation, 0.08),
  };
  return { areas };
}

// Generate an initial macro plan (very simple shelf-line packing along a main aisle)
function generateInitialPlanTool({ request }) {
  const site = request?.site || { widthM: 96, heightM: 54 };
  const modules = request?.modules || {};
  const forkliftClass = request?.site?.forklift || 'WA';

  const aisleFeet = rules?.forklift_aisles?.[forkliftClass] || 13.0;
  const aisleWidthM = aisleFeet * FEET_TO_METERS;

  const blocks = [];
  const activeModules = Object.keys(modules).filter(k => modules[k]);

  // Create a central main aisle across the width
  const mainAisleHeight = Math.max(aisleWidthM, 4 * FEET_TO_METERS);
  const mainAisle = {
    id: 'aisle_main',
    key: 'aisle',
    x: 0,
    y: Math.max(0, Math.min(site.heightM - mainAisleHeight, Math.round(site.heightM * 0.5 - mainAisleHeight / 2))),
    w: site.widthM,
    h: mainAisleHeight,
    meta: { kpis: { type: 'main_aisle' } }
  };
  blocks.push(mainAisle);

  // Simple placement: arrange modules above the main aisle left-to-right
  const margin = 2;
  const packY = Math.max(0, mainAisle.y - 18);
  let cursorX = margin;
  const moduleDims = {
    inbound: { w: 24, h: 12 },
    depalletizer: { w: 20, h: 10 },
    pallet_asrs: { w: 32, h: 18 },
    tote_asrs: { w: 22, h: 14 },
    gtp: { w: 18, h: 12 },
    picking: { w: 26, h: 16 },
    consolidation: { w: 22, h: 12 },
    palletizer: { w: 20, h: 12 },
    outbound: { w: 24, h: 12 },
    charging: { w: 16, h: 10 },
    qc: { w: 18, h: 10 },
    maintenance: { w: 16, h: 10 }
  };

  activeModules.forEach((key, idx) => {
    const dims = moduleDims[key] || { w: 20, h: 10 };
    if (cursorX + dims.w + margin > site.widthM) {
      // wrap to next row above if overflow
      cursorX = margin;
    }
    blocks.push({
      id: `block-${idx + 1}`,
      key,
      x: cursorX,
      y: Math.max(0, packY - (idx > 0 && cursorX === margin ? (dims.h + 2) : 0)),
      w: dims.w,
      h: dims.h,
      meta: { kpis: { utilization: 0.8 } }
    });
    cursorX += dims.w + margin;
  });

  // Basic scoring stub
  const scores = { travel: 0.8, adj: 0.75, safety: 0.9, compact: 0.78 };
  const score = (scores.travel + scores.adj + scores.safety + scores.compact) / 4;

  return {
    plan: {
      id: `plan-${Date.now()}`,
      blocks,
      walkways: [],
      score,
      scores,
      ruleFindings: []
    },
    areas: estimateAreasTool({ request }).areas,
    adjacencies: []
  };
}

// Produce three simple variants by shifting blocks slightly and re-scoring
function optimizePlanTool({ plan, weights }) {
  const makeVariant = (basePlan, label, offset) => {
    const blocks = basePlan.blocks.map(b =>
      b.key === 'aisle' ? b : { ...b, x: Math.max(0, b.x + offset), y: Math.max(0, b.y + (offset % 3)) }
    );
    const scores = {
      travel: Math.max(0, Math.min(1, basePlan.scores.travel - offset * 0.005)),
      adj: Math.max(0, Math.min(1, basePlan.scores.adj + offset * 0.004)),
      safety: Math.max(0, Math.min(1, basePlan.scores.safety - offset * 0.002)),
      compact: Math.max(0, Math.min(1, basePlan.scores.compact + offset * 0.003))
    };
    const score = Object.keys(scores).reduce((acc, k) => acc + scores[k], 0) / 4;
    return { ...basePlan, id: label, blocks, scores, score };
  };

  const variants = [
    makeVariant(plan, 'optimized-a', 1),
    makeVariant(plan, 'optimized-b', -1),
    makeVariant(plan, 'optimized-c', 2)
  ];

  // If weights provided, re-rank by weighted sum
  if (weights && typeof weights === 'object') {
    variants.forEach(v => {
      const { travel = 1, adjacency = 1, safety = 1, compactness = 1 } = weights;
      v.score = (
        v.scores.travel * travel +
        v.scores.adj * (weights.adj ?? adjacency) +
        v.scores.safety * safety +
        v.scores.compact * (weights.compact ?? compactness)
      ) / (travel + (weights.adj ?? adjacency) + safety + (weights.compact ?? compactness));
    });
    variants.sort((a, b) => b.score - a.score);
  }

  return { plans: variants };
}

// Validate plan using simplified rule checks from YAML
function validatePlanTool({ plan }) {
  const findings = [];
  const forklift = (plan?.meta?.forklift || 'WA');
  const reqAisleFeet = rules?.forklift_aisles?.[forklift] || 13.0;
  const reqAisleM = reqAisleFeet * FEET_TO_METERS;

  const aisleBlocks = (plan.blocks || []).filter(b => b.key === 'aisle');
  aisleBlocks.forEach(a => {
    if (a.h < reqAisleM) {
      findings.push({
        id: `aisle-${a.id}`,
        type: 'warning',
        message: `Increase ${a.id} to ${reqAisleFeet.toFixed(1)} ft for ${forklift} forklifts.`,
        suggestion: `Set height to ≥ ${reqAisleFeet.toFixed(1)} ft`
      });
    }
  });

  findings.push({
    id: 'flue-1',
    type: 'info',
    message: 'Consider flue spaces between back-to-back racks (NFPA)',
    suggestion: `${rules?.fire_safety?.flue_space_transverse || 6}" transverse, ${rules?.fire_safety?.flue_space_longitudinal || 3}" longitudinal`
  });

  return { findings };
}

// Explain tradeoffs between two plans (simple diff)
function explainTradeoffsTool({ planA, planB }) {
  const toScore = p => p?.scores || {};
  const a = toScore(planA);
  const b = toScore(planB);
  const bullets = [];
  ['travel','adj','safety','compact'].forEach(k => {
    if (typeof a[k] === 'number' && typeof b[k] === 'number') {
      const better = a[k] > b[k] ? 'A' : a[k] < b[k] ? 'B' : 'A=B';
      bullets.push(`${k}: ${better} (${(a[k]||0).toFixed(2)} vs ${(b[k]||0).toFixed(2)})`);
    }
  });
  return { bullets };
}

const toolFunctions = {
  estimateAreas: estimateAreasTool,
  generateInitialPlan: generateInitialPlanTool,
  optimizePlan: optimizePlanTool,
  validatePlan: validatePlanTool,
  explainTradeoffs: explainTradeoffsTool,
};

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'estimateAreas',
      description: 'Estimate module areas from throughput and site inputs',
      parameters: {
        type: 'object',
        properties: {
          request: { type: 'object' }
        },
        required: ['request']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generateInitialPlan',
      description: 'Generate an initial macro plan given user inputs',
      parameters: {
        type: 'object',
        properties: {
          request: { type: 'object' }
        },
        required: ['request']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'optimizePlan',
      description: 'Optimize a plan and return up to Top-3 variants',
      parameters: {
        type: 'object',
        properties: {
          plan: { type: 'object' },
          weights: { type: 'object' }
        },
        required: ['plan']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'validatePlan',
      description: 'Validate a plan against OSHA/NFPA/forklift constraints',
      parameters: {
        type: 'object',
        properties: {
          plan: { type: 'object' }
        },
        required: ['plan']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'explainTradeoffs',
      description: 'Explain trade-offs between two plans',
      parameters: {
        type: 'object',
        properties: {
          planA: { type: 'object' },
          planB: { type: 'object' }
        },
        required: ['planA','planB']
      }
    }
  }
];

// Chat endpoint using OpenAI GPT-4o-mini
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt = `You orchestrate warehouse macro-layouts. Ask natural questions in small batches. When enough info, call tools to propose/optimize/validate. Use constraints (OSHA/NFPA/forklift) and explain trade-offs briefly. Output concise bullets, no fluff.

When you have sufficient info to act, call one of the tools. After tool results, conclude with a short JSON object: {"message": string, "action": "synthesize"|"optimize"|"validate"|"gather_requirements"|"suggest_modules"|null, "data": any}.`;

    const history = Array.isArray(context?.messages) ? context.messages : [];
    const mappedHistory = history
      .filter(m => typeof m?.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role, content: m.content }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...mappedHistory,
      { role: 'user', content: message }
    ];

    // Loop to satisfy tool calls until the assistant returns a final answer
    let assistantMsg;
    let safetyCounter = 0;
    let workingMessages = [...messages];
    do {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: workingMessages,
        tools: toolDefinitions,
        temperature: 0.2,
        max_tokens: 800
      });
      assistantMsg = completion.choices[0]?.message;
      if (!assistantMsg) break;

      workingMessages.push(assistantMsg);

      const toolCalls = assistantMsg.tool_calls || [];
      if (toolCalls.length === 0) break;

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = {}; }
        const impl = toolFunctions[name];
        let result = { error: `Unknown tool: ${name}` };
        if (typeof impl === 'function') {
          try {
            result = await impl(args);
          } catch (e) {
            result = { error: String(e?.message || e) };
          }
        }
        workingMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }

      safetyCounter += 1;
    } while (safetyCounter < 5);

    let out = { message: '', action: null, data: null };
    const content = assistantMsg?.content || '';
    try {
      const parsed = JSON.parse(content);
      out = { message: parsed.message || '', action: parsed.action || null, data: parsed.data ?? null };
    } catch {
      out = { message: content, action: null, data: null };
    }

    return res.json(out);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({
      error: 'Failed to process chat request',
      message: "I'm sorry, I'm having trouble processing your request right now. Please try again."
    });
  }
});

// Synthesis endpoint with enhanced demo data
app.post('/api/layout/synthesize', (req, res) => {
  try {
    const result = generateInitialPlanTool({ request: req.body || {} });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: 'Failed to synthesize plan', message: String(e?.message || e) });
  }
});

// Optimization endpoint with multiple plan variants
app.post('/api/layout/optimize', (req, res) => {
  try {
    const { plan, weights } = req.body || {};
    const result = optimizePlanTool({ plan, weights });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: 'Failed to optimize plan', message: String(e?.message || e) });
  }
});

// Validation endpoint with realistic rule findings
app.post('/api/layout/validate', (req, res) => {
  try {
    const { plan } = req.body || {};
    const result = validatePlanTool({ plan });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: 'Failed to validate plan', message: String(e?.message || e) });
  }
});

// Export endpoint.  Would normally build CSV/JSON/SVG/DXF/USD outputs
// based off the selected plan.  Responds with a stub message for now.
app.post('/api/export', (req, res) => {
  res.json({ status: 'Export functionality not implemented yet.' });
});

// Rules endpoint returns the loaded rule set for transparency and
// debugging.  This allows the front‑end to fetch constraints and
// surface them in the UI.
app.get('/api/rules', (req, res) => {
  res.json(rules);
});

// Start listening on the configured port.  The default port 3001 may
// be overridden via the `PORT` environment variable.
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Layout Optimizer API listening on port ${PORT}`);
});