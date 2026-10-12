import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

// ============================================================================
// Types
// ============================================================================

export type SoundEffect =
  | "move"
  | "capture"
  | "check"
  | "castle"
  | "promote"
  | "illegal"
  | "gameStart"
  | "gameEnd"
  | "win"
  | "lose"
  | "draw"
  | "lowTime"
  | "timeout"
  | "button"
  | "toggle"
  | "notification"
  | "deposit"
  | "achievement"
  | "error"
  | "chip"
  | "chipStack";

interface SoundConfig {
  source: any;
  volume: number;
  poolSize: number;
}

interface AudioState {
  isInitialized: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  masterVolume: number;
  soundVolume: number;
  musicVolume: number;
}

// ============================================================================
// Sound Definitions
// ============================================================================

const SOUND_CONFIGS: Record<SoundEffect, SoundConfig> = {
  move: { source: require("@/assets/sounds/move.mp3"), volume: 0.8, poolSize: 2 },
  capture: { source: require("@/assets/sounds/capture.mp3"), volume: 0.9, poolSize: 2 },
  check: { source: require("@/assets/sounds/alert_bell.mp3"), volume: 0.7, poolSize: 1 },
  castle: { source: require("@/assets/sounds/pawn.mp3"), volume: 0.8, poolSize: 1 },
  promote: { source: require("@/assets/sounds/achievement.mp3"), volume: 0.7, poolSize: 1 },
  illegal: { source: require("@/assets/sounds/button.mp3"), volume: 0.4, poolSize: 1 },
  gameStart: { source: require("@/assets/sounds/button.mp3"), volume: 0.6, poolSize: 1 },
  gameEnd: { source: require("@/assets/sounds/clock.mp3"), volume: 0.7, poolSize: 1 },
  win: { source: require("@/assets/sounds/game_win.mp3"), volume: 0.8, poolSize: 1 },
  lose: { source: require("@/assets/sounds/lose.mp3"), volume: 0.7, poolSize: 1 },
  draw: { source: require("@/assets/sounds/clock.mp3"), volume: 0.6, poolSize: 1 },
  lowTime: { source: require("@/assets/sounds/alert_bell.mp3"), volume: 0.5, poolSize: 1 },
  timeout: { source: require("@/assets/sounds/clock.mp3"), volume: 0.8, poolSize: 1 },
  button: { source: require("@/assets/sounds/button.mp3"), volume: 0.5, poolSize: 3 },
  toggle: { source: require("@/assets/sounds/button.mp3"), volume: 0.4, poolSize: 2 },
  notification: { source: require("@/assets/sounds/clock.mp3"), volume: 0.6, poolSize: 1 },
  deposit: { source: require("@/assets/sounds/deposit.mp3"), volume: 0.7, poolSize: 1 },
  achievement: { source: require("@/assets/sounds/achievement.mp3"), volume: 0.8, poolSize: 1 },
  error: { source: require("@/assets/sounds/clock.mp3"), volume: 0.5, poolSize: 1 },
  chip: { source: require("@/assets/sounds/chip.mp3"), volume: 0.6, poolSize: 2 },
  chipStack: { source: require("@/assets/sounds/chip_stack.mp3"), volume: 0.7, poolSize: 1 },
};

// ============================================================================
// Sound Pool
// ============================================================================

class SoundPool {
  private sounds: AudioPlayer[] = [];
  private currentIndex = 0;
  private config: SoundConfig;
  private isLoaded = false;

  constructor(config: SoundConfig) {
    this.config = config;
  }

  async load(): Promise<void> {
    if (this.isLoaded) return;

    try {
      for (let i = 0; i < this.config.poolSize; i++) {
        const player = createAudioPlayer(this.config.source);
        player.volume = this.config.volume;
        this.sounds.push(player);
      }
      this.isLoaded = true;
    } catch (error) {
      console.warn("Failed to load sound pool:", error);
    }
  }

