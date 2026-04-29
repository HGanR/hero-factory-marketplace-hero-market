// Quick database connection test
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('✅ Connection successful!');
    console.log('📊 Database is ready for schema push.\n');
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query test passed:', rows);
    
    await connection.end();
    console.log('\n✨ Database connection is working! You can now run: npm run db:push');
    process.exit(0);
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('\n💡 Possible issues:');
    console.log('   1. IP address not whitelisted in TiDB Cloud');
    console.log('   2. Password is incorrect');
    console.log('   3. Database server is unreachable\n');
    process.exit(1);
  }
}

testConnection();

