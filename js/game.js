// 全局元素引用（确保所有函数能访问）
const totalAccumulatedScoreEl = document.getElementById('total-accumulated-score');
const currentScoreEl = document.getElementById('current-score');
const totalGamesEl = document.getElementById('total-games');
const accuracyEl = document.getElementById('accuracy');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-btn');
const startBtn = document.getElementById('start-btn');
const difficultySelect = document.getElementById('difficulty-select');
const difficultyHintText = document.getElementById('difficulty-hint-text');
const numberDisplay = document.querySelector('.number-display');
const countdownHint = document.getElementById('countdown-hint');
const rankingBtn = document.getElementById('ranking-btn');

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

// 页面加载完成后初始化
window.addEventListener('load', async () => {
  await initAuth(); // 先初始化登录状态
  if (userState.isLogin) {
    init(); // 初始化游戏
    initRankingBtn(); // 初始化排行榜按钮
  }
  initDifficultyHint(); // 初始化难度提示
});

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

    // 关键：读取用户游戏数据（从 LeanCloud 同步）
    await fetchUserGameLog();
    // 同步后立即更新页面显示（避免默认 0）
    updateStatsDisplay();

    // 显示游戏页面
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
  } else {
    // 未登录：显示登录弹窗
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
}


/**
 * 注册逻辑
 */
async function handleRegister() {
  const displayName = document.getElementById('register-username').value.trim();
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
    // 校验用户名（nickname）重复
    const nicknameQuery = new AV.Query(AV.User);
    nicknameQuery.equalTo('nickname', displayName);
    if (await nicknameQuery.count() > 0) {
      msgEl.textContent = '该用户名已被注册，请更换！';
      return;
    }

    // 校验账号（username）重复
    const accountQuery = new AV.Query(AV.User);
    accountQuery.equalTo('username', account);
    if (await accountQuery.count() > 0) {
      msgEl.textContent = '该账号已被注册，请更换！';
      return;
    }

    // 注册内置用户
    const user = new AV.User();
    user.setUsername(account);
    user.setPassword(password);
    user.set('nickname', displayName);
    await user.signUp();

    // 更新用户状态
    userState.isLogin = true;
    userState.username = displayName;
    userState.account = account;
    userState.userId = user.id;

    // 初始化游戏数据
    await initUserGameLog();
    // 同步页面显示
    updateStatsDisplay();

    // 切换页面
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init(); // 初始化游戏

    // 新增：注册成功后绑定排行榜按钮事件
    initRankingBtn();

    // 清空表单
    document.getElementById('register-username').value = '';
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
    // 内置登录
    const user = await AV.User.logIn(account, password);

    // 更新用户状态
    userState.isLogin = true;
    userState.username = user.get('nickname');
    userState.account = user.get('username');
    userState.userId = user.id;

    // 读取游戏数据（关键：同步云端数据）
    await fetchUserGameLog();
    // 同步页面显示
    updateStatsDisplay();

    // 切换页面
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init(); // 初始化游戏

    // 新增：登录成功后绑定排行榜按钮事件
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
      // 关键：将云端数据赋值给 gameState
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
  // 刷新时兜底同步数据（防止登录时同步失败）
  if (userState.isLogin && gameState.gameLogId) {
    fetchUserGameLog().then(() => {
      updateStatsDisplay(); // 同步后更新页面
    });
  }

  // 当前分数重置为 0（正常逻辑）
  gameState.currentScore = 0;
  currentScoreEl.textContent = gameState.currentScore;

  // 初始化输入框提示
  const initialDigitCount = gameState.difficultyConfig[gameState.currentDifficulty];
  answerInput.placeholder = `输入${initialDigitCount}位数字`;
}

/**
 * 初始化难度提示
 */
function initDifficultyHint() {
  difficultyHintText.textContent = gameState.difficultyHint[gameState.currentDifficulty];
  difficultySelect.addEventListener('change', (e) => {
    gameState.currentDifficulty = e.target.value;
    difficultyHintText.textContent = gameState.difficultyHint[gameState.currentDifficulty];
    const digitCount = gameState.difficultyConfig[gameState.currentDifficulty];
    answerInput.placeholder = `输入${digitCount}位数字`;
  });
}

