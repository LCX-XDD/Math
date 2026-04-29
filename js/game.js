// 用户状态（全局）
let userState = {
  isLogin: false,
  username: '',
  account: '',
  userId: '',
  email: ''
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
  gameLogId: '',
  countdownTimer: null
};

// 全局元素引用
let totalAccumulatedScoreEl, currentScoreEl, totalGamesEl, accuracyEl;
let answerInput, submitBtn, startBtn, difficultySelect, difficultyHintText;
let numberDisplay, countdownHint, rankingBtn, profileBtn;
let loginAccount, loginPassword, registerName, registerAccount, registerPassword, registerEmail;

// 页面加载
window.addEventListener('load', async () => {

  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('game-container').style.display = 'none';

  initGlobalElements();
  await initAuth();

  if (userState.isLogin) {
    // 已登录：显示游戏
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init();
    initRankingBtn();
  } else {
    // 未登录：显示登录
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none';
  }

  initDifficultyHint();
  document.getElementById('global-loading').style.display = 'none';
});

// 初始化DOM
function initGlobalElements() {
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
  profileBtn = document.getElementById('profile-btn');

  loginAccount = document.getElementById('login-account');
  loginPassword = document.getElementById('login-password');
  registerName = document.getElementById('register-name');
  registerAccount = document.getElementById('register-account');
  registerPassword = document.getElementById('register-password');
  registerEmail = document.getElementById('register-email');

  // 输入框输入事件：实时更新顶部数字框
  answerInput.addEventListener('input', () => {
    const len = answerInput.value.length;
    numberDisplay.textContent = len > 0 ? len : '?';
  });

  // 点击输入框聚焦
  answerInput.addEventListener('focus', () => {
    const len = answerInput.value.length;
    if(len === 0) numberDisplay.textContent = '?';
  });
}

// 验证当前用户是否真实存在于数据库
async function validateUserExists() {
  try {
    const currentUser = AV.User.current();
    if (!currentUser) return false;

    const query = new AV.Query(AV.User);
    const user = await query.get(currentUser.id);
    return !!user;
  } catch (e) {
    await forceLogout();
    return false;
  }
}

// 强制登出
async function forceLogout() {
  try { await AV.User.logOut(); } catch (e) {}
  userState = { isLogin: false, username: '', account: '', userId: '', email: '' };
  gameState.gameLogId = '';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('login-modal').style.display = 'flex';
  showAlert('账号已失效，已强制退出登录');
}

// 初始化登录状态
async function initAuth() {
  const currentUser = AV.User.current();
  
  if (currentUser) {
    if (!(await validateUserExists())) return;

    const emailVerified = currentUser.get('emailVerified');
    if (!emailVerified) {
      await AV.User.logOut();
      userState.isLogin = false;
      showAlert('请先验证邮箱后再登录！');
      return;
    }

    userState.isLogin = true;
    userState.username = currentUser.get('nickname');
    userState.account = currentUser.get('username');
    userState.userId = currentUser.id;
    userState.email = currentUser.get('email');

    await fetchUserGameLog();
    updateStatsDisplay();
  }

  // 登录注册切换事件
  document.getElementById('go-register').addEventListener('click', () => {
    const loading = document.getElementById('loading-overlay');
    loading.style.display = 'flex';
    setTimeout(() => {
      document.getElementById('login-modal').style.display = 'none';
      document.getElementById('register-modal').style.display = 'flex';
      loading.style.display = 'none';
    }, 300);
  });

  document.getElementById('go-login').addEventListener('click', () => {
    const loading = document.getElementById('loading-overlay');
    loading.style.display = 'flex';
    setTimeout(() => {
      document.getElementById('register-modal').style.display = 'none';
      document.getElementById('login-modal').style.display = 'flex';
      document.getElementById('register-msg').textContent = '';
      loading.style.display = 'none';
    }, 300);
  });

  document.getElementById('do-login').addEventListener('click', handleLogin);
  document.getElementById('do-register').addEventListener('click', handleRegister);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  startBtn.addEventListener('click', startGame);
  submitBtn.addEventListener('click', checkAnswer);

  if (loginAccount && loginPassword) {
    [loginAccount, loginPassword].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    });
    initAdminBtn();
  }

  if (registerName && registerAccount && registerPassword && registerEmail) {
    [registerName, registerAccount, registerPassword, registerEmail].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleRegister();
      });
    });
  }

  initProfileBtn();
}

