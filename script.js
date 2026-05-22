// Core game logic for the 2D combat RPG.
// This script creates the player, world, combat manager, and UI bindings.

class Item {
  constructor({ id, name, type, slot, value = {}, effect = {}, price = 0 }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.slot = slot;
    this.value = value;
    this.effect = effect;
    this.price = price;
  }

  label() {
    return `${this.name}${this.slot ? ` (${this.slot})` : ''}`;
  }
}

class Skill {
  constructor({ id, name, description, power, cooldown, effect }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.power = power;
    this.cooldown = cooldown;
    this.effect = effect;
    this.currentCooldown = 0;
  }

  canUse() {
    return this.currentCooldown === 0;
  }

  use() {
    this.currentCooldown = this.cooldown;
  }

  tickCooldown() {
    if (this.currentCooldown > 0) {
      this.currentCooldown -= 1;
    }
  }
}

class Player {
  constructor() {
    this.name = 'Hero';
    this.level = 1;
    this.xp = 0;
    this.gold = 50;
    this.maxHp = 120;
    this.hp = this.maxHp;
    this.attack = 18;
    this.defense = 12;
    this.speed = 14;
    this.inventory = {
      potion: 3,
      ether: 1,
    };
    this.equipment = {
      weapon: null,
      armor: null,
    };
    this.skills = SKILLS.map(skillData => new Skill(skillData));
    this.statusEffects = [];
  }

  get weapon() {
    return this.equipment.weapon || null;
  }

  get attackValue() {
    return this.attack;
  }

  get defenseValue() {
    let bonus = 0;
    if (this.equipment.armor) bonus += this.equipment.armor.value.defense || 0;
    return this.defense + bonus;
  }

  get speedValue() {
    return this.speed;
  }

  get critChance() {
    const weapon = this.weapon;
    if (!weapon) return 0.08;
    return Math.min(0.4, weapon.critChance || 0.08);
  }

  calculateWeaponDamage() {
    if (!this.weapon) {
      return this.attack;
    }

    const [min, max] = this.weapon.damage;
    const weaponDamage = Math.floor(min + Math.random() * (max - min + 1));
    return this.attack + weaponDamage;
  }

  isAlive() {
    return this.hp > 0;
  }

  addItem(itemId, amount = 1) {
    this.inventory[itemId] = (this.inventory[itemId] || 0) + amount;
  }

  useItem(itemId, target) {
    if (!this.inventory[itemId] || this.inventory[itemId] <= 0) {
      return `${itemId} is not available.`;
    }

    const itemData = ITEMS.find(item => item.id === itemId);
    if (!itemData) return 'Unknown item.';

    this.inventory[itemId] -= 1;

    if (itemData.effect.hp) {
      const heal = Math.min(itemData.effect.hp, this.maxHp - this.hp);
      this.hp += heal;
      return `${this.name} uses ${itemData.name} and recovers ${heal} HP.`;
    }

    if (itemData.effect.status) {
      target.addStatus(itemData.effect.status);
      return `${this.name} uses ${itemData.name} and inflicts ${itemData.effect.status.type}.`;
    }

    return `${itemData.name} had no effect.`;
  }

  equipItem(itemId) {
    const itemData = ITEMS.find(item => item.id === itemId && item.slot);
    if (itemData) {
      this.equipment[itemData.slot] = itemData;
      return true;
    }

    const weaponData = WEAPONS.find(weapon => weapon.id === itemId);
    if (weaponData) {
      this.equipment.weapon = weaponData;
      return true;
    }

    return false;
  }

  receiveDamage(amount) {
    const damageTaken = Math.max(0, amount);
    this.hp = Math.max(0, this.hp - damageTaken);
    return damageTaken;
  }

  hasStatus(type) {
    return this.statusEffects.some(status => status.type === type);
  }

  removeStatus(type) {
    this.statusEffects = this.statusEffects.filter(status => status.type !== type);
  }

  addStatus(status) {
    this.statusEffects.push({ ...status });
  }

