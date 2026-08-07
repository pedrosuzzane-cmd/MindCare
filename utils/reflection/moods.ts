export interface MoodProfile {
  summary: string[];
  positive: string[];
  suggestion: string[];
  encouragement: string[];
  tips: string[];
}

/**
 * Per-mood template banks. Sentences are fragments/self-contained so they can
 * combine with theme + category sentences to form the four reflection sections.
 */
export const MOOD_PROFILES: Record<string, MoodProfile> = {
  happy: {
    summary: [
      "your writing carries a genuinely bright energy today.",
      "there's a light, warm feeling threaded through what you shared.",
      "your words today feel buoyant — something good is clearly going on.",
      "joy comes through clearly in the way you wrote about today.",
    ],
    positive: [
      "You took a moment to notice a good feeling — that's a skill worth keeping.",
      "You're actively savoring what's going well, which makes good days last longer.",
      "You recognized something positive and held onto it — that awareness deepens well-being.",
      "Noticing and naming a good moment is a quiet form of self-care.",
    ],
    suggestion: [
      "Share a little of this joy with someone you care about — good feelings grow when shared.",
      "Write down one thing that made today feel good so you can revisit it on a harder day.",
      "Use this energy for a small act that feels meaningful, even if it's tiny.",
      "Let this good feeling fuel something you've been putting off — you're primed for it.",
    ],
    encouragement: [
      "You don't have to hold onto happiness all day — noticing it is already enough.",
      "Let this good moment count. You earned it.",
      "Carry a little of today's brightness into tomorrow.",
      "Days like this are proof of how far you've come.",
    ],
    tips: [
      "Share today's highlight with someone you trust",
      "Write down one thing that made you happy today",
      "Celebrate yourself — you earned this good mood",
      "Revisit the good moment before you sleep",
    ],
  },
  calm: {
    summary: [
      "there's a steady, settled calm in your writing today.",
      "your reflection feels quiet and centered — like you found some inner peace.",
      "a sense of ease comes through in what you wrote today.",
      "your words carry a gentle, unhurried energy.",
    ],
    positive: [
      "You noticed and named your calm — that's a real achievement in a busy student life.",
      "You created space to feel settled, and that takes intention.",
      "You recognized a peaceful moment and let it register — that's mindfulness in action.",
      "You protected a moment of stillness for yourself, and that's a healthy choice.",
    ],
    suggestion: [
      "Notice what helped you feel calm today and make a little more room for it.",
      "Protect a few quiet minutes for yourself tomorrow, before the day fills up.",
      "Take five slow breaths now to carry this steadiness with you.",
      "Carry this calm into one small task — it will help you stay focused.",
    ],
    encouragement: [
      "Calm is something you can return to — it lives inside you, not outside.",
      "You found stillness today. Let it be a sign of what you're capable of.",
      "Settle into this feeling — you don't have to rush anywhere.",
      "This is your baseline — you can always come back to it.",
    ],
    tips: [
      "Notice what helped you feel calm and do more of it",
      "Take five slow breaths to keep the peace going",
      "Protect a few quiet minutes just for yourself",
      "Take a short, unhurried walk",
    ],
  },
  relaxed: {
    summary: [
      "your writing has a settled, easy energy today.",
      "there's a relaxed, unhurried feeling in what you shared.",
      "today reads softly — like you let your shoulders drop a little.",
      "a low-pressure, comfortable mood comes through in your words.",
    ],
    positive: [
      "You gave yourself permission to be at ease — that's a healthy habit.",
      "You noticed the absence of pressure, and that awareness protects it.",
      "You allowed a low-key moment to count — not everything has to be intense.",
      "You honored the value of simply being, which many people forget to do.",
    ],
    suggestion: [
      "Keep a slot of unstructured time tomorrow, even twenty minutes.",
      "Enjoy something low-pressure today — music, a favorite show, or a walk with no destination.",
      "Notice where relaxation shows up in your body, and thank it.",
      "Protect this easy energy by saying no to one unnecessary task.",
    ],
    encouragement: [
      "You don't need to earn rest — it's yours by right.",
      "Let this ease remind you that not every moment has to be productive.",
      "Relaxation is not time wasted; it's time refilled.",
      "You're allowed to enjoy the slow moments — they matter.",
    ],
    tips: [
      "Keep a slot of unstructured time tomorrow",
      "Enjoy something low-pressure, like music or a favorite show",
      "Notice how relaxation shows up in your body",
      "Rest without checking your phone for a while",
    ],
  },
  good: {
    summary: [
      "a good, steady feeling runs through your writing today.",
      "your reflection has a positive undertone — things feel workable.",
      "today looks a little brighter in your words.",
      "there's a dependable, grounded mood in what you shared.",
    ],
    positive: [
      "You took time to acknowledge a decent day — that practice deepens well-being.",
      "You noticed the good in an ordinary day, which is quietly powerful.",
      "You're building momentum on a good stretch, and that takes self-awareness.",
      "You recognized that things are working, and you let yourself enjoy it.",
    ],
    suggestion: [
      "Build on this by setting one small positive intention for the next few hours.",
      "Connect with someone — good feelings often grow when they're shared.",
      "Use this energy for a short walk or some movement to keep it going.",
      "Write down what's working so you can recreate it on harder days.",
    ],
    encouragement: [
      "Good days are worth protecting — you're allowed to enjoy them.",
      "You're on a good path. Keep taking it one step at a time.",
      "This is the you that gets to show up when things feel okay. Let it.",
      "Steady progress is still progress — keep going.",
    ],
    tips: [
      "Set one small positive intention for the rest of the day",
      "Connect with someone — good feelings grow when shared",
      "Use the energy for a short walk or movement",
      "Note one thing that's going well right now",
    ],
  },
  neutral: {
    summary: [
      "your writing has a steady, in-between feeling today — neither high nor low.",
      "there's a neutral, even energy in what you shared.",
      "today feels like a quiet middle — not much noise, just noticing.",
      "your mood today sits somewhere in the middle, and that's completely okay.",
    ],
    positive: [
      "You checked in even on a flat-feeling day — that consistency builds self-understanding.",
      "Noticing that things feel 'okay' is still a form of awareness.",
      "You showed up for yourself even when there wasn't a strong emotion — that counts.",
      "You gave yourself space to simply observe, which is a valuable skill.",
    ],
    suggestion: [
      "Try naming one small thing that went okay today — it anchors the neutral moments.",
      "Take five slow breaths to tune into your body and see what it's really telling you.",
      "Set one gentle, low-pressure intention for tomorrow.",
      "Try one tiny change of scenery — sometimes a shift in place shifts the mood.",
    ],
    encouragement: [
      "Not every day needs to feel like something. Paying attention is enough.",
      "A neutral day is not a wasted day — it's a rest for your emotions.",
      "You don't have to force a feeling. Showing up is the practice.",
      "Even ground is fine ground to build from.",
    ],
    tips: [
      "Write down three small things that went okay today",
      "Take five slow breaths to check in with your body",
      "Set one gentle intention for tomorrow",
      "Take a short walk to reset your mind",
    ],
  },
  worried: {
    summary: [
      "worry is taking up real space in your mind today.",
      "there's a thread of worry running through what you shared.",
      "your writing holds some unease about things ahead.",
      "concern about what's to come is clearly weighing on you.",
    ],
    positive: [
      "Worry takes real energy, and you still showed up to write — that takes strength.",
      "You noticed the worry instead of letting it run silently — that's the first step to managing it.",
      "Naming what concerns you is an act of courage in itself.",
      "You're paying attention to your worry rather than being swallowed by it.",
    ],
    suggestion: [
      "Try box breathing — inhale four, hold four, exhale four, hold four — a few times to settle your body.",
      "Write your worries down on paper; naming them often shrinks their power.",
      "Focus only on what you can control today, and let the rest wait its turn.",
      "Talk it through with someone you trust — a second perspective eases worry.",
    ],
    encouragement: [
      "Worry is a sign you care. You don't have to carry it all at once.",
      "The future is uncertain for everyone — you don't have to solve it today.",
      "You've gotten through every hard moment so far. This one counts too.",
      "What you're worried about is likely smaller than it feels right now.",
    ],
    tips: [
      "Try box breathing: inhale 4, hold 4, exhale 4, hold 4",
      "Write your worries down — naming them shrinks their power",
      "Focus only on what you can control today",
      "Talk to someone you trust about what's on your mind",
    ],
  },
  sad: {
    summary: [
      "sadness comes through clearly in your writing today.",
      "there's a heavy, tender feeling in what you shared.",
      "your words carry some sadness today — and that's allowed.",
      "a quiet grief or heaviness is present in your reflection.",
    ],
    positive: [
      "You let yourself feel sadness without turning away — that's real emotional courage.",
      "Writing about sadness is a way of holding it, not being trapped by it.",
      "You honored a feeling that's hard to name — that takes bravery.",
      "You're staying present with your feelings, which is how healing begins.",
    ],
    suggestion: [
      "Let yourself feel without judgment — emotions pass like weather.",
      "Reach out to someone who makes you feel safe, even just a short message.",
      "Do one small comforting thing just for you today.",
      "Be extra gentle with yourself tonight — rest, warmth, and patience.",
    ],
    encouragement: [
      "Sadness is a signal that something matters to you. You don't have to carry it alone.",
      "You are not the sadness — you're the person noticing it.",
      "Be as gentle with yourself as you'd be with a friend having a hard day.",
      "This feeling will soften with time. Be patient with yourself until it does.",
    ],
    tips: [
      "Let yourself feel without judgment; emotions pass like weather",
      "Reach out to someone who makes you feel safe",
      "Do one small comforting thing just for you",
      "Allow yourself time to rest and recharge",
    ],
  },
  overwhelmed: {
    summary: [
      "a lot is clearly resting on your shoulders today.",
      "your writing shows that feeling of having too much on your plate.",
      "there's a sense of overwhelm in what you shared — like everything is loud at once.",
      "so much is demanding your attention that it all feels like one big wall.",
    ],
    positive: [
      "When everything felt like too much, you still made space to write — that's resilience.",
      "You recognized the overwhelm instead of numbing it, which is a powerful first step.",
      "Naming 'I have too much' is the beginning of letting some of it go.",
      "You identified the load you're carrying — and that's the first step to lightening it.",
    ],
    suggestion: [
      "Pause and take ten slow breaths before anything else — you're safe in this moment.",
      "Write down everything on your mind, then pick just ONE small thing to start with.",
      "Ask for help, or delegate one task today — you don't have to hold it all.",
      "Give yourself permission to postpone something that can truly wait.",
    ],
    encouragement: [
      "You don't have to solve everything at once — one small step is enough for now.",
      "Overwhelm means you're carrying a lot, not that you're failing.",
      "The pile will still be there tomorrow; it can wait while you breathe.",
      "You've managed impossible weeks before — you'll manage this one too.",
    ],
    tips: [
      "Pause and take ten slow breaths before anything else",
      "Write down everything on your mind, then pick ONE small thing",
      "Ask for help or delegate one task today",
      "Remove or postpone one non-essential task",
    ],
  },
  exhausted: {
    summary: [
      "your energy is clearly running low today.",
      "tiredness comes through in every line of what you shared.",
      "your writing sounds like it needs a rest — and that's a real signal.",
      "there's a deep, bone-level tiredness in what you wrote.",
    ],
    positive: [
      "Even running on empty, you found the energy to check in with yourself — that matters.",
      "You listened to your tiredness instead of pushing through it — that's self-care.",
      "Noticing your low energy is the first step to refilling it.",
      "You gave your fatigue the respect it deserves by acknowledging it.",
    ],
    suggestion: [
      "Give yourself fifteen to twenty minutes of rest without guilt — rest is how you refill.",
      "Drink a full glass of water and eat something nourishing; fatigue often hides behind those.",
      "Plan to sleep a little earlier tonight — your body is asking for it.",
      "Postpone one task and protect your energy instead.",
    ],
    encouragement: [
      "Rest isn't a reward — it's how you keep going. You deserve it.",
      "You can't pour from an empty cup. Refilling it isn't selfish.",
      "Tonight is a chance to reset. Let it be.",
      "You don't have to be productive to be valuable.",
    ],
    tips: [
      "Give yourself 15–20 minutes of rest without guilt",
      "Drink a full glass of water and eat something nourishing",
      "Plan to sleep a little earlier tonight",
      "Step away from screens for a while",
    ],
  },
  stressed: {
    summary: [
      "your writing reflects real pressure today.",
      "there's a clear thread of stress running through what you shared.",
      "you're carrying visible stress today, and that's a lot to hold.",
      "tension and urgency come through clearly in your words.",
    ],
    positive: [
      "Despite feeling stressed, you still took time to put your feelings into words.",
      "You noticed the stress instead of letting it run you — that awareness is a strength.",
      "Naming what's causing the pressure is a real act of self-awareness.",
      "You're engaged and trying hard — that effort deserves recognition.",
    ],
    suggestion: [
      "Try 4-7-8 breathing — inhale four, hold seven, exhale eight — a few times to calm your body.",
      "Step away from the stressful situation for five minutes; distance creates clarity.",
      "Do one task at a time — trying to do everything at once feeds stress.",
      "Write down what's urgent versus what can actually wait.",
    ],
    encouragement: [
      "You don't need to accomplish everything today — steady progress is enough.",
      "Stress is loud, but it's not the whole story. You are more than this moment.",
      "Tomorrow is another chance to keep moving forward, one small step at a time.",
      "You're handling a hard situation — that counts for more than you think.",
    ],
    tips: [
      "Try 4-7-8 breathing: inhale 4, hold 7, exhale 8",
      "Step away from the stressful situation for 5 minutes",
      "Do one task at a time — multitasking feeds stress",
      "Take a short walk to reset your mind",
    ],
  },
  burnout: {
    summary: [
      "your writing sounds genuinely burned out today.",
      "there's a heavy, drained feeling in what you shared — like the tank is empty.",
      "burnout is real in your words today, and it deserves to be taken seriously.",
      "exhaustion from giving too much for too long is clear in your reflection.",
    ],
    positive: [
      "Recognizing burnout instead of pushing through is a strong, caring choice.",
      "You named the exhaustion — that's the first step toward real recovery.",
      "It takes courage to admit you need to slow down.",
      "You're listening to your limits, which is wisdom, not weakness.",
    ],
    suggestion: [
      "Cancel a non-essential commitment and truly rest — burnout asks for recovery, not a quick fix.",
      "Step away from screens for an hour and let your mind drift.",
      "Reconnect with one thing that used to bring you joy, without any pressure.",
      "Consider reaching out to a counselor — support is a strength, not a failure.",
    ],
    encouragement: [
      "Burnout is a signal that you've been giving too much. You're allowed to pull back.",
      "Recovery is not weakness — it's how you get your energy back.",
      "One good rest is a start. You don't have to fix everything at once.",
      "Your well-being matters more than any deadline.",
    ],
    tips: [
      "Cancel a non-essential commitment and truly rest",
      "Step away from screens for an hour today",
      "Reconnect with one thing that used to bring you joy",
      "Prioritize sleep and nourishment tonight",
    ],
  },
  "very-upset": {
    summary: [
      "this sounds like a genuinely hard day for you.",
      "your writing holds a lot of pain today, and that deserves kindness.",
      "there's real hurt in what you shared — thank you for trusting this space with it.",
      "you're carrying something very heavy right now, and you don't have to carry it alone.",
    ],
    positive: [
      "You were brave enough to put a painful feeling into words — that is not small.",
      "Even on your hardest day, you reached for understanding. That's strength.",
      "You didn't stay silent about how you feel — that matters more than you know.",
      "You reached out through your writing, and that is a courageous act.",
    ],
    suggestion: [
      "Reach out to someone you trust right now — you don't have to carry this alone.",
      "Move to a quiet, comfortable space and breathe slowly for a few minutes.",
      "If you need support, a crisis helpline is always available — reaching out is a sign of strength.",
      "Do one tiny thing to care for your body — water, a blanket, a deep breath.",
    ],
    encouragement: [
      "This feeling is real, and it will not stay this strong forever.",
      "You have survived every hard moment before this one. You will survive this too.",
      "Please be gentle with yourself tonight. You are more loved than you feel right now.",
      "You are not alone in this — there are people ready to help you.",
    ],
    tips: [
      "Reach out to someone you trust right now",
      "Move to a quiet, comfortable space and breathe slowly",
      "If you need support, a crisis helpline is always available",
      "Be gentle with yourself and rest if you can",
    ],
  },
};
