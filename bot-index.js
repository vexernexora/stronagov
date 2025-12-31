// index.js — USSS bot z integracją strony i lokalnym zapisem zdjęć
// NOWE FUNKCJE:
// 1) Pobieranie zdjęć lokalnie (images/) - trzymane 14 dni
// 2) Integracja ze stroną - bot widzi zmiany ze strony i aktualizuje Discord
// 3) Automatyczne czyszczenie starych zdjęć

import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionsBitField
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- CONFIG --------------------
const REPORTS_FORUM_ID = '1448055824021983322';
const FORUM_CHANNEL_ID = process.env.FORUM_CHANNEL_ID || REPORTS_FORUM_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ADMIN_ROLE_NAME = 'Director of the United States Secret Service';
const ADMIN_ROLE_ID = '1448097489444933754';

// Folder na zdjęcia
const IMAGES_DIR = path.join(__dirname, 'images');
const IMAGE_RETENTION_DAYS = 14; // Ile dni trzymać zdjęcia

// Upewnij się że folder images istnieje
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const PREMIE = {
  "Obstawa Lobby": 5000,
  "Obstawa Napadu na Biznes/Bank": 5000,
  "Patrol na mieście": 4000,
  "Patrol w frakcjach": 4000,
  "Eventy": 7000,
  "Convoye/Obstawa VIP": 6500,
  "Obstawy rozpraw sądowych": 7000,
  "Craft": 10000,
  "Zatrzymanie": 4000,
  "Napad na Cayo Perico/Fort Zancudo": 6000,
  "Nalot": 13000,
  "Drop": 8000,
  "Listy Gończe": 9000,
  "Wsparcie na mieście (c0)": 4500,
  "Montaż kamer/Obrona Kamer": 4000,
  "Pomoc w rekrutacji": 5000,
  "Szkolenie Agentów": 10000,
  "Udział w Magazynach/Dilerce": 6000
};

// -------------------- CLIENT --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.once('ready', () => {
  console.log(`✅ Bot zalogowany jako ${client.user.tag}`);

  // Uruchom synchronizację ze stroną co 10 sekund
  setInterval(syncWithWebsite, 10000);

  // Uruchom czyszczenie starych zdjęć co godzinę
  setInterval(cleanupOldImages, 60 * 60 * 1000);
  cleanupOldImages(); // Wyczyść od razu przy starcie
});

// -------------------- EXPRESS (API dla strony) --------------------
const app = express();
app.use(express.json());

// Serwuj zdjęcia
app.use('/images', express.static(IMAGES_DIR));

app.get('/stats', (req, res) => {
  res.json({
    botName: client.user?.tag ?? null,
    guilds: client.guilds.cache.size,
    uptime: process.uptime(),
    imagesCount: fs.readdirSync(IMAGES_DIR).length
  });
});

// Endpoint do pobierania raportów
app.get('/api/reports', (req, res) => {
  const reports = readRaporty();
  res.json({ reports, premieTypes: PREMIE });
});

app.listen(3000, () => console.log('🧠 Bot API działa na porcie 3000'));

// -------------------- PARSE DISPLAY NAME --------------------
// Parse Discord nickname to extract just the name
// Formats:
// - "USSS I Kraker Kosmos I #51781" → "Kraker Kosmos"
// - "USSS| Gregory Other | 887" → "Gregory Other"
function parseDisplayName(nickname) {
  if (!nickname) return 'Unknown';

  // Try to split by | or I separator
  const parts = nickname.split(/\s*[|I]\s*/);

  if (parts.length >= 2) {
    // Get the middle part (name) - usually the second element
    let name = parts[1];
    // Remove UID suffix like #51781 or just 887
    name = name.replace(/\s*#?\d+\s*$/, '').trim();
    if (name) return name;
  }

  // Fallback: just remove #UID or UID suffix
  const withoutUid = nickname.replace(/\s*#?\d+\s*$/, '').trim();
  if (withoutUid) return withoutUid;

  return nickname;
}

// -------------------- IMAGE HANDLING --------------------
async function downloadImage(url, reportId) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const ext = path.extname(urlObj.pathname).toLowerCase() || '.png';
      const filename = `${reportId}${ext}`;
      const filepath = path.join(IMAGES_DIR, filename);

      const protocol = urlObj.protocol === 'https:' ? https : http;

      const file = fs.createWriteStream(filepath);

      protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(filepath);
            return downloadImage(redirectUrl, reportId).then(resolve).catch(reject);
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filepath);
          return resolve(null); // Nie udało się pobrać
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`📷 Pobrano zdjęcie: ${filename}`);
          resolve(filename);
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        console.error(`❌ Błąd pobierania zdjęcia: ${err.message}`);
        resolve(null);
      });
    } catch (err) {
      console.error(`❌ Błąd URL zdjęcia: ${err.message}`);
      resolve(null);
    }
  });
}

