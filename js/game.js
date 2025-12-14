// 用户状态（全局）
let userState = {
  isLogin: false,
  username: '',
  account: '',
  userId: ''
};

// 游戏状态变量
let gameState = {
  isPlaying: false,
  targetNumber: '',
  currentDifficulty: 'easy',
  difficultyConfig: { easy: 4, medium: 6, hard: 11, hell: 18 },
  difficultyHint: {
    easy: '相当于短验证码',
    medium: '相当于长验证码',
    hard: '相当于手机号长度',
    hell: '相当于身份证长度'
  },
  totalGames: 0,
  correctGames: 0,
  accuracy: 0,
  currentScore: 0,
  totalAccumulatedScore: 0,
  displayDuration: 2,
  gameLogId: ''
};

// 全局元素引用（先声明，页面加载后再赋值）
let totalAccumulatedScoreEl, currentScoreEl, totalGamesEl, accuracyEl;
let answerInput, submitBtn, startBtn, difficultySelect, difficultyHintText;
let numberDisplay, countdownHint, rankingBtn;
let loginAccount, loginPassword, registerName, registerAccount, registerPassword;

// 页面加载完成后初始化（确保 DOM 已渲染）
window.addEventListener('load', async () => {
  // 第一步：初始化所有 DOM 元素（关键！必须在 DOM 渲染后执行）
  initGlobalElements();
  // 第二步：初始化登录状态和事件绑定
  await initAuth();
  // 第三步：初始化游戏相关功能
  if (userState.isLogin) {
    init();
    initRankingBtn();
  }
  initDifficultyHint();
});

/**
 * 初始化所有全局 DOM 元素（确保拿到真实元素）
 */
function initGlobalElements() {
  // 游戏相关元素
  totalAccumulatedScoreEl = document.getElementById('total-accumulated-score');
  currentScoreEl = document.getElementById('current-score');
  totalGamesEl = document.getElementById('total-games');
  accuracyEl = document.getElementById('accuracy');
  answerInput = document.getElementById('answer-input');
  submitBtn = document.getElementById('submit-btn');
  startBtn = document.getElementById('start-btn');
  difficultySelect = document.getElementById('difficulty-select');
  difficultyHintText = document.getElementById('difficulty-hint-text');
  numberDisplay = document.querySelector('.number-display');
  countdownHint = document.getElementById('countdown-hint');
  rankingBtn = document.getElementById('ranking-btn');

  // 登录/注册输入框（和 HTML 中的 ID 严格对应）
  loginAccount = document.getElementById('login-account');
  loginPassword = document.getElementById('login-password');
  registerName = document.getElementById('register-name'); // 和 HTML 一致
  registerAccount = document.getElementById('register-account');
  registerPassword = document.getElementById('register-password');

  // 控制台打印验证（可删除）
  console.log('元素初始化结果：', {
    loginAccount: loginAccount ? '成功' : '失败',
    registerName: registerName ? '成功' : '失败'
  });
}

/**
 * 初始化登录状态
 */
