const API_URL = window.location.origin + '/api';

// Thay đổi token thành getter
function getToken() {
	return localStorage.getItem('token');
}

// UI Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const gmailList = document.getElementById('gmailList');
const gmailTokens = document.getElementById('gmailTokens');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const loadingModal = document.getElementById('loadingModal');
const sheetsSection = document.getElementById('sheetsSection');

// Show/Hide Forms
document.getElementById('showRegister')?.addEventListener('click', (e) => {
	e.preventDefault();
	loginForm.classList.add('hidden');
	registerForm.classList.remove('hidden');
});

document.getElementById('showForgotPassword').addEventListener('click', (e) => {
	e.preventDefault();
	forgotPasswordForm.classList.add('hidden');
	loginForm.classList.remove('hidden');
});

// Check Authentication
if (getToken()) {
	//check token
	const userData = parseJwt(getToken());
	if (userData.exp * 1000 < Date.now()) {
		logout();
	} else {
		showGmailList();
	}
}

// Login Form
document.getElementById('login')?.addEventListener('submit', async (e) => {
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

		localStorage.setItem('token', data.token);
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
document.getElementById('addGmail').addEventListener('click', async () => {
	const clientId = await fetch(`${API_URL}/google-client-id`).then((response) => response.json());
	const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
	const scope = encodeURIComponent(
		'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file'
	);

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
					Authorization: `Bearer ${getToken()}`,
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
			headers: { Authorization: `Bearer ${getToken()}` },
		});

		const tokens = await response.json();
		if (!response.ok) throw new Error(tokens.error);

		gmailTokens.innerHTML = tokens.map((token) => renderGmailToken(token)).join('');
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
	loadingModal.classList.remove('hidden');

	try {
		const response = await fetch(`${API_URL}/gmail/wait-for-email`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${getToken()}`,
			},
			body: JSON.stringify({ gmail, sender, timeout }),
		});

		const result = await response.json();
		if (!response.ok) throw new Error(result.error);

		loadingModal.classList.add('hidden');

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
	} finally {
		loadingModal.classList.add('hidden');
	}
});

// Read Last Email
async function readLastEmail(gmail, sender = '') {
	try {
		const response = await fetch(`${API_URL}/gmail/read-last-email`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${getToken()}`,
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
				Authorization: `Bearer ${getToken()}`,
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

	// Hiển thị email của user
	const userData = parseJwt(getToken());
	if (userData?.email) {
		document.getElementById('userEmail').textContent = userData.email;
	}

	loadGmailTokens();
}

// Xử lý logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
	logout();
});

// Xử lý forgot password
document.getElementById('forgotPassword')?.addEventListener('submit', async (e) => {
	e.preventDefault();
	const email = e.target.email.value;

	try {
		const response = await fetch('/api/auth/forgot-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email }),
		});

		const data = await response.json();
		if (response.ok) {
			alert('Vui lòng kiểm tra email của bạn để đặt lại mật khẩu');
			showLoginForm();
		} else {
			alert(data.error || 'Có lỗi xảy ra');
		}
	} catch (error) {
		alert('Có lỗi xảy ra khi gửi yêu cầu');
	}
});

// Xử lý các nút chuyển form
document.getElementById('showForgotPassword')?.addEventListener('click', (e) => {
	e.preventDefault();
	loginForm.classList.add('hidden');
	registerForm.classList.add('hidden');
	forgotPasswordForm.classList.remove('hidden');
});

document.getElementById('backToLogin')?.addEventListener('click', (e) => {
	e.preventDefault();
	showLoginForm();
});

document.getElementById('loginInstead')?.addEventListener('click', (e) => {
	e.preventDefault();
	showLoginForm();
});

// Xử lý reset password từ link email
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('reset_token');
if (resetToken) {
	// Hiển thị form đặt lại mật khẩu
	showResetPasswordForm(resetToken);
}

function logout() {
	localStorage.removeItem('token');
	window.location.reload();
}

function showResetPasswordForm(token) {
	// Thêm logic hiển thị form reset password
}

function showLoginForm(token) {
	loginForm.classList.remove('hidden');
	registerForm.classList.add('hidden');
	forgotPasswordForm.classList.add('hidden');
}

// Decode JWT để lấy thông tin user
function parseJwt(token) {
	try {
		const base64Url = token.split('.')[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		return JSON.parse(window.atob(base64));
	} catch (e) {
		return null;
	}
}

// Change Password Modal
const changePasswordModal = document.getElementById('changePasswordModal');
const changePasswordForm = document.getElementById('changePasswordForm');

document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
	changePasswordModal.classList.remove('hidden');
});

function closeChangePasswordModal() {
	changePasswordModal.classList.add('hidden');
	changePasswordForm.reset();
}

