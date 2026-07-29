import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useJournal } from "@/hooks/useJournal";

interface Suggestion {
  title: string;
  description: string;
  icon: string;
}

type MoodKey =
  | "happy" | "calm" | "relaxed" | "good" | "neutral"
  | "worried" | "sad" | "overwhelmed" | "exhausted" | "stressed" | "burnout" | "very-upset";

const MOOD_SUGGESTIONS: Record<MoodKey, Suggestion[]> = {
  happy: [
    { title: "Share Your Joy", description: "Reach out to a friend or family member and share what made you happy today — positivity is contagious.", icon: "🌟" },
    { title: "Gratitude Amplifier", description: "Write down 5 things you're grateful for right now. Happiness multiplies when acknowledged.", icon: "🙏" },
    { title: "Pay It Forward", description: "Do one small act of kindness — a compliment, a helping hand, or a thoughtful message.", icon: "💝" },
    { title: "Capture the Moment", description: "Take a photo or write a few lines about what's making you happy so you can revisit it later.", icon: "📸" },
    { title: "Celebrate Yourself", description: "Acknowledge something you accomplished recently. You deserve to feel proud.", icon: "🎉" },
    { title: "Energy Boost Walk", description: "Channel that positive energy into a brisk walk or dance to your favorite song.", icon: "🚶" },
  ],
  calm: [
    { title: "Deepen the Peace", description: "Sit quietly for 5 minutes and focus on your breath. Notice the calm and let it settle deeper.", icon: "🧘" },
    { title: "Mindful Tea Ritual", description: "Make a warm cup of tea and drink it slowly, savoring each sip without distraction.", icon: "🍵" },
    { title: "Nature Connection", description: "Step outside and observe something natural — a tree, the sky, or birds. Let calm ground you.", icon: "🌿" },
    { title: "Gentle Stretching", description: "Do 5 minutes of slow stretching to release any remaining tension in your body.", icon: "🤸" },
    { title: "Journal Your Peace", description: "Write about the sensation of calm — where you feel it in your body and what helped you find it.", icon: "📓" },
    { title: "Soothing Sounds", description: "Listen to calming music, nature sounds, or a guided relaxation recording.", icon: "🎵" },
  ],
  relaxed: [
    { title: "Enjoy the Flow", description: "Pick up a book, a hobby, or a creative project you enjoy. Relaxed focus is restorative.", icon: "📚" },
    { title: "Cozy Corner Time", description: "Make yourself comfortable with a blanket, pillows, and soft lighting. Just be.", icon: "🛋️" },
    { title: "Gentle Movement", description: "Try slow yoga or tai chi to maintain that relaxed feeling in your body.", icon: "🧘‍♀️" },
    { title: "Listen to Music", description: "Put on your favorite relaxing playlist and let the music carry the moment.", icon: "🎶" },
    { title: "Creative Expression", description: "Doodle, paint, or write something — no rules, just enjoy the process.", icon: "🎨" },
    { title: "Take a Nap", description: "If you feel like it, a short 20-minute power nap can refresh you without disturbing nighttime sleep.", icon: "😴" },
  ],
  good: [
    { title: "Build on It", description: "Set one small positive intention for the rest of the day while you're in a good space.", icon: "🌱" },
    { title: "Connect with Someone", description: "Send a kind message to a friend or family member — connection deepens well-being.", icon: "💬" },
    { title: "Get Moving", description: "Use this good energy for a walk, run, or workout. Physical activity amplifies positive mood.", icon: "🏃" },
    { title: "Plan Something Fun", description: "Schedule an activity you look forward to — a movie, a walk, or time with a friend.", icon: "📅" },
    { title: "Practice Gratitude", description: "Write down three things going well right now. Noticing the good attracts more of it.", icon: "✨" },
    { title: "Help Someone", description: "Use your positive energy to support someone who might be having a harder day.", icon: "🤝" },
  ],
  neutral: [
    { title: "Check In with Yourself", description: "Rate your energy, mood, and stress on a scale of 1-10. Notice without judging.", icon: "🔍" },
    { title: "Start Small", description: "Pick one small task you've been putting off and complete it. Momentum builds motivation.", icon: "✅" },
    { title: "Try Something New", description: "Read an article, try a new recipe, or explore a topic you're curious about.", icon: "🔎" },
    { title: "Move Your Body", description: "A 10-minute walk or stretch can shift your energy and help you reconnect.", icon: "🚶‍♂️" },
    { title: "Mindful Breathing", description: "Take 5 deep breaths, inhaling for 4 counts and exhaling for 6. Reset your baseline.", icon: "🌬️" },
    { title: "Set an Intention", description: "Choose one word to guide your day — peace, focus, courage, or kindness.", icon: "🎯" },
    { title: "Declutter a Small Space", description: "Tidy your desk or one corner of your room. Physical order supports mental clarity.", icon: "🧹" },
  ],
  worried: [
    { title: "Ground Yourself", description: "Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.", icon: "🌍" },
    { title: "Write It Out", description: "Put your worries on paper. Naming them often reduces their power over you.", icon: "✍️" },
    { title: "Fact Check", description: "Ask yourself: Is this worry about something I can control? If not, practice letting go.", icon: "🔎" },
    { title: "Talk to Someone", description: "Share what's worrying you with a trusted friend, family member, or counselor.", icon: "🗣️" },
    { title: "Box Breathing", description: "Inhale for 4, hold for 4, exhale for 4, hold for 4. Repeat 5 times to calm your nervous system.", icon: "🫁" },
    { title: "Focus on Today", description: "Bring your attention to what you can do right now, not what might happen in the future.", icon: "📅" },
    { title: "Comfort Activity", description: "Watch a favorite show, listen to a familiar podcast, or wrap yourself in a cozy blanket.", icon: "🫂" },
  ],
  sad: [
    { title: "Be Gentle with Yourself", description: "Allow yourself to feel sad without judgment. Emotions are visitors — let them stay awhile.", icon: "🫂" },
    { title: "Reach Out", description: "Send a message to someone who cares about you. You don't have to be alone with sadness.", icon: "💌" },
    { title: "Comforting Ritual", description: "Make a warm drink, wrap in a blanket, and watch something that soothes you.", icon: "☕" },
    { title: "Tears Are Okay", description: "If you need to cry, let yourself. Crying releases stress hormones and helps regulate emotions.", icon: "😢" },
    { title: "Gentle Movement", description: "A short, slow walk or gentle stretching can help move energy without demanding too much.", icon: "🚶‍♀️" },
    { title: "Listen to Music", description: "Put on music that matches your mood, then gradually transition to something slightly uplifting.", icon: "🎧" },
    { title: "Write a Letter", description: "Write a letter to yourself or someone you trust. You don't have to send it.", icon: "💌" },
  ],
  overwhelmed: [
    { title: "Stop and Breathe", description: "Pause everything. Take 10 slow breaths before doing anything else. You're safe.", icon: "⏸️" },
    { title: "Break It Down", description: "Write down everything on your mind. Then pick just ONE small thing to start with.", icon: "📋" },
    { title: "The 5-Minute Rule", description: "Commit to doing one task for just 5 minutes. Starting is the hardest part.", icon: "⏱️" },
    { title: "Eliminate One Thing", description: "Look at your to-do list and remove or postpone the least important item.", icon: "🗑️" },
    { title: "Ask for Help", description: "Identify one task you can delegate or ask someone to help you with.", icon: "🤲" },
    { title: "Change Your Environment", description: "Move to a different room, step outside, or change the lighting. A fresh perspective helps.", icon: "🔄" },
    { title: "Progressive Relaxation", description: "Tense and relax each muscle group from your toes to your head. Release the physical stress.", icon: "💆" },
  ],
  exhausted: [
    { title: "Rest Without Guilt", description: "Lie down for 15-20 minutes. Rest is productive — it restores your ability to function.", icon: "😴" },
    { title: "Hydrate and Nourish", description: "Drink a full glass of water and eat something nutritious. Fatigue often masks hunger or dehydration.", icon: "💧" },
    { title: "Power Nap", description: "Set a timer for 20 minutes. A short nap can restore alertness without nighttime sleep disruption.", icon: "⏰" },
    { title: "Gentle Fresh Air", description: "Step outside for 5 minutes. Deep breaths of fresh air can rejuvenate your mind and body.", icon: "🌬️" },
    { title: "Skip the Caffeine", description: "Try water or herbal tea instead. Caffeine can worsen exhaustion once the initial boost fades.", icon: "🍵" },
    { title: "Do Nothing", description: "Give yourself permission to simply exist for 10 minutes. No phone, no tasks, no guilt.", icon: "🧘" },
    { title: "Prioritize Sleep Tonight", description: "Plan to go to bed 30 minutes earlier. Good sleep hygiene starts with intention.", icon: "🌙" },
  ],
  stressed: [
    { title: "4-7-8 Breathing", description: "Inhale for 4, hold for 7, exhale for 8. Repeat 4 times — it activates the relaxation response.", icon: "🫁" },
    { title: "Step Away", description: "Physically remove yourself from the stressful situation for 5 minutes. Distance creates clarity.", icon: "🚶" },
    { title: "Tension Release", description: "Roll your shoulders, unclench your jaw, and shake out your hands. Stress lives in the body.", icon: "💪" },
    { title: "Write the Chaos", description: "Dump everything on your mind onto paper without filtering. Externalizing reduces internal pressure.", icon: "📝" },
    { title: "Cold Water Reset", description: "Splash cold water on your face or wash your hands. The shock can interrupt stress spirals.", icon: "💦" },
    { title: "One Thing at a Time", description: "Pick the single most important task and focus only on that. Multitasking feeds stress.", icon: "🎯" },
    { title: "Stretch for 60 Seconds", description: "Reach your arms overhead, side stretch, forward fold — 60 seconds releases physical stress.", icon: "🤸" },
  ],
  burnout: [
    { title: "Complete Rest Day", description: "Cancel non-essential commitments and give yourself permission to truly rest. Burnout requires recovery, not a quick fix.", icon: "🛑" },
    { title: "Digital Detox", description: "Turn off notifications and step away from screens for 1 hour. Mental overload needs a break.", icon: "📵" },
    { title: "Reconnect with Joy", description: "Think back to something you used to enjoy before burnout. Spend 10 minutes doing it — no pressure.", icon: "🎨" },
    { title: "Talk to a Professional", description: "Consider reaching out to a counselor or therapist. Burnout is a signal that support is needed.", icon: "👩‍⚕️" },
    { title: "Set Firm Boundaries", description: "Identify one commitment you can say no to this week. Protecting your energy is not selfish.", icon: "🚧" },
    { title: "Nourish Your Body", description: "Eat a balanced meal, drink water, and consider a gentle walk. Physical care is part of burnout recovery.", icon: "🥗" },
    { title: "Do Something Mindless", description: "Color, fold laundry, or watch something undemanding. Give your brain a break from problem-solving.", icon: "🧩" },
  ],
  "very-upset": [
    { title: "Pause and Breathe", description: "Stop. Take 5 slow deep breaths. You don't need to solve anything right now.", icon: "⏸️" },
    { title: "Safe Space", description: "Move to a quiet, comfortable place where you can be alone with your feelings.", icon: "🏠" },
    { title: "Reach Out Now", description: "Call or text someone you trust. You don't need to have it all figured out — just let them know.", icon: "📞" },
    { title: "Name What You Feel", description: "Say it out loud or write it down: 'I feel...' Naming emotions reduces their intensity.", icon: "📢" },
    { title: "Physical Release", description: "Punch a pillow, stomp your feet, or squeeze something tightly. Let the energy move through you.", icon: "👊" },
    { title: "Crisis Resources", description: "If you need immediate support, contact a crisis helpline. Reaching out is a sign of strength.", icon: "🆘" },
    { title: "Grounding Senses", description: "Hold something cold, smell something strong, or listen to a familiar sound. Sensory input anchors you.", icon: "🌡️" },
    { title: "Gentle Self-Talk", description: "Speak to yourself as you would to a close friend: 'This is hard. You will get through this.'", icon: "💗" },
  ],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickSuggestions(mood: MoodKey, count = 5): Suggestion[] {
  const pool = MOOD_SUGGESTIONS[mood] || MOOD_SUGGESTIONS.neutral;
  const shuffled = shuffle(pool);
  if (shuffled.length <= count) return shuffled;
  const picked = shuffled.slice(0, count);
  // If we have fewer than count, pad with neutral suggestions
  if (picked.length < count) {
    const neutral = shuffle(MOOD_SUGGESTIONS.neutral);
    picked.push(...neutral.slice(0, count - picked.length));
  }
  return picked;
}

function detectDominantMood(moods: string[]): MoodKey {
  if (moods.length === 0) return "neutral";
  const counts: Record<string, number> = {};
  for (const m of moods) counts[m] = (counts[m] || 0) + 1;
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return (sorted[0][0] as MoodKey) || "neutral";
}

export default function JournalSuggestionsScreen() {
  const { entries: journalEntries, loading: entriesLoading } = useJournal();

  const suggestions = useMemo(() => {
    const moods = journalEntries.map((e) => e.mood);
    const dominant = detectDominantMood(moods);
    return pickSuggestions(dominant);
  }, [journalEntries]);

  const [seed, setSeed] = useState(0);

  const handleRefresh = useCallback(() => {
    setSeed((s) => s + 1);
  }, []);

  if (entriesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.loadingText}>Loading your entries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Wellness Suggestions</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          key={seed}
        >
          {/* Intro */}
          <View style={styles.introContainer}>
            <Text style={styles.introTitle}>Personalized for You</Text>
            <Text style={styles.introText}>
              Suggestions tailored to your most frequent mood. Each one is
              designed to support your well-being — try one that resonates.
            </Text>
          </View>

          {/* Suggestions List */}
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, idx) => (
              <View key={idx} style={styles.suggestionCard}>
                <View style={styles.suggestionIcon}>
                  <Text style={styles.iconText}>{suggestion.icon}</Text>
                </View>
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                  <Text style={styles.suggestionDescription}>
                    {suggestion.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Mood stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Entries</Text>
              <Text style={styles.statValue}>{journalEntries.length}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>
                {
                  journalEntries.filter((e) => {
                    const now = new Date();
                    const entryDate = new Date(e.entryDate);
                    return (
                      entryDate.getMonth() === now.getMonth() &&
                      entryDate.getFullYear() === now.getFullYear()
                    );
                  }).length
                }
              </Text>
            </View>
          </View>

          {/* Refresh Button */}
          <Pressable
            style={styles.regenerateButton}
            onPress={handleRefresh}
          >
            <LinearGradient
              colors={["#9C7EEB", "#8A63D2"]}
              style={styles.regenerateBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.regenerateButtonText}>
                Show Different Suggestions
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#666", marginTop: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#8A63D2" },
  placeholder: { width: 40 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  introContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
    elevation: 3,
  },
  introTitle: { fontSize: 18, fontWeight: "600", color: "#8A63D2", marginBottom: 8 },
  introText: { fontSize: 14, color: "#666", lineHeight: 20 },
  suggestionsContainer: { marginBottom: 24 },
  suggestionCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  suggestionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconText: { fontSize: 24 },
  suggestionContent: { flex: 1 },
  suggestionTitle: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 4 },
  suggestionDescription: { fontSize: 13, color: "#666", lineHeight: 18 },
  statsContainer: { flexDirection: "row", marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginRight: 8,
    alignItems: "center",
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  statLabel: { fontSize: 12, color: "#999", marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: "600", color: "#8A63D2" },
  regenerateButton: { borderRadius: 12, overflow: "hidden", marginBottom: 40 },
  regenerateBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  regenerateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