// 注册
async function handleRegister() {
  const displayName = registerName.value.trim();
  const account = registerAccount.value.trim();
  const password = registerPassword.value.trim();
  const email = registerEmail.value.trim();
  const msgEl = document.getElementById('register-msg');

  if (!displayName || !account || !password || !email) {
    msgEl.textContent = '用户名、账号、密码、邮箱不能为空！';
    return;
  }
  if (password.length < 6) {
    msgEl.textContent = '密码长度不能少于6位！';
    return;
  }

  const loading = document.getElementById('loading-overlay');
  const regBtn = document.getElementById('do-register');
  loading.style.display = 'flex';
  regBtn.disabled = true;

  try {
    const nicknameQuery = new AV.Query(AV.User);
    nicknameQuery.equalTo('nickname', displayName);
    if (await nicknameQuery.count() > 0) {
      msgEl.textContent = '用户名已被注册！';
      return;
    }

    const accountQuery = new AV.Query(AV.User);
    accountQuery.equalTo('username', account);
    if (await accountQuery.count() > 0) {
      msgEl.textContent = '账号已被注册！';
      return;
    }

    const emailQuery = new AV.Query(AV.User);
    emailQuery.equalTo('email', email);
    if (await emailQuery.count() > 0) {
      msgEl.textContent = '该邮箱已被绑定！';
      return;
    }

    const user = new AV.User();
    user.setUsername(account);
    user.setPassword(password);
    user.set('nickname', displayName);
    user.setEmail(email);
    await user.signUp();
    await AV.User.logOut();

    showAlert(`注册成功！验证邮件已发送至${email}，请验证后登录`);
    registerName.value = registerAccount.value = registerPassword.value = registerEmail.value = '';
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
  } catch (error) {
    msgEl.textContent = '注册失败：' + error.message;
  } finally {
    loading.style.display = 'none';
    regBtn.disabled = false;
  }
}

// 登录
async function handleLogin() {
  const account = loginAccount.value.trim();
  const password = loginPassword.value.trim();
  const msgEl = document.getElementById('login-msg');

  if (!account || !password) {
    msgEl.textContent = '账号、密码不能为空！';
    return;
  }

  const loading = document.getElementById('loading-overlay');
  const loginBtn = document.getElementById('do-login');
  loading.style.display = 'flex';
  loginBtn.disabled = true;

  try {
    const user = await AV.User.logIn(account, password);
    userState.isLogin = true;
    userState.username = user.get('nickname');
    userState.account = user.get('username');
    userState.userId = user.id;
    userState.email = user.get('email');

    await fetchUserGameLog();
    updateStatsDisplay();

    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    init();
    initRankingBtn();
  } catch (error) {
    msgEl.textContent = error.code === 205 ? '邮箱尚未验证！' : '账号或密码错误！';
  } finally {
    loading.style.display = 'none';
    loginBtn.disabled = false;
  }
}

// 退出登录
async function handleLogout() {
  const loading = document.getElementById('loading-overlay');
  const logoutBtn = document.getElementById('logout-btn');
  loading.style.display = 'flex';
  logoutBtn.disabled = true;

  await new Promise(resolve => setTimeout(resolve, 50));
  try {
    await AV.User.logOut();
    userState = { isLogin: false, username: '', account: '', userId: '', email: '' };
    gameState.gameLogId = '';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    if (loginAccount) loginAccount.value = '';
    if (loginPassword) loginPassword.value = '';
    document.getElementById('login-msg').textContent = '';
  } catch (error) {
    showAlert('退出失败');
  } finally {
    setTimeout(() => { loading.style.display = 'none'; logoutBtn.disabled = false; }, 400);
  }
}

// 初始化游戏数据
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
    const res = await gameLog.save();
    gameState.gameLogId = res.id;
    gameState.totalAccumulatedScore = gameState.totalGames = gameState.correctGames = gameState.accuracy = 0;
  } catch (e) { showAlert('初始化数据失败'); }
}

// 读取游戏数据
async function fetchUserGameLog() {
  if (!(await validateUserExists())) return;
  try {
    const query = new AV.Query('GameLog');
    query.equalTo('userId', userState.userId);
    const log = await query.first();
    if (log) {
      gameState.gameLogId = log.id;
      gameState.totalAccumulatedScore = log.get('totalAccumulatedScore') || 0;
      gameState.totalGames = log.get('totalGames') || 0;
      gameState.correctGames = log.get('correctGames') || 0;
      gameState.accuracy = log.get('accuracy') || 0;
    } else {
      await initUserGameLog();
    }
  } catch (e) { showAlert('读取数据失败'); }
}

// 更新游戏数据
async function updateUserGameLog() {
  if (!(await validateUserExists())) return;
  try {
    gameState.accuracy = gameState.totalGames ? Math.round(gameState.correctGames / gameState.totalGames * 100) : 0;
    const log = AV.Object.createWithoutData('GameLog', gameState.gameLogId);
    log.set('totalAccumulatedScore', gameState.totalAccumulatedScore);
    log.set('totalGames', gameState.totalGames);
    log.set('correctGames', gameState.correctGames);
    log.set('accuracy', gameState.accuracy);
    await log.save();
  } catch (e) {}
}

function init() {
  gameState.currentScore = 0;
  currentScoreEl.textContent = 0;
  const len = gameState.difficultyConfig[gameState.currentDifficulty];
  answerInput.placeholder = `输入${len}位数字`;
}

