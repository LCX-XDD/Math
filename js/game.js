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
  // 一开始全局都隐藏，不会闪任何面板
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('game-container').style.display = 'none';

  initGlobalElements();
  await initAuth(); // 这里会做 validateUserExists

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
}

// 验证当前用户是否真实存在于数据库（被删除则自动登出）
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

// 强制登出并跳转登录页
async function forceLogout() {
  try {
    await AV.User.logOut();
  } catch (e) {}
  
  userState = { isLogin: false, username: '', account: '', userId: '', email: '' };
  gameState.gameLogId = '';

  document.getElementById('game-container').style.display = 'none';
  document.getElementById('login-modal').style.display = 'flex';
  showAlert('账号已被删除或不存在，已强制退出登录');
}

// 初始化登录状态
async function initAuth() {
  const currentUser = AV.User.current();
  
  if (currentUser) {
    // 在这里验证，不会导致页面崩溃
    if (!(await validateUserExists())) {
      return;
    }

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

    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
  } else {
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none';
  }

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
  startBtn.addEventListener('click', startGame);
  submitBtn.addEventListener('click', checkAnswer);

  if (loginAccount && loginPassword) {
    [loginAccount, loginPassword].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLogin();
        }
      });
    });
    initAdminBtn();
  }

  if (registerName && registerAccount && registerPassword && registerEmail) {
    [registerName, registerAccount, registerPassword, registerEmail].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleRegister();
        }
      });
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal.active, .ranking-modal.active, .result-modal.active');
      if (activeModal) {
        if (activeModal.classList.contains('ranking-modal')) {
          activeModal.classList.remove('active');
          setTimeout(() => activeModal.remove(), 300);
        } else {
          activeModal.remove();
        }
      }
    }
  });

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msgEl.textContent = '请输入有效的邮箱！';
    return;
  }

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

    showAlert(`
<div style="text-align:center; line-height:1.8;">
  <strong>✅ 注册成功！</strong><br>
  验证邮件已发送至你的邮箱：<br>
  <strong style="color:#0066ff; font-size:16px; display:block; margin:6px 0;">${email}</strong>
  请登录邮箱点击验证链接，完成激活后登录。<br>
  <span style="font-size:12px; color:#0066ff;">（未验证会导致登录提示账号密码错误）</span>
</div>
`);

    registerName.value = '';
    registerAccount.value = '';
    registerPassword.value = '';
    registerEmail.value = '';
    msgEl.textContent = '';
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
  } catch (error) {
    msgEl.textContent = '注册失败：' + error.message;
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

    loginAccount.value = '';
    loginPassword.value = '';
    msgEl.textContent = '';
  } catch (error) {
    if (error.code === 205) {
      msgEl.textContent = '邮箱尚未验证！';
    } else {
      msgEl.textContent = '账号或密码错误！';
    }
  }
}

// 退出登录
async function handleLogout() {
  try {
    await AV.User.logOut();
    userState = { isLogin: false, username: '', account: '', userId: '', email: '' };
    gameState.gameLogId = '';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
  } catch (error) {
    showAlert('退出失败');
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

    gameState.totalAccumulatedScore = 0;
    gameState.totalGames = 0;
    gameState.correctGames = 0;
    gameState.accuracy = 0;

  } catch (e) {
    showAlert('初始化数据失败');
    console.error(e);
  }
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

  } catch (e) {
    showAlert('读取数据失败，请稍后重试');
    console.error('读取数据异常', e);
  }
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

  numberDisplay.textContent = gameState.targetNumber;
  numberDisplay.classList.remove('fade-out');

  let countdown = gameState.displayDuration;
  countdownHint.textContent = `记忆时间剩余：${countdown} 秒`;

  if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);
  gameState.countdownTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(gameState.countdownTimer);
      gameState.countdownTimer = null;

      setTimeout(() => {
        numberDisplay.textContent = '?';
        numberDisplay.classList.remove('fade-out');
      }, 400);

      countdownHint.textContent = '请输入数字';
      answerInput.disabled = false;
      submitBtn.disabled = false;
      answerInput.focus();
    } else {
      countdownHint.textContent = `记忆时间剩余：${countdown} 秒`;
      if (countdown === 1) numberDisplay.classList.add('fade-out');
    }
  }, 1000);
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
  showResultModal(full, correct, roundScore, len, len - correct, 0, 0);

  gameState.isPlaying = false;
  answerInput.disabled = true;
  submitBtn.disabled = true;
  startBtn.disabled = false;
  difficultySelect.disabled = false;

  if (gameState.countdownTimer) {
    clearInterval(gameState.countdownTimer);
    gameState.countdownTimer = null;
  }
}

function updateStatsDisplay() {
  totalAccumulatedScoreEl.textContent = gameState.totalAccumulatedScore;
  currentScoreEl.textContent = gameState.currentScore;
  totalGamesEl.textContent = gameState.totalGames;
  accuracyEl.textContent = gameState.accuracy + '%';
}

