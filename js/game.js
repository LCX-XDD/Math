// 用户状态（全局）
let userState = {
    isLogin: false,       // 是否登录
    username: '',         // 用户名（排行榜显示）
    account: '' ,          // 账号（登录凭证）
    userId: ''            // 新增：LeanCloud 用户唯一ID（用于关联游戏数据）
};

// 游戏状态变量 
let gameState = {
    isPlaying: false,       // 是否正在游戏中
    targetNumber: '',       // 目标数字
    currentDifficulty: 'easy', // 当前难度
    difficultyConfig: {     // 难度配置：位数
        easy: 4,            // 简单：4位（短验证码）
        medium: 6,          // 中等：6位（长验证码）
        hard: 11,           // 困难：11位（手机号）
        hell: 18            // 地狱：18位（身份证）
    },
    // 难度说明文字配置
    difficultyHint: {
        easy: '相当于短验证码',
        medium: '相当于长验证码',
        hard: '相当于手机号长度',
        hell: '相当于身份证长度'
    },
    totalGames: 0,          // 总游戏次数（永久累计）
    correctGames: 0,        // 正确次数（用于计算总正确率，不显示）
    accuracy: 0,            // 总正确率（永久统计）
    currentScore: 0,        // 当前分数（单轮游戏）
    totalAccumulatedScore: 0, // 总累计分数（永久存储，不重置）
    displayDuration: 2,     // 默认显示时长（单位：秒）
    gameLogId: ''           // 新增：当前用户的 GameLog 记录ID（关联游戏数据）
};

// DOM 元素（只保留存在的元素，删除冗余）
const startBtn = document.getElementById('start-btn');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-btn');
const numberDisplay = document.querySelector('.number-display');
const difficultySelect = document.getElementById('difficulty-select');
const totalGamesEl = document.getElementById('total-games');
const accuracyEl = document.getElementById('accuracy');
const currentScoreEl = document.getElementById('current-score');
// 新增：获取总累计分元素（确保 HTML 中存在该 ID）
const totalAccumulatedScoreEl = document.getElementById('total-accumulated-score');

/**
 * 初始化登录状态（修复：从 nickname 读取显示用的用户名）
 */
