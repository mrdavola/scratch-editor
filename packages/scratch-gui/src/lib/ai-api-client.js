/**
 * Client-side API wrapper for all ScrAItch AI features.
 * All requests go through the API gateway.
 */

// In production, use relative URLs (same domain via Vercel rewrites)
// In local dev, hit the API server on port 3001
const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : '';

async function apiCall(endpoint, body) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('scraitch-token') : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    // Check rate limit header
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining !== null && parseInt(remaining, 10) < 5) {
        console.warn(`[ScrAItch] Rate limit warning: only ${remaining} AI generations remaining today`);
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.error || 'API request failed');
    }

    return data;
}

export async function generateBlocks(prompt, context, conversationHistory = []) {
    return apiCall('generate-blocks', { prompt, context, conversationHistory });
}

export async function generateSprite(description, style = 'cartoon') {
    return apiCall('generate-sprite', { description, style });
}

export async function generateBackdrop(description, style = 'cartoon') {
    return apiCall('generate-backdrop', { description, style });
}

export async function generateCostume(description, style = 'cartoon', existingCostume = null) {
    return apiCall('generate-costume', { description, style, existingCostume });
}

export async function generateSound(description, type = 'effect') {
    return apiCall('generate-sound', { description, type });
}

export async function explainBlocks(blocks, gradeLevel, spriteNames) {
    return apiCall('explain-blocks', { blocks, gradeLevel, spriteNames });
}

export async function debugBlocks(problemDescription, context) {
    return apiCall('debug-blocks', { problemDescription, context });
}

export async function suggestRemix(context) {
    return apiCall('suggest-remix', { context });
}
