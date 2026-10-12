-- Draw offer tracking for mutual-consent draw agreement (C3 security fix).
-- A single player sending draw_agreement must not immediately end a game;
-- both players must submit before the draw is finalised.
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS draw_offer_by_player_id UUID REFERENCES profiles(id);
