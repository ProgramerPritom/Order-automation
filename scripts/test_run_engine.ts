const { Pool } = require('pg');
require('dotenv').config();
const { processFacebookComment } = require('../src/lib/ai-comment-engine');

// But ai-comment-engine is TS, let's run it with npx tsx or test it directly
