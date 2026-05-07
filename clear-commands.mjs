import { REST, Routes } from 'discord.js';

const TOKEN     = process.env.TOKEN     || process.argv[2];
const CLIENT_ID = process.env.CLIENT_ID || process.argv[3];
const GUILD_ID  = process.env.GUILD_ID  || process.argv[4];

if (!TOKEN || !CLIENT_ID) {
    console.error('Usage: node clear-commands.mjs <TOKEN> <CLIENT_ID> [GUILD_ID]');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Vider les commandes globales
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
console.log('✅ Commandes globales supprimées');

// Vider les commandes guild si GUILD_ID fourni
if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    console.log(`✅ Commandes guild (${GUILD_ID}) supprimées`);
}

console.log('Fini. Redémarre le bot sur Railway pour enregistrer les nouvelles commandes.');