  async play(volume?: number): Promise<void> {
    if (!this.isLoaded || this.sounds.length === 0) return;

    const player = this.sounds[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.sounds.length;

    try {
      await player.seekTo(0);
      if (volume !== undefined) {
        player.volume = volume;
      }
      player.play();
    } catch (error) {
      // Silently fail - sound playback is not critical
    }
  }

  async setVolume(volume: number): Promise<void> {
    for (const player of this.sounds) {
      try {
        player.volume = volume * this.config.volume;
      } catch {
        // Ignore errors
      }
    }
  }

  async unload(): Promise<void> {
    for (const player of this.sounds) {
      try {
        player.remove();
      } catch {
        // Ignore errors
      }
    }
    this.sounds = [];
    this.isLoaded = false;
  }
}

// ============================================================================
// Audio Manager Class
// ============================================================================

class AudioManagerClass {
  private state: AudioState = {
    isInitialized: false,
    soundEnabled: true,
    musicEnabled: true,
    masterVolume: 1.0,
    soundVolume: 1.0,
    musicVolume: 0.5,
  };

  private soundPools: Map<SoundEffect, SoundPool> = new Map();
  private backgroundMusic: AudioPlayer | null = null;
  private isBackgroundMusicPlaying = false;
  private initPromise: Promise<void> | null = null;

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
        shouldRouteThroughEarpiece: false,
      });

      await this.preloadSounds();

      this.state.isInitialized = true;
      console.log("AudioManager initialized");
    } catch (error) {
      console.error("Failed to initialize AudioManager:", error);
      this.state.isInitialized = true;
    }
  }

  private async preloadSounds(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const [name, config] of Object.entries(SOUND_CONFIGS)) {
      const pool = new SoundPool(config);
      this.soundPools.set(name as SoundEffect, pool);
      loadPromises.push(pool.load());
    }

    await Promise.all(loadPromises);
    console.log("All sounds preloaded");
  }

  // ============================================================================
  // Sound Playback
  // ============================================================================

  async play(effect: SoundEffect, volumeMultiplier: number = 1): Promise<void> {
    if (!this.state.soundEnabled) return;
    if (!this.state.isInitialized) {
      await this.initialize();
    }

    const pool = this.soundPools.get(effect);
    if (!pool) {
      console.warn(`Unknown sound effect: ${effect}`);
      return;
    }

    const finalVolume =
      this.state.masterVolume * this.state.soundVolume * volumeMultiplier;
    await pool.play(finalVolume);
  }

  async playMoveSound(options: {
    isCapture?: boolean;
    isCheck?: boolean;
    isCastle?: boolean;
    isPromotion?: boolean;
  }): Promise<void> {
    const { isCapture, isCheck, isCastle, isPromotion } = options;

    if (isCheck) {
      await this.play("check");
    } else if (isPromotion) {
      await this.play("promote");
    } else if (isCapture) {
      await this.play("capture");
    } else if (isCastle) {
      await this.play("castle");
    } else {
      await this.play("move");
    }
  }

  async playGameResult(result: "win" | "lose" | "draw"): Promise<void> {
    await this.play(result);
  }

  // ============================================================================
  // Background Music
  // ============================================================================

  async playBackgroundMusic(fadeIn: boolean = true): Promise<void> {
    if (!this.state.musicEnabled) return;

    try {
      if (!this.backgroundMusic) {
        const player = createAudioPlayer(require("@/assets/sounds/bg.mp3"));
        player.loop = true;
        player.volume = fadeIn ? 0 : this.state.musicVolume * this.state.masterVolume;
        this.backgroundMusic = player;
      }

      this.backgroundMusic.play();
      this.isBackgroundMusicPlaying = true;

      if (fadeIn) {
        await this.fadeMusic(this.state.musicVolume * this.state.masterVolume, 2000);
      }
    } catch (error) {
      console.error("Failed to play background music:", error);
    }
  }

  async stopBackgroundMusic(fadeOut: boolean = true): Promise<void> {
    if (!this.backgroundMusic || !this.isBackgroundMusicPlaying) return;

    try {
      if (fadeOut) {
        await this.fadeMusic(0, 1000);
      }
      this.backgroundMusic.pause();
      await this.backgroundMusic.seekTo(0);
      this.isBackgroundMusicPlaying = false;
    } catch (error) {
      console.error("Failed to stop background music:", error);
    }
  }

  async pauseBackgroundMusic(): Promise<void> {
    if (!this.backgroundMusic || !this.isBackgroundMusicPlaying) return;

    try {
      this.backgroundMusic.pause();
    } catch (error) {
      console.error("Failed to pause background music:", error);
    }
  }

  async resumeBackgroundMusic(): Promise<void> {
    if (!this.backgroundMusic || !this.state.musicEnabled) return;

    try {
      if (this.backgroundMusic.isLoaded && !this.backgroundMusic.playing) {
        this.backgroundMusic.play();
      }
    } catch (error) {
      console.error("Failed to resume background music:", error);
    }
  }

  private async fadeMusic(targetVolume: number, durationMs: number): Promise<void> {
    if (!this.backgroundMusic) return;

    const steps = 20;
    const stepDuration = durationMs / steps;

    try {
      if (!this.backgroundMusic.isLoaded) return;

      const startVolume = this.backgroundMusic.volume ?? 0;
      const volumeDelta = (targetVolume - startVolume) / steps;

      for (let i = 0; i <= steps; i++) {
        const newVolume = startVolume + volumeDelta * i;
        this.backgroundMusic.volume = Math.max(0, Math.min(1, newVolume));
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }
    } catch {
      // Ignore fade errors
    }
  }

  // ============================================================================
  // Settings
  // ============================================================================

  setSoundEnabled(enabled: boolean): void {
    this.state.soundEnabled = enabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.state.musicEnabled = enabled;

    if (!enabled && this.isBackgroundMusicPlaying) {
      this.stopBackgroundMusic();
    }
  }

  async setMasterVolume(volume: number): Promise<void> {
    this.state.masterVolume = Math.max(0, Math.min(1, volume));
    await this.updateAllVolumes();
  }

  async setSoundVolume(volume: number): Promise<void> {
    this.state.soundVolume = Math.max(0, Math.min(1, volume));
    await this.updateSoundVolumes();
  }

  async setMusicVolume(volume: number): Promise<void> {
    this.state.musicVolume = Math.max(0, Math.min(1, volume));
    await this.updateMusicVolume();
  }

  applySettings(settings: {
    soundEnabled?: boolean;
    musicEnabled?: boolean;
    masterVolume?: number;
    soundVolume?: number;
    musicVolume?: number;
  }): void {
    if (settings.soundEnabled !== undefined) {
      this.setSoundEnabled(settings.soundEnabled);
    }
    if (settings.musicEnabled !== undefined) {
      this.setMusicEnabled(settings.musicEnabled);
    }
    if (settings.masterVolume !== undefined) {
      this.setMasterVolume(settings.masterVolume);
    }
    if (settings.soundVolume !== undefined) {
      this.setSoundVolume(settings.soundVolume);
    }
    if (settings.musicVolume !== undefined) {
      this.setMusicVolume(settings.musicVolume);
    }
  }

  private async updateAllVolumes(): Promise<void> {
    await Promise.all([this.updateSoundVolumes(), this.updateMusicVolume()]);
  }

  private async updateSoundVolumes(): Promise<void> {
    const volume = this.state.masterVolume * this.state.soundVolume;
    for (const pool of this.soundPools.values()) {
      await pool.setVolume(volume);
    }
  }

  private async updateMusicVolume(): Promise<void> {
    if (this.backgroundMusic) {
      try {
        const volume = this.state.masterVolume * this.state.musicVolume;
        this.backgroundMusic.volume = volume;
      } catch {
        // Ignore errors
      }
    }
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  get isInitialized(): boolean {
    return this.state.isInitialized;
  }

  get isSoundEnabled(): boolean {
    return this.state.soundEnabled;
  }

  get isMusicEnabled(): boolean {
    return this.state.musicEnabled;
  }

  get isMusicPlaying(): boolean {
    return this.isBackgroundMusicPlaying;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async cleanup(): Promise<void> {
    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.pause();
        await this.backgroundMusic.seekTo(0);
        this.backgroundMusic.remove();
      } catch {
        // Ignore errors
      }
      this.backgroundMusic = null;
    }

    for (const pool of this.soundPools.values()) {
      await pool.unload();
    }
    this.soundPools.clear();

    this.state.isInitialized = false;
    this.initPromise = null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const AudioManager = new AudioManagerClass();

// ============================================================================
// Convenience Functions
// ============================================================================

export function playSound(effect: SoundEffect, volume?: number): void {
  AudioManager.play(effect, volume);
}

export function playMoveSound(options: {
  isCapture?: boolean;
  isCheck?: boolean;
  isCastle?: boolean;
  isPromotion?: boolean;
}): void {
  AudioManager.playMoveSound(options);
}

export function playGameResult(result: "win" | "lose" | "draw"): void {
  AudioManager.playGameResult(result);
}

export default AudioManager;
