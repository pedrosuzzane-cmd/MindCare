export interface ThemeProfile {
  summary: string[];
  positive: string[];
  suggestion: string[];
  encouragement: string[];
  tips: string[];
}

export interface ThemeDefinition extends ThemeProfile {
  keywords: RegExp;
}

/**
 * Keyword rules map free-text thoughts to reflection themes. Regexes are
 * word-boundary safe and case-insensitive.
 */
export const THEME_KEYWORDS: Record<string, RegExp> = {
  academic: /\b(exam|exams|exam(s)?|test|tests|quiz|assignment|assignments|deadline|deadlines|homework|study|studying|study session|class|classes|lecture|lectures|gpa|grade|grades|project|thesis|midterm|final|finals|homework|paper|essay|course|coursework|professor|group project|presentation|recitation|lab)\b/i,
  social: /\b(friend|friends|friendship|friendships|hangout|hang out|party|party|social|boyfriend|girlfriend|couple|crush|romance|date|dating|text|texts|messaged|message|chat|group chat|family|siblings|mom|dad|parents|teammates|roommate|roommates|colleague|colleagues|acquaintance)\b/i,
  sleep: /\b(sleep|slept|sleeping|insomnia|nap|napped|tired|exhausted|fatigue|rest|rested|bed|bedtime|woke up|waking|night|late night|all-nighter|caffeine|coffee|energy)\b/i,
  anxiety: /\b(anxious|anxiety|nervous|nervousness|panic|panicked|worry|worried|worries|overthink|overthinking|racing thoughts|heart racing|on edge|uneasy|unease|dread|fear|afraid|scared|tense|tension|stress|stressed|pressure|overwhelmed)\b/i,
  sadness: /\b(sad|sadness|unhappy|down|blue|depressed|depression|grief|grieving|miss|missing|lonely|loneliness|isolated|cried|crying|tears|heartbroken|heartbreak|breakup|hurt|hurt me|let down|disappointed|empty|numb)\b/i,
  work: /\b(work|works|working|job|internship|intern|shift|overtime|boss|manager|co-worker|coworker|meeting|meetings|project|tasks|workload|burnout|burnt out|burned out|career|promotion|resume|interview)\b/i,
  gratitude: /\b(grateful|gratitude|thankful|thanks|blessed|appreciate|appreciation|gift|lucky|fortunate|blessing|good day|great day|amazing|wonderful|blessings)\b/i,
  growth: /\b(grow|growth|learn|learned|learning|improve|improvement|progress|progressed|developed|developing|skill|skills|habit|habits|goals|goal|achieved|accomplished|accomplishment|finished|completed|overcame|conquered|better version|challenge|challenged|step back|steps back)\b/i,
  future: /\b(future|plan|plans|planning|dream|dreams|career|major|graduation|graduate|next year|next semester|apply|applying|college|university|job market|life after|long term|long-term|uncertain|unsure what|direction|path)\b/i,
  conflict: /\b(argument|argued|arguing|fight|fought|conflict|disagreement|disagreed|upset with|mad at|angry with|frustrated with|frustration|resentment|hurt by|betrayed|lied|liar|misunderstood|ignored|excluded|left out|avoiding|avoided|falling out|fell out)\b/i,
};

