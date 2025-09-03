// ===================================================================================
    // SECTION 1: CONSTANTS & CONFIGURATION
    // ===================================================================================

    // UI State Keys
    const DREAM_FORM_COLLAPSE_KEY = 'dreamFormCollapsed';
    
    // Application Constants - Single Source of Truth
    const CONSTANTS = {
        // Voice Recording Limits
        VOICE_STORAGE_LIMIT: 5,
        
        // Security & PIN Constants
        PIN_RESET_HOURS: 72,
        PIN_MIN_LENGTH: 4,
        PIN_MAX_LENGTH: 6,
        PASSWORD_MIN_LENGTH: 4,
        FAILED_PIN_ATTEMPT_LIMIT: 3,
        
        // Cryptography Constants
        CRYPTO_SALT_SIZE: 16,
        CRYPTO_IV_SIZE: 12,
        CRYPTO_PBKDF2_ITERATIONS: 100000,
        CRYPTO_KEY_LENGTH: 256,
        
        // Performance & Debouncing
        DEBOUNCE_SEARCH_MS: 300,
        DEBOUNCE_FILTER_MS: 150,
        DEBOUNCE_SCROLL_MS: 100,
        ENDLESS_SCROLL_THRESHOLD_PX: 500,
        ENDLESS_SCROLL_INCREMENT: 5,
        
        // Data Limits
        MAX_TAGS_PER_DREAM: 20,
        MAX_TAG_LENGTH: 50,
        AI_ANALYSIS_RECENT_LIMIT: 15,
        AI_ANALYSIS_TOTAL_LIMIT: 20,
        AI_ANALYSIS_THRESHOLD: 50,
        LARGE_DATASET_THRESHOLD: 50,
        
        // UI & Autocomplete
        AUTOCOMPLETE_MIN_CHARS: 2,
        AUTOCOMPLETE_MAX_RESULTS: 8,
        DOM_TRAVERSAL_LEVELS: 3,
        TEXT_TRUNCATE_LENGTH: 50,
        
        // Pagination Constants
        PAGINATION_MAX_VISIBLE_PAGES: 7,
        PAGINATION_CURRENT_PAGE_PROXIMITY: 4,
        PAGINATION_ELLIPSIS_THRESHOLD: 3,
        
        // File Size Constants
        BYTES_PER_KB: 1024,
        BYTES_PER_MB: 1048576, // 1024 * 1024
        
        // Database Constants
        DB_VERSION: 5,
        DATETIME_LOCAL_SLICE_LENGTH: 16,
        
        // UI Timing & Durations (milliseconds)
        MESSAGE_DURATION_SHORT: 3000,
        MESSAGE_DURATION_MEDIUM: 5000,
        MESSAGE_DURATION_LONG: 7000,
        MESSAGE_DURATION_EXTENDED: 10000,
        CLEANUP_DELAY_MS: 3000,
        FOCUS_DELAY_MS: 100,
        
        // File & Storage
        BACKUP_UPDATE_DELAY_MS: 100,
        DOWNLOAD_CLEANUP_DELAY_MS: 3000
    };
    
    // Goal templates
    const GOAL_TEMPLATES = {
        'lucid-monthly': {
            title: 'Monthly Lucid Dreams',
            description: 'Achieve lucid dreams this month',
            type: 'lucid_count',
            period: 'monthly',
            target: 3,
            icon: '✨'
        },
        'recall-streak': {
            title: 'Dream Recall Streak',
            description: 'Remember dreams for consecutive days',
            type: 'recall_streak',
            period: 'streak',
            target: 7,
            icon: '🧠'
        },
        'journal-habit': {
            title: 'Daily Journaling',
            description: 'Write in dream journal consistently',
            type: 'journal_streak',
            period: 'streak',
            target: 30,
            icon: '📝'
        },
        'dream-signs': {
            title: 'Dream Signs Collection',
            description: 'Identify and track dream signs',
            type: 'dream_signs_count',
            period: 'total',
            target: 10,
            icon: '🔍'
        },
        'custom': {
            title: 'Custom Goal',
            description: 'Track your personal goal manually',
            type: 'custom',
            period: 'total',
            target: 1,
            icon: '⭐'
        }
    };

    const dailyTips = [
        { category: 'Scientific Foundations and Research', text: 'Understand the hybrid consciousness state: Lucid dreams occur during REM sleep but show unique brain activity - combining REM-like delta and theta waves with wake-like 40Hz gamma activity in frontal regions.' },
        { category: 'Scientific Foundations and Research', text: 'Know your REM timing: REM sleep periods get progressively longer throughout the night, with the final REM period lasting 45-60 minutes - this is prime time for lucid dreaming attempts.' },
        { category: 'Scientific Foundations and Research', text: 'Learn about acetylcholine\'s role: This neurotransmitter is crucial for REM sleep and dream vividness. Understanding this helps explain why some supplements can increase lucid dream frequency.' },
        { category: 'Scientific Foundations and Research', text: 'Recognize individual variation: Only about 50-60% of people ever experience lucid dreams naturally, with less than 1% having them multiple times per week - your natural ability varies significantly.' },
        { category: 'Scientific Foundations and Research', text: 'Use verified communication methods: Stephen LaBerge proved lucid dreams are real by having dreamers signal with pre-arranged eye movements during REM sleep, which were recorded on EEG equipment.' },
        { category: 'Scientific Foundations and Research', text: 'Understand the prefrontal cortex connection: Increased activity in the anterior prefrontal cortex during lucid dreams enables the self-awareness and metacognition necessary for recognizing the dream state.' },
        { category: 'Scientific Foundations and Research', text: 'Know the research timeline: Modern lucid dream research began on April 12, 1975, when Keith Hearne first recorded verified signals from a lucid dreamer - now celebrated as Lucid Dreaming Day.' },
        { category: 'Scientific Foundations and Research', text: 'Learn about gamma wave activity: Successful lucid dreams show increased 40Hz gamma wave activity, particularly in frontal brain regions associated with consciousness and self-awareness.' },
        { category: 'Scientific Foundations and Research', text: 'Understand sleep architecture: Lucid dreams maintain all normal REM characteristics (rapid eye movements, muscle atonia, high-frequency EEG) while adding higher-order consciousness functions.' },
        { category: 'Scientific Foundations and Research', text: 'Recognize frequency statistics: Research shows MILD technique increases lucid dream frequency from baseline 3.7% to approximately 13% when properly practiced.' },
        { category: 'Scientific Foundations and Research', text: 'Know about phasic REM activity: Lucid dreams are associated with increased REM density (more frequent eye movements) compared to regular REM sleep periods.' },
        { category: 'Scientific Foundations and Research', text: 'Understand memory limitations in dreams: Even when lucid, dreamers can access episodic memories but often with significant distortions and inaccuracies compared to waking recall.' },
        { category: 'Scientific Foundations and Research', text: 'Learn about metacognitive networks: Lucid dreaming activates brain regions involved in self-referential processing and metacognition, including the default mode network.' },
        { category: 'Scientific Foundations and Research', text: 'Recognize sleep quality impact: Research indicates spontaneous lucid dreaming doesn\'t significantly impair overall sleep quality when occurring naturally.' },
        { category: 'Scientific Foundations and Research', text: 'Understand neural connectivity: Frequent lucid dreamers show increased functional connectivity between anterior prefrontal cortex and angular gyrus during both sleep and waking states.' },
        { category: 'Scientific Foundations and Research', text: 'Know about transcranial stimulation research: Scientists have successfully induced lucid dreams using 25Hz and 40Hz transcranial alternating current stimulation in controlled studies.' },
        { category: 'Scientific Foundations and Research', text: 'Learn about targeted memory reactivation: Recent studies achieve 50% lucid dream success rates by playing sounds during REM that were paired with pre-sleep lucid dreaming training.' },
        { category: 'Scientific Foundations and Research', text: 'Understand the motor cortex connection: Mental practice of physical skills in lucid dreams activates the same brain regions as actual physical practice and can improve real-world performance.' },
        { category: 'Scientific Foundations and Research', text: 'Recognize meditation correlations: Long-term meditators experience 4.28 lucid dreams per month compared to 2.55 for non-meditators, likely due to enhanced metacognitive abilities.' },
        { category: 'Scientific Foundations and Research', text: 'Know about dream content incorporation: External stimuli presented during REM sleep can be incorporated into dream content, forming the basis for technological lucid dream induction devices.' },
        { category: 'Scientific Foundations and Research', text: 'Understand consciousness spectrum: Lucid dreams represent a unique state on the consciousness spectrum - neither fully asleep nor awake, but possessing qualities of both states.' },
        { category: 'Scientific Foundations and Research', text: 'Learn about developmental patterns: Many frequent lucid dreamers report first experiences in childhood or adolescence, with ability appearing relatively stable across the adult lifespan.' },
        { category: 'Scientific Foundations and Research', text: 'Recognize therapeutic validation: The American Academy of Sleep Medicine now includes Lucid Dreaming Therapy (LDT) as an effective treatment option for nightmare disorder.' },
        { category: 'Scientific Foundations and Research', text: 'Know about PTSD research: Recent studies show 85% of PTSD participants experienced "remarkable decrease" in symptoms after lucid dreaming workshops, with benefits persisting at 4-week follow-up.' },
        { category: 'Scientific Foundations and Research', text: 'Understand false awakening neuroscience: False awakenings occur because the brain\'s reality monitoring systems remain partially compromised even during lucid dreams.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Master the finger-through-palm test: Press your finger against your opposite palm. In dreams, your finger will typically pass through your palm, making this an extremely reliable reality check. Because dream physics is based on expectation, it is profoundly unlikely to fail.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Use the nose-pinch breathing test: Pinch your nose closed and try to breathe. In dreams, you can often breathe normally even with your nose pinched, making this both discreet and highly effective for most dreamers.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Examine your hands carefully: Look at your hands and count your fingers. In dreams, hands frequently appear distorted, have the wrong number of fingers, or show impossible details.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Check digital clocks twice: Look at a digital clock, look away, then look back. In dreams, the time will often change dramatically between glances or show impossible times, though this requires genuine attention to detail.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Read text multiple times: Read any text (signs, books, labels), look away, then read again. Dream text typically changes between readings or appears as meaningless symbols, though this works best when you truly expect text instability.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Perform 10-15 reality checks daily: Consistency is key - spread reality checks throughout your day rather than clustering them in one period.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Associate checks with triggers: Link reality checks to specific daily events like walking through doorways, hearing phones ring, or seeing your reflection.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Question with genuine curiosity: Don\'t perform reality checks mechanically. Always ask "Am I dreaming?" with sincere interest in the answer and emotional investment.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Use the light switch test: Flip light switches on and off. In dreams, lights often don\'t work properly or behave in impossible ways.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Check your reflection: Look at yourself in mirrors. Dream reflections are often distorted, show the wrong person, or display impossible features.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Examine written text closely: Look for details in text like specific words, letters, or numbers. Dream text is often blurry, changes when re-read, or contains nonsensical content.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Test electronic devices: Try using phones, computers, or other electronic devices. In dreams, they rarely function normally and often display strange or impossible information.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Question your memory: Ask yourself how you got to your current location and what you did earlier in the day. Dream memory is often incomplete or nonsensical.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Check the time format: Look for impossible times like 25:73 or 14:92. Digital clocks in dreams often show times that don\'t exist in reality.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Use the gravity test: Jump up and see how quickly you fall. In dreams, you might float, fly, or fall very slowly due to altered dream physics.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Examine environmental details: Look for inconsistencies in your surroundings - rooms that change size, doors that lead to wrong places, or objects that shouldn\'t be there.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Test cause and effect: Try simple actions like turning doorknobs, pushing buttons, or moving objects. Dream logic often breaks down with simple physical interactions.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Count your fingers carefully: Not just a quick glance - actually count each finger one by one. Dreams often show extra fingers, fewer fingers, or fingers that change as you count.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Check analog clocks: While less reliable than digital clocks, analog clocks in dreams often have wrong numbers, move backwards, or show impossible configurations.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Question conversations: Pay attention to whether conversations make logical sense and if people respond appropriately to what you\'re saying.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Use the breathing awareness test: Focus on your breathing pattern. In dreams, you might notice you\'re not breathing at all or breathing in impossible ways.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Test your balance: Stand on one foot or try to walk in a straight line. Dream physics often makes balance and coordination feel different from waking life.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Look at your shoes or clothing: Check if you\'re wearing what you remember putting on. Dream clothing often changes or appears inappropriate for the situation.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Use the writing test: Try to write your name or a simple sentence. In dreams, writing is often impossible or produces illegible scribbles.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Check for pain sensation: Pinch yourself gently. In dreams, pain sensations are often muted or completely absent.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Question the weather: If outdoors, notice if the weather makes sense and remains consistent. Dream weather often changes impossibly or defies physical laws.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Examine fine details: Look closely at textures, patterns, or small objects. Dreams often lack fine detail that would be present in waking vision.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Use the color consistency test: Notice if colors remain stable when you look away and back. Dream colors sometimes shift or appear impossible.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Test your knowledge: Try to remember specific facts, phone numbers, or addresses. Dream memory often fails to provide accurate specific information.' },
        { category: 'Reality Checking Techniques and Methods', text: 'Check your keys or wallet: Look for items you always carry. In dreams, these familiar objects are often missing or completely different.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Keep your journal within arm\'s reach: Place a notebook and pen directly beside your bed so you can reach them without getting up or turning on lights.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Record immediately upon waking: Don\'t move, stretch, or think about your day first. Dreams fade within 5-10 minutes, so capture them instantly upon awakening.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Write in present tense: Record dreams as if they\'re happening now ("I am walking down a hallway") rather than past tense to maintain vividness and emotional connection.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Capture fragments without judgment: Even tiny dream pieces are valuable. Record partial memories, single images, or emotions rather than waiting for complete recall.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Include the date and sleep details: Note the date, approximate sleep duration, and sleep quality to track patterns over time.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Create meaningful dream titles: Give each dream a memorable title that captures its essence, making it easier to reference and remember later.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Record emotions prominently: Document the feelings experienced during dreams, as emotions often provide clues to underlying dream meanings and triggers.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Note all characters present: Write down everyone in your dream, including strangers, family members, friends, and fictional characters.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Describe locations in detail: Document where dreams take place, including familiar locations, unknown places, and impossible or changing environments.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Use keywords for quick capture: Develop a personal shorthand system for quickly noting dream elements without losing momentum.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Draw visual elements: Sketch objects, people, or scenes from your dreams, especially unusual or impossible visual elements that words can\'t fully capture.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Note dream transitions: Record how scenes changed, whether abruptly or gradually, as these transitions can become reality check triggers.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Identify recurring dream signs: Mark repeated elements, themes, or characters that appear across multiple dreams - these become your personal dream signs.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Rate dream vividness: Use a 1-10 scale to rate how vivid and memorable each dream was, helping track factors that influence dream intensity.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Record pre-sleep activities: Note what you did, ate, or experienced before bed to identify factors that influence dream content and lucidity.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Use voice recording when helpful: If writing is too disruptive, use voice memos on your phone, then transcribe later while the recording helps refresh your memory.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Color-code different themes: Use different colored pens or highlighters to mark different types of dream content (nightmares, lucid dreams, recurring themes).' },
        { category: 'Dream Journal Practices and Approaches', text: 'Include sensory details: Record not just what you saw, but what you heard, felt, smelled, or tasted in the dream.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Note impossible elements: Mark things that couldn\'t happen in real life, as these become valuable dream signs for future recognition.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Track lucidity levels: When you have any level of dream awareness, rate it from 1-10 and note what triggered the lucidity.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Create weekly review sessions: Set aside time each week to read through recent entries and identify patterns, themes, and potential dream signs.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Use mind maps for complex dreams: For dreams with multiple scenes or complex narratives, create visual maps showing how different elements connect.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Record false awakenings: Document dreams where you thought you woke up but were still dreaming, as these can become lucidity triggers.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Note seasonal or cyclical patterns: Track whether certain types of dreams occur more frequently during specific times of year or months.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Include waking life connections: Note any obvious connections between dream content and recent waking experiences, thoughts, or concerns.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Use dream dictionaries wisely: While personal associations matter most, occasionally reference dream symbol dictionaries to explore alternative meanings.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Create a dream sign catalog: Maintain a separate list of your most common dream signs, updating it regularly as you identify new patterns.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Track technique effectiveness: Note which lucid dreaming techniques you used before sleep and whether they preceded successful lucid dreams.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Record sleep position: Notice if sleeping position affects dream content or lucidity, as different positions can influence dream experiences.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Use apps or digital tools: Consider dream journal apps that allow voice recording, easy searching, and pattern recognition features.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Share with others when appropriate: Discussing dreams with friends or dream groups can provide new perspectives and insights.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Include health factors: Note if illness, medications, or physical discomfort affected your dreams, as these factors can significantly influence dream content.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Practice dream re-entry: If you wake from an interesting dream, try to fall back asleep and re-enter the same dream scenario.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Record dreams from naps: Include daytime nap dreams in your journal, as they often have different qualities and may be easier to remember.' },
        { category: 'Dream Journal Practices and Approaches', text: 'Create monthly summaries: At month\'s end, summarize the most significant dreams, patterns observed, and progress made toward lucid dreaming goals.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice MILD after dream recall: Use Mnemonic Induction of Lucid Dreams by recalling a recent dream and visualizing becoming lucid when encountering a dream sign from that dream.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Set strong intentions with MILD: Repeat the mantra "The next time I dream, I will remember that I am dreaming" while falling asleep after the WBTB technique.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Master the WBTB timing: Wake after 4.5-6 hours of sleep, stay awake for 30-60 minutes practicing lucid dreaming techniques, then return to sleep.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Combine WBTB with MILD: Use the wake period to practice MILD visualization and intention-setting for maximum effectiveness.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try WILD during afternoon naps: Wake-Initiated Lucid Dreams work better during naps when you\'re not deeply tired and can maintain awareness during sleep onset.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Remain completely still during WILD: Allow your body to fall asleep while keeping your mind alert - don\'t move even if you feel uncomfortable sensations.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Expect sleep paralysis with WILD: This is normal and harmless - your body naturally paralyzes during REM sleep, and awareness of this paralysis is temporary.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Focus on hypnagogic imagery: During WILD, observe the images that appear behind your eyelids without engaging with them emotionally.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use SSILD\'s sensory cycling: Practice Senses Initiated Lucid Dreams by cycling attention between vision (darkness behind eyelids), hearing (sounds around you), and touch (body sensations).' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Keep SSILD cycles gentle: Don\'t strain or force sensations - subtle awareness of each sense for 30-60 seconds is more effective than intense focus.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try FILD finger movements: Upon waking during WBTB, make barely perceptible finger movements as if playing piano while falling back asleep.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice DILD through reality checks: Dream-Initiated Lucid Dreams happen when reality checks or dream sign recognition triggers lucidity within an ongoing dream.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use visualization before sleep: Spend 10-15 minutes visualizing yourself becoming lucid and accomplishing specific dream goals.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Set multiple intentions: Rather than just intending to become lucid, set specific intentions for what you\'ll do once lucid.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice during optimal REM periods: Time your induction attempts for early morning hours when REM sleep is longest and most frequent.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use the counting method: Count slowly from 1 to 100 while maintaining awareness during sleep onset, which can trigger WILD experiences.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try the rope climbing technique: Visualize climbing an invisible rope above your body while falling asleep to maintain consciousness during transition.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice dream re-entry: If you wake from a non-lucid dream, immediately try to fall back asleep and re-enter the same dream with lucidity.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use mantras during techniques: Repeat phrases like "I am dreaming" or "Next time I\'m dreaming, I\'ll remember I\'m dreaming" during induction attempts.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Experiment with different sleep positions: Some people find certain positions (back, side) more conducive to specific techniques like WILD.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice the wake-back-to-bed variation: Try staying awake for just 5-15 minutes during WBTB for a gentler approach that\'s less disruptive to sleep.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use prospective memory training: Practice remembering to do specific actions during the day to strengthen the memory skills needed for MILD.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try technique rotation: Use different induction methods on different nights to prevent habituation and maintain effectiveness.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Focus on dream signs during MILD: Identify specific elements from your dream journal and practice recognizing them as triggers for lucidity.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use emotional involvement: Add genuine excitement and anticipation to your intention-setting rather than just mechanical repetition.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice the reflection technique: During wake periods, ask yourself "How did I get here?" to strengthen critical thinking skills for dreams.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try micro-WBTB sessions: Wake briefly several times during the night and set lucid dreaming intentions without fully getting up.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use the alarm clock method: Set an alarm for early morning REM periods, but place it across the room so you must get up to turn it off.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice the elevator technique: Visualize ascending in an elevator while falling asleep, which can trigger feelings of floating into lucid dreams.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Combine techniques strategically: Use WBTB for timing, MILD for intention-setting, and reality checks throughout the day for comprehensive coverage.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try the spinning technique: If you feel yourself waking during a dream, spin around in the dream to stabilize and maintain lucidity.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use external cues: Place sticky notes or objects around your room to remind you to question reality throughout the day.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice the CAT technique: The Cycle Adjustment Technique involves gradually shifting your sleep schedule to align with optimal REM timing.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try all-day awareness: Maintain heightened awareness of your mental states throughout waking hours to strengthen metacognitive abilities.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use the SSILD plateau: After several SSILD cycles, allow yourself to fall asleep naturally without forcing the technique.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice dream yoga techniques: Incorporate traditional Tibetan dream yoga methods like maintaining awareness across all states of consciousness.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try the phantom limb technique: Focus on imaginary sensations in your limbs while falling asleep to maintain body awareness during sleep onset.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Use the doorway technique: Visualize walking through doorways in your dreams as triggers for lucidity checks.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Practice the breathing focus method: Maintain attention on your breath during sleep onset while allowing the body to relax completely.' },
        { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try the temperature technique: Use slight temperature changes (cooler or warmer room) during WBTB periods to increase cortical activation.' }
    ];

    // TAGS & AUTOCOMPLETE SYSTEM

    // Predefined tags database for autocomplete
    const commonTags = [
        // People
        'family', 'friends', 'strangers', 'children', 'elderly', 'celebrities', 'deceased-relatives',
        // Places
        'home', 'school', 'work', 'nature', 'city', 'ocean', 'mountains', 'forest', 'space', 'underground',
        // Objects
        'animals', 'vehicles', 'technology', 'weapons', 'books', 'mirrors', 'doors', 'stairs', 'bridges',
        // Activities
        'flying', 'running', 'swimming', 'dancing', 'singing', 'fighting', 'escaping', 'searching', 'traveling',
        // Themes
        'adventure', 'romance', 'horror', 'fantasy', 'sci-fi', 'mystery', 'spiritual', 'nostalgic', 'surreal'
    ];

    // Dream signs database - specific elements that commonly trigger lucidity
    const commonDreamSigns = [
        // Reality Check Triggers
        'flying', 'impossible-architecture', 'text-changing', 'clocks-wrong', 'hands-distorted', 'light-switches-broken',
        // Impossible Events
        'teleportation', 'shapeshifting', 'breathing-underwater', 'floating-objects', 'gravity-defying',
        // Dead People/Past
        'deceased-alive', 'childhood-home', 'past-relationships', 'extinct-animals', 'historical-figures',
        // Distorted Reality
        'mirror-reflections-wrong', 'phone-not-working', 'doors-lead-nowhere', 'infinite-rooms', 'size-changes',
        // Recurring Personal Signs
        'teeth-falling-out', 'being-chased', 'cant-run-fast', 'naked-in-public', 'late-for-exam', 'lost-vehicle'
    ];
    
    // Goals pagination constants
    const GOALS_PER_PAGE = 5;