function initDifficultyHint() {
  difficultyHintText.textContent = gameState.difficultyHint[gameState.currentDifficulty];
  difficultySelect.addEventListener('change', e => {
    const d = e.target.value;
    if (!gameState.isPlaying) {
      gameState.currentDifficulty = d;
      const len = gameState.difficultyConfig[d];
      answerInput.placeholder = `输入${len}位数字`;
      difficultyHintText.textContent = gameState.difficultyHint[d];
    } else {
      showAlert('游戏中无法切换难度');
      e.target.value = gameState.currentDifficulty;
    }
  });
}

function startGame() {
  if (gameState.isPlaying) return;
  gameState.isPlaying = true;
  startBtn.disabled = true;
  difficultySelect.disabled = true;
  answerInput.disabled = true;
  submitBtn.disabled = true;
  answerInput.value = '';
  gameState.currentScore = 0;
  currentScoreEl.textContent = 0;

  const len = gameState.difficultyConfig[gameState.currentDifficulty];
  gameState.targetNumber = Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
  setDisplayDuration(len);

  if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);

  numberDisplay.innerHTML = '<span class="countdown-text">3</span>';
  countdownHint.textContent = "准备开始记忆！";
  setTimeout(() => numberDisplay.innerHTML = '<span class="countdown-text">2</span>', 1000);
  setTimeout(() => numberDisplay.innerHTML = '<span class="countdown-text">1</span>', 2000);
  setTimeout(() => {
    numberDisplay.innerHTML = '<span class="countdown-text">GO!</span>';
    countdownHint.textContent = "开始记忆！";
  }, 3000);

  setTimeout(() => {
    numberDisplay.textContent = gameState.targetNumber;
    let countdown = gameState.displayDuration;
    countdownHint.textContent = `记忆时间剩余：${countdown} 秒`;
    gameState.countdownTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(gameState.countdownTimer);
        gameState.countdownTimer = null;
        setTimeout(() => numberDisplay.textContent = '?', 300);
        countdownHint.textContent = '请输入数字';
        answerInput.disabled = false;
        submitBtn.disabled = false;
        answerInput.focus();
        return;
      }
      if (countdown === 1) numberDisplay.innerHTML = `<span class="blink-number">${gameState.targetNumber}</span>`;
      countdownHint.textContent = `记忆时间剩余：${countdown} 秒`;
    }, 1000);
  }, 3600);
}

function setDisplayDuration(len) {
  switch (len) {
    case 4: gameState.displayDuration = 2; break;
    case 6: gameState.displayDuration = 3; break;
    case 11: gameState.displayDuration = 5; break;
    case 18: gameState.displayDuration = 8; break;
    default: gameState.displayDuration = 2;
  }
}

function checkAnswer() {
  const ans = answerInput.value.trim();
  const len = gameState.difficultyConfig[gameState.currentDifficulty];
  if (!new RegExp(`^\\d{${len}}$`).test(ans)) {
    showAlert(`请输入${len}位数字`);
    return;
  }

  let correct = 0;
  for (let i = 0; i < len; i++) if (ans[i] === gameState.targetNumber[i]) correct++;
  const full = correct === len;
  gameState.totalGames++;
  if (full) gameState.correctGames++;
  const roundScore = full ? len * 2 : correct;
  gameState.totalAccumulatedScore += roundScore;
  gameState.currentScore = roundScore;

  updateUserGameLog();
  saveGameRecord(roundScore, len);
  updateStatsDisplay();
  currentScoreEl.textContent = roundScore;

  const userAnswer = ans;

  gameState.isPlaying = false;
  answerInput.disabled = true;
  submitBtn.disabled = true;
  startBtn.disabled = false;
  difficultySelect.disabled = false;
  if (gameState.countdownTimer) {
    clearInterval(gameState.countdownTimer);
    gameState.countdownTimer = null;
  }

  showResultModal(full, correct, roundScore, len, userAnswer);

  setTimeout(() => {
    numberDisplay.textContent = '?';
  }, 500);
}


function updateStatsDisplay() {
  totalAccumulatedScoreEl.textContent = gameState.totalAccumulatedScore;
  currentScoreEl.textContent = gameState.currentScore;
  totalGamesEl.textContent = gameState.totalGames;
  accuracyEl.textContent = gameState.accuracy + '%';
}

