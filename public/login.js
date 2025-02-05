// public/login.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = data.isDoctor ? '/doctor-dashboard.html' : '/patient-dashboard.html';
        } else {
            alert('Invalid credentials');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Login failed');
    }
});

