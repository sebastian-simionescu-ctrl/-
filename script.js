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
const swingBarPanel = document.getElementById('swing-bar-panel');
const swingBar = document.getElementById('swing-bar');
const hitZone = document.getElementById('hit-zone');
const critZone = document.getElementById('crit-zone');
const marker = document.getElementById('marker');

let swingActive = false;

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
  attackButton.disabled = !inCombat || swingActive;
  defendButton.disabled = !inCombat || swingActive;
  itemButton.disabled = !inCombat || swingActive || Object.values(player.inventory).every(value => value <= 0);
  specialButton.disabled = !inCombat || swingActive || !player.skills.some(skill => skill.canUse());
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

function openSwingBar() {
  if (!swingBarPanel || !swingBar) return;
  swingBarPanel.classList.remove('hidden');
  marker.classList.remove('stopped');
  swingActive = true;
  statusDisplay.textContent = 'Attack ready: hit the swing bar!';
}

function closeSwingBar() {
  if (!swingBarPanel || !swingBar) return;
  swingBarPanel.classList.add('hidden');
  marker.classList.add('stopped');
  swingActive = false;
}

function resolveSwingAttack() {
  if (!swingActive || !combatManager.enemy || !combatManager.enemy.isAlive()) return;

  const hitRect = hitZone.getBoundingClientRect();
  const critRect = critZone.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const markerCenter = markerRect.left + markerRect.width / 2;

  let message = `${player.name} misses the swing!`;
  let damage = 0;
  let isCrit = false;

  if (markerCenter >= hitRect.left && markerCenter <= hitRect.right) {
    damage = player.calculateWeaponDamage();
    isCrit = markerCenter >= critRect.left && markerCenter <= critRect.right;
    if (isCrit) {
      damage = Math.round(damage * 1.8);
      message = `${player.name} lands a critical hit for ${damage}!`;
    } else {
      message = `${player.name} hits ${combatManager.enemy.name} for ${damage} damage.`;
    }
  }

  if (damage > 0) {
    if (Math.random() < dodgeChance(combatManager.enemy.speed)) {
      message = `${combatManager.enemy.name} dodges the attack.`;
      damage = 0;
    }
  }

  if (damage > 0) {
    const defendEffect = combatManager.enemy.statusEffects.find(status => status.type === 'defend');
    if (defendEffect) {
      damage = Math.max(1, damage - defendEffect.strength);
      combatManager.enemy.statusEffects = combatManager.enemy.statusEffects.filter(status => status !== defendEffect);
      combatManager.log(`${combatManager.enemy.name} blocks part of the swing.`);
    }
    combatManager.enemy.receiveDamage(damage);
    if (player.weapon && player.weapon.specialEffect) {
      combatManager.applyWeaponEffect(player, combatManager.enemy, player.weapon.specialEffect);
    }
  }

  combatManager.log(message);
  closeSwingBar();
  combatManager.updateStatus();

  if (combatManager.enemy.isAlive() && player.isAlive()) {
    combatManager.enemyTurn();
  }

  combatManager.checkBattleEnd();
  combatManager.updateStatus();
}

function prepareSwingAttack() {
  if (!combatManager.inCombat || !combatManager.enemy || !player.isAlive()) return;
  openSwingBar();
}

