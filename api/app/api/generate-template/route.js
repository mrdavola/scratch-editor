import { NextResponse } from 'next/server';
import { getTextModel } from '../../../lib/gemini.js';
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
        const { idea } = body;

        // Validate required fields
        if (!idea || typeof idea !== 'string' || !idea.trim()) {
            return NextResponse.json(
                { success: false, error: 'idea is required and must be a non-empty string' },
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
        const safetyResult = await checkSafety(idea, 'K-2');
        if (!safetyResult.safe) {
            const message = safetyResult.reason === 'blocked_content'
                ? 'Your request contains content that is not allowed. Please try a different idea.'
                : 'Your request may not be appropriate. Try describing your project differently.';
            return NextResponse.json(
                { success: false, error: message, reason: safetyResult.reason },
                { status: 400, headers: corsHeaders }
            );
        }

        // Call Gemini to parse the idea into structured components
        const model = getTextModel('gemini-2.5-flash');
        const prompt = `Given this project idea: "${idea.trim()}"

Return JSON with:
{
  "backdrop": "one sentence description of the background scene",
  "sprites": ["one sentence description of main character", "one sentence description of second character"],
  "starterCode": "one sentence description of what the starter code should do for each sprite"
}

Keep it simple — max 2 sprites. The descriptions should be specific enough for AI image and code generation.`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
                topP: 0.9,
                maxOutputTokens: 1024,
            },
        });

        const responseText = result.response.text();

        // Parse JSON response
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            // Try extracting from markdown code fences
            const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (fenceMatch) {
                try {
                    parsed = JSON.parse(fenceMatch[1].trim());
                } catch {
                    // Fall through
                }
            }
            if (!parsed) {
                const objMatch = responseText.match(/\{[\s\S]*\}/);
                if (objMatch) {
                    try {
                        parsed = JSON.parse(objMatch[0]);
                    } catch {
                        // Fall through
                    }
                }
            }
            if (!parsed) {
                return NextResponse.json(
                    { success: false, error: 'Failed to parse AI response' },
                    { status: 502, headers: corsHeaders }
                );
            }
        }

        // Validate the response structure
        if (!parsed.backdrop || !Array.isArray(parsed.sprites) || !parsed.starterCode) {
            return NextResponse.json(
                { success: false, error: 'AI response missing required fields' },
                { status: 502, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            {
                success: true,
                template: {
                    backdrop: parsed.backdrop,
                    sprites: parsed.sprites.slice(0, 2),
                    starterCode: parsed.starterCode,
                },
            },
            { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
        );
    } catch (error) {
        console.error('generate-template error:', error);

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