function cleanupOldImages() {
  try {
    const files = fs.readdirSync(IMAGES_DIR);
    const now = Date.now();
    const maxAge = IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const file of files) {
      const filepath = path.join(IMAGES_DIR, file);
      const stats = fs.statSync(filepath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filepath);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`🗑️ Usunięto ${deleted} starych zdjęć (>14 dni)`);
    }
  } catch (err) {
    console.error('Błąd czyszczenia zdjęć:', err);
  }
}

// -------------------- STORAGE --------------------
const RAPORTY_FILE = path.join(__dirname, 'raporty.json');

function readRaporty() {
  if (!fs.existsSync(RAPORTY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(RAPORTY_FILE)); } catch (e) { console.error(e); return []; }
}

function writeRaporty(data) {
  fs.writeFileSync(RAPORTY_FILE, JSON.stringify(data, null, 2));
}

function backupAndClearRaporty() {
  const all = readRaporty();
  const count = all.length;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `raporty.backup-${stamp}.json`;
  fs.writeFileSync(path.join(__dirname, backup), JSON.stringify(all, null, 2));
  writeRaporty([]);
  return { count, backup };
}

// -------------------- SYNC WITH WEBSITE --------------------
let lastKnownStates = new Map(); // messageId -> status

async function syncWithWebsite() {
  try {
    const reports = readRaporty();
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    const forumChannel = await guild.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
    if (!forumChannel) return;

    for (const report of reports) {
      const lastStatus = lastKnownStates.get(report.id);

      // Jeśli status się zmienił (np. ze strony)
      if (lastStatus && lastStatus !== report.status && report.status !== 'pending') {
        await updateDiscordMessage(report, forumChannel, guild);
      }

      lastKnownStates.set(report.id, report.status);
    }
  } catch (err) {
    // Cicha obsługa błędów sync
  }
}

async function updateDiscordMessage(report, forumChannel, guild) {
  try {
    if (!report.threadId || !report.id) return;

    // Pobierz wątek
    const thread = await forumChannel.threads.fetch(report.threadId).catch(() => null);
    if (!thread) return;

    // Pobierz wiadomość
    const message = await thread.messages.fetch(report.id).catch(() => null);
    if (!message) return;

    // Sprawdź czy już nie jest zaktualizowana
    if (message.content.includes('**Status:**')) return;

    const statusText = report.status === 'accepted'
      ? `✅ **Status:** zaakceptowano (przez stronę)`
      : `❌ **Status:** odrzucono (przez stronę)`;

    const newContent = `${message.content}\n\n${statusText}`;
    await message.edit({
      content: newContent,
      components: [buildButtonsRow(true)]
    }).catch(() => {});

    // Aktualizuj statystyki
    const memberUser = await guild.members.fetch(report.userId).catch(() => null);
    await aktualizujStatystyki(report.userId, memberUser?.user?.username ?? report.username, forumChannel);

    console.log(`🔄 Zsynchronizowano raport ${report.id} ze stroną (${report.status})`);
  } catch (err) {
    // Cicha obsługa
  }
}

