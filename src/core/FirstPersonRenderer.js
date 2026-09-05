/**
 * FirstPersonRenderer - Grid-based first-person view
 *
 * Draws the world from the player's cell looking along player.facing, in the
 * style of classic grid crawlers (Eye of the Beholder, Wizardry, Legend of Grimrock).
 *
 * The view is a set of cells described in *relative* coordinates:
 *   depth   d : 0 = the player's own cell, 1 = the cell directly ahead, ...
 *   lateral l : 0 = straight ahead, negative = left, positive = right
 *
 * Geometry is drawn with a painter's algorithm: far depth first, and within a
 * depth the outer laterals first, so nearer surfaces overwrite farther ones.
 *
 * All world queries go through the same World / FoV / LightingSystem APIs the
 * top-down renderer uses, so simulation rules (what blocks vision, what is lit)
 * stay identical between views.
 *
 * EXPANSION POINTS:
 * - Wall textures (draw an image instead of a flat face in drawWallFace)
 * - Per-material wall looks (brick, concrete, chain-link, glass)
 * - Animated billboards, weapon-in-hand overlay, damage vignette
 * - Head-bob / turn tween between turns
 */

const FACING_ORDER = ['north', 'east', 'south', 'west'];

const FACING_VECTORS = {
    north: { dx: 0, dy: -1 },
    east:  { dx: 1, dy: 0 },
    south: { dx: 0, dy: 1 },
    west:  { dx: -1, dy: 0 }
};

export function normalizeFacing(facing) {
    switch (facing) {
        case 'ne': return 'north';
        case 'nw': return 'west';
        case 'se': return 'east';
        case 'sw': return 'south';
        default:
            return FACING_VECTORS[facing] ? facing : 'south';
    }
}

export function facingVector(facing) {
    return FACING_VECTORS[normalizeFacing(facing)];
}

/** Vector pointing to the player's right for a given facing. */
export function rightVector(facing) {
    const f = normalizeFacing(facing);
    const idx = FACING_ORDER.indexOf(f);
    return FACING_VECTORS[FACING_ORDER[(idx + 1) % 4]];
}

export function turnFacing(facing, steps) {
    const idx = FACING_ORDER.indexOf(normalizeFacing(facing));
    return FACING_ORDER[((idx + steps) % 4 + 4) % 4];
}

/**
 * Convert a view-relative move (forward/back/left/right) into a world delta.
 * @param {string} facing
 * @param {'forward'|'back'|'left'|'right'} rel
 */
export function relativeToDelta(facing, rel) {
    const f = facingVector(facing);
    const r = rightVector(facing);
    switch (rel) {
        case 'forward': return { dx: f.dx, dy: f.dy };
        case 'back':    return { dx: -f.dx, dy: -f.dy };
        case 'right':   return { dx: r.dx, dy: r.dy };
        case 'left':    return { dx: -r.dx, dy: -r.dy };
        default:        return { dx: 0, dy: 0 };
    }
}

/**
 * Convert an absolute world delta into a view-relative label.
 */
export function deltaToRelative(facing, dx, dy) {
    if (dx === 0 && dy === 0) return 'here';
    const f = facingVector(facing);
    const r = rightVector(facing);
    if (dx === f.dx && dy === f.dy) return 'forward';
    if (dx === -f.dx && dy === -f.dy) return 'back';
    if (dx === r.dx && dy === r.dy) return 'right';
    if (dx === -r.dx && dy === -r.dy) return 'left';
    return null;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

function parseHex(color) {
    if (!color || color[0] !== '#') return { r: 0, g: 0, b: 0 };
    const hex = color.length === 4
        ? color.slice(1).split('').map(c => c + c).join('')
        : color.slice(1, 7);
    return {
        r: parseInt(hex.substr(0, 2), 16) || 0,
        g: parseInt(hex.substr(2, 2), 16) || 0,
        b: parseInt(hex.substr(4, 2), 16) || 0
    };
}

function rgb(r, g, b, a = 1) {
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));
    return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