  tickStatuses() {
    const results = [];
    this.statusEffects = this.statusEffects.filter(status => {
      if (status.type === 'poison' || status.type === 'bleed') {
        const damage = Math.min(8, status.strength);
        this.hp = Math.max(0, this.hp - damage);
        results.push(`${this.name} suffers ${damage} ${status.type} damage.`);
      } else if (status.type === 'burn') {
        const damage = Math.min(6, status.strength);
        this.hp = Math.max(0, this.hp - damage);
        results.push(`${this.name} takes ${damage} burn damage.`);
      } else if (status.type === 'stun') {
        results.push(`${this.name} is stunned and cannot act.`);
        return true;
      } else if (status.type === 'armor_break') {
        results.push(`${this.name}'s armor is weakened.`);
      }

      status.duration -= 1;
      return status.duration > 0;
    });
    return results;
  }
}

class Enemy {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.maxHp = data.hp;
    this.hp = data.hp;
    this.attack = data.attack;
    this.defense = data.defense;
    this.speed = data.speed;
    this.xpReward = data.xpReward;
    this.loot = data.loot;
    this.abilities = data.abilities || [];
    this.enemyImage = data.enemyImage;
    this.statusEffects = [];
  }

  isAlive() {
    return this.hp > 0;
  }

  receiveDamage(amount) {
    const damageTaken = Math.max(0, amount);
    this.hp = Math.max(0, this.hp - damageTaken);
    return damageTaken;
  }

  hasStatus(type) {
    return this.statusEffects.some(status => status.type === type);
  }

  removeStatus(type) {
    this.statusEffects = this.statusEffects.filter(status => status.type !== type);
  }

  addStatus(status) {
    this.statusEffects.push({ ...status });
  }

  tickStatuses() {
    const results = [];
    this.statusEffects = this.statusEffects.filter(status => {
      if (status.type === 'poison' || status.type === 'bleed') {
        const damage = Math.min(8, status.strength);
        this.hp = Math.max(0, this.hp - damage);
        results.push(`${this.name} suffers ${damage} ${status.type} damage.`);
      } else if (status.type === 'burn') {
        const damage = Math.min(6, status.strength);
        this.hp = Math.max(0, this.hp - damage);
        results.push(`${this.name} takes ${damage} burn damage.`);
      } else if (status.type === 'stun') {
        results.push(`${this.name} is stunned and struggles to move.`);
        return true;
      } else if (status.type === 'armor_break') {
        results.push(`${this.name}'s armor is weakened.`);
      }

      status.duration -= 1;
      return status.duration > 0;
    });
    return results;
  }

  chooseAction() {
    const lifeRatio = this.hp / this.maxHp;
    const hasAbility = this.abilities.length > 0;
    const roll = Math.random();

    if (lifeRatio < 0.35 && roll < 0.4) {
      return 'defend';
    }

    if (hasAbility && roll < 0.3) {
      return 'ability';
    }

    if (roll < 0.15) {
      return 'defend';
    }

    return 'attack';
  }
}

class CombatManager {
  constructor(player) {
    this.player = player;
    this.enemy = null;
    this.isPlayerTurn = true;
    this.inCombat = false;
  }

  startCombat(enemy) {
    this.enemy = enemy;
    this.isPlayerTurn = this.player.speedValue >= this.enemy.speed;
    this.inCombat = true;
    this.log(`A ${enemy.name} appears!`);
    showEnemyCard(enemy);
    this.updateStatus();
  }

  endCombat() {
    this.inCombat = false;
    hideEnemyCard();
  }

  log(message) {
    const entry = document.createElement('div');
    entry.textContent = message;
    battleLog.prepend(entry);
    while (battleLog.children.length > 80) {
      battleLog.removeChild(battleLog.lastChild);
    }
  }

