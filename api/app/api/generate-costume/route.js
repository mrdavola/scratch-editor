import { NextResponse } from 'next/server';
import { getImageModel } from '../../../lib/gemini.js';
import { checkSafety } from '../../../lib/safety.js';
import { removeGreenScreen } from '../../../lib/chromakey.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const STYLE_MAP = {
    cartoon: 'Cartoon style with bold outlines, bright colors, and smooth shading. Similar to modern animated shows.',
    pixel: 'Pixel art style with visible square pixels, limited color palette, and retro video game aesthetic.',
    realistic: 'Semi-realistic style with detailed textures and natural proportions, but still stylized for appeal.',
    handdrawn: 'Hand-drawn style with visible sketch lines, watercolor-like coloring, and an artistic, crafted feel.',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { description, style, existingCostume } = body;

        // Validate required fields
        if (!description || typeof description !== 'string' || !description.trim()) {
            return NextResponse.json(
                { success: false, error: 'description is required and must be a non-empty string' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Safety check
        const safetyResult = await checkSafety(description);
        if (!safetyResult.safe) {
            const message = safetyResult.reason === 'blocked_content'
                ? 'Your request contains content that is not allowed. Please try a different description.'
                : 'Your request may not be appropriate. Try describing your costume differently.';
            return NextResponse.json(
                { success: false, error: message, reason: safetyResult.reason },
                { status: 400, headers: corsHeaders }
            );
        }

        // Resolve style
        const styleKey = (style && STYLE_MAP[style]) ? style : 'cartoon';
        const styleInstruction = STYLE_MAP[styleKey];

        // Build prompt and content parts
        const contentParts = [];

        if (existingCostume) {
            // Variation mode: send existing costume as image input
            contentParts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: existingCostume,
                },
            });
            contentParts.push({
                text: `Create a variation of this character costume based on: ${description}.
Style: ${styleInstruction}.
The new costume must:
- Keep the same character but in a different pose or with costume changes as described
- Full body visible, centered in frame
- Facing slightly to the right (3/4 view)
- On a solid chromakey green (#00FF00) background with NO other elements
- Clean, crisp edges with no green color on the character itself
- Appropriate for children ages 5-18
- Single character only, no text or labels
- Maintain consistent proportions and art style with the original
The green background must be perfectly uniform #00FF00 with no gradients or shadows on it.`,
            });
        } else {
            // New costume generation (same as sprite)
            contentParts.push({
                text: `Create a character sprite of: ${description}.
Style: ${styleInstruction}.
The character must be:
- Full body visible, centered in frame
- Facing slightly to the right (3/4 view)
- On a solid chromakey green (#00FF00) background with NO other elements
- Clean, crisp edges with no green color on the character itself
- Appropriate for children ages 5-18
- Single character only, no text or labels
The green background must be perfectly uniform #00FF00 with no gradients or shadows on it.`,
            });
        }

        // Call Gemini image model
        const model = getImageModel();
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: contentParts }],
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

        // Decode and run chromakey pipeline
        const rawBuffer = Buffer.from(imageData.data, 'base64');
        const transparentBuffer = await removeGreenScreen(rawBuffer);
        const base64PNG = transparentBuffer.toString('base64');

        // Generate a suggested name from description
        const suggestedName = description
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .trim()
            .split(/\s+/)
            .slice(0, 3)
            .join('-')
            .toLowerCase() || 'costume';

        return NextResponse.json(
            {
                success: true,
                image: base64PNG,
                mimeType: 'image/png',
                suggestedName,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        console.error('generate-costume error:', error);

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
