import axios, { AxiosResponse, AxiosError } from 'axios'
import { Request, Plan, RuleFinding } from './types'

const api = axios.create({
  baseURL: 'http://localhost:3002/api',
  timeout: 30000,
})

// Add request/response interceptors for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export interface ChatResponse {
  message: string
  action?: 'gather_requirements' | 'suggest_modules' | 'synthesize' | 'optimize' | 'validate' | null
  data?: any
}

export interface SynthesizeResponse {
  plan: Plan
  areas: Record<string, number>
  adjacencies: Array<{ from: string; to: string; weight: number }>
}

export interface OptimizeResponse {
  plans: Plan[]
}

export interface ValidationResponse {
  findings: RuleFinding[]
}

export interface ExportResponse {
  status: string
  url?: string
  data?: any
}

export const apiService = {
  // Chat endpoint - delegates to OpenAI function calling
  async chat(message: string, context?: any): Promise<ChatResponse> {
    const response = await api.post('/chat', {
      message,
      context,
    })
    return response.data
  },

  // Synthesis - convert throughput to areas and initial plan
  async synthesize(request: Request): Promise<SynthesizeResponse> {
    const response = await api.post('/layout/synthesize', request)
    return response.data
  },

  // Optimization - return multiple ranked layouts
  async optimize(plan: Plan, weights: Record<string, number>): Promise<OptimizeResponse> {
    const response = await api.post('/layout/optimize', {
      plan,
      weights,
    })
    return response.data
  },

  // Validation - check plan against rules
  async validate(plan: Plan): Promise<ValidationResponse> {
    const response = await api.post('/layout/validate', {
      plan,
    })
    return response.data
  },

  // Export - generate various output formats
  async export(plan: Plan, format: string): Promise<ExportResponse> {
    const response = await api.post('/export', {
      plan,
      format,
    })
    return response.data
  },

  // Get rules for transparency
  async getRules(): Promise<Record<string, any>> {
    const response = await api.get('/rules')
    return response.data
  },
}

// React Query keys for caching
export const queryKeys = {
  rules: ['rules'],
  validation: (planId: string) => ['validation', planId],
  optimization: (planId: string, weights: Record<string, number>) => [
    'optimization',
    planId,
    weights,
  ],
}
