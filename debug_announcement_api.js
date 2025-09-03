// Debug script for announcement API
// Run with: node debug_announcement_api.js

const API_BASE = 'http://localhost:3000';

// Test data for creating an announcement
const testAnnouncement = {
  title: "Test Announcement",
  content: "<p>This is a test announcement</p>",
  type: "Medium",
  isLoginRequired: false,
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  isActive: true
};

async function testAPI() {
  console.log('🔍 Testing Announcement API...\n');
  
  try {
    // Test 1: Check if we can get active announcements (no auth required)
    console.log('📡 Testing GET /api/announcements/active...');
    const activeResponse = await fetch(`${API_BASE}/api/announcements/active`);
    console.log(`Status: ${activeResponse.status} ${activeResponse.statusText}`);
    
    if (activeResponse.ok) {
      const activeData = await activeResponse.json();
      console.log(`✅ Active announcements: ${activeData.length} found\n`);
    } else {
      const error = await activeResponse.text();
      console.log(`❌ Error: ${error}\n`);
    }
    
    // Test 2: Check login endpoint
    console.log('📡 Testing POST /api/auth/login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        nickname: "John", // Default ADM user from seed data
        pin: "1234"
      })
    });
    
    console.log(`Login Status: ${loginResponse.status} ${loginResponse.statusText}`);
    
    if (loginResponse.ok) {
      const userData = await loginResponse.json();
      console.log(`✅ Logged in as: ${userData.fullName} (${userData.group})\n`);
      
      // Test 3: Try to create announcement
      if (userData.group === 'ADM') {
        console.log('📡 Testing POST /api/announcements...');
        console.log('Request body:', JSON.stringify(testAnnouncement, null, 2));
        
        const createResponse = await fetch(`${API_BASE}/api/announcements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(testAnnouncement)
        });
        
        console.log(`Create Status: ${createResponse.status} ${createResponse.statusText}`);
        
        if (createResponse.ok) {
          const newAnnouncement = await createResponse.json();
          console.log('✅ Announcement created successfully!');
          console.log('Created announcement:', newAnnouncement);
        } else {
          const errorText = await createResponse.text();
          console.log('❌ Create announcement failed:');
          console.log('Response:', errorText);
          
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.errors) {
              console.log('Validation errors:', errorJson.errors);
            }
          } catch (e) {
            // Not JSON, that's ok
          }
        }
      } else {
        console.log('❌ User is not ADM, cannot create announcements');
      }
      
    } else {
      const loginError = await loginResponse.text();
      console.log(`❌ Login failed: ${loginError}\n`);
      console.log('Available staff should be: John (ADM), Sarah (MGM), Mike (TEAM-A), Lisa (TEAM-B)');
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.log('\n💡 Make sure the server is running: npm run dev');
  }
}

// Helper function to check database table
async function checkDatabase() {
  console.log('\n🔍 Checking if announcements table exists...');
  
  try {
    const response = await fetch(`${API_BASE}/api/announcements`, {
      credentials: 'include'
    });
    
    if (response.status === 401) {
      console.log('✅ API endpoint exists (got 401 Unauthorized, which is expected)');
    } else if (response.status === 500) {
      console.log('❌ Possible database error - check if announcements table exists');
      console.log('Run the SQL script: create_announcements_table.sql');
    }
  } catch (error) {
    console.log('❌ Cannot reach server:', error.message);
  }
}

// Run the tests
checkDatabase();
setTimeout(testAPI, 1000);