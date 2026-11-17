/* App chrome themes; chart/candle colors remain controlled by Chart Settings. */
window.TerminalThemes = (() => {
  function contrastingInk(background) {
    const [red, green, blue] = background.slice(1).match(/../g).map(hex => {
      const channel = parseInt(hex, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    return luminance > 0.179 ? '#000' : '#fff';
  }

  const make = (id,name,mode,chrome,well,panel,text,muted,accent,secondary=muted) => {
    const dark=mode==='dark';
    return {id,name,mode,colors:{chrome,well,panel,text,muted,accent,
      'chrome-well':well,'bg':chrome,'glass':panel,'glass2':dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.055)',
      'trade-buy-ink':contrastingInk(accent),
      'trade-sell-bg':secondary,
      'trade-sell-ink':contrastingInk(secondary),
      line:dark?'rgba(255,255,255,.13)':'rgba(20,25,35,.14)','accent-ink':dark?'#101114':'#fff',ok:dark?'#4ade80':'#15803d'},
      swatches:[accent,panel,text]};
  };
  const originalThemes = [
    make('dark','Dark','dark','#111318','#0b0d11','rgba(26,29,35,.94)','#eef1f6','#9ca5b3','#8aa5ff'),
    make('light','Light','light','#f4f4f5','#ececef','rgba(255,255,255,.94)','#18181b','#71717a','#2563eb'),
    make('8008','8008','dark','#20232a','#181b21','rgba(42,46,55,.95)','#e6e9ef','#aab2c0','#ed4b7a'),
    make('9009','9009','light','#efeee8','#e7e6df','rgba(255,255,255,.94)','#171717','#77766f','#111111'),
    make('80s-after-dark','80s after dark','dark','#17172a','#10101e','rgba(31,31,55,.95)','#f0e7ff','#aaa1c5','#f08dc9'),
    make('aether','aether','dark','#171824','#0f1119','rgba(27,30,40,.95)','#e9d8eb','#a99bad','#d78bd1'),
    make('alpine','alpine','dark','#565465','#454453','rgba(75,73,91,.95)','#f3f1f8','#cbc7d4','#9a95ad'),
    make('aurora','aurora','dark','#10202a','#0a171e','rgba(15,39,48,.95)','#e8faf6','#96b5b3','#00d99c'),
    make('beach','beach','light','#f8eab7','#eee0a9','rgba(255,250,223,.95)','#34494a','#758a79','#93c3b3'),
    make('bento','bento','dark','#263448','#1b2736','rgba(37,51,69,.95)','#eef2f7','#a9b6c5','#ff7296'),
    make('blue-dolphin','blue dolphin','dark','#073d50','#062f3f','rgba(7,52,68,.96)','#daf6ff','#80b8c6','#54d9f1'),
    make('blueberry-dark','blueberry dark','dark','#202a3c','#172132','rgba(31,43,61,.96)','#dce8f6','#9dafc7','#8cbcff'),
    make('blueberry-light','blueberry light','light','#e9edf7','#dce3f1','rgba(249,250,255,.96)','#303b51','#708097','#54709a'),
    make('breeze','breeze','light','#eadacb','#dfcdbc','rgba(248,238,228,.96)','#302c33','#756c70','#8063ac'),
    make('catppuccin','catppuccin','dark','#242438','#191927','rgba(37,37,58,.96)','#e8e2f2','#aaa6c1','#cba6f7'),
    make('cyberspace','cyberspace','dark','#14211d','#0b1713','rgba(19,34,28,.96)','#dbf6e8','#8fac9c','#00d68f'),
    make('dracula','dracula','dark','#282a36','#1e202b','rgba(43,45,59,.96)','#f1f1f4','#a9a9ba','#bd93f9'),
    make('github','github','dark','#20242b','#171a20','rgba(32,37,45,.96)','#e6edf3','#a3acb7','#2da44e'),
    make('gruvbox-dark','gruvbox dark','dark','#282828','#1d2021','rgba(40,40,40,.96)','#ebdbb2','#bdae93','#fabd2f'),
    make('gruvbox-light','gruvbox light','light','#f2e7bd','#e9ddaF','rgba(250,243,218,.96)','#3c3836','#7c6f64','#689d6a'),
    make('iceberg-dark','iceberg dark','dark','#1c202b','#131720','rgba(32,37,49,.96)','#d4dbea','#919db2','#83a2d3'),
    make('iceberg-light','iceberg light','light','#e8ebf2','#dce1eb','rgba(247,248,252,.96)','#343c4f','#778196','#315b9a'),
    make('matrix','matrix','dark','#080d09','#030805','rgba(8,17,10,.97)','#d8f5dc','#6ea477','#00e500'),
    make('nord','nord','dark','#2e3440','#252a34','rgba(46,52,64,.96)','#eceff4','#a7b1c2','#88c0d0'),
    make('nord-light','nord light','light','#e7ebf1','#dce2e9','rgba(248,250,252,.96)','#354052','#748196','#5e81ac'),
    make('rose-pine-moon','rose pine moon','dark','#252235','#191725','rgba(38,35,53,.96)','#e0def4','#aaa6c5','#ea9a97'),
    make('solarized-dark','solarized dark','dark','#073642','#002b36','rgba(7,54,66,.96)','#eee8d5','#93a1a1','#2aa198'),
    make('solarized-light','solarized light','light','#fdf6e3','#eee8d5','rgba(255,251,235,.96)','#586e75','#839496','#268bd2'),
    make('sunset','sunset','dark','#29212a','#1a171d','rgba(43,31,38,.96)','#f5e9e2','#b89a8a','#f09070'),
    make('terminal','terminal','dark','#101b15','#07100b','rgba(14,28,19,.97)','#d7f2de','#8aaa92','#62d26f'),
    make('vesper','vesper','dark','#171717','#101010','rgba(28,28,28,.97)','#f1ede7','#9e9a94','#e7bba5'),
  ];

  // Name, mode, card background, readable text, and the three preview swatches.
  const palettes = [
    ['diner', 'light', '#527993', '#111e29', '#c6af57', '#e5e1d4', '#f0e9d7'],
    ['dino', 'light', '#ffffff', '#202522', '#33d36c', '#808582', '#202522'],
    ['discord', 'dark', '#303238', '#eef0f3', '#6670f0', '#8d9098', '#dce0e5'],
    ['dmg', 'light', '#d9dadb', '#3e4145', '#ae1459', '#353da3', '#414245'],
    ['dollar', 'light', '#e3e3d3', '#474f4b', '#6b8a70', '#737d67', '#515956'],
    ['dots', 'dark', '#141721', '#f8f9fd', '#ffffff', '#5e6687', '#f8f9fd'],
    ['drowning', 'dark', '#191928', '#b8b8ce', '#5178bd', '#667c9f', '#a3a2b5'],
    ['dualshot', 'light', '#797979', '#131414', '#222424', '#ededed', '#242626'],
    ['earthsong', 'dark', '#292521', '#f0cca9', '#56a165', '#ffae2c', '#edccaa'],
    ['everblush', 'dark', '#161e21', '#e4e6e4', '#8ed17d', '#88908e', '#dadfdd'],
    ['evil eye', 'light', '#0883b3', '#061722', '#e8f7fb', '#193e59', '#101e29'],
    ['ez mode', 'dark', '#096cc0', '#ffffff', '#f95dc7', '#b5d9ff', '#ffffff'],
    ['fire', 'dark', '#160909', '#fff3f1', '#dd4945', '#956c6b', '#ffffff'],
    ['fledgling', 'dark', '#3b3540', '#f1ddde', '#fb718c', '#ba949f', '#f0dddf'],
    ['metropolis', 'dark', '#11222d', '#e1edf5', '#58c3bc', '#5487a5', '#e2edf3'],
    ['mexican', 'light', '#f8ac35', '#372319', '#a0196a', '#40312c', '#fbeddb'],
    ['miami', 'light', '#ef5187', '#261421', '#18ddda', '#343539', '#ffe5ed'],
    ['miami nights', 'dark', '#19191b', '#f7f7f8', '#e05e98', '#48bcc6', '#ffffff'],
    ['midnight', 'dark', '#0f1318', '#afbfd8', '#8298be', '#63728b', '#a7b9d5'],
    ['milkshake', 'light', '#ffffff', '#222d46', '#263149', '#438da5', '#222e46'],
    ['mint', 'dark', '#0a3a54', '#e5f5db', '#66dca6', '#5b98a8', '#e5f5db'],
    ['mizu', 'light', '#afcadb', '#192e3d', '#fbfdfa', '#526b7d', '#192e3d'],
    ['modern dolch', 'dark', '#303132', '#e9ecee', '#83d8ce', '#81888c', '#e4e8eb'],
    ['modern dolch light', 'light', '#d9dbda', '#303433', '#7ecdc0', '#717574', '#333736'],
    ['modern ink', 'light', '#ffffff', '#080909', '#ff4b24', '#858987', '#080909'],
    ['monokai', 'dark', '#292a23', '#e9e9db', '#a6e22e', '#e6db74', '#f1eee4'],
    ['moonlight', 'dark', '#1c222b', '#e0ddc5', '#c5a16d', '#7a8593', '#d2cfb7'],
    ['mountain', 'dark', '#141414', '#ebebeb', '#e9e9e9', '#777777', '#e9e9e9'],
    ['mr sleeves', 'light', '#d0d6d8', '#202426', '#dba89d', '#6d7374', '#202426'],
    ['ms cupcakes', 'light', '#ffffff', '#102e3b', '#4fcee8', '#ce398f', '#102e3b'],
    ['muted', 'dark', '#505254', '#d4f5f7', '#c6b3e2', '#a3bac8', '#bfe7ec'],
    ['nautilus', 'dark', '#152435', '#65ded7', '#efb920', '#1c9298', '#25bcb2'],
    ['nebula', 'dark', '#23233a', '#c1c5d3', '#c04489', '#24bec1', '#92999a'],
    ['night runner', 'dark', '#242426', '#ececf0', '#edfa09', '#8b7db9', '#ececf0'],
    ['norse', 'dark', '#262626', '#ded2c0', '#4aa0b8', '#788182', '#dad0be'],
    ['oblivion', 'dark', '#333535', '#f4f2ed', '#bab4a7', '#959a99', '#f4f2ed'],
    ['olive', 'light', '#e7e5cd', '#34352c', '#929773', '#777867', '#34352c'],
    ['olivia', 'dark', '#211f20', '#f7efed', '#deb0a4', '#8e8082', '#f7efed'],
    ['onedark', 'dark', '#2e3440', '#b4d693', '#67b6f2', '#e9eef6', '#a2cc85'],
    ['our theme', 'dark', '#cc152a', '#ffffff', '#ffd627', '#f0c4c7', '#ffffff'],
    ['pale nimbus', 'dark', '#423d4d', '#fffde2', '#96ffd0', '#ffaba9', '#fffde2'],
    ['paper', 'light', '#efefef', '#363737', '#404242', '#858787', '#404242'],
    ['passion fruit', 'dark', '#7b2346', '#fff5fb', '#f5a8c1', '#b7a5c8', '#fff5fb'],
    ['pastel', 'light', '#deb2bf', '#503749', '#fff6b3', '#745e73', '#675367'],
    ['peach blossom', 'dark', '#292929', '#ffd1b1', '#a2c2a5', '#90907d', '#ffccab'],
    ['peaches', 'light', '#ded7c1', '#514034', '#db7e60', '#866857', '#5f493e'],
    ['phantom', 'dark', '#080b1c', '#d7dfff', '#83a9ff', '#6674a0', '#c9d5ff'],
    ['pink lemonade', 'light', '#f5d990', '#483521', '#f2a391', '#6d6055', '#fffbea'],
    ['pulse', 'dark', '#1b1d1e', '#e6f4f5', '#1cbec8', '#818c8e', '#e6f4f5'],
    ['purpleish', 'dark', '#212137', '#c9c6e6', '#a180eb', '#8076aa', '#b3add5'],
    ['rainbow trail', 'light', '#f3f3f3', '#202121', '#353737', '#545757', '#202121'],
    ['red dragon', 'dark', '#211011', '#ecd1cd', '#ff4b3f', '#e8aa2f', '#656767'],
    ['red samurai', 'dark', '#802430', '#f9eae3', '#e7b478', '#c0a39d', '#f5ddd4'],
    ['repose dark', 'dark', '#30353b', '#e4e0cd', '#d7d2bc', '#9c9b8e', '#dfdbca'],
    ['repose light', 'light', '#ede9d4', '#333638', '#686b65', '#777b72', '#34373a'],
    ['retro', 'light', '#d9d3c2', '#28261f', '#23221e', '#767265', '#25231e'],
    ['retrocast', 'dark', '#08727d', '#ffffff', '#88e0e9', '#f6dc2e', '#ffffff'],
    ['rgb', 'dark', '#151515', '#f3f3f3', '#f3f3f3', '#777777', '#eeeeee'],
    ['rose pine', 'dark', '#23212c', '#e0def4', '#9ccfd8', '#c4a7e7', '#e0def4'],
    ['rose pine dawn', 'light', '#fff8f0', '#286080', '#56949f', '#6b83b0', '#286080'],
    ['rudy', 'dark', '#192a3c', '#deded2', '#bf9d64', '#647789', '#d0d1c4'],
    ['ryujinscales', 'dark', '#0c1728', '#ffe0bd', '#ff805f', '#ffb693', '#ffe0bd'],
    ['serika', 'light', '#dfe0e1', '#35383b', '#e2b928', '#777d82', '#35383b'],
    ['serika dark', 'dark', '#303235', '#e4e2d7', '#efc52d', '#a1a19d', '#dedcd0'],
    ['sewing tin', 'dark', '#241b61', '#ffffff', '#f6cf78', '#6081df', '#ffffff'],
    ['sewing tin light', 'light', '#ffffff', '#30216f', '#33247e', '#3b5dcc', '#33247e'],
    ['shadow', 'dark', '#080808', '#eeeeee', '#eeeeee', '#636363', '#eeeeee'],
    ['shoko', 'light', '#ccd5df', '#3e5161', '#86c7dc', '#597688', '#3e5161'],
    ['slambook', 'light', '#fffde0', '#19093f', '#09071f', '#2386ac', '#230c52'],
    ['snes', 'light', '#bfc0c3', '#262729', '#554291', '#695f80', '#343439'],
    ['soaring skies', 'light', '#fdf8f1', '#202123', '#49c2ea', '#211676', '#202123'],
    ['solarized osaka', 'dark', '#061b21', '#f0ebd7', '#a0b51a', '#2aa198', '#eee8d5'],
    ['sonokai', 'dark', '#2c2e34', '#f0eff0', '#a6d67a', '#f7cc67', '#e7e7e9'],
    ['spiderman', 'dark', '#11161d', '#eef0f2', '#f34d54', '#298cff', '#f5f6fa'],
    ['stealth', 'dark', '#070809', '#b9c2c8', '#83919a', '#616e76', '#465159'],
    ['strawberry', 'light', '#f68387', '#3c1b22', '#fff3ef', '#403338', '#fff9f6'],
    ['striker', 'dark', '#164778', '#e5eff7', '#d5dfea', '#a4bbcc', '#d5dfea'],
    ['suisei', 'dark', '#3a485e', '#e9edf8', '#beeafb', '#fc9d50', '#dce4f2'],
    ['superuser', 'dark', '#272c33', '#e9f8f5', '#48f5b2', '#78929c', '#e4f5f0'],
    ['sweden', 'dark', '#075aa1', '#ffffff', '#ffd526', '#7fc0df', '#f5fbff'],
    ['tangerine', 'light', '#ffeddf', '#462719', '#ff620f', '#af6241', '#472716'],
    ['taro', 'light', '#b2b5f5', '#201c40', '#221c3d', '#656188', '#211b3b'],
    ['terra', 'dark', '#101613', '#f4f0d5', '#94c85c', '#657c4d', '#f1edce'],
    ['terrazzo', 'light', '#f0e4d8', '#104142', '#e27f58', '#548384', '#104142'],
    ['terror below', 'dark', '#102320', '#e2f1ed', '#6dbaaa', '#4c978e', '#e2f1ed'],
    ['tiramisu', 'light', '#d0c7bb', '#563529', '#c59873', '#956957', '#825b4c'],
    ['trackday', 'dark', '#414961', '#ecedf3', '#f7785e', '#adb9ce', '#dfe0e5'],
    ['trance', 'dark', '#080d25', '#ffffff', '#eb378a', '#67779c', '#ffffff'],
    ['tron orange', 'dark', '#101f20', '#f9fdfc', '#f4f01b', '#ff8b11', '#ffffff'],
    ['vaporwave', 'light', '#a7a6e9', '#282344', '#d860c8', '#514c6a', '#f1e9f6'],
    ['vesper light', 'light', '#fdfdfd', '#111111', '#ff7900', '#888888', '#111111'],
    ['viridescent', 'dark', '#2e3534', '#eaf4dd', '#9ad7b9', '#80ad95', '#eaf4dd'],
    ['voc', 'dark', '#1e1020', '#f7ecee', '#e2c9a9', '#a3839b', '#f7ecee'],
    ['vscode', 'dark', '#1f1f1f', '#dedede', '#2e9ce6', '#818181', '#dedede'],
    ['watermelon', 'dark', '#204437', '#e0d5c9', '#f2848d', '#94aa9a', '#e0d5c9'],
    ['wavez', 'dark', '#1c2a2f', '#e9f2eb', '#77d655', '#68979d', '#e9f2eb'],
    ['witch girl', 'light', '#f1d9d9', '#345e54', '#578475', '#507d70', '#476f63'],
  ];

  const newThemes = palettes.map(([name, mode, background, foreground, ...swatches]) => {
    const [accent, secondary, alternate] = swatches;
    const well = `color-mix(in srgb, ${background} 94%, black)`;
    const panel = `color-mix(in srgb, ${background} 93%, ${foreground})`;
    const muted = `color-mix(in srgb, ${foreground} 78%, ${background})`;
    const sellColor = secondary === accent ? alternate : secondary;
    const theme = make(name.replaceAll(' ', '-'), name, mode, background, well, panel, foreground, muted, accent, sellColor);
    theme.colors['accent-ink'] = theme.colors['trade-buy-ink'];
    theme.swatches = swatches;
    return theme;
  });

  const [dark, light, ...existing] = originalThemes;
  return [dark, light, ...[...existing, ...newThemes].sort((a, b) => a.name.localeCompare(b.name, 'en'))];
})();
