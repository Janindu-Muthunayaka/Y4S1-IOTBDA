const axios = require('axios');

async function test() {
    const apiKey = 'AIzaSyCO_GobWXqp4Ph2Sj6rMgIB2-YaAe7AtP4';
    const model = 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [
            { role: 'user', parts: [{ text: 'hi' }] }
        ],
        system_instruction: { parts: [{ text: 'You are a helpful assistant.' }] }
    };

    try {
        const response = await axios.post(url, payload);
        console.log('Success:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

test();
