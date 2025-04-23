// const mysql = require('mysql2/promise');
// const bot = new Telegraf(process.env.BOT_TOKEN);
import dotenv from 'dotenv/config'
import mysql from 'mysql2/promise'


console.log(process.env.DB_PASSWORD)
// Конфигурация базы данных
const dbConfig = {
    host: 'localhost',
    user: 'root', // замените на вашего пользователя
    password: process.env.DB_PASSWORD, // замените на ваш пароль
    database: process.env.DB_NAME, // замените на вашу БД
  };
  
  let connection;
  
  // Функция для инициализации соединения с БД
  async function initializeDatabaseConnection() {
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log('Connected to MySQL');
    } catch (err) {
      console.error('Failed to connect to MySQL:', err);
      // возможно, стоит бросить ошибку дальше в цепочку или завершить процесс
    }
  }
  
  // Инициализация соединения
  await initializeDatabaseConnection();
  
  // Экспортируем соединение
  export default connection;