async function initAuth() {
  const currentUser = AV.User.current();
  if (currentUser) {
    // 已登录：同步用户状态（从 _User 内置字段读取）
    userState.isLogin = true;
    userState.username = currentUser.get('nickname'); // 显示用的用户名（nickname）
    userState.account = currentUser.get('username');  // 登录账号（username）
    userState.userId = currentUser.id;                // _User 的 objectId

    // 读取游戏数据
    await fetchUserGameLog();

    // 显示游戏页面
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
  } else {
    // 未登录：显示登录弹窗
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none';
  }

  // 绑定事件（不变）
  document.getElementById('go-register').addEventListener('click', () => {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('register-modal').style.display = 'flex';
  });
  document.getElementById('go-login').addEventListener('click', () => {
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('register-msg').textContent = '';
  });

  document.getElementById('do-login').addEventListener('click', handleLogin);
  document.getElementById('do-register').addEventListener('click', handleRegister);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

/**
 * 处理注册逻辑（修复：仅用 _User 内置字段，避免自定义字段权限问题）
 */
async function handleRegister() {
  const displayName = document.getElementById('register-username').value.trim(); // 显示用的用户名（昵称）
  const account = document.getElementById('register-account').value.trim();     // 登录账号
  const password = document.getElementById('register-password').value.trim();   // 密码
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
    // 1. 校验「显示用的用户名（nickname）」是否重复
    const nicknameQuery = new AV.Query(AV.User);
    nicknameQuery.equalTo('nickname', displayName);
    const nicknameCount = await nicknameQuery.count();
    if (nicknameCount > 0) {
      msgEl.textContent = '该用户名已被注册，请更换！';
      return;
    }

    // 2. 校验「登录账号（username）」是否重复（_User 内置 username 字段唯一）
    const accountQuery = new AV.Query(AV.User);
    accountQuery.equalTo('username', account);
    const accountCount = await accountQuery.count();
    if (accountCount > 0) {
      msgEl.textContent = '该账号已被注册，请更换！';
      return;
    }

    // 3. 仅使用 _User 内置字段注册（无自定义字段，避免权限问题）
    const user = new AV.User();
    user.setUsername(account);    // 内置 username 字段：存登录账号（唯一）
    user.setPassword(password);   // 内置 password 字段：存密码（自动加密）
    user.set('nickname', displayName); // 内置 nickname 字段：存显示用的用户名（排行榜用）
    await user.signUp(); // 注册成功后自动登录

    // 4. 更新用户状态
    userState.isLogin = true;
    userState.username = displayName; // 显示用的用户名（nickname）
    userState.account = account;      // 登录账号（username）
    userState.userId = user.id;       // _User 的 objectId（关联 GameLog 用）

    // 5. 初始化用户游戏数据（创建 GameLog 记录）
    await initUserGameLog();

    // 6. 切换到游戏页面
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init(); // 初始化游戏

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
 * 处理登录逻辑（修复：从 nickname 读取显示用的用户名）
 */
async function handleLogin() {
  const account = document.getElementById('login-account').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const msgEl = document.getElementById('login-msg');

  // 表单校验
  if (!account || !password) {
    msgEl.textContent = '账号、密码不能为空！';
    return;
  }

  try {
    // 1. 使用 LeanCloud 内置登录接口（验证账号密码）
    const user = await AV.User.logIn(account, password);

    // 2. 更新用户状态（从 _User 内置字段读取）
    userState.isLogin = true;
    userState.username = user.get('nickname'); // 显示用的用户名（nickname）
    userState.account = user.get('username');  // 登录账号（username）
    userState.userId = user.id;                // _User 的 objectId

    // 3. 读取用户游戏数据（GameLog）
    await fetchUserGameLog();

    // 4. 切换到游戏页面
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init(); // 初始化游戏

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
 * 处理退出登录（LeanCloud 版本）
 */
async function handleLogout() {
  try {
    // 清除 LeanCloud 登录状态
    await AV.User.logOut();
    
    // 重置用户状态
    userState.isLogin = false;
    userState.username = '';
    userState.account = '';
    userState.userId = '';
    gameState.gameLogId = '';

    // 隐藏游戏内容，显示登录弹窗
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';

  } catch (error) {
    showAlert('退出失败：' + error.message);
    console.error('退出失败', error);
  }
}

/**
 * 初始化用户游戏数据（GameLog 存储 nickname，方便排行榜查询）
 */
async function initUserGameLog() {
  try {
    const GameLog = AV.Object.extend('GameLog');
    const gameLog = new GameLog();
    gameLog.set('userId', userState.userId); // 关联 _User 的 objectId
    gameLog.set('username', userState.username); // 存储显示用的用户名（nickname）
    gameLog.set('totalAccumulatedScore', 0);
    gameLog.set('totalGames', 0);
    gameLog.set('correctGames', 0);
    gameLog.set('accuracy', 0);
    const result = await gameLog.save();

    // 更新游戏状态
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
 * 读取用户游戏数据（从 GameLog 表查询）
 */
async function fetchUserGameLog() {
  try {
    const query = new AV.Query('GameLog');
    query.equalTo('userId', userState.userId);
    const gameLog = await query.first();

    if (gameLog) {
      // 同步游戏数据到本地状态
      gameState.gameLogId = gameLog.id;
      gameState.totalAccumulatedScore = gameLog.get('totalAccumulatedScore') || 0;
      gameState.totalGames = gameLog.get('totalGames') || 0;
      gameState.correctGames = gameLog.get('correctGames') || 0;
      gameState.accuracy = gameLog.get('accuracy') || 0;
    } else {
      // 无 GameLog 记录，初始化一个
      await initUserGameLog();
    }

  } catch (error) {
    showAlert('读取游戏数据失败：' + error.message);
    console.error('读取 GameLog 失败', error);
  }
}

/**
 * 更新用户游戏数据（同步到 GameLog 表）
 */
async function updateUserGameLog() {
  try {
    // 计算最新正确率
    gameState.accuracy = gameState.totalGames > 0 
      ? Math.round((gameState.correctGames / gameState.totalGames) * 100) 
      : 0;

    // 更新 GameLog 记录
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

// 初始化函数
function init() {
    // 读取当前用户的专属存储键（用账号作为唯一标识）
    const userStorageKey = `numberMemory_${userState.account}`;
    const userData = JSON.parse(localStorage.getItem(userStorageKey) || '{}');

    // 初始化当前用户的专属数据（不再用全局键）
    gameState.totalAccumulatedScore = userData.totalAccumulatedScore || 0;
    gameState.totalGames = userData.totalGames || 0;
    gameState.correctGames = userData.correctGames || 0;
    
    // 计算总正确率
    gameState.accuracy = gameState.totalGames > 0 
        ? Math.round((gameState.correctGames / gameState.totalGames) * 100) 
        : 0;

    // 初始化页面显示
    totalAccumulatedScoreEl.textContent = gameState.totalAccumulatedScore;
    currentScoreEl.textContent = gameState.currentScore;
    totalGamesEl.textContent = gameState.totalGames;
    accuracyEl.textContent = `${gameState.accuracy}%`;

    initDifficultyHint();
    // 初始化输入框提示
    const initialDigitCount = gameState.difficultyConfig[gameState.currentDifficulty];
    answerInput.placeholder = `输入${initialDigitCount}位数字`;
}
/**
 * 初始化难度提示文字（灰色小号显示在下方）
 */
function initDifficultyHint() {
    // 先判断页面中是否已存在该元素，避免重复创建
    if (document.getElementById('difficulty-hint-text')) {
        return;
    }
    // 创建提示文字元素
    const hintEl = document.createElement('span');
    hintEl.className = 'difficulty-hint';
    hintEl.id = 'difficulty-hint-text';
    
    // 添加到难度选择区域
    const difficultyContainer = document.querySelector('.difficulty-selection');
    difficultyContainer.appendChild(hintEl);
    
    // 更新初始提示文字
    updateDifficultyHint(difficultySelect.value);
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
 * 开始游戏 - 新增数字位数标识，适配超小屏
 */
function startGame() {
    // 更新当前难度
    gameState.currentDifficulty = difficultySelect.value;
    const digitCount = gameState.difficultyConfig[gameState.currentDifficulty];
    
    // 根据位数动态设置显示时长
    setDisplayDuration(digitCount);

    // 更新游戏状态
    gameState.isPlaying = true;
    
    // 禁用开始按钮和难度选择，启用输入框（稍后）和提交按钮
    startBtn.disabled = true;
    difficultySelect.disabled = true;
    answerInput.disabled = true;  // 数字显示期间不可输入
    submitBtn.disabled = true;
    answerInput.value = '';
    answerInput.placeholder = `输入${digitCount}位数字`;
    
    // 生成对应位数的随机数字
    gameState.targetNumber = generateRandomNumber(digitCount);
    
    // 显示数字（添加位数标识，用于CSS适配）
    numberDisplay.setAttribute('data-digit', digitCount);
    if (digitCount === 18) {
        numberDisplay.style.fontSize = '1.6rem';
    } else if (digitCount === 11) {
        numberDisplay.style.fontSize = '1.9rem';
    } else if (digitCount === 6) {
        numberDisplay.style.fontSize = '2.3rem';
    } else {
        numberDisplay.style.fontSize = '2.8rem';
    }
    numberDisplay.textContent = gameState.targetNumber;
    numberDisplay.classList.add('show');
    
    // 显示倒计时提示（先判断元素是否存在）
    const countdownHint = document.getElementById('countdown-hint');
    if (countdownHint) {
        countdownHint.classList.add('active');
        startCountdown(countdownHint);
    }
    
    // 根据动态时长隐藏数字
    setTimeout(() => {
        numberDisplay.textContent = '?';
        numberDisplay.classList.remove('show');
        numberDisplay.removeAttribute('data-digit');
        answerInput.disabled = false;
        submitBtn.disabled = false;
        answerInput.focus();
        
        // 隐藏倒计时提示
        if (countdownHint) {
            countdownHint.classList.remove('active', 'final-count');
            countdownHint.textContent = '准备开始记忆...';
        }
    }, gameState.displayDuration * 1000);
}

/**
 * 生成指定位数的随机数字（首位不为0）
 * @param {number} digitCount - 数字位数
 * @returns {string} 随机数字字符串
 */
function generateRandomNumber(digitCount) {
    if (digitCount <= 0) return '0';
    
    // 首位数字：1-9
    let number = Math.floor(1 + Math.random() * 9).toString();
    
    // 后续数字：0-9
    for (let i = 1; i < digitCount; i++) {
        number += Math.floor(Math.random() * 10).toString();
    }
    
    return number;
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
    
    // 按位统计正确位数
    let correctDigitCount = 0;
    for (let i = 0; i < digitCount; i++) {
        if (userAnswer[i] === gameState.targetNumber[i]) {
            correctDigitCount++;
        }
    }
    const isFullyCorrect = correctDigitCount === digitCount;
    const wrongDigitCount = digitCount - correctDigitCount; // 定义错误位数（修复未定义问题）
    
    // 1. 基础得分：正确+1，错误-0.5
    let baseScore = correctDigitCount * 1 - wrongDigitCount * 0.5;
    // 2. 最低得分限制为0
    baseScore = Math.max(0, baseScore);
    
    // 3. 难度加成（根据难度配置）
    const difficultyBonusMap = {
        easy: 0,    // 4位：无加成
        medium: 1,  // 6位：+1
        hard: 2,    // 11位：+2
        hell: 3     // 18位：+3
    };
    const difficultyBonus = difficultyBonusMap[gameState.currentDifficulty];
    
    // 4. 全对奖励：难度对应位数的10%（四舍五入）
    const fullCorrectBonus = isFullyCorrect ? Math.round(digitCount * 0.1) : 0;
    
    // 5. 本次总得分（四舍五入到整数）
    const currentRoundScore = Math.round(baseScore + difficultyBonus + fullCorrectBonus);
    
    // 更新当前分数、总累计分
    gameState.currentScore += currentRoundScore;
    gameState.totalAccumulatedScore = parseInt(gameState.totalAccumulatedScore) + currentRoundScore;
    
    // 更新总游戏次数和完全正确次数（永久统计）
    gameState.totalGames++;
    if (isFullyCorrect) {
        gameState.correctGames++;
    }

    // 核心修改：同步到 LeanCloud GameLog 表
    updateUserGameLog();
    
    // 更新页面显示
    updateStatsDisplay();
    
    // 显示结果弹窗（包含详细计分信息）
    showResultModal(isFullyCorrect, correctDigitCount, currentRoundScore, digitCount, wrongDigitCount, difficultyBonus, fullCorrectBonus);
    
    // 重置游戏状态
    gameState.isPlaying = false;
    answerInput.disabled = true;
    submitBtn.disabled = true;
    startBtn.disabled = false;
    difficultySelect.disabled = false;
    
    // 重置当前分数（单轮游戏结束后重置）
    gameState.currentScore = 0;
}

/**
 * 更新统计信息显示
 */
function updateStatsDisplay() {
    // 只更新存在的元素，添加动画效果
    updateNumberWithAnimation(totalAccumulatedScoreEl, gameState.totalAccumulatedScore);
    updateNumberWithAnimation(currentScoreEl, gameState.currentScore);
    updateNumberWithAnimation(totalGamesEl, gameState.totalGames);
    updateNumberWithAnimation(accuracyEl, `${gameState.accuracy}%`);
}

/**
 * 数字变化动画
 * @param {HTMLElement} el - 要更新的元素
 * @param {string|number} value - 目标值
 */
function updateNumberWithAnimation(el, value) {
    if (!el) return; // 避免元素不存在时报错
    el.style.transition = 'all 0.5s ease';
    el.style.opacity = '0.5';
    setTimeout(() => {
        el.textContent = value;
        el.style.opacity = '1';
    }, 200);
}

/**
 * 显示结果弹窗 - 优化过渡动画
 * @param {boolean} isFullyCorrect - 是否完全答对
 * @param {number} correctDigitCount - 正确位数
 * @param {number} currentRoundScore - 本次得分
 * @param {number} digitCount - 总位数
 * @param {number} wrongDigitCount - 错误位数
 * @param {number} difficultyBonus - 难度加成
 * @param {number} fullCorrectBonus - 全对奖励
 */
function showResultModal(isFullyCorrect, correctDigitCount, currentRoundScore, digitCount, wrongDigitCount, difficultyBonus, fullCorrectBonus) {
    // 创建弹窗元素
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // 弹窗内容
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // 弹窗标题（带表情符号）
    const title = document.createElement('h2');
    title.textContent = isFullyCorrect ? '🎉 太棒了！完全正确！' : '📝 答题完成';
    
    // 详细信息容器
    const detailContainer = document.createElement('div');
    detailContainer.className = 'detail-info';
    
    // 各项详细信息
    const difficultyNameMap = {
        easy: '简单 📱',
        medium: '中等 📝',
        hard: '困难 📞',
        hell: '地狱 🆔'
    };
    const difficultyName = difficultyNameMap[gameState.currentDifficulty];
    
    const difficultyInfo = document.createElement('p');
    difficultyInfo.textContent = `难度：${difficultyName}（${digitCount}位）`;
    
    const targetInfo = document.createElement('p');
    targetInfo.textContent = `正确答案：${gameState.targetNumber}`;
    
    const digitInfo = document.createElement('p');
    digitInfo.textContent = `正确位数：${correctDigitCount}/${digitCount} ${isFullyCorrect ? '💯' : ''}`;
    
    const scoreInfo = document.createElement('p');
    scoreInfo.textContent = `本次得分：${currentRoundScore}分`;
    
    const totalAccumulatedInfo = document.createElement('p');
    totalAccumulatedInfo.textContent = `总累计分：${gameState.totalAccumulatedScore}分`;
    
    // 组装详细信息
    detailContainer.appendChild(difficultyInfo);
    detailContainer.appendChild(targetInfo);
    detailContainer.appendChild(digitInfo);
    detailContainer.appendChild(scoreInfo);
    detailContainer.appendChild(totalAccumulatedInfo);
    
    // 按钮容器
    const btnContainer = document.createElement('div');
    btnContainer.className = 'modal-buttons';
    
    // 继续游戏按钮
    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn modal-btn continue';
    continueBtn.textContent = '继续挑战 🚀';
    continueBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(modal);
            startGame();  // 直接开始下一局
        }, 300);
    });
    
    // 结束游戏按钮
    const endBtn = document.createElement('button');
    endBtn.className = 'btn modal-btn end';
    endBtn.textContent = '结束游戏 📊';
    endBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(modal);
            answerInput.value = '';
        }, 300);
    });
    
    // 组装弹窗
    btnContainer.appendChild(continueBtn);
    btnContainer.appendChild(endBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(detailContainer);
    modalContent.appendChild(btnContainer);
    modal.appendChild(modalContent);
    
    // 添加到页面并触发动画
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

/**
 * 自定义提示框（带表情符号和过渡）
 * @param {string} message - 提示信息
 */
function showAlert(message) {
    // 创建临时提示框
    const alertEl = document.createElement('div');
    alertEl.style.position = 'fixed';
    alertEl.style.top = '20px';
    alertEl.style.left = '50%';
    alertEl.style.transform = 'translateX(-50%)';
    alertEl.style.background = 'white';
    alertEl.style.padding = '12px 24px';
    alertEl.style.borderRadius = 'var(--border-radius)';
    alertEl.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.15)';
    alertEl.style.color = 'var(--text-primary)';
    alertEl.style.fontSize = '1rem';
    alertEl.style.zIndex = '9999';
    alertEl.style.opacity = '0';
    alertEl.style.transition = 'opacity 0.3s ease';
    alertEl.textContent = message;
    
    document.body.appendChild(alertEl);
    
    // 显示动画
    setTimeout(() => {
        alertEl.style.opacity = '1';
    }, 10);
    
    // 3秒后隐藏
    setTimeout(() => {
        alertEl.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(alertEl);
        }, 300);
    }, 3000);
}

