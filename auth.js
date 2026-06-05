// ============================
// AUTH MODULE
// ============================

let currentAuthType = "login";

// Get elements
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authSwitchText = document.getElementById("authSwitchText");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");

// Validate email format
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Initialize auth page
function initializeAuth() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || 'login';
    
    showAuthMode(mode);
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', submitAuth);
    }
    if (authSwitchBtn) {
        authSwitchBtn.addEventListener('click', toggleAuthType);
    }
    if (authEmail) {
        authEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') authPassword.focus();
        });
    }
    if (authPassword) {
        authPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitAuth();
        });
    }
}

// Show auth mode
function showAuthMode(type) {
    currentAuthType = type;

    if (type === "signup") {
        authTitle.innerText = "Create your account";
        authSubtitle.innerText = "Sign up and begin your VibeBooth journey.";
        authSubmitBtn.innerText = "Sign Up";
        authSwitchText.innerText = "Already have an account?";
        authSwitchBtn.innerText = "Login";
    } else {
        authTitle.innerText = "Welcome back";
        authSubtitle.innerText = "Login to access your VibeBooth session.";
        authSubmitBtn.innerText = "Login";
        authSwitchText.innerText = "Don't have an account?";
        authSwitchBtn.innerText = "Sign Up";
    }

    authEmail.value = "";
    authPassword.value = "";
    authEmail.focus();
}

// Toggle auth type
function toggleAuthType() {
    const newMode = currentAuthType === "login" ? "signup" : "login";
    window.history.pushState({}, '', `?mode=${newMode}`);
    showAuthMode(newMode);
}

// Submit authentication
function submitAuth() {
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!validateEmail(email)) {
        alert("Please enter a valid email address.");
        authEmail.focus();
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        authPassword.focus();
        return;
    }

    const accounts = getStoredAccounts();

    if (currentAuthType === "signup") {
        if (accounts[email]) {
            alert("This email is already registered. Please log in instead.");
            showAuthMode("login");
            return;
        }

        accounts[email] = { password };
        saveStoredAccounts(accounts);
        setCurrentUser(email);

        alert("Sign up successful! Welcome to VibeBooth.");
        window.location.href = "index.html";
        return;
    }

    // Login flow
    if (!accounts[email]) {
        alert("No account found with this email. Please sign up first.");
        showAuthMode("signup");
        return;
    }

    if (accounts[email].password !== password) {
        alert("Incorrect password. Please try again.");
        authPassword.focus();
        authPassword.value = "";
        return;
    }

    setCurrentUser(email);
    alert("Login successful! Redirecting to VibeBooth.");
    window.location.href = "index.html";
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
    initializeAuth();
}
