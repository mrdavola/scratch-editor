import { NextResponse } from 'next/server';
import { getAudioModel } from '../../../lib/gemini.js';
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

export async function POST(request) {
    try {
        const body = await request.json();
        const { description, type } = body;

        // Validate required fields
        if (!description || typeof description !== 'string' || !description.trim()) {
            return NextResponse.json(
                { success: false, error: 'description is required and must be a non-empty string' },
                { status: 400, headers: corsHeaders }
            );
        }

        if (type && !['effect', 'music'].includes(type)) {
            return NextResponse.json(
                { success: false, error: 'type must be "effect" or "music"' },
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
        const safetyResult = await checkSafety(description);
        if (!safetyResult.safe) {
            const message = safetyResult.reason === 'blocked_content'
                ? 'Your request contains content that is not allowed. Please try a different description.'
                : 'Your request may not be appropriate. Try describing your sound differently.';
            return NextResponse.json(
                { success: false, error: message, reason: safetyResult.reason },
                { status: 400, headers: corsHeaders }
            );
        }

        // Build prompt based on type
        const soundType = type || 'effect';
        const prompt = soundType === 'effect'
            ? `A short, punchy sound effect: ${description}. Keep it under 3 seconds, clear and distinct.`
            : `Background music loop: ${description}. Instrumental only, suitable for children.`;

        // Call Lyria 3 Clip audio model
        const model = getAudioModel();
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ['AUDIO', 'TEXT'],
            },
        });

        // Extract audio data from response
        const parts = result.response.candidates[0].content.parts;
        let audioData = null;
        for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                audioData = part.inlineData;
                break;
            }
        }

        if (!audioData) {
            return NextResponse.json(
                { success: false, error: 'AI did not return audio. Please try again.' },
                { status: 502, headers: corsHeaders }
            );
        }

        // Generate a suggested name from description
        const suggestedName = description
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .trim()
            .split(/\s+/)
            .slice(0, 3)
            .join('-')
            .toLowerCase() || 'sound';

        return NextResponse.json(
            {
                success: true,
                audio: audioData.data,
                mimeType: audioData.mimeType || 'audio/wav',
                suggestedName,
            },
            { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
        );
    } catch (error) {
        console.error('generate-sound error:', error);

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
