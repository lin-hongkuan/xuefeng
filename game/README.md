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

## 部署到 GitHub Pages

本目录已是一个 git 仓库（站点文件在仓库根目录），并自带
`.github/workflows/deploy.yml` 自动部署流水线。只需推送到 GitHub 即可上线。

### 步骤
1. 在 GitHub 网页新建一个**空仓库**（不要勾选 README/.gitignore），例如 `zxf-cool`。
2. 在本目录 `game/` 下执行（把 `<你的用户名>/<仓库名>` 换成你的）：
   ```bash
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
3. 打开仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 回到 **Actions** 标签，等 “Deploy to GitHub Pages” 跑完（约 1 分钟）。
5. 访问 `https://<你的用户名>.github.io/<仓库名>/` 即可游玩。

> 之后每次 `git push` 都会自动重新部署。
>
> 备选（不想用 Actions）：Settings → Pages → Source 选 **Deploy from a branch → main / (root)**，
> 仓库已含 `.nojekyll`，静态文件会原样发布，效果相同。

所有资源路径均为相对路径，因此放在 `用户名.github.io/仓库名/` 子路径下也能正常加载。
服务器对 `.m4a` 会返回 `audio/mp4`、`.mp3` 返回 `audio/mpeg`，GitHub Pages 默认已正确处理。

## 其它静态托管
把整个目录上传到任意静态空间亦可（Netlify / Vercel / Nginx / 对象存储 CDN），入口 `index.html`，无需后端。首屏有加载进度条，资源约 6.4 MB。

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
