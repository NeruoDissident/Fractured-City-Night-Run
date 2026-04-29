using Nightrun.Entities;

namespace Nightrun.Content;

// ─────────────────────────────────────────────────────────────────────────────
// TalentEffects — reads a player's unlocked talents and sums up numeric
// effect values for a given effect key.
//
// Every system that cares about talent modifiers calls Get() with the
// player and the effect key it wants. No system needs to know which talent
// provides which bonus — all that lives in TalentCatalog data.
//
// Usage examples:
//   double bluntBonus  = TalentEffects.Get(player, "bluntDmgBonus");
//   double critBonus   = TalentEffects.Get(player, "sharpCritBonus");
//   bool   bleedImmune = TalentEffects.Get(player, "bleedImmune") > 0;
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Static helper — sums all numeric talent effect values for a given key
/// across every talent the player has unlocked. Returns 0 if the player
/// has no talent with that key, or if <paramref name="player"/> is null.
/// </summary>
public static class TalentEffects
{
    /// <summary>
    /// Returns the summed value of <paramref name="effectKey"/> across all
    /// unlocked talents. Safe to call with any entity (non-Player returns 0).
    /// </summary>
    public static double Get(Entity? entity, string effectKey)
    {
        if (entity is not Player player) return 0;
        if (player.UnlockedTalents.Count == 0) return 0;

        double total = 0;
        foreach (var talentId in player.UnlockedTalents)
        {
            var talent = TalentCatalog.GetTalent(talentId);
            if (talent == null) continue;
            if (talent.Effects.TryGetValue(effectKey, out double val))
                total += val;
        }
        return total;
    }

    /// <summary>
    /// Convenience: returns true if the summed value of <paramref name="effectKey"/> > 0.
    /// </summary>
    public static bool Has(Entity? entity, string effectKey)
        => Get(entity, effectKey) > 0;
}
