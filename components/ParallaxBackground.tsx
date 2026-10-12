import React, { useEffect } from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Gyroscope } from "expo-sensors";

const { width, height } = Dimensions.get("window");

export function ParallaxBackground() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    let subscription: ReturnType<typeof Gyroscope.addListener> | null = null;

    Gyroscope.isAvailableAsync()
      .then((available) => {
        if (!available) return;
        Gyroscope.setUpdateInterval(100);
        subscription = Gyroscope.addListener(({ x, y }) => {
          translateX.value = withSpring(Math.max(-20, Math.min(20, -y * 15)), {
            damping: 20,
            stiffness: 80,
          });
          translateY.value = withSpring(Math.max(-20, Math.min(20, -x * 15)), {
            damping: 20,
            stiffness: 80,
          });
        });
      })
      .catch(() => {});

    return () => {
      subscription?.remove();
    };
  }, [translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1.2 },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.Image
      source={require("../assets/images/chess-pattern-bg.png")}
      style={[styles.image, animatedStyle]}
      resizeMode="cover"
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    position: "absolute",
    width,
    height,
    opacity: 0.15,
  },
});
