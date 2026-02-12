/**
 * TimeSystem - Tracks in-game time and provides ambient light levels
 * 
 * Turn-based clock: each turn = ~1 minute of game time
 * 60 turns = 1 hour, 1440 turns = 1 day
 * 
 * Game starts at a configurable hour (default: 6 AM - early morning)
 * 
 * Ambient light curve:
 *   0.0 = pitch black (deep night)
 *   1.0 = full daylight
 * 
 * Hour-by-hour outdoor ambient light:
 *   00-04: 0.05  (deep night)
 *   05:    0.15  (pre-dawn)
 *   06:    0.35  (dawn)
 *   07:    0.60  (early morning)
 *   08:    0.85  (morning)
 *   09-16: 1.00  (full day)
 *   17:    0.85  (late afternoon)
 *   18:    0.60  (evening)
 *   19:    0.35  (dusk)
 *   20:    0.15  (twilight)
 *   21-23: 0.05  (night)
 */

export class TimeSystem {
    constructor() {
        // Time tracking
        this.totalTurns = 0;
        this.turnsPerHour = 60;
        this.startHour = 22; // Game starts at 10 PM (night) - adjust later
        
        // Ambient light curve (indexed by hour 0-23)
        this.ambientCurve = [
            0.05, 0.05, 0.05, 0.05, 0.05, // 00-04: deep night
            0.15,                            // 05: pre-dawn
            0.35,                            // 06: dawn
            0.60,                            // 07: early morning
            0.85,                            // 08: morning
            1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, // 09-16: full day
            0.85,                            // 17: late afternoon
            0.60,                            // 18: evening
            0.35,                            // 19: dusk
            0.15,                            // 20: twilight
            0.05, 0.05, 0.05               // 21-23: night
        ];
    }
    
    /**
     * Advance time by one turn
     */
    tick() {
        this.totalTurns++;
    }
    
    /**
     * Get total elapsed minutes since game start
     */
    getTotalMinutes() {
        return this.totalTurns; // 1 turn = 1 minute
    }
    
    /**
     * Get current hour (0-23)
     */
    getHour() {
        const totalMinutes = this.startHour * 60 + this.totalTurns;
        return Math.floor(totalMinutes / 60) % 24;
    }
    
    /**
     * Get current minute (0-59)
     */
    getMinute() {
        const totalMinutes = this.startHour * 60 + this.totalTurns;
        return totalMinutes % 60;
    }
    
    /**
     * Get current day number (starting from 1)
     */
    getDay() {
        const totalMinutes = this.startHour * 60 + this.totalTurns;
        return Math.floor(totalMinutes / 1440) + 1;
    }
    
    /**
     * Get formatted time string (e.g., "14:35")
     */
    getTimeString() {
        const h = this.getHour().toString().padStart(2, '0');
        const m = this.getMinute().toString().padStart(2, '0');
        return `${h}:${m}`;
    }
    
    /**
     * Get time period name
     */
    getTimePeriod() {
        const hour = this.getHour();
        if (hour >= 5 && hour < 7) return 'Dawn';
        if (hour >= 7 && hour < 9) return 'Morning';
        if (hour >= 9 && hour < 12) return 'Late Morning';
        if (hour >= 12 && hour < 14) return 'Midday';
        if (hour >= 14 && hour < 17) return 'Afternoon';
        if (hour >= 17 && hour < 19) return 'Evening';
        if (hour >= 19 && hour < 21) return 'Dusk';
        return 'Night';
    }
    
    /**
     * Get outdoor ambient light level (0.0 - 1.0)
     * Smoothly interpolates between hour values
     */
    getOutdoorAmbient() {
        const hour = this.getHour();
        const minute = this.getMinute();
        
        const currentLight = this.ambientCurve[hour];
        const nextLight = this.ambientCurve[(hour + 1) % 24];
        
        // Smooth interpolation between hours
        const t = minute / 60;
        return currentLight + (nextLight - currentLight) * t;
    }
    
    /**
     * Get indoor ambient light level
     * Indoors get some light from windows during the day, but much less
     */
    getIndoorAmbient() {
        const outdoor = this.getOutdoorAmbient();
        // Indoor gets ~30% of outdoor light (through windows)
        // Minimum 0.02 (never truly pitch black indoors on ground floor)
        return Math.max(0.02, outdoor * 0.30);
    }
    
    /**
     * Get underground ambient light level
     * Always pitch black without a light source
     */
    getUndergroundAmbient() {
        return 0.0;
    }
    
    /**
     * Check if it's currently "dark" (player would benefit from a light source)
     */
    isDark() {
        return this.getOutdoorAmbient() < 0.5;
    }
    
    /**
     * Check if it's currently "night" 
     */
    isNight() {
        return this.getOutdoorAmbient() < 0.2;
    }
}