  resolvePlayerAction(action) {
    if (!this.inCombat || !this.enemy || !this.enemy.isAlive() || !this.player.isAlive()) {
      return;
    }

    const wasStunned = this.player.hasStatus && this.player.hasStatus('stun');
    this.player.skills.forEach(skill => skill.tickCooldown());
    const statusMessages = [...this.player.tickStatuses(), ...this.enemy.tickStatuses()];
    statusMessages.forEach(msg => this.log(msg));

    if (wasStunned) {
      this.log(`${this.player.name} is stunned and loses their turn!`);
      this.player.removeStatus('stun');
    } else if (!this.player.isAlive() || !this.enemy.isAlive()) {
      this.checkBattleEnd();
      return;
    } else {
      if (action === 'attack') {
        const damage = this.player.calculateWeaponDamage();
        const result = this.applyCombatRoll(this.player, this.enemy, damage);
        this.log(result);
        if (this.player.weapon && this.player.weapon.specialEffect) {
          this.applyWeaponEffect(this.player, this.enemy, this.player.weapon.specialEffect);
        }
      } else if (action === 'defend') {
        this.log(`${this.player.name} braces for impact and raises defense.`);
        this.player.addStatus({ type: 'defend', duration: 1, strength: 6 });
      } else if (action === 'item') {
        this.useItemAction();
      } else if (action === 'special') {
        this.useSpecialAction();
      }
    }

    this.checkBattleEnd();
    if (this.inCombat) {
      this.enemyTurn();
    }

    this.updateStatus();
  }

  applyCombatRoll(attacker, defender, damage) {
    const critLimit = attacker.critChance || 0.1;
    if (Math.random() < critLimit) {
      const crit = Math.round(damage * 1.8);
      defender.receiveDamage(crit);
      return `${attacker.name} lands a critical strike for ${crit}!`;
    }

    if (Math.random() < dodgeChance(defender.speed || defender.speedValue)) {
      return `${defender.name} dodges the attack.`;
    }

    if (defender.hasStatus && defender.hasStatus('armor_break')) {
      damage = Math.max(1, damage + 3);
    }

    const defendEffect = defender.statusEffects.find(status => status.type === 'defend');
    if (defendEffect) {
      damage = Math.max(1, damage - defendEffect.strength);
      defender.statusEffects = defender.statusEffects.filter(status => status !== defendEffect);
      this.log(`${defender.name} absorbs some damage with a defensive stance.`);
    }

    const taken = defender.receiveDamage(damage);
    return `${attacker.name} hits ${defender.name} for ${taken} damage.`;
  }

  applyWeaponEffect(attacker, defender, effect) {
    if (!effect || Math.random() >= effect.chance) {
      return;
    }

    if (effect.type === 'burn') {
      defender.addStatus({ type: 'burn', strength: effect.strength, duration: effect.duration });
      this.log(`${defender.name} is burned!`);
    } else if (effect.type === 'bleed') {
      defender.addStatus({ type: 'bleed', strength: effect.strength, duration: effect.duration });
      this.log(`${defender.name} starts bleeding.`);
    } else if (effect.type === 'stun') {
      defender.addStatus({ type: 'stun', duration: effect.duration });
      this.log(`${defender.name} is stunned.`);
    } else if (effect.type === 'armor_break') {
      defender.addStatus({ type: 'armor_break', strength: effect.strength, duration: effect.duration });
      this.log(`${defender.name}'s armor is cracked.`);
    }
  }

  useItemAction() {
    const itemId = Object.keys(this.player.inventory).find(id => this.player.inventory[id] > 0);
    if (!itemId) {
      this.log('No usable items in inventory.');
      return;
    }
    const result = this.player.useItem(itemId, this.enemy);
    this.log(result);
  }

  useSpecialAction() {
    const skill = this.player.skills.find(skill => skill.canUse());
    if (!skill) {
      this.log('No special moves are ready.');
      return;
    }

    skill.use();
    this.log(`${this.player.name} uses ${skill.name}!`);

    if (skill.effect.type === 'damage') {
      const damage = calculateDamage(this.player.attackValue + skill.power, this.enemy.defense);
      const applied = this.applyCombatRoll(this.player, this.enemy, damage);
      this.log(applied);
      if (skill.effect.status) {
        this.enemy.addStatus({ ...skill.effect.status });
        this.log(`${this.enemy.name} is afflicted with ${skill.effect.status.type}.`);
      }
      return;
    }

    if (skill.effect.type === 'defend') {
      this.player.addStatus({ type: 'defend', duration: 1, strength: 10 });
      this.log(`${this.player.name} raises a strong guard for the next attack.`);
      return;
    }
  }