async function initAuth() {
  const currentUser = AV.User.current();
  if (currentUser) {
    // 已登录：同步用户状态
    userState.isLogin = true;
    userState.username = currentUser.get('nickname');
    userState.account = currentUser.get('username');
    userState.userId = currentUser.id;

    await fetchUserGameLog();
    updateStatsDisplay();

    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
  } else {
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none';
  }

  // 绑定登录注册切换事件
  document.getElementById('go-register').addEventListener('click', () => {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('register-modal').style.display = 'flex';
  });
  document.getElementById('go-login').addEventListener('click', () => {
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('register-msg').textContent = '';
  });

  // 绑定按钮事件
  document.getElementById('do-login').addEventListener('click', handleLogin);
  document.getElementById('do-register').addEventListener('click', handleRegister);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  startBtn.addEventListener('click', startGame);
  submitBtn.addEventListener('click', checkAnswer);

  // 1. 登录窗口 Enter 提交
  if (loginAccount && loginPassword) {
    [loginAccount, loginPassword].forEach(input => {
      input.addEventListener('keydown', (e) => {
        console.log('登录输入框触发 keydown 事件，按键：', e.key); // 新增日志
        if (e.key === 'Enter') {
          console.log('触发 Enter 键，调用 handleLogin'); // 新增日志
          e.preventDefault();
          handleLogin();
        }
      });
    });
  }

  // 2. 注册窗口 Enter 提交
  if (registerName && registerAccount && registerPassword) {
    [registerName, registerAccount, registerPassword].forEach(input => {
      input.addEventListener('keydown', (e) => {
        console.log('注册输入框触发 keydown 事件，按键：', e.key); // 新增日志
        if (e.key === 'Enter') {
          console.log('触发 Enter 键，调用 handleRegister'); // 新增日志
          e.preventDefault();
          handleRegister();
        }
      });
    });
  }
// 弹窗 ESC 关闭功能（修改类名匹配，覆盖所有弹窗）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 匹配所有可能的活跃弹窗类名
    const activeModal = document.querySelector(
      '.modal.active, .ranking-modal.active, .result-modal.active'
    );
    if (activeModal) {
      // 排行榜弹窗需要过渡动画，其他弹窗直接移除
      if (activeModal.classList.contains('ranking-modal')) {
        activeModal.classList.remove('active');
        setTimeout(() => activeModal.remove(), 300);
      } else {
        activeModal.remove();
      }
    }
  }
});
}

/**
 * 注册逻辑（修复 ID 不匹配问题）
 */
async function handleRegister() {
  // 修复：ID 从 register-username 改为 register-name（和 HTML 一致）
  const displayName = document.getElementById('register-name').value.trim();
  const account = document.getElementById('register-account').value.trim();
  const password = document.getElementById('register-password').value.trim();
  const msgEl = document.getElementById('register-msg');

  // 表单校验
  if (!displayName || !account || !password) {
    msgEl.textContent = '用户名、账号、密码不能为空！';
    return;
  }
  if (password.length < 6) {
    msgEl.textContent = '密码长度不能少于6位！';
    return;
  }

  try {
    // 校验用户名重复
    const nicknameQuery = new AV.Query(AV.User);
    nicknameQuery.equalTo('nickname', displayName);
    if (await nicknameQuery.count() > 0) {
      msgEl.textContent = '该用户名已被注册，请更换！';
      return;
    }

    // 校验账号重复
    const accountQuery = new AV.Query(AV.User);
    accountQuery.equalTo('username', account);
    if (await accountQuery.count() > 0) {
      msgEl.textContent = '该账号已被注册，请更换！';
      return;
    }

    // 注册用户
    const user = new AV.User();
    user.setUsername(account);
    user.setPassword(password);
    user.set('nickname', displayName);
    await user.signUp();

    // 更新状态
    userState.isLogin = true;
    userState.username = displayName;
    userState.account = account;
    userState.userId = user.id;

    await initUserGameLog();
    updateStatsDisplay();

    // 切换页面
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init();
    initRankingBtn();

    // 清空表单
    document.getElementById('register-name').value = ''; // 同步修改 ID
    document.getElementById('register-account').value = '';
    document.getElementById('register-password').value = '';
    msgEl.textContent = '';

  } catch (error) {
    msgEl.textContent = '注册失败：' + error.message;
    console.error('注册失败', error);
  }
}

/**
 * 登录逻辑
 */
async function handleLogin() {  
  const account = document.getElementById('login-account').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const msgEl = document.getElementById('login-msg');

  if (!account || !password) {
    msgEl.textContent = '账号、密码不能为空！';
    return;
  }

  try {
    const user = await AV.User.logIn(account, password);

    // 更新状态
    userState.isLogin = true;
    userState.username = user.get('nickname');
    userState.account = user.get('username');
    userState.userId = user.id;

    await fetchUserGameLog();
    updateStatsDisplay();

    // 切换页面
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init();
    initRankingBtn();

    // 清空表单
    document.getElementById('login-account').value = '';
    document.getElementById('login-password').value = '';
    msgEl.textContent = '';

  } catch (error) {
    msgEl.textContent = '账号或密码错误！';
    console.error('登录失败', error);
  }
}

