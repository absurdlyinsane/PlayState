const pb = new PocketBase('http://127.0.0.1:8090');

// DOM Elements
const grid = document.getElementById('games-grid');
const statusText = document.getElementById('connection-status');
const addGameBtn = document.getElementById('add-game-btn');
const logoutBtn = document.getElementById('logout-btn');

// Auth DOM
const authOverlay = document.getElementById('auth-overlay');
const loginBtn = document.getElementById('login-btn');
const authError = document.getElementById('auth-error');

// Panels
const detailsPanel = document.getElementById('details-panel');
const formPanel = document.getElementById('form-panel');
let currentActiveGame = null;

const metroColors = ['#1ba1e2', '#a05000', '#339933', '#a20025', '#e51400', '#00aba9', '#d80073', '#f09609', '#A200FF'];

// ==========================================
// Authentication
// ==========================================
function checkAuth() {
    if (pb.authStore.isValid) {
        authOverlay.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        addGameBtn.style.display = 'inline-block';
        
        statusText.innerText = 'Connected'; // Immediately overwrite 'Connecting...'
        loadGames();
    } else {
        authOverlay.style.display = 'flex';
        logoutBtn.style.display = 'none';
        addGameBtn.style.display = 'none';
        grid.innerHTML = '';
        statusText.innerText = 'Please sign in.';
    }
}

loginBtn.addEventListener('click', async () => {
    authError.innerText = '';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await pb.collection('_superusers').authWithPassword(email, password);
        checkAuth();
    } catch (error) {
        authError.innerText = 'Invalid credentials. Check if you need users or _superusers.';
    }
});

logoutBtn.addEventListener('click', () => {
    pb.authStore.clear();
    checkAuth();
});

let cachedGames = [];

// ==========================================
// Horizontal Scroll Interceptor (No Shift needed)
// ==========================================
const scrollArea = document.querySelector('.metro-scroll-area');

if (scrollArea) {
    scrollArea.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            scrollArea.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

// ==========================================
// 3-Level Multi-Attribute Sorting Logic
// ==========================================
function sortGames(games) {
    const attr1 = document.getElementById('sort-1').value;
    const attr2 = document.getElementById('sort-2').value;
    const attr3 = document.getElementById('sort-3').value;

    return [...games].sort((a, b) => {
        let res1 = compareAttributes(a, b, attr1);
        if (res1 !== 0) return res1;

        let res2 = compareAttributes(a, b, attr2);
        if (res2 !== 0) return res2;

        return compareAttributes(a, b, attr3);
    });
}

function compareAttributes(a, b, key) {
    let valA = a[key];
    let valB = b[key];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (['personal_rating', 'year', 'game_storage_gib', 'full_game_progress'].includes(key)) {
        const numA = valA !== '' ? Number(valA) : -Infinity;
        const numB = valB !== '' ? Number(valB) : -Infinity;
        return numB - numA; 
    }

    return String(valA).localeCompare(String(valB));
}

['sort-1', 'sort-2', 'sort-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', () => {
            if (cachedGames.length > 0) {
                renderGrid(sortGames(cachedGames));
            }
        });
    }
});

// ==========================================
// Data Loading & Rendering
// ==========================================
async function loadGames() {
    try {
        statusText.innerText = "Fetching library...";
        const records = await pb.collection('Games').getFullList();
        cachedGames = records;
        statusText.innerText = `${records.length} Games Loaded`;
        renderGrid(sortGames(cachedGames));
    } catch (error) {
        statusText.innerText = "Error loading data.";
        console.error(error);
    }
}

function renderGrid(games) {
    grid.innerHTML = '';

    games.forEach((game, index) => {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.style.backgroundColor = metroColors[index % metroColors.length];

        const rating = (game.personal_rating !== null && game.personal_rating !== undefined && game.personal_rating !== '') 
            ? Number(game.personal_rating) 
            : null;

        if (rating !== null && rating > 7) {
            tile.classList.add('tile-large');
        } else if (rating !== null && rating >= 5) {
            tile.classList.add('tile-medium');
        } else {
            tile.classList.add('tile-small');
        }

        if (game.cover) {
            const filename = Array.isArray(game.cover) ? game.cover[0] : game.cover;
            const imgUrl = pb.files.getUrl(game, filename, { thumb: '400x400' });
            tile.style.backgroundImage = `url('${imgUrl}')`;
            tile.classList.add('has-cover');
        }

        const playStatus = game.play_status ? game.play_status.replace(/_/g, ' ') : 'UNPLAYED';
        
        tile.innerHTML = `
            <div class="tile-content">
                <h2>${game.name || 'Unknown'}</h2>
                <p>${game.publisher || ''} ${game.year ? `(${game.year})` : ''}</p>
            </div>
            <div class="tile-footer">
                <span class="badge">${playStatus}</span>
                <span class="rating">${rating !== null ? rating + '/10' : ''}</span>
            </div>
        `;

        tile.addEventListener('click', () => openDetails(game));
        grid.appendChild(tile);
    });
}

