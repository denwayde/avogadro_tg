import dotenv from 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
    await ctx.reply(
        'Привет! Нажмите на кнопку ниже, чтобы открыть веб-приложение:',
        Markup.keyboard([
            [Markup.button.webApp('Заполнить заявку', 'https://avogadro-online-school.netlify.app')],
        ])
        .resize()
    );
});

bot.launch();