function showResultModal(ok, correct, score, len, wrong, a, b) {
  document.querySelectorAll('.modal,.result-modal').forEach(x => x.remove());
  const m = document.createElement('div');
  m.className = 'modal';
  const c = document.createElement('div');
  c.className = 'modal-content';
  const t = document.createElement('h2');
  t.textContent = ok ? '🎉 挑战成功' : '⚠️ 挑战失败';
  t.style.color = ok ? '#10b981' : '#ef4444';
  const info = document.createElement('div');
  info.className = 'detail-info';
  info.innerHTML = `<p>正确：${correct}/${len}</p><p>本轮得分：${score}</p>`;
  const btns = document.createElement('div');
  btns.className = 'modal-buttons';

  const cont = document.createElement('button');
  cont.className = 'btn modal-btn continue';
  cont.textContent = '继续';
  cont.onclick = () => { m.remove(); startGame(); };

  const end = document.createElement('button');
  end.className = 'btn modal-btn end';
  end.textContent = '结束';
  end.onclick = () => {
    m.remove();
    gameState.isPlaying = false;
    numberDisplay.textContent = '?';
    answerInput.value = '';
  };

  btns.append(cont, end);
  c.append(t, info, btns);
  m.append(c);
  document.body.append(m);
  setTimeout(() => m.classList.add('active'), 10);
}

function initRankingBtn() {
  rankingBtn.onclick = showRankingModal;
}

async function showRankingModal() {
  const m = document.createElement('div');
  m.className = 'ranking-modal';
  const c = document.createElement('div');
  c.className = 'ranking-content';
  const t = document.createElement('h2');
  t.textContent = '🏆 排行榜';
  const list = document.createElement('ul');
  list.className = 'ranking-list';
  list.innerHTML = '<li>加载中...</li>';
  const close = document.createElement('button');
  close.className = 'ranking-close-btn';
  close.textContent = '关闭';
  close.onclick = () => { m.classList.remove('active'); setTimeout(() => m.remove(), 300); };
  c.append(t, list, close);
  m.append(c);
  document.body.append(m);
  setTimeout(() => m.classList.add('active'), 10);

  const data = await getRankingData();
  list.innerHTML = '';
  data.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'ranking-item';
    const isCurrentUser = item.username === userState.username;
    li.innerHTML = `
      <span class="ranking-rank">${index + 1}</span>
      <span class="ranking-username">
        ${item.username}
        ${isCurrentUser ? '<span class="current-user-tag">我</span>' : ''}
      </span>
      <span class="ranking-score">${item.score} 分</span>
    `;
    if (isCurrentUser) li.classList.add('current-user-item');
    list.append(li);
  });
}

async function getRankingData() {
  if (!(await validateUserExists())) return [];
  try {
    const q = new AV.Query('GameLog');
    q.descending('totalAccumulatedScore');
    q.limit(10);
    const list = await q.find();
    return list.map(x => ({ username: x.get('username'), score: x.get('totalAccumulatedScore') || 0 }));
  } catch { return []; }
}

function showAlert(msg) {
  const a = document.createElement('div');
  a.className = 'result-modal';
  const c = document.createElement('div');
  c.className = 'result-content';
  c.innerHTML = `<h3>⚠️ 提示</h3><p>${msg}</p>`;
  const btn = document.createElement('button');
  btn.className = 'result-btn';
  btn.textContent = '确定';
  btn.onclick = () => a.remove();
  c.append(btn);
  a.append(c);
  document.body.append(a);
  setTimeout(() => a.classList.add('active'), 10);
}

// ====================== 管理员功能 ======================
let isAdminMode = false;

function initAdminBtn() {
  const go = document.getElementById('go-admin');
  const exit = document.getElementById('exit-admin');
  go?.addEventListener('click', () => {
    const user = loginAccount.value.trim();
    const pwd = loginPassword.value.trim();
    if (user === 'lichengxue' && pwd === 'xswllcx') {
      isAdminMode = true;
      document.getElementById('login-modal').style.display = 'none';
      document.getElementById('admin-panel').style.display = 'block';
      loadAllUserData();
    } else {
      document.getElementById('login-msg').textContent = '管理员账号或密码错误';
    }
  });
  exit?.addEventListener('click', () => {
    isAdminMode = false;
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
  });
}

