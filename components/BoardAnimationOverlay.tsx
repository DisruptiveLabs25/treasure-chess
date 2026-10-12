import React, { useLayoutEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { ChessPieceComponent } from "./ChessPieces";
import type { Square } from "chess.js";
import type { PieceStyle } from "@/types";
import { type GlideState, squareToCell } from "@/hooks/useMoveAnimations";

const GLIDE_DURATION = 400; // ms — in 350–450 range

interface Props {
  boardSize: number;
  squareSize: number;
  isFlipped?: boolean;
  glideState: GlideState | null;
  pieceStyle: PieceStyle;
  captureSquare: Square | null;
  onGlideComplete: () => void;
  onCaptureComplete: () => void;
}

export function BoardAnimationOverlay({
  squareSize,
  isFlipped = false,
  glideState,
  pieceStyle,
  captureSquare,
  onGlideComplete,
  onCaptureComplete,
}: Props) {
  const pieceSize = squareSize * 0.85;

  // Keep latest callbacks in refs so worklet closures are never stale.
  const onGlideCompleteRef = useRef(onGlideComplete);
  const onCaptureCompleteRef = useRef(onCaptureComplete);
  onGlideCompleteRef.current = onGlideComplete;
  onCaptureCompleteRef.current = onCaptureComplete;

  // ── Glide animation (internal shared values) ──────────────────────────
  const glideX = useSharedValue(0);
  const glideY = useSharedValue(0);
  const glideOpacity = useSharedValue(0); // controls visibility independently of React state

  const glideStyle = useAnimatedStyle(() => ({
    opacity: glideOpacity.value,
    transform: [{ translateX: glideX.value }, { translateY: glideY.value }],
  }));

  // useLayoutEffect fires synchronously after commit, before native paint.
  // This guarantees the ghost piece View is in the tree before we start withTiming,
  // which fixes the "piece teleports" bug where the animation completed before mount.
  useLayoutEffect(() => {
    if (!glideState) {
      glideOpacity.value = 0;
      cancelAnimation(glideX);
      cancelAnimation(glideY);
      return;
    }

    glideX.value = glideState.startX;
    glideY.value = glideState.startY;
    glideOpacity.value = 1;

    const easeOut = Easing.out(Easing.cubic);
    glideX.value = withTiming(glideState.endX, { duration: GLIDE_DURATION, easing: easeOut });
    glideY.value = withTiming(glideState.endY, { duration: GLIDE_DURATION, easing: easeOut },
      (finished) => {
        "worklet";
        if (finished) {
          glideOpacity.value = withTiming(0, { duration: 60 });
          runOnJS(onGlideCompleteRef.current)();
        }
      }
    );

    return () => {
      cancelAnimation(glideX);
      cancelAnimation(glideY);
    };
  }, [glideState]);


  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Ghost piece — always mounted so useLayoutEffect has a target before paint */}
      <Animated.View
        style={[
          styles.ghostPiece,
          { width: squareSize, height: squareSize },
          glideStyle,
        ]}
      >
        {glideState && (
          <ChessPieceComponent
            type={glideState.piece.type as any}
            color={glideState.piece.color as any}
            size={pieceSize}
            style={pieceStyle}
          />
        )}
      </Animated.View>

      {/* TakeOver Lottie — plays once at the captured square, disappears on finish */}
      {captureSquare && (() => {
        const { x, y } = squareToCell(captureSquare, squareSize, isFlipped);
        return (
          <LottieView
            key={captureSquare}
            source={require("../assets/animations/TakeOver.json")}
            autoPlay
            loop={false}
            onAnimationFinish={onCaptureCompleteRef.current}
            style={[styles.captureLottie, { width: squareSize, height: squareSize, left: x, top: y }]}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  ghostPiece: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  captureLottie: {
    position: "absolute",
    zIndex: 25,
  },
});
