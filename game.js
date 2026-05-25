// GAME.JS - Core Game Loop, Snake Mechanics, Bot AI & PeerJS Online Multiplayer with Mobile D-Pad Support

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Grid properties (Canvas is 960x540)
        this.cellSize = 12;
        this.cols = this.canvas.width / this.cellSize; // 80 cols
        this.rows = this.canvas.height / this.cellSize; // 45 rows
        
        // Game state variables
        this.state = 'menu'; // menu, playing, gameover
        this.mode = 'local'; // local, bot, online-host, online-client
        this.lastTime = 0;
        this.shakeIntensity = 0;
        this.lightningTimer = 0; // screen flash helper
        
        // PeerJS Connection Variables
        this.peer = null;
        this.conn = null;
        this.roomCode = '';
        this.connectionOpened = false;
        this.vfxEvents = []; // Queue for host to broadcast visual/audio triggers
        
        // Apples
        this.redApple = null;
        this.goldApple = null;
        this.goldAppleTimer = 10.0;
        this.goldAppleDespawnTimer = 0;
        this.lightningApple = null;
        this.lightningAppleSpawned = false;
        
        // Input tracking
        this.keys = {};
        
        // Entities
        this.snakes = [];
        this.projectiles = [];
        this.floatingTexts = [];
        
        // Colors & Controls Config
        this.p1Color = '#00ff88';
        this.p2Color = '#ff0077';
        
        this.setupEventListeners();
        this.setupColorPickers();
        this.setupModeSelector();
        this.bindTouchControls();
    }

    setupEventListeners() {
        // Keyboard inputs
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            
            // Prevent browser scrolling on game keys
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter'].includes(e.key.toLowerCase()) || e.key === ' ') {
                e.preventDefault();
            }

            // Keyboard input processing for CLIENT (Sends inputs to Host)
            if (this.state === 'playing' && this.mode === 'online-client') {
                let clientKey = null;
                // Map local WASD or Arrow Keys on client to the corresponding player 2 input
                if (key === 'w' || key === 'arrowup') clientKey = 'arrowup';
                if (key === 's' || key === 'arrowdown') clientKey = 'arrowdown';
                if (key === 'a' || key === 'arrowleft') clientKey = 'arrowleft';
                if (key === 'd' || key === 'arrowright') clientKey = 'arrowright';
                if (key === ' ' || key === 'enter') clientKey = 'enter';

                if (clientKey && this.conn && this.conn.open) {
                    this.conn.send({
                        type: 'input',
                        key: clientKey,
                        state: 'keydown'
                    });
                }
                return;
            }

            // Keyboard input processing for LOCAL, BOT, and HOST modes
            if (this.state === 'playing') {
                if (e.key === ' ') {
                    this.triggerAction(0); // Player 1 action (Space)
                }
                if (e.key === 'Enter' && this.mode !== 'bot') {
                    this.triggerAction(1); // Player 2 action (Enter) - Disabled for Bot AI
                }

                // Debug Cheats (Only available in Local, Bot, or Host modes)
                if (this.mode !== 'online-client') {
                    if (key === 'g') this.spawnGoldApple(true);
                    if (key === 'l') this.spawnLightningApple(true);
                    if (key === '1') {
                        this.snakes[0].applesEaten = 149;
                        this.updateLightningMeter();
                        this.addFloatingText(this.snakes[0].body[0].x * this.cellSize, this.snakes[0].body[0].y * this.cellSize, "CHEAT: P1 SCORE 149", "#00ff88");
                    }
                    if (key === '2' && this.snakes[1]) {
                        this.snakes[1].applesEaten = 149;
                        this.updateLightningMeter();
                        this.addFloatingText(this.snakes[1].body[0].x * this.cellSize, this.snakes[1].body[0].y * this.cellSize, "CHEAT: P2 SCORE 149", "#ff0077");
                    }
                    if (key === 'k') this.killSnake(0, "Cheat self-destruct");
                    if (key === 'j' && this.snakes[1]) this.killSnake(1, "Cheat self-destruct");
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;

            if (this.state === 'playing' && this.mode === 'online-client' && this.conn && this.conn.open) {
                let clientKey = null;
                if (key === 'w' || key === 'arrowup') clientKey = 'arrowup';
                if (key === 's' || key === 'arrowdown') clientKey = 'arrowdown';
                if (key === 'a' || key === 'arrowleft') clientKey = 'arrowleft';
                if (key === 'd' || key === 'arrowright') clientKey = 'arrowright';
                if (key === ' ' || key === 'enter') clientKey = 'enter';

                if (clientKey) {
                    this.conn.send({
                        type: 'input',
                        key: clientKey,
                        state: 'keyup'
                    });
                }
            }
        });

        // Detect if it is a mobile device or touch-enabled device (phone, tablet, iPad, or touchscreen device)
        this.isMobileDevice = ('ontouchstart' in window) || 
                              (navigator.maxTouchPoints > 0) ||
                              /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // UI buttons
        document.getElementById('btn-start').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('btn-rematch').addEventListener('click', () => {
            if (this.mode === 'online-client') return; // Only Host can start/rematch
            
            if (this.mode === 'online-host') {
                this.startGame();
            } else {
                this.startGame();
            }
        });

        document.getElementById('btn-menu').addEventListener('click', () => {
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this.showScreen('menu');
        });
    }

    setupColorPickers() {
        const p1Opts = document.querySelectorAll('#p1-color-options .color-option');
        p1Opts.forEach(opt => {
            opt.addEventListener('click', () => {
                p1Opts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.p1Color = opt.getAttribute('data-color');
            });
        });

        const p2Opts = document.querySelectorAll('#p2-color-options .color-option');
        p2Opts.forEach(opt => {
            opt.addEventListener('click', () => {
                p2Opts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.p2Color = opt.getAttribute('data-color');
            });
        });
    }

    setupModeSelector() {
        const btnLocal = document.getElementById('btn-mode-local');
        const btnBot = document.getElementById('btn-mode-bot');
        const btnOnline = document.getElementById('btn-mode-online');
        
        const onlinePanel = document.getElementById('online-panel');
        const charSelection = document.getElementById('char-selection-container');
        const btnStart = document.getElementById('btn-start');
        
        const p2Selector = document.getElementById('p2-selector-card');
        const p2Title = document.getElementById('p2-selector-title');
        const p2Keys = document.getElementById('p2-keys-display');
        const footerP2Controls = document.getElementById('footer-p2-controls');

        // Clean room inputs & setups
        const clearOnlineSetup = () => {
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this.conn = null;
            this.connectionOpened = false;
            document.getElementById('create-lobby-ui').classList.add('hidden');
            document.getElementById('join-lobby-ui').classList.add('hidden');
            document.getElementById('room-code-display').innerText = '----';
            document.getElementById('room-code-input').value = '';
            document.getElementById('host-status').innerText = 'Menghubungkan ke server...';
            document.getElementById('client-status').innerText = 'Masukkan kode room dari pembuat room.';
        };

        btnLocal.addEventListener('click', () => {
            this.mode = 'local';
            setActiveTab(btnLocal);
            onlinePanel.classList.add('hidden');
            charSelection.classList.remove('hidden');
            p2Selector.classList.remove('disabled');
            p2Title.innerText = "P2 CONTROLS";
            p2Keys.classList.remove('hidden');
            footerP2Controls.classList.remove('hidden');
            btnStart.classList.remove('hidden');
            clearOnlineSetup();
        });

        btnBot.addEventListener('click', () => {
            this.mode = 'bot';
            setActiveTab(btnBot);
            onlinePanel.classList.add('hidden');
            charSelection.classList.remove('hidden');
            p2Selector.classList.add('disabled'); // Disable selector since bot is automatic
            p2Title.innerText = "BOT CONTROLS (AUTO)";
            p2Keys.classList.add('hidden');
            footerP2Controls.classList.add('hidden');
            btnStart.classList.remove('hidden');
            clearOnlineSetup();
        });

        btnOnline.addEventListener('click', () => {
            this.mode = 'online-host'; // default to host
            setActiveTab(btnOnline);
            onlinePanel.classList.remove('hidden');
            charSelection.classList.remove('hidden');
            p2Selector.classList.add('disabled'); // Disable Player 2 color picking initially (Host chooses own, P2 will sync)
            p2Title.innerText = "PLAYER 2 (REMOTE)";
            p2Keys.classList.add('hidden');
            footerP2Controls.classList.add('hidden');
            btnStart.classList.add('hidden'); // hidden because start is triggered on connection
            clearOnlineSetup();
        });

        function setActiveTab(activeBtn) {
            [btnLocal, btnBot, btnOnline].forEach(btn => btn.classList.remove('active'));
            activeBtn.classList.add('active');
        }

        // Online Sub-panel button controls
        const btnCreate = document.getElementById('btn-action-create');
        const btnJoin = document.getElementById('btn-action-join');
        const createLobby = document.getElementById('create-lobby-ui');
        const joinLobby = document.getElementById('join-lobby-ui');

        btnCreate.addEventListener('click', () => {
            this.mode = 'online-host';
            btnCreate.classList.add('active');
            btnJoin.classList.remove('active');
            createLobby.classList.remove('hidden');
            joinLobby.classList.add('hidden');
            this.initHostPeer();
        });

        btnJoin.addEventListener('click', () => {
            this.mode = 'online-client';
            btnJoin.classList.add('active');
            btnCreate.classList.remove('active');
            joinLobby.classList.remove('hidden');
            createLobby.classList.add('hidden');
            this.preInitClientPeer();
        });

        document.getElementById('btn-connect-room').addEventListener('click', () => {
            this.connectToHost();
        });
    }

    // MOBILE DPAD Sentuhan/Touch Handler
    bindTouchControls() {
        const dpadBtns = document.querySelectorAll('.dpad-btn');
        const actionBtns = document.querySelectorAll('.dpad-action-btn');

        const handleDpadStart = (btn, e) => {
            e.preventDefault();
            btn.classList.add('touch-active');
            
            const playerIdx = parseInt(btn.getAttribute('data-player'));
            const dir = btn.getAttribute('data-dir');
            const snake = this.snakes[playerIdx];
            
            if (this.state !== 'playing' || !snake || !snake.isAlive) return;

            // CLIENT MODE INPUT TRANSMISSION
            if (this.mode === 'online-client' && playerIdx === 1) {
                if (this.conn && this.conn.open) {
                    this.conn.send({
                        type: 'input',
                        key: 'arrow' + dir,
                        state: 'keydown'
                    });
                }
                return;
            }

            // LOCAL/HOST/BOT DIRECTION ASSIGNMENT
            let confused = snake.buffs.confused > 0;
            let finalDir = dir;
            if (confused) {
                if (dir === 'up') finalDir = 'down';
                else if (dir === 'down') finalDir = 'up';
                else if (dir === 'left') finalDir = 'right';
                else if (dir === 'right') finalDir = 'left';
            }

            // Prevent turning 180 degrees
            if (finalDir === 'up' && snake.direction !== 'down') snake.nextDirection = 'up';
            if (finalDir === 'down' && snake.direction !== 'up') snake.nextDirection = 'down';
            if (finalDir === 'left' && snake.direction !== 'right') snake.nextDirection = 'left';
            if (finalDir === 'right' && snake.direction !== 'left') snake.nextDirection = 'right';
        };

        const handleDpadEnd = (btn, e) => {
            e.preventDefault();
            btn.classList.remove('touch-active');
            
            const playerIdx = parseInt(btn.getAttribute('data-player'));
            const dir = btn.getAttribute('data-dir');
            
            if (this.mode === 'online-client' && playerIdx === 1 && this.conn && this.conn.open) {
                this.conn.send({
                    type: 'input',
                    key: 'arrow' + dir,
                    state: 'keyup'
                });
            }
        };

        dpadBtns.forEach(btn => {
            // Touch handlers
            btn.addEventListener('touchstart', (e) => handleDpadStart(btn, e), { passive: false });
            btn.addEventListener('touchend', (e) => handleDpadEnd(btn, e), { passive: false });
            // Mouse fallbacks for testing in desktop emulators
            btn.addEventListener('mousedown', (e) => handleDpadStart(btn, e));
            btn.addEventListener('mouseup', (e) => handleDpadEnd(btn, e));
            btn.addEventListener('mouseleave', (e) => btn.classList.remove('touch-active'));
        });

        const handleActionStart = (btn, e) => {
            e.preventDefault();
            btn.classList.add('touch-active');
            
            const playerIdx = parseInt(btn.getAttribute('data-player'));
            if (this.state !== 'playing') return;

            if (this.mode === 'online-client' && playerIdx === 1) {
                if (this.conn && this.conn.open) {
                    this.conn.send({
                        type: 'input',
                        key: 'enter',
                        state: 'keydown'
                    });
                }
                return;
            }

            this.triggerAction(playerIdx);
        };

        const handleActionEnd = (btn, e) => {
            e.preventDefault();
            btn.classList.remove('touch-active');
            
            const playerIdx = parseInt(btn.getAttribute('data-player'));
            if (this.mode === 'online-client' && playerIdx === 1 && this.conn && this.conn.open) {
                this.conn.send({
                    type: 'input',
                    key: 'enter',
                    state: 'keyup'
                });
            }
        };

        actionBtns.forEach(btn => {
            btn.addEventListener('touchstart', (e) => handleActionStart(btn, e), { passive: false });
            btn.addEventListener('touchend', (e) => handleActionEnd(btn, e), { passive: false });
            btn.addEventListener('mousedown', (e) => handleActionStart(btn, e));
            btn.addEventListener('mouseup', (e) => handleActionEnd(btn, e));
            btn.addEventListener('mouseleave', (e) => btn.classList.remove('touch-active'));
        });
    }

    updateMobileControlsVisibility() {
        const container = document.getElementById('mobile-controls-container');
        const padP1 = document.getElementById('touch-pad-p1');
        const padP2 = document.getElementById('touch-pad-p2');

        if (this.state !== 'playing' || !this.isMobileDevice) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        if (this.mode === 'local') {
            padP1.classList.remove('hidden');
            padP2.classList.remove('hidden');
        } else if (this.mode === 'bot' || this.mode === 'online-host') {
            padP1.classList.remove('hidden');
            padP2.classList.add('hidden');
        } else if (this.mode === 'online-client') {
            padP1.classList.add('hidden');
            padP2.classList.remove('hidden');
        }
    }

    // PEERJS NETWORK INTEGRATION
    initHostPeer() {
        if (this.peer) this.peer.destroy();
        this.connectionOpened = false;
        
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        this.roomCode = roomCode;
        
        document.getElementById('host-status').innerText = "Generating Room ID...";
        
        // PeerJS connection setup with custom high-speed STUN & TURN config
        this.peer = new Peer(`snakeclash-${roomCode}`, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    {
                        urls: [
                            'turn:openrelay.metered.ca:80',
                            'turn:openrelay.metered.ca:443',
                            'turns:openrelay.metered.ca:443'
                        ],
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            document.getElementById('room-code-display').innerText = roomCode;
            document.getElementById('host-status').innerText = "Waiting for Player 2 to join...";
        });

        this.peer.on('connection', (connection) => {
            this.conn = connection;
            this.setupConnection();
        });

        this.peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                this.initHostPeer(); // Code taken, retry regeneration
            } else {
                document.getElementById('host-status').innerText = "Koneksi Gagal. Coba lagi.";
                console.error(err);
            }
        });
    }

    preInitClientPeer() {
        // Pre-initialize client peer in the background to speed up connecting
        if (this.peer && !this.peer.destroyed && this.peer.id) {
            // Already initialized and open
            return;
        }
        
        if (this.peer) {
            this.peer.destroy();
        }
        this.connectionOpened = false;
        
        document.getElementById('client-status').innerText = "Menghubungkan ke server signaling...";
        
        this.peer = new Peer(null, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    {
                        urls: [
                            'turn:openrelay.metered.ca:80',
                            'turn:openrelay.metered.ca:443',
                            'turns:openrelay.metered.ca:443'
                        ],
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            document.getElementById('client-status').innerText = "Masukkan kode room dari pembuat room.";
        });
        
        this.peer.on('error', (err) => {
            document.getElementById('client-status').innerText = "Gagal terhubung ke server signaling. Coba lagi.";
            console.error(err);
        });
    }

    connectToHost() {
        this.connectionOpened = false;
        
        const inputVal = document.getElementById('room-code-input').value.trim();
        if (inputVal.length !== 4 || isNaN(inputVal)) {
            document.getElementById('client-status').innerText = "Kode room harus berupa 4 digit angka!";
            return;
        }

        document.getElementById('client-status').innerText = "Connecting to room " + inputVal + "...";
        
        const performConnect = () => {
            this.conn = this.peer.connect(`snakeclash-${inputVal}`);
            this.setupConnection();
        };

        // If peer is already open, connect immediately!
        if (this.peer && !this.peer.destroyed && this.peer.id) {
            performConnect();
        } else {
            // Re-initialize and connect on open
            this.preInitClientPeer();
            this.peer.once('open', () => {
                performConnect();
            });
        }
    }

    setupConnection() {
        // Fast connection listener trigger to prevent WebRTC open race conditions
        const triggerOpen = () => {
            this.handleConnectionOpen();
        };

        this.conn.on('open', triggerOpen);

        // IMMEDIATE CHECK: If connection handshake completes instantly, resolve it immediately!
        if (this.conn.open) {
            triggerOpen();
        }

        this.conn.on('data', (data) => {
            if (data.type === 'init') {
                this.p1Color = data.p1Color;
                this.p2Color = data.p2Color;
            }
            else if (data.type === 'start') {
                if (this.state !== 'playing') {
                    this.startClientGame(data);
                }
            }
            else if (data.type === 'input') {
                if (data.state === 'keydown') {
                    this.keys[data.key] = true;
                    if (data.key === 'enter') {
                        this.triggerAction(1);
                    }
                } else if (data.state === 'keyup') {
                    this.keys[data.key] = false;
                }
            }
            else if (data.type === 'state') {
                this.applySyncedState(data);
            }
        });

        this.conn.on('close', () => {
            this.handleDisconnect();
        });
        
        this.conn.on('error', () => {
            this.handleDisconnect();
        });
    }

    handleConnectionOpen() {
        if (this.connectionOpened) return; // Prevent double trigger
        this.connectionOpened = true;

        if (this.mode === 'online-host') {
            document.getElementById('host-status').innerText = "Connected! Launching game...";
            
            // Transmit initialization variables to P2
            this.conn.send({
                type: 'init',
                p1Color: this.p1Color,
                p2Color: this.p2Color
            });

            // Launch immediately
            this.startGame();
        } else {
            document.getElementById('client-status').innerText = "Connected! Launching game...";
            
            // Launch immediately
            this.startClientGame({
                p1Color: this.p1Color,
                p2Color: this.p2Color
            });
        }
    }

    handleDisconnect() {
        if (this.state === 'playing') {
            this.state = 'menu';
            this.showScreen('menu');
            alert("Lawan terputus dari room!");
        }
        if (this.mode === 'online-host') {
            document.getElementById('host-status').innerText = "Terputus. Menunggu Player 2...";
        } else {
            document.getElementById('client-status').innerText = "Koneksi terputus/gagal. Silakan coba hubungkan lagi.";
        }
        this.connectionOpened = false;
    }

    startClientGame(data) {
        audio.init();
        audio.resume();
        audio.startBGM();

        // Reset local structures
        particles.clear();
        this.projectiles = [];
        this.floatingTexts = [];
        
        // Re-align P1 & P2 colors
        this.p1Color = data.p1Color;
        this.p2Color = data.p2Color;

        this.snakes = [
            new Snake(0, [], 'right', this.p1Color),
            new Snake(1, [], 'left', this.p2Color)
        ];

        this.updateMobileControlsVisibility();
        this.updateHUD();
        this.showScreen('playing');

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    applySyncedState(data) {
        // Sync Snakes coordinates
        data.snakes.forEach((sData, idx) => {
            const snake = this.snakes[idx];
            if (snake) {
                snake.body = sData.body;
                snake.direction = sData.direction;
                snake.score = sData.score;
                snake.applesEaten = sData.applesEaten;
                snake.buffs = sData.buffs;
                snake.isAlive = sData.isAlive;
                snake.isFrozen = sData.isFrozen;
                snake.freezeTimer = sData.freezeTimer;
            }
        });

        // Sync Apples
        this.redApple = data.redApple;
        this.goldApple = data.goldApple;
        this.goldAppleTimer = data.goldAppleTimer;
        this.goldAppleDespawnTimer = data.goldAppleDespawnTimer;
        this.lightningApple = data.lightningApple;
        this.lightningAppleSpawned = data.lightningAppleSpawned;

        // Sync visual timers
        this.shakeIntensity = data.shakeIntensity;
        this.lightningTimer = data.lightningTimer;

        // Sync floating texts
        this.floatingTexts = data.floatingTexts;

        // Sync dynamic VFX particles and SFX
        if (data.vfxEvents) {
            data.vfxEvents.forEach(e => {
                const cx = e.x * this.cellSize + this.cellSize/2;
                const cy = e.y * this.cellSize + this.cellSize/2;

                if (e.type === 'eat-red') {
                    audio.playEatRed();
                    particles.emitEatSparkles(cx, cy, e.color);
                } else if (e.type === 'eat-gold') {
                    audio.playEatGold();
                    particles.emitEatSparkles(cx, cy, '#ffd700');
                } else if (e.type === 'eat-lightning') {
                    audio.playLightning();
                    particles.emitEatSparkles(cx, cy, '#00f3ff');
                } else if (e.type === 'shoot-ice') {
                    audio.playShootIce();
                    for (let i = 0; i < 8; i++) {
                        particles.emitIceShards(cx, cy);
                    }
                } else if (e.type === 'hit-ice') {
                    audio.playFreezeHit();
                    particles.emitIceExplosion(cx, cy);
                } else if (e.type === 'death') {
                    audio.playExplosion();
                    particles.emitDeathExplosion(cx, cy, e.color);
                } else if (e.type === 'lightning-bolt') {
                    particles.createLightning(e.sx, e.sy, e.tx, e.ty, '#00f3ff');
                } else if (e.type === 'gameover') {
                    this.endGame(e.reason);
                }
            });
        }
    }

    showScreen(screenName) {
        document.getElementById('screen-menu').classList.remove('active');
        document.getElementById('screen-gameover').classList.remove('active');
        
        if (screenName === 'menu') {
            document.getElementById('screen-menu').classList.add('active');
            this.state = 'menu';
            audio.stopBGM();
            this.updateMobileControlsVisibility();
        } else if (screenName === 'gameover') {
            document.getElementById('screen-gameover').classList.add('active');
            this.state = 'gameover';
            audio.stopBGM();
            this.updateMobileControlsVisibility();
        } else if (screenName === 'playing') {
            this.state = 'playing';
        }
    }

    startGame() {
        audio.init();
        audio.resume();
        audio.startBGM();

        particles.clear();
        this.projectiles = [];
        this.floatingTexts = [];
        this.vfxEvents = [];
        
        this.lightningApple = null;
        this.lightningAppleSpawned = false;
        
        // P1 & P2 setup
        this.snakes = [
            new Snake(0, [{x: 10, y: 22}, {x: 9, y: 22}, {x: 8, y: 22}, {x: 7, y: 22}, {x: 6, y: 22}], 'right', this.p1Color),
            new Snake(1, [{x: 70, y: 22}, {x: 71, y: 22}, {x: 72, y: 22}, {x: 73, y: 22}, {x: 74, y: 22}], 'left', this.p2Color)
        ];

        this.spawnRedApple();
        this.goldApple = null;
        this.goldAppleTimer = 10.0;
        this.goldAppleDespawnTimer = 0;

        // Custom HUD names depending on mode
        const p1Name = document.getElementById('p1-hud-name');
        const p2Name = document.getElementById('p2-hud-name');
        
        if (this.mode === 'bot') {
            p1Name.innerText = "PLAYER";
            p2Name.innerText = "BOT AI";
        } else if (this.mode === 'online-host') {
            p1Name.innerText = "P1 (YOU)";
            p2Name.innerText = "P2 (REMOTE)";
        } else {
            p1Name.innerText = "PLAYER 1";
            p2Name.innerText = "PLAYER 2";
        }

        this.updateHUD();
        this.updateLightningMeter();
        this.updateMobileControlsVisibility(); // Show virtual D-pads
        
        this.showScreen('playing');
        
        // Send initial start signal to Client
        if (this.mode === 'online-host' && this.conn && this.conn.open) {
            this.conn.send({
                type: 'start',
                p1Color: this.p1Color,
                p2Color: this.p2Color
            });
        }

        this.lastTime = performance.now();
        this.triggerAlert("FIGHT!", "#fff", 1.5);
        this.shake(5);

        requestAnimationFrame((t) => this.loop(t));
    }

    loop(time) {
        if (this.state !== 'playing') return;

        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (this.mode === 'online-client') {
            // Client only processes local graphics and drawings, everything else is received
            if (this.shakeIntensity > 0) this.shakeIntensity *= 0.9;
            if (this.lightningTimer > 0) this.lightningTimer -= dt;

            particles.update();
            this.floatingTexts = this.floatingTexts.filter(ft => {
                ft.y -= 30 * dt;
                ft.life -= dt;
                return ft.life > 0;
            });
            this.updateHUD();
            this.draw();
        } else {
            // Host, Local, Bot runs authoritative update loop
            this.update(dt);
            this.draw();
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.handleInput();

        // If VS BOT mode, calculate Bot's next move
        if (this.mode === 'bot') {
            this.getBotNextDirection();
        }

        if (this.shakeIntensity > 0) this.shakeIntensity *= 0.9;
        if (this.lightningTimer > 0) this.lightningTimer -= dt;

        this.snakes.forEach(snake => {
            if (snake.isAlive) {
                snake.update(dt, this);
            }
        });

        this.updateProjectiles(dt);

        // Gold Apple timing updates
        if (!this.goldApple) {
            this.goldAppleTimer -= dt;
            if (this.goldAppleTimer <= 0) {
                this.spawnGoldApple();
            }
        } else {
            this.goldAppleDespawnTimer -= dt;
            if (this.goldAppleDespawnTimer <= 0) {
                this.goldApple = null;
                this.goldAppleTimer = 10.0;
            }
        }

        particles.update();

        this.floatingTexts = this.floatingTexts.filter(ft => {
            ft.y -= 30 * dt;
            ft.life -= dt;
            return ft.life > 0;
        });

        if (!this.lightningAppleSpawned && (this.snakes[0].applesEaten >= 150 || (this.snakes[1] && this.snakes[1].applesEaten >= 150))) {
            this.spawnLightningApple();
        }

        this.updateHUD();

        // Host Mode: Transmit synced frame package
        if (this.mode === 'online-host' && this.conn && this.conn.open) {
            this.conn.send({
                type: 'state',
                snakes: this.snakes.map(s => ({
                    body: s.body,
                    direction: s.direction,
                    score: s.score,
                    applesEaten: s.applesEaten,
                    buffs: s.buffs,
                    isAlive: s.isAlive,
                    isFrozen: s.isFrozen,
                    freezeTimer: s.freezeTimer
                })),
                redApple: this.redApple,
                goldApple: this.goldApple,
                goldAppleTimer: this.goldAppleTimer,
                goldAppleDespawnTimer: this.goldAppleDespawnTimer,
                lightningApple: this.lightningApple,
                lightningAppleSpawned: this.lightningAppleSpawned,
                shakeIntensity: this.shakeIntensity,
                lightningTimer: this.lightningTimer,
                vfxEvents: this.vfxEvents,
                floatingTexts: this.floatingTexts
            });
            this.vfxEvents = []; // Flush
        }
    }

    handleInput() {
        const s1 = this.snakes[0];
        const s2 = this.snakes[1];

        // Player 1 controls (WASD)
        let s1Confused = s1.buffs.confused > 0;
        let p1Up = s1Confused ? 's' : 'w';
        let p1Down = s1Confused ? 'w' : 's';
        let p1Left = s1Confused ? 'd' : 'a';
        let p1Right = s1Confused ? 'a' : 'd';

        if (this.keys[p1Up] && s1.direction !== 'down') s1.nextDirection = 'up';
        if (this.keys[p1Down] && s1.direction !== 'up') s1.nextDirection = 'down';
        if (this.keys[p1Left] && s1.direction !== 'right') s1.nextDirection = 'left';
        if (this.keys[p1Right] && s1.direction !== 'left') s1.nextDirection = 'right';

        // Player 2 controls (Arrow keys - only when not Bot or Online Client inputting)
        if (this.mode === 'local' || this.mode === 'online-host') {
            let s2Confused = s2.buffs.confused > 0;
            let p2Up = s2Confused ? 'arrowdown' : 'arrowup';
            let p2Down = s2Confused ? 'arrowup' : 'arrowdown';
            let p2Left = s2Confused ? 'arrowright' : 'arrowleft';
            let p2Right = s2Confused ? 'arrowleft' : 'arrowright';

            if (this.keys[p2Up] && s2.direction !== 'down') s2.nextDirection = 'up';
            if (this.keys[p2Down] && s2.direction !== 'up') s2.nextDirection = 'down';
            if (this.keys[p2Left] && s2.direction !== 'right') s2.nextDirection = 'left';
            if (this.keys[p2Right] && s2.direction !== 'left') s2.nextDirection = 'right';
        }
    }

    // GREEDY PATHFINDER CONTROLLER FOR BOT
    getBotNextDirection() {
        const bot = this.snakes[1];
        const opponent = this.snakes[0];
        if (!bot || !bot.isAlive) return;

        const head = bot.body[0];
        
        // 1. Locate nearest apple
        let targets = [];
        if (this.redApple) targets.push(this.redApple);
        if (this.goldApple) targets.push(this.goldApple);
        if (this.lightningApple) targets.push(this.lightningApple);
        
        let target = { x: this.cols / 2, y: this.rows / 2 };
        if (targets.length > 0) {
            let minDist = Infinity;
            targets.forEach(t => {
                const dist = Math.abs(t.x - head.x) + Math.abs(t.y - head.y);
                if (dist < minDist) {
                    minDist = dist;
                    target = t;
                }
            });
        }

        // 2. Evaluate directions
        const dirs = [
            { name: 'up', dx: 0, dy: -1 },
            { name: 'down', dx: 0, dy: 1 },
            { name: 'left', dx: -1, dy: 0 },
            { name: 'right', dx: 1, dy: 0 }
        ];

        let bestDir = bot.direction;
        let maxScore = -Infinity;

        const isSafe = (x, y) => {
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
                return bot.buffs.invincible > 0;
            }
            for (let seg of bot.body) {
                if (seg.x === x && seg.y === y) return bot.buffs.invincible > 0;
            }
            if (opponent && opponent.isAlive) {
                for (let seg of opponent.body) {
                    if (seg.x === x && seg.y === y) {
                        return bot.buffs.invincible > 0 || bot.buffs.ghost > 0;
                    }
                }
            }
            return true;
        };

        dirs.forEach(d => {
            // Prevent self 180 degrees turns
            if (
                (bot.direction === 'up' && d.name === 'down') ||
                (bot.direction === 'down' && d.name === 'up') ||
                (bot.direction === 'left' && d.name === 'right') ||
                (bot.direction === 'right' && d.name === 'left')
            ) {
                return;
            }

            const nextX = head.x + d.dx;
            const nextY = head.y + d.dy;
            
            let score = 0;
            
            if (!isSafe(nextX, nextY)) {
                score = -99999;
            } else {
                const dist = Math.abs(nextX - target.x) + Math.abs(nextY - target.y);
                score = -dist; // Closer has higher score (closer to 0)

                // Add tendency score to avoid wiggling
                if (d.name === bot.direction) {
                    score += 0.5;
                }
            }

            if (score > maxScore) {
                maxScore = score;
                bestDir = d.name;
            }
        });

        // 3. Automated ice shooting for bot
        if (bot.buffs.freezeReady > 0 && opponent && opponent.isAlive) {
            let shootLine = false;
            const opHead = opponent.body[0];
            if (bot.direction === 'up' && head.x === opHead.x && head.y > opHead.y) shootLine = true;
            if (bot.direction === 'down' && head.x === opHead.x && head.y < opHead.y) shootLine = true;
            if (bot.direction === 'left' && head.y === opHead.y && head.x > opHead.x) shootLine = true;
            if (bot.direction === 'right' && head.y === opHead.y && head.x < opHead.x) shootLine = true;
            
            if (shootLine && Math.random() > 0.6) {
                this.triggerAction(1); // bot shoots
            }
        }

        bot.nextDirection = bestDir;
    }

    triggerAction(playerIndex) {
        const snake = this.snakes[playerIndex];
        if (!snake || snake.buffs.freezeReady <= 0) return;

        // Sound cues
        if (this.mode === 'online-host') {
            this.vfxEvents.push({ type: 'shoot-ice', x: snake.body[0].x, y: snake.body[0].y });
        } else {
            audio.playShootIce();
            for (let i = 0; i < 8; i++) {
                particles.emitIceShards(snake.body[0].x * this.cellSize + this.cellSize/2, snake.body[0].y * this.cellSize + this.cellSize/2);
            }
        }
        
        const head = snake.body[0];
        let vx = 0, vy = 0;
        if (snake.direction === 'up') vy = -1;
        if (snake.direction === 'down') vy = 1;
        if (snake.direction === 'left') vx = -1;
        if (snake.direction === 'right') vx = 1;
        
        this.projectiles.push({
            x: head.x,
            y: head.y,
            vx: vx,
            vy: vy,
            owner: playerIndex,
            life: 3.0
        });

        snake.buffs.freezeReady = 0;
        this.addFloatingText(head.x * this.cellSize, head.y * this.cellSize, "ICE SHOT!", "#00f3ff");
    }

    updateProjectiles(dt) {
        const projectileSpeed = 22;
        this.projectiles.forEach(p => {
            p.x += p.vx * projectileSpeed * dt;
            p.y += p.vy * projectileSpeed * dt;
            p.life -= dt;

            // Ice trails
            if (this.mode !== 'online-client') {
                particles.emitIceShards(p.x * this.cellSize + this.cellSize/2, p.y * this.cellSize + this.cellSize/2);
            }

            const opponentIdx = p.owner === 0 ? 1 : 0;
            const opponent = this.snakes[opponentIdx];
            
            if (opponent && opponent.isAlive) {
                for (let segment of opponent.body) {
                    const dist = Math.hypot(p.x - segment.x, p.y - segment.y);
                    if (dist < 1.2) { // Hit!
                        opponent.freeze(3.5);
                        
                        if (this.mode === 'online-host') {
                            this.vfxEvents.push({ type: 'hit-ice', x: segment.x, y: segment.y });
                        } else {
                            audio.playFreezeHit();
                            this.shake(6);
                            particles.emitIceExplosion(segment.x * this.cellSize + this.cellSize/2, segment.y * this.cellSize + this.cellSize/2);
                        }

                        this.addFloatingText(segment.x * this.cellSize, segment.y * this.cellSize, "FROZEN!", "#00f3ff");
                        p.life = 0;
                        break;
                    }
                }
            }
        });

        this.projectiles = this.projectiles.filter(p => p.life > 0 && p.x >= 0 && p.x < this.cols && p.y >= 0 && p.y < this.rows);
    }

    spawnRedApple() {
        this.redApple = this.getRandomFreeGridCell();
    }

    spawnGoldApple(force = false) {
        if (this.goldApple && !force) return;
        this.goldApple = this.getRandomFreeGridCell();
        this.goldAppleDespawnTimer = 8.0;
        this.goldAppleTimer = 10.0;
        
        this.triggerAlert("GOLDEN APPLE SPAWNED!", "#ffd700", 1.0);
        
        if (this.mode === 'online-host') {
            this.vfxEvents.push({ type: 'eat-gold', x: this.goldApple.x, y: this.goldApple.y }); // Just play chime
        } else {
            audio.playEatGold();
        }
    }

    spawnLightningApple(force = false) {
        this.lightningApple = this.getRandomFreeGridCell();
        this.lightningAppleSpawned = true;
        this.triggerAlert("⚡ LIGHTNING APPLE SPAWNED! ⚡", "#00f3ff", 2.0);
        this.shake(8);

        if (this.mode === 'online-host') {
            this.vfxEvents.push({ type: 'eat-lightning', x: this.lightningApple.x, y: this.lightningApple.y });
        } else {
            audio.playLightning();
        }
        
        const meter = document.getElementById('lightning-bar-bg');
        if (meter) meter.classList.add('ready');
    }

    getRandomFreeGridCell() {
        let attempts = 0;
        while (attempts < 500) {
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);
            
            let collides = false;
            for (let snake of this.snakes) {
                if (snake && snake.body) {
                    for (let seg of snake.body) {
                        if (seg.x === x && seg.y === y) {
                            collides = true;
                            break;
                        }
                    }
                }
                if (collides) break;
            }

            if (this.redApple && this.redApple.x === x && this.redApple.y === y) collides = true;
            if (this.goldApple && this.goldApple.x === x && this.goldApple.y === y) collides = true;
            if (this.lightningApple && this.lightningApple.x === x && this.lightningApple.y === y) collides = true;

            if (!collides) {
                return {x, y};
            }
            attempts++;
        }
        return {x: 10, y: 10};
    }

    killSnake(index, reason) {
        const snake = this.snakes[index];
        if (!snake || !snake.isAlive) return;

        snake.isAlive = false;

        const head = snake.body[0];
        
        if (this.mode === 'online-host') {
            this.vfxEvents.push({ type: 'death', x: head.x, y: head.y, color: snake.color });
        } else {
            audio.playExplosion();
            particles.emitDeathExplosion(head.x * this.cellSize + this.cellSize/2, head.y * this.cellSize + this.cellSize/2, snake.color);
            this.shake(20);
        }

        const aliveCount = this.snakes.filter(s => s && s.isAlive).length;
        if (aliveCount <= 1) {
            if (this.mode === 'online-host') {
                this.vfxEvents.push({ type: 'gameover', reason: reason });
            }
            setTimeout(() => {
                this.endGame(reason);
            }, 1000);
        }
    }

    endGame(reason) {
        this.state = 'gameover';
        
        const s1 = this.snakes[0];
        const s2 = this.snakes[1];

        // Determine winner details
        let winnerText = "DRAW MATCH!";
        if (s1.isAlive && (!s2 || !s2.isAlive)) {
            winnerText = this.mode === 'bot' ? "YOU WIN!" : "PLAYER 1 WINS!";
        } else if (s2 && s2.isAlive && !s1.isAlive) {
            winnerText = this.mode === 'bot' ? "BOT WINS!" : "PLAYER 2 WINS!";
        } else if (s1 && s2) {
            if (s1.score > s2.score) winnerText = this.mode === 'bot' ? "YOU WIN (HIGHER SCORE)!" : "PLAYER 1 WINS (HIGHER SCORE)!";
            else if (s2.score > s1.score) winnerText = this.mode === 'bot' ? "BOT WINS (HIGHER SCORE)!" : "PLAYER 2 WINS (HIGHER SCORE)!";
        }

        document.getElementById('winner-text').innerText = winnerText;
        document.getElementById('death-reason').innerText = reason;

        // Sync match result stats
        const p1Title = document.getElementById('r-p1-title');
        const p2Title = document.getElementById('r-p2-title');
        if (this.mode === 'bot') {
            p1Title.innerText = "PLAYER";
            p2Title.innerText = "BOT AI";
        } else {
            p1Title.innerText = "PLAYER 1";
            p2Title.innerText = "PLAYER 2";
        }

        document.getElementById('r-p1-len').innerText = s1.body.length;
        document.getElementById('r-p1-apples').innerText = s1.score;
        document.getElementById('r-p1-maxlen').innerText = s1.maxLength;

        if (s2) {
            document.getElementById('r-p2-len').innerText = s2.body.length;
            document.getElementById('r-p2-apples').innerText = s2.score;
            document.getElementById('r-p2-maxlen').innerText = s2.maxLength;
        }

        // Hide/Show rematch buttons for Client
        const rematchBtn = document.getElementById('btn-rematch');
        if (this.mode === 'online-client') {
            rematchBtn.classList.add('hidden');
        } else {
            rematchBtn.classList.remove('hidden');
        }

        this.updateMobileControlsVisibility();
        this.showScreen('gameover');
    }

    shake(amount) {
        this.shakeIntensity = Math.min(25, this.shakeIntensity + amount);
    }

    triggerAlert(text, color = '#fff', duration = 1.5) {
        const alertEl = document.getElementById('alert-text');
        if (!alertEl) return;
        
        alertEl.innerText = text;
        alertEl.style.color = color;
        alertEl.style.textShadow = `0 0 10px ${color}, 0 4px 10px rgba(0,0,0,0.8)`;
        
        alertEl.classList.add('show');
        
        if (this.alertTimeout) clearTimeout(this.alertTimeout);
        this.alertTimeout = setTimeout(() => {
            alertEl.classList.remove('show');
        }, duration * 1000);
    }

    addFloatingText(x, y, text, color = '#fff') {
        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 1.2
        });
    }

    updateHUD() {
        const s1 = this.snakes[0];
        const s2 = this.snakes[1];
        if (!s1) return;

        // Player 1 HUD
        document.getElementById('p1-score').innerText = s1.score;
        document.getElementById('p1-len').innerText = s1.body.length;
        this.renderBuffTray(0, s1.buffs);

        // Player 2 HUD
        if (s2) {
            document.getElementById('p2-score').innerText = s2.score;
            document.getElementById('p2-len').innerText = s2.body.length;
            this.renderBuffTray(1, s2.buffs);
        }

        // Apple Golden timer label
        const goldTimerVal = document.getElementById('gold-timer-val');
        if (goldTimerVal) {
            if (this.goldApple) {
                goldTimerVal.innerText = `DESPAWNING IN: ${this.goldAppleDespawnTimer.toFixed(1)}s`;
                goldTimerVal.style.color = '#ff5b00';
            } else {
                goldTimerVal.innerText = `${this.goldAppleTimer.toFixed(1)}s`;
                goldTimerVal.style.color = '#ffd700';
            }
        }
    }

    renderBuffTray(playerIdx, buffs) {
        const tray = document.getElementById(playerIdx === 0 ? 'p1-buffs' : 'p2-buffs');
        if (!tray) return;
        tray.innerHTML = '';

        const buffList = [
            { name: 'invincible', label: '🛡️', color: 'invincible', max: 8.0 },
            { name: 'ghost', label: '👻', color: 'ghost', max: 8.0 },
            { name: 'speed', label: '🔥', color: 'speed', max: 6.0 },
            { name: 'giant', label: '🌟', color: 'giant', max: 8.0 },
            { name: 'freezeReady', label: '❄️', color: 'freeze', max: 2.0 },
            { name: 'confused', label: '🌀', color: 'confused', max: 5.0 }
        ];

        buffList.forEach(b => {
            const val = buffs[b.name];
            if (val > 0) {
                const badge = document.createElement('div');
                badge.className = `buff-badge ${b.color}`;
                badge.innerHTML = b.label;

                const cooldown = document.createElement('div');
                cooldown.className = 'cooldown-overlay';
                const pct = (val / b.max) * 100;
                cooldown.style.width = `${pct}%`;
                badge.appendChild(cooldown);

                tray.appendChild(badge);
            }
        });
    }

    updateLightningMeter() {
        const s1 = this.snakes[0];
        const s2 = this.snakes[1];
        
        const maxScore = Math.max(s1 ? s1.applesEaten : 0, s2 ? s2.applesEaten : 0);
        const fill = document.getElementById('lightning-fill');
        const text = document.getElementById('lightning-text');
        
        if (fill && text) {
            const pct = Math.min(100, (maxScore / 150) * 100);
            fill.style.width = `${pct}%`;
            text.innerText = `${maxScore} / 150`;

            if (maxScore >= 150) {
                document.getElementById('lightning-bar-bg').classList.add('ready');
            } else {
                document.getElementById('lightning-bar-bg').classList.remove('ready');
            }
        }
    }

    draw() {
        this.ctx.fillStyle = '#060511';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid lines background
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        this.ctx.lineWidth = 1;
        for (let c = 0; c <= this.cols; c++) {
            this.ctx.beginPath();
            this.ctx.moveTo(c * this.cellSize, 0);
            this.ctx.lineTo(c * this.cellSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let r = 0; r <= this.rows; r++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, r * this.cellSize);
            this.ctx.lineTo(this.canvas.width, r * this.cellSize);
            this.ctx.stroke();
        }

        this.ctx.save();
        if (this.shakeIntensity > 0.1) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(dx, dy);
        }

        // Lightning screen flash
        if (this.lightningTimer > 0) {
            this.ctx.fillStyle = `rgba(0, 243, 255, ${this.lightningTimer * 0.4})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Draw normal apple
        if (this.redApple) {
            this.drawApple(this.redApple.x, this.redApple.y, '#ff1a1a', true);
            if (this.mode !== 'online-client' && Math.random() > 0.8) {
                particles.emitDust(this.redApple.x * this.cellSize + this.cellSize/2, this.redApple.y * this.cellSize + this.cellSize/2, '#ff5b5b');
            }
        }

        // Draw Gold Apple
        if (this.goldApple) {
            const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
            this.drawApple(this.goldApple.x, this.goldApple.y, '#ffd700', true, pulse);
            if (this.mode !== 'online-client') {
                particles.emitGoldSparks(this.goldApple.x * this.cellSize + this.cellSize/2, this.goldApple.y * this.cellSize + this.cellSize/2);
            }
        }

        // Draw Lightning Apple
        if (this.lightningApple) {
            const pulse = 1 + Math.sin(Date.now() / 100) * 0.2;
            this.drawApple(this.lightningApple.x, this.lightningApple.y, '#00f3ff', true, pulse, true);
            if (this.mode !== 'online-client') {
                particles.emitElectricSparks(this.lightningApple.x * this.cellSize + this.cellSize/2, this.lightningApple.y * this.cellSize + this.cellSize/2);
            }
        }

        // Draw Projectiles
        this.projectiles.forEach(p => {
            this.ctx.save();
            this.ctx.fillStyle = '#bceeff';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#00f3ff';
            this.ctx.beginPath();
            this.ctx.arc(p.x * this.cellSize + this.cellSize/2, p.y * this.cellSize + this.cellSize/2, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Draw Snakes
        this.snakes.forEach(snake => {
            if (snake && snake.isAlive && snake.body.length > 0) {
                snake.draw(this.ctx, this.cellSize);
            }
        });

        // Draw Particles
        particles.draw(this.ctx);

        // Draw Floating texts
        this.ctx.save();
        this.ctx.font = `bold 9px 'Outfit'`;
        this.ctx.textAlign = 'center';
        this.floatingTexts.forEach(ft => {
            this.ctx.fillStyle = ft.color;
            this.ctx.globalAlpha = ft.life;
            this.ctx.shadowBlur = 6;
            this.ctx.shadowColor = ft.color;
            this.ctx.fillText(ft.text, ft.x, ft.y);
        });
        this.ctx.restore();

        this.ctx.restore();
    }

    drawApple(gx, gy, color, leaf = true, scale = 1.0, electric = false) {
        const cx = gx * this.cellSize + this.cellSize / 2;
        const cy = gy * this.cellSize + this.cellSize / 2;
        const r = (this.cellSize / 2) * 0.8 * scale;

        this.ctx.save();
        this.ctx.shadowBlur = electric ? 15 : 10;
        this.ctx.shadowColor = color;
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(cx - r/4, cy, r, 0, Math.PI * 2);
        this.ctx.arc(cx + r/4, cy, r, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#8b5a2b';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - r/2);
        this.ctx.quadraticCurveTo(cx + 2, cy - r - 2, cx + 4, cy - r - 3);
        this.ctx.stroke();

        if (leaf) {
            this.ctx.fillStyle = '#00cc44';
            this.ctx.beginPath();
            this.ctx.ellipse(cx + 2, cy - r - 2, 2, 4, Math.PI / 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }
}

class Snake {
    constructor(id, body, initialDirection, color) {
        this.id = id;
        this.body = body;
        this.direction = initialDirection;
        this.nextDirection = initialDirection;
        this.color = color;
        this.score = 0;
        this.applesEaten = 0;
        this.maxLength = body.length;
        this.isAlive = true;
        this.moveTimer = 0;
        
        this.isFrozen = false;
        this.freezeTimer = 0;

        this.buffs = {
            invincible: 0,
            ghost: 0,
            speed: 0,
            giant: 0,
            freezeReady: 0,
            confused: 0
        };
    }

    getMoveSpeed() {
        if (this.isFrozen) return 99999;
        if (this.buffs.speed > 0) return 0.055; // 2x Speed
        return 0.095; // Normal speed
    }

    freeze(duration) {
        this.isFrozen = true;
        this.freezeTimer = duration;
        this.buffs.speed = 0; // Cancel speed
    }

    update(dt, game) {
        // Decay buffs
        for (let b in this.buffs) {
            if (this.buffs[b] > 0) {
                this.buffs[b] -= dt;
                if (this.buffs[b] < 0) this.buffs[b] = 0;
            }
        }

        // Decay freeze duration
        if (this.isFrozen) {
            this.freezeTimer -= dt;
            if (game.mode !== 'online-host') {
                particles.emitIceShards(this.body[0].x * game.cellSize + game.cellSize/2, this.body[0].y * game.cellSize + game.cellSize/2);
            }
            if (this.freezeTimer <= 0) {
                this.isFrozen = false;
                this.freezeTimer = 0;
            }
        }

        // Move steps tick
        this.moveTimer += dt;
        if (this.moveTimer >= this.getMoveSpeed()) {
            this.moveTimer = 0;
            if (!this.isFrozen) {
                this.move(game);
            }
        }
    }

    move(game) {
        this.direction = this.nextDirection;
        
        const head = this.body[0];
        let nextX = head.x;
        let nextY = head.y;

        if (this.direction === 'up') nextY--;
        if (this.direction === 'down') nextY++;
        if (this.direction === 'left') nextX--;
        if (this.direction === 'right') nextX++;

        const tail = this.body[this.body.length - 1];
        if (game.mode !== 'online-host') {
            particles.emitDust(
                tail.x * game.cellSize + game.cellSize/2, 
                tail.y * game.cellSize + game.cellSize/2, 
                this.buffs.speed > 0 ? '#ffaa00' : this.color
            );
        }

        // Wall collisions
        if (nextX < 0 || nextX >= game.cols || nextY < 0 || nextY >= game.rows) {
            if (this.buffs.invincible > 0) {
                if (nextX < 0) nextX = game.cols - 1;
                else if (nextX >= game.cols) nextX = 0;
                else if (nextY < 0) nextY = game.rows - 1;
                else if (nextY >= game.rows) nextY = 0;
                game.shake(2);
            } else {
                game.killSnake(this.id, `Player ${this.id + 1} menabrak tembok!`);
                return;
            }
        }

        // Body collisions check
        const hitInfo = this.checkSnakeCollisions(nextX, nextY, game);
        if (hitInfo.collision) {
            if (this.buffs.invincible > 0) {
                game.shake(1);
            } else if (this.buffs.ghost > 0) {
                // pass through safely
            } else {
                game.killSnake(this.id, hitInfo.reason);
                return;
            }
        }

        const newHead = { x: nextX, y: nextY };
        this.body.unshift(newHead);

        // Check eating normal apple
        if (game.redApple && nextX === game.redApple.x && nextY === game.redApple.y) {
            if (game.mode === 'online-host') {
                game.vfxEvents.push({ type: 'eat-red', x: nextX, y: nextY, color: this.color });
            } else {
                audio.playEatRed();
                particles.emitEatSparkles(nextX * game.cellSize + game.cellSize/2, nextY * game.cellSize + game.cellSize/2, this.color);
            }
            
            this.score += 1;
            this.applesEaten += 1;
            game.updateLightningMeter();
            game.spawnRedApple();
            game.shake(1);
            game.addFloatingText(nextX * game.cellSize, nextY * game.cellSize, "+1", '#fff');
            
            if (this.body.length > this.maxLength) this.maxLength = this.body.length;
        } 
        // Check eating Gold Apple
        else if (game.goldApple && nextX === game.goldApple.x && nextY === game.goldApple.y) {
            this.eatGoldApple(game);
        }
        // Check eating Lightning Apple
        else if (game.lightningApple && nextX === game.lightningApple.x && nextY === game.lightningApple.y) {
            this.eatLightningApple(game);
        }
        // Shift tail
        else {
            this.body.pop();
        }
    }

    checkSnakeCollisions(x, y, game) {
        for (let i = 1; i < this.body.length; i++) {
            if (this.body[i].x === x && this.body[i].y === y) {
                return { collision: true, reason: `Player ${this.id + 1} menabrak tubuh sendiri!` };
            }
        }

        const opponentIdx = this.id === 0 ? 1 : 0;
        const opponent = game.snakes[opponentIdx];
        if (opponent && opponent.isAlive) {
            for (let i = 0; i < opponent.body.length; i++) {
                if (opponent.body[i].x === x && opponent.body[i].y === y) {
                    if (i === 0) {
                        return { collision: true, reason: `Tabrakan adu kepala (Head-on) antara Player 1 & 2!` };
                    }
                    return { collision: true, reason: `Player ${this.id + 1} menabrak tubuh Player ${opponentIdx + 1}!` };
                }
            }
        }

        return { collision: false };
    }

    eatGoldApple(game) {
        const cellX = this.body[0].x * game.cellSize;
        const cellY = this.body[0].y * game.cellSize;

        if (game.mode === 'online-host') {
            game.vfxEvents.push({ type: 'eat-gold', x: game.goldApple.x, y: game.goldApple.y });
        } else {
            audio.playEatGold();
            particles.emitEatSparkles(game.goldApple.x * game.cellSize + game.cellSize/2, game.goldApple.y * game.cellSize + game.cellSize/2, '#ffd700');
        }

        game.goldApple = null;
        game.goldAppleTimer = 10.0;
        game.shake(4);

        const buffsList = ['invincible', 'ghost', 'giant', 'speed', 'freeze', 'confuse'];
        const chosenBuff = buffsList[Math.floor(Math.random() * buffsList.length)];

        if (chosenBuff === 'invincible') {
            this.buffs.invincible = 8.0;
            game.addFloatingText(cellX, cellY, "🛡️ INVINCIBLE!", "#ffd700");
        } else if (chosenBuff === 'ghost') {
            this.buffs.ghost = 8.0;
            game.addFloatingText(cellX, cellY, "👻 GHOST MODE!", "#b600ff");
        } else if (chosenBuff === 'giant') {
            this.buffs.giant = 8.0;
            for (let i = 0; i < 10; i++) {
                const tail = this.body[this.body.length - 1] || this.body[0];
                this.body.push({ x: tail.x, y: tail.y });
            }
            game.addFloatingText(cellX, cellY, "🌟 GIANT SIZE (+10)!", "#00ff88");
        } else if (chosenBuff === 'speed') {
            this.buffs.speed = 6.0;
            game.addFloatingText(cellX, cellY, "🔥 SPEED BOOST!", "#ff5b00");
        } else if (chosenBuff === 'freeze') {
            this.buffs.freezeReady = 2.0;
            game.addFloatingText(cellX, cellY, "❄️ FREEZE READY (2s)!", "#00f3ff");
            game.triggerAlert(`PLAYER ${this.id + 1} DAPAT SIHIR BEKU!`, "#00f3ff", 1.5);
        } else if (chosenBuff === 'confuse') {
            const opponentIdx = this.id === 0 ? 1 : 0;
            const opponent = game.snakes[opponentIdx];
            
            if (opponent) {
                opponent.buffs.confused = 5.0;
                game.addFloatingText(opponent.body[0].x * game.cellSize, opponent.body[0].y * game.cellSize, "🌀 CONFUSED!", "#ff00ff");
                game.addFloatingText(cellX, cellY, "SPELL: KONTROL TERBALIK!", "#ff00ff");
            }
        }

        if (this.body.length > this.maxLength) this.maxLength = this.body.length;
    }

    eatLightningApple(game) {
        const eatX = game.lightningApple.x * game.cellSize + game.cellSize/2;
        const eatY = game.lightningApple.y * game.cellSize + game.cellSize/2;

        if (game.mode === 'online-host') {
            game.vfxEvents.push({ type: 'eat-lightning', x: game.lightningApple.x, y: game.lightningApple.y });
        } else {
            audio.playLightning();
            particles.emitEatSparkles(eatX, eatY, '#00f3ff');
        }

        game.lightningApple = null;
        game.lightningAppleSpawned = false;
        game.shake(12);
        game.lightningTimer = 0.5;

        const opponentIdx = this.id === 0 ? 1 : 0;
        const opponent = game.snakes[opponentIdx];

        // Reset counts
        this.applesEaten = 0;
        if (opponent) opponent.applesEaten = 0;
        game.updateLightningMeter();
        document.getElementById('lightning-bar-bg').classList.remove('ready');

        if (opponent && opponent.isAlive) {
            const head = this.body[0];
            const hx = head.x * game.cellSize + game.cellSize/2;
            const hy = head.y * game.cellSize + game.cellSize/2;

            // Transmit lightning strike paths
            opponent.body.forEach((seg, idx) => {
                if (idx % 4 === 0) {
                    const tx = seg.x * game.cellSize + game.cellSize/2;
                    const ty = seg.y * game.cellSize + game.cellSize/2;
                    
                    if (game.mode === 'online-host') {
                        game.vfxEvents.push({ type: 'lightning-bolt', sx: hx, sy: hy, tx: tx, ty: ty });
                    } else {
                        setTimeout(() => {
                            particles.createLightning(hx, hy, tx, ty, '#00f3ff');
                        }, idx * 10);
                    }
                }
            });

            // Set Opponent Stun/Shrink
            opponent.freeze(1.5);
            
            if (game.mode === 'online-host') {
                game.vfxEvents.push({ type: 'hit-ice', x: opponent.body[0].x, y: opponent.body[0].y });
            } else {
                particles.emitIceExplosion(opponent.body[0].x * game.cellSize + game.cellSize/2, opponent.body[0].y * game.cellSize + game.cellSize/2);
            }

            const shrinkAmount = Math.max(3, Math.floor(opponent.body.length * 0.3));
            for (let i = 0; i < shrinkAmount; i++) {
                if (opponent.body.length > 3) {
                    const popped = opponent.body.pop();
                    if (game.mode === 'online-host') {
                        game.vfxEvents.push({ type: 'death', x: popped.x, y: popped.y, color: opponent.color });
                    } else {
                        particles.emitDeathExplosion(popped.x * game.cellSize + game.cellSize/2, popped.y * game.cellSize + game.cellSize/2, opponent.color);
                    }
                }
            }

            game.addFloatingText(hx, hy, "LIGHTNING STORM!", "#00f3ff");
            game.addFloatingText(opponent.body[0].x * game.cellSize, opponent.body[0].y * game.cellSize, `SHOCKED! -${shrinkAmount} SEG`, "#ff0077");
        }

        game.triggerAlert("⚡ LIGHTNING BOLT STRIKE! ⚡", "#00f3ff", 2.0);
    }

    draw(ctx, cellSize) {
        ctx.save();
        const length = this.body.length;

        // Draw body segments (tail first)
        for (let i = length - 1; i >= 0; i--) {
            const seg = this.body[i];
            if (!seg) continue;
            
            const isHead = (i === 0);

            const isGiant = this.buffs.giant > 0;
            const giantFactor = isGiant ? 1.4 : 1.0;
            const sizePercent = 1 - (i / length) * 0.45;
            const r = (cellSize / 2) * sizePercent * giantFactor;

            const cx = seg.x * cellSize + cellSize / 2;
            const cy = seg.y * cellSize + cellSize / 2;

            if (this.buffs.invincible > 0) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffd700';
            } else if (this.buffs.ghost > 0) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#b600ff';
                ctx.globalAlpha = 0.55;
            } else if (this.buffs.speed > 0) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ffaa00';
            } else {
                ctx.shadowBlur = 6;
                ctx.shadowColor = this.color;
            }

            ctx.fillStyle = isHead ? '#ffffff' : this.color;
            if (this.buffs.invincible > 0 && !isHead) {
                ctx.fillStyle = '#ffd700';
            }

            ctx.beginPath();
            if (isHead) {
                ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
            } else {
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
            }
            ctx.fill();

            // Head details (Eyes)
            if (isHead) {
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1.0;
                
                const eyeOffset = r * 0.45;
                const eyeSize = r * 0.28;
                let ex1 = 0, ey1 = 0, ex2 = 0, ey2 = 0;

                if (this.direction === 'up') {
                    ex1 = cx - eyeOffset; ey1 = cy - eyeOffset;
                    ex2 = cx + eyeOffset; ey2 = cy - eyeOffset;
                } else if (this.direction === 'down') {
                    ex1 = cx - eyeOffset; ey1 = cy + eyeOffset;
                    ex2 = cx + eyeOffset; ey2 = cy + eyeOffset;
                } else if (this.direction === 'left') {
                    ex1 = cx - eyeOffset; ey1 = cy - eyeOffset;
                    ex2 = cx - eyeOffset; ey2 = cy + eyeOffset;
                } else if (this.direction === 'right') {
                    ex1 = cx + eyeOffset; ey1 = cy - eyeOffset;
                    ex2 = cx + eyeOffset; ey2 = cy + eyeOffset;
                }

                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
                ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                if (this.isFrozen) ctx.fillStyle = '#00f3ff';
                
                if (this.buffs.confused > 0) {
                    ctx.strokeStyle = '#ff00ff';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(ex1 - 2, ey1 - 2); ctx.lineTo(ex1 + 2, ey1 + 2);
                    ctx.moveTo(ex1 + 2, ey1 - 2); ctx.lineTo(ex1 - 2, ey1 + 2);
                    ctx.moveTo(ex2 - 2, ey2 - 2); ctx.lineTo(ex2 + 2, ey2 + 2);
                    ctx.moveTo(ex2 + 2, ey2 - 2); ctx.lineTo(ex2 - 2, ey2 + 2);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(ex1, ey1, eyeSize * 0.4, 0, Math.PI * 2);
                    ctx.arc(ex2, ey2, eyeSize * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Ice freeze visual block
            if (this.isFrozen) {
                ctx.save();
                ctx.fillStyle = 'rgba(0, 243, 255, 0.4)';
                ctx.strokeStyle = '#d0f5ff';
                ctx.lineWidth = 1;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#00f3ff';
                ctx.beginPath();
                ctx.rect(cx - r - 2, cy - r - 2, (r + 2) * 2, (r + 2) * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }
        ctx.restore();
    }
}

// TIMING FIX: Ensures engine instantiates regardless of how fast DOM reports readyState
function initGame() {
    if (!window.game) {
        const game = new Game();
        window.game = game;
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
