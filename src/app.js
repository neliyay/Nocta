import 'dotenv/config';
import {
    Client, GatewayIntentBits, REST, Routes,
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder
} from 'discord.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Warnings (stockage JSON) ─────────────────────────────────────────────────

const WARNINGS_FILE = join(__dirname, '..', 'warnings.json');

function loadWarnings() {
    if (!existsSync(WARNINGS_FILE)) writeFileSync(WARNINGS_FILE, '{}');
    return JSON.parse(readFileSync(WARNINGS_FILE, 'utf8'));
}

function saveWarnings(data) {
    writeFileSync(WARNINGS_FILE, JSON.stringify(data, null, 2));
}

// ─── Définition des commandes slash ──────────────────────────────────────────

const commands = [
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannir un membre du serveur')
        .addUserOption(o => o.setName('membre').setDescription('Membre à bannir').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Débannir un utilisateur')
        .addStringOption(o => o.setName('id').setDescription("ID de l'utilisateur").setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulser un membre du serveur')
        .addUserOption(o => o.setName('membre').setDescription('Membre à expulser').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du kick'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Rendre muet un membre temporairement')
        .addUserOption(o => o.setName('membre').setDescription('Membre à mute').setRequired(true))
        .addStringOption(o => o.setName('durée').setDescription('Durée du mute').setRequired(true)
            .addChoices(
                { name: '5 minutes',  value: '300000'    },
                { name: '10 minutes', value: '600000'    },
                { name: '30 minutes', value: '1800000'   },
                { name: '1 heure',    value: '3600000'   },
                { name: '6 heures',   value: '21600000'  },
                { name: '1 jour',     value: '86400000'  },
                { name: '1 semaine',  value: '604800000' },
            ))
        .addStringOption(o => o.setName('raison').setDescription('Raison'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription("Retirer le mute d'un membre")
        .addUserOption(o => o.setName('membre').setDescription('Membre à unmute').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertir un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre à avertir').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription("Raison de l'avertissement").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('warnings')
        .setDescription("Voir les avertissements d'un membre")
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription("Effacer tous les avertissements d'un membre")
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Supprimer des messages en masse')
        .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Verrouiller un salon')
        .addChannelOption(o => o.setName('salon').setDescription('Salon à verrouiller (actuel par défaut)'))
        .addStringOption(o => o.setName('raison').setDescription('Raison'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Déverrouiller un salon')
        .addChannelOption(o => o.setName('salon').setDescription('Salon à déverrouiller (actuel par défaut)'))
        .addStringOption(o => o.setName('raison').setDescription('Raison'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('josselin')
        .setDescription('Un fait important sur Josselin'),
];

// ─── Helpers embeds ───────────────────────────────────────────────────────────

const makeEmbed = (color, title, description) =>
    new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();

const ok   = (title, desc) => makeEmbed(0x57F287, `✅ ${title}`, desc);
const err  = (desc)        => makeEmbed(0xED4245, '❌ Erreur',   desc);
const info = (title, desc) => makeEmbed(0x5865F2, title,          desc);

// ─── Client ───────────────────────────────────────────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
    ]
});

client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commandsJson = commands.map(c => c.toJSON());

    // Vider les commandes globales
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log('✅ Commandes globales vidées');
    } catch (e) {
        console.error('Erreur vidage commandes globales :', e);
    }

    // Enregistrer les commandes sur chaque serveur (instantané)
    for (const guild of client.guilds.cache.values()) {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commandsJson });
            console.log(`✅ Commandes enregistrées sur ${guild.name}`);
        } catch (e) {
            console.error(`Erreur sur ${guild.name} :`, e);
        }
    }
});