function showResultModal(ok, correct, score, len, userAnswer) {
  document.querySelectorAll('.modal,.result-modal').forEach(x => x.remove());

  const m = document.createElement('div'); 
  m.className = 'modal';
  const c = document.createElement('div'); 
  c.className = 'modal-content';
  const t = document.createElement('h2'); 
  t.textContent = ok ? '🎉 挑战成功' : '⚠️ 挑战失败';
  t.style.color = ok ? '#10b981' : '#ef4444';

  const correctAnswer = gameState.targetNumber;
  let correctHtml = '', userHtml = '';
  for (let i = 0; i < correctAnswer.length; i++) {
    correctHtml += `<span style="color:#10b981; font-weight:bold; margin:0 1px;">${correctAnswer[i]}</span>`;
    userHtml += `<span style="color:${userAnswer[i] === correctAnswer[i] ? '#10b981' : '#ef4444'}; font-weight:bold; margin:0 1px;">${userAnswer[i]}</span>`;
  }

  const info = document.createElement('div'); 
  info.className = 'detail-info';
  info.innerHTML = `
    <p>正确：${correct}/${len}</p>
    <p>本轮得分：${score}</p>
    <p>正确数字：</p>
    <p>${correctHtml}</p>
    <p>你的答案：</p>
    <p>${userHtml}</p>
  `;

  const btns = document.createElement('div'); 
  btns.className = 'modal-buttons';

  const cont = document.createElement('button'); 
  cont.className = 'btn modal-btn continue';
  cont.textContent = '继续'; 
  cont.onclick = () => { 
    answerInput.value = '';
    m.classList.add('closing'); 
    setTimeout(() => { 
      m.remove(); 
      numberDisplay.textContent = '?'; 
      startGame();
    }, 300); 
  };

  const end = document.createElement('button'); 
  end.className = 'btn modal-btn end';
  end.textContent = '结束'; 
  end.onclick = () => { 
  answerInput.value = '';
    m.classList.add('closing'); 
    setTimeout(() => { 
      m.remove(); 
      numberDisplay.textContent = '?'; 
      answerInput.value = ''; // 弹窗关闭才清空输入框
    }, 300); 
  };

  btns.append(cont, end); 
  c.append(t, info, btns); 
  m.append(c); 
  document.body.append(m);

  setTimeout(() => m.classList.add('active'), 10);
}


function initRankingBtn() { rankingBtn.onclick = showRankingModal; }
async function showRankingModal() {
  const m = document.createElement('div'); m.className = 'ranking-modal';
  const c = document.createElement('div'); c.className = 'ranking-content';
  const t = document.createElement('h2'); t.textContent = '🏆 排行榜';
  const list = document.createElement('ul'); list.className = 'ranking-list';
  list.innerHTML = `<div class="inner-loading"><div class="loading-spinner"></div>加载中...</div>`;
  const close = document.createElement('button'); close.className = 'ranking-close-btn';
  close.textContent = '关闭'; close.onclick = () => { m.classList.remove('active'); setTimeout(() => m.remove(), 300); };
  c.append(t, list, close); m.append(c); document.body.append(m);
  setTimeout(() => m.classList.add('active'), 10);
  const [data] = await Promise.all([getRankingData(), new Promise(r => setTimeout(r, 300))]);
  list.innerHTML = data.length === 0 ? '<li>暂无排行数据</li>' : '';
  data.forEach((item, index) => {
    const li = document.createElement('li'); li.className = 'ranking-item';
    const isMe = item.username === userState.username;
    li.innerHTML = `<span class="ranking-rank">${index+1}</span><span class="ranking-username">${item.username}${isMe?'<span class="current-user-tag">我</span>':''}</span><span class="ranking-score">${item.score}分</span>`;
    if (isMe) li.classList.add('current-user-item'); list.append(li);
  });
}

async function getRankingData() {
  if (!(await validateUserExists())) return [];
  try { const q = new AV.Query('GameLog'); q.descending('totalAccumulatedScore'); q.limit(10);
  const list = await q.find(); return list.map(x => ({ username: x.get('username'), score: x.get('totalAccumulatedScore')||0 })); } catch { return []; }
}

function showAlert(msg) {
  const a = document.createElement('div'); a.className = 'result-modal';
  const c = document.createElement('div'); c.className = 'result-content';
  c.innerHTML = `<h3>⚠️ 提示</h3><p>${msg}</p>`;
  const btn = document.createElement('button'); btn.className = 'result-btn'; btn.textContent = '确定';
  btn.onclick = () => a.remove(); c.append(btn); a.append(c); document.body.append(a);
  setTimeout(() => a.classList.add('active'), 10);
}