// ==========================================
// Read (Details View with Complete Schema)
// ==========================================
function openDetails(game) {
    currentActiveGame = game;
    document.getElementById('detail-title').innerText = game.name || 'Game Details';
    
    const coverImg = document.getElementById('detail-cover');
    if (game.cover) {
        const filename = Array.isArray(game.cover) ? game.cover[0] : game.cover;
        coverImg.src = pb.files.getUrl(game, filename);
        coverImg.style.display = 'block';
    } else {
        coverImg.style.display = 'none';
    }

    const tagsHtml = Array.isArray(game.system_tags) && game.system_tags.length 
        ? game.system_tags.map(t => `<span class="badge" style="display:inline-block; margin:2px;">${t.replace(/_/g, ' ')}</span>`).join('') 
        : '-';

    document.getElementById('detail-info').innerHTML = `
        <p><span>Publisher</span> ${game.publisher || '-'}</p>
        <p><span>Release Year</span> ${game.year || '-'}</p>
        <p><span>Rating</span> ${game.personal_rating ? game.personal_rating + '/10' : '-'}</p>
        <p><span>Ownership</span> ${game.ownership || '-'}</p>
        <p><span>Acquisition Status</span> ${game.acquisition_status ? game.acquisition_status.replace(/_/g, ' ') : '-'}</p>
        <p><span>Play Status</span> ${game.play_status ? game.play_status.replace(/_/g, ' ') : '-'}</p>
        <p><span>Installer State</span> ${game.installer_state ? game.installer_state.replace(/_/g, ' ') : '-'}</p>
        <p><span>Installation State</span> ${game.installation_state ? game.installation_state.replace(/_/g, ' ') : '-'}</p>
        <p><span>Gamepad Support</span> ${game.gamepad_support || '-'}</p>
        <p><span>Rent Platform</span> ${game.rent_platform || '-'}</p>
        <p><span>Runtime Platform</span> ${game.runtime_platform || '-'}</p>
        <p><span>Original Platform</span> ${game.original_platform || '-'}</p>
        <p><span>Permanent Retention</span> ${game.parmanent_retention ? 'Yes' : 'No'}</p>
        <p><span>Game Storage</span> ${game.game_storage_gib ? game.game_storage_gib + ' GiB' : '-'}</p>
        <p><span>Installer Storage</span> ${game.installer_storage_gib ? game.installer_storage_gib + ' GiB' : '-'}</p>
        <p><span>Main Story Progress</span> ${game.main_story_progress !== undefined && game.main_story_progress !== null ? game.main_story_progress + '%' : '-'}</p>
        <p><span>Side Story Progress</span> ${game.side_story_progress !== undefined && game.side_story_progress !== null ? game.side_story_progress + '%' : '-'}</p>
        <p><span>Full Game Progress</span> ${game.full_game_progress !== undefined && game.full_game_progress !== null ? game.full_game_progress + '%' : '-'}</p>
        <p><span>Patch Requirements</span> ${game.patch_requirements || '-'}</p>
        <p><span>System Tags</span> ${tagsHtml}</p>
    `;
    
    formPanel.classList.remove('open');
    detailsPanel.classList.add('open');
}

document.getElementById('close-details').addEventListener('click', () => {
    detailsPanel.classList.remove('open');
});

// ==========================================
// Delete
// ==========================================
document.getElementById('delete-game-btn').addEventListener('click', async () => {
    if (confirm(`Are you sure you want to delete ${currentActiveGame.name}?`)) {
        await pb.collection('Games').delete(currentActiveGame.id);
        detailsPanel.classList.remove('open');
        loadGames();
    }
});

// ==========================================
// Create & Update (Form handling all fields)
// ==========================================
addGameBtn.addEventListener('click', () => {
    currentActiveGame = null;
    const form = document.getElementById('game-form');
    if (form) form.reset();
    
    const idElem = document.getElementById('game-id');
    if (idElem) idElem.value = '';
    
    document.getElementById('form-title').innerText = 'Add Game';
    detailsPanel.classList.remove('open');
    formPanel.classList.add('open');
});