/**
 * 退出登录
 */
async function handleLogout() {
  try {
    await AV.User.logOut();
    userState = { isLogin: false, username: '', account: '', userId: '' };
    gameState.gameLogId = '';

    document.getElementById('game-container').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
  } catch (error) {
    showAlert('退出失败：' + error.message);
    console.error('退出失败', error);
  }
}

/**
 * 初始化用户游戏数据（GameLog）
 */
async function initUserGameLog() {
  try {
    const GameLog = AV.Object.extend('GameLog');
    const gameLog = new GameLog();
    gameLog.set('userId', userState.userId);
    gameLog.set('username', userState.username);
    gameLog.set('totalAccumulatedScore', 0);
    gameLog.set('totalGames', 0);
    gameLog.set('correctGames', 0);
    gameLog.set('accuracy', 0);
    const result = await gameLog.save();

    gameState.gameLogId = result.id;
    gameState.totalAccumulatedScore = 0;
    gameState.totalGames = 0;
    gameState.correctGames = 0;
    gameState.accuracy = 0;
  } catch (error) {
    showAlert('游戏数据初始化失败：' + error.message);
    console.error('初始化 GameLog 失败', error);
  }
}

/**
 * 读取用户游戏数据（从 GameLog 同步）
 */
async function fetchUserGameLog() {
  try {
    const query = new AV.Query('GameLog');
    query.equalTo('userId', userState.userId);
    const gameLog = await query.first();

    if (gameLog) {
      gameState.gameLogId = gameLog.id;
      gameState.totalAccumulatedScore = gameLog.get('totalAccumulatedScore') || 0;
      gameState.totalGames = gameLog.get('totalGames') || 0;
      gameState.correctGames = gameLog.get('correctGames') || 0;
      gameState.accuracy = gameLog.get('accuracy') || 0;
    } else {
      await initUserGameLog();
    }
  } catch (error) {
    showAlert('读取游戏数据失败：' + error.message);
    console.error('读取 GameLog 失败', error);
  }
}

/**
 * 更新用户游戏数据（同步到 LeanCloud）
 */
async function updateUserGameLog() {
  try {
    gameState.accuracy = gameState.totalGames > 0
      ? Math.round((gameState.correctGames / gameState.totalGames) * 100)
      : 0;

    const gameLog = AV.Object.createWithoutData('GameLog', gameState.gameLogId);
    gameLog.set('totalAccumulatedScore', gameState.totalAccumulatedScore);
    gameLog.set('totalGames', gameState.totalGames);
    gameLog.set('correctGames', gameState.correctGames);
    gameLog.set('accuracy', gameState.accuracy);
    await gameLog.save();
  } catch (error) {
    showAlert('更新游戏数据失败：' + error.message);
    console.error('更新 GameLog 失败', error);
  }
}

/**
 * 初始化游戏
 */
function init() {
  if (userState.isLogin && gameState.gameLogId) {
    fetchUserGameLog().then(() => {
      updateStatsDisplay();
    });
  }

  gameState.currentScore = 0;
  currentScoreEl.textContent = gameState.currentScore;

  const initialDigitCount = gameState.difficultyConfig[gameState.currentDifficulty];
  answerInput.placeholder = `输入${initialDigitCount}位数字`;
}

/**
 * 初始化难度提示
 */
