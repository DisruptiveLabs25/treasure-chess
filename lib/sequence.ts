import { SequenceWaaS } from '@0xsequence/waas';

const useTestnet = process.env.EXPO_PUBLIC_USE_TESTNET === 'true';

let _waas: SequenceWaaS | null = null;

function waasClient(): SequenceWaaS {
  if (!_waas) {
    _waas = new SequenceWaaS({
      projectAccessKey: process.env.EXPO_PUBLIC_SEQUENCE_ACCESS_KEY!,
      waasConfigKey: process.env.EXPO_PUBLIC_SEQUENCE_WAAS_CONFIG_KEY!,
      network: useTestnet ? 'base-sepolia' : 'base',
    });
  }
  return _waas;
}

// Temporarily holds the Google OIDC ID token captured during loginWithGoogle so
// handleSession can consume it. Cleared on first read to prevent reuse.
// Google's ID token is NOT present in session.provider_token (that is the OAuth
// access token). We attempt to read id_token directly from the OAuth redirect
// URL fragment — available in Supabase's implicit flow when response_type includes
// id_token. If absent (cold-start resume), we fall back to email sign-in.
let _pendingGoogleIdToken: string | null = null;

export function setPendingGoogleIdToken(idToken: string | null): void {
  _pendingGoogleIdToken = idToken;
}

export function consumePendingGoogleIdToken(): string | null {
  const token = _pendingGoogleIdToken;
  _pendingGoogleIdToken = null;
  return token;
}

// Sign in with a Google OIDC ID token and return the deterministic wallet address.
export async function getOrCreateSequenceWalletGoogle(idToken: string): Promise<string | null> {
  if (!process.env.EXPO_PUBLIC_SEQUENCE_WAAS_CONFIG_KEY) return null;
  try {
    const waas = waasClient();
    if (await waas.isSignedIn()) return await waas.getAddress();
    const resp = await waas.signIn({ idToken }, 'treasure-chess');
    return resp.wallet;
  } catch (e) {
    console.warn('[Sequence] Google wallet sign-in failed:', String(e));
    return null;
  }
}

// Sign in with email and return the deterministic wallet address.
// Works headlessly if the Sequence project has "Skip email OTP" enabled
// (sequence.build → Embedded Wallet → Email settings).
// If OTP IS required, onEmailAuthCodeRequired fires — we detect it, log a warning,
// and return null rather than blocking. A 6-second timeout is the hard safety net.
export async function getOrCreateSequenceWalletEmail(email: string): Promise<string | null> {
  if (!process.env.EXPO_PUBLIC_SEQUENCE_WAAS_CONFIG_KEY) return null;
  if (!email) return null;

  const waas = waasClient();
  try {
    if (await waas.isSignedIn()) return await waas.getAddress();

    let otpRequired = false;
    const unregisterOtp = waas.onEmailAuthCodeRequired(async (_respondWithCode) => {
      otpRequired = true;
      // Cannot fulfill OTP headlessly. signIn will block until the timeout fires.
    });

    try {
      const resp = await Promise.race([
        waas.signIn({ email }, 'treasure-chess'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('seq-email-timeout')), 6000)
        ),
      ]);
      if (otpRequired) {
        console.warn('[Sequence] Email OTP required — wallet creation deferred until "Skip email OTP" is enabled in sequence.build');
        return null;
      }
      return resp.wallet;
    } finally {
      unregisterOtp();
    }
  } catch (e) {
    const msg = String(e);
    if (!msg.includes('seq-email-timeout')) {
      console.warn('[Sequence] Email wallet sign-in failed:', msg);
    }
    return null;
  }
}
