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
        const { problemDescription, context } = body;

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

        // Validate required fields
        if (!problemDescription || typeof problemDescription !== 'string' || !problemDescription.trim()) {
            return NextResponse.json(
                { success: false, error: 'problemDescription is required and must be a non-empty string' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Safety check on problem description
        const safetyResult = await checkSafety(problemDescription);
        if (!safetyResult.safe) {
            const message = safetyResult.reason === 'blocked_content'
                ? 'Your request contains content that is not allowed. Please try a different description.'
                : 'Your request may not be appropriate. Try describing the problem differently.';
            return NextResponse.json(
                { success: false, error: message, reason: safetyResult.reason },
                { status: 400, headers: corsHeaders }
            );
        }

        // Build system prompt
        const systemPrompt = `You are debugging a Scratch project for a student. They report: "${problemDescription}"

Analyze the blocks across ALL sprites and identify likely issues. Common problems include:
- Missing event hat block (no green flag clicked)
- Blocks not connected (floating blocks)
- Forever loop missing
- Variable not initialized
- Wrong sprite selected
- Costume/sound name misspelled
- Broadcast name mismatch between sender and receiver

Respond with JSON:
{
  "issues": [
    {
      "sprite": "sprite name",
      "problem": "clear description",
      "fix": "what to change",
      "severity": "critical" | "likely" | "possible"
    }
  ],
  "explanation": "friendly explanation for the student"
}`;

        // Build user message with project context
        let userMessage = 'Here is the full project context:\n';
        if (context) {
            userMessage += JSON.stringify(context, null, 2);
        } else {
            userMessage += '(No project context provided — give general debugging advice based on the problem description.)';
        }

        // Call Gemini 2.5 Flash with JSON response
        const model = getTextModel();
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });

        const responseText = result.response.text();

        if (!responseText) {
            return NextResponse.json(
                { success: false, error: 'AI did not return a response. Please try again.' },
                { status: 502, headers: corsHeaders }
            );
        }

        // Parse the JSON response
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                { success: false, error: 'AI returned invalid JSON. Please try again.' },
                { status: 502, headers: corsHeaders }
            );
        }

        const { issues, explanation } = parsed;

        return NextResponse.json(
            {
                success: true,
                issues: issues || [],
                explanation: explanation || '',
            },
            { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
        );
    } catch (error) {
        console.error('debug-blocks error:', error);

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