function initDifficultyHint() {
  difficultyHintText.textContent = gameState.difficultyHint[gameState.currentDifficulty];
  
  difficultySelect.addEventListener('change', (e) => {
    const newDifficulty = e.target.value;
    if (!gameState.isPlaying) {
      gameState.currentDifficulty = newDifficulty;
      const digitCount = gameState.difficultyConfig[newDifficulty];
      answerInput.placeholder = `输入${digitCount}位数字`;
      difficultyHintText.textContent = gameState.difficultyHint[newDifficulty];
    } else {
      showAlert('当前游戏进行中，无法切换难度！⚠️');
      e.target.value = gameState.currentDifficulty;
    }
  });

  answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !gameState.isPlaying && !answerInput.disabled) {
      checkAnswer();
    }
  });
}

/**
 * 更新难度提示文字
 */
function updateDifficultyHint(difficulty) {
  const hintEl = document.getElementById('difficulty-hint-text');
  hintEl.textContent = gameState.difficultyHint[difficulty];
}

/**
 * 开始游戏
 */
function startGame() {
  if (gameState.isPlaying) return;

  gameState.isPlaying = true;
  startBtn.disabled = true;
  difficultySelect.disabled = true;
  answerInput.disabled = true;
  submitBtn.disabled = true;
  answerInput.value = '';

  const digitCount = gameState.difficultyConfig[gameState.currentDifficulty];
  gameState.targetNumber = generateRandomNumber(digitCount);

  setDisplayDuration(digitCount);

  // 显示数字和倒计时（确保添加 active 类）
  numberDisplay.textContent = gameState.targetNumber;
  countdownHint.textContent = `记忆时间剩余：${gameState.displayDuration} 秒`;
  countdownHint.classList.add('active'); // 强制添加 active 类
  countdownHint.classList.remove('final-count', 'initial'); // 移除干扰类

  startCountdown(countdownHint);

  setTimeout(() => {
    numberDisplay.textContent = '?';
    countdownHint.textContent = '请输入你记住的数字！';
    countdownHint.classList.remove('active', 'final-count');
    answerInput.disabled = false;
    submitBtn.disabled = false;
    answerInput.focus();
  }, gameState.displayDuration * 1000);
}

/**
 * 生成随机数字
 */
