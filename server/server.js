/* =====================================================================
   STARTING THE SERVER
   Connects to the database, then starts listening for requests.
   Run it with: npm start
   ===================================================================== */

import app, { config } from './app.js';
import { connectDB } from './config/db.js';

await connectDB();

app.listen(config.port, () => {
  console.log(`WUBRG'r server listening on port ${config.port}`);
});
