// ===================================================================================
// DREAM JOURNAL CONSTANTS & CONFIGURATION
// ===================================================================================
// Central repository for all application constants, templates, and configuration values
// Maintains single source of truth for consistent behavior across modules

// UI State Management Keys
const DREAM_FORM_COLLAPSE_KEY = 'dreamFormCollapsed';
    
// Core Application Constants
// Centralized configuration values used throughout the application
const CONSTANTS = {
        // Voice Recording System Limits
        VOICE_STORAGE_LIMIT: 5, // Maximum number of stored voice notes
        
        // Security & PIN Protection System
        PIN_RESET_HOURS: 72, // Hours before PIN reset timer expires
        PIN_MIN_LENGTH: 4, // Minimum PIN length
        PIN_MAX_LENGTH: 6, // Maximum PIN length
        PASSWORD_MIN_LENGTH: 4, // Minimum password length for encryption
        FAILED_PIN_ATTEMPT_LIMIT: 3, // Max failed attempts before lockout
        
        // Cryptographic Parameters for Encryption/Export
        CRYPTO_SALT_SIZE: 16, // Salt size in bytes for PBKDF2
        CRYPTO_IV_SIZE: 12, // Initialization vector size for AES-GCM
        CRYPTO_PBKDF2_ITERATIONS: 100000, // Key derivation iterations (security)
        CRYPTO_KEY_LENGTH: 256, // AES key length in bits
        
        // Performance Optimization & Debouncing
        DEBOUNCE_SEARCH_MS: 300, // Delay for search input debouncing
        DEBOUNCE_FILTER_MS: 150, // Delay for filter change debouncing
        DEBOUNCE_SCROLL_MS: 100, // Delay for scroll event debouncing
        ENDLESS_SCROLL_THRESHOLD_PX: 500, // Pixels from bottom to trigger load
        ENDLESS_SCROLL_INCREMENT: 5, // Number of items to load per scroll
        
        // Data Validation & Content Limits
        MAX_TAGS_PER_DREAM: 20, // Maximum tags allowed per dream entry
        MAX_TAG_LENGTH: 50, // Maximum characters per tag
        AI_ANALYSIS_RECENT_LIMIT: 15, // Recent dreams included in AI export
        AI_ANALYSIS_TOTAL_LIMIT: 20, // Total dreams to export for AI analysis
        AI_ANALYSIS_THRESHOLD: 50, // Word count threshold for analysis inclusion
        LARGE_DATASET_THRESHOLD: 50, // Dream count considered "large dataset"
        
        // User Interface & Autocomplete System
        AUTOCOMPLETE_MIN_CHARS: 2, // Minimum chars to trigger autocomplete
        AUTOCOMPLETE_MAX_RESULTS: 8, // Maximum autocomplete suggestions shown
        DOM_TRAVERSAL_LEVELS: 3, // Max levels to traverse for action contexts
        TEXT_TRUNCATE_LENGTH: 50, // Character limit for text truncation
        
        // Pagination Display Configuration
        PAGINATION_MAX_VISIBLE_PAGES: 7, // Maximum page numbers shown in pagination
        PAGINATION_CURRENT_PAGE_PROXIMITY: 4, // Pages shown around current page
        PAGINATION_ELLIPSIS_THRESHOLD: 3, // When to show "..." in pagination
        
        // File Size Calculations
        BYTES_PER_KB: 1024, // Bytes per kilobyte
        BYTES_PER_MB: 1048576, // Bytes per megabyte (1024 * 1024)
        
        // IndexedDB Configuration
        DB_VERSION: 5, // Current database schema version
        DATETIME_LOCAL_SLICE_LENGTH: 16, // Characters in datetime-local format
        
        // UI Timing & Animation Durations (milliseconds)
        MESSAGE_DURATION_SHORT: 3000, // Short notification display time
        MESSAGE_DURATION_MEDIUM: 5000, // Medium notification display time
        MESSAGE_DURATION_LONG: 7000, // Long notification display time
        MESSAGE_DURATION_EXTENDED: 10000, // Extended notification display time
        CLEANUP_DELAY_MS: 3000, // Delay before cleaning up temporary elements
        FOCUS_DELAY_MS: 100, // Delay before focusing elements (prevent race conditions)
        
        // File Operations & Storage Management
        BACKUP_UPDATE_DELAY_MS: 100, // Delay between backup progress updates
        DOWNLOAD_CLEANUP_DELAY_MS: 3000 // Delay before cleaning up download URLs
    };
    
// Predefined Goal Templates
// Template configurations for common lucid dreaming goals
const GOAL_TEMPLATES = {
        'lucid-monthly': {
            title: 'Monthly Lucid Dreams',
            description: 'Achieve lucid dreams this month',
            type: 'lucid_count', // Goal tracks lucid dream count
            period: 'monthly', // Resets monthly
            target: 3, // Target number of lucid dreams
            icon: '✨'
        },
        'recall-streak': {
            title: 'Dream Recall Streak',
            description: 'Remember dreams for consecutive days',
            type: 'recall_streak', // Goal tracks consecutive recall days
            period: 'streak', // Maintains running streak
            target: 7, // Target consecutive days
            icon: '🧠'
        },
        'journal-habit': {
            title: 'Daily Journaling',
            description: 'Write in dream journal consistently',
            type: 'journal_streak', // Goal tracks journaling consistency
            period: 'streak', // Maintains running streak
            target: 30, // Target consecutive days
            icon: '📝'
        },
        'dream-signs': {
            title: 'Dream Signs Collection',
            description: 'Identify and track dream signs',
            type: 'dream_signs_count', // Goal tracks unique dream signs
            period: 'total', // Cumulative total
            target: 10, // Target number of unique dream signs
            icon: '🔍'
        },
        'custom': {
            title: 'Custom Goal',
            description: 'Track your personal goal manually',
            type: 'custom', // User-defined goal type
            period: 'total', // Cumulative tracking
            target: 1, // Default target (user configurable)
            icon: '⭐'
        }
    };