changePasswordForm?.addEventListener('submit', async (e) => {
	e.preventDefault();

	const currentPassword = document.getElementById('currentPassword').value;
	const newPassword = document.getElementById('newPassword').value;
	const confirmNewPassword = document.getElementById('confirmNewPassword').value;

	if (newPassword !== confirmNewPassword) {
		alert('New passwords do not match');
		return;
	}

	try {
		const response = await fetch(`${API_URL}/auth/change-password`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${getToken()}`,
			},
			body: JSON.stringify({
				currentPassword,
				newPassword,
			}),
		});

		const data = await response.json();
		if (response.ok) {
			alert('Password changed successfully');
			closeChangePasswordModal();
		} else {
			alert(data.error || 'Failed to change password');
		}
	} catch (error) {
		alert('An error occurred while changing password');
	}
});

// Close modal when clicking outside
changePasswordModal?.addEventListener('click', (e) => {
	if (e.target === changePasswordModal) {
		closeChangePasswordModal();
	}
});

function renderGmailToken(token) {
	const scopes = token.scopes?.split(' ') || [];

	const scopeBadges = {
		'https://www.googleapis.com/auth/gmail.readonly': {
			icon: `<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 48 48"> <path fill="#4caf50" d="M45,16.2l-5,2.75l-5,4.75L35,40h7c1.657,0,3-1.343,3-3V16.2z"></path><path fill="#1e88e5" d="M3,16.2l3.614,1.71L13,23.7V40H6c-1.657,0-3-1.343-3-3V16.2z"></path><polygon fill="#e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17"></polygon><path fill="#c62828" d="M3,12.298V16.2l10,7.5V11.2L9.876,8.859C9.132,8.301,8.228,8,7.298,8h0C4.924,8,3,9.924,3,12.298z"></path><path fill="#fbc02d" d="M45,12.298V16.2l-10,7.5V11.2l3.124-2.341C38.868,8.301,39.772,8,40.702,8h0 C43.076,8,45,9.924,45,12.298z"></path> </svg>`,
			text: 'Gmail Read',
		},
		'https://www.googleapis.com/auth/drive.file': {
			icon: `<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 48 48"> <path fill="#1e88e5" d="M38.59,39c-0.535,0.93-0.298,1.68-1.195,2.197C36.498,41.715,35.465,42,34.39,42H13.61 c-1.074,0-2.106-0.285-3.004-0.802C9.708,40.681,9.945,39.93,9.41,39l7.67-9h13.84L38.59,39z"></path><path fill="#fbc02d" d="M27.463,6.999c1.073-0.002,2.104-0.716,3.001-0.198c0.897,0.519,1.66,1.27,2.197,2.201l10.39,17.996 c0.537,0.93,0.807,1.967,0.808,3.002c0.001,1.037-1.267,2.073-1.806,3.001l-11.127-3.005l-6.924-11.993L27.463,6.999z"></path><path fill="#e53935" d="M43.86,30c0,1.04-0.27,2.07-0.81,3l-3.67,6.35c-0.53,0.78-1.21,1.4-1.99,1.85L30.92,30H43.86z"></path><path fill="#4caf50" d="M5.947,33.001c-0.538-0.928-1.806-1.964-1.806-3c0.001-1.036,0.27-2.073,0.808-3.004l10.39-17.996 c0.537-0.93,1.3-1.682,2.196-2.2c0.897-0.519,1.929,0.195,3.002,0.197l3.459,11.009l-6.922,11.989L5.947,33.001z"></path><path fill="#1565c0" d="M17.08,30l-6.47,11.2c-0.78-0.45-1.46-1.07-1.99-1.85L4.95,33c-0.54-0.93-0.81-1.96-0.81-3H17.08z"></path><path fill="#2e7d32" d="M30.46,6.8L24,18L17.53,6.8c0.78-0.45,1.66-0.73,2.6-0.79L27.46,6C28.54,6,29.57,6.28,30.46,6.8z"></path> </svg>`,
			text: 'Drive',
		},
	};

	const scopesList = scopes
		.map((scope) => {
			const badge = scopeBadges[scope];
			if (!badge) return '';
			return `
            <span title="${badge.text}" class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
                ${badge.icon}
            </span>
        `;
		})
		.join('');

	let driveFiles = '';
	if (token.scopes?.includes('https://www.googleapis.com/auth/drive.file')) {
		driveFiles = `
            <div class="mt-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-medium">Drive Files</h4>
                    <button onclick="createNewSheet('${token.gmail}')" 
                            class="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                        New Sheet
                    </button>
                </div>
                <div id="driveFiles-${token.gmail}" class="space-y-2">
                    Loading...
                </div>
            </div>
        `;

		// Load drive files after render
		loadDriveFiles(token.gmail).then((files) => {
			const filesList =
				files
					.map(
						(file) => `
                <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <div class="flex items-center gap-2">
                        <a href="${file.webViewLink}" target="_blank" class="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                           <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 48 48">
                            <linearGradient id="gBjrhQfVvaLo6qORHi0_9a_6yIWVyFTE0no_gr1" x1="24" x2="24" y1="-166.87" y2="-248.839" gradientTransform="matrix(1 0 0 -1 0 -154)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient><path fill="url(#gBjrhQfVvaLo6qORHi0_9a_6yIWVyFTE0no_gr1)" d="M39,15v27c0,1.105-0.895,2-2,2H11c-1.105,0-2-0.895-2-2V6c0-1.105,0.895-2,2-2h17L39,15z"></path><path fill="#107c42" d="M28,4v10c0,0.552,0.448,1,1,1h10L28,4z"></path><path d="M16,33c-1.103,0-2-0.897-2-2V21c0-1.103,0.897-2,2-2h16c1.103,0,2,0.897,2,2v10c0,1.103-0.897,2-2,2	H16z M30,29v-1h-4v1H30z M22,29v-1h-4v1H22z M30,24v-1h-4v1H30z M22,24v-1h-4v1H22z" opacity=".05"></path><path d="M16,32.5c-0.827,0-1.5-0.673-1.5-1.5V21c0-0.827,0.673-1.5,1.5-1.5h16c0.827,0,1.5,0.673,1.5,1.5v10	c0,0.827-0.673,1.5-1.5,1.5H16z M30.5,29.5v-2h-5v2H30.5z M22.5,29.5v-2h-5v2H22.5z M30.5,24.5v-2h-5v2H30.5z M22.5,24.5v-2h-5v2	H22.5z" opacity=".07"></path><path fill="#fff" d="M32,20H16c-0.553,0-1,0.448-1,1v10c0,0.552,0.447,1,1,1h16c0.553,0,1-0.448,1-1V21	C33,20.448,32.553,20,32,20z M31,25h-6v-3h6V25z M23,22v3h-6v-3H23z M17,27h6v3h-6V27z M25,30v-3h6v3H25z"></path>
                           </svg>
                           <span>${file.name}</span>
                        </a>
                    </div>
                    <div class="flex items-center gap-5 text-sm">
                        <span class="text-gray-500">${file.owners[0].displayName}</span>
                        <span class="text-gray-500">${new Date(file.createdTime).toLocaleDateString()}</span>
                        <a href="${file.webViewLink}" target="_blank" 
                           class="text-blue-600 hover:text-blue-800">Open</a>
                        <button onclick="deleteSheet('${token.gmail}', '${file.id}')"
                                class="text-red-600 hover:text-red-800">Delete</button>
                    </div>
                </div>
            `
					)
					.join('') || 'No files yet';

			document.getElementById(`driveFiles-${token.gmail}`).innerHTML = filesList;
		});
	}

	return `
        <div class="bg-white rounded-lg shadow p-4">
            <div class="flex justify-between items-start gap-2">
                <div class="flex justify-between items-start gap-2">
                    <div class="font-medium">${token.gmail}</div>
                    ${scopesList}
                </div>
                <div class="flex-1"></div>
                <button onclick="readLastEmail('${token.gmail}')" class="mx-2">
                    Read Last Email
                </button>
                <button onclick="waitForEmail('${token.gmail}')" class="mx-2">
                    Wait For Email
                </button>
                <button onclick="deleteGmailToken('${token.gmail}')" 
                        class="text-red-600 hover:text-red-800">
                    Delete
                </button>
            </div>
            ${driveFiles}
        </div>
    `;
}

// Thêm các hàm mới
async function loadDriveFiles(gmail) {
	try {
		const response = await fetch(`${API_URL}/sheets?gmail=${gmail}`, {
			headers: { Authorization: `Bearer ${getToken()}` },
		});

		const data = await response.json();
		if (!response.ok) throw new Error(data.error);

		return data.files;
	} catch (error) {
		console.error('Error loading drive files:', error);
		return [];
	}
}

async function createNewSheet(gmail) {
	const title = prompt('Enter sheet name:');
	if (!title) return;

	try {
		const response = await fetch(`${API_URL}/sheets`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${getToken()}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ gmail, title }),
		});

		const data = await response.json();
		if (!response.ok) throw new Error(data.error);

		await loadGmailTokens(); // Refresh list
	} catch (error) {
		alert(error.message);
	}
}

async function deleteSheet(gmail, fileId) {
	if (!confirm('Are you sure you want to delete this sheet?')) return;

	try {
		const response = await fetch(`${API_URL}/sheets/${fileId}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${getToken()}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ gmail }),
		});

		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.error);
		}

		await loadGmailTokens(); // Refresh list
	} catch (error) {
		alert(error.message);
	}
}