function generateRandomNumber(length) {
  let num = '';
  for (let i = 0; i < length; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
}

/**
 * 检查答案
 */
function checkAnswer() {
  const userAnswer = answerInput.value.trim();
  const digitCount = gameState.difficultyConfig[gameState.currentDifficulty];

  if (!new RegExp(`^\\d{${digitCount}}$`).test(userAnswer)) {
    showAlert(`请输入有效的${digitCount}位数字！⚠️`);
    answerInput.focus();
    return;
  }

  let correctDigitCount = 0;
  for (let i = 0; i < digitCount; i++) {
    if (userAnswer[i] === gameState.targetNumber[i]) correctDigitCount++;
  }
  const isFullyCorrect = correctDigitCount === digitCount;
  const wrongDigitCount = digitCount - correctDigitCount;

  let baseScore = correctDigitCount * 1 - wrongDigitCount * 0.5;
  baseScore = Math.max(0, baseScore);
  const difficultyBonusMap = { easy: 0, medium: 1, hard: 2, hell: 3 };
  const difficultyBonus = difficultyBonusMap[gameState.currentDifficulty];
  const fullCorrectBonus = isFullyCorrect ? Math.round(digitCount * 0.1) : 0;
  const currentRoundScore = Math.round(baseScore + difficultyBonus + fullCorrectBonus);

  gameState.currentScore += currentRoundScore;
  gameState.totalAccumulatedScore = parseInt(gameState.totalAccumulatedScore) + currentRoundScore;
  gameState.totalGames++;
  if (isFullyCorrect) gameState.correctGames++;

  updateUserGameLog();
  updateStatsDisplay();
  showResultModal(isFullyCorrect, correctDigitCount, currentRoundScore, digitCount, wrongDigitCount, difficultyBonus, fullCorrectBonus);

  gameState.isPlaying = false;
  answerInput.disabled = true;
  submitBtn.disabled = true;
  startBtn.disabled = false;
  difficultySelect.disabled = false;
  gameState.currentScore = 0;
}

/**
 * 更新页面统计显示
 */
function updateStatsDisplay() {
  totalAccumulatedScoreEl.textContent = gameState.totalAccumulatedScore;
  currentScoreEl.textContent = gameState.currentScore;
  totalGamesEl.textContent = gameState.totalGames;
  accuracyEl.textContent = `${gameState.accuracy}%`;
}

function showResultModal(isFullyCorrect, correctDigitCount, currentRoundScore, digitCount, wrongDigitCount, difficultyBonus, fullCorrectBonus) {
  // 1. 先移除所有旧弹窗（避免重复）
  document.querySelectorAll('.result-modal, .modal').forEach(old => old.remove());

  // 2. 创建弹窗容器（使用 CSS 中定义的 .modal 类，而非 .result-modal）
  const modal = document.createElement('div');
  modal.className = 'modal'; // 改为 CSS 中已有的 .modal 类

  // 3. 创建弹窗内容（使用 .modal-content 类，与 CSS 统一）
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  // 4. 标题（保持原有逻辑）
  const title = document.createElement('h2');
  title.textContent = isFullyCorrect ? '🎉 挑战成功！' : '⚠️ 挑战失败！';
  title.style.color = isFullyCorrect ? '#10b981' : '#ef4444';
  modalContent.appendChild(title);

  // 5. 详情内容（使用 .detail-info 类，与 CSS 统一）
  const details = document.createElement('div');
  details.className = 'detail-info';
  details.innerHTML = `
    <p>正确位数：${correctDigitCount}/${digitCount}</p>
    <p>错误位数：${wrongDigitCount}</p>
    <p>本轮得分：${currentRoundScore} 分</p>
    <p>总分：${gameState.totalAccumulatedScore} 分</p>
  `;
  modalContent.appendChild(details);

  // 6. 按钮容器（使用 .modal-buttons 类，与 CSS 统一）
  const btnContainer = document.createElement('div');
  btnContainer.className = 'modal-buttons';

  // 继续挑战按钮
  const continueBtn = document.createElement('button');
  continueBtn.className = 'btn modal-btn continue';
  continueBtn.textContent = '继续挑战';
  continueBtn.addEventListener('click', () => {
    modal.remove();
    startGame();
  });
  btnContainer.appendChild(continueBtn);

  // 结束游戏按钮
  const endBtn = document.createElement('button');
  endBtn.className = 'btn modal-btn end';
  endBtn.textContent = '结束游戏';
  endBtn.addEventListener('click', () => {
    modal.remove();
    gameState.isPlaying = false;
    answerInput.disabled = true;
    submitBtn.disabled = true;
    startBtn.disabled = false;
    difficultySelect.disabled = false;
    gameState.currentScore = 0;
    numberDisplay.textContent = '?';
    countdownHint.textContent = '准备开始记忆...';
    answerInput.value = '';
  });
  btnContainer.appendChild(endBtn);

  modalContent.appendChild(btnContainer);
  modal.appendChild(modalContent);

  // 7. 强制添加到 body 最外层（避免被游戏容器嵌套）
  document.body.appendChild(modal);

  // 8. 显示弹窗（触发 CSS 过渡）
  setTimeout(() => {
    modal.classList.add('active');
  }, 10);
}

/**
 * 初始化排行榜按钮
 */
function initRankingBtn() {
  rankingBtn.removeEventListener('click', showRankingModal);
  rankingBtn.addEventListener('click', showRankingModal);
}

/**
 * 显示排行榜弹窗
 */
async function showRankingModal() {
  const modal = document.createElement('div');
  modal.className = 'ranking-modal';
  const modalContent = document.createElement('div');
  modalContent.className = 'ranking-content';

  const title = document.createElement('h2');
  title.textContent = '🏆 总累计分数排行榜';

  const rankingList = document.createElement('ul');
  rankingList.className = 'ranking-list';
  rankingList.innerHTML = '<li class="no-ranking">加载中...</li>';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ranking-close-btn';
  closeBtn.textContent = '关闭';
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  });

  modalContent.appendChild(title);
  modalContent.appendChild(rankingList);
  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('active'), 10);

  const rankingData = await getRankingData();
  rankingList.innerHTML = '';

  if (rankingData.length === 0) {
    const noDataItem = document.createElement('li');
    noDataItem.className = 'no-ranking';
    noDataItem.textContent = '暂无排名数据，快去挑战高分吧！🚀';
    rankingList.appendChild(noDataItem);
  } else {
    rankingData.forEach((item, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'ranking-item';
      
      // 核心新增：判断当前条目是否是登录用户
      const isCurrentUser = item.username === userState.username;
      
      // 渲染时添加「我」的标注（小字号灰色）
      listItem.innerHTML = `
        <span class="ranking-rank">${index + 1}</span>
        <span class="ranking-username">
          ${item.username}
          ${isCurrentUser ? '<span class="current-user-tag">我</span>' : ''}
        </span>
        <span class="ranking-score">${item.score} 分</span>
      `;
      
      // 可选：给当前用户条目加高亮样式
      if (isCurrentUser) {
        listItem.classList.add('current-user-item');
      }
      
      rankingList.appendChild(listItem);
    });
  }
}

