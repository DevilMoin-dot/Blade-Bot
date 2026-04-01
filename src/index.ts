  import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  Message,
  TextChannel
} from "discord.js";
import { createServer } from "http";

// ===== WEB SERVER (FOR RENDER) =====
createServer((_req, res) => {
  res.writeHead(200);
  res.end("Bot is alive!");
}).listen(3000, "0.0.0.0");

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONFIG =====
const OWNER_IDS = [
  "1340615307282219078",
  "1456966272704053363"
];

let autoGame = false;
let currentCollector: any = null;

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check latency"),

  new SlashCommandBuilder()
    .setName("gtn")
    .setDescription("Guess the number game")
    .addIntegerOption(o =>
      o.setName("min")
        .setDescription("Minimum")
        .setMinValue(0)
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("max")
        .setDescription("Maximum")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("number")
        .setDescription("Force number (must be within min/max)")
    )
    .addBooleanOption(o =>
      o.setName("auto")
        .setDescription("Auto restart")
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    )
];

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user!.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

  await rest.put(
    Routes.applicationCommands(client.user!.id),
    { body: commands.map(c => c.toJSON()) }
  );
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  // ---- /ping ----
  if (cmd.commandName === "ping") {
    await cmd.reply(`🏓 ${Math.round(client.ws.ping)}ms`);
  }

  // ---- /warn ----
  if (cmd.commandName === "warn") {
    if (!OWNER_IDS.includes(cmd.user.id)) {
      await cmd.reply("❌ No permission");
      return;
    }

    const user = cmd.options.getUser("user", true);
    const reason = cmd.options.getString("reason", true);

    await cmd.reply(`⚠️ <@${user.id}> has been warned.\nReason: ${reason}`);
  }

  // ---- /gtn ----
  if (cmd.commandName === "gtn") {
    const min = cmd.options.getInteger("min", true);
    const max = cmd.options.getInteger("max", true);
    const forced = cmd.options.getInteger("number");
    const auto = cmd.options.getBoolean("auto");

    if (min >= max) {
      await cmd.reply("❌ Min must be smaller than max!");
      return;
    }

    if (forced !== null && (forced < min || forced > max)) {
      await cmd.reply("❌ Forced number must be within min/max range!");
      return;
    }

    if (auto !== null) {
      autoGame = auto;

      if (!autoGame) {
        if (currentCollector) {
          currentCollector.stop("stopped");
          currentCollector = null;
        }
        await cmd.reply("🛑 Auto mode DISABLED. Game stopped.");
        return;
      }

      if (currentCollector) {
        await cmd.reply("❌ A game is already running!");
        return;
      }

      await cmd.reply("🔁 Auto mode ENABLED. Starting game...");

    } else {
      if (currentCollector) {
        await cmd.reply("❌ A game is already running!");
        return;
      }

      await cmd.reply("🎮 Game started!");
    }

    const channel = cmd.channel as TextChannel;

    async function startGame(forceNumber: number | null) {
      const target =
        forceNumber ?? Math.floor(Math.random() * (max - min + 1)) + min;

      try {
        const owner = await client.users.fetch("1340615307282219078");
        await owner.send(`🎯 Number is: ${target}`);
      } catch {}

      await channel.send(`🎲 Guess a number between **${min}** and **${max}**!`);

      const collector = channel.createMessageCollector({
        filter: (m: Message) =>
          !m.author.bot && /^\d+$/.test(m.content.trim())
      });

      currentCollector = collector;

      collector.on("collect", async (m: Message) => {
        const guess = Number(m.content);

        if (guess === target) {
          await m.reply(`🎉 ${m.author} got it! (**${target}**)`);
          collector.stop("win");
          return;
        }

        await m.react(guess < target ? "⬆️" : "⬇️");
      });

      collector.on("end", async (_, reason) => {
        currentCollector = null;

        if (reason === "win" && autoGame) {
          setTimeout(() => startGame(null), 2000);
        }
      });
    }

    startGame(forced).catch(console.error);
  }
});

// ===== START =====
client.login(process.env.DISCORD_TOKEN);
```
