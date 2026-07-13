const axios = require('axios');
const fs = require('fs');

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/v1/wallets');
    console.log("Response data:", res.data);
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}
test();