function mix(colorA, colorB, t) {
    const a = parseHex(colorA);
    const b = parseHex(colorB);
    return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t
    };
}

/**
 * Apply light level + optional tint to an {r,g,b} triple.
 * Mirrors World.applyLight so lighting reads the same in both views.
 */
function lit(c, level, tint = null) {
    const effective = Math.max(0.08, Math.min(1, level));
    let r = c.r * effective;
    let g = c.g * effective;
    let b = c.b * effective;
    if (tint && level > 0.08) {
        const t = parseHex(tint);
        const strength = Math.min(0.35, level * 0.4);
        r = r * (1 - strength) + t.r * strength * effective;
        g = g * (1 - strength) + t.g * strength * effective;
        b = b * (1 - strength) + t.b * strength * effective;
    }
    return { r, g, b };
}

// ── Renderer ───────────────────────────────────────────────────────────────────

export class FirstPersonRenderer {
    constructor(game, renderer) {
        this.game = game;
        this.renderer = renderer;   // shared canvas Renderer (owns ctx and sizing)

        this.maxDepth = 8;          // hard cap on cells drawn ahead
        this.nearClip = 0.18;       // z below which side walls are clipped
        this.wallHeight = 1.0;      // wall height in cell units (eye at half height)
        this.fogStart = 0.35;       // fraction of vision range where depth fog begins

        // Per-frame cache
        this._frame = null;
    }

    get ctx() { return this.renderer.ctx; }
    get width() { return this.renderer.canvas.width; }
    get height() { return this.renderer.canvas.height; }

    // ── Relative <-> world helpers ─────────────────────────────────────────────

    /** World coordinates of a view cell. */
    cellToWorld(d, l) {
        const p = this.game.player;
        const f = facingVector(p.facing);
        const r = rightVector(p.facing);
        return {
            x: p.x + f.dx * d + r.dx * l,
            y: p.y + f.dy * d + r.dy * l
        };
    }

    /** View coordinates of a world position, or null if behind the player. */
    worldToCell(wx, wy) {
        const p = this.game.player;
        const f = facingVector(p.facing);
        const r = rightVector(p.facing);
        const dx = wx - p.x;
        const dy = wy - p.y;
        const d = dx * f.dx + dy * f.dy;
        const l = dx * r.dx + dy * r.dy;
        return { d, l };
    }

    // ── Projection ─────────────────────────────────────────────────────────────

    /**
     * The eye sits at the back edge of the player's cell, so the player's own
     * cell spans z in [0,1] and the cell at depth d spans [d, d+1].
     * Horizontal FOV is 90 degrees: a point at lateral x and depth z lands at
     * screen x = W/2 + focal * x / z, with focal = W/2.
     */
    project(x, z, y = 0) {
        const f = this._frame;
        const zz = Math.max(z, this.nearClip);
        return {
            sx: f.cx + f.focal * x / zz,
            sy: f.cy - f.focal * y / zz
        };
    }

    // ── Main entry ─────────────────────────────────────────────────────────────

