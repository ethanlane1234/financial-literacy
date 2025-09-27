express = require('express');
app = express();
path = require('path');
PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')))

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})