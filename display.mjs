import { 
    db, collection, doc, onSnapshot, query, where, orderBy, limit 
} from './firebase-config.js';

// DOM Elements
const heroTokenEl = document.getElementById('hero-token');
const heroDoctorEl = document.getElementById('hero-doctor');
const nextTokensContainer = document.getElementById('next-tokens-container');
const doctorsStatusContainer = document.getElementById('doctors-status-container');
const bottomAlertEl = document.getElementById('bottom-alert-text');
const alertSound = document.getElementById('alert-sound');

// Local State
let doctorsState = {}; 
let isFirstLoad = true;
let audioUnlocked = false;

window.moduleLoaded = true;
const connStatusEl = document.getElementById('connection-status');
if (connStatusEl) {
    connStatusEl.textContent = 'CONNECTED';
    connStatusEl.classList.add('active');
}

console.log("Display Dashboard Script Initializing...");

// Audio Unlock Logic
document.addEventListener('click', () => {
    if (!audioUnlocked) {
        alertSound.play().then(() => {
            alertSound.pause();
            alertSound.currentTime = 0;
            audioUnlocked = true;
            console.log("Audio Unlocked successfully");
        }).catch(e => {
            console.error("Audio unlock failed manually:", e);
        });
    }
}, { once: true });

// 1. SYNC DOCTORS
onSnapshot(collection(db, "doctors"), (snapshot) => {
    console.log("Doctors Snapshot Received. Count:", snapshot.size);
    let html = '';
    let latestUpdate = null;

    snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        
        // Detect Change for Hero Section & Sound
        if (!isFirstLoad && doctorsState[id] && doctorsState[id].currentToken !== d.currentToken && d.currentToken > 0) {
            console.log(`Token change detected for ${d.name}: ${d.currentToken}`);
            latestUpdate = { token: d.currentToken, doctor: d.name };
            triggerAlert(d.currentToken, d.name);
        }

        // Update state
        doctorsState[id] = { ...d, id };

        // Build Row 3 (Doctor Status Grid)
        html += `
            <div class="status-card">
                <div class="doc-meta">
                    <div class="name">Dr. ${d.name}</div>
                    <div class="info">${d.specialty || 'OPD Specialist'} &bull; ${d.status || 'Active'}</div>
                </div>
                <div class="current-val">#${d.currentToken || '--'}</div>
            </div>
        `;
    });

    if (doctorsStatusContainer) doctorsStatusContainer.innerHTML = html;

    // If we have a latest update, show in Hero
    if (latestUpdate) {
        updateHero(latestUpdate.token, latestUpdate.doctor);
    } else if (isFirstLoad) {
        const firstWithToken = Object.values(doctorsState).find(doc => (doc.currentToken || 0) > 0);
        if (firstWithToken) {
            updateHero(firstWithToken.currentToken, firstWithToken.name);
        }
        isFirstLoad = false;
    }
}, (error) => {
    console.error("Doctors Subscription Error:", error);
    bottomAlertEl.textContent = "DATABASE ERROR: CHECK DOCTORS TABLE";
});

// 2. SYNC NEXT QUEUE (Global Waiting List)
// We try to use orderBy, but handle error if index is missing
function initPatientsListener(useOrderBy = true) {
    let q;
    if (useOrderBy) {
        q = query(
            collection(db, "patients"), 
            where("status", "==", "waiting"),
            orderBy("createdAt", "asc"),
            limit(5)
        );
    } else {
        // Fallback for missing index
        q = query(
            collection(db, "patients"), 
            where("status", "==", "waiting"),
            limit(5)
        );
    }

    onSnapshot(q, (snapshot) => {
        console.log("Patients Snapshot Received. Count:", snapshot.size);
        let nextHtml = '';

        snapshot.forEach(pSnap => {
            const p = pSnap.data();
            const docId = p.docId;
            const docInfo = doctorsState[docId] || Object.values(doctorsState).find(d => d.id === docId);
            const docName = docInfo ? `Dr. ${docInfo.name}` : 'Clinic';

            nextHtml += `
                <div class="next-card">
                    <div class="token">#${p.token}</div>
                    <div class="doctor">${docName}</div>
                </div>
            `;
        });

        // Fill empty slots if less than 5
        const count = snapshot.size;
        for (let i = count; i < 5; i++) {
            nextHtml += `<div class="next-card" style="opacity: 0.3"><div class="token">--</div><div class="doctor">...</div></div>`;
        }

        if (nextTokensContainer) nextTokensContainer.innerHTML = nextHtml;
    }, (error) => {
        console.warn("Patients Subscription Error (likely missing index):", error);
        if (useOrderBy && error.code === 'failed-precondition') {
            console.log("Retrying patients listener without orderBy...");
            if (bottomAlertEl) bottomAlertEl.textContent = "OPTIMIZING QUEUE VIEW...";
            initPatientsListener(false);
        } else {
            if (bottomAlertEl) bottomAlertEl.textContent = "DATABASE ERROR: CHECK PATIENTS TABLE";
            if (connStatusEl) {
                connStatusEl.textContent = 'DB ERROR';
                connStatusEl.classList.remove('active');
                connStatusEl.style.background = '#ef4444';
            }
        }
    });
}

initPatientsListener();

// Helper Functions
function updateHero(token, doctorName) {
    if (heroTokenEl) heroTokenEl.textContent = `#${token}`;
    if (heroDoctorEl) heroDoctorEl.textContent = `Dr. ${doctorName}`;
    if (bottomAlertEl) bottomAlertEl.textContent = `TOKEN ${token} → DR. ${doctorName.toUpperCase()}`;
}

function triggerAlert(token, doctorName) {
    if (audioUnlocked && alertSound) {
        alertSound.currentTime = 0;
        alertSound.play().catch(e => console.log("Audio play blocked during trigger:", e));
    }
    console.log(`Alert: Token ${token} called by Dr. ${doctorName}`);
}
