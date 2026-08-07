/**
 * Topic-led reflection content banks (Layer 1 - Stage 3).
 *
 * Content is generated from the DETECTED TOPIC first, then refined with the
 * emotion and mood — so a sad journal about weather produces a weather-aware
 * reflection, not a generic relationship one.
 *
 * `observation` fragments are lowercase because they follow a time-of-day
 * opener ("Late at night, ..."). The other fields are standalone sentences.
 */
export interface TopicProfile {
  observation: string[];
  positive: string[];
  suggestion: string[];
  encouragement: string[];
  tips: string[];
}

export const TOPIC_PROFILES: Record<string, TopicProfile> = {
  weather: {
    observation: [
      "the weather has clearly shaped your day and how you feel.",
      "rain, storms, or extreme weather seem to have gotten in the way of your plans.",
      "today's weather played a big role in your reflection.",
      "outside conditions really made themselves felt today.",
    ],
    positive: [
      "You noticed how external conditions affect you instead of just enduring them — that's a real act of self-awareness.",
      "Acknowledging the impact of weather on your mood is wiser than it sounds.",
      "You're adapting to circumstances you can't control, and that takes flexibility.",
    ],
    suggestion: [
      "Focus on what you can control indoors while the weather passes.",
      "Plan a small weather-friendly alternative so the day still counts.",
      "Use the weather as an excuse for a cozy indoor reset.",
    ],
    encouragement: [
      "Brighter days eventually come — small adjustments today can keep you going until they do.",
      "You can't control the weather, but you can control how you adapt to it.",
      "This too shall pass, just like the storm.",
    ],
    tips: [
      "Plan a weather-friendly alternative for the day",
      "Turn the rain into a cozy indoor moment",
      "Reflect on what you can control when plans change",
    ],
  },
  academic: {
    observation: [
      "academics are clearly front and center for you today.",
      "school and deadlines are taking up a lot of your mental energy right now.",
      "your day looks like it was shaped by classes, studying, and assignments.",
      "a lot of your attention is on your academic workload.",
    ],
    positive: [
      "You're taking your academic commitments seriously, and that effort is real progress.",
      "Caring this much about your work shows real dedication.",
      "You're facing your workload head-on instead of avoiding it.",
    ],
    suggestion: [
      "Break your next task into one small five-minute step and start there.",
      "Try the Pomodoro method — 25 minutes focused, 5 minutes off — to make studying lighter.",
      "Tackle the hardest task when your energy is highest, and save the easy ones for later.",
    ],
    encouragement: [
      "One solid session beats ten distracted hours — protect your focus.",
      "You don't have to master everything tonight; progress is built in steps.",
      "Your grades don't define your worth, but your effort does you credit.",
    ],
    tips: [
      "Start with the smallest step of your next task",
      "Study in short, spaced sessions instead of marathons",
      "Take a real break between study blocks",
    ],
  },
  relationships: {
    observation: [
      "a lot of your attention today is on a relationship or someone important to you.",
      "relationships are clearly shaping how you feel right now.",
      "your writing centers on someone close to you.",
      "a connection with someone is at the heart of your reflection.",
    ],
    positive: [
      "You're investing in the people who matter, which is one of the healthiest habits there is.",
      "Noticing how others affect you is real emotional intelligence.",
      "You care enough to think things through — that takes maturity.",
    ],
    suggestion: [
      "When you're calm, try a short, honest conversation starting with 'I felt...' rather than 'You always...'.",
      "Consider the other person's perspective — it often softens the conflict.",
      "Reach out with a small, kind message if things feel uncertain.",
    ],
    encouragement: [
      "Strong relationships are built one honest conversation at a time.",
      "Disagreements are normal — they can even strengthen a bond.",
      "You're capable of handling this with honesty and care.",
    ],
    tips: [
      "Use 'I felt...' instead of 'You always...'",
      "Write down what you actually want from the situation",
      "Take a pause before responding",
    ],
  },
  family: {
    observation: [
      "family is at the heart of what you're reflecting on today.",
      "your writing centers on your family and the people you grew up with.",
      "thoughts of home and family are clearly close to your mind today.",
      "a moment with family is what stands out in your day.",
    ],
    positive: [
      "Moments shared with family can provide real comfort and emotional strength.",
      "You're honoring the relationships that ground you.",
      "Recognizing family as a source of support is a healthy awareness.",
    ],
    suggestion: [
      "Reach out to a family member you've been meaning to check in on.",
      "Carve out a moment to talk with family, even briefly.",
      "Reflect on the family memories that bring you warmth today.",
    ],
    encouragement: [
      "It's wonderful that you recognize the meaning family brings to your life.",
      "Family bonds, like any relationship, grow through small, consistent care.",
      "You're part of a support network — let it hold you when you need it.",
    ],
    tips: [
      "Reach out to a family member you care about",
      "Write down a family memory that brings you comfort",
      "Plan a short call or visit home",
    ],
  },
  health: {
    observation: [
      "your health has clearly been on your mind today.",
      "how your body feels is central to your reflection.",
      "your writing is focused on wellness and your physical state.",
      "being unwell or recovering is taking up your attention today.",
    ],
    positive: [
      "You noticed how your body is feeling instead of pushing through it — that's self-care.",
      "Listening to your health signals is a strong, caring choice.",
      "You're paying attention to what your body needs.",
    ],
    suggestion: [
      "Drink a full glass of water and rest if you're feeling under the weather.",
      "Reach out to a health professional if symptoms persist — that's wisdom, not weakness.",
      "Prioritize nourishment and sleep while you recover.",
    ],
    encouragement: [
      "Your health is worth protecting, and you're doing exactly that by noticing.",
      "Recovery takes time — be as patient with your body as you'd be with a friend.",
      "You're making caring choices for your body, and that matters.",
    ],
    tips: [
      "Drink water and rest well today",
      "Seek professional advice if symptoms persist",
      "Give your body time to recover without guilt",
    ],
  },
  financial: {
    observation: [
      "money and finances are clearly weighing on your mind today.",
      "your writing centers on financial pressure or concerns.",
      "finances are taking up a lot of your mental space right now.",
      "financial stress is present in your reflection today.",
    ],
    positive: [
      "You're facing financial concerns head-on instead of hiding from them.",
      "Thinking carefully about money shows responsibility, not weakness.",
      "You noticed the stress finances create — that's the first step to managing it.",
    ],
    suggestion: [
      "Write down your income and expenses to see the full picture clearly.",
      "Break the problem into one small step, like a simple budget for the week.",
      "Check if you qualify for scholarships, aid, or support programs.",
    ],
    encouragement: [
      "Financial stress is heavy, but you're not alone in it — many are in the same boat.",
      "Small, consistent money habits build stability over time.",
      "You're being thoughtful about your future, and that counts for a lot.",
    ],
    tips: [
      "List your income and expenses for the week",
      "Set one small, achievable savings goal",
      "Explore available support programs or scholarships",
    ],
  },
  career: {
    observation: [
      "your career or job is clearly front and center today.",
      "workplace concerns are shaping much of your reflection.",
      "your writing centers on your professional path.",
      "work and career matters are occupying your thoughts.",
    ],
    positive: [
      "You're investing in your professional growth, and that effort compounds over time.",
      "Reflecting on your career path shows ambition and self-awareness.",
      "You're handling real professional responsibility — that deserves recognition.",
    ],
    suggestion: [
      "Clarify one priority with your manager or team to reduce guesswork.",
      "Update your resume with your latest wins while they're fresh.",
      "Set a clear boundary around your work hours to protect your energy.",
    ],
    encouragement: [
      "Your career is a journey — this step is one part of a longer path.",
      "You're building skills and experience that will carry you forward.",
      "One step at a time is how any career gets built.",
    ],
    tips: [
      "Clarify one priority with your team or manager",
      "Update your resume with recent wins",
      "Set a clear end to your workday",
    ],
  },
  social: {
    observation: [
      "your day was full of people — friends and social moments.",
      "connecting with others is at the heart of your reflection today.",
      "your writing centers on your friendships and social life.",
      "time with friends shaped how your day felt.",
    ],
    positive: [
      "You're building the social bonds that carry people through hard times.",
      "Making time for friends is a powerful investment in your well-being.",
      "You're nurturing connections, and that matters more than you think.",
    ],
    suggestion: [
      "Reach out to a friend you haven't talked to in a while.",
      "Plan one low-pressure social moment this week.",
      "Enjoy a real conversation — a call beats texting for connection.",
    ],
    encouragement: [
      "Friendship grows through small, consistent care.",
      "You're more appreciated than you realize.",
      "Connection is one of the best medicines — keep making time for it.",
    ],
    tips: [
      "Message a friend you've been meaning to catch up with",
      "Plan one low-pressure social moment this week",
      "Have a real conversation, call or in person",
    ],
  },
  "self-care": {
    observation: [
      "self-care and recharging are clearly on your mind today.",
      "your reflection centers on taking care of yourself.",
      "you're focused on rest, calm, and recovery today.",
      "making time for yourself is what stands out in your writing.",
    ],
    positive: [
      "You recognized the need to recharge instead of pushing through — that's wisdom.",
      "Making time for yourself is a healthy, powerful habit.",
      "You're actively practicing self-care, which protects your long-term well-being.",
    ],
    suggestion: [
      "Carve out even fifteen quiet minutes just for you.",
      "Try a short breathing or mindfulness exercise to settle in.",
      "Say no to one thing so you can say yes to rest.",
    ],
    encouragement: [
      "You can't pour from an empty cup — refilling it isn't selfish.",
      "Self-care is not a luxury; it's how you keep going.",
      "You deserve the rest you're giving yourself.",
    ],
    tips: [
      "Take 15 quiet minutes just for you",
      "Try a short mindfulness or breathing exercise",
      "Do one thing that truly recharges you",
    ],
  },
  achievements: {
    observation: [
      "you accomplished something meaningful, and it shows in your writing.",
      "your reflection centers on a win or milestone you reached.",
      "something you achieved is clearly making you feel proud.",
      "a goal you met is the highlight of your day.",
    ],
    positive: [
      "You should genuinely celebrate this — you earned it.",
      "You did something worth acknowledging, and that's a big deal.",
      "Noticing and owning your wins is a healthy, powerful practice.",
    ],
    suggestion: [
      "Write down how you achieved this so you can repeat the process.",
      "Share your win with someone who'll be happy for you.",
      "Take a moment to celebrate before moving to the next goal.",
    ],
    encouragement: [
      "Let this win remind you of what you're capable of.",
      "Celebrate your progress — you've come further than you think.",
      "This accomplishment is proof of your effort.",
    ],
    tips: [
      "Write down how you achieved your win",
      "Share the win with someone supportive",
      "Celebrate before rushing to the next goal",
    ],
  },
  sports: {
    observation: [
      "sports and physical activity were at the center of your day.",
      "your writing centers on being active and playing sports.",
      "movement and games are clearly part of what you're reflecting on.",
      "time on the court, field, or gym shaped your day.",
    ],
    positive: [
      "Physical activity is one of the best things you can do for your mind and body.",
      "You made time to move, and that energy is showing up in your mood.",
      "Staying active builds both physical and mental strength.",
    ],
    suggestion: [
      "Keep a light, consistent routine — even a short game or walk helps.",
      "Warm up properly and hydrate to protect your body.",
      "Mix in a couple of rest days so your body can recover.",
    ],
    encouragement: [
      "Keeping active now builds habits that serve you for life.",
      "You're taking care of your body and having fun — that's a win-win.",
      "Your effort on the field or court carries into everything else.",
    ],
    tips: [
      "Warm up and stretch before you play",
      "Stay hydrated during activity",
      "Balance active days with rest days",
    ],
  },
  sleep: {
    observation: [
      "sleep and energy are clearly on your mind today.",
      "your writing shows how much fatigue is affecting you.",
      "rest — or the lack of it — is central to your reflection.",
      "being tired is the theme running through your day.",
    ],
    positive: [
      "You noticed how tiredness is affecting you — that's the first step to fixing it.",
      "Listening to your body's need for rest is a wise, caring move.",
      "You're recognizing the link between sleep and mood, which is a real insight.",
    ],
    suggestion: [
      "Try to keep a consistent sleep schedule, even on weekends.",
      "Put screens away thirty minutes before bed tonight.",
      "Avoid caffeine after mid-afternoon for better deep sleep.",
    ],
    encouragement: [
      "Sleep is not a luxury — it's how your mind repairs itself.",
      "One good night of rest can change your whole outlook.",
      "You're allowed to be tired. Rest is a skill worth practicing.",
    ],
    tips: [
      "Keep a consistent sleep schedule, even on weekends",
      "Put screens away 30 minutes before bed",
      "Avoid caffeine after mid-afternoon",
    ],
  },
  travel: {
    observation: [
      "travel and new places are clearly on your mind today.",
      "your writing centers on a trip, a journey, or somewhere new.",
      "exploration and travel are shaping your reflection.",
      "thoughts of being somewhere else are filling your day.",
    ],
    positive: [
      "Seeking new places and experiences is a beautiful way to grow.",
      "You're making room for adventure, and that nourishes the spirit.",
      "Travel broadens perspective — you're investing in that.",
    ],
    suggestion: [
      "Plan one small part of your next trip so the excitement feels real.",
      "Keep a travel journal to capture the moments that matter.",
      "Research one local spot you haven't visited yet.",
    ],
    encouragement: [
      "The world is wide, and you're choosing to see more of it.",
      "Every journey starts with a single step — or a single booking.",
      "New places bring new perspectives; enjoy the adventure.",
    ],
    tips: [
      "Plan one detail of your next trip",
      "Keep a travel journal for memories",
      "Visit a new place close to home",
    ],
  },
  hobbies: {
    observation: [
      "a hobby or creative outlet is clearly bringing something to your day.",
      "your writing centers on a hobby you enjoy.",
      "you spent time on a passion or interest, and it shows.",
      "an activity you love shaped how your day felt.",
    ],
    positive: [
      "Making time for hobbies is a powerful form of self-care.",
      "Creative outlets refresh your mind and feed your soul.",
      "You're honoring your interests, and that balance is healthy.",
    ],
    suggestion: [
      "Set aside a short regular slot for your hobby each week.",
      "Try one small new thing within your hobby to keep it fresh.",
      "Share what you make or enjoy with someone.",
    ],
    encouragement: [
      "Hobbies are not a waste of time — they refill your energy.",
      "Your interests make you interesting; keep nurturing them.",
      "The joy in your hobby is a gift you give yourself.",
    ],
    tips: [
      "Set a weekly slot for your hobby",
      "Try one new thing within your hobby",
      "Share your craft or interest with someone",
    ],
  },
  "mental-wellness": {
    observation: [
      "your mental health is clearly at the heart of your reflection today.",
      "you're carrying emotional weight, and your writing shows it.",
      "your reflection centers on how you're coping mentally and emotionally.",
      "your inner state is what most occupies your mind today.",
    ],
    positive: [
      "You took the brave step of naming how you feel — that is not small.",
      "Recognizing your emotional state is the beginning of caring for it.",
      "You reached for understanding while feeling heavy — that's real strength.",
    ],
    suggestion: [
      "Reach out to a counselor or someone you trust — you don't have to carry this alone.",
      "Try grounding: name 3 things you see, 2 you hear, and 1 you feel.",
      "Be gentle with yourself today; rest is part of coping, not a failure.",
    ],
    encouragement: [
      "You are not your emotions — you're the person noticing them.",
      "This feeling will soften with time. Be patient with yourself until it does.",
      "Seeking help is a sign of strength, and you're capable of it.",
    ],
    tips: [
      "Reach out to a counselor or someone you trust",
      "Try grounding: 3 things you see, 2 you hear, 1 you feel",
      "Be gentle with yourself and rest if you can",
    ],
  },
};