const BIOME_NPC_DATA = {
  emeraldForest: {
    title: 'Forest Encounters',
    subtitle: 'Whispers in the canopy, moss beneath your feet.',
    theme: {
      bg: 'rgba(12, 42, 25, 0.96)',
      border: 'rgba(86, 172, 108, 0.35)',
      text: '#ecf7e8',
      accent: '#8de0ae',
      shadow: 'rgba(22, 66, 35, 0.35)',
    },
    npcTypes: {
      wolf: {
        name: 'Wolf Guardian',
        emoji: '🐺',
        dialogue: {
          talk: 'The forest watches all who walk beneath its branches.',
          trade: 'I can spare some healing moss for a price.',
          quest: 'Find the lost cub and bring it back to the hollow.',
          leave: 'May leaf and root guide you.',
        },
      },
      elf: {
        name: 'Forest Elf',
        emoji: '🧝',
        dialogue: {
          talk: 'Welcome, traveler. The glade is peaceful today.',
          trade: 'I trade rare herbs for stories of the outside world.',
          quest: 'Help me gather moonflowers before dusk.',
          leave: 'Go in peace, friend of the woods.',
        },
      },
      grove: {
        name: 'Grove Sage',
        emoji: '🌿',
        dialogue: {
          talk: 'The ground remembers every footstep.',
          trade: 'My remedies are crafted from ancient leaves.',
          quest: 'Speak with the old oak and learn the forest’s secret.',
          leave: 'Return when the wind whispers your name.',
        },
      },
      fox: {
        name: 'Fox Trickster',
        emoji: '🦊',
        dialogue: {
          talk: 'A little cleverness goes a long way in this forest.',
          trade: 'I have trinkets that glow in moonlight.',
          quest: 'Steal a lantern from the camp and bring it to me.',
          leave: 'Watch your step—paths shift after dark.',
        },
      },
    },
  },
  sunbleachedDunes: {
    title: 'Desert Parley',
    subtitle: 'Heat shimmers over sand, and every word carries weight.',
    theme: {
      bg: 'rgba(65, 39, 12, 0.96)',
      border: 'rgba(209, 161, 76, 0.35)',
      text: '#fff5dc',
      accent: '#ffd27a',
      shadow: 'rgba(94, 60, 16, 0.35)',
    },
    npcTypes: {
      camel: {
        name: 'Desert Caravan',
        emoji: '🐪',
        dialogue: {
          talk: 'The dunes shift, but a caravan endures.',
          trade: 'I carry spices and water for those who bargain well.',
          quest: 'Escort my caravan through the burning wastes.',
          leave: 'May the sun favor your journey.',
        },
      },
      djinn: {
        name: 'Desert Djinn',
        emoji: '🧞',
        dialogue: {
          talk: 'I offer a single wish, but choose carefully.',
          trade: 'I can trade magic for memories.',
          quest: 'Recover the glass lamp stolen from my shrine.',
          leave: 'Do not undervalue the silence of the desert.',
        },
      },
      dune: {
        name: 'Sandward Nomad',
        emoji: '🏜️',
        dialogue: {
          talk: 'The dunes hide both treasure and danger.',
          trade: 'I have heat-resistant cloaks for sale.',
          quest: 'Retrieve the buried relic under the northern dune.',
          leave: 'Stay sharp; the desert is not forgiving.',
        },
      },
      blade: {
        name: 'Scimitar Scout',
        emoji: '🗡️',
        dialogue: {
          talk: 'A blade can open doors words cannot.',
          trade: 'I sell weapons forged in sun-fire.',
          quest: 'Deliver a message to the oasis chief.',
          leave: 'Go with steady feet and a cooler head.',
        },
      },
    },
  },
  frostfallPlains: {
    title: 'Frostbound Visitors',
    subtitle: 'Cold air bites and every breath smells of ice.',
    theme: {
      bg: 'rgba(10, 24, 43, 0.96)',
      border: 'rgba(110, 174, 228, 0.32)',
      text: '#e9f6ff',
      accent: '#92d2ff',
      shadow: 'rgba(18, 40, 68, 0.35)',
    },
    npcTypes: {
      ice: {
        name: 'Ice Warden',
        emoji: '🧊',
        dialogue: {
          talk: 'The frost will hold if you respect it.',
          trade: 'I trade cool stones for warm tales.',
          quest: 'Bring me a frozen ember from the glacier.',
          leave: 'Keep your flame close to your heart.',
        },
      },
      bear: {
        name: 'Snow Bear',
        emoji: '🐻‍❄️',
        dialogue: {
          talk: 'My paws know every drift and ridge.',
          trade: 'I trade furs and safe passage.',
          quest: 'Chase away the ice wolves from my den.',
          leave: 'Travel swiftly, but do not linger in the cold.',
        },
      },
      snow: {
        name: 'Frost Seeker',
        emoji: '❄️',
        dialogue: {
          talk: 'Snow is the forest’s quiet cloak.',
          trade: 'I can offer frost resistance potions.',
          quest: 'Find the frozen lantern in the blizzard.',
          leave: 'May the cold never numb your courage.',
        },
      },
      wizard: {
        name: 'Winter Sage',
        emoji: '🧙‍♂️',
        dialogue: {
          talk: 'Magic and ice are brothers in these lands.',
          trade: 'Wisdom comes at the cost of a secret.',
          quest: 'Deliver this runestone to the hidden shrine.',
          leave: 'Return when the sun thaws the north.',
        },
      },
    },
  },
  emberRidge: {
    title: 'Blazing Confrontations',
    subtitle: 'The air glows red and danger is always close.',
    theme: {
      bg: 'rgba(45, 16, 10, 0.96)',
      border: 'rgba(255, 112, 62, 0.35)',
      text: '#ffe8d4',
      accent: '#ff8a42',
      shadow: 'rgba(86, 32, 18, 0.35)',
    },
    npcTypes: {
      flame: {
        name: 'Fire Herald',
        emoji: '🔥',
        dialogue: {
          talk: 'This ridge is alive with burning fury.',
          trade: 'I sell ember stones and heated blades.',
          quest: 'Cool the molten river and free the trapped miner.',
          leave: 'Don’t let the blaze consume you.',
        },
      },
      dragon: {
        name: 'Lava Drake',
        emoji: '🐉',
        dialogue: {
          talk: 'A dragon speaks only to those who dare.',
          trade: 'I can grant you a scale for a favor.',
          quest: 'Recover the dragon’s stolen egg.',
          leave: 'Fly away before the embers strike.',
        },
      },
      stone: {
        name: 'Magma Warden',
        emoji: '🪨',
        dialogue: {
          talk: 'Rock and flame shape this place.',
          trade: 'I trade rare ores for brave deeds.',
          quest: 'Quell the fire geyser east of the ridge.',
          leave: 'Watch the ground beneath your feet.',
        },
      },
      demon: {
        name: 'Ash Fiend',
        emoji: '😈',
        dialogue: {
          talk: 'I enjoy the heat of conflict.',
          trade: 'I accept souls in exchange for power.',
          quest: 'Steal the ember crown from the kiln.',
          leave: 'Leave now, before the flames answer you.',
        },
      },
    },
  },
  duskMarket: {
    title: 'Market Exchanges',
    subtitle: 'Lanterns glow as merchants haggle and secrets trade hands.',
    theme: {
      bg: 'rgba(35, 17, 43, 0.96)',
      border: 'rgba(150, 94, 193, 0.35)',
      text: '#f1e6ff',
      accent: '#d2a0ff',
      shadow: 'rgba(53, 22, 66, 0.35)',
    },
    npcTypes: {
      eye: {
        name: 'Mystic Merchant',
        emoji: '🧿',
        dialogue: {
          talk: 'I see more than what the eye reveals.',
          trade: 'I sell charms and glimpses of fate.',
          quest: 'Deliver this token to the hidden stall.',
          leave: 'May fortune watch over you.',
        },
      },
      thread: {
        name: 'Silk Weaver',
        emoji: '🧵',
        dialogue: {
          talk: 'Every cloth has a story woven in it.',
          trade: 'I trade rare fabrics for interesting stories.',
          quest: 'Find the lost spool of moonthread.',
          leave: 'Walk softly through the market.',
        },
      },
      coin: {
        name: 'Coin Broker',
        emoji: '💰',
        dialogue: {
          talk: 'Money greases every exchange.',
          trade: 'I buy and sell valuables at fair rates.',
          quest: 'Locate the missing merchant ledger.',
          leave: 'Keep your purse close.',
        },
      },
      stalls: {
        name: 'Market Vendor',
        emoji: '🧔‍♂️',
        dialogue: {
          talk: 'Welcome to the dusk market.',
          trade: 'I offer exotic goods from distant lands.',
          quest: 'Bring me a rare spice from the spice stall.',
          leave: 'Come back when the lanterns are full.',
        },
      },
    },
  },
};

