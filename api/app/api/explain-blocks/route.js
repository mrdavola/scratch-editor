import { NextResponse } from 'next/server';
import { getTextModel } from '../../../lib/gemini.js';

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
        const { blocks, gradeLevel, spriteNames } = body;

        // Validate required fields
        if (!blocks) {
            return NextResponse.json(
                { success: false, error: 'blocks is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        // No safety check needed — input is block JSON, not user text

        // Build system prompt
        const grade = gradeLevel || 'K-2';
        const systemPrompt = `You are explaining Scratch code to a ${grade} student. Given the following Scratch blocks (in JSON format), explain what the code does in simple, friendly language. Use analogies appropriate for the student's age. Do NOT use programming jargon unless the student is in grades 9-12.

Write 2-4 sentences. Be specific about what happens ("the cat moves 10 steps to the right") not abstract ("the sprite performs a motion operation").`;

        // Build user message with blocks and sprite context
        let userMessage = `Here are the Scratch blocks:\n${JSON.stringify(blocks, null, 2)}`;
        if (spriteNames && spriteNames.length > 0) {
            userMessage += `\n\nThe sprites in this project are: ${spriteNames.join(', ')}`;
        }

        // Call Gemini 2.5 Flash
        const model = getTextModel();
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        });

        const explanation = result.response.text();

        if (!explanation) {
            return NextResponse.json(
                { success: false, error: 'AI did not return an explanation. Please try again.' },
                { status: 502, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            {
                success: true,
                explanation,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        console.error('explain-blocks error:', error);

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
