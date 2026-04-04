import { describe, test, expect } from '@jest/globals';
import { checkSafety } from '../safety.js';

describe('checkSafety', () => {
    test('allows safe input', async () => {
        const result = await checkSafety('make the cat walk across the screen');
        expect(result.safe).toBe(true);
    });

    test('blocks violent content', async () => {
        const result = await checkSafety('make the character kill the enemy');
        expect(result.safe).toBe(false);
        expect(result.reason).toBe('blocked_content');
    });

    test('blocks explicit content', async () => {
        const result = await checkSafety('show a nude character');
        expect(result.safe).toBe(false);
        expect(result.reason).toBe('blocked_content');
    });

    test('soft-blocks scary content for young students (K-2)', async () => {
        const result = await checkSafety('make a scary horror game', 'K-2');
        expect(result.safe).toBe(false);
        expect(result.reason).toBe('age_inappropriate');
    });

    test('allows scary content for older students (9-12)', async () => {
        const result = await checkSafety('make a scary horror game', '9-12');
        expect(result.safe).toBe(true);
    });
});