document.getElementById('edit-game-btn').addEventListener('click', () => {
    document.getElementById('form-title').innerText = 'Edit Game';
    
    // Populate form fields if elements exist
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== null && val !== undefined ? val : '';
    };

    setVal('game-id', currentActiveGame.id);
    setVal('game-name', currentActiveGame.name);
    setVal('game-publisher', currentActiveGame.publisher);
    setVal('game-year', currentActiveGame.year);
    setVal('game-rating', currentActiveGame.personal_rating);
    setVal('game-ownership', currentActiveGame.ownership);
    setVal('game-acquisition-status', currentActiveGame.acquisition_status);
    setVal('game-installer-state', currentActiveGame.installer_state);
    setVal('game-installation-state', currentActiveGame.installation_state);
    setVal('game-status', currentActiveGame.play_status);
    setVal('game-gamepad-support', currentActiveGame.gamepad_support);
    setVal('game-rent-platform', currentActiveGame.rent_platform);
    setVal('game-storage', currentActiveGame.game_storage_gib);
    setVal('game-installer-storage', currentActiveGame.installer_storage_gib);
    setVal('game-main-progress', currentActiveGame.main_story_progress);
    setVal('game-side-progress', currentActiveGame.side_story_progress);
    setVal('game-full-progress', currentActiveGame.full_game_progress);
    setVal('game-runtime-platform', currentActiveGame.runtime_platform);
    setVal('game-original-platform', currentActiveGame.original_platform);
    setVal('game-patch-requirements', currentActiveGame.patch_requirements);

    const permRetElem = document.getElementById('game-permanent-retention');
    if (permRetElem) {
        permRetElem.checked = Boolean(currentActiveGame.parmanent_retention);
    }

    const tagsElem = document.getElementById('game-system-tags');
    if (tagsElem && Array.isArray(currentActiveGame.system_tags)) {
        Array.from(tagsElem.options).forEach(option => {
            option.selected = currentActiveGame.system_tags.includes(option.value);
        });
    }

    detailsPanel.classList.remove('open');
    formPanel.classList.add('open');
});

document.getElementById('close-form').addEventListener('click', () => {
    formPanel.classList.remove('open');
});

document.getElementById('save-game-btn').addEventListener('click', async () => {
    const form = document.getElementById('game-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData();
    
    // Helper to safely append fields
    const appendIfPresent = (id, fieldName, isNumber = false) => {
        const el = document.getElementById(id);
        if (el && el.value !== '') {
            formData.append(fieldName, isNumber ? Number(el.value) : el.value);
        }
    };

    appendIfPresent('game-name', 'name');
    appendIfPresent('game-publisher', 'publisher');
    appendIfPresent('game-year', 'year', true);
    appendIfPresent('game-rating', 'personal_rating', true);
    appendIfPresent('game-ownership', 'ownership');
    appendIfPresent('game-acquisition-status', 'acquisition_status');
    appendIfPresent('game-installer-state', 'installer_state');
    appendIfPresent('game-installation-state', 'installation_state');
    appendIfPresent('game-status', 'play_status');
    appendIfPresent('game-gamepad-support', 'gamepad_support');
    appendIfPresent('game-rent-platform', 'rent_platform');
    appendIfPresent('game-storage', 'game_storage_gib', true);
    appendIfPresent('game-installer-storage', 'installer_storage_gib', true);
    appendIfPresent('game-main-progress', 'main_story_progress', true);
    appendIfPresent('game-side-progress', 'side_story_progress', true);
    appendIfPresent('game-full-progress', 'full_game_progress', true);
    appendIfPresent('game-runtime-platform', 'runtime_platform');
    appendIfPresent('game-original-platform', 'original_platform');
    appendIfPresent('game-patch-requirements', 'patch_requirements');

    const permRetElem = document.getElementById('game-permanent-retention');
    if (permRetElem) {
        formData.append('parmanent_retention', permRetElem.checked);
    }

    const tagsElem = document.getElementById('game-system-tags');
    if (tagsElem) {
        const selectedTags = Array.from(tagsElem.selectedOptions).map(opt => opt.value);
        selectedTags.forEach(tag => formData.append('system_tags', tag));
    }

    const fileInput = document.getElementById('game-cover');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('cover', fileInput.files[0]);
    }

    const gameIdElem = document.getElementById('game-id');
    const gameId = gameIdElem ? gameIdElem.value : '';

    try {
        const btn = document.getElementById('save-game-btn');
        btn.innerText = 'Saving...';
        
        if (gameId) {
            await pb.collection('Games').update(gameId, formData);
        } else {
            await pb.collection('Games').create(formData);
        }
        
        formPanel.classList.remove('open');
        loadGames();
    } catch (error) {
        console.error('Error saving game:', error);
        alert('Failed to save game. Check console for details.');
    } finally {
        document.getElementById('save-game-btn').innerText = 'Save';
    }
});

// Boot
document.addEventListener("DOMContentLoaded", checkAuth);