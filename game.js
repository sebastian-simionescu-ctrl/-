const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAP_W = 2000;
const MAP_H = 1400;

const cw = canvas.width;
const ch = canvas.height;

const logsEl = document.getElementById('logs');

function log(msg) {
  const line = document.createElement('div');
  line.textContent = msg;
  logsEl.prepend(line);
  while (logsEl.children.length > 80) logsEl.removeChild(logsEl.lastChild);
}

const players = [
  {
    id: 1,
    x: 200,
    y: 200,
    w: 28,
    h: 36,
    color: '#4caf50',
    speed: 2.6,
    hp: 100,
    inv: { wood: 0, stone: 0 },
    controls: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyF', gather: 'KeyE' },
    attackCooldown: 0,
    hasSword: false,
  },
  {
    id: 2,
    x: 400,
    y: 320,
    w: 28,
    h: 36,
    color: '#e91e63',
    speed: 2.4,
    hp: 100,
    inv: { wood: 0, stone: 0 },
    controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', attack: 'KeyL', gather: 'KeyK' },
    attackCooldown: 0,
    hasSword: false,
  },
];

let nodes = [];
let lastNodeSpawn = 0;

const keys = {};

function spawnNode() {
  const t = Math.random() < 0.6 ? 'tree' : 'rock';
  nodes.push({
    type: t,
    x: Math.random() * (MAP_W - 120) + 60,
    y: Math.random() * (MAP_H - 120) + 60,
    amount: t === 'tree' ? 4 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3),
  });
}

for (let i = 0; i < 18; i++) spawnNode();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.hypot(dx, dy); }

function update(dt) {
  // spawn nodes occasionally
  lastNodeSpawn += dt;
  if (lastNodeSpawn > 2500) { lastNodeSpawn = 0; if (nodes.length < 40) spawnNode(); }

  players.forEach((p) => {
    // movement
    let vx = 0, vy = 0;
    if (keys[p.controls.left]) vx -= 1;
    if (keys[p.controls.right]) vx += 1;
    if (keys[p.controls.up]) vy -= 1;
    if (keys[p.controls.down]) vy += 1;
    if (vx !== 0 || vy !== 0) {
      const mag = Math.hypot(vx, vy) || 1;
      p.x += (vx / mag) * p.speed * (dt / 16);
      p.y += (vy / mag) * p.speed * (dt / 16);
    }
    p.x = clamp(p.x, 8, MAP_W - 8);
    p.y = clamp(p.y, 8, MAP_H - 8);

    // gather
    if (keys[p.controls.gather]) {
      nodes.forEach((n, i) => {
        const nodeRect = { x: n.x - 12, y: n.y - 12, w: 24, h: 24 };
        const pRect = { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h };
        if (rectCollide(pRect, nodeRect)) {
          // collect
          if (n.amount > 0) {
            const gain = 1;
            if (n.type === 'tree') p.inv.wood += gain;
            else p.inv.stone += gain;
            n.amount -= 1;
            log(`P${p.id} collected 1 ${n.type}`);
          }
        }
      });
      nodes = nodes.filter(n => n.amount > 0);
      // avoid holding gather key repeatedly causing too-fast collection (simple debounce)
      keys[p.controls.gather] = false;
    }

    // attack
    if (keys[p.controls.attack] && p.attackCooldown <= 0) {
      p.attackCooldown = 400; // ms
      const range = 36;
      const damage = p.hasSword ? 40 : 18;
      players.forEach((other) => {
        if (other === p) return;
        const d = Math.hypot(p.x - other.x, p.y - other.y);
        if (d < range) {
          other.hp -= damage;
          log(`P${p.id} hit P${other.id} for ${damage}`);
          if (other.hp <= 0) {
            log(`P${other.id} died and dropped resources`);
            // drop some resources
            for (let j=0;j<3;j++) spawnNode();
            other.hp = 60; // respawn with partial HP
            other.x = Math.random() * 200 + 120;
            other.y = Math.random() * 200 + 120;
          }
        }
      });
      keys[p.controls.attack] = false;
    }

    p.attackCooldown -= dt;
  });
}

function rectCollide(a, b) {
  return a.x < b.x + (b.w||b.width) && a.x + (a.w||a.width) > b.x && a.y < b.y + (b.h||b.height) && a.y + (a.h||a.height) > b.y;
}

function draw() {
  // camera center between players
  const cx = (players[0].x + players[1].x) / 2;
  const cy = (players[0].y + players[1].y) / 2;
  const camX = clamp(cx - cw/2, 0, MAP_W - cw);
  const camY = clamp(cy - ch/2, 0, MAP_H - ch);

  // sky
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, cw, ch);

  // ground grid
  ctx.save();
  ctx.translate(-camX, -camY);
  ctx.fillStyle = '#0c1a12';
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  for (let x = 0; x < MAP_W; x += 64) {
    ctx.fillStyle = x % 128 === 0 ? '#073018' : '#062614';
    ctx.fillRect(x, 0, 2, MAP_H);
  }

  // nodes
  nodes.forEach((n) => {
    if (n.type === 'tree') {
      ctx.fillStyle = '#2e8b57';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 14, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#6b8e23';
      ctx.fillText(n.amount, n.x-4, n.y+4);
    } else {
      ctx.fillStyle = '#8b7d6b';
      ctx.fillRect(n.x-10, n.y-8, 20, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(n.amount, n.x-4, n.y+4);
    }
  });

  // players
  players.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.w/2, p.y - p.h/2, p.w, p.h);
    // HP bar
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x-20, p.y - p.h/2 - 10, 40, 6);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(p.x-20, p.y - p.h/2 - 10, 40 * clamp(p.hp/100,0,1), 6);
    if (p.hasSword) {
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(p.x + p.w/2, p.y - 4, 8, 3);
    }
  });

  ctx.restore();

  // HUD overlay
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('Map: ' + MAP_W + 'x' + MAP_H, 12, 18);
}

function updateHUD() {
  const p1Hp = document.getElementById('p1Hp');
  const p2Hp = document.getElementById('p2Hp');
  const p1Inv = document.getElementById('p1Inv');
  const p2Inv = document.getElementById('p2Inv');
  p1Hp.textContent = Math.max(0, Math.floor(players[0].hp));
  p2Hp.textContent = Math.max(0, Math.floor(players[1].hp));
  p1Inv.innerHTML = '';
  p2Inv.innerHTML = '';
  Object.entries(players[0].inv).forEach(([k,v]) => { const li = document.createElement('li'); li.textContent = `${k}: ${v}`; p1Inv.appendChild(li); });
  Object.entries(players[1].inv).forEach(([k,v]) => { const li = document.createElement('li'); li.textContent = `${k}: ${v}`; p2Inv.appendChild(li); });
}

document.getElementById('p1CraftSword').addEventListener('click', () => craft(0));
document.getElementById('p2CraftSword').addEventListener('click', () => craft(1));

function craft(playerIndex) {
  const p = players[playerIndex];
  if (p.inv.wood >= 5 && p.inv.stone >= 2) {
    p.inv.wood -= 5; p.inv.stone -= 2; p.hasSword = true; log(`P${p.id} crafted a Sword`);
  } else {
    log(`P${p.id} lacks resources to craft`);
  }
  updateHUD();
}

let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime; lastTime = now;
  update(dt);
  draw();
  updateHUD();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// make canvas focusable and click to focus
canvas.tabIndex = 0;
canvas.addEventListener('click', () => canvas.focus());

log('Game loaded — collect resources, craft swords, and duel!');
requestAnimationFrame(loop);