  enemyTurn() {
    if (!this.enemy.isAlive() || !this.player.isAlive()) {
      this.checkBattleEnd();
      return;
    }

    if (this.enemy.hasStatus && this.enemy.hasStatus('stun')) {
      this.log(`${this.enemy.name} is stunned and misses their turn.`);
      this.enemy.removeStatus('stun');
      this.checkBattleEnd();
      return;
    }

    const enemyAction = this.enemy.chooseAction();
    if (enemyAction === 'defend') {
      this.enemy.addStatus({ type: 'defend', duration: 1, strength: 5 });
      this.log(`${this.enemy.name} is defending.`);
    } else if (enemyAction === 'ability' && this.enemy.abilities.length) {
      const ability = this.enemy.abilities[Math.floor(Math.random() * this.enemy.abilities.length)];
      const damage = calculateDamage(this.enemy.attack + ability.power, this.player.defenseValue);
      this.log(`${this.enemy.name} uses ${ability.name}.`);
      const applied = this.applyCombatRoll(this.enemy, this.player, damage);
      this.log(applied);
      if (ability.status) {
        this.player.addStatus({ ...ability.status });
        this.log(`${this.player.name} is afflicted with ${ability.status.type}.`);
      }
    } else {
      const damage = calculateDamage(this.enemy.attack, this.player.defenseValue);
      const result = this.applyCombatRoll(this.enemy, this.player, damage);
      this.log(result);
    }

    this.checkBattleEnd();
  }

  checkBattleEnd() {
    if (!this.enemy.isAlive()) {
      this.log(`${this.enemy.name} is defeated!`);
      this.player.xp += this.enemy.xpReward;
      this.player.gold += this.enemy.loot.gold;
      if (this.enemy.loot.item) {
        this.player.addItem(this.enemy.loot.item, 1);
      }
      this.log(`Gained ${this.enemy.xpReward} XP and ${this.enemy.loot.gold} gold.`);
      this.gainLevelIfNeeded();
      this.endCombat();
    }

    if (!this.player.isAlive()) {
      this.log(`${this.player.name} has fallen. Resting restores a little HP.`);
      this.player.hp = Math.max(1, Math.floor(this.player.maxHp * 0.4));
      this.endCombat();
    }
  }

  gainLevelIfNeeded() {
    const nextLevelXp = this.player.level * 80;
    if (this.player.xp >= nextLevelXp) {
      this.player.level += 1;
      this.player.xp -= nextLevelXp;
      this.player.maxHp += 18;
      this.player.attack += 4;
      this.player.defense += 3;
      this.player.speed += 2;
      this.player.hp = this.player.maxHp;
      this.log(`${this.player.name} reached level ${this.player.level}! Stats improved.`);
    }
  }

  updateStatus() {
    updateUi();
  }
}

const player = new Player();
const combatManager = new CombatManager(player);
let currentLocation = null;

const locationList = document.getElementById('locationList');
const areaName = document.getElementById('areaName');
const areaDescription = document.getElementById('areaDescription');
const encounterInfo = document.getElementById('encounterInfo');
const travelButton = document.getElementById('travelButton');
const moveButton = document.getElementById('moveButton');
const playerStats = document.getElementById('playerStats');
const enemyStats = document.getElementById('enemyStats');
const playerHpBar = document.getElementById('playerHpBar');
const enemyHpBar = document.getElementById('enemyHpBar');
const inventoryList = document.getElementById('inventoryList');
const shopList = document.getElementById('shopList');
const playerGold = document.getElementById('playerGold');
const battleLog = document.getElementById('battleLog');
const statusDisplay = document.getElementById('status');
const weaponSlot = document.getElementById('weaponSlot');
const armorSlot = document.getElementById('armorSlot');
const backgroundLayer = document.getElementById('backgroundLayer');
const bgMusic = document.getElementById('bgMusic');

const attackButton = document.getElementById('attackButton');
const defendButton = document.getElementById('defendButton');
const itemButton = document.getElementById('itemButton');
const specialButton = document.getElementById('specialButton');

const AREAS = LOCATIONS;

function calculateDamage(attack, defense) {
  const base = Math.max(1, attack - Math.floor(defense * 0.6));
  const variance = Math.floor(base * (0.85 + Math.random() * 0.3));
  return Math.max(1, variance);
}

function dodgeChance(speed) {
  return Math.min(0.22, speed / 180);
}

