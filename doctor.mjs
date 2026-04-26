import { 
    db, collection, doc, onSnapshot, getDoc, getDocs, updateDoc, 
    query, where, orderBy, limit, serverTimestamp 
} from './firebase-config.js';

const urlParams = new URLSearchParams(window.location.search);
const doctorId = urlParams.get('id') || 'doc1';

console.log("Doctor Terminal active for ID:", doctorId);

// Element Cache
const mainToken = document.getElementById('main-token');
const mainName = document.getElementById('main-name');
const docTitle = document.getElementById('doc-title');
const queueTable = document.getElementById('queue-table');
const bookingList = document.getElementById('booking-list');
const timerVal = document.getElementById('consultation-timer');
const servedCount = document.getElementById('stat-served');
const skippedCount = document.getElementById('stat-skipped');
const statusControl = document.getElementById('doc-status-control');
const notifSound = document.getElementById('notif-sound');

let doctorData = { avgConsultationTime: 10 };
let timerSeconds = 0;
let currentPatientId = null;

// 1. SYNC DOCTOR BASE DATA
onSnapshot(doc(db, "doctors", doctorId), (snap) => {
    if(!snap.exists()) {
        console.error("Doctor not found in database!");
        return;
    }
    doctorData = snap.data();
    docTitle.innerText = `Dr. ${doctorData.name}`;
    mainToken.innerText = `#${doctorData.currentToken || 0}`;
    if(statusControl) statusControl.value = doctorData.status || 'available';
});

// 2. LIVE QUEUE, ANALYTICS & HISTORY
const historyList = document.getElementById('doctor-history-list');

onSnapshot(query(collection(db, "patients"), where("docId", "==", doctorId)), (snap) => {
    queueTable.innerHTML = '';
    if(historyList) historyList.innerHTML = '';
    
    let waitingNum = 0;
    let servedNum = 0;
    let skippedNum = 0;

    // Sort to keep history in order
    const patients = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                             .sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    patients.forEach(p => {
        if (p.status === 'waiting') {
            waitingNum++;
            const row = `
                <tr>
                    <td data-label="Token"><strong>#${p.token}</strong></td>
                    <td data-label="Patient">${p.name}</td>
                    <td data-label="Wait">${waitingNum * (doctorData.avgConsultationTime || 10)}m</td>
                    <td data-label="Status"><span class="badge badge-waiting">Waiting</span></td>
                </tr>`;
            queueTable.insertAdjacentHTML('afterbegin', row); // Keep oldest at top
        } else if (p.status === 'serving') {
            mainName.innerText = p.name;
            mainToken.innerText = `#${p.token}`;
            currentPatientId = p.id;
        } else if (p.status === 'served' || p.status === 'skipped') {
            if(p.status === 'served') servedNum++; else skippedNum++;
            
            // Add to History list
            if(historyList) {
                historyList.innerHTML += `
                    <div class="token-item" style="padding: 10px; font-size: 0.85rem; border-left: 4px solid ${p.status === 'served' ? '#10b981' : '#ef4444'}">
                        <strong>#${p.token} - ${p.name}</strong><br>
                        <small class="text-muted">${p.status.toUpperCase()}</small>
                    </div>
                `;
            }
        }
    });

    servedCount.innerText = servedNum;
    skippedCount.innerText = skippedNum;
});

// 3. APPOINTMENTS (STRICT FILTER)
onSnapshot(query(collection(db, "appointments"), where("docId", "==", doctorId)), (snapshot) => {
    if(!bookingList) return;
    bookingList.innerHTML = '';
    snapshot.forEach(docSnap => {
        const a = docSnap.data();
        bookingList.innerHTML += `
            <div class="token-item" style="border-left: 4px solid var(--warning); padding: 10px;">
                <strong>${a.name}</strong><br>
                <small>${a.date} | ${a.time}</small>
            </div>
        `;
    });
});

// 4. ACTIONS
document.getElementById('btn-next').addEventListener('click', async () => {
    try {
        // A. Finish Current Patient
        if (currentPatientId) {
            await updateDoc(doc(db, "patients", currentPatientId), { status: 'served' });
        }

        // B. Call Next Patient (FIFO - Index Free)
        const q = query(collection(db, "patients"), where("docId", "==", doctorId), where("status", "==", "waiting"));
        const snap = await getDocs(q);

        if (snap.empty) {
            alert("No more patients waiting.");
            mainName.innerText = "Queue Empty";
            mainToken.innerText = "#00";
            currentPatientId = null;
            return;
        }

        // Sort by time in code to avoid index error
        const nextP = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                               .sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0))[0];

        await updateDoc(doc(db, "patients", nextP.id), { status: 'serving' });
        await updateDoc(doc(db, "doctors", doctorId), { currentToken: nextP.token });
        
        timerSeconds = 0;
        if(notifSound) notifSound.play().catch(() => {});
    } catch (err) {
        alert("Action Error: " + err.message);
    }
});

document.getElementById('btn-complete').addEventListener('click', async () => {
    try {
        if (currentPatientId) {
            await updateDoc(doc(db, "patients", currentPatientId), { status: 'served' });
            mainName.innerText = "Session Finished";
            mainToken.innerText = "#--";
            currentPatientId = null;
            timerSeconds = 0;
        } else {
            alert("No active patient to complete.");
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
});

document.getElementById('btn-call').addEventListener('click', () => {
    if(notifSound) notifSound.play().catch(() => {});
});

document.getElementById('btn-skip').addEventListener('click', async () => {
    try {
        if (currentPatientId) {
            await updateDoc(doc(db, "patients", currentPatientId), { status: 'skipped' });
            alert("Patient marked as SKIPPED. Click NEXT to call the next person.");
            mainName.innerText = "Skipped";
            currentPatientId = null;
        }
    } catch (err) {
        alert("Error skipping patient: " + err.message);
    }
});

if(statusControl) {
    statusControl.addEventListener('change', async (e) => {
        await updateDoc(doc(db, "doctors", doctorId), { status: e.target.value });
    });
}