// ====================== 管理员功能======================
let isAdminMode = false;
function initAdminBtn() {
  const go = document.getElementById('go-admin');
  const exit = document.getElementById('exit-admin');
  go?.addEventListener('click', async () => {
    const user = loginAccount.value.trim();
    const pwd = loginPassword.value.trim();
    const loading = document.getElementById('loading-overlay');
    loading.style.display = 'flex'; go.disabled = true;
    try {
      if (user === 'lichengxue' && pwd === 'xswllcx') {
        isAdminMode = true;
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        await loadAllUserData();
      } else document.getElementById('login-msg').textContent = '管理员账号或密码错误';
    } finally { loading.style.display = 'none'; go.disabled = false; }
  });
  exit?.addEventListener('click', () => {
    const loading = document.getElementById('loading-overlay');
    loading.style.display = 'flex';
    setTimeout(() => {
      isAdminMode = false;
      document.getElementById('admin-panel').style.display = 'none';
      document.getElementById('login-modal').style.display = 'flex';
      if (loginAccount) loginAccount.value = '';
      if (loginPassword) loginPassword.value = '';
      document.getElementById('login-msg').textContent = '';
      loading.style.display = 'none';
    }, 300);
  });



     // 删除用户按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.innerText = '删除用户';
  deleteBtn.className = 'btn admin-delete-btn';

  const adminHeader = exit.parentElement;
  adminHeader.classList.add('admin-header');

  const btnGroup = document.createElement('div');
  btnGroup.classList.add('admin-header-buttons');

  btnGroup.appendChild(deleteBtn);
  btnGroup.appendChild(exit);
  adminHeader.appendChild(btnGroup);

  deleteBtn.onclick = () => {
    const modal = document.createElement('div');
    modal.className = 'ranking-modal';
    modal.style.zIndex = 99999;
    
    const content = document.createElement('div');
    content.className = 'ranking-content';
    content.style.padding = '24px';
    content.style.maxWidth = '400px';
    
    const h3 = document.createElement('h3');
    h3.innerText = '⚠️ 删除用户';
    h3.style.color = '#ef4444';
    
    const p1 = document.createElement('p');
    p1.innerText = '删除用户需登录 LeanCloud 控制台操作';
    
    const p2 = document.createElement('p');
    p2.style.fontSize = '12px';
    p2.style.color = '#666';
    p2.innerText = '点击确定后跳转到 LeanCloud 登录页';
    
    const btnWrap = document.createElement('div');
    btnWrap.style.display = 'flex';
    btnWrap.style.justifyContent = 'center'; // 居中
    btnWrap.style.gap = '10px';
    btnWrap.style.marginTop = '20px';
    btnWrap.style.width = '100%';
    
    const cancel = document.createElement('button');
    cancel.className = 'ranking-close-btn';
    cancel.innerText = '取消';
    cancel.style.flex = 1;
    cancel.style.maxWidth = '140px';
    
    const go = document.createElement('button');
    go.className = 'ranking-close-btn';
    go.innerText = '前往登录';
    go.style.flex = 1;
    go.style.maxWidth = '140px';
    go.style.backgroundColor = '#6366f1';
    go.style.color = '#fff';
    
    btnWrap.append(cancel, go);
    content.append(h3, p1, p2, btnWrap);
    modal.append(content);
    document.body.append(modal);
    
    setTimeout(() => modal.classList.add('active'), 10);
    
    cancel.onclick = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    };
    
    go.onclick = () => {
      window.open('https://console.leancloud.cn/apps/BEQfGnHF8BeBEFO88ViNPtKQ-gzGzoHsz/storage/data/_User', '_blank');
      cancel.onclick();
    };
  };
}



