import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getTextModel } from '../../../lib/gemini.js';
import { validateBlockJSON } from '../../../lib/block-validator.js';
import { checkSafety } from '../../../lib/safety.js';
import { authenticateRequest } from '../../../lib/auth.js';
import { checkRateLimit } from '../../../lib/rate-limit.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function buildContextString(context) {
    const lines = [];

    if (context.activeSprite) {
        const sprite = context.activeSprite;
        lines.push(`ACTIVE SPRITE: "${sprite.name}"`);
        if (sprite.costumes?.length) {
            lines.push(`  Costumes: ${sprite.costumes.join(', ')}`);
        }
        if (sprite.sounds?.length) {
            lines.push(`  Sounds: ${sprite.sounds.join(', ')}`);
        }
        if (sprite.position) {
            lines.push(`  Position: x=${sprite.position.x}, y=${sprite.position.y}`);
        }
        if (sprite.variables && Object.keys(sprite.variables).length > 0) {
            lines.push(`  Variables: ${Object.keys(sprite.variables).join(', ')}`);
        }
        if (sprite.blocks && (Array.isArray(sprite.blocks) ? sprite.blocks.length > 0 : Object.keys(sprite.blocks).length > 0)) {
            lines.push(`  Existing blocks: ${JSON.stringify(sprite.blocks)}`);
        }
    }

    if (context.sprites?.length) {
        const spriteNames = context.sprites.map(s => s.name).join(', ');
        lines.push(`ALL SPRITES: ${spriteNames}`);
    }

    if (context.stage?.backdrops?.length) {
        lines.push(`BACKDROPS: ${context.stage.backdrops.join(', ')}`);
    }

    if (context.stage?.variables && Object.keys(context.stage.variables).length > 0) {
        lines.push(`GLOBAL VARIABLES: ${Object.keys(context.stage.variables).join(', ')}`);
    }

    if (context.stage?.lists && Object.keys(context.stage.lists).length > 0) {
        lines.push(`GLOBAL LISTS: ${Object.keys(context.stage.lists).join(', ')}`);
    }

    if (context.gradeLevel) {
        lines.push(`STUDENT GRADE LEVEL: ${context.gradeLevel}`);
    }

    return lines.join('\n');
}

