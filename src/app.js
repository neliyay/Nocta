import 'dotenv/config';
import {
    Client, GatewayIntentBits, REST, Routes,
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType
} from 'discord.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WARNINGS_FILE = join(__dirname, '..', 'warnings.json');
const TICKETS_FILE  = join(__dirname, '..', 'tickets.json');

function loadWarnings() {
    if (!existsSync(WARNINGS_FILE)) writeFileSync(WARNINGS_FILE, '{}');
    return JSON.parse(readFileSync(WARNINGS_FILE, 'utf8'));
}
function saveWarnings(data) {
    writeFileSync(WARNINGS_FILE, JSON.stringify(data, null, 2));
}

function loadTickets() {
    if (!existsSync(TICKETS_FILE)) writeFileSync(TICKETS_FILE, '{}');
    return JSON.parse(readFileSync(TICKETS_FILE, 'utf8'));
}
function saveTickets(data) {
    writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
}

const commands = [
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user')
        .addStringOption(o => o.setName('id').setDescription('User ID').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the kick'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Temporarily timeout a member')
        .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Timeout duration').setRequired(true)
            .addChoices(
                { name: '5 minutes',  value: '300000'    },
                { name: '10 minutes', value: '600000'    },
                { name: '30 minutes', value: '1800000'   },
                { name: '1 hour',     value: '3600000'   },
                { name: '6 hours',    value: '21600000'  },
                { name: '1 day',      value: '86400000'  },
                { name: '1 week',     value: '604800000' },
            ))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove timeout from a member')
        .addUserOption(o => o.setName('user').setDescription('Member to untimeout').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member')
        .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('warnings')
        .setDescription("View a member's warnings")
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Clear all warnings of a member')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete messages in bulk')
        .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to lock (current by default)'))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to unlock (current by default)'))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Send the ticket panel in this channel')
        .addRoleOption(o => o.setName('staffrole').setDescription('Role that can see tickets').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
        .setName('josselin')
        .setDescription('An important fact about Josselin'),
];

const makeEmbed = (color, title, description) =>
    new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();

const ok   = (title, desc) => makeEmbed(0x57F287, `✅ ${title}`, desc);
const err  = (desc)        => makeEmbed(0xED4245, '❌ Error',    desc);
const info = (title, desc) => makeEmbed(0x5865F2, title,          desc);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
    ]
});

