/**
 * Client-side API wrapper for all ScrAItch AI features.
 * All requests go through the API gateway.
 */

const API_BASE = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:3001';

async function apiCall(endpoint, body) {
    const response = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

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
