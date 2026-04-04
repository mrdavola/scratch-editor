import { describe, test, expect } from '@jest/globals';
import { validateBlockJSON } from '../block-validator.js';

describe('validateBlockJSON', () => {
    test('accepts a valid simple block chain (flag clicked -> move)', () => {
        const blocks = {
            'flag_clicked_1': {
                opcode: 'event_whenflagclicked',
                next: 'move_step_1',
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: true,
                x: 0,
                y: 0,
            },
            'move_step_1': {
                opcode: 'motion_movesteps',
                next: null,
                parent: 'flag_clicked_1',
                inputs: {
                    STEPS: [1, [4, '10']],
                },
                fields: {},
                shadow: false,
                topLevel: false,
            },
        };

        const result = validateBlockJSON(blocks);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('rejects invalid opcode', () => {
        const blocks = {
            'bad_block': {
                opcode: 'not_a_real_opcode',
                next: null,
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: true,
            },
        };

        const result = validateBlockJSON(blocks);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('invalid opcode'))).toBe(true);
    });

    test('rejects broken next reference', () => {
        const blocks = {
            'flag_clicked_1': {
                opcode: 'event_whenflagclicked',
                next: 'nonexistent_block',
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: true,
            },
        };

        const result = validateBlockJSON(blocks);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('unresolved next reference'))).toBe(true);
    });

    test('rejects blocks with no top-level block', () => {
        const blocks = {
            'move_step_1': {
                opcode: 'motion_movesteps',
                next: null,
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: false,
            },
        };

        const result = validateBlockJSON(blocks);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('No top-level block'))).toBe(true);
    });

    test('rejects null blocks', () => {
        const result = validateBlockJSON(null);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('non-null object'))).toBe(true);
    });
});