// ─── Handler principal ────────────────────────────────────────────────────────

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member, channel } = interaction;
    const replyErr = (msg) => interaction.reply({ embeds: [err(msg)], ephemeral: true });

    try {

        // ── /ban ──────────────────────────────────────────────────────────────
        if (commandName === 'ban') {
            const target = interaction.options.getUser('membre');
            const raison = interaction.options.getString('raison') ?? 'Aucune raison fournie';

            if (target.id === interaction.user.id) return replyErr('Tu ne peux pas te bannir toi-même.');
            if (target.id === client.user.id)       return replyErr('Je ne peux pas me bannir moi-même.');

            const m = guild.members.cache.get(target.id);
            if (m) {
                if (!m.bannable) return replyErr('Je ne peux pas bannir ce membre (rôle trop élevé).');
                if (member.roles.highest.comparePositionTo(m.roles.highest) <= 0)
                    return replyErr('Tu ne peux pas bannir un membre avec un rôle supérieur ou égal au tien.');
            }

            await guild.members.ban(target.id, { reason: `${interaction.user.tag} : ${raison}` });
            return interaction.reply({ embeds: [ok('Membre banni', `**${target.tag}** a été banni.\n**Raison :** ${raison}`)] });
        }

        // ── /unban ────────────────────────────────────────────────────────────
        if (commandName === 'unban') {
            const id     = interaction.options.getString('id');
            const raison = interaction.options.getString('raison') ?? 'Aucune raison fournie';
            try {
                const user = await client.users.fetch(id);
                await guild.members.unban(id, `${interaction.user.tag} : ${raison}`);
                return interaction.reply({ embeds: [ok('Membre débanni', `**${user.tag}** a été débanni.\n**Raison :** ${raison}`)] });
            } catch {
                return replyErr('ID invalide ou utilisateur non banni.');
            }
        }

        // ── /kick ─────────────────────────────────────────────────────────────
        if (commandName === 'kick') {
            const target = interaction.options.getUser('membre');
            const raison = interaction.options.getString('raison') ?? 'Aucune raison fournie';

            if (target.id === interaction.user.id) return replyErr('Tu ne peux pas te kick toi-même.');
            if (target.id === client.user.id)       return replyErr('Je ne peux pas me kick moi-même.');

            const m = guild.members.cache.get(target.id);
            if (!m)          return replyErr("Ce membre n'est pas sur le serveur.");
            if (!m.kickable) return replyErr('Je ne peux pas kick ce membre.');
            if (member.roles.highest.comparePositionTo(m.roles.highest) <= 0)
                return replyErr('Tu ne peux pas kick un membre avec un rôle supérieur ou égal au tien.');

            await m.kick(`${interaction.user.tag} : ${raison}`);
            return interaction.reply({ embeds: [ok('Membre expulsé', `**${target.tag}** a été expulsé.\n**Raison :** ${raison}`)] });
        }

        // ── /timeout ──────────────────────────────────────────────────────────
        if (commandName === 'timeout') {
            const target   = interaction.options.getUser('membre');
            const duration = parseInt(interaction.options.getString('durée'));
            const raison   = interaction.options.getString('raison') ?? 'Aucune raison fournie';

            if (target.id === interaction.user.id) return replyErr('Tu ne peux pas te mute toi-même.');
            if (target.id === client.user.id)       return replyErr('Je ne peux pas me mute moi-même.');

            const m = guild.members.cache.get(target.id);
            if (!m)             return replyErr("Ce membre n'est pas sur le serveur.");
            if (!m.moderatable) return replyErr('Je ne peux pas mute ce membre.');
            if (member.roles.highest.comparePositionTo(m.roles.highest) <= 0)
                return replyErr('Tu ne peux pas mute un membre avec un rôle supérieur ou égal au tien.');

            const labels = {
                '300000': '5 minutes', '600000': '10 minutes', '1800000': '30 minutes',
                '3600000': '1 heure', '21600000': '6 heures', '86400000': '1 jour', '604800000': '1 semaine',
            };

            await m.timeout(duration, `${interaction.user.tag} : ${raison}`);
            return interaction.reply({ embeds: [ok('Membre mute', `**${target.tag}** a été mute pour **${labels[String(duration)]}**.\n**Raison :** ${raison}`)] });
        }

        // ── /untimeout ────────────────────────────────────────────────────────
        if (commandName === 'untimeout') {
            const target = interaction.options.getUser('membre');
            const raison = interaction.options.getString('raison') ?? 'Aucune raison fournie';

            const m = guild.members.cache.get(target.id);
            if (!m) return replyErr("Ce membre n'est pas sur le serveur.");

            await m.timeout(null, `${interaction.user.tag} : ${raison}`);
            return interaction.reply({ embeds: [ok('Membre unmute', `**${target.tag}** a été unmute.\n**Raison :** ${raison}`)] });
        }

        // ── /warn ─────────────────────────────────────────────────────────────
        if (commandName === 'warn') {
            const target = interaction.options.getUser('membre');
            const raison = interaction.options.getString('raison');

            if (target.id === interaction.user.id) return replyErr('Tu ne peux pas te warn toi-même.');
            if (target.bot)                         return replyErr('Tu ne peux pas warn un bot.');

            const warnings = loadWarnings();
            const key = `${guild.id}_${target.id}`;
            if (!warnings[key]) warnings[key] = [];
            warnings[key].push({ raison, moderateur: interaction.user.tag, date: new Date().toISOString() });
            saveWarnings(warnings);

            return interaction.reply({ embeds: [ok('Avertissement envoyé', `**${target.tag}** a reçu un avertissement.\n**Raison :** ${raison}\n**Total :** ${warnings[key].length} avertissement(s)`)] });
        }

        // ── /warnings ─────────────────────────────────────────────────────────
        if (commandName === 'warnings') {
            const target   = interaction.options.getUser('membre');
            const warnings = loadWarnings();
            const key      = `${guild.id}_${target.id}`;
            const list     = warnings[key] ?? [];

            if (list.length === 0)
                return interaction.reply({ embeds: [info(`📋 Avertissements de ${target.tag}`, 'Aucun avertissement.')] });

            const text = list.map((w, i) =>
                `**#${i + 1}** — ${w.raison}\n*Par ${w.moderateur} le ${new Date(w.date).toLocaleDateString('fr-FR')}*`
            ).join('\n\n');

            return interaction.reply({ embeds: [info(`📋 Avertissements de ${target.tag}`, text)] });
        }

        // ── /clearwarnings ────────────────────────────────────────────────────
        if (commandName === 'clearwarnings') {
            const target   = interaction.options.getUser('membre');
            const warnings = loadWarnings();
            const key      = `${guild.id}_${target.id}`;
            warnings[key]  = [];
            saveWarnings(warnings);

            return interaction.reply({ embeds: [ok('Avertissements effacés', `Les avertissements de **${target.tag}** ont été effacés.`)] });
        }

        // ── /purge ────────────────────────────────────────────────────────────
        if (commandName === 'purge') {
            const nombre = interaction.options.getInteger('nombre');
            await interaction.deferReply({ ephemeral: true });
            const deleted = await channel.bulkDelete(nombre, true);
            return interaction.editReply({ embeds: [ok('Messages supprimés', `**${deleted.size}** message(s) supprimé(s).`)] });
        }

        // ── /lock ─────────────────────────────────────────────────────────────
        if (commandName === 'lock') {
            const target = interaction.options.getChannel('salon') ?? channel;
            const raison = interaction.options.getString('raison') ?? 'Aucune raison fournie';
            await target.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            return interaction.reply({ embeds: [ok('Salon verrouillé', `${target} a été verrouillé.\n**Raison :** ${raison}`)] });
        }

        // ── /unlock ───────────────────────────────────────────────────────────
        if (commandName === 'unlock') {
            const target = interaction.options.getChannel('salon') ?? channel;
            const raison = interaction.options.getString('raison') ?? 'Aucune raison fournie';
            await target.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            return interaction.reply({ embeds: [ok('Salon déverrouillé', `${target} a été déverrouillé.\n**Raison :** ${raison}`)] });
        }

        // ── /josselin ─────────────────────────────────────────────────────────
        if (commandName === 'josselin') {
            return interaction.reply('josselin est un pd');
        }

    } catch (e) {
        console.error(e);
        const reply = { embeds: [err('Une erreur inattendue est survenue.')], ephemeral: true };
        if (interaction.replied || interaction.deferred) interaction.editReply(reply);
        else interaction.reply(reply);
    }
});

client.login(process.env.TOKEN);
