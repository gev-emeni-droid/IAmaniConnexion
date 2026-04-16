async function testHealth() {
    try {
        const response = await fetch('http://localhost:3000/api/health');
        const data = await response.json();
        console.log('Health check response:', data);
    } catch (e) {
        console.error('Health check failed:', e);
    }
}
testHealth();