/**
 * 排行榜核心功能
 */
// 1. 初始化排行榜按钮事件
function initRankingBtn() {
    const rankingBtn = document.getElementById('ranking-btn');
    if (rankingBtn) { // 避免按钮不存在时报错
        rankingBtn.addEventListener('click', showRankingModal);
    }
}

/**
 * 显示排行榜弹窗（异步查询 LeanCloud 数据）
 */
async function showRankingModal() {
  // 创建弹窗元素
  const rankingModal = document.createElement('div');
  rankingModal.className = 'ranking-modal';
  
  const rankingContent = document.createElement('div');
  rankingContent.className = 'ranking-content';
  
  const rankingTitle = document.createElement('h2');
  rankingTitle.className = 'ranking-title';
  rankingTitle.textContent = '🏆 总累计分数排行榜';
  
  const rankingList = document.createElement('ul');
  rankingList.className = 'ranking-list';
  
  // 显示加载中
  rankingList.innerHTML = '<li class="no-ranking">加载中...</li>';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'ranking-close-btn';
  closeBtn.textContent = '关闭';
  closeBtn.addEventListener('click', () => {
    rankingModal.classList.remove('active');
    setTimeout(() => {
      document.body.removeChild(rankingModal);
    }, 300);
  });
  
  // 组装弹窗
  rankingContent.appendChild(rankingTitle);
  rankingContent.appendChild(rankingList);
  rankingContent.appendChild(closeBtn);
  rankingModal.appendChild(rankingContent);
  document.body.appendChild(rankingModal);
  setTimeout(() => {
    rankingModal.classList.add('active');
  }, 10);

  // 异步查询排行榜数据
  const rankingData = await getRankingData();
  
  // 渲染数据
  rankingList.innerHTML = '';
  if (rankingData.length === 0) {
    const noRankingItem = document.createElement('li');
    noRankingItem.className = 'no-ranking';
    noRankingItem.textContent = '暂无排名数据，快去挑战高分吧！🚀';
    rankingList.appendChild(noRankingItem);
  } else {
    rankingData.forEach((item, index) => {
      const rankingItem = document.createElement('li');
      rankingItem.className = 'ranking-item';
      
      const rankEl = document.createElement('span');
      rankEl.className = 'ranking-rank';
      rankEl.textContent = index + 1;
      
      const usernameEl = document.createElement('span');
      usernameEl.className = 'ranking-username';
      usernameEl.textContent = item.username;
      
      const scoreEl = document.createElement('span');
      scoreEl.className = 'ranking-score';
      scoreEl.textContent = `${item.score} 分`;
      
      rankingItem.appendChild(rankEl);
      rankingItem.appendChild(usernameEl);
      rankingItem.appendChild(scoreEl);
      rankingList.appendChild(rankingItem);
    });
  }
}

/**
 * 获取排行榜数据（从 LeanCloud GameLog 表查询）
 */
async function getRankingData() {
  try {
    const query = new AV.Query('GameLog');
    query.descending('totalAccumulatedScore'); // 按总累计分降序排序
    query.limit(10); // 最多显示10条
    query.select('username', 'totalAccumulatedScore'); // 只查询需要的字段
    const rankingData = await query.find();

    // 格式化数据（适配原有渲染逻辑）
    return rankingData.map(item => ({
      username: item.get('username'),
      score: item.get('totalAccumulatedScore') || 0
    }));

  } catch (error) {
    console.error('获取排行榜失败', error);
    return [];
  }
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

// 页面加载完成后初始化
window.addEventListener('load', async () => {
  await initAuth(); // 异步初始化登录状态
  if (userState.isLogin) {
    init(); // 已登录则初始化游戏
    initRankingBtn();
  }
});