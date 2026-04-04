const BLOCKED_PATTERNS = [
    /\b(gun|weapon|kill|murder|blood|gore|death)\b/i,
    /\b(naked|nude|sex|porn|nsfw)\b/i,
    /\b(drug|cocaine|heroin|meth)\b/i,
    /\b(hate|nazi|terrorist)\b/i,
    /\b(suicide|self.?harm)\b/i,
];

const SOFT_REDIRECT_PATTERNS = [
    /\b(scary|horror|nightmare|creepy)\b/i,
    /\b(fight|battle|combat)\b/i,
];

export async function checkSafety(text, gradeLevel = 'K-2') {
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(text)) {
            return { safe: false, reason: 'blocked_content' };
        }
    }

    if (['K-2', '3-5'].includes(gradeLevel)) {
        for (const pattern of SOFT_REDIRECT_PATTERNS) {
            if (pattern.test(text)) {
                return { safe: false, reason: 'age_inappropriate' };
            }
        }
    }

    return { safe: true };
}
