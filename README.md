# 张雪峰 · 透心凉大作战

A mobile-first, swipe-to-slice summer arcade game. Built fresh around four elements —
**张雪峰老师 / 雪碧 / 巧乐兹 / 原站背景音乐** — with gameplay deliberately different from the
original endless-runner at `ottomate.games/zxf`.

## 玩法 (How to play)
- 手指滑动**挥刀**，切中**雪碧**(透心凉+多) 与 **巧乐兹**(分数+多) 得分。
- 切到金色**录取通知书**：大额奖励 + 短暂子弹时间。
- 千万别切**天坑炸弹**：扣 1 命（共 3 命），扣光即结束。
- 连续切中累积**连击**；攒满「透心凉」进入 **FEVER 狂热**：双倍得分、无炸弹、刀光变金。

## 控制
- **触屏 / 鼠标**：按住滑动切割。
- 顶部按钮：❚❚ 暂停、♪ 静音。
- 键盘：`Esc/P` 暂停，`Space` 在标题/结算页开始。

## 技术
- 纯原生：`index.html` + `style.css` + `game.js`，无构建步骤、无依赖。
- Canvas 渲染 + WebAudio 合成音效；自适应 DPR 与 safe-area，竖屏手机优先，宽屏自动居中。
- 背景音乐 `assets/bgm.m4a` 与失败音效 `assets/death.mp3` 直接复用原站资源。
- 美术为透明通道 PNG（gpt-image-2 生成，cel-shaded 风格），已裁剪留白并压缩。

## 本地预览
```bash
cd game
python -m http.server 8765
# 打开 http://localhost:8765/
```

## 部署 (静态托管)
把整个 `game/` 目录上传到任意静态空间即可（Netlify / Vercel / GitHub Pages / Nginx / 对象存储 CDN）：
- 入口文件：`index.html`
- 确保 `assets/` 一同上传；服务器需对 `.m4a` 返回 `audio/mp4`、`.mp3` 返回 `audio/mpeg`。
- 全部为静态文件，无需后端。首屏有加载进度条，资源约 6.4 MB。

> 调试：在 URL 加 `?dev=1` 可启用 `window.__zxfDev`（forceFever / forceOver / info），正常游玩无副作用。

## 文件
```
game/
├── index.html
├── style.css
├── game.js
└── assets/
    ├── bgm.m4a        # 复用原站背景音乐
    ├── death.mp3      # 复用原站失败音效
    ├── zhang-mc.png   # 张雪峰 主持人(常态)
    ├── zhang-hype.png # 张雪峰 狂热(FEVER)
    ├── sprite-can.png # 雪碧
    ├── qiaolezi.png   # 巧乐兹
    ├── bomb.png       # 天坑炸弹(危险)
    ├── letter.png     # 录取通知书(奖励)
    └── bg.png         # 夏日舞台背景
```
