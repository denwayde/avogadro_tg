import dotenv from 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import connection from './db.js';

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async(ctx) => {
    await ctx.reply(
        'Привет! Нажмите на кнопку ниже, чтобы открыть веб-приложение:',
        Markup.keyboard([
            [Markup.button.webApp('Заполнить заявку', 'https://avogadro-online-school.netlify.app')],
        ])
        .resize()
    );
});

bot.on("message", async (ctx) => {
    console.log(ctx.message.web_app_data)
    await connection.execute("INSERT INTO students (username, phone, email, course_id) VALUES (?,?,?,?)", [Object.values(JSON.parse(ctx.message.web_app_data.data))])
    await ctx.reply(ctx.message.web_app_data.data) 
  
  });
//   {
//     button_text: 'Заполнить заявку',
//     data: '{"name":"Динис Гибадуллин","phone":"89603827499","email":"denwayde09@gmail.com","selectValue":"2"}'
//   }

bot.launch();