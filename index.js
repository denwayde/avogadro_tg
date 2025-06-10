import dotenv from 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';

// Инициализация Express приложения
const app = express();
app.use(bodyParser.json());

// Инициализация бота Telegram
const bot = new TelegramBot(process.env.BOT_TOKEN, {polling: true});
const TELEGRAM_CHANNEL = '@avogadro_school';
const VK_GROUP_ID = process.env.VK_GROUP_ID;
const VK_API_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = '5.131';
const ADMIN_ID = process.env.ADMIN_ID;

// Инициализация базы данных SQLite
let db;
async function initializeDatabase() {
  return open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });
}

// Основная функция инициализации приложения
async function initializeApp() {
  try {
    // Инициализация БД
    db = await initializeDatabase();
    
    // Создаем таблицы
    await db.exec(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      phone TEXT,
      email TEXT,
      course_name TEXT,
      format TEXT,
      telega_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    await db.exec(`CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      course TEXT NOT NULL,
      format TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Инициализация обработчиков бота
    setupBotHandlers();
    
    // Инициализация API роутов
    setupApiRoutes();
    
    // Запуск сервера
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

    // Обработка завершения работы
    process.on('SIGINT', async () => {
      try {
        await db.close();
        server.close(() => {
          console.log('Сервер и соединение с БД закрыты');
          process.exit(0);
        });
      } catch (err) {
        console.error('Ошибка при завершении работы:', err);
        process.exit(1);
      }
    });

    return { app, db };
  } catch (error) {
    console.error('Ошибка инициализации приложения:', error);
    process.exit(1);
  }
}

// Настройка обработчиков Telegram бота
function setupBotHandlers() {
  // Обработчик команды /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      'Здравствуйте!👋\nРады видеть вас в школе «Авогадро» 🧪🙂\nЕсли вы уже планируете поступление или только раздумываете 🤔, заполните, пожалуйста, короткую заявку 📋. Мы обязательно свяжемся с вами, ответим на все вопросы 💬 и поможем принять решение! ✨',
      {
        reply_markup: {
          keyboard: [
            [{
              text: 'Заполнить заявку',
              web_app: {url: 'https://avogadro-online-school.netlify.app'}
            }]
          ],
          resize_keyboard: true
        }
      }
    );
  });

  // Обработчик команды /send_post
  bot.onText(/\/send_post/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (parseInt(chatId) !== parseInt(ADMIN_ID)) {
      return bot.sendMessage(chatId, '⛔ У вас нет прав для выполнения этой команды');
    }
    
    const waitingMsg = await bot.sendMessage(
      chatId,
      'Отправьте мне сообщение для поста (можно с текстом и изображением):',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Отменить', callback_data: 'cancel_post' }]
          ]
        }
      }
    );
    
    const mediaHandler = async (msg) => {
      try {
        await bot.deleteMessage(chatId, waitingMsg.message_id);
        
        let postText = msg.caption || msg.text || '';
        let photoId = null;

        if (msg.photo) {
          photoId = msg.photo[msg.photo.length - 1].file_id;
        }

        // Отправка в Telegram канал
        if (photoId) {
          await bot.sendPhoto(
            TELEGRAM_CHANNEL,
            photoId,
            {
              caption: postText,
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📲 Оставить заявку', url: `https://t.me/avogadro_online_school_bot` },
                    { text: '🌐 Мы в VK', url: 'https://vk.com/avogadro_school' }
                  ]
                ]
              }
            }
          );
        } else {
          await bot.sendMessage(
            TELEGRAM_CHANNEL,
            postText,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📲 Оставить заявку', url: `https://t.me/avogadro_online_school_bot` },
                    { text: '🌐 Мы в VK', url: 'https://vk.com/avogadro_school' }
                  ]
                ]
              }
            }
          );
        }

        // Отправка в VK
        if (photoId) {
          const fileLink = await bot.getFileLink(photoId);
          await postToVK(postText, fileLink);
        } else {
          await postToVK(postText);
        }

        await bot.sendMessage(chatId, '✅ Пост успешно опубликован в Telegram и VK!');
      } catch (error) {
        console.error('Ошибка при публикации поста:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
      } finally {
        bot.removeListener('message', mediaHandler);
        bot.removeListener('photo', mediaHandler);
      }
    };

    bot.once('message', mediaHandler);
    bot.once('photo', mediaHandler);
  });

  // Обработчик web_app_data
  bot.on('message', async (msg) => {
    if (msg.web_app_data) {
      const chatId = msg.chat.id;
      let application = Object.values(JSON.parse(msg.web_app_data.data));
      let phone;
      let application_list = application.map(
        (i, index) => {
          if(index === 1) {
            if (typeof i === 'string' && i.startsWith('8')) {
              i = '+7' + i.slice(1);
              phone = i;
            }
          }
          return i + '\n';
        }
      );
      let application_str = application_list.join("");
      
      try {
        await db.run(
          "INSERT INTO students (username, phone, email, course_name, format, telega_id) VALUES (?, ?, ?, ?, ?, ?)", 
          [...application_list, chatId]
        );
      } catch (error) {
        console.log("Ошибка при сохранении студента:", error);
      }
      
      await bot.sendMessage(
        chatId,
        "💥 Спасибо большое за заявку! 💥\nМы скоро свяжемся с вами.\nЖелаем отличного дня и прекрасного настроения! 😊🌞",
        {
          reply_markup: {
            keyboard: [
              [{
                text: 'Заполнить заявку',
                web_app: {url: 'https://avogadro-online-school.netlify.app'}
              }]
            ],
            resize_keyboard: true
          }
        }
      );
      
      setTimeout(async () => {
        await bot.sendMessage(ADMIN_ID, `Новая заявка:\n${application_str}`);
      }, 1000);
    }
  });

  // Обработчик inline кнопки отмены
  bot.on('callback_query', async (query) => {
    if (query.data === 'cancel_post') {
      await bot.answerCallbackQuery(query.id);
      await bot.deleteMessage(query.message.chat.id, query.message.message_id);
      await bot.sendMessage(query.message.chat.id, '❌ Публикация поста отменена');
    }
  });
}