const NPC_ACTIONS = ['Talk', 'Trade', 'Quest', 'Leave'];
let currentNpcEntry = null;

function normalizeBiomeKey(biome) {
  if (!biome) return null;
  const normalized = biome.toString().trim().toLowerCase().replace(/\s+/g, '');
  return {
    'emeraldforest': 'emeraldForest',
    'sunbleacheddunes': 'sunbleachedDunes',
    'frostfallplains': 'frostfallPlains',
    'emberridge': 'emberRidge',
    'duskmarket': 'duskMarket',
  }[normalized] || normalized;
}

function openNPCUI(biome, npcType) {
  const biomeKey = normalizeBiomeKey(biome);
  const biomeData = BIOME_NPC_DATA[biomeKey];
  if (!biomeData) {
    console.warn('Unknown biome for NPC UI:', biome);
    return;
  }

  const availableTypes = biomeData.npcTypes;
  const npc = availableTypes[npcType] || availableTypes[npcType?.toLowerCase()] || Object.values(availableTypes)[0];
  if (!npc) {
    console.warn('Unknown NPC type for biome:', npcType, biomeKey);
    return;
  }

  currentNpcEntry = { biome: biomeKey, npcType, npc, biomeData };

  const panel = document.getElementById('npc-ui');
  const titleEl = document.getElementById('npcUiTitle');
  const subtitleEl = document.getElementById('npcUiSubtitle');
  const avatarEl = document.getElementById('npcUiAvatar');
  const nameEl = document.getElementById('npcUiName');
  const dialogueEl = document.getElementById('npcUiDialogue');
  const actionsEl = document.getElementById('npcUiActions');

  titleEl.textContent = biomeData.title;
  subtitleEl.textContent = biomeData.subtitle;
  avatarEl.textContent = npc.emoji;
  nameEl.textContent = npc.name;
  dialogueEl.textContent = npc.dialogue.talk || 'The NPC awaits your choice.';

  actionsEl.innerHTML = '';
  NPC_ACTIONS.forEach((action) => {
    const button = document.createElement('button');
    button.textContent = action;
    button.type = 'button';
    button.addEventListener('click', () => handleNpcAction(action));
    actionsEl.appendChild(button);
  });

  panel.style.setProperty('--npc-bg', biomeData.theme.bg);
  panel.style.setProperty('--npc-border', biomeData.theme.border);
  panel.style.setProperty('--npc-text', biomeData.theme.text);
  panel.style.setProperty('--npc-shadow', biomeData.theme.shadow);

  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
}