function extractJSON(text) {
    // Try direct parse first
    try {
        return JSON.parse(text);
    } catch {
        // Try extracting from markdown code fences
        const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (fenceMatch) {
            try {
                return JSON.parse(fenceMatch[1].trim());
            } catch {
                // Fall through
            }
        }
        // Try to find any JSON object in the text
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
            try {
                return JSON.parse(objMatch[0]);
            } catch {
                // Fall through
            }
        }
        throw new Error('Failed to parse AI response as valid JSON');
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { prompt, context, conversationHistory } = body;

        // Validate required fields
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return NextResponse.json(
                { success: false, error: 'prompt is required and must be a non-empty string' },
                { status: 400, headers: corsHeaders }
            );
        }

        if (!context || typeof context !== 'object') {
            return NextResponse.json(
                { success: false, error: 'context is required and must be an object' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Auth + rate limiting
        const { userId, tier } = await authenticateRequest(request);
        const rateCheck = await checkRateLimit(userId, tier);
        if (!rateCheck.allowed) {
            const message = tier === 'anonymous'
                ? 'You\'ve used all your free AI generations for today! Sign in for more.'
                : 'You\'ve used all your AI generations for today. Come back tomorrow!';
            return NextResponse.json(
                { success: false, error: message },
                { status: 429, headers: { ...corsHeaders, 'X-RateLimit-Remaining': '0' } }
            );
        }

        // Safety check
        const gradeLevel = context.gradeLevel || 'K-2';
        const safetyResult = await checkSafety(prompt, gradeLevel);
        if (!safetyResult.safe) {
            const message = safetyResult.reason === 'blocked_content'
                ? 'Your request contains content that is not allowed. Please try a different request.'
                : 'Your request may not be appropriate for your grade level. Try describing your project differently.';
            return NextResponse.json(
                { success: false, error: message, reason: safetyResult.reason },
                { status: 400, headers: corsHeaders }
            );
        }

        // Read system prompt
        const systemPromptPath = join(process.cwd(), 'prompts', 'nl-to-blocks.txt');
        const systemPrompt = await readFile(systemPromptPath, 'utf-8');

        // Build context string
        const contextString = buildContextString(context);

        // Build conversation contents
        const contents = [];

        // Add conversation history if provided
        if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
            for (const entry of conversationHistory) {
                contents.push({
                    role: entry.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: entry.content }],
                });
            }
        }

        // Add current user request
        const userMessage = `PROJECT CONTEXT:\n${contextString}\n\nSTUDENT REQUEST:\n${prompt}`;
        contents.push({
            role: 'user',
            parts: [{ text: userMessage }],
        });

        // Call Gemini
        const model = getTextModel('gemini-2.5-flash');
        const result = await model.generateContent({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
                topP: 0.8,
                maxOutputTokens: 8192,
            },
        });

        const responseText = result.response.text();

        // Parse JSON response
        let parsed;
        try {
            parsed = extractJSON(responseText);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Failed to parse AI response as valid JSON' },
                { status: 502, headers: corsHeaders }
            );
        }

        // Handle entity-only responses (e.g., "make a score variable")
        const hasCreateEntities = parsed.createEntities && (
            (parsed.createEntities.variables && parsed.createEntities.variables.length > 0) ||
            (parsed.createEntities.lists && parsed.createEntities.lists.length > 0) ||
            (parsed.createEntities.broadcasts && parsed.createEntities.broadcasts.length > 0)
        );

        if ((!parsed.blocks || Object.keys(parsed.blocks || {}).length === 0) && !parsed.spriteBlocks && hasCreateEntities) {
            return NextResponse.json(
                {
                    success: true,
                    blocks: parsed.blocks || {},
                    createEntities: parsed.createEntities,
                    explanation: parsed.explanation || '',
                    assumptions: parsed.assumptions || [],
                },
                { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
            );
        }

        // Handle multi-sprite or single-sprite response
        if (parsed.spriteBlocks) {
            // Multi-sprite response — validate each sprite's blocks
            const validatedSpriteBlocks = {};
            const errors = [];

            for (const [spriteName, spriteData] of Object.entries(parsed.spriteBlocks)) {
                if (spriteData.blocks) {
                    const validation = validateBlockJSON(spriteData.blocks, context);
                    if (validation.valid) {
                        validatedSpriteBlocks[spriteName] = {
                            blocks: spriteData.blocks,
                            createEntities: spriteData.createEntities || {}
                        };
                    } else {
                        errors.push(`${spriteName}: ${validation.errors.join(', ')}`);
                    }
                }
            }

            if (Object.keys(validatedSpriteBlocks).length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'No valid blocks in multi-sprite response',
                        validationErrors: errors,
                    },
                    { status: 422, headers: corsHeaders }
                );
            }

            return NextResponse.json(
                {
                    success: true,
                    spriteBlocks: validatedSpriteBlocks,
                    explanation: parsed.explanation || '',
                    assumptions: parsed.assumptions || [],
                },
                { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
            );
        } else if (parsed.blocks) {
            // Single-sprite response — existing logic
            const validation = validateBlockJSON(parsed.blocks, { ...context, hasCreateEntities });
            if (!validation.valid) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Generated blocks failed validation',
                        validationErrors: validation.errors,
                    },
                    { status: 422, headers: corsHeaders }
                );
            }

            return NextResponse.json(
                {
                    success: true,
                    blocks: parsed.blocks,
                    createEntities: parsed.createEntities || null,
                    explanation: parsed.explanation || '',
                    assumptions: parsed.assumptions || [],
                },
                { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
            );
        } else {
            return NextResponse.json(
                { success: false, error: 'AI response did not contain blocks or spriteBlocks' },
                { status: 502, headers: corsHeaders }
            );
        }
    } catch (error) {
        console.error('generate-blocks error:', error);

        if (error.message?.includes('GEMINI_API_KEY')) {
            return NextResponse.json(
                { success: false, error: 'API key not configured' },
                { status: 500, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        );
    }
}
