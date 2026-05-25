// PARTICLES.JS - Rich Retro Visual FX & Particle System (Guardian Tales Style)

class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx !== undefined ? options.vx : (Math.random() * 2 - 1);
        this.vy = options.vy !== undefined ? options.vy : (Math.random() * 2 - 1);
        this.size = options.size !== undefined ? options.size : (Math.random() * 3 + 2);
        this.color = options.color || '#fff';
        this.life = 1.0; // Starts at 1, goes to 0
        this.decay = options.decay || (Math.random() * 0.05 + 0.02);
        this.glow = options.glow || false;
        this.shape = options.shape || 'circle'; // circle, square, triangle
        this.gravity = options.gravity || 0;
        this.friction = options.friction || 0.98;
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        
        this.x += this.vx;
        this.y += this.vy;
        
        this.life -= this.decay;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        
        if (this.glow) {
            ctx.shadowBlur = this.size * 2.5;
            ctx.shadowColor = this.color;
        }

        ctx.fillStyle = this.color;

        if (this.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.shape === 'square') {
            ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        } else if (this.shape === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x + this.size, this.y + this.size);
            ctx.lineTo(this.x - this.size, this.y + this.size);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

class LightningBolt {
    constructor(sx, sy, tx, ty, color = '#00f3ff') {
        this.sx = sx;
        this.sy = sy;
        this.tx = tx;
        this.ty = ty;
        this.color = color;
        this.life = 1.0;
        this.decay = 0.08;
        this.points = this.generatePoints();
    }

    generatePoints() {
        const points = [];
        const dx = this.tx - this.sx;
        const dy = this.ty - this.sy;
        const distance = Math.hypot(dx, dy);
        const segments = Math.max(5, Math.floor(distance / 15));
        
        points.push({ x: this.sx, y: this.sy });
        
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            // Base linear interpolation
            let px = this.sx + dx * t;
            let py = this.sy + dy * t;
            
            // Add perpendicular offset for jagged lightning look
            const offset = (Math.random() * 2 - 1) * 12;
            const nx = -dy / distance;
            const ny = dx / distance;
            
            px += nx * offset;
            py += ny * offset;
            
            points.push({ x: px, y: py });
        }
        
        points.push({ x: this.tx, y: this.ty });
        return points;
    }

    update() {
        this.life -= this.decay;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(1, this.life * 4);
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.globalAlpha = this.life;
        
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();

        // White hot inner core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.5, this.life * 1.5);
        ctx.shadowBlur = 0;
        ctx.stroke();
        
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.lightnings = [];
    }

    clear() {
        this.particles = [];
        this.lightnings = [];
    }

    update() {
        this.particles = this.particles.filter(p => p.update());
        this.lightnings = this.lightnings.filter(l => l.update());
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
        this.lightnings.forEach(l => l.draw(ctx));
    }

    // Specific VFX Emitters

    emitDust(x, y, color = '#ffffff') {
        // Subtle movement trail dust
        if (Math.random() > 0.4) return;
        this.particles.push(new Particle(x, y, {
            vx: Math.random() * 0.4 - 0.2,
            vy: Math.random() * 0.4 - 0.2,
            size: Math.random() * 2 + 1,
            color: color,
            decay: 0.05,
            friction: 0.95
        }));
    }

    emitEatSparkles(x, y, color = '#ffd700') {
        // Magical fireworks when eating
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1.5;
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 2.5 + 1.5,
                color: color,
                decay: Math.random() * 0.04 + 0.02,
                glow: true,
                friction: 0.94
            }));
        }
    }

    emitGoldSparks(x, y) {
        // Gold dust floaters around gold apple
        if (Math.random() > 0.3) return;
        this.particles.push(new Particle(x, y, {
            vx: Math.random() * 0.8 - 0.4,
            vy: -Math.random() * 0.8 - 0.2, // Drifts up
            size: Math.random() * 2 + 1,
            color: '#ffd700',
            decay: 0.03,
            glow: true,
            gravity: -0.01 // Light rising force
        }));
    }

    emitElectricSparks(x, y) {
        // Electrical sparks around Lightning Apple or shocked snake
        if (Math.random() > 0.2) return;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        this.particles.push(new Particle(x, y, {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 1,
            color: '#00f3ff',
            decay: 0.08,
            glow: true,
            shape: 'square'
        }));
    }

    emitIceShards(x, y) {
        // Shards for freezing/shooting ice
        if (Math.random() > 0.3) return;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5 + 0.5;
        this.particles.push(new Particle(x, y, {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3.5 + 1.5,
            color: '#a3f3ff',
            decay: 0.05,
            glow: true,
            shape: 'triangle',
            friction: 0.95
        }));
    }

    emitIceExplosion(x, y) {
        // Shatter effect when hit by freeze projectile
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1.5;
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                color: '#d0f8ff',
                decay: Math.random() * 0.04 + 0.03,
                glow: true,
                shape: Math.random() > 0.5 ? 'triangle' : 'square',
                friction: 0.92
            }));
        }
    }

    emitDeathExplosion(x, y, color = '#ffffff') {
        // Giant dramatic explosion when a snake dies
        // 1. Regular debris sparks
        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 5 + 2,
                color: color,
                decay: Math.random() * 0.03 + 0.015,
                glow: true,
                friction: 0.93,
                gravity: 0.08 // Gravity pull downwards for retro arcade feel!
            }));
        }

        // 2. Exploding rings
        for (let i = 0; i < 3; i++) {
            const rSpeed = 1.5 + i * 1.5;
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                this.particles.push(new Particle(x, y, {
                    vx: Math.cos(angle) * rSpeed,
                    vy: Math.sin(angle) * rSpeed,
                    size: 3 - i,
                    color: '#fff',
                    decay: 0.04,
                    glow: true,
                    friction: 0.95
                }));
            }
        }
    }

    // Spawn a lightning bolt between source and target
    createLightning(sx, sy, tx, ty, color = '#00f3ff') {
        this.lightnings.push(new LightningBolt(sx, sy, tx, ty, color));
    }
}

// Instantiate globally
const particles = new ParticleSystem();
window.particles = particles;