/**
 * 更新难度提示文字
 * @param {string} difficulty - 难度值（easy/medium/hard/hell）
 */
function updateDifficultyHint(difficulty) {
    const hintEl = document.getElementById('difficulty-hint-text');
    hintEl.textContent = gameState.difficultyHint[difficulty];
}

// 事件监听
startBtn.addEventListener('click', startGame);
submitBtn.addEventListener('click', checkAnswer);
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkAnswer();
});
difficultySelect.addEventListener('change', (e) => {
    const newDifficulty = e.target.value;
    // 切换难度时如果游戏未进行中，更新当前难度和提示
    if (!gameState.isPlaying) {
        gameState.currentDifficulty = newDifficulty;
        const digitCount = gameState.difficultyConfig[newDifficulty];
        // 更新输入框提示文字
        answerInput.placeholder = `输入${digitCount}位数字`;
        // 更新难度说明文字
        updateDifficultyHint(newDifficulty);
    } else {
        // 游戏进行中不允许切换难度
        showAlert('当前游戏进行中，无法切换难度！⚠️');
        // 恢复原选择
        e.target.value = gameState.currentDifficulty;
    }
});

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

  // 生成目标数字
  const digitCount = gameState.difficultyConfig[gameState.currentDifficulty];
  gameState.targetNumber = generateRandomNumber(digitCount);

  // 显示数字和倒计时
  numberDisplay.textContent = gameState.targetNumber;
  countdownHint.textContent = `记忆时间：${gameState.displayDuration} 秒`;

  // 倒计时后隐藏数字
  let countdown = gameState.displayDuration;
  const timer = setInterval(() => {
    countdown--;
    countdownHint.textContent = `记忆时间：${countdown} 秒`;
    if (countdown <= 0) {
      clearInterval(timer);
      numberDisplay.textContent = '?';
      countdownHint.textContent = '请输入你记住的数字！';
      answerInput.disabled = false;
      submitBtn.disabled = false;
      answerInput.focus();
    }
  }, 1000);
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

  // 验证输入格式
  if (!new RegExp(`^\\d{${digitCount}}$`).test(userAnswer)) {
    showAlert(`请输入有效的${digitCount}位数字！⚠️`);
    answerInput.focus();
    return;
  }

  // 统计正确位数
  let correctDigitCount = 0;
  for (let i = 0; i < digitCount; i++) {
    if (userAnswer[i] === gameState.targetNumber[i]) correctDigitCount++;
  }
  const isFullyCorrect = correctDigitCount === digitCount;
  const wrongDigitCount = digitCount - correctDigitCount;

  // 计算得分
  let baseScore = correctDigitCount * 1 - wrongDigitCount * 0.5;
  baseScore = Math.max(0, baseScore);
  const difficultyBonusMap = { easy: 0, medium: 1, hard: 2, hell: 3 };
  const difficultyBonus = difficultyBonusMap[gameState.currentDifficulty];
  const fullCorrectBonus = isFullyCorrect ? Math.round(digitCount * 0.1) : 0;
  const currentRoundScore = Math.round(baseScore + difficultyBonus + fullCorrectBonus);

  // 更新游戏状态
  gameState.currentScore += currentRoundScore;
  gameState.totalAccumulatedScore = parseInt(gameState.totalAccumulatedScore) + currentRoundScore;
  gameState.totalGames++;
  if (isFullyCorrect) gameState.correctGames++;

  // 同步到 LeanCloud
  updateUserGameLog();

  // 更新页面显示
  updateStatsDisplay();

  // 显示结果弹窗
  showResultModal(isFullyCorrect, correctDigitCount, currentRoundScore, digitCount, wrongDigitCount, difficultyBonus, fullCorrectBonus);

  // 重置游戏状态
  gameState.isPlaying = false;
  answerInput.disabled = true;
  submitBtn.disabled = true;
  startBtn.disabled = false;
  difficultySelect.disabled = false;
  gameState.currentScore = 0;
}

/**
 * 更新页面统计显示（核心：确保数据同步到DOM）
 */