// Настройка API роутов
function setupApiRoutes() {
  // Роут для обработки POST запросов с данными формы
  app.post('/api/applications', async (req, res) => {
    try {
      const { fullName, phone, email, course, format } = req.body;

      // Валидация данных
      if (!fullName || !phone || !email || !course || !format) {
        return res.status(400).json({
          success: false,
          message: 'Все поля обязательны для заполнения'
        });
      }

      // Проверка формата email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат email'
        });
      }

      // Проверка формата телефона
      const phoneRegex = /^(\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат телефона. Используйте российский номер'
        });
      }

      // Вставляем данные в базу
      const result = await db.run(
        `INSERT INTO applications (fullName, phone, email, course, format) 
         VALUES (?, ?, ?, ?, ?)`,
        [fullName, phone, email, course, format]
      );

      // Получаем вставленную запись
      const newApplication = await db.get(
        `SELECT * FROM applications WHERE id = ?`,
        [result.lastID]
      );

      res.status(201).json({
        success: true,
        message: 'Заявка успешно создана',
        data: newApplication
      });

    } catch (error) {
      console.error('Ошибка при обработке заявки:', error);
      res.status(500).json({
        success: false,
        message: 'Произошла ошибка при обработке заявки'
      });
    }
  });

  // Роут для получения всех заявок
  app.get('/api/applications', async (req, res) => {
    try {
      const applications = await db.all(
        `SELECT * FROM applications ORDER BY createdAt DESC`
      );
      res.json({
        success: true,
        data: applications
      });
    } catch (error) {
      console.error('Ошибка при получении заявок:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при получении заявок'
      });
    }
  });

  // Роут для удаления всех заявок (только для разработки)
  app.delete('/api/applications', async (req, res) => {
    try {
      const result = await db.run(`DELETE FROM applications`);
      res.json({
        success: true,
        message: `Удалено ${result.changes} заявок`
      });
    } catch (error) {
      console.error('Ошибка при удалении заявок:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при удалении заявок'
      });
    }
  });

  // Роут для получения постов VK
  app.get('/api/vk/posts', async (req, res) => {
    try {
      const count = req.query.count || 10;
      
      const response = await axios.get('https://api.vk.com/method/wall.get', {
        params: {
          owner_id: `-${VK_GROUP_ID}`,
          count,
          access_token: VK_API_TOKEN,
          v: VK_API_VERSION,
        },
      });

      const posts = response.data.response.items;
      res.json({ success: true, posts});
    } catch (error) {
      console.error('VK API Error:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: 'Ошибка при получении постов из VK' 
      });
    }
  });
}

// Функция для отправки в VK
async function postToVK(text, photoUrl = null) {
  try {
    let params = {
      owner_id: -Math.abs(VK_GROUP_ID),
      message: text + `\n\nНаш бот: https://t.me/${bot.options.username}`,
      access_token: VK_API_TOKEN,
      v: VK_API_VERSION
    };

    if (photoUrl) {
      try {
        // 1. Получаем адрес сервера для загрузки
        const serverResponse = await axios.get('https://api.vk.com/method/photos.getWallUploadServer', {
          params: {
            group_id: Math.abs(VK_GROUP_ID),
            access_token: VK_API_TOKEN,
            v: VK_API_VERSION
          }
        });

        if (!serverResponse.data?.response?.upload_url) {
          throw new Error('Не удалось получить URL для загрузки фото от VK API');
        }

        const uploadUrl = serverResponse.data.response.upload_url;

        // 2. Скачиваем фото с Telegram сервера
        const photoResponse = await axios.get(photoUrl, { responseType: 'arraybuffer' });
        
        // 3. Загружаем фото на сервер VK
        const formData = new FormData();
        formData.append('photo', photoResponse.data, { filename: 'post_image.jpg' });

        const uploadResponse = await axios.post(uploadUrl, formData, {
          headers: formData.getHeaders()
        });

        // 4. Сохраняем фото в группе
        const saveResponse = await axios.get('https://api.vk.com/method/photos.saveWallPhoto', {
          params: {
            group_id: Math.abs(VK_GROUP_ID),
            photo: uploadResponse.data.photo,
            server: uploadResponse.data.server,
            hash: uploadResponse.data.hash,
            access_token: VK_API_TOKEN,
            v: VK_API_VERSION
          }
        });

        if (!saveResponse.data?.response?.[0]?.id) {
          throw new Error('Не удалось сохранить фото в VK');
        }

        params.attachments = `photo${saveResponse.data.response[0].owner_id}_${saveResponse.data.response[0].id}`;
      } catch (uploadError) {
        console.error('Ошибка при загрузке фото в VK:', uploadError);
      }
    }

    // Публикуем пост (с фото или без)
    const response = await axios.get('https://api.vk.com/method/wall.post', {
      params: params
    });

    return response.data;
  } catch (error) {
    console.error('Ошибка при публикации в VK:', error.response?.data || error.message);
    throw new Error('Не удалось опубликовать пост в VK');
  }
}

// Запуск приложения
initializeApp().catch(err => {
  console.error('Ошибка инициализации приложения:', err);
  process.exit(1);
});