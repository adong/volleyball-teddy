/* 中文 for VolleyBaTTle: the words on the page, the banners and toasts, the ? panel (Kit.lang, from kit/lang.js), and
   the comic words drawn in 3D (js/fx.js asks Kit.lang.t for them).
   The kids' names, the other players' names (except the zombie), the game's name and logo, and key names stay in English. */
(function () {
  const L = Kit.lang;
  L.keep(['VolleyBaTTle', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Zoom', 'Luna', 'Bolt', 'Bruno',
    'TEDDY & TOMMY', 'VS', 'Claude Code', 'Esc']);

  L.add({
    // title screen
    "Beach volleyball for two brothers. Bounce it off your head, jump and SPIKE it, and don't let it touch your sand!":
      '兄弟俩的沙滩排球！用头顶球，跳起来扣杀，别让球落在你这边的沙子上！',
    '+ buddy': '+ 帮手', 'ZOMBIE': '僵尸', 'CPU · 2P': '电脑 · 2P',
    'Previous player': '上一个', 'Next player': '下一个',
    '▶ 1 PLAYER': '▶ 单人', 'you vs the computer': '你和电脑比赛',
    '👫 2 PLAYERS': '👫 双人', 'one keyboard, two kids': '一个键盘，两个人玩',
    'CPU': '电脑', '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通',
    'FIRST TO': '先得几分', 'SPEED': '速度', '🐢 CHILL': '🐢 慢慢来', '🐇 CLASSIC': '🐇 经典',
    'REPLAY': '回放', '🎬 ON': '🎬 开', 'OFF': '关',
    'Computer': '电脑', 'Points to win': '赢要几分', 'Game speed': '游戏速度', 'Replay of the winning point': '致胜一球的回放',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2',
    'spike (in the air) · dive (on the sand)': '扣球（在空中）· 鱼跃（在沙地上）',
    'hold while spiking: smash down': '扣球时按住：往下砸',
    "◀ ▶ to run, ⬆ to jump, 💥 in the air to SPIKE or on the sand to DIVE, and tap your brother's face to call him in. Two players need a keyboard.":
      '◀ ▶ 跑，⬆ 跳，💥 在空中是扣球，在沙地上是鱼跃救球。点兄弟的头像叫他来帮忙。双人要用键盘。',
    // the scoreboard, buttons and their tooltips
    'YOU': '你', 'Call your brother': '叫兄弟来帮忙', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'Move left': '向左', 'Move right': '向右', 'JUMP': '跳', 'SPIKE·DIVE': '扣球·鱼跃',
    // banners and toasts
    'GAME!': '比赛结束！', 'MATCH POINT!': '赛点！',
    // the replay
    '🎬 REPLAY': '🎬 回放', 'the winning spike · tap to skip': '致胜扣球 · 点一下跳过', 'the winning point · tap to skip': '致胜一球 · 点一下跳过',
    // pause and results
    'P · Esc · Space to resume · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    '↻ PLAY AGAIN': '↻ 再玩一次', 'Enter play again · R replay · Esc menu': '回车 再玩一次 · R 回放 · Esc 回菜单',
    'points': '得分', 'spikes': '扣球', 'diving saves': '鱼跃救球', 'brother saves': '兄弟救球', 'longest rally': '最长回合',
    'So close! Call your brother in and try again!': '差一点点！叫兄弟来帮忙，再试一次！',
    'LOADING…': '加载中…', '↻ Turn sideways for a bigger court!': '↻ 把手机横过来，球场更大！',
    // the ? panel (js/keys.js)
    "In 1 player: ◀ ▶, ⬆ JUMP and 💥. Tap your brother's face to call him.": '单人模式：◀ ▶ 跑，⬆ 跳，💥 扣球或鱼跃。点兄弟的头像叫他来帮忙。',
    // comic words drawn in 3D (js/fx.js)
    'POW!': '砰！', 'WHAM!': '嘭！', 'KAPOW!': '轰隆！', 'SMASH!': '扣杀！', 'BOOM!': '轰！',
    'SAVED!': '救到啦！', 'SET!': '托球！', 'DIG!': '救球！', 'POINT!': '得分！',
  });

  const name = (n) => L.t(n);
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^FIRST TO (\d+)$/, '先得 $1 分就赢');
  L.rule(/^POINT (.+)!$/, (m, n) => `${name(n)} 得分！`);
  L.rule(/^(.+) SPIKES IT!$/, (m, n) => `${name(n)} 扣球得分！`);
  L.rule(/^(.+) WINS!$/, (m, n) => `${name(n)} 赢啦！`);
  L.rule(/^(.+) SAVED IT!$/, (m, n) => `${name(n)} 救到球啦！`);
  L.rule(/^(.+)'S HERE TO HELP!$/, (m, n) => `${name(n)} 来帮忙啦！`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${name(who)} 送来的${TREAT[item]}！`);
  L.rule(/^Call (.+)$/, (m, n) => `叫 ${name(n)} 来帮忙`);
  L.rule(/^(\d+) to (\d+)\. What a match!$/, '$1 比 $2，比赛太精彩了！');
  L.rule(/^(\d+(?:\.\d+)?) s$/, '$1 秒');
  L.rule(/^Oops, this browser could not start the game \((.*)\)$/, '哎呀，这个浏览器开不了游戏（$1）');
})();