async function loadAllUserData() {
  const listEl = document.getElementById('admin-user-list');
  listEl.innerHTML = '<tr><td colspan="9">加载中...</td></tr>';
  try {
    const users = await new AV.Query(AV.User).limit(1000).find();
    const logs = await new AV.Query('GameLog').limit(1000).find();
    const logMap = new Map(); logs.forEach(log => logMap.set(log.get('userId'), log));
    const result = users.map(user => {
      const log = logMap.get(user.id);
      return {
        userId: user.id, nickname: user.get('nickname')||'未设置', account: user.get('username'),
        email: user.get('email')||'', score: log?.get('totalAccumulatedScore')||0,
        games: log?.get('totalGames')||0, accuracy: log?.get('accuracy')||0
      };
    }).sort((a,b)=>b.score-a.score);

    listEl.innerHTML = '';
    result.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx+1}</td><td>${item.nickname}</td><td>${item.account}</td>
        <td>${item.email||'未绑定'}</td><td>${item.score}</td><td>${item.games}</td>
        <td>${item.accuracy}%</td><td style="font-size:11px;">${item.userId}</td>
        <td>
          <button onclick="showResetPwdModal('${item.userId}','${item.nickname}','${item.account}','${item.email}')" style="padding:4px 8px;font-size:12px;background:#007aff;color:white;border:none;border-radius:4px;">发送重置</button>
        </td>`;
      listEl.appendChild(tr);
    });
  } catch (err) { listEl.innerHTML = `<tr><td colspan="9">加载失败</td></tr>`; }
}



function showResetPwdModal(userId, username, account, email) {
  const modal = document.createElement('div');
  modal.className = 'ranking-modal';
  modal.style.zIndex = 9999;

  const content = document.createElement('div');
  content.className = 'ranking-content';
  content.style.padding = '24px';
  content.style.width = '90%';
  content.style.maxWidth = '460px';

  // 标题
  const title = document.createElement('h3');
  title.textContent = '📩 发送密码重置链接';
  title.style.marginBottom = '16px';

  // 用户信息
  const info = document.createElement('div');
  info.style.fontSize = '14px';
  info.style.lineHeight = '1.8';
  info.innerHTML = `
    <div>用户：${username}</div>
    <div>账号：${account}</div>
  `;

  const emailWrap = document.createElement('div');
  emailWrap.style.display = 'flex';
  emailWrap.style.alignItems = 'center';
  emailWrap.style.gap = '8px';
  emailWrap.style.marginTop = '12px';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.value = email || '';
  emailInput.style.flex = 1;
  emailInput.style.padding = '10px 12px';
  emailInput.style.borderRadius = '6px';
  emailInput.style.border = '1px solid #ddd';
  emailInput.style.fontSize = '14px';
  emailInput.readOnly = true;
  emailInput.style.backgroundColor = '#f5f5f5';

  emailWrap.append(emailInput);

  // 提示文字
  const tip = document.createElement('div');
  tip.style.fontSize = '12px';
  tip.style.color = '#666';
  tip.style.marginTop = '8px';
  tip.textContent = '将发送重置链接到用户当前绑定邮箱，不可修改';

  // 按钮组
  const btnWrap = document.createElement('div');
  btnWrap.style.display = 'flex';
  btnWrap.style.justifyContent = 'center'; // 居中
  btnWrap.style.gap = '12px';
  btnWrap.style.marginTop = '20px';
  btnWrap.style.width = '100%';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'ranking-close-btn';
  cancelBtn.textContent = '取消';
  cancelBtn.style.flex = 1;
  cancelBtn.style.maxWidth = '140px';
  cancelBtn.style.borderRadius = '12px';
  cancelBtn.style.height = '48px';
  cancelBtn.style.fontSize = '16px';
  cancelBtn.style.background = '#eef2fb';
  cancelBtn.style.color = '#6366f1';
  cancelBtn.style.border = 'none';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'ranking-close-btn';
  sendBtn.textContent = '确认发送';
  sendBtn.style.flex = 1;
  sendBtn.style.maxWidth = '140px';
  sendBtn.style.borderRadius = '12px';
  sendBtn.style.height = '48px';
  sendBtn.style.fontSize = '16px';
  sendBtn.style.background = '#6366f1';
  sendBtn.style.color = '#ffffff';
  sendBtn.style.border = 'none';

  btnWrap.append(cancelBtn, sendBtn);
  content.append(title, info, emailWrap, tip, btnWrap);
  modal.append(content);
  document.body.append(modal);


  setTimeout(() => modal.classList.add('active'), 10);


  function closeModal() {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }

  cancelBtn.onclick = closeModal;

  // ====================== 自定义确认弹窗 ======================
  function showConfirmSend() {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'ranking-modal';
    confirmModal.style.zIndex = 10000;

    const confirmContent = document.createElement('div');
    confirmContent.className = 'ranking-content';
    confirmContent.style.padding = '24px';
    confirmContent.style.maxWidth = '420px';

    const confirmTitle = document.createElement('h3');
    confirmTitle.textContent = '⚠️ 确认发送';
    confirmTitle.style.marginBottom = '16px';

    const confirmText = document.createElement('p');
    confirmText.style.fontSize = '14px';
    confirmText.style.lineHeight = '1.8';
    confirmText.textContent = `确认发送重置密码链接到邮箱：${email}？`;

    const confirmBtnWrap = document.createElement('div');
    confirmBtnWrap.style.display = 'flex';
    confirmBtnWrap.style.justifyContent = 'center'; // 居中
    confirmBtnWrap.style.gap = '12px';
    confirmBtnWrap.style.marginTop = '20px';
    confirmBtnWrap.style.width = '100%';

    const confirmCancel = document.createElement('button');
    confirmCancel.className = 'ranking-close-btn';
    confirmCancel.textContent = '取消';
    confirmCancel.style.flex = 1;
    confirmCancel.style.maxWidth = '140px';
    confirmCancel.style.borderRadius = '12px';
    confirmCancel.style.height = '48px';
    confirmCancel.style.background = '#eef2fb';
    confirmCancel.style.color = '#6366f1';
    confirmCancel.style.border = 'none';

    const confirmOk = document.createElement('button');
    confirmOk.className = 'ranking-close-btn';
    confirmOk.textContent = '确认发送';
    confirmOk.style.flex = 1;
    confirmOk.style.maxWidth = '140px';
    confirmOk.style.borderRadius = '12px';
    confirmOk.style.height = '48px';
    confirmOk.style.background = '#6366f1';
    confirmOk.style.color = '#fff';
    confirmOk.style.border = 'none';

    confirmBtnWrap.append(confirmCancel, confirmOk);
    confirmContent.append(confirmTitle, confirmText, confirmBtnWrap);
    confirmModal.append(confirmContent);
    document.body.append(confirmModal);

    setTimeout(() => confirmModal.classList.add('active'), 10);

    function closeConfirm() {
      confirmModal.classList.remove('active');
      setTimeout(() => confirmModal.remove(), 300);
    }

    confirmCancel.onclick = closeConfirm;

    confirmOk.onclick = async () => {
      closeConfirm();
      try {
        await AV.User.requestPasswordReset(email);
        // ====================== 发送成功弹窗 ======================
        const successModal = document.createElement('div');
        successModal.className = 'ranking-modal';
        successModal.style.zIndex = 10000;

        const successContent = document.createElement('div');
        successContent.className = 'ranking-content';
        successContent.style.padding = '24px';
        successContent.style.maxWidth = '380px';
        successContent.style.textAlign = 'center'; // 文字+按钮居中

        const successTitle = document.createElement('h3');
        successTitle.textContent = '✅ 发送成功';
        successTitle.style.color = '#10b981';
        successTitle.style.marginTop = '0';

        const successText = document.createElement('p');
        successText.style.marginTop = '12px';
        successText.textContent = '密码重置链接已发送至用户邮箱';

        const successBtnWrap = document.createElement('div');
        successBtnWrap.style.marginTop = '20px';
        successBtnWrap.style.display = 'flex';
        successBtnWrap.style.justifyContent = 'center';

        const successOk = document.createElement('button');
        successOk.className = 'ranking-close-btn';
        successOk.textContent = '确定';
        successOk.style.width = '160px';
        successOk.style.borderRadius = '12px';
        successOk.style.height = '48px';
        successOk.style.background = '#6366f1';
        successOk.style.color = '#fff';
        successOk.style.border = 'none';

        successBtnWrap.append(successOk);
        successContent.append(successTitle, successText, successBtnWrap);
        successModal.append(successContent);
        document.body.append(successModal);
        setTimeout(() => successModal.classList.add('active'), 10);

        successOk.onclick = () => {
          successModal.classList.remove('active');
          setTimeout(() => successModal.remove(), 300);
          closeModal();
        };

      } catch (err) {
        const errModal = document.createElement('div');
        errModal.className = 'ranking-modal';
        errModal.style.zIndex = 10000;

        const errContent = document.createElement('div');
        errContent.className = 'ranking-content';
        errContent.style.padding = '24px';
        errContent.style.maxWidth = '380px';
        errContent.style.textAlign = 'center'; // 文字+按钮居中

        const errTitle = document.createElement('h3');
        errTitle.textContent = '❌ 发送失败';
        errTitle.style.color = '#ef4444';
        errTitle.style.marginTop = '0';

        const errText = document.createElement('p');
        errText.style.marginTop = '12px';
        errText.textContent = err.message;

        const errBtnWrap = document.createElement('div');
        errBtnWrap.style.marginTop = '20px';
        errBtnWrap.style.display = 'flex';
        errBtnWrap.style.justifyContent = 'center';

        const errOk = document.createElement('button');
        errOk.className = 'ranking-close-btn';
        errOk.textContent = '确定';
        errOk.style.width = '160px';
        errOk.style.borderRadius = '12px';
        errOk.style.height = '48px';
        errOk.style.background = '#6366f1';
        errOk.style.color = '#fff';
        errOk.style.border = 'none';

        errBtnWrap.append(errOk);
        errContent.append(errTitle, errText, errBtnWrap);
        errModal.append(errContent);
        document.body.append(errModal);
        setTimeout(() => errModal.classList.add('active'), 10);
        
        errOk.onclick = () => {
          errModal.classList.remove('active');
          setTimeout(() => errModal.remove(), 300);
        };
      }
    };
  }

  sendBtn.onclick = showConfirmSend;
}




// ====================== 个人中心======================
function initProfileBtn() {
  document.getElementById('profile-btn').onclick = async () => {
    const modal = document.getElementById('profile-modal');
    const recordsEl = document.getElementById('profile-records');

    document.getElementById('profile-account').innerText = userState.account;
    document.getElementById('profile-nickname').innerText = userState.username;
    document.getElementById('profile-total-score').innerText = gameState.totalAccumulatedScore;
    document.getElementById('profile-total-games').innerText = gameState.totalGames;
    document.getElementById('profile-accuracy').innerText = gameState.accuracy + '%';

    recordsEl.innerHTML = `
      <div class="inner-loading">
        <div class="loading-spinner"></div>
        加载游戏记录中...
      </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    await loadGameRecords();

    document.getElementById('close-profile').onclick = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
    };
  };

  // 修改昵称按钮
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'edit-nickname-btn') {
      editNickname();
    }
  });
}

