import React from "react";
import LottieView from "lottie-react-native";
import type { StyleProp, ViewStyle } from "react-native";

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function LottieSpinner({ size = 80, style }: Props) {
  return (
    <LottieView
      source={require("../assets/animations/Loading.json")}
      autoPlay
      loop
      style={[{ width: size, height: size }, style]}
    />
  );
}