    render() {
        const game = this.game;
        const ctx = this.ctx;
        const player = game.player;
        const world = game.world;
        if (!player || !world) return;

        const W = this.width;
        const H = this.height;
        const fov = game.fov;
        const lighting = game.lightingSystem;

        const visionRange = this._visionRange();
        const maxDepth = Math.min(this.maxDepth, Math.max(2, visionRange));

        this._frame = {
            cx: W / 2,
            cy: H / 2,
            focal: W / 2,
            maxDepth,
            visionRange,
            useSprites: game.graphicsMode === 'sprites' && this.renderer.graphicsMode === 'sprites'
        };

        const z = player.z;
        const playerTile = world.getTile(player.x, player.y, z);
        const indoorsHere = this._isIndoor(playerTile);

        // 1. Background: sky (or ceiling void) and ground void
        this.drawBackground(indoorsHere);

        // 2. Cells, painter's order
        const halfEye = this.wallHeight / 2;
        for (let d = maxDepth; d >= 0; d--) {
            const span = d + 2;
            // outer laterals first so inner faces overwrite them
            const laterals = [];
            for (let l = -span; l <= span; l++) laterals.push(l);
            laterals.sort((a, b) => Math.abs(b) - Math.abs(a));

            for (const l of laterals) {
                const w = this.cellToWorld(d, l);
                const tile = world.getTile(w.x, w.y, z);
                if (!tile) continue;

                const explored = !fov || fov.isExplored(w.x, w.y, z);
                const visible = !fov || fov.isVisible(w.x, w.y, z);
                // Unseen cells stay black (we still let nearer geometry overwrite).
                if (!explored && !visible) continue;

                const fog = this._fog(d);
                let light = this._cellLight(w.x, w.y, z, visible) * fog;
                const tint = lighting ? lighting.getLightTint(w.x, w.y, z) : null;

                const solid = this._isSolidWall(tile);
                if (solid) {
                    // A wall face is lit by the open cell in front of it, not by the
                    // wall tile itself (wall tiles count as "indoor" for ambient).
                    const frontCell = this.cellToWorld(d - 1, l);
                    const frontLight = this._cellLight(frontCell.x, frontCell.y, z, visible) * fog;
                    const sideCell = this.cellToWorld(d, l - Math.sign(l));
                    const sideLight = this._cellLight(sideCell.x, sideCell.y, z, visible) * fog;
                    const frontTint = lighting ? lighting.getLightTint(frontCell.x, frontCell.y, z) : null;
                    this.drawWallCell(d, l, tile, Math.max(light, frontLight), frontTint || tint, halfEye, Math.max(light, sideLight), w);
                    continue;
                }

                // Floor + ceiling
                this.drawFloorCell(d, l, tile, light, tint, halfEye);
                if (this._isIndoor(tile)) {
                    this.drawCeilingCell(d, l, light, tint, halfEye);
                }

                // Contents (only when actually visible right now)
                if (d === 0 && l === 0) continue; // the player stands here
                if (!visible) continue;
                this.drawCellContents(d, l, w.x, w.y, z, tile, light, tint, halfEye);
            }
        }

        // 3. Overlays
        this.drawHighlights();
        this.drawFloatingTexts();
        this.drawHud(playerTile);
    }

    // ── Background ─────────────────────────────────────────────────────────────

    drawBackground(indoors) {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;
        const time = this.game.timeSystem;
        const ambient = time ? time.getOutdoorAmbient() : 1.0;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        if (indoors) {
            // Dim ceiling void so open interiors read as roofed
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, W, H / 2);
            return;
        }

