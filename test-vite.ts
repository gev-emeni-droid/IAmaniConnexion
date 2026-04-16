async function test() {
    try {
        console.log('Testing root (Vite)...');
        const res = await fetch('http://localhost:3000/');
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body length:', text.length);
        if (res.status !== 200) {
            console.log('Body:', text);
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}
test();
