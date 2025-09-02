import { Request, Plan, RuleFinding } from './types'

const BASE_URL = 'http://localhost:3002/api'

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
		...init,
	})
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		console.error('API Error:', res.status, text)
		throw new Error(`API ${res.status}: ${text}`)
	}
	return res.json() as Promise<T>
}

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

export interface AIPlacementsResponse {
	placements: Array<{ id: string; x: number; y: number; rot: 0|90|180|270 }>
	rationale?: string
	kpi_guess?: { mhc?: number; throughput?: number }
}

export const apiService = {
	// Chat endpoint - delegates to OpenAI function calling
	async chat(message: string, context?: any): Promise<ChatResponse> {
		return request('/chat', { method: 'POST', body: JSON.stringify({ message, context }) })
	},

	// Synthesis - convert throughput to areas and initial plan
	async synthesize(requestBody: Request): Promise<SynthesizeResponse> {
		return request('/layout/synthesize', { method: 'POST', body: JSON.stringify(requestBody) })
	},

	// Optimization - return multiple ranked layouts
	async optimize(plan: Plan, weights: Record<string, number>): Promise<OptimizeResponse> {
		return request('/layout/optimize', { method: 'POST', body: JSON.stringify({ plan, weights }) })
	},

	// Validation - check plan against rules
	async validate(plan: Plan): Promise<ValidationResponse> {
		return request('/layout/validate', { method: 'POST', body: JSON.stringify({ plan }) })
	},

	// Export - generate various output formats
	async export(plan: Plan, format: string): Promise<ExportResponse> {
		return request('/export', { method: 'POST', body: JSON.stringify({ plan, format }) })
	},

	// Get rules for transparency
	async getRules(): Promise<Record<string, any>> {
		return request('/rules')
	},

	// AI placements (optional assist)
	async aiPlacements(payload: any): Promise<AIPlacementsResponse> {
		return request('/ai/placements', { method: 'POST', body: JSON.stringify(payload) })
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
