import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Image, Animated, StatusBar, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface LaunchScreenProps {
  onFinish: () => void;
}

export default function LaunchScreen({ onFinish }: LaunchScreenProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hold for 2.7 seconds (2700ms), then fade out over 300ms so total visible launch time (Native OS Splash + Custom LaunchScreen overlay) is 3 seconds total from app launch
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#030B1E" translucent />
      <Image
        source={require('../../assets/splash.png')}
        style={styles.splashImage}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#030B1E',
    zIndex: 99999,
    elevation: 99999,
  },
  splashImage: {
    width: width,
    height: height + (StatusBar.currentHeight || 0),
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