// -------------------- FORUM THREADS --------------------
async function deleteAllForumThreads(forumChannel, reason = 'Wyczyszczenie raportów (/wyczyscraporty)') {
  let deleted = 0;
  let failed = 0;

  const active = await forumChannel.threads.fetchActive().catch(() => null);
  const activeThreads = active ? Array.from(active.threads.values()) : [];

  for (const th of activeThreads) {
    try {
      await th.delete(reason);
      deleted++;
    } catch {
      failed++;
    }
  }

  let before = undefined;
  for (;;) {
    const archived = await forumChannel.threads
      .fetchArchived({ type: 'public', before, limit: 100 })
      .catch(() => null);

    if (!archived) break;

    const threads = Array.from(archived.threads.values());
    for (const th of threads) {
      try {
        await th.delete(reason);
        deleted++;
      } catch {
        failed++;
      }
    }

    if (!archived.hasMore || threads.length === 0) break;
    before = threads[threads.length - 1].id;
  }

  before = undefined;
  for (;;) {
    const archived = await forumChannel.threads
      .fetchArchived({ type: 'private', before, limit: 100 })
      .catch(() => null);

    if (!archived) break;

    const threads = Array.from(archived.threads.values());
    for (const th of threads) {
      try {
        await th.delete(reason);
        deleted++;
      } catch {
        failed++;
      }
    }

    if (!archived.hasMore || threads.length === 0) break;
    before = threads[threads.length - 1].id;
  }

  return { deleted, failed };
}

// -------------------- RAPORTY LOGIKA --------------------
async function zapiszRaport({ userId, uid, username, typ, kwota, attachment, messageId, threadId }) {
  const raporty = readRaporty();

  // Pobierz zdjęcie lokalnie jeśli jest
  let localImage = null;
  if (attachment) {
    localImage = await downloadImage(attachment, messageId);
  }

  raporty.push({
    id: messageId,
    threadId,
    userId,
    uid: uid || null,
    username: parseDisplayName(username), // Parsuj nick do imienia i nazwiska
    typ,
    kwota,
    attachment: attachment || null,
    localImage: localImage, // Lokalna ścieżka do zdjęcia
    date: new Date().toISOString(),
    status: 'pending'
  });
  writeRaporty(raporty);

  // Dodaj do cache stanów
  lastKnownStates.set(messageId, 'pending');
}

function aktualizujStatusRaportu(messageId, status) {
  const raporty = readRaporty();
  const r = raporty.find(x => x.id === messageId);
  if (r) {
    r.status = status;
    writeRaporty(raporty);
    lastKnownStates.set(messageId, status);
    return r;
  }
  return null;
}

function zmienTypRaportu(messageId, nowyTyp) {
  const raporty = readRaporty();
  const r = raporty.find(x => x.id === messageId);
  if (r) {
    r.typ = nowyTyp;
    r.kwota = PREMIE[nowyTyp] ?? 0;
    writeRaporty(raporty);
    return r;
  }
  return null;
}

function sumaPremii(userId) {
  return readRaporty()
    .filter(r => r.userId === userId && r.status === 'accepted')
    .reduce((acc, r) => acc + (r.kwota || 0), 0);
}

function wszystkieWyplaty() {
  const out = {};
  readRaporty()
    .filter(r => r.status === 'accepted')
    .forEach(r => { out[r.userId] = (out[r.userId] || 0) + (r.kwota || 0); });
  return out;
}

// -------------------- STATYSTYKI --------------------
function statystykiUzytkownika(userId) {
  const stats = {};
  Object.keys(PREMIE).forEach(k => (stats[k] = 0));
  readRaporty()
    .filter(r => r.userId === userId && r.status === 'accepted')
    .forEach(r => (stats[r.typ] = (stats[r.typ] || 0) + 1));
  return stats;
}

function licznikStatusow(userId) {
  const arr = readRaporty().filter(r => r.userId === userId);
  return {
    pending: arr.filter(r => r.status === 'pending').length,
    rejected: arr.filter(r => r.status === 'rejected').length,
    accepted: arr.filter(r => r.status === 'accepted').length
  };
}