        // Sky gradient from night to a bruised cyberpunk dusk/day
        const night = { r: 4, g: 5, b: 12 };
        const day = { r: 78, g: 92, b: 120 };
        const horizonNight = { r: 18, g: 8, b: 26 };
        const horizonDay = { r: 150, g: 120, b: 110 };
        const top = {
            r: night.r + (day.r - night.r) * ambient,
            g: night.g + (day.g - night.g) * ambient,
            b: night.b + (day.b - night.b) * ambient
        };
        const hor = {
            r: horizonNight.r + (horizonDay.r - horizonNight.r) * ambient,
            g: horizonNight.g + (horizonDay.g - horizonNight.g) * ambient,
            b: horizonNight.b + (horizonDay.b - horizonNight.b) * ambient
        };
        const grad = ctx.createLinearGradient(0, 0, 0, H / 2);
        grad.addColorStop(0, rgb(top.r, top.g, top.b));
        grad.addColorStop(1, rgb(hor.r, hor.g, hor.b));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H / 2);
    }

    // ── Geometry ───────────────────────────────────────────────────────────────

    _quad(p1, p2, p3, p4, fill) {
        const ctx = this.ctx;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.closePath();
        ctx.fill();
    }

    drawFloorCell(d, l, tile, light, tint, halfEye) {
        const zNear = d;
        const zFar = d + 1;
        const xl = l - 0.5;
        const xr = l + 0.5;
        const y = -halfEye;

        const base = mix(tile.bgColor || '#101010', tile.fgColor || '#404040', 0.28);
        const c = lit(base, light, tint);

        const p1 = this.project(xl, zFar, y);
        const p2 = this.project(xr, zFar, y);
        const p3 = this.project(xr, zNear, y);
        const p4 = this.project(xl, zNear, y);
        this._quad(p1, p2, p3, p4, rgb(c.r, c.g, c.b));

        // Glyph stamped on the floor for tile identity (roads, water, grass...)
        if (tile.glyph && tile.glyph !== ' ' && tile.glyph !== '.' && d > 0) {
            const zc = d + 0.5;
            const centre = this.project(l, zc, y);
            const size = Math.max(6, (this._frame.focal * 0.7) / zc);
            const gc = lit(parseHex(tile.fgColor || '#808080'), light, tint);
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(centre.sx, centre.sy);
            ctx.scale(1, 0.45);
            ctx.font = `bold ${Math.round(size)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = rgb(gc.r, gc.g, gc.b, 0.55);
            ctx.fillText(tile.glyph, 0, 0);
            ctx.restore();
        }
    }

    drawCeilingCell(d, l, light, tint, halfEye) {
        const zNear = d;
        const zFar = d + 1;
        const xl = l - 0.5;
        const xr = l + 0.5;
        const y = halfEye;
        const c = lit({ r: 52, g: 50, b: 48 }, light * 0.8, tint);
        const p1 = this.project(xl, zFar, y);
        const p2 = this.project(xr, zFar, y);
        const p3 = this.project(xr, zNear, y);
        const p4 = this.project(xl, zNear, y);
        this._quad(p1, p2, p3, p4, rgb(c.r, c.g, c.b));
    }

    /**
     * A solid cell draws its front face (facing the player) and, when it is
     * off-centre, the side face that faces the view axis.
     */
    drawWallCell(d, l, tile, light, tint, halfEye, sideLight = light, worldPos = null) {
        const zNear = d;
        const zFar = d + 1;
        const xl = l - 0.5;
        const xr = l + 0.5;

        const isGlass = this._isGlassLike(tile);
        // Slight per-cell variation so long walls read as separate panels
        const variance = worldPos ? this._hashVariance(worldPos.x, worldPos.y) : 0;
        const baseFront = mix(tile.fgColor || '#888888', tile.bgColor || '#000000', 0.45 + variance);
        const front = lit(baseFront, light, tint);
        const side = lit(baseFront, sideLight * 0.62, tint);
        const alpha = isGlass ? 0.42 : 1;

        // Side face (towards the centre line). Drawn first, front face overwrites.
        if (l !== 0 || d === 0) {
            const xSide = l < 0 ? xr : (l > 0 ? xl : null);
            const sides = xSide === null ? [xl, xr] : [xSide];
            for (const xs of sides) {
                const top1 = this.project(xs, zNear, halfEye);
                const top2 = this.project(xs, zFar, halfEye);
                const bot2 = this.project(xs, zFar, -halfEye);
                const bot1 = this.project(xs, zNear, -halfEye);
                this._quad(top1, top2, bot2, bot1, rgb(side.r, side.g, side.b, alpha));
                this._edge(top1, top2, bot2, bot1, light);
            }
        }

        // Front face
        if (d > 0) {
            const tl = this.project(xl, zNear, halfEye);
            const tr = this.project(xr, zNear, halfEye);
            const br = this.project(xr, zNear, -halfEye);
            const bl = this.project(xl, zNear, -halfEye);
            this._quad(tl, tr, br, bl, rgb(front.r, front.g, front.b, alpha));
            this._edge(tl, tr, br, bl, light);

            // Faint glyph so wall types stay readable (#, +, ", T ...)
            if (tile.glyph && tile.glyph !== ' ' && tile.glyph !== '#') {
                const faceW = tr.sx - tl.sx;
                const faceH = bl.sy - tl.sy;
                const size = Math.max(8, Math.min(faceW, faceH) * 0.6);
                const gc = lit(parseHex(tile.fgColor || '#cccccc'), Math.max(0.35, Math.min(1, light + 0.15)), tint);
                const ctx = this.ctx;
                ctx.font = `bold ${Math.round(size)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = rgb(gc.r, gc.g, gc.b, 0.9);
                ctx.fillText(tile.glyph, (tl.sx + tr.sx) / 2, (tl.sy + bl.sy) / 2);
            }
        }
    }

    _edge(p1, p2, p3, p4, light) {
        const ctx = this.ctx;
        const a = Math.max(0.08, Math.min(0.5, light * 0.5));
        ctx.strokeStyle = `rgba(0,0,0,${a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.closePath();
        ctx.stroke();
    }

    // ── Billboards ─────────────────────────────────────────────────────────────

    /**
     * Screen-space frame for a billboard standing in cell (d,l).
     * heightUnits: height in cell units (1 = floor to ceiling)
     * widthUnits:  width in cell units
     * Returns { x, y, w, h } with (x,y) top-left, and centre cx/cy.
     */
    billboardRect(d, l, heightUnits, widthUnits, halfEye, lift = 0) {
        const zc = d + 0.5;
        const bottom = this.project(l, zc, -halfEye + lift);
        const top = this.project(l, zc, -halfEye + lift + heightUnits);
        const h = bottom.sy - top.sy;
        const w = (this._frame.focal * widthUnits) / Math.max(zc, this.nearClip);
        return {
            x: bottom.sx - w / 2,
            y: top.sy,
            w,
            h,
            cx: bottom.sx,
            cy: (top.sy + bottom.sy) / 2,
            z: zc
        };
    }

    drawGlyphBillboard(rect, glyph, color, light, tint, opts = {}) {
        const ctx = this.ctx;
        const c = lit(parseHex(color || '#ffffff'), Math.max(opts.minLight ?? 0.3, Math.min(1, light + (opts.boost || 0))), tint);
        const size = Math.max(8, rect.h * (opts.scale || 0.85));
        ctx.save();
        ctx.font = `bold ${Math.round(size)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (opts.backing) {
            ctx.fillStyle = `rgba(0,0,0,${opts.backing})`;
            ctx.beginPath();
            ctx.ellipse(rect.cx + (opts.dx || 0), rect.cy + (opts.dy || 0), rect.w * 0.55, rect.h * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.lineWidth = Math.max(1, size / 12);
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(glyph, rect.cx + (opts.dx || 0), rect.cy + (opts.dy || 0));
        ctx.fillStyle = rgb(c.r, c.g, c.b, opts.alpha || 1);
        ctx.fillText(glyph, rect.cx + (opts.dx || 0), rect.cy + (opts.dy || 0));
        ctx.restore();
    }

    drawCellContents(d, l, wx, wy, z, tile, light, tint, halfEye) {
        const world = this.game.world;
        const ctx = this.ctx;

        // Stairs / manholes / ladders: mark on the floor
        if (tile.isStaircase || tile.isManhole || tile.isLadder) {
            const r = this.billboardRect(d, l, 0.35, 0.6, halfEye);
            this.drawGlyphBillboard(r, tile.glyph || '>', tile.fgColor || '#00ffff', light, tint, { boost: 0.2, backing: 0.35 });
        }

        // Non-solid but blocking obstacles (fence, glass already handled, rubble, brush, open doors)
        if (tile.blocked && !this._isSolidWall(tile)) {
            const r = this.billboardRect(d, l, 0.75, 0.95, halfEye);
            this.drawGlyphBillboard(r, tile.glyph || 'X', tile.fgColor || '#aaaaaa', light, tint, { scale: 0.95, alpha: 0.95 });
        } else if (tile.worldObject || (tile.glyph && tile.glyph !== ' ' && this._isFurnishingGlyph(tile))) {
            // Walkable world object (open door, mat, counter you can step over)
            const r = this.billboardRect(d, l, 0.55, 0.7, halfEye);
            this.drawGlyphBillboard(r, tile.glyph, tile.fgColor || '#aaaaaa', light, tint, { alpha: 0.9 });
        }

        // Items on the floor
        const items = world.getItemsAt(wx, wy, z);
        if (items.length > 0) {
            const r = this.billboardRect(d, l, 0.28, 0.4, halfEye, 0.02);
            const item = items[0];
            this.drawGlyphBillboard(r, item.glyph || '*', item.color || '#ffcc00', light, tint, { boost: 0.25, backing: 0.4 });
            if (items.length > 1) {
                ctx.save();
                ctx.font = `bold ${Math.max(9, Math.round(r.h * 0.5))}px monospace`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`x${items.length}`, r.cx + r.w * 0.5, r.y + r.h);
                ctx.restore();
            }
        }

        // Entities
        const entity = world.getEntityAt(wx, wy, z);
        if (entity && entity !== this.game.player) {
            this.drawEntity(entity, d, l, light, tint, halfEye);
        }
    }

    drawEntity(entity, d, l, light, tint, halfEye) {
        const ctx = this.ctx;
        const combatFx = this.game.combatEffects;
        const shake = combatFx ? combatFx.getShakeOffset(entity) : { dx: 0, dy: 0 };
        const r = this.billboardRect(d, l, 0.82, 0.7, halfEye);

        // Sprite path
        if (this._frame.useSprites && this.renderer.spriteManager && this.game.world.getEntitySpriteData) {
            const spriteData = this.game.world.getEntitySpriteData(entity);
            if (spriteData) {
                const size = Math.max(8, r.h);
                const drawn = this.renderer.spriteManager.drawSprite(
                    ctx, spriteData.sheet, spriteData.index,
                    r.cx - size / 2 + shake.dx, r.y + shake.dy, size,
                    spriteData.tint || null, Math.min(1, light + 0.1), tint
                );
                if (drawn) {
                    this._entityLabel(entity, r, d);
                    return;
                }
            }
        }

        this.drawGlyphBillboard(r, entity.glyph || '?', entity.color || '#ff4444', light, tint, {
            boost: 0.25, backing: 0.45, dx: shake.dx, dy: shake.dy
        });
        this._entityLabel(entity, r, d);
    }

    _entityLabel(entity, r, d) {
        if (d > 3) return;
        const ctx = this.ctx;
        const label = entity.name || entity.type || '';
        if (!label) return;
        let color = '#dddddd';
        if (entity.getDetectionColor) color = entity.getDetectionColor();
        else if (entity.hostile === false) color = '#88ff88';
        ctx.save();
        ctx.font = `bold ${Math.max(10, Math.round(12 + (3 - d) * 2))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText(label, r.cx, r.y - 2);
        ctx.fillStyle = color;
        ctx.fillText(label, r.cx, r.y - 2);
        ctx.restore();
    }

    // ── Overlays ───────────────────────────────────────────────────────────────

    /** Outline a view cell on the floor (for interact / inspect highlights). */
    outlineCell(d, l, color, halfEye = this.wallHeight / 2, lineWidth = 2) {
        const ctx = this.ctx;
        const p1 = this.project(l - 0.5, d + 1, -halfEye);
        const p2 = this.project(l + 0.5, d + 1, -halfEye);
        const p3 = this.project(l + 0.5, d, -halfEye);
        const p4 = this.project(l - 0.5, d, -halfEye);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    drawHighlights() {
        const game = this.game;
        const halfEye = this.wallHeight / 2;

        if (game.interactMode && game.interactCandidates) {
            for (const c of game.interactCandidates) {
                const cell = this.worldToCell(c.x, c.y);
                if (cell.d < 0) {
                    this._edgeMarker('BEHIND: ' + this._candidateLabel(c), '#00ff80');
                    continue;
                }
                this.outlineCell(cell.d, cell.l, '#00ff80', halfEye, 3);
                const r = this.billboardRect(cell.d, cell.l, 0.2, 0.6, halfEye);
                this._tag(r.cx, r.cy, this._candidateLabel(c), '#00ff80');
            }
        }

        if (game.inspectMode) {
            const cell = this.worldToCell(game.inspectCursor.x, game.inspectCursor.y);
            if (cell.d >= 0) {
                this.outlineCell(cell.d, cell.l, '#ffff00', halfEye, 3);
            } else {
                this._edgeMarker('INSPECTING BEHIND YOU', '#ffff00');
            }
        }
    }

    _candidateLabel(c) {
        const rel = deltaToRelative(this.game.player.facing, c.dx, c.dy);
        const what = c.npc ? c.npc.name : c.worldObj ? c.worldObj.name : c.groundItems?.length ? 'items' : c.hasStairs ? 'stairs' : '';
        const key = { here: 'Space', forward: 'W', back: 'S', left: 'A', right: 'D' }[rel] || '';
        return key ? `[${key}] ${what}` : what;
    }

    _tag(x, y, text, color) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(text).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(x - w / 2, y - 8, w, 16);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    _edgeMarker(text, color) {
        this._tag(this.width / 2, this.height - 46, text, color);
    }

    drawFloatingTexts() {
        const fx = this.game.combatEffects;
        if (!fx || !fx.floatingTexts || fx.floatingTexts.length === 0) return;
        const ctx = this.ctx;
        const now = performance.now();
        const halfEye = this.wallHeight / 2;
        const player = this.game.player;

        for (let i = fx.floatingTexts.length - 1; i >= 0; i--) {
            const ft = fx.floatingTexts[i];
            const elapsed = now - ft.startTime;
            if (elapsed >= ft.duration) {
                fx.floatingTexts.splice(i, 1);
                continue;
            }
            const progress = elapsed / ft.duration;
            const alpha = progress > 0.6 ? 1 - ((progress - 0.6) / 0.4) : 1.0;

            let sx, sy, size;
            if (ft.x === player.x && ft.y === player.y) {
                sx = this.width / 2;
                sy = this.height * 0.72 - progress * 40;
                size = 18;
            } else {
                const cell = this.worldToCell(ft.x, ft.y);
                if (cell.d < 0) {
                    sx = this.width / 2;
                    sy = this.height - 60 - progress * 30;
                    size = 14;
                } else {
                    const r = this.billboardRect(cell.d, cell.l, 0.82, 0.7, halfEye);
                    sx = r.cx;
                    sy = r.y - 14 - progress * r.h * 0.5;
                    size = Math.max(11, Math.min(20, 22 - cell.d * 2));
                }
            }

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${size}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, sx, sy);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, sx, sy);
            ctx.restore();
        }
    }

    drawHud(playerTile) {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;
        const player = this.game.player;
        const world = this.game.world;
        const facing = normalizeFacing(player.facing);

        // Compass strip
        const compass = { north: 'N', east: 'E', south: 'S', west: 'W' };
        const leftF = turnFacing(facing, -1);
        const rightF = turnFacing(facing, 1);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(W / 2 - 110, 6, 220, 26);
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#666666';
        ctx.fillText(compass[leftF], W / 2 - 70, 19);
        ctx.fillText(compass[rightF], W / 2 + 70, 19);
        ctx.fillStyle = '#00ffcc';
        ctx.fillText(`▲ ${facing.toUpperCase()}`, W / 2, 19);
        ctx.restore();

        // What lies directly ahead (one line, bottom-left)
        const ahead = this.cellToWorld(1, 0);
        const aheadTile = world.getTile(ahead.x, ahead.y, player.z);
        const aheadEntity = world.getEntityAt(ahead.x, ahead.y, player.z);
        const aheadItems = world.getItemsAt(ahead.x, ahead.y, player.z);
        const aheadVisible = !this.game.fov || this.game.fov.isVisible(ahead.x, ahead.y, player.z);
        let aheadText = '';
        if (aheadVisible) {
            if (aheadEntity && aheadEntity !== player) aheadText = aheadEntity.name || aheadEntity.type;
            else if (aheadTile.worldObject) aheadText = aheadTile.worldObject.name;
            else if (aheadItems.length) aheadText = aheadItems.length === 1 ? aheadItems[0].name : `${aheadItems.length} items`;
            else if (aheadTile.name && aheadTile.name !== 'Void') aheadText = aheadTile.name;
        }

        const hereItems = world.getItemsAt(player.x, player.y, player.z);
        let hereText = playerTile?.name || '';
        if (playerTile?.isStaircase || playerTile?.isManhole || playerTile?.isLadder) hereText += '  [< >]';
        if (hereItems.length) hereText += `  ·  ${hereItems.length === 1 ? hereItems[0].name : hereItems.length + ' items'} at your feet [G]`;

        ctx.save();
        ctx.font = '13px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const lines = [];
        if (aheadText) lines.push({ t: `Ahead: ${aheadText}`, c: '#cccccc' });
        if (hereText) lines.push({ t: `Here:  ${hereText}`, c: '#9a9a9a' });
        let y = H - 8;
        for (let i = lines.length - 1; i >= 0; i--) {
            const w = ctx.measureText(lines[i].t).width + 12;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(6, y - 17, w, 18);
            ctx.fillStyle = lines[i].c;
            ctx.fillText(lines[i].t, 12, y - 1);
            y -= 20;
        }
        ctx.restore();

        // Mode hints (bottom-right); narrow canvases skip them to avoid overlap
        if (W < 760) return;
        const hint = this.game.inspectMode
            ? 'INSPECT  W/S/A/D move cursor  ·  Esc exit'
            : this.game.interactMode
                ? 'INTERACT  pick a direction  ·  Esc cancel'
                : `W fwd · S back · A/D turn · Shift+A/D strafe · \` map view`;
        ctx.save();
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const hw = ctx.measureText(hint).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(W - hw - 6, H - 24, hw, 18);
        ctx.fillStyle = '#777777';
        ctx.fillText(hint, W - 12, H - 9);
        ctx.restore();
    }

    // ── Classification helpers ─────────────────────────────────────────────────

    _isSolidWall(tile) {
        if (!tile) return true;
        if (!tile.blocked) return false;
        // Solid = blocks both movement and sight (walls, closed doors, trees, void)
        if (tile.blocksVision) return true;
        // Glass is drawn as a translucent wall face rather than a billboard
        return this._isGlassLike(tile);
    }

    _isGlassLike(tile) {
        const n = (tile.name || '').toLowerCase();
        return n.includes('window') || n.includes('glass');
    }

    _isFurnishingGlyph(tile) {
        // Walkable tiles that carry a decorative glyph worth showing as an object
        const n = (tile.name || '').toLowerCase();
        return n.includes('door') || n.includes('mat') || n.includes('rug') || n.includes('counter');
    }

    _isIndoor(tile) {
        if (!tile) return false;
        if (tile.isExterior === false) return true;
        const lighting = this.game.lightingSystem;
        if (lighting && lighting.isIndoorTile) return lighting.isIndoorTile(tile);
        return false;
    }

    _visionRange() {
        const game = this.game;
        const base = game.player?.anatomy?.getVisionRange ? game.player.anatomy.getVisionRange() : 8;
        if (game.lightingSystem) return game.lightingSystem.getEffectiveVisionRadius(base);
        return base;
    }

    _fog(d) {
        const range = Math.max(2, Math.min(this._frame.visionRange, this._frame.maxDepth));
        const start = range * this.fogStart;
        if (d <= start) return 1.0;
        const t = (d - start) / Math.max(0.001, (range + 0.6 - start));
        return Math.max(0.03, 1 - t * t);
    }

    /** Light level for a cell, dimmed when it is only remembered. */
    _cellLight(x, y, z, visible) {
        const lighting = this.game.lightingSystem;
        let light = lighting ? lighting.getLightLevel(x, y, z) : 1.0;
        if (!visible) light = Math.min(light, 0.18);
        return light;
    }

    /** Deterministic small offset in [-0.06, 0.06] from world coordinates. */
    _hashVariance(x, y) {
        let h = (x * 374761393 + y * 668265263) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = (h ^ (h >>> 16)) >>> 0;
        return ((h % 1000) / 1000 - 0.5) * 0.12;
    }
}
