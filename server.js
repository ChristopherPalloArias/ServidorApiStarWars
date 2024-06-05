const express = require('express');
const axios = require('axios');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración de la base de datos MySQL
const db = mysql.createPool({
  host: 'mysql-christopherobin.alwaysdata.net',
  user: '358042_admin',
  password: 'YqUZn6T6AxLYc5k',
  database: 'christopherobin_starwars'
});

// Conectar a la base de datos y manejar errores de conexiónes
db.getConnection((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

// Inicializar el estado de inserción si no existe
db.query('INSERT INTO insertion_state (last_inserted_id) SELECT 0 WHERE NOT EXISTS (SELECT * FROM insertion_state)', (err, result) => {
  if (err) {
    console.error('Error initializing insertion state:', err);
  }
});

// Ruta para la raíz de la aplicación
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Ruta para poblar la base de datos con los personajes de la API de Star Wars en bloques de 10
app.get('/populate', async (req, res) => {
  try {
    db.query('SELECT last_inserted_id FROM insertion_state', async (err, result) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ message: 'Database query error' });
      }

      const lastInsertedId = result[0].last_inserted_id;
      const nextPage = Math.floor(lastInsertedId / 10) + 1;

      const response = await axios.get(`https://swapi.dev/api/people/?page=${nextPage}`);
      const characters = response.data.results;

      if (characters.length === 0) {
        return res.status(200).json({ message: 'No more characters to insert' });
      }

      const sqlInsert = 'INSERT INTO characters (name, height, mass, hair_color, skin_color) VALUES (?, ?, ?, ?, ?)';

      characters.forEach((character) => {
        db.query(sqlInsert, [character.name, character.height, character.mass, character.hair_color, character.skin_color], (err, result) => {
          if (err) {
            console.error('Database insert error:', err);
          }
        });
      });

      db.query('UPDATE insertion_state SET last_inserted_id = last_inserted_id + ?', [characters.length], (err, result) => {
        if (err) {
          console.error('Error updating insertion state:', err);
          return res.status(500).json({ message: 'Error updating insertion state' });
        }
        res.status(201).json({ message: `Inserted ${characters.length} characters successfully` });
      });
    });
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ message: 'Error fetching characters' });
  }
});

// Rutas para interactuar con la API de Star Wars y la base de datos

// Insertar un personaje en la base de datos
app.post('/character', async (req, res) => {
  const { name } = req.body;
  
  try {
    const response = await axios.get(`https://swapi.dev/api/people/?search=${name}`);
    const character = response.data.results[0];
    
    if (!character) {
      return res.status(404).json({ message: 'Character not found' });
    }

    const sqlInsert = 'INSERT INTO characters (name, height, mass, hair_color, skin_color) VALUES (?, ?, ?, ?, ?)';
    db.query(sqlInsert, [character.name, character.height, character.mass, character.hair_color, character.skin_color], (err, result) => {
      if (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ message: 'Database insert error' });
      }
      res.status(201).json({ message: 'Character inserted successfully' });
    });

  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ message: 'Error fetching character' });
  }
});

// Buscar un personaje en la base de datos
app.get('/character/:name', (req, res) => {
  const { name } = req.params;

  const sqlSearch = 'SELECT * FROM characters WHERE name = ?';
  db.query(sqlSearch, [name], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ message: 'Database query error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Character not found' });
    }
    res.json(results[0]);
  });
});

// Eliminar un personaje de la base de datos
app.delete('/character/:name', (req, res) => {
  const { name } = req.params;

  const sqlDelete = 'DELETE FROM characters WHERE name = ?';
  db.query(sqlDelete, [name], (err, result) => {
    if (err) {
      console.error('Database delete error:', err);
      return res.status(500).json({ message: 'Database delete error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Character not found' });
    }
    res.json({ message: 'Character deleted successfully' });
  });
});

// Iniciar el servidor en el puerto 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