async function getStatsStarterMessage(thread) {
  try {
    const starter = await thread.fetchStarterMessage();
    if (starter?.author?.id === client.user.id) return starter;
    const msgs = await thread.messages.fetch({ limit: 50 }).catch(() => null);
    if (!msgs) return null;
    const found = msgs
      .filter(m => m.author.id === client.user.id && m.embeds?.length)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .first();
    return found || null;
  } catch { return null; }
}

function buildStatsEmbed(username, userId) {
  const stats = statystykiUzytkownika(userId);
  const total = Object.values(stats).reduce((s, v) => s + v, 0);
  const licz = licznikStatusow(userId);

  return new EmbedBuilder()
    .setTitle(`📊 Statystyki użytkownika: ${username}`)
    .setColor(0x00AE86)
    .setTimestamp()
    .setFooter({ text: 'USSS • Raporty (tylko zatwierdzone)' })
    .setDescription(
      Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join('\n') +
      `\n\n**Zatwierdzonych raportów razem: ${total}**`
    )
    .addFields({
      name: 'ℹ️ Statusy (informacyjnie)',
      value: `Pending: **${licz.pending}** • Rejected: **${licz.rejected}** • Accepted: **${licz.accepted}**`,
      inline: false
    });
}

async function aktualizujStatystyki(userId, username, forumChannel) {
  try {
    const threadsFetched = await forumChannel.threads.fetch().catch(() => null);
    if (!threadsFetched) return;
    let thread = threadsFetched.threads.find(t => t.name === `Raporty — ${username}`) ||
                 threadsFetched.threads.find(t => t.name?.includes(username)) || null;
    if (!thread) {
      const anyRaport = readRaporty().find(r => r.userId === userId && r.threadId);
      if (anyRaport?.threadId) {
        thread = threadsFetched.threads.get(anyRaport.threadId) ||
                 threadsFetched.threads.find(t => t.id === anyRaport.threadId) || null;
      }
    }
    if (!thread) return;

    const statsMsg = await getStatsStarterMessage(thread);
    if (!statsMsg) return;

    const statsEmbed = buildStatsEmbed(username, userId);
    await statsMsg.edit({ embeds: [statsEmbed] }).catch(() => {});
  } catch (err) { console.error(err); }
}

async function resetAllStatsEmbeds(forumChannel) {
  try {
    const fetched = await forumChannel.threads.fetch().catch(() => null);
    if (!fetched) return { ok: 0, fail: 0 };
    const threads = Array.from(fetched.threads.values());
    let ok = 0, fail = 0;

    for (const thread of threads) {
      try {
        const starter = await thread.fetchStarterMessage().catch(() => null);
        if (!starter) { fail++; continue; }
        const title = starter.embeds?.[0]?.title || thread.name || '📊 Statystyki';
        const usernameFromTitle = title.replace(/^📊\s*Statystyki użytkownika:\s*/i, '').trim();
        const zeroDesc = Object.keys(PREMIE).map(k => `${k}: 0`).join('\n') + `\n\n**Zatwierdzonych raportów razem: 0**`;
        const zeroEmbed = new EmbedBuilder()
          .setTitle(`📊 Statystyki użytkownika: ${usernameFromTitle}`)
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: 'USSS • Raporty (tylko zatwierdzone)' })
          .setDescription(zeroDesc)
          .addFields({ name: 'ℹ️ Statusy (informacyjnie)', value: `Pending: **0** • Rejected: **0** • Accepted: **0**` });
        await starter.edit({ embeds: [zeroEmbed] });
        ok++;
      } catch { fail++; }
    }
    return { ok, fail };
  } catch {
    return { ok: 0, fail: 0 };
  }
}

