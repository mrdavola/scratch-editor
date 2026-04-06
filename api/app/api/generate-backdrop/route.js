import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getImageModel } from '../../../lib/gemini.js';
import { checkSafety } from '../../../lib/safety.js';
import { authenticateRequest } from '../../../lib/auth.js';
import { checkRateLimit } from '../../../lib/rate-limit.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const STYLE_MAP = {
    cartoon: 'Cartoon style with bold outlines, bright colors, and smooth shading. Similar to modern animated shows.',
    pixel: 'Pixel art style with visible square pixels, limited color palette, and retro video game aesthetic.',
    realistic: 'Semi-realistic style with detailed textures and natural lighting, photographic quality.',
    handdrawn: 'Hand-drawn style with visible sketch lines, watercolor-like coloring, and an artistic, crafted feel.',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { description, style } = body;

        // Validate required fields
        if (!description || typeof description !== 'string' || !description.trim()) {
            return NextResponse.json(
                { success: false, error: 'description is required and must be a non-empty string' },
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
                : 'Your request may not be appropriate. Try describing your backdrop differently.';
            return NextResponse.json(
                { success: false, error: message, reason: safetyResult.reason },
                { status: 400, headers: corsHeaders }
            );
        }

        // Resolve style
        const styleKey = (style && STYLE_MAP[style]) ? style : 'cartoon';
        const styleInstruction = STYLE_MAP[styleKey];

        // Build prompt
        const prompt = `Create a background scene for a children's coding project: ${description}.
Style: ${styleInstruction}.
Requirements:
- Landscape orientation, 4:3 aspect ratio
- Full scene with no characters or people (sprites are added separately)
- Appropriate for children ages 5-18
- Vibrant and clear, optimized for a 480x360 display
- No text, labels, or watermarks`;

        // Call Gemini image model
        const model = getImageModel();
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
            },
        });

        // Extract image data from response
        const parts = result.response.candidates[0].content.parts;
        let imageData = null;
        for (const part of parts) {
            if (part.inlineData) {
                imageData = part.inlineData;
                break;
            }
        }

        if (!imageData) {
            return NextResponse.json(
                { success: false, error: 'AI did not return an image. Please try again.' },
                { status: 502, headers: corsHeaders }
            );
        }

        // Decode and resize to 960x720 (2x for 480x360 stage)
        const rawBuffer = Buffer.from(imageData.data, 'base64');
        const resizedBuffer = await sharp(rawBuffer)
            .resize(960, 720, { fit: 'cover' })
            .png()
            .toBuffer();
        const base64PNG = resizedBuffer.toString('base64');

        // Generate a suggested name from description
        const suggestedName = description
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .trim()
            .split(/\s+/)
            .slice(0, 3)
            .join('-')
            .toLowerCase() || 'backdrop';

        return NextResponse.json(
            {
                success: true,
                image: base64PNG,
                mimeType: 'image/png',
                suggestedName,
            },
            { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
        );
    } catch (error) {
        console.error('generate-backdrop error:', error);

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