// Daily Lucid Dreaming Tips Database
// Comprehensive collection of evidence-based lucid dreaming advice
// Organized by category for systematic learning and application
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
            { category: 'Induction Techniques (MILD, WILD, DILD, WBTB, etc.)', text: 'Try the temperature technique: Use slight temperature changes (cooler or warmer room) during WBTB periods to increase cortical activation.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Stay calm when lucid: Avoid getting excited or rushing into action immediately - take a deep breath and remain composed to help prevent premature awakening, as strong emotions can destabilize dreams.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Rub your hands together vigorously: This sensory engagement often helps stabilize the dream state and increases vividness when dreams begin to fade, working through focused attention and expectation.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Look at your hands in detail: Examine every wrinkle, line, and texture on your hands while repeating "I am dreaming" to anchor your lucidity through focused awareness.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Touch objects in the dream: Actively feel textures, temperatures, and weights of dream objects to engage your senses and help maintain stability through sensory expectation.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use verbal commands with conviction: Say aloud "STABILIZE LUCIDITY NOW" or "INCREASE CLARITY" with strong expectation when the dream begins to fade or become unclear.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Spin around in the dream: LaBerge\'s spinning technique is highly effective, with studies showing success rates as high as 96% for preventing wake-ups when dreams begin to fade, likely working through expectation and sensory engagement.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Keep moving in the dream: Standing still may increase the risk of waking up - stay active by walking, exploring, or interacting with the environment, as activity maintains dream engagement.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Engage all five senses: Deliberately notice what you can see, hear, touch, smell, and taste in the dream to maintain sensory richness.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Focus on the ground beneath your feet: Feel the stability of whatever surface you\'re standing on to maintain connection with the dream environment.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use the hand examination technique: When dreams fade, stop all activity and examine your hands in detail until the dream restabilizes.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Expect false awakenings: After losing lucidity, always perform reality checks when you "wake up" - you may still be dreaming.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use rapid eye movement: Move your dream eyes quickly in different directions to help maintain the dream state.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Avoid passive observation: Don\'t just watch dreams unfold - actively participate and interact to maintain engagement and stability.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use grounding techniques: Touch walls, floors, or solid objects repeatedly to maintain physical connection to the dream world.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Practice the "anchoring" method: Choose a specific object in your dream to touch and return to whenever lucidity begins to fade, using it as a stability anchor through repeated sensory contact.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Maintain expectation of stability: Expect your lucid dream to continue and remain stable rather than anticipating it will end soon - your expectations significantly influence dream duration and clarity.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use the "demand clarity" technique: Loudly demand "CLARITY NOW" or "INCREASED LUCIDITY" with complete conviction when dream vividness decreases - the command works through your belief in its power.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Focus on details: Examine small details in the dream environment to increase engagement and help prevent drifting back to non-lucid dreaming through active attention.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use dream logic acceptance: Avoid questioning dream inconsistencies too analytically once lucid, as this can sometimes destabilize the dream - accept the dream\'s internal logic.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Practice dream extension: When a dream scene ends, visualize a new location and confidently expect to appear there rather than waking up - belief in continuity helps maintain the dream state.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use the stopping technique: If the dream starts to fade, immediately stop all movement and focus intensely on your current surroundings.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Engage with dream characters: Have conversations or interactions with people in your dream to maintain engagement and stability.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use memory reinforcement: Periodically remind yourself "I am dreaming" throughout the lucid experience to maintain awareness.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Practice scene transitions: Learn to move between dream locations smoothly without losing lucidity during environmental changes.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use the 360-degree observation: Look around completely in all directions to fully engage with your dream environment.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Focus on breathing in the dream: Pay attention to your dream breathing pattern, even though physical breathing continues automatically.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use the "increase vividness" command: When colors seem dull or images unclear, command the dream to become more vivid and realistic.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Touch your dream body: Feel your arms, face, or clothing in the dream to maintain embodied awareness and prevent floating away.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Use expectation setting: Set the expectation that your lucid dream will last a long time and remain stable throughout.' },
            { category: 'Maintenance and Stabilization Techniques for Lucid Dreams', text: 'Practice the balance technique: If you feel yourself losing the dream, focus on your balance and physical stability within the dream world.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Maintain consistent sleep schedules: Go to bed and wake up at the same time every day, including weekends, to optimize natural REM cycles.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Keep your bedroom cool: Set temperature between 60-67°F (15-19°C) for optimal sleep quality and REM sleep enhancement.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Create complete darkness: Use blackout curtains, eye masks, or eliminate all light sources to support natural melatonin production.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Remove electronic screens 1 hour before bed: Blue light from phones, tablets, and TVs disrupts circadian rhythms and reduces REM sleep quality.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Use your bedroom only for sleep: Remove work materials, TVs, and other non-sleep activities to strengthen the mental association between bedroom and sleep.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Invest in comfortable bedding: Quality mattresses and pillows reduce sleep disruptions that can fragment REM sleep periods.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Control noise pollution: Use earplugs, white noise machines, or sound dampening to minimize disruptive sounds during sleep.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Avoid caffeine 6-8 hours before bedtime: Caffeine has a long half-life and can interfere with falling asleep and reaching deep REM cycles.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Limit alcohol consumption: While alcohol may help you fall asleep initially, it fragments sleep architecture and reduces REM sleep quality.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Create a pre-sleep ritual: Establish a consistent 30-60 minute wind-down routine to signal your brain that sleep time is approaching.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Get morning sunlight exposure: Spend 15-30 minutes in bright morning light to regulate circadian rhythms and improve nighttime sleep quality.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Avoid large meals 3 hours before bed: Heavy or spicy foods can cause discomfort and disrupt sleep stages needed for lucid dreaming.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Keep a dream journal beside your bed: Having recording materials immediately accessible encourages better dream recall and lucidity practice.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Use comfortable sleepwear: Choose breathable, non-restrictive clothing that won\'t cause discomfort during sleep movements.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Manage bedroom humidity: Maintain 30-50% relative humidity to prevent dryness or stuffiness that can disrupt sleep quality.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Eliminate or minimize medications that affect REM: Consult with healthcare providers about prescription medications that may suppress REM sleep.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Use red light for evening activities: If you need light before bed, red wavelengths are less disruptive to circadian rhythms than white or blue light.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Keep your bedroom well-ventilated: Fresh air circulation prevents stuffiness and maintains optimal oxygen levels during sleep.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Use weighted blankets if helpful: Some people find the gentle pressure helps reduce anxiety and improve sleep quality.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Avoid intense exercise 3 hours before bed: While regular exercise improves sleep, vigorous activity too close to bedtime can be stimulating.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Practice stress reduction before sleep: Use meditation, reading, or gentle stretching to reduce cortisol levels that can interfere with REM sleep.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Keep consistent meal timing: Eat dinner at the same time each day to support circadian rhythm regularity.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Use aromatherapy wisely: Lavender or chamomile scents may promote relaxation, but avoid overpowering fragrances.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Limit daytime naps to 20-30 minutes: Long naps can interfere with nighttime sleep architecture and REM cycles.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Address sleep disorders: Sleep apnea, restless leg syndrome, and other disorders significantly impact REM sleep and dream recall.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Keep pets out of bed: Pet movements during sleep can fragment your sleep cycles and disrupt lucid dreaming attempts.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Use gradual wake-up methods: Gentle alarm clocks or sunrise simulation lights can help preserve dream memory upon awakening.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Maintain optimal bedroom air quality: Use air purifiers if necessary to reduce allergens that might cause breathing difficulties during sleep.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Track your sleep patterns: Use sleep tracking apps or devices to identify your personal optimal sleep duration and timing.' },
            { category: 'Sleep Hygiene and Optimization for Lucid Dreaming', text: 'Create a sleep sanctuary: Designate your bedroom as a peaceful, clutter-free space dedicated to rest and dreaming.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Take vitamin B6 with caution: Vitamin B6 may enhance dream vividness and recall, but WARNING: Do not exceed the recommended daily allowance (RDA) of 1.3-1.7mg without medical supervision. High doses can cause peripheral neuropathy and other serious side effects.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Use choline supplements carefully: Alpha-GPC or choline bitartrate may support acetylcholine production related to REM sleep. WARNING: Do not exceed the adequate intake level of 400-550mg daily without medical supervision to avoid potential side effects.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Eat choline-rich foods: Include eggs, fish, nuts, and soybeans in your diet to naturally support acetylcholine production.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Consider melatonin with extreme caution: WARNING: Melatonin is a hormone that regulates your body\'s circadian clock. In many countries, it requires a prescription. Consult a healthcare provider before use, start with the lowest possible dose (0.5mg or less), and use only for short-term circadian rhythm adjustment. Long-term effects are not well-studied.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Incorporate B-vitamin rich foods: Bananas, avocados, and fish provide B6, while leafy greens and legumes offer folate for brain health.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Consider tryptophan-rich evening snacks: Turkey, dairy products, or pumpkin seeds may support serotonin production and sleep quality.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Avoid supplements that suppress REM: Check that your supplements don\'t interfere with REM sleep, particularly antidepressants or antihistamines.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Stay hydrated but time fluid intake: Drink adequate water throughout the day but reduce intake 2-3 hours before bed to prevent sleep disruption.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Choose quality supplement sources: Select reputable suppliers since supplements aren\'t FDA-regulated for purity or potency.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Eat omega-3 rich foods: Fatty fish like salmon and mackerel support brain health and have been associated with increased dream vividness.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Avoid heavy or spicy evening meals: These can cause discomfort and disrupt the sleep architecture needed for lucid dreaming.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Consider magnesium with appropriate dosing: Magnesium glycinate may help with relaxation and sleep quality. WARNING: Do not exceed the RDA of 310-420mg daily without medical supervision. Excess magnesium can cause digestive issues and interact with medications.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Include complex carbohydrates: Oats and whole grains in your evening meal may support serotonin production and sleep onset.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Limit simple sugars before bed: Avoid candy, desserts, or sugary drinks that can cause blood sugar spikes and sleep disruption.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Monitor supplement interactions: Check for interactions between any supplements and prescription medications you take.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Start with lower doses: Begin with minimal effective doses of supplements and gradually increase while monitoring effects and side effects.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Track supplement effectiveness: Note in your dream journal which supplements preceded successful lucid dreams to identify personal patterns.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Consider zinc within safe limits: Adequate zinc levels support memory formation, which is crucial for dream recall and lucidity. WARNING: Do not exceed the RDA of 8-11mg daily without medical supervision. Excess zinc can interfere with copper absorption and immune function.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Avoid combining too many supplements: Start with one supplement at a time to identify which ones are actually helpful for you.' },
            { category: 'Supplementation and Nutrition Considerations', text: 'Use L-theanine for relaxation: This amino acid found in tea may promote relaxation without sedation when taken before bed.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Try targeted lucidity reactivation apps: Research shows TLR apps can increase lucid dream frequency from 0.74 to 2.11 per week when used properly.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Use dream journal apps with search features: Digital journals allow you to search for patterns and dream signs more easily than paper journals.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Set reality check reminders on your phone: Use apps that prompt you to perform reality checks at random intervals throughout the day.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Experiment with binaural beats: Listen to theta (4-8 Hz) or gamma (30-100 Hz) binaural beats 30 minutes before sleep or during WBTB.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Try lucid dreaming masks carefully: Devices like REM-Dreamer or Aurora use light cues during REM sleep, but effectiveness varies greatly between individuals.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Use smartphone sleep tracking: Apps that monitor movement can help identify your REM periods for optimal technique timing.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Consider light therapy devices: Morning light boxes can help regulate circadian rhythms, indirectly supporting better REM sleep.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Use voice recording for dream capture: If writing disrupts your dream recall, record voice memos immediately upon waking.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Try meditation apps with sleep stories: Guided meditations or sleep stories can help maintain awareness during the transition to sleep.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Use airplane mode overnight: Eliminate electromagnetic interference and notification disruptions that could fragment your sleep.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Experiment with white noise apps: Consistent background sounds can mask environmental noise that might disrupt REM sleep.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Consider wearable sleep trackers: Devices like fitness trackers can help you understand your personal sleep patterns and optimal wake times.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Use gentle wake-up alarms: Sunrise simulation or gradually increasing volume alarms are less jarring and may preserve dream memory.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Try lucid dreaming hypnosis recordings: Some people find guided hypnosis helpful for developing lucid dreaming skills and confidence.' },
            { category: 'Technology and Tools for Lucid Dreaming', text: 'Use temperature control devices: Smart thermostats or bed cooling/heating systems can maintain optimal sleep temperature automatically.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Address insufficient dream recall first: You can\'t become lucid in dreams you don\'t remember - focus on dream journaling before attempting induction techniques.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Avoid mechanical reality checks: Perform reality checks with genuine curiosity about whether you\'re dreaming rather than going through the motions automatically.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Give techniques adequate time: Most methods require 2-4 weeks of consistent practice before showing results - don\'t give up after just a few nights.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Recognize plateau periods are normal: Even experienced lucid dreamers go through phases with fewer or no lucid dreams - this doesn\'t mean you\'ve lost the ability.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Don\'t overtrain with WBTB: Using wake-back-to-bed every night can lead to sleep deprivation - limit to 2-3 times per week maximum.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Control excitement when becoming lucid: Strong emotional reactions often cause immediate awakening - practice staying calm and composed in lucid dreams.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Always reality check after "waking": False awakenings are common - perform multiple reality checks whenever you think you\'ve awakened from a dream.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Address underlying sleep disorders: Sleep apnea, insomnia, or other conditions can prevent the REM sleep necessary for lucid dreaming.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Manage stress levels: High stress increases cortisol, which can suppress REM sleep and interfere with dream recall and lucidity.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Avoid trying too many techniques simultaneously: Master one technique at a time rather than confusing yourself by attempting multiple methods.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Don\'t expect perfect dream control immediately: Start with simple actions like looking at your hands before attempting complex dream manipulations.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Rotate techniques to prevent habituation: If a technique stops working, try different methods for 1-2 weeks before returning to previous approaches.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Address medication side effects: Many prescription drugs suppress REM sleep - consult with healthcare providers about alternatives if needed.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Don\'t neglect sleep quality for lucidity: Prioritize getting adequate, restful sleep rather than sacrificing sleep health for lucid dreaming attempts.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Recognize individual variation in ability: Some people are naturally better at lucid dreaming - focus on your personal progress rather than comparing to others.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Handle sleep paralysis calmly: If you experience sleep paralysis during WILD attempts, remain calm and wait - it\'s harmless and temporary.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Address environmental disruptions: Partners, pets, noise, or light pollution can fragment sleep and prevent sustained REM periods needed for lucidity.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Don\'t rely solely on supplements: Supplements can assist but shouldn\'t replace fundamental techniques like reality checking and dream journaling.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Manage performance pressure: Pressure to have lucid dreams can create anxiety that interferes with relaxation and sleep onset.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Identify personal dream signs: Generic dream signs may not work for you - analyze your own dreams to find elements that commonly appear in your dreams.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Practice patience with inconsistent results: Lucid dreaming ability naturally fluctuates - maintain consistent practice even during dry periods.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Address false awakening chains: If you experience multiple false awakenings in sequence, perform several different reality checks to break the pattern.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Don\'t assume techniques work immediately: Some people need weeks or months of practice before experiencing their first lucid dream.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Balance technique use with natural sleep: Don\'t use induction techniques every night - allow for regular, uninterrupted sleep to maintain overall health.' },
            { category: 'Common Obstacles and Troubleshooting', text: 'Recognize when to take breaks: If lucid dreaming practice is causing sleep problems or stress, take a break and focus on basic sleep hygiene.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice dream yoga awareness: Maintain continuous awareness across waking, sleeping, and dreaming states as taught in traditional contemplative practices.' },
            { category: 'Advanced Techniques and Practices', text: 'Use lucid dreams for skill rehearsal: Research shows that practicing motor skills in lucid dreams can improve real-world performance through motor cortex activation.' },
            { category: 'Advanced Techniques and Practices', text: 'Explore time perception in dreams: Experiment with the subjective experience of time dilation that naturally occurs during REM sleep periods.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice advanced dream control: Move beyond basic lucidity to actively create dream environments, characters, and scenarios through expectation and visualization.' },
            { category: 'Advanced Techniques and Practices', text: 'Use lucid dreams for creative problem-solving: Pose questions or challenges to your unconscious mind and seek solutions within lucid dreams, as documented in scientific breakthrough accounts.' },
            { category: 'Advanced Techniques and Practices', text: 'Experiment with dream character interactions: Engage with dream figures as potential sources of insight, as they may represent different aspects of your psyche.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice nightmare transformation: Use lucidity to consciously alter frightening dreams into positive or neutral experiences - a clinically validated approach for nightmare disorder.' },
            { category: 'Advanced Techniques and Practices', text: 'Use dreams for confronting fears: Safely face phobias, anxieties, or traumas within the controlled environment of lucid dreams, similar to exposure therapy principles.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice visualization for pain management: Use lucid states to visualize pain relief processes, as mental imagery can influence pain perception through known neurological pathways.' },
            { category: 'Advanced Techniques and Practices', text: 'Explore impossible physics: Experiment with flying, passing through walls, or other actions impossible in waking reality to understand dream consciousness.' },
            { category: 'Advanced Techniques and Practices', text: 'Master portal creation: Learn to create doorways or transitions to move between different dream environments through visualization techniques.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice summoning dream figures: Call forth helpful characters or teachers within dreams through expectation and visualization methods.' },
            { category: 'Advanced Techniques and Practices', text: 'Use lucid dreams for artistic inspiration: Explore visual, musical, or literary creations that might not occur to your conscious mind, as documented in artist accounts.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice dream within dream states: Some people achieve lucidity within false awakenings or nested dream experiences through enhanced metacognitive awareness.' },
            { category: 'Advanced Techniques and Practices', text: 'Master dream stabilization on command: Develop ability to instantly stabilize fading dreams through practiced stabilization techniques and expectation setting.' },
            { category: 'Advanced Techniques and Practices', text: 'Use lucid dreams for spiritual exploration: Engage with religious or spiritual practices, symbols, or experiences within the dream state for personal meaning-making.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice controlling multiple dream elements: Simultaneously manage environment, characters, and physics within complex dream scenarios through advanced expectation techniques.' },
            { category: 'Advanced Techniques and Practices', text: 'Experiment with synesthetic experiences: Explore seeing sounds, hearing colors, or other sensory crossovers that are naturally possible in the altered consciousness of dream states.' },
            { category: 'Advanced Techniques and Practices', text: 'Master instant dream scene creation: Develop ability to create detailed, stable dream environments through visualization and strong expectation of their reality.' },
            { category: 'Advanced Techniques and Practices', text: 'Practice advanced memory techniques: Use lucid dreams to enhance memory palaces or rehearse information for waking life recall through dream practice.' },
            { category: 'Advanced Techniques and Practices', text: 'Explore symbolic and archetypal content: Work with mythological figures, archetypal characters, or universal symbols that emerge naturally in dreams for psychological insight.' },
            { category: 'Psychological and Mindset Aspects', text: 'Develop unshakeable belief in your ability: Confidence in your capacity to achieve lucidity is crucial - cultivate genuine expectation of success.' },
            { category: 'Psychological and Mindset Aspects', text: 'Adopt a scientific experimenter mindset: View failed attempts as data collection rather than personal failures in your lucid dreaming research.' },
            { category: 'Psychological and Mindset Aspects', text: 'Release attachment to specific outcomes: Let go of expectations about what your lucid dreams should look like and remain open to whatever emerges.' },
            { category: 'Psychological and Mindset Aspects', text: 'Build on small successes: Celebrate brief moments of dream awareness rather than dismissing them as "not really lucid dreaming."' },
            { category: 'Psychological and Mindset Aspects', text: 'Maintain curiosity over performance anxiety: Approach lucid dreaming with genuine interest and wonder rather than pressure to perform.' },
            { category: 'Psychological and Mindset Aspects', text: 'Develop patience for the learning curve: Most practitioners require 1-3 months of consistent practice before experiencing regular lucid dreams.' },
            { category: 'Psychological and Mindset Aspects', text: 'Create positive associations with dreaming: Develop enthusiasm and excitement about your dream life rather than viewing it as separate from waking life.' },
            { category: 'Psychological and Mindset Aspects', text: 'Practice self-compassion with setbacks: Treat periods without lucid dreams with kindness rather than self-criticism or disappointment.' },
            { category: 'Psychological and Mindset Aspects', text: 'Cultivate metacognitive awareness: Strengthen your ability to observe your own thoughts and mental states throughout waking hours.' },
            { category: 'Psychological and Mindset Aspects', text: 'Address limiting beliefs about dreams: Challenge any beliefs that dreams are meaningless, dangerous, or beyond your control.' },
            { category: 'Psychological and Mindset Aspects', text: 'Develop emotional regulation skills: Practice staying calm under exciting circumstances, as this transfers to maintaining lucidity in dreams.' },
            { category: 'Psychological and Mindset Aspects', text: 'Build reality testing into your identity: Make questioning reality a natural part of who you are rather than a mechanical technique.' },
            { category: 'Psychological and Mindset Aspects', text: 'Maintain openness to unusual experiences: Stay receptive to strange or impossible dream experiences without immediately dismissing them.' },
            { category: 'Psychological and Mindset Aspects', text: 'Practice mindfulness in waking life: Develop present-moment awareness that transfers to increased consciousness during dreams.' },
            { category: 'Psychological and Mindset Aspects', text: 'Cultivate dream recall as a valuable skill: View dream memory as important and worthy of development rather than dismissing forgotten dreams.' },
            { category: 'Psychological and Mindset Aspects', text: 'Develop confidence in dream control: Expect that you can influence your dreams rather than assuming you\'re at the mercy of unconscious processes.' },
            { category: 'Psychological and Mindset Aspects', text: 'Practice accepting dream uncertainty: Become comfortable with the fluid, changeable nature of dream reality rather than demanding consistency.' },
            { category: 'Psychological and Mindset Aspects', text: 'Build lucid dreaming into your identity: See yourself as someone who is learning to be conscious in dreams rather than someone trying techniques.' },
            { category: 'Psychological and Mindset Aspects', text: 'Maintain enthusiasm through dry periods: Keep passion for lucid dreaming alive even when you\'re not experiencing frequent lucid dreams.' },
            { category: 'Psychological and Mindset Aspects', text: 'Address fears about dream content: Work through anxieties about nightmares, sleep paralysis, or losing control in dreams.' },
            { category: 'Psychological and Mindset Aspects', text: 'Practice emotional regulation in dreams: Learn to manage strong emotions within lucid dreams to maintain stability and control.' },
            { category: 'Psychological and Mindset Aspects', text: 'Develop realistic expectations: Understand that lucid dreaming is a skill that improves gradually with consistent practice.' },
            { category: 'Psychological and Mindset Aspects', text: 'Foster a growth mindset: View challenges and setbacks as opportunities to learn and improve your technique.' },
            { category: 'Psychological and Mindset Aspects', text: 'Create a supportive learning environment: Surround yourself with resources, communities, or friends who encourage your lucid dreaming practice.' },
            { category: 'Psychological and Mindset Aspects', text: 'Balance effort with relaxation: Find the sweet spot between actively pursuing lucidity and remaining relaxed enough to fall asleep naturally.' },
            { category: 'Psychological and Mindset Aspects', text: 'Cultivate dream awareness during waking: Practice noticing dream-like qualities in everyday experiences to strengthen lucid dreaming skills.' },
            { category: 'Psychological and Mindset Aspects', text: 'Develop patience with the unconscious mind: Understand that your unconscious processes have their own timing and cannot be forced.' },
            { category: 'Psychological and Mindset Aspects', text: 'Practice non-judgmental observation: Learn to observe your dreams and attempts without harsh self-criticism.' },
            { category: 'Psychological and Mindset Aspects', text: 'Maintain long-term perspective: Remember that lucid dreaming is a lifelong skill that continues to develop with practice.' },
            { category: 'Memory and Recall Enhancement', text: 'Write dreams immediately upon waking: Dream memory fades within 5-10 minutes, so capture experiences before moving or thinking about your day.' },
            { category: 'Memory and Recall Enhancement', text: 'Stay still when you first wake up: Movement can disrupt dream memory - remain in the same position while recalling dream details.' },
            { category: 'Memory and Recall Enhancement', text: 'Work backward from your last dream memory: If you only remember fragments, start with the last thing you recall and work backward through the dream.' },
            { category: 'Memory and Recall Enhancement', text: 'Use the "dream anchoring" technique: Choose a specific object in your bedroom to look at first thing upon waking to trigger dream memory.' },
            { category: 'Memory and Recall Enhancement', text: 'Practice dream recall throughout the day: Regularly remember and review your morning\'s dreams during idle moments to strengthen the memories.' },
            { category: 'Memory and Recall Enhancement', text: 'Set strong intentions for dream memory: Before sleep, firmly intend to remember your dreams upon waking - this programs your unconscious mind.' },
            { category: 'Memory and Recall Enhancement', text: 'Associate dream recall with existing habits: Link dream journaling to morning routines like drinking coffee or brushing teeth.' },
            { category: 'Memory and Recall Enhancement', text: 'Use mnemonic devices for dream content: Create memory aids like acronyms or visual associations to help retain dream details.' },
            { category: 'Memory and Recall Enhancement', text: 'Practice progressive dream recall: Start by remembering just one detail, then gradually work to recall longer and more complete dreams.' },
            { category: 'Memory and Recall Enhancement', text: 'Create a dream reconstruction ritual: Develop a consistent method for rebuilding complete dream narratives from fragments.' },
            { category: 'Memory and Recall Enhancement', text: 'Use voice memos for instant capture: Record dreams immediately if writing would be too disruptive to dream memory or sleep partners.' },
            { category: 'Memory and Recall Enhancement', text: 'Draw dream images when words fail: Sketch visual elements from dreams that are difficult to describe verbally.' },
            { category: 'Memory and Recall Enhancement', text: 'Review dreams before sleep: Read previous dream journal entries before bed to strengthen dream memory networks.' },
            { category: 'Memory and Recall Enhancement', text: 'Practice dream memory during naps: Use afternoon naps to practice dream recall when memory pressure is lower.' },
            { category: 'Memory and Recall Enhancement', text: 'Connect dreams to emotional states: Associate dream content with the emotions you felt, as emotional memories are often stronger.' },
            { category: 'Memory and Recall Enhancement', text: 'Use meditation to enhance memory: Regular meditation practice strengthens the mindfulness that supports better dream recall.' },
            { category: 'Memory and Recall Enhancement', text: 'Create dream memory palaces: Use spatial memory techniques to organize and retain complex dream narratives.' },
            { category: 'Memory and Recall Enhancement', text: 'Practice immediate dream sharing: Tell someone about your dream right after waking to reinforce the memory through verbalization.' },
            { category: 'Memory and Recall Enhancement', text: 'Use keywords to trigger fuller recall: Write down just 3-5 key dream elements, then use these to reconstruct the complete experience.' },
            { category: 'Memory and Recall Enhancement', text: 'Strengthen prospective memory: Practice remembering to do specific actions during the day to build the memory skills needed for lucid dreaming.' },
            { category: 'Dream Control Techniques', text: 'Start with simple control attempts: Begin by trying to look at your hands or move objects rather than attempting complex transformations.' },
            { category: 'Dream Control Techniques', text: 'Use expectation to shape dream reality: Strongly expect that your intended dream actions will work - doubt often causes techniques to fail.' },
            { category: 'Dream Control Techniques', text: 'Practice the "door technique" for scene changes: Create doors or portals to move between different dream environments.' },
            { category: 'Dream Control Techniques', text: 'Spin to change dream scenes: Spin around in your dream while expecting to arrive in a new location when you stop.' },
            { category: 'Dream Control Techniques', text: 'Use verbal commands for dream control: Say aloud what you want to happen: "Increase brightness," "Make this door lead to the ocean," etc.' },
            { category: 'Dream Control Techniques', text: 'Master flying through gradual progression: Start with small jumps, then higher leaps, then brief flights before attempting sustained flying.' },
            { category: 'Dream Control Techniques', text: 'Practice object transformation: Begin by changing colors or textures of objects before attempting to completely transform them into different items.' },
            { category: 'Dream Control Techniques', text: 'Use your hands as transformation tools: Point at objects and expect them to change when you focus your attention on them.' },
            { category: 'Dream Control Techniques', text: 'Summon dream characters through calling: Call out for specific people by name and expect them to appear from around corners or behind doors.' },
            { category: 'Dream Control Techniques', text: 'Control dream lighting with intention: Practice making dreams brighter or darker by expecting and demanding lighting changes.' },
            { category: 'Dream Control Techniques', text: 'Create mirrors for dream travel: Visualize mirrors as portals to other locations and step through them to change dream scenes.' },
            { category: 'Dream Control Techniques', text: 'Use telekinesis for object manipulation: Move objects with your mind by focusing intensely and expecting them to respond to your thoughts.' },
            { category: 'Dream Control Techniques', text: 'Practice size alteration: Experiment with making yourself larger or smaller, or changing the size of objects in your dreams.' },
            { category: 'Dream Control Techniques', text: 'Master dream time manipulation: Try to slow down or speed up dream time by setting strong expectations about temporal flow.' },
            { category: 'Dream Control Techniques', text: 'Use dream guides for assistance: Summon helpful characters who can teach you control techniques or guide you through difficult scenarios.' },
            { category: 'Dream Control Techniques', text: 'Practice weather control: Change dream weather by expecting rain, sunshine, snow, or storms to manifest.' },
            { category: 'Dream Control Techniques', text: 'Create complex dream environments: Build entire dreamscapes through detailed visualization and strong expectation of their reality.' },
            { category: 'Dream Control Techniques', text: 'Master dream character personality control: Influence how dream characters behave by expecting them to act in specific ways.' },
            { category: 'Dream Control Techniques', text: 'Use music or sounds for transformation: Expect background music or sound effects to accompany and enhance your dream control attempts.' },
            { category: 'Dream Control Techniques', text: 'Practice healing in dreams: Visualize healing light or energy to address pain or discomfort within the dream state.' },
            { category: 'Safety Considerations', text: 'Limit WBTB technique frequency: Use wake-back-to-bed only 2-3 times per week to prevent chronic sleep deprivation and health problems.' },
            { category: 'Safety Considerations', text: 'Consult physicians before using supplements: Galantamine and other dream-enhancing supplements can interact with medications and health conditions.' },
            { category: 'Safety Considerations', text: 'Don\'t sacrifice sleep quality for lucidity: Prioritize getting adequate, restful sleep rather than compromising sleep health for lucid dreaming attempts.' },
            { category: 'Safety Considerations', text: 'Recognize sleep paralysis as harmless: If you experience paralysis during WILD attempts, remain calm - it\'s a normal part of REM sleep.' },
            { category: 'Safety Considerations', text: 'Address concerning psychological symptoms: If lucid dreaming practice increases anxiety, depression, or reality confusion, consult a mental health professional.' },
            { category: 'Safety Considerations', text: 'Avoid intensive practice during stressful periods: High stress can worsen sleep quality and make lucid dreaming techniques counterproductive.' },
            { category: 'Safety Considerations', text: 'Don\'t use lucid dreaming to avoid real-life problems: Dreams should supplement, not replace, dealing with waking life challenges and responsibilities.' },
            { category: 'Safety Considerations', text: 'Be cautious with nightmare transformation: While usually helpful, confronting trauma in dreams may sometimes require professional therapeutic support.' },
            { category: 'Safety Considerations', text: 'Monitor for signs of sleep disruption: If techniques are causing insomnia, frequent awakenings, or daytime fatigue, reduce practice intensity.' },
            { category: 'Safety Considerations', text: 'Don\'t rely on dreams for important decisions: Use lucid dreams for exploration and creativity, but make significant life choices based on waking analysis.' },
            { category: 'Safety Considerations', text: 'Avoid practicing when ill or medicated: Illness and medications can alter sleep architecture and make lucid dreaming techniques potentially disruptive.' },
            { category: 'Safety Considerations', text: 'Recognize contraindications for certain conditions: People with psychosis, severe depression, or dissociative disorders should avoid intensive lucid dreaming practice.' },
            { category: 'Safety Considerations', text: 'Don\'t share beds during intensive training: Partner movements can disrupt the sleep architecture needed for lucid dreaming techniques.' },
            { category: 'Safety Considerations', text: 'Balance dream exploration with waking relationships: Maintain healthy social connections rather than becoming overly focused on dream experiences.' },
            { category: 'Safety Considerations', text: 'Use common sense with dream experiments: Avoid attempting dangerous actions in dreams that might carry over to risky waking behaviors.' },
            { category: 'Historical and Cultural Perspectives', text: 'Learn about Tibetan dream yoga traditions: This 1,000-year-old practice uses dreams for spiritual development and death preparation.' },
            { category: 'Historical and Cultural Perspectives', text: 'Study Aboriginal Dreamtime concepts: Understanding indigenous perspectives on dreaming as ongoing reality rather than mere sleep experiences.' },
            { category: 'Historical and Cultural Perspectives', text: 'Explore ancient Greek dream practices: Greeks used dream incubation in temples for healing and receiving divine guidance.' },
            { category: 'Historical and Cultural Perspectives', text: 'Research Hindu concepts of dream states: Hindu philosophy recognizes dreaming as one of four primary states of consciousness alongside waking and deep sleep.' },
            { category: 'Historical and Cultural Perspectives', text: 'Study Islamic perspectives on true dreams: Islamic tradition distinguishes between meaningful dreams from Allah and ordinary psychological dreams.' },
            { category: 'Historical and Cultural Perspectives', text: 'Learn about Native American vision quests: Many indigenous traditions use altered states of consciousness, including dreams, for spiritual guidance.' },
            { category: 'Historical and Cultural Perspectives', text: 'Explore Senoi dream practices: This Malaysian tribe traditionally shared and analyzed dreams each morning as central to their culture.' },
            { category: 'Historical and Cultural Perspectives', text: 'Study ancient Egyptian dream interpretation: Egyptians viewed dreams as messages from gods and developed extensive dream interpretation systems.' },
            { category: 'Historical and Cultural Perspectives', text: 'Research Sufi dream practices: Islamic mystical traditions use dreams for spiritual development and connection with divine consciousness.' },
            { category: 'Historical and Cultural Perspectives', text: 'Learn about Shamanic dreaming: Traditional shamans across cultures use lucid dreaming and dream travel for healing and spiritual work.' },
            { category: 'Historical and Cultural Perspectives', text: 'Explore Chinese Taoist sleep practices: Taoist traditions include maintaining awareness during sleep as part of spiritual cultivation.' },
            { category: 'Historical and Cultural Perspectives', text: 'Study European medieval dream traditions: Medieval Christians viewed some dreams as divine visions while others were considered demonic temptations.' },
            { category: 'Historical and Cultural Perspectives', text: 'Research modern therapeutic applications: Contemporary psychology uses dream work for trauma healing, creativity enhancement, and personal growth.' },
            { category: 'Historical and Cultural Perspectives', text: 'Learn about scientific validation history: Understand how laboratory research transformed lucid dreaming from folklore into legitimate scientific study.' },
            { category: 'Historical and Cultural Perspectives', text: 'Explore cultural variations in dream significance: Different societies place varying importance on dream content and its relationship to waking life.' },
            { category: 'Evidence-Based Advanced Applications', text: 'Use lucid dreams for motor skill enhancement: Research confirms that mental practice of physical skills in lucid dreams activates the same motor cortex regions as actual practice.' },
            { category: 'Evidence-Based Advanced Applications', text: 'Apply sports visualization principles: Athletes can use dream practice to improve performance, as motor imagery in dreams follows similar neural pathways to physical training.' },
            { category: 'Evidence-Based Advanced Applications', text: 'Practice exposure therapy for phobias: Use the safety of lucid dreams to gradually expose yourself to feared objects or situations, following established exposure therapy principles.' },
            { category: 'Evidence-Based Advanced Applications', text: 'Enhance creative problem-solving: Many documented cases exist of scientific and artistic breakthroughs emerging from dream states, including Kekulé\'s benzene ring discovery.' },
            { category: 'Evidence-Based Advanced Applications', text: 'Use dreams for emotional processing: Lucid dreams can provide a space for working through difficult emotions or relationship conflicts in a controlled environment.' }
        ];

// ===================================================================================
// TAGS & AUTOCOMPLETE SYSTEM
// ===================================================================================

// Common Dream Tags for Autocomplete
// Predefined tag suggestions to help users categorize dreams consistently
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

// Dream Signs Database
// Common elements that can trigger lucidity when recognized in dreams
// Organized by type for systematic reality check training
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
    
// ===================================================================================
// PAGINATION CONFIGURATION
// ===================================================================================

// Goals System Pagination
// Number of goals displayed per page in goals interface
const GOALS_PER_PAGE = 5;

// TODO: Consider moving GOALS_PER_PAGE into CONSTANTS object for consistency
// TODO: Add additional pagination constants if needed for other interfaces