// -------------------- ADMIN CHECK --------------------
function isAdminMember(member) {
  if (!member) return false;
  if (member.roles?.cache?.has && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
  if (member.roles?.cache?.some) return member.roles.cache.some(r => r.name === ADMIN_ROLE_NAME);
  return false;
}

// -------------------- HELPERS (UI) --------------------
function buildButtonsRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('zatwierdz').setLabel('Zatwierdź').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(disabled),
    new ButtonBuilder().setCustomId('odrzuc').setLabel('Odrzuć').setStyle(ButtonStyle.Danger).setEmoji('❌').setDisabled(disabled),
    new ButtonBuilder().setCustomId('zmien_typ').setLabel('Zmień typ').setStyle(ButtonStyle.Primary).setEmoji('🔄').setDisabled(disabled)
  );
}

function buildSelectTyp(currentTyp) {
  const options = Object.keys(PREMIE).map(k => ({
    label: k,
    value: k,
    description: `Premia: $${PREMIE[k]}`
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_typ')
      .setPlaceholder(`Obecny: ${currentTyp} • wybierz nowy typ`)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options)
  );
}

// -------------------- UID PARSER --------------------
function extractUIDFromText(text) {
  if (!text) return null;
  const patterns = [
    /UID[:\s]*([0-9]{3,9})/i,
    /#([0-9]{3,9})/,
    /\(([0-9]{3,9})\)/,
    /\[([0-9]{3,9})\]/,
    /\{([0-9]{3,9})\}/
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m?.[1]) return m[1];
  }
  const all = [...text.matchAll(/(?:^|\D)([0-9]{3,9})(?=\D|$)/g)].map(m => m[1]);
  if (all.length) {
    const maxLen = Math.max(...all.map(x => x.length));
    const candidates = all.filter(x => x.length === maxLen);
    return candidates[candidates.length - 1];
  }
  return null;
}

function extractUIDFromMember(member) {
  const base = member?.displayName || member?.user?.username || '';
  return extractUIDFromText(base);
}

async function resolveUIDPreferNick(discordId, guild) {
  const m = await guild.members.fetch(discordId).catch(() => null);
  if (m) {
    const fromNick = extractUIDFromText(m.displayName || m.user?.username || '');
    if (fromNick) return fromNick;
  }
  const arr = readRaporty().slice().reverse().filter(r => r.userId === discordId);
  const withUid = arr.find(r => r.uid);
  if (withUid?.uid) return withUid.uid;
  const withName = arr.find(r => r.username);
  if (withName?.username) {
    const fromUsername = extractUIDFromText(withName.username);
    if (fromUsername) return fromUsername;
  }
  return '';
}

// -------------------- KOMENDY --------------------
const commandDefinitions = [
  new SlashCommandBuilder().setName('raport').setDescription('Zgłoś raport USSS')
    .addStringOption(opt =>
      opt.setName('typ').setDescription('Typ raportu').setRequired(true)
        .addChoices(...Object.keys(PREMIE).map(k => ({ name: k, value: k })))
    )
    .addAttachmentOption(opt => opt.setName('zdjecie').setDescription('Zdjęcie do raportu').setRequired(false)),

  new SlashCommandBuilder().setName('premia').setDescription('Sprawdź sumę premii użytkownika')
    .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik do sprawdzenia').setRequired(true)),

  new SlashCommandBuilder().setName('premiaall').setDescription('💰 TYLKO ADMIN - Wypisz wszystkie premie w formacie uid;kwota;Premia USSS'),

  new SlashCommandBuilder().setName('wyczyscraporty').setDescription('🧨 TYLKO ADMIN - Czyści WSZYSTKIE raporty (backup) + usuwa WSZYSTKIE wątki z forum raportów'),

  new SlashCommandBuilder().setName('wyczyscstatystyki').setDescription('🧽 TYLKO ADMIN - Zeruj statystyki we wszystkich aktywnych wątkach'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
client.once('ready', async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandDefinitions });
    console.log('✅ Slash commands zarejestrowane');
  } catch (err) { console.error(err); }
});

