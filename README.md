# Claude FM 🎛️

> 不整歌单，让 AI DJ 帮你播。

基于 [Claudio FM](https://github.com/bingyanglu/Claudio-FM) 的个人定制版。打开、点播放、放着就行——它会自己选歌、自己说话、自己串场，像一个真正的电台 DJ。

---

## 🎧 风格

说唱为主，电子为辅。Travis Scott、Drake、Kendrick 的 beat 配 Daft Punk、Disclosure 的合成器，808 鼓机和重低音全天候在线。

工作时段走 minimal / ambient，晚上切 house / deep house，深夜 chill trap 收尾。想换口味？朝它喊一声就行。

---

## 🚀 跑起来

`ash
git clone https://github.com/Merlot444/claudio.git
cd claudio
npm install
cp .env.example .env   # 填 DeepSeek + 豆包 TTS Key
npm start
`

浏览器开 http://localhost:8080，按下播放。

---

## 🛠️ 我改了啥

- user/taste.md — 从原版独立/OST 改成说唱 + 电子风格
- user/mood-rules.md — 情绪触发全绑电子子流派
- user/routines.md — 作息表适配 hip-hop / house / ambient 节奏

---

## 📻 怎么互动

页面上的 **Request Line** 就是你的听众热线。说你想听的、说你现在的心情，DJ 会听着办。它不是聊天机器人，是电台。

---

原项目 [bingyanglu/Claudio-FM](https://github.com/bingyanglu/Claudio-FM) · MIT License