/**
 * 获取排行榜数据
 */
async function getRankingData() {
  try {
    const query = new AV.Query('GameLog');
    query.descending('totalAccumulatedScore');
    query.limit(10);
    query.select('username', 'totalAccumulatedScore');
    const result = await query.find();
    return result.map(item => ({
      username: item.get('username'),
      score: item.get('totalAccumulatedScore') || 0
    }));
  } catch (error) {
    console.error('获取排行榜失败', error);
    return [];
  }
}

/**
 * 显示提示弹窗
 */
function showAlert(message) {
  const alertModal = document.createElement('div');
  alertModal.className = 'result-modal';

  const alertContent = document.createElement('div');
  alertContent.className = 'result-content';
  alertContent.style.maxWidth = '350px';

  const alertTitle = document.createElement('h3');
  alertTitle.textContent = '⚠️ 提示';
  alertTitle.style.color = '#ef4444';
  alertContent.appendChild(alertTitle);

  const alertText = document.createElement('div');
  alertText.className = 'result-details';
  alertText.style.textAlign = 'center';
  alertText.innerHTML = `<p>${message}</p>`;
  alertContent.appendChild(alertText);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'result-btn';
  confirmBtn.textContent = '知道了';
  confirmBtn.addEventListener('click', () => {
    alertModal.remove();
  });
  alertContent.appendChild(confirmBtn);

  alertModal.appendChild(alertContent);
  document.body.appendChild(alertModal);

  setTimeout(() => {
    alertModal.classList.add('active');
  }, 10);
}

/**
 * 设置显示时长
 */
function setDisplayDuration(digitCount) {
  switch(digitCount) {
    case 4:
      gameState.displayDuration = 2;
      break;
    case 6:
      gameState.displayDuration = 3;
      break;
    case 11:
      gameState.displayDuration = 5;
      break;
    case 18:
      gameState.displayDuration = 8;
      break;
    default:
      gameState.displayDuration = 2;
  }
}

/**
 * 启动倒计时
 */
function startCountdown(countdownEl) {
  if (!countdownEl) return;
  let remainingTime = gameState.displayDuration;

  countdownEl.textContent = `记忆时间剩余：${remainingTime} 秒`;
  
  const countdownInterval = setInterval(() => {
    remainingTime--;
    
    if (remainingTime <= 0) {
      clearInterval(countdownInterval);
      return;
    }
    
    countdownEl.textContent = `记忆时间剩余：${remainingTime} 秒`;
    
    if (remainingTime === 1) {
      countdownEl.classList.add('final-count');
      countdownEl.textContent = `最后${remainingTime}秒！`;
    } else {
      countdownEl.classList.remove('final-count');
    }
  }, 1000);

}
