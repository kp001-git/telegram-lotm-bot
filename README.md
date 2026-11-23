# 𓆩 @greyfogbot 𓆪
### Lord of the Mysteries (LOTM) Telegram Group Management & Community Engine

A production-grade, highly thematic Telegram group management and community bot built with **TypeScript**, **grammY**, and **Turso (libSQL)**. Inspired by Cuttlefish That Loves Diving's *Lord of the Mysteries*.

---

## 🌟 Key Features

1. **Role-Based Access Control (Tarot Club Hierarchy):**
   - **Celestial Worthy (Owner):** Absolute primordial sovereignty over all sequences and decrees.
   - **The Fool (Co-Owner / Deputy):** Custodian of the fog, ritual blessings, administrative authority.
   - **The World (Senior Admin):** Gehrman Sparrow's cold justice; enforcer of group order and banishments.
   - **The Star (Moderator):** Leonard Mitchell's poetic surveillance; petition triage and community polls.
   - **Beyonder (Regular Member):** Standard sequence members pursuing advancement.

2. **Authority & Moderation Suite:**
   - `/ascend [role]` & `/degrade`: Promote/demote members across council seats.
   - `/banish [reason]` & `/exile [reason]`: Permanent ban or kick beyond the sanctuary.
   - `/silence [duration] [reason]` & `/release`: Mute voices in the Grey Fog (`30m`, `2h`, `1d`, `1w`).
   - `/seal [reason]` & `/unseal`: Isolate the chat under ancient fog for council deliberations.
   - `/erase [count]`: Purge blasphemous whispers with auto-deleting confirmation.

3. **Information Board & Welcoming Rites:**
   - `/sacred_laws`: Inquire or amend the 5 Sacred Decrees of the Tarot Club.
   - `/mysteries`: Live overview of sanctuary domain, members, and council seats.
   - `/fate_records`: Statistical ledger of messages, prayers, decrees, and top Beyonders.
   - `/summoning [set <template> | test]`: Configurable welcome rites with `{mention}`, `{name}`, `{group}`, `{count}`. Automatically welcomes new arrivals and warns if the sanctuary is sealed!
   - `/lore`: Chronicles and sacred purpose of the gathering above the Grey Fog.

4. **Member Participation & Governance:**
   - `/suggest`, `/idea`, `/report`: Interactive council review dossiers with inline triage buttons (`Send to Vote`, `Final Approve`, `Reject`).
   - `/vote [create <Q> | <OptA> | <OptB> | close <id>]`: Community deliberations with live ASCII progress bars (`[██████░░░░] 60%`) and real-time vote switching.
   - `/suggestions`: Official public ledger of sanctioned proposals.

5. **Mystical LOTM Engine:**
   - `/pathway [name | choose <name>]`: All **22 canonical Pathways** grouped by Above-the-Sequence domains.
   - `/sequence [level_or_pathway]`: Inquire 9-to-0 sequence progression and characteristics.
   - `/potion [pathway] [sequence]`: Look up main/supplementary ingredients and acting methods.
   - `/tarot`: Draw from all **22 Major Arcana** with Upright/Reversed Tarot Club resonances.
   - `/fate`: Spirit pendulum fortune divination (30s cooldown).
   - `/prayer [petition]`: Recite the honorific name of The Fool and record personal devotion count.
   - `/ritual`: Convoke interactive Grey Fog phenomena with inline channeling for up to 5 seekers.

---

## ⚙️ Environment Configuration (`.env`)

```env
# Telegram Bot Token from @BotFather
BOT_TOKEN=your_telegram_bot_token

# Turso (libSQL) Connection
# Local development: file:local.db
# Cloud production: libsql://your-database-name.turso.io
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=

# Celestial Worthy User ID (Optional; creator can claim via /celestial_worthy)
OWNER_ID=

# Admin Log Channel/Group ID for audit mirroring
ADMIN_LOG_CHAT_ID=

# Port for native HTTP health ping server
PORT=3000
```

---

## 🚀 Quickstart & Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run in development mode (hot reload):**
   ```bash
   npm run dev
   ```

3. **Run automated verification tests:**
   ```bash
   npx tsx tests/verify.ts
   ```

4. **Build production bundle:**
   ```bash
   npm run build
   ```

---

## ☁️ 24/7 Free-Tier Deployment (Render / Alwaysdata + UptimeRobot)

`@greyfogbot` includes a built-in native `node:http` server responding on `/` and `/health` with `200 OK`, allowing free cloud hosts to stay awake indefinitely without sleep timeouts.

### Deploying to Render (Free Web Service)
1. Fork or push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), create a **New Web Service**:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Add Environment Variables:
   - `BOT_TOKEN`: your Telegram bot token
   - `TURSO_DATABASE_URL`: `libsql://your-db.turso.io`
   - `TURSO_AUTH_TOKEN`: your Turso auth token
   - `PORT`: `3000`
4. Set up an HTTP Monitor in [UptimeRobot](https://uptimerobot.com):
   - **Type:** HTTP(s)
   - **URL:** `https://your-render-app.onrender.com/health`
   - **Interval:** 5 minutes

### Deploying to Alwaysdata
1. Create a Node.js site pointing to `dist/index.js`.
2. Configure environment variables in the Alwaysdata environment panel.
3. Start the service.

---

## 𓆩 The Tarot Club Iron Decrees 𓆪
> *"The Principle of Equivalent Exchange is absolute. Knowledge without anchor leads to madness."*