function handleNpcAction(action) {
  if (!currentNpcEntry) return;
  const dialogue = currentNpcEntry.npc.dialogue[action.toLowerCase()] || 'The NPC remains silent.';
  const dialogueEl = document.getElementById('npcUiDialogue');
  dialogueEl.textContent = dialogue;

  if (action === 'Leave') {
    closeNPCUI();
  }
}

function closeNPCUI() {
  const panel = document.getElementById('npc-ui');
  if (!panel) return;
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');

  document.getElementById('npcUiTitle').textContent = 'NPC Encounter';
  document.getElementById('npcUiSubtitle').textContent = 'Meet someone new in the region.';
  document.getElementById('npcUiAvatar').textContent = '🧝';
  document.getElementById('npcUiName').textContent = 'NPC Name';
  document.getElementById('npcUiDialogue').textContent = 'The NPC stands before you, waiting to speak.';
  document.getElementById('npcUiActions').innerHTML = '';
  currentNpcEntry = null;
}

function togglePanel(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.toggle('hidden');
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
  prepareSwingAttack();
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

if (swingBar) {
  swingBar.addEventListener('click', () => {
    if (swingActive) {
      resolveSwingAttack();
    }
  });
}

travelButton.addEventListener('click', () => travelToArea());
moveButton.addEventListener('click', () => moveForward());

window.addEventListener('load', () => {
  renderLocations();
  updateUi();
  addLog('Welcome to the RPG. Travel to a region to begin.');
});