export const THEME_PROFILES: Record<string, ThemeDefinition> = {
  academic: {
    keywords: THEME_KEYWORDS.academic,
    summary: [
      "academics are clearly front and center for you today.",
      "a lot of your attention is on schoolwork and studying right now.",
      "your writing centers on academic demands — classes, deadlines, or study.",
      "school stuff is taking up a big part of your mind today.",
    ],
    positive: [
      "You're actively engaged in your studies, and that effort is real progress.",
      "You're facing academic pressure head-on instead of avoiding it.",
      "Caring about your work this much is part of what makes you reliable.",
      "You're showing up for your goals even when it isn't easy.",
    ],
    suggestion: [
      "Break your next task into one small step you can start in five minutes.",
      "Try the Pomodoro method — 25 minutes focused, 5 minutes off — to make studying lighter.",
      "Tackle the hardest task when your energy is highest, and save easy ones for later.",
      "Review for short, spaced sessions instead of long marathons — it sticks better.",
    ],
    encouragement: [
      "One solid session is better than ten distracted hours. Protect your focus.",
      "You don't have to master it all in one night — progress is built in steps.",
      "Your grades don't define your worth, but your effort does you credit.",
      "You've handled tough workloads before — you can handle this one too.",
    ],
    tips: [
      "Start with the smallest step of your next task",
      "Try 25 minutes of focus, 5 minutes of rest",
      "Do the hardest task at your peak energy time",
      "Study in short, spaced sessions",
    ],
  },
  social: {
    keywords: THEME_KEYWORDS.social,
    summary: [
      "your writing is full of people — friends, family, or connection.",
      "relationships and social life are central to your thoughts today.",
      "a lot of your energy today is about the people around you.",
      "your reflection centers on connection with others.",
    ],
    positive: [
      "You're investing in relationships, and that's one of the healthiest habits there is.",
      "You care about the people in your life, and it shows.",
      "Noticing how others affect you is real emotional intelligence.",
      "You're building the social bonds that carry people through hard times.",
    ],
    suggestion: [
      "Send a short, warm message to someone you've been meaning to check in on.",
      "Reach out for a real conversation — a call or face-to-face beats text for connection.",
      "Set a small boundary where you need one — healthy relationships include limits.",
      "Plan one low-pressure social moment this week, even coffee with a friend.",
    ],
    encouragement: [
      "The people who matter will be glad you reached out — connection is mutual.",
      "You don't have to be social all the time; quality moments count far more.",
      "Strong relationships are built one honest conversation at a time.",
      "You're more liked than you think — people probably appreciate you quietly.",
    ],
    tips: [
      "Message someone you've been meaning to check in on",
      "Have a real conversation — call or in person",
      "Set one small boundary where you need it",
      "Plan one low-pressure social moment this week",
    ],
  },
  sleep: {
    keywords: THEME_KEYWORDS.sleep,
    summary: [
      "your writing shows that sleep or energy is on your mind today.",
      "tiredness and rest are central themes in what you shared.",
      "your reflection centers on sleep — or the lack of it.",
      "fatigue and rest are clearly occupying your thoughts.",
    ],
    positive: [
      "You noticed how tiredness affects you — that awareness is the first step to fixing it.",
      "You're paying attention to your body's need for rest.",
      "Recognizing the link between sleep and mood is a real insight.",
      "You're listening to your energy instead of pushing through it.",
    ],
    suggestion: [
      "Try to keep a consistent sleep schedule — even on weekends, it stabilizes your energy.",
      "Dim the lights and put screens away thirty minutes before bed tonight.",
      "Avoid caffeine after mid-afternoon — it can silently rob you of deep sleep.",
      "A short daytime nap (under 30 minutes) can recharge without ruining tonight's sleep.",
    ],
    encouragement: [
      "Sleep is not a luxury — it's how your mind repairs itself.",
      "You can catch up on tasks, but you can't easily catch up on lost rest. Protect it.",
      "One good night of sleep can change your whole outlook.",
      "You're allowed to be tired. Rest is a skill worth practicing.",
    ],
    tips: [
      "Keep a consistent sleep schedule, even on weekends",
      "Put screens away 30 minutes before bed",
      "Avoid caffeine after mid-afternoon",
      "Keep naps under 30 minutes",
    ],
  },
  anxiety: {
    keywords: THEME_KEYWORDS.anxiety,
    summary: [
      "anxiety is taking up real space in your mind today.",
      "there's a thread of worry or nervousness running through your writing.",
      "unease and tension are clearly present in what you shared.",
      "your reflection holds a fair amount of anxious energy.",
    ],
    positive: [
      "You noticed the anxiety instead of letting it run silently — that's a powerful first step.",
      "Naming your worry is the beginning of managing it.",
      "You're staying present with uncomfortable feelings, and that takes courage.",
      "You reached for understanding while feeling uneasy — that's real strength.",
    ],
    suggestion: [
      "Try 4-7-8 breathing — inhale for 4, hold for 7, exhale for 8 — a few rounds to settle your body.",
      "Anchoring senses can calm the mind: name 3 things you see, 2 you hear, 1 you feel.",
      "Write out the worst case and the most likely case — worry often shrinks when it's specific.",
      "Move your body for five minutes; releasing physical tension releases mental tension.",
    ],
    encouragement: [
      "Anxiety is loud, but it's not always right. You are stronger than the noise.",
      "You've faced uncertainty before and made it through. This time is no different.",
      "It's okay to feel anxious and still handle things one step at a time.",
      "You don't have to calm the whole storm — just this next wave.",
    ],
    tips: [
      "Try 4-7-8 breathing: inhale 4, hold 7, exhale 8",
      "Ground yourself: 3 things you see, 2 you hear, 1 you feel",
      "Write out the worst case and the most likely case",
      "Move your body for five minutes",
    ],
  },
  sadness: {
    keywords: THEME_KEYWORDS.sadness,
    summary: [
      "sadness comes through clearly in your writing today.",
      "there's a tender, heavy feeling in what you shared.",
      "your reflection carries some grief or hurt today.",
      "a quiet sadness is present in your words — and that's allowed.",
    ],
    positive: [
      "You let yourself feel sadness instead of pushing it away — that's real courage.",
      "Writing about what hurts is a way of holding it, not being trapped by it.",
      "You honored a feeling that's hard to face, and that takes bravery.",
      "You're staying present with your feelings, which is how healing begins.",
    ],
    suggestion: [
      "Let yourself feel without judgment — emotions pass through like weather.",
      "Reach out to someone who makes you feel safe, even a short message.",
      "Do one small comforting thing just for you today.",
      "Be extra gentle with yourself tonight — rest, warmth, and patience.",
    ],
    encouragement: [
      "Sadness is a signal that something matters to you. You don't have to carry it alone.",
      "You are not the sadness — you're the person noticing it.",
      "Be as kind to yourself as you'd be to a friend having a hard day.",
      "This feeling will soften with time. Be patient with yourself until it does.",
    ],
    tips: [
      "Let yourself feel without judgment",
      "Reach out to someone who makes you feel safe",
      "Do one small comforting thing for yourself",
      "Rest and be gentle with yourself tonight",
    ],
  },
  work: {
    keywords: THEME_KEYWORDS.work,
    summary: [
      "work or your job is clearly on your mind today.",
      "your writing centers on workplace demands and pressures.",
      "a lot of your energy is going into work-related concerns.",
      "your reflection is focused on your job or career responsibilities.",
    ],
    positive: [
      "You're taking your work seriously, and that reliability is valuable.",
      "You're reflecting on work-life balance, which is a healthy sign.",
      "You noticed the workload pressure instead of silently absorbing it.",
      "You're building professional experience, and that effort compounds over time.",
    ],
    suggestion: [
      "Clarify one priority with your boss or team — it reduces guesswork and stress.",
      "Protect a clear end to your workday; boundaries protect your energy.",
      "Batch similar small tasks together to make your workload feel lighter.",
      "If burnout is creeping in, consider discussing workload adjustments with your manager.",
    ],
    encouragement: [
      "Your work matters, but it's not the whole of who you are.",
      "You're handling a demanding responsibility — that deserves acknowledgment.",
      "Setbacks at work don't define your value or your trajectory.",
      "One step at a time is how any workload gets done.",
    ],
    tips: [
      "Clarify one priority with your team or manager",
      "Set a clear end to your workday",
      "Batch small similar tasks together",
      "Take real breaks, even short ones",
    ],
  },
  gratitude: {
    keywords: THEME_KEYWORDS.gratitude,
    summary: [
      "your writing carries a warm, thankful energy today.",
      "gratitude shines through in what you shared.",
      "your reflection is full of appreciation for what's going well.",
      "a grateful perspective comes through clearly in your words.",
    ],
    positive: [
      "You took time to notice what's good — that practice measurably boosts well-being.",
      "Gratitude is one of the most powerful habits for mental health, and you're doing it.",
      "You're actively savoring the good, which deepens its benefits.",
      "Recognizing what you have is a quiet superpower.",
    ],
    suggestion: [
      "Tell one person you're grateful for them — gratitude grows when it's shared.",
      "Write one specific 'why' behind what you're thankful for; it deepens the effect.",
      "Start a tiny gratitude habit — one good thing a day keeps perspective strong.",
      "Notice a small everyday comfort and give it a moment of attention.",
    ],
    encouragement: [
      "Gratitude is a muscle you're strengthening — keep using it.",
      "The good things deserve your attention just as much as the hard things.",
      "This thankfulness is part of your resilience, not separate from it.",
      "A grateful heart carries you through rough seasons.",
    ],
    tips: [
      "Tell one person you're grateful for them",
      "Write down the 'why' behind what you're thankful for",
      "Name one good thing from today",
      "Savor a small everyday comfort",
    ],
  },
  growth: {
    keywords: THEME_KEYWORDS.growth,
    summary: [
      "your writing reflects progress and personal growth.",
      "you're clearly focused on improving or developing yourself today.",
      "your reflection centers on goals, learning, and moving forward.",
      "a self-improvement mindset is strong in what you shared.",
    ],
    positive: [
      "You're actively investing in becoming a better version of yourself.",
      "You're tracking progress, and that discipline is exactly how growth happens.",
      "You're learning from experience instead of repeating it — that's real wisdom.",
      "Your willingness to grow is one of your strongest qualities.",
    ],
    suggestion: [
      "Turn one big goal into a tiny daily action you can actually keep.",
      "Measure progress against last month, not perfection — small gains add up.",
      "Revisit what you've already achieved; it's more than you're giving yourself credit for.",
      "Find one person who models where you want to be, and learn from their path.",
    ],
    encouragement: [
      "Progress isn't always visible, but it's always happening when you stay consistent.",
      "You're not where you want to be yet — and that's exactly how growth works.",
      "Every step counts, even the small ones you barely notice.",
      "The effort you're putting in today becomes who you are tomorrow.",
    ],
    tips: [
      "Turn one big goal into a tiny daily action",
      "Compare progress to last month, not perfection",
      "List what you've already achieved",
      "Learn from someone who models your goal",
    ],
  },
  future: {
    keywords: THEME_KEYWORDS.future,
    summary: [
      "your writing shows you're thinking a lot about what's ahead.",
      "the future — plans, direction, or uncertainty — is on your mind today.",
      "your reflection centers on what comes next for you.",
      "you're clearly looking ahead and weighing your options.",
    ],
    positive: [
      "You're actively thinking about your future, which is how plans take shape.",
      "Wrestling with uncertainty shows you care about where you're headed.",
      "You're considering your options rather than drifting — that's initiative.",
      "Thinking ahead is a sign of ambition and self-awareness.",
    ],
    suggestion: [
      "Write down one concrete next step toward a future you want — even a small one.",
      "Talk to someone who's been where you want to go; real advice beats guessing.",
      "Separate what you can plan from what you can't, and plan only what you control.",
      "Try one small experiment this week that tests a direction you're curious about.",
    ],
    encouragement: [
      "You don't need the whole map — you just need the next step.",
      "Uncertainty is part of every meaningful path. You're not behind.",
      "The future isn't decided yet, which means it can go the way you choose.",
      "Every big journey starts with a single, imperfect step.",
    ],
    tips: [
      "Write one concrete next step toward your goal",
      "Talk to someone who's been where you want to go",
      "Plan only what's within your control",
      "Try one small experiment this week",
    ],
  },
  conflict: {
    keywords: THEME_KEYWORDS.conflict,
    summary: [
      "your writing reflects some tension or conflict with someone.",
      "a disagreement or strained relationship is on your mind today.",
      "your reflection centers on friction with another person.",
      "there's unresolved tension in what you shared.",
    ],
    positive: [
      "You recognized the conflict instead of letting it fester — that takes maturity.",
      "Reflecting on a difficult interaction is how you handle it better next time.",
      "You care enough about the relationship to think it through.",
      "Naming the tension is the first step toward resolving it.",
    ],
    suggestion: [
      "When you're calm, try a brief, honest conversation starting with 'I felt...' rather than 'You always...'.",
      "Write down what you actually want from this situation before addressing it.",
      "Take a pause before responding — a cooling-off moment protects the relationship.",
      "Consider what the other person might be experiencing; it often softens the conflict.",
    ],
    encouragement: [
      "Disagreements are normal in any meaningful relationship — they can even strengthen it.",
      "You can handle this with honesty and kindness; you don't have to be perfect.",
      "Repairing a rift takes courage, and you're capable of it.",
      "You've resolved hard moments before — this one is no different.",
    ],
    tips: [
      "Use 'I felt...' instead of 'You always...'",
      "Write down what you actually want from the situation",
      "Take a pause before responding",
      "Consider the other person's perspective",
    ],
  },
};