function updateStatsDisplay() {
  totalAccumulatedScoreEl.textContent = gameState.totalAccumulatedScore;
  currentScoreEl.textContent = gameState.currentScore;
  totalGamesEl.textContent = gameState.totalGames;
  accuracyEl.textContent = `${gameState.accuracy}%`;
}

/**
 * 显示结果弹窗
 */
function showResultModal(isFullyCorrect, correctDigitCount, currentRoundScore, digitCount, wrongDigitCount, difficultyBonus, fullCorrectBonus) {
  const modal = document.createElement('div');
  modal.className = 'result-modal';
  const modalContent = document.createElement('div');
  modalContent.className = 'result-content';

  const title = document.createElement('h3');
  title.textContent = isFullyCorrect ? '🎉 挑战成功！' : '⚠️ 挑战失败！';
  title.style.color = isFullyCorrect ? '#28a745' : '#dc3545';

  const details = document.createElement('div');
  details.className = 'result-details';
  details.innerHTML = `
    <p>正确位数：${correctDigitCount}/${digitCount}</p>
    <p>错误位数：${wrongDigitCount}</p>
    <p>基础得分：${correctDigitCount * 1} - ${wrongDigitCount * 0.5} = ${Math.max(0, correctDigitCount * 1 - wrongDigitCount * 0.5)} 分</p>
    <p>难度加成：${difficultyBonus} 分</p>
    <p>${isFullyCorrect ? '全对加成' : '未全对'}：${fullCorrectBonus} 分</p>
    <p>本轮得分：${currentRoundScore} 分</p>
    <p>总累计分：${gameState.totalAccumulatedScore} 分</p>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'result-btn';
  closeBtn.textContent = '继续挑战';
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });

  modalContent.appendChild(title);
  modalContent.appendChild(details);
  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 弹窗动画
  setTimeout(() => {
    modal.classList.add('active');
  }, 10);
}

/**
 * 初始化排行榜按钮（优化：避免重复绑定）
 */
function initRankingBtn() {
  // 先移除旧事件，再添加新事件（防止重复绑定）
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

  // 从 LeanCloud 查询排行榜数据
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
      listItem.innerHTML = `
        <span class="ranking-rank">${index + 1}</span>
        <span class="ranking-username">${item.username}</span>
        <span class="ranking-score">${item.score} 分</span>
      `;
      rankingList.appendChild(listItem);
    });
  }
}

/**
 * 获取排行榜数据（从 LeanCloud）
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
  const alert = document.createElement('div');
  alert.className = 'alert-modal';
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => {
    alert.classList.add('active');
  }, 10);
  setTimeout(() => {
    alert.classList.remove('active');
    setTimeout(() => alert.remove(), 300);
  }, 2000);
}

/**
 * 根据数字位数设置显示时长
 * @param {number} digitCount - 数字位数
 */
function setDisplayDuration(digitCount) {
    switch(digitCount) {
        case 4:
            gameState.displayDuration = 2; // 4位：2秒
            break;
        case 6:
            gameState.displayDuration = 3; // 6位：3秒
            break;
        case 11:
            gameState.displayDuration = 5; // 11位：5秒
            break;
        case 18:
            gameState.displayDuration = 8; // 18位：8秒
            break;
        default:
            gameState.displayDuration = 2;
    }
}

/**
 * 启动倒计时提示
 * @param {HTMLElement} countdownEl - 倒计时提示元素
 */
function startCountdown(countdownEl) {
    if (!countdownEl) return; // 避免元素不存在时报错
    let remainingTime = gameState.displayDuration;
    // 更新初始提示文字
    countdownEl.textContent = `记忆时间剩余：${remainingTime}秒`;
    
    // 每秒更新倒计时
    const countdownInterval = setInterval(() => {
        remainingTime--;
        
        if (remainingTime <= 0) {
            // 倒计时结束，清除定时器
            clearInterval(countdownInterval);
            return;
        }
        
        // 更新提示文字
        countdownEl.textContent = `记忆时间剩余：${remainingTime}秒`;
        
        // 最后1秒添加高亮样式
        if (remainingTime === 1) {
            countdownEl.classList.add('final-count');
            countdownEl.textContent = `最后${remainingTime}秒！`;
        }
    }, 1000);
}