// -------------------- INTERACTIONS --------------------
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;

    const forumChannel = await interaction.guild.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
    if (!forumChannel) return;

    const member = interaction.member;
    const isAdmin = isAdminMember(member);

    // ===== Slash commands =====
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      const cmd = interaction.commandName;

      // /raport
      if (cmd === 'raport') {
        const typ = interaction.options.getString('typ', true);
        const attachment = interaction.options.getAttachment('zdjecie');
        const kwota = PREMIE[typ] ?? 0;
        const userId = interaction.user.id;
        const guildMember = await interaction.guild.members.fetch(userId).catch(() => null);
        const username = guildMember?.user?.username ?? interaction.user.username;
        const uid = extractUIDFromMember(guildMember);

        const threadsFetched = await forumChannel.threads.fetch().catch(() => null);
        let thread = threadsFetched?.threads.find(t => t.name === `Raporty — ${username}`) ||
                     threadsFetched?.threads.find(t => t.name?.includes(username)) || null;

        if (!thread) {
          const statsEmbed = buildStatsEmbed(username, userId);
          thread = await forumChannel.threads.create({
            name: `Raporty — ${username}`,
            autoArchiveDuration: 1440,
            reason: `Nowy wątek raportów: ${interaction.user.tag}`,
            message: { embeds: [statsEmbed] }
          });
          const starter = await thread.fetchStarterMessage().catch(() => null);
          if (starter?.pin) await starter.pin().catch(() => {});
        }

        const contentLines = [
          `📋 **Raport**`,
          `• Typ: **${typ}**`,
          `• Premia: **$${kwota}**`,
          `• Użytkownik: <@${userId}>${uid ? ` • UID: **${uid}**` : ''}`,
          attachment ? `• Załącznik: ${attachment.url}` : null
        ].filter(Boolean);

        const sent = await thread.send({
          content: contentLines.join('\n'),
          components: [buildButtonsRow(false)]
        });

        await zapiszRaport({ userId, uid, username, typ, kwota, attachment: attachment?.url, messageId: sent.id, threadId: thread.id });
        await aktualizujStatystyki(userId, username, forumChannel);

        await interaction.editReply({ content: `✅ Raport dodany do wątku **${thread.name}**` }).catch(() => {});
        return;
      }

      // /premia
      if (cmd === 'premia') {
        const user = interaction.options.getUser('uzytkownik', true);
        const total = sumaPremii(user.id);
        await interaction.editReply({ content: `💰 Suma zaakceptowanych premii dla **${user.tag}**: **$${total}**` }).catch(() => {});
        return;
      }

      // /premiaall
      if (cmd === 'premiaall') {
        if (!isAdmin) { await interaction.editReply({ content: '❌ Nie masz uprawnień.' }).catch(() => {}); return; }

        const payouts = wszystkieWyplaty();
        const entries = Object.entries(payouts);
        if (entries.length === 0) {
          await interaction.editReply({ content: '💰 Brak zatwierdzonych raportów.' }).catch(() => {});
          return;
        }

        const lines = [];
        for (const [discordId, kwota] of entries) {
          const uid = await resolveUIDPreferNick(discordId, interaction.guild);
          lines.push(`${uid};${kwota};Premia USSS`);
        }

        lines.sort((a, b) => {
          const [uidA] = a.split(';');
          const [uidB] = b.split(';');
          const aEmpty = uidA === '';
          const bEmpty = uidB === '';
          if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
          const nA = Number(uidA), nB = Number(uidB);
          if (!Number.isNaN(nA) && !Number.isNaN(nB) && nA !== nB) return nA - nB;
          return 0;
        });

        const content = lines.join('\n');
        if (content.length > 1900) {
          const buf = Buffer.from(content, 'utf8');
          await interaction.editReply({
            content: `📄 Długi wynik — plik (${lines.length} pozycji).`,
            files: [{ attachment: buf, name: 'premiaall.txt' }]
          }).catch(() => {});
        } else {
          await interaction.editReply({ content: `\`\`\`\n${content}\n\`\`\`` }).catch(() => {});
        }
        return;
      }

      // /wyczyscraporty
      if (cmd === 'wyczyscraporty') {
        if (!isAdmin) { await interaction.editReply({ content: '❌ Nie masz uprawnień.' }).catch(() => {}); return; }

        const reportsForum = await interaction.guild.channels.fetch(REPORTS_FORUM_ID).catch(() => null);
        if (!reportsForum) {
          await interaction.editReply({ content: `⚠️ Nie znaleziono forum raportów: **${REPORTS_FORUM_ID}**` }).catch(() => {});
          return;
        }

        const { count, backup } = backupAndClearRaporty();
        const del = await deleteAllForumThreads(reportsForum);

        // Wyczyść cache stanów
        lastKnownStates.clear();

        await interaction.editReply({
          content:
            `🧨 Wyczyszczono raporty z JSON: **${count}**.\n` +
            `📦 Backup: \`${backup}\`\n` +
            `🧵 Forum <#${REPORTS_FORUM_ID}>: usunięto wątki **${del.deleted}**` +
            (del.failed ? ` (❗ błędy: **${del.failed}**)` : '') +
            `.`
        }).catch(() => {});
        return;
      }

      // /wyczyscstatystyki
      if (cmd === 'wyczyscstatystyki') {
        if (!isAdmin) { await interaction.editReply({ content: '❌ Nie masz uprawnień.' }).catch(() => {}); return; }
        const forum = await interaction.guild.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
        if (!forum) { await interaction.editReply({ content: '⚠️ Nie znaleziono kanału forum.' }).catch(() => {}); return; }
        const { ok, fail } = await resetAllStatsEmbeds(forum);
        await interaction.editReply({
          content: `🧽 Zresetowano statystyki: **${ok}** OK, **${fail}** błędów.\nℹ️ Reset dotyczy tylko *aktywnych* wątków forum.`
        }).catch(() => {});
        return;
      }
    }

    // ===== Buttons =====
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const message = interaction.message;
      const messageId = message.id;

      if (!isAdmin) {
        await interaction.deferUpdate().catch(() => {});
        await interaction.followUp({ content: '❌ Tylko administracja może wykonywać tę akcję.', ephemeral: true }).catch(() => {});
        return;
      }

      if (customId === 'zatwierdz') {
        await interaction.deferUpdate().catch(() => {});
        const r = aktualizujStatusRaportu(messageId, 'accepted');
        if (!r) {
          await interaction.followUp({ content: '⚠️ Nie znaleziono tego raportu w bazie.', ephemeral: true }).catch(() => {});
          return;
        }

        const newContent = `${message.content}\n\n✅ **Status:** zaakceptowano przez <@${interaction.user.id}>`;
        await message.edit({ content: newContent, components: [buildButtonsRow(true)] }).catch(() => {});

        const forum = await interaction.guild.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
        const memberUser = await interaction.guild.members.fetch(r.userId).catch(() => null);
        if (forum) {
          await aktualizujStatystyki(r.userId, memberUser?.user?.username ?? r.username ?? r.userId, forum);
        }

        await interaction.followUp({ content: '✅ Raport zaakceptowany.', ephemeral: true }).catch(() => {});
        return;
      }

      if (customId === 'odrzuc') {
        await interaction.deferUpdate().catch(() => {});
        const r = aktualizujStatusRaportu(messageId, 'rejected');
        if (!r) {
          await interaction.followUp({ content: '⚠️ Nie znaleziono tego raportu w bazie.', ephemeral: true }).catch(() => {});
          return;
        }

        const newContent = `${message.content}\n\n❌ **Status:** odrzucono przez <@${interaction.user.id}>`;
        await message.edit({ content: newContent, components: [buildButtonsRow(true)] }).catch(() => {});

        const forum = await interaction.guild.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
        const memberUser = await interaction.guild.members.fetch(r.userId).catch(() => null);
        if (forum) {
          await aktualizujStatystyki(r.userId, memberUser?.user?.username ?? r.username ?? r.userId, forum);
        }

        await interaction.followUp({ content: '🛑 Raport odrzucony.', ephemeral: true }).catch(() => {});
        return;
      }

      if (customId === 'zmien_typ') {
        await interaction.deferUpdate().catch(() => {});
        const r = readRaporty().find(x => x.id === messageId);
        if (!r) {
          await interaction.followUp({ content: '⚠️ Nie znaleziono tego raportu w bazie.', ephemeral: true }).catch(() => {});
          return;
        }

        await interaction.followUp({
          content: '🔄 Wybierz nowy typ premii:',
          components: [buildSelectTyp(r.typ)],
          ephemeral: true
        }).catch(() => {});
        return;
      }
    }

    // ===== Select (zmiana typu) =====
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_typ') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      if (!isAdmin) {
        await interaction.editReply({ content: '❌ Tylko administracja może wykonywać tę akcję.' }).catch(() => {});
        return;
      }
      const newTyp = interaction.values?.[0];
      if (!newTyp || !(newTyp in PREMIE)) {
        await interaction.editReply({ content: '⚠️ Niepoprawny typ.' }).catch(() => {});
        return;
      }

      const channel = interaction.channel;
      const fetched = await channel.messages.fetch({ limit: 25 }).catch(() => null);
      const target = fetched?.find(m => m.author.id === client.user.id && m.components?.some(row =>
        row.components?.some(c => c.type === ComponentType.Button && c.customId === 'zmien_typ')
      ));
      const messageToEdit = target || null;
      const mid = messageToEdit?.id || null;

      if (!mid) {
        await interaction.editReply({ content: '⚠️ Nie udało się odnaleźć wiadomości raportu do zmiany.' }).catch(() => {});
        return;
      }

      const updated = zmienTypRaportu(mid, newTyp);
      if (!updated) {
        await interaction.editReply({ content: '⚠️ Nie znaleziono raportu w bazie.' }).catch(() => {});
        return;
      }

      const old = messageToEdit.content || '';
      const newLines = old
        .split('\n')
        .map(line => {
          if (line.startsWith('• Typ:')) return `• Typ: **${updated.typ}**`;
          if (line.startsWith('• Premia:')) return `• Premia: **$${updated.kwota}**`;
          return line;
        });
      await messageToEdit.edit({ content: newLines.join('\n') }).catch(() => {});

      const forum = await interaction.guild.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
      const memberUser = await interaction.guild.members.fetch(updated.userId).catch(() => null);
      if (forum) {
        await aktualizujStatystyki(updated.userId, memberUser?.user?.username ?? updated.username ?? updated.userId, forum);
      }

      await interaction.editReply({ content: `✅ Zmieniono typ na **${newTyp}** (premia $${PREMIE[newTyp]}).` }).catch(() => {});
      return;
    }

  } catch (err) {
    console.error(err);
    try {
      if (interaction) {
        if (interaction.deferred) {
          await interaction.editReply({ content: '❌ Błąd interakcji' }).catch(() => {});
        } else if (!interaction.replied) {
          await interaction.reply({ content: '❌ Błąd interakcji', ephemeral: true }).catch(() => {});
        }
      }
    } catch (_) {}
  }
});

// -------------------- !SAY --------------------
client.on('messageCreate', async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.content?.startsWith('!say ')) return;

    const member = message.member;
    if (!isAdminMember(member)) return;

    const text = message.content.slice(5).trim();
    if (!text && message.attachments.size === 0) return;

    const canDelete = message.guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageMessages);
    const delPromise = canDelete ? message.delete().catch(() => {}) : Promise.resolve();

    const attachmentLines = message.attachments.size
      ? '\n' + Array.from(message.attachments.values()).map(a => a.url).join('\n')
      : '';

    await message.channel.send({
      content: `${text}${attachmentLines}`,
      allowedMentions: { parse: ['users'], repliedUser: false }
    });

    await delPromise;
  } catch (err) {
    console.error('!say error:', err);
  }
});

// -------------------- LOGIN --------------------
client.login(process.env.TOKEN);
