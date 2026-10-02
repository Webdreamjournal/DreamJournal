const EMOTIONS = ['joy', 'fear', 'curiosity', 'calm', 'anxiety', 'wonder'];
const TAGS = ['flying', 'water', 'school', 'family', 'chase', 'lucid', 'city', 'animals'];
const SIGNS = ['floating', 'wrong-hands', 'clock-glitch', 'dead-friend', 'impossible-room'];

/**
 * Deterministic sample journal: `count` dreams spread over several months, with every
 * third dream carrying a dream sign. Dream 0 is lucid and has awkward text (HTML, quotes,
 * an unbroken string, a paragraph break); dream 1 has non-Latin text and emoji.
 */
export function sampleBackup(count = 38) {
    const now = Date.now();
    const dreams = [];
    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - i * 3.7 * 86400000 - (i % 5) * 3600000).toISOString();
        let title = ['Flying over a lake', 'Back at school', 'The endless corridor', 'Talking cat', 'Ocean city'][i % 5] + ' #' + (i + 1);
        let content = ('I was in a dream where ' + 'the scene shifted and I noticed details. '.repeat(1 + (i % 6))).trim();
        if (i === 0) {
            title = 'A long title that keeps going to test wrapping ' + 'x'.repeat(60);
            content = 'Unbroken string: ' + 'A'.repeat(180) + '\n\nSecond paragraph with <b>html</b> & "quotes".';
        }
        if (i === 1) {
            title = '日本語のタイトル – ünïcödé';
            content = 'مرحبا 🌍 mixed-direction text and emoji 😴💤';
        }
        dreams.push({
            id: `seed-${1000 + i}`, title, content, timestamp,
            isLucid: i % 4 === 0,
            emotions: EMOTIONS.slice(i % 3, (i % 3) + 1 + (i % 2)).join(', '),
            tags: TAGS.slice(i % 4, (i % 4) + 1 + (i % 3)),
            dreamSigns: i % 3 === 0 ? [SIGNS[i % 5]] : []
        });
    }
    return { data: { dreams } };
}
