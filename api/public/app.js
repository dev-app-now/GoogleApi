const API_URL = window.location.origin + '/api';
let token = localStorage.getItem('token');

// UI Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const gmailList = document.getElementById('gmailList');
const gmailTokens = document.getElementById('gmailTokens');

// Show/Hide Forms
document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Check Authentication
if (token) {
    showGmailList();
}

// Login Form
document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password'),
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        token = data.token;
        localStorage.setItem('token', token);
        showGmailList();
    } catch (error) {
        alert(error.message);
    }
});

// Register Form
document.getElementById('register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password'),
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        alert('Registration successful! Please login.');
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    } catch (error) {
        alert(error.message);
    }
});

// Add Gmail
document.getElementById('addGmail').addEventListener('click', () => {
    const clientId = document.querySelector('meta[name="google-client-id"]').content;
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email');
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    
    const popup = window.open(googleAuthUrl, 'Google Auth', 'width=600,height=600');
    
    const messageHandler = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data.code) return;
        
        try {
            const response = await fetch(`${API_URL}/gmail/tokens`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ code: event.data.code }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            loadGmailTokens();
            window.removeEventListener('message', messageHandler);
        } catch (error) {
            alert(error.message);
        }
    };
    
    window.addEventListener('message', messageHandler);
});

// Load Gmail Tokens
async function loadGmailTokens() {
    try {
        const response = await fetch(`${API_URL}/gmail/tokens`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const tokens = await response.json();
        if (!response.ok) throw new Error(tokens.error);

        gmailTokens.innerHTML = tokens.map(token => `
            <div class="bg-white rounded-lg shadow-md p-4 flex justify-between items-center">
                <span class="text-lg">${token.gmail}</span>
                <div class="space-x-2">
                    <button onclick="readLastEmail('${token.gmail}')" class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
                        Read Last Email
                    </button>
                    <button onclick="deleteGmailToken('${token.gmail}')" class="text-red-600 hover:text-red-800">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        alert(error.message);
    }
}

// Wait For Email
async function waitForEmail(gmail) {
    document.getElementById('waitEmailGmail').value = gmail;
    document.getElementById('waitEmailResult').classList.add('hidden');
    document.getElementById('waitEmailModal').classList.remove('hidden');
}

function closeWaitEmailModal() {
    document.getElementById('waitEmailModal').classList.add('hidden');
}

document.getElementById('waitEmailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gmail = document.getElementById('waitEmailGmail').value;
    const sender = document.getElementById('waitEmailSender').value;
    const timeout = parseInt(document.getElementById('waitEmailTimeout').value);
    
    try {
        const response = await fetch(`${API_URL}/gmail/wait-for-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ gmail, sender, timeout }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        // Hiển thị kết quả dạng JSON
        const resultDiv = document.getElementById('waitEmailResult');
        resultDiv.querySelector('pre').textContent = JSON.stringify(result, null, 2);
        resultDiv.classList.remove('hidden');

        // Nếu tìm thấy email, hiển thị trong modal email
        if (result.success && result.email) {
            document.getElementById('emailFrom').textContent = result.email.from;
            document.getElementById('emailTo').textContent = result.email.to;
            document.getElementById('emailSubject').textContent = result.email.subject;
            document.getElementById('emailBody').textContent = result.email.body;
            document.getElementById('emailDate').textContent = new Date(result.email.receivedAt).toLocaleString();
            document.getElementById('emailJson').textContent = JSON.stringify(result.email, null, 2);
            document.getElementById('emailModal').classList.remove('hidden');
            closeWaitEmailModal();
        }
    } catch (error) {
        alert(error.message);
    }
});

// Read Last Email
async function readLastEmail(gmail, sender = '') {
    try {
        const response = await fetch(`${API_URL}/gmail/read-last-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ gmail, sender }),
        });

        const email = await response.json();
        if (!response.ok) throw new Error(email.error);

        // Hiển thị email trong modal
        document.getElementById('emailFrom').textContent = email.from;
        document.getElementById('emailTo').textContent = email.to;
        document.getElementById('emailSubject').textContent = email.subject;
        document.getElementById('emailBody').textContent = email.body;
        document.getElementById('emailDate').textContent = new Date(email.receivedAt).toLocaleString();
        document.getElementById('emailJson').textContent = JSON.stringify(email, null, 2);
        document.getElementById('emailModal').classList.remove('hidden');
    } catch (error) {
        alert(error.message);
    }
}

// Close Email Modal
function closeEmailModal() {
    document.getElementById('emailModal').classList.add('hidden');
}

// Delete Gmail Token
async function deleteGmailToken(gmail) {
    if (!confirm(`Are you sure you want to remove ${gmail}?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/gmail/tokens`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ gmail }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        loadGmailTokens();
    } catch (error) {
        alert(error.message);
    }
}

// Show Gmail List
function showGmailList() {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    gmailList.classList.remove('hidden');
    loadGmailTokens();
} 