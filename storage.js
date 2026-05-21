const ACCOUNT_STORAGE_KEY = 'vibeboothAccounts';
const CURRENT_USER_KEY = 'vibeboothCurrentUser';

function getStoredAccounts() {
    try {
        const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error('Could not load accounts', err);
        return {};
    }
}

function saveStoredAccounts(accounts) {
    try {
        localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
    } catch (err) {
        console.error('Could not save accounts', err);
    }
}

function getCurrentUser() {
    return localStorage.getItem(CURRENT_USER_KEY) || null;
}


function setCurrentUser(email) {
    localStorage.setItem(CURRENT_USER_KEY, email);
}

function clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
}
