import dotenv from 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import connection from './db.js';
import { message } from 'telegraf/filters';

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async(ctx) => {
    await ctx.reply(
        'Здравствуйте!👋\nРады видеть вас в школе «Авогадро» 🧪🙂\nЕсли вы уже планируете поступление или только раздумываете 🤔, заполните, пожалуйста, короткую заявку 📋. Мы обязательно свяжемся с вами, ответим на все вопросы 💬 и поможем принять решение! ✨',
        Markup.keyboard([
            [Markup.button.webApp('Заполнить заявку', 'https://avogadro-online-school.netlify.app')],
        ])
        .resize()
    );
});

bot.on(message('web_app_data'), async (ctx) => {
    //console.log(Object.values(JSON.parse(ctx.message.web_app_data.data)))
    // console.log(ctx.message.web_app_data)
    if (ctx.message.web_app_data) {
            let application = Object.values(JSON.parse(ctx.message.web_app_data.data))
            let phone 
            let application_list = application.map(
                (i, index)=>{
                    if(index===1){
                        if (typeof i === 'string' && i.startsWith('8')) {
                            i = '+7' + i.slice(1);
                            phone = i
                        }
                    }
                    return i+'\n'
                }
            )
            let application_str = application_list.join("")
            try {
                await connection.execute("INSERT INTO students (username, phone, email, course_name, format, telega_id) VALUES (?,?,?,?,?,?)", [...application_list,  ctx.chat.id])

            } catch (error) {
                console.log("cant save student "+ error)
            }
            await ctx.reply("💥 Спасибо большое за заявку! 💥\nМы скоро свяжемся с вами.\nЖелаем отличного дня и прекрасного настроения! 😊🌞")
            setTimeout(async ()=>{
                await bot.telegram.sendMessage(process.env.ADMIN_ID, `Новая заявка:\n${application_str}`, 
                    // {
                    //     reply_markup: {
                    //         inline_keyboard: [
                    //             [
                    //               { text: 'Зачислен', callback_data: `accept_${phone}` },
                    //               { text: 'Думает', callback_data: `thinking_${phone}` },
                    //               { text: 'Отказался', callback_data: `rejected_${phone}` }
                    //             ]
                    //           ]
                    //     }
                    // }
                )
            }, 1000)
    }

  });

//   bot.on('callback_query', async (ctx) => {
//     const data = await ctx.callbackQuery.data.split("_"); // tut delaem massiv iz dati
//     if (data[0]=='accept') {
//         try {
//             console.log(data[1])
//             await connection.execute("UPDATE students SET approved = ? WHERE phone = ?", ["Зачислен",  data[1]])
    
//         } catch (error) {
//             console.log("cant update student "+ error)
//         }
//         await ctx.reply(`Вы нажали: ${data}.`);
//     }
    
//     await ctx.answerCbQuery();
//   });
 
//   bot.command('btns', async(ctx) => {
//     try {
//         await ctx.reply('Нажмите на кнопку ниже:', Markup.inlineKeyboard([
//             Markup.button.callback('Кнопка 1', 'callback_data_1'),
//             Markup.button.url('Перейти на занятие', 'https://ya.ru'),
//             Markup.button.webApp('Перейти на занятие', 'https://dzen.ru')
//         ]).resize());
//     } catch (error) {
//         console.error('Ошибка при отправке кнопок:', error);
//     }
//   });

// bot.action('callback_data_1', async(ctx) => {
//     await ctx.reply('Вы нажали на Кнопка 1');
//     await ctx.answerCbQuery()
//   });
//   {
//     button_text: 'Заполнить заявку',
//     data: '{"name":"Динис Гибадуллин","phone":"89603827499","email":"denwayde09@gmail.com","selectValue":"2"}'
//   }

bot.launch();