function getStoreEntry(itemId) {
  return ITEMS.find(item => item.id === itemId) || WEAPONS.find(weapon => weapon.id === itemId);
}

function getRandomEnemy(area) {
  const candidates = ENEMIES.filter(enemy => area.enemyTypes.includes(enemy.type));
  const template = candidates[Math.floor(Math.random() * candidates.length)];
  return new Enemy(template);
}

function renderLocations() {
  locationList.innerHTML = '';
  AREAS.forEach(area => {
    const button = document.createElement('button');
    button.textContent = 'Visit';
    button.addEventListener('click', () => selectArea(area));

    const card = document.createElement('div');
    card.className = 'location-card';
    card.innerHTML = `<div><strong>${area.name}</strong><div class="muted">${area.description}</div></div>`;
    card.appendChild(button);
    locationList.appendChild(card);
  });
}

function selectArea(area) {
  currentLocation = area;
  areaName.textContent = area.name;
  areaDescription.textContent = area.description;
  updateEncounterInfo(area);
  travelButton.disabled = false;
  moveButton.disabled = false;
  statusDisplay.textContent = `Ready to explore ${area.name}.`;
}

function travelToArea() {
  if (!currentLocation) return;
  statusDisplay.textContent = `Traveling to ${currentLocation.name}...`;
  changeLocation(currentLocation.id);
  startEncounter(getRandomEnemy(currentLocation));
}

function moveForward() {
  if (!currentLocation) return;
  if (Math.random() < 0.75) {
    const enemy = getRandomEnemy(currentLocation);
    startEncounter(enemy);
  } else {
    statusDisplay.textContent = 'The path is quiet. Continue on.';
    addLog('You move through the area without triggering an encounter.');
  }
}

function startEncounter(enemy) {
  combatManager.startCombat(enemy);
  statusDisplay.textContent = `In combat with ${enemy.name}.`; 
  updateButtons();
}

function addLog(text) {
  const entry = document.createElement('div');
  entry.textContent = text;
  battleLog.prepend(entry);
  while (battleLog.children.length > 80) battleLog.removeChild(battleLog.lastChild);
}

function updateUi() {
  const playerRatio = (player.hp / player.maxHp) * 100;
  playerHpBar.style.width = `${playerRatio}%`;
  playerStats.innerHTML = `Level ${player.level} · XP ${player.xp} · ATK ${player.attackValue} · DEF ${player.defenseValue} · SPD ${player.speedValue}`;
  playerGold.textContent = player.gold;
  weaponSlot.textContent = player.equipment.weapon ? player.equipment.weapon.name : 'None';
  armorSlot.textContent = player.equipment.armor ? player.equipment.armor.name : 'None';

  inventoryList.innerHTML = '';
  Object.entries(player.inventory).forEach(([itemId, count]) => {
    if (count <= 0) return;
    const itemData = ITEMS.find(item => item.id === itemId);
    const li = document.createElement('li');
    li.innerHTML = `<strong>${itemData.name}</strong> x${count}`;
    inventoryList.appendChild(li);
  });

  if (combatManager.enemy) {
    const enemy = combatManager.enemy;
    const enemyRatio = (enemy.hp / enemy.maxHp) * 100;
    enemyHpBar.style.width = `${enemyRatio}%`;
    enemyStats.innerHTML = `${enemy.name} · ${enemy.type.toUpperCase()} · HP ${enemy.hp}/${enemy.maxHp}`;
    if (window.refreshEnemyCard) window.refreshEnemyCard(enemy);
  } else {
    enemyHpBar.style.width = '0%';
    enemyStats.textContent = 'No enemy encountered';
  }

  renderShop();
  updateButtons();
}