async function loadAllUserData() {
  const listEl = document.getElementById('admin-user-list');
  listEl.innerHTML = '<tr><td colspan="9">加载中...</td></tr>';

  try {
    const users = await new AV.Query(AV.User).limit(1000).find();
    const logs = await new AV.Query('GameLog').limit(1000).find();
    const logMap = new Map();
    logs.forEach(log => logMap.set(log.get('userId'), log));

    const result = users.map(user => {
      const log = logMap.get(user.id);
      return {
        userId: user.id,
        nickname: user.get('nickname') || '未设置',
        account: user.get('username'),
        email: user.get('email') || '',
        score: log ? log.get('totalAccumulatedScore') || 0 : 0,
        games: log ? log.get('totalGames') || 0 : 0,
        accuracy: log ? log.get('accuracy') || 0 : 0
      };
    });

    result.sort((a, b) => b.score - a.score);
    listEl.innerHTML = '';
    result.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${item.nickname}</td>
        <td>${item.account}</td>
        <td>${item.email || '未绑定'}</td>
        <td>${item.score}</td>
        <td>${item.games}</td>
        <td>${item.accuracy}%</td>
        <td style="font-size:11px;">${item.userId}</td>
        <td>
          <button onclick="showResetPwdModal('${item.userId}','${item.nickname}','${item.account}','${item.email}')"
          style="padding:4px 8px;font-size:12px;background:#007aff;color:white;border:none;border-radius:4px;">
          发送重置链接</button>
        </td>`;
      listEl.appendChild(tr);
    });
  } catch (err) {
    listEl.innerHTML = `<tr><td colspan="9">加载失败</td></tr>`;
  }
}

function showResetPwdModal(userId, username, account, email) {
  document.querySelector('.reset-pwd-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'reset-pwd-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
  const content = document.createElement('div');
  content.style.cssText = 'background:white;padding:24px;border-radius:12px;width:320px';

  const hasEmail = !!email;
  content.innerHTML = `
    <h3>发送重置链接</h3>
    <div>用户名：${username}</div>
    <div>账号：${account}</div>
    <div>邮箱：${email || '未绑定'}</div>
    ${hasEmail ? '<input id="reset-email" type="email" value="' + email + '" readonly style="width:100%;padding:10px;margin:10px 0">' : ''}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button id="cancel" style="flex:1;padding:10px">取消</button>
      <button id="send" style="flex:1;padding:10px;background:#007aff;color:white" ${hasEmail ? '' : 'disabled'}>发送</button>
    </div>`;

  modal.appendChild(content);
  document.body.appendChild(modal);
  document.getElementById('cancel').onclick = () => modal.remove();
  if (hasEmail) {
    document.getElementById('send').onclick = async () => {
      await AV.User.requestPasswordReset(email);
      alert('✅ 已发送');
      modal.remove();
    };
  }
}

// ====================== 个人中心 ======================
function initProfileBtn() {
  document.getElementById('profile-btn').onclick = async () => {
    const modal = document.getElementById('profile-modal');
    document.getElementById('profile-account').innerText = userState.account;
    document.getElementById('profile-nickname').innerText = userState.username;
    document.getElementById('profile-total-score').innerText = gameState.totalAccumulatedScore;
    document.getElementById('profile-total-games').innerText = gameState.totalGames;
    document.getElementById('profile-accuracy').innerText = gameState.accuracy + '%';
    loadGameRecords();
    modal.style.display = 'flex';

    document.getElementById('close-profile').onclick = () => {
      modal.style.display = 'none';
    };
  };

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'edit-nickname-btn') {
      editNickname();
    }
  });
}

async function loadGameRecords() {
  const container = document.getElementById('profile-records');
  container.innerHTML = '加载中...';
  try {
    const query = new AV.Query('GameRecord');
    query.equalTo('userId', userState.userId);
    query.descending('createdAt');
    query.limit(30);
    const list = await query.find();
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
  }
}

// 修改昵称
async function editNickname() {
  if (gameState.totalAccumulatedScore < 100) {
    showAlert('❌ 需要 100 分才能修改昵称');
    return;
  }

  const newName = prompt('请输入新昵称（消耗100分）：', userState.username);
  if (!newName || newName.trim() === '') return;
  if (!confirm('确认修改？扣除100分！')) return;

  try {
    const user = AV.User.current();
    const userId = user.id;

    user.set('nickname', newName);
    await user.save();

    const logQuery = new AV.Query('GameLog');
    logQuery.equalTo('userId', userId);
    const log = await logQuery.first();
    if (log) {
      log.set('username', newName);
      await log.save();
    }

    const recordQuery = new AV.Query('GameRecord');
    recordQuery.equalTo('userId', userId);
    recordQuery.limit(1000);
    const records = await recordQuery.find();
    for (let record of records) {
      record.set('username', newName);
    }
    await AV.Object.saveAll(records);

    gameState.totalAccumulatedScore -= 100;
    const logUpdate = AV.Object.createWithoutData('GameLog', gameState.gameLogId);
    logUpdate.set('totalAccumulatedScore', gameState.totalAccumulatedScore);
    await logUpdate.save();

    userState.username = newName;
    updateStatsDisplay();
    document.getElementById('profile-nickname').innerText = newName;

    showAlert('✅ 修改成功！所有数据已同步更新');

  } catch (err) {
    console.error('修改失败', err);
    showAlert('修改失败：' + err.message);
  }
}

function saveGameRecord(score, length) {
  validateUserExists();
  const Record = AV.Object.extend('GameRecord');
  const r = new Record();
  r.set('userId', userState.userId);
  r.set('username', userState.username);
  r.set('score', score);
  r.set('length', length);
  r.save().catch(console.error);
}