// 加载游戏记录
async function loadGameRecords() {
  const container = document.getElementById('profile-records');
  container.innerHTML = `<div class="inner-loading"><div class="loading-spinner"></div>加载游戏记录中...</div>`;

  try {
    const query = new AV.Query('GameRecord');
    query.equalTo('userId', userState.userId);
    query.descending('createdAt');
    query.limit(30);

    const [list] = await Promise.all([
      query.find(),
      new Promise(resolve => setTimeout(resolve, 300))
    ]);

    if (list.length === 0) {
      container.innerHTML = '<p>暂无游戏记录</p>';
      return;
    }

    let html = '';
    list.forEach(item => {
      const score = item.get('score');
      const len = item.get('length') || 0;
      const time = new Date(item.createdAt).toLocaleString();
      html += `<div class="record-item">位数：${len} 位 | 得分：${score} 分 <span class="right">${time}</span></div>`;
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p>加载失败</p>';
    console.error('个人中心记录加载错误', e);
  }
}

// 修改昵称
async function editNickname() {
  if (gameState.totalAccumulatedScore < 100) {
    showAlert('❌ 需要 100 分才能修改昵称');
    return;
  }

  // 自定义弹窗
  const modal = document.createElement('div');
  modal.className = 'ranking-modal';
  modal.style.zIndex = 9999;

  const content = document.createElement('div');
  content.className = 'ranking-content';
  content.style.padding = '24px';
  content.style.width = '90%';
  content.style.maxWidth = '420px';

  // 标题
  const h3 = document.createElement('h3');
  h3.textContent = '✏️ 修改昵称';
  h3.style.marginBottom = '16px';

  // 输入框
  const input = document.createElement('input');
  input.type = 'text';
  input.value = userState.username;
  input.style.width = '100%';
  input.style.padding = '12px';
  input.style.borderRadius = '6px';
  input.style.border = '1px solid #ddd';
  input.style.fontSize = '15px';
  input.placeholder = '请输入新昵称';

  // 提示
  const tip = document.createElement('div');
  tip.style.fontSize = '12px';
  tip.style.color = '#666';
  tip.style.marginTop = '8px';
  tip.textContent = '修改将消耗 100 积分';

  // 按钮
  const btnWrap = document.createElement('div');
  btnWrap.style.display = 'flex';
  btnWrap.style.gap = '12px';
  btnWrap.style.marginTop = '20px';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'ranking-close-btn';
  cancelBtn.textContent = '取消';
  cancelBtn.style.flex = 1;

  const okBtn = document.createElement('button');
  okBtn.className = 'ranking-close-btn';
  okBtn.textContent = '确认修改';
  okBtn.style.flex = 1;

  btnWrap.append(cancelBtn, okBtn);
  content.append(h3, input, tip, btnWrap);
  modal.append(content);
  document.body.appendChild(modal);


  setTimeout(() => modal.classList.add('active'), 10);

 
  function close() {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }

  cancelBtn.onclick = close;

  // 确认修改
  okBtn.onclick = async () => {
    const newName = input.value.trim();
    if (!newName) {
      showAlert('昵称不能为空');
      return;
    }

    // 检查昵称是否已存在
    try {
      const query = new AV.Query(AV.User);
      query.equalTo('nickname', newName);
      const count = await query.count();

      // 如果已经存在同名用户
      if (count > 0) {
        showAlert('❌ 该昵称已被使用，请换一个');
        return;
      }
    } catch (e) {
      showAlert('❌ 检查昵称失败，请重试');
      return;
    }

    close(); 

    try {
      const user = AV.User.current();
      const userId = user.id;

      user.set('nickname', newName);
      await user.save();

      // 更新游戏日志
      const logQuery = new AV.Query('GameLog');
      logQuery.equalTo('userId', userId);
      const log = await logQuery.first();
      if (log) {
        log.set('username', newName);
        await log.save();
      }

      // 更新记录
      const recordQuery = new AV.Query('GameRecord');
      recordQuery.equalTo('userId', userId);
      recordQuery.limit(1000);
      const records = await recordQuery.find();
      if (records.length > 0) {
        records.forEach(r => r.set('username', newName));
        await AV.Object.saveAll(records);
      }

      // 扣分
      gameState.totalAccumulatedScore -= 100;
      const logUpdate = AV.Object.createWithoutData('GameLog', gameState.gameLogId);
      logUpdate.set('totalAccumulatedScore', gameState.totalAccumulatedScore);
      await logUpdate.save();

      // 同步界面
      userState.username = newName;
      updateStatsDisplay();
document.getElementById('profile-nickname').innerText = newName;
document.getElementById('profile-total-score').innerText = gameState.totalAccumulatedScore;
document.getElementById('profile-total-games').innerText = gameState.totalGames;
document.getElementById('profile-accuracy').innerText = gameState.accuracy + '%';



      showAlert('✅ 修改成功！');
    } catch (err) {
      showAlert('❌ 修改失败：' + err.message);
    }
  };
}



// 保存游戏记录
function saveGameRecord(score, length) {
  if (!userState.isLogin) return;

  const Record = AV.Object.extend('GameRecord');
  const r = new Record();
  r.set('userId', userState.userId);
  r.set('username', userState.username);
  r.set('score', score);
  r.set('length', length);

  r.save().then(async () => {
    try {
      const query = new AV.Query('GameRecord');
      query.equalTo('userId', userState.userId);
      query.descending('createdAt');
      query.limit(100);
      const list = await query.find();
      if (list.length > 10) await AV.Object.destroyAll(list.slice(10));
    } catch (e) {}
  });
}