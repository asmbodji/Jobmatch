const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
    res.json({ message: 'Ça marche !', timestamp: new Date() });
});

app.get('/api/jobs', (req, res) => {
    res.json([{ id: 1, title: 'Test Job' }]);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Test server sur http://0.0.0.0:${PORT}`);
});