function updateButtons() {
  const inCombat = combatManager.inCombat;
  attackButton.disabled = !inCombat;
  defendButton.disabled = !inCombat;
  itemButton.disabled = !inCombat || Object.values(player.inventory).every(value => value <= 0);
  specialButton.disabled = !inCombat || !player.skills.some(skill => skill.canUse());
}

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement.style;
  root.setProperty('--accent', theme.accent);
  root.setProperty('--panel', theme.panel);
  root.setProperty('--panel-border', theme.panelBorder);
  root.setProperty('--text', theme.text);
  root.setProperty('--muted', theme.muted);
  root.setProperty('--surface', theme.surface);
  root.setProperty('--button-bg', theme.buttonBg);
  root.setProperty('--button-text', theme.buttonText);
  root.setProperty('--danger', theme.danger);
  root.setProperty('--healthbar-start', theme.healthStart);
  root.setProperty('--healthbar-end', theme.healthEnd);
  root.setProperty('--status-color', theme.statusColor);
  root.setProperty('--bg', theme.bgColor);

  if (backgroundLayer) {
    backgroundLayer.classList.add('fade-out');
    setTimeout(() => {
      backgroundLayer.style.backgroundImage = `url('${theme.backgroundPath}')`;
      backgroundLayer.classList.remove('fade-out');
    }, 300);
  }

  if (theme.music && bgMusic) {
    bgMusic.src = theme.music;
    bgMusic.play().catch(() => {});
  } else if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
}

function updateEncounterInfo(location) {
  if (!encounterInfo || !location) return;
  encounterInfo.textContent = `Enemies: ${location.enemyTypes.map(type => type.charAt(0).toUpperCase() + type.slice(1)).join(', ')}`;
}

function togglePanel(panelId) {
  const panelIds = ['world-panel', 'inventory-panel', 'shop-panel', 'combat-panel'];
  panelIds.forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;
    if (id === panelId) {
      panel.classList.toggle('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });
}

function changeLocation(locationId) {
  const location = LOCATIONS.find(loc => loc.id === locationId || loc.name === locationId);
  if (!location) {
    statusDisplay.textContent = 'Unable to find that location.';
    return;
  }

  currentLocation = location;
  applyTheme(THEMES[location.theme]);
  areaName.textContent = location.name;
  areaDescription.textContent = location.description;
  updateEncounterInfo(location);
  renderShop();
  updateUi();
  statusDisplay.textContent = `Arrived at ${location.name}.`;
}

function renderShop() {
  shopList.innerHTML = '';
  if (!currentLocation) return;

  currentLocation.shop.forEach(itemId => {
    const item = getStoreEntry(itemId);
    if (!item) return;
    const li = document.createElement('li');
    li.className = 'shop-item';
    const rarityStyle = item.color ? `style="border-left: 4px solid ${item.color}; padding-left: 10px;"` : '';
    const entryType = item.type || item.rarity || 'gear';
    li.innerHTML = `<div ${rarityStyle}><strong>${item.name}</strong><div class="muted">${entryType} · ${item.price} gold</div></div>`;
    const buyButton = document.createElement('button');
    buyButton.textContent =
      item.slot || WEAPONS.some(w => w.id === item.id) ? `Equip ${item.name}` : `Buy ${item.name}`;
    buyButton.addEventListener('click', () => purchaseItem(item.id));
    li.appendChild(buyButton);
    shopList.appendChild(li);
  });
}

function purchaseItem(itemId) {
  const item = getStoreEntry(itemId);
  if (!item) return;

  if (player.gold < item.price) {
    statusDisplay.textContent = 'Not enough gold.';
    return;
  }

  player.gold -= item.price;

  if (item.slot || WEAPONS.some(weapon => weapon.id === itemId)) {
    player.equipItem(itemId);
    statusDisplay.textContent = `${item.name} equipped.`;
  } else {
    player.addItem(itemId, 1);
    statusDisplay.textContent = `${item.name} added to inventory.`;
  }

  updateUi();
}

attackButton.addEventListener('click', () => {
  combatManager.resolvePlayerAction('attack');
  updateUi();
});

defendButton.addEventListener('click', () => {
  combatManager.resolvePlayerAction('defend');
  updateUi();
});

itemButton.addEventListener('click', () => {
  combatManager.resolvePlayerAction('item');
  updateUi();
});

specialButton.addEventListener('click', () => {
  combatManager.resolvePlayerAction('special');
  updateUi();
});

travelButton.addEventListener('click', () => travelToArea());
moveButton.addEventListener('click', () => moveForward());

window.addEventListener('load', () => {
  renderLocations();
  updateUi();
  addLog('Welcome to the RPG. Travel to a region to begin.');
});
