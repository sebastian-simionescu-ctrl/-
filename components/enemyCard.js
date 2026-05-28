const enemyCard = document.getElementById('enemyCard');
const enemyPortrait = document.getElementById('enemy-image');
const enemyNameLabel = document.getElementById('enemyName');
const enemyTypeLabel = document.getElementById('enemyType');
const enemyRarityLabel = document.getElementById('enemyRarity');
const enemyCardHpBar = document.getElementById('enemyCardHpBar');
const enemyCardHpText = document.getElementById('enemyCardHpText');
const enemyCardPanel = document.getElementById('enemy-card-panel');

const DIFFICULTY_BORDER = {
  weak: '#6bcf6b',
  normal: '#58a6ff',
  elite: '#ff9f43',
  boss: '#f85149',
};

window.showEnemyCard = function(enemy) {
  if (!enemyCard || !enemyCardPanel) return;

  enemyPortrait.onerror = function() {
    enemyPortrait.onerror = null;
    enemyPortrait.src = 'assets/enemies/placeholder.svg';
  };
  enemyPortrait.src = enemy.enemyImage || 'assets/enemies/placeholder.svg';
  enemyPortrait.alt = `${enemy.name} portrait`;
  enemyNameLabel.textContent = enemy.name;
  enemyTypeLabel.textContent = enemy.category || enemy.enemyClass || 'Unknown';
  enemyRarityLabel.textContent = (enemy.type || 'normal').toUpperCase();
  enemyCardHpBar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
  enemyCardHpText.textContent = `${enemy.hp} / ${enemy.maxHp} HP`;
  enemyCard.style.borderColor = DIFFICULTY_BORDER[enemy.type] || '#58a6ff';
  enemyCardPanel.classList.remove('hidden');
  enemyCard.classList.remove('hidden', 'card-hidden');
  enemyCard.classList.add('visible');
};

window.refreshEnemyCard = function(enemy) {
  if (!enemyCard || enemyCard.classList.contains('hidden')) return;
  enemyCardHpBar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
  enemyCardHpText.textContent = `${enemy.hp} / ${enemy.maxHp} HP`;
};

window.hideEnemyCard = function() {
  if (!enemyCard || !enemyCardPanel) return;
  enemyCard.classList.remove('visible');
  enemyCard.classList.add('hidden', 'card-hidden');
  enemyCardPanel.classList.add('hidden');
};