client.once('ready', async () => {
    console.log(`✅ Connected as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commandsJson = commands.map(c => c.toJSON());

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log('✅ Global commands cleared');
    } catch (e) {
        console.error('Error clearing global commands:', e);
    }

    for (const guild of client.guilds.cache.values()) {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commandsJson });
            console.log(`✅ Commands registered on ${guild.name}`);
        } catch (e) {
            console.error(`Error on ${guild.name}:`, e);
        }
    }
});

client.on('interactionCreate', async interaction => {
    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
        if (interaction.customId === 'ticket_create') {
            await handleTicketCreate(interaction);
            return;
        }
        if (interaction.customId === 'ticket_close') {
            await handleTicketClose(interaction);
            return;
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member, channel } = interaction;
    const replyErr = (msg) => interaction.reply({ embeds: [err(msg)], ephemeral: true });

    try {

        if (commandName === 'ban') {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') ?? 'No reason provided';

            if (target.id === interaction.user.id) return replyErr('You cannot ban yourself.');
            if (target.id === client.user.id)       return replyErr('I cannot ban myself.');

            const m = guild.members.cache.get(target.id);
            if (m) {
                if (!m.bannable) return replyErr('I cannot ban this member (role too high).');
                if (member.roles.highest.comparePositionTo(m.roles.highest) <= 0)
                    return replyErr('You cannot ban a member with a higher or equal role.');
            }

            await guild.members.ban(target.id, { reason: `${interaction.user.tag}: ${reason}` });
            return interaction.reply({ embeds: [ok('Member Banned', `**${target.tag}** has been banned.\n**Reason:** ${reason}`)] });
        }

        if (commandName === 'unban') {
            const id     = interaction.options.getString('id');
            const reason = interaction.options.getString('reason') ?? 'No reason provided';
            try {
                const user = await client.users.fetch(id);
                await guild.members.unban(id, `${interaction.user.tag}: ${reason}`);
                return interaction.reply({ embeds: [ok('Member Unbanned', `**${user.tag}** has been unbanned.\n**Reason:** ${reason}`)] });
            } catch {
                return replyErr('Invalid ID or user is not banned.');
            }
        }

        if (commandName === 'kick') {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') ?? 'No reason provided';

            if (target.id === interaction.user.id) return replyErr('You cannot kick yourself.');
            if (target.id === client.user.id)       return replyErr('I cannot kick myself.');

            const m = guild.members.cache.get(target.id);
            if (!m)          return replyErr('This member is not in the server.');
            if (!m.kickable) return replyErr('I cannot kick this member.');
            if (member.roles.highest.comparePositionTo(m.roles.highest) <= 0)
                return replyErr('You cannot kick a member with a higher or equal role.');

            await m.kick(`${interaction.user.tag}: ${reason}`);
            return interaction.reply({ embeds: [ok('Member Kicked', `**${target.tag}** has been kicked.\n**Reason:** ${reason}`)] });
        }

        if (commandName === 'timeout') {
            const target   = interaction.options.getUser('user');
            const duration = parseInt(interaction.options.getString('duration'));
            const reason   = interaction.options.getString('reason') ?? 'No reason provided';

            if (target.id === interaction.user.id) return replyErr('You cannot timeout yourself.');
            if (target.id === client.user.id)       return replyErr('I cannot timeout myself.');

            const m = guild.members.cache.get(target.id);
            if (!m)             return replyErr('This member is not in the server.');
            if (!m.moderatable) return replyErr('I cannot timeout this member.');
            if (member.roles.highest.comparePositionTo(m.roles.highest) <= 0)
                return replyErr('You cannot timeout a member with a higher or equal role.');

            const labels = {
                '300000': '5 minutes', '600000': '10 minutes', '1800000': '30 minutes',
                '3600000': '1 hour', '21600000': '6 hours', '86400000': '1 day', '604800000': '1 week',
            };

            await m.timeout(duration, `${interaction.user.tag}: ${reason}`);
            return interaction.reply({ embeds: [ok('Member Timed Out', `**${target.tag}** has been timed out for **${labels[String(duration)]}**.\n**Reason:** ${reason}`)] });
        }

        if (commandName === 'untimeout') {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') ?? 'No reason provided';

            const m = guild.members.cache.get(target.id);
            if (!m) return replyErr('This member is not in the server.');

            await m.timeout(null, `${interaction.user.tag}: ${reason}`);
            return interaction.reply({ embeds: [ok('Timeout Removed', `**${target.tag}**'s timeout has been removed.\n**Reason:** ${reason}`)] });
        }

        if (commandName === 'warn') {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            if (target.id === interaction.user.id) return replyErr('You cannot warn yourself.');
            if (target.bot)                         return replyErr('You cannot warn a bot.');

            const warnings = loadWarnings();
            const key = `${guild.id}_${target.id}`;
            if (!warnings[key]) warnings[key] = [];
            warnings[key].push({ reason, moderator: interaction.user.tag, date: new Date().toISOString() });
            saveWarnings(warnings);

            return interaction.reply({ embeds: [ok('Warning Issued', `**${target.tag}** has been warned.\n**Reason:** ${reason}\n**Total:** ${warnings[key].length} warning(s)`)] });
        }

        if (commandName === 'warnings') {
            const target   = interaction.options.getUser('user');
            const warnings = loadWarnings();
            const key      = `${guild.id}_${target.id}`;
            const list     = warnings[key] ?? [];

            if (list.length === 0)
                return interaction.reply({ embeds: [info(`📋 Warnings — ${target.tag}`, 'No warnings.')] });

            const text = list.map((w, i) =>
                `**#${i + 1}** — ${w.reason ?? w.raison}\n*By ${w.moderator ?? w.moderateur} on ${new Date(w.date).toLocaleDateString('en-US')}*`
            ).join('\n\n');

            return interaction.reply({ embeds: [info(`📋 Warnings — ${target.tag}`, text)] });
        }

        if (commandName === 'clearwarnings') {
            const target   = interaction.options.getUser('user');
            const warnings = loadWarnings();
            const key      = `${guild.id}_${target.id}`;
            warnings[key]  = [];
            saveWarnings(warnings);

            return interaction.reply({ embeds: [ok('Warnings Cleared', `All warnings for **${target.tag}** have been cleared.`)] });
        }

        if (commandName === 'purge') {
            const amount = interaction.options.getInteger('amount');
            await interaction.deferReply({ ephemeral: true });
            const deleted = await channel.bulkDelete(amount, true);
            return interaction.editReply({ embeds: [ok('Messages Deleted', `**${deleted.size}** message(s) deleted.`)] });
        }

        if (commandName === 'lock') {
            const target = interaction.options.getChannel('channel') ?? channel;
            const reason = interaction.options.getString('reason') ?? 'No reason provided';
            await target.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            return interaction.reply({ embeds: [ok('Channel Locked', `${target} has been locked.\n**Reason:** ${reason}`)] });
        }

        if (commandName === 'unlock') {
            const target = interaction.options.getChannel('channel') ?? channel;
            const reason = interaction.options.getString('reason') ?? 'No reason provided';
            await target.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            return interaction.reply({ embeds: [ok('Channel Unlocked', `${target} has been unlocked.\n**Reason:** ${reason}`)] });
        }

        if (commandName === 'ticketpanel') {
            const staffRole = interaction.options.getRole('staffrole');

            const tickets = loadTickets();
            if (!tickets[guild.id]) tickets[guild.id] = {};
            tickets[guild.id].staffRoleId = staffRole.id;
            saveTickets(tickets);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎫 Support Tickets')
                .setDescription('Need help? Click the button below to open a ticket.\nOur staff will assist you as soon as possible.')
                .setFooter({ text: guild.name });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_create')
                    .setLabel('Open a Ticket')
                    .setEmoji('🎫')
                    .setStyle(ButtonStyle.Primary)
            );

            await channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ embeds: [ok('Panel Sent', `Ticket panel sent. Staff role: ${staffRole}`)], ephemeral: true });
        }

        if (commandName === 'josselin') {
            return interaction.reply('josselin est un pd');
        }

    } catch (e) {
        console.error(e);
        const reply = { embeds: [err('An unexpected error occurred.')], ephemeral: true };
        if (interaction.replied || interaction.deferred) interaction.editReply(reply);
        else interaction.reply(reply);
    }
});

