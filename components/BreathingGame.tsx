import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export const BreathingGame: React.FC = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [phaseText, setPhaseText] = useState<string>('Tap Start to Begin');
  
  // Animation values for scale and opacity
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (!isActive) {
      setPhaseText('Tap Start to Begin');
      scaleAnim.setValue(1);
      opacityAnim.setValue(0.6);
      return;
    }

    const runBreathingCycle = () => {
      // Phase 1: Inhale (4 seconds)
      setPhaseText('Inhale Deeply...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.5,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        })
      ]).start(({ finished }) => {
        if (!finished || !isActive) return;

        // Phase 2: Hold (4 seconds)
        setPhaseText('Hold Breath...');
        timeoutId = setTimeout(() => {
          if (!isActive) return;

          // Phase 3: Exhale (4 seconds)
          setPhaseText('Exhale Slowly...');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 4000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 4000,
              useNativeDriver: true,
            })
          ]).start(({ finished }) => {
            if (finished && isActive) {
              // Loop the cycle continuously
              runBreathingCycle();
            }
          });
        }, 4000);
      });
    };

    runBreathingCycle();

    return () => {
      clearTimeout(timeoutId);
      scaleAnim.stopAnimation();
      opacityAnim.stopAnimation();
    };
  }, [isActive]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Breathe & Release</Text>
      <Text style={styles.subtitle}>Center your mind and steady your breathing</Text>

      <View style={styles.circleContainer}>
        <Animated.View 
          style={[
            styles.breathingCircle, 
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            }
          ]} 
        />
        <Text style={styles.phaseText}>{phaseText}</Text>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => setIsActive(!isActive)}
      >
        <Ionicons name={isActive ? "pause-outline" : "play-outline"} size={20} color="#FFF" />
        <Text style={styles.buttonText}>{isActive ? 'Pause Session' : 'Start Session'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0D15',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 40,
    textAlign: 'center',
  },
  circleContainer: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  breathingCircle: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#8B5CF6',
  },
  phaseText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    zIndex: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});