async function handleTicketCreate(interaction) {
    try {
        const guild  = interaction.guild;
        const user   = interaction.user;

        const tickets = loadTickets();
        const staffRoleId = tickets[guild.id]?.staffRoleId;

        // Check if user already has an open ticket
        const existing = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
        if (existing) {
            return interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
        }

        const permissionOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ];

        if (staffRoleId) {
            permissionOverwrites.push({
                id: staffRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            });
        }

        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            type: ChannelType.GuildText,
            permissionOverwrites,
        });

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎫 Ticket Opened')
            .setDescription(`Hello ${user}! A member of our staff will be with you shortly.\nDescribe your issue and we'll help you as soon as possible.`)
            .setFooter({ text: `Opened by ${user.tag}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `${user}${staffRoleId ? ` <@&${staffRoleId}>` : ''}`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `Your ticket has been created: ${ticketChannel}`, ephemeral: true });

    } catch (e) {
        console.error('Error creating ticket:', e);
        await interaction.reply({ content: 'An error occurred while creating your ticket.', ephemeral: true });
    }
}

async function handleTicketClose(interaction) {
    try {
        const channel = interaction.channel;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🔒 Ticket Closing')
            .setDescription(`Ticket closed by ${interaction.user}.\nThis channel will be deleted in 5 seconds.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        setTimeout(() => channel.delete().catch(() => null), 5000);

    } catch (e) {
        console.error('Error closing ticket:', e);
        await interaction.reply({ content: 'An error occurred while closing the ticket.', ephemeral: true });
    }
}

client.login(process.env.DISCORD_TOKEN);
