import { 
    db, collection, doc, onSnapshot, getDoc, updateDoc, addDoc, serverTimestamp, query, where, orderBy 
} from './firebase-config.js';

// Elements
const formWalkin = document.getElementById('form-walkin');
const formBooking = document.getElementById('form-booking');
const setupView = document.getElementById('setup-view');
const liveView = document.getElementById('live-view');

let mySession = { token: null, docId: null };

// 1. JOIN WALK-IN QUEUE
formWalkin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = "Joining...";

    try {
        const name = document.getElementById('w-name').value;
        const docId = document.getElementById('w-doctor').value;

        const drRef = doc(db, "doctors", docId);
        const drSnap = await getDoc(drRef);
        const nextToken = (drSnap.data().lastToken || 0) + 1;

        await addDoc(collection(db, "patients"), {
            name, docId, token: nextToken, status: 'waiting', createdAt: serverTimestamp(), type: 'walk-in'
        });

        await updateDoc(drRef, { lastToken: nextToken });
        startTracking(nextToken, docId);
    } catch (err) {
        alert("Error joining queue. Please try again.");
        btn.disabled = false;
        btn.innerText = "Join Queue";
    }
});

// 2. BOOK APPOINTMENT
formBooking.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('b-name').value;
    const age = document.getElementById('b-age').value;
    const docId = document.getElementById('b-doctor').value;
    const date = document.getElementById('b-date').value;
    const time = document.getElementById('b-time').value;

    await addDoc(collection(db, "appointments"), {
        name, age, docId, date, time, status: 'scheduled', createdAt: serverTimestamp()
    });
    alert("Appointment Booked Successfully!");
    formBooking.reset();
});

// 3. TRACKING LOGIC
document.getElementById('btn-track').addEventListener('click', () => {
    const token = parseInt(document.getElementById('t-token').value);
    const docId = document.getElementById('w-doctor').value || "doc1"; 
    if(token) startTracking(token, docId);
    else alert("Please enter your token number.");
});

// 4. LEAVE QUEUE
document.getElementById('btn-leave').addEventListener('click', () => {
    if(confirm("Confirm: Leave the queue and discard your current token?")) {
        window.location.reload();
    }
});

function startTracking(token, docId) {
    mySession = { token, docId };
    
    // Hide nav and setup views
    if(setupView) setupView.style.display = 'none';
    const tabScroller = document.querySelector('.tab-scroller');
    if(tabScroller) tabScroller.style.display = 'none';
    
    if(liveView) liveView.classList.remove('hidden');
    
    document.getElementById('l-token').innerText = `#${token}`;
    
    // Listen for Doctor Updates
    onSnapshot(doc(db, "doctors", docId), (dSnap) => {
        const d = dSnap.data();
        const current = d.currentToken || 0;
        const pos = token - current;

        document.getElementById('l-doc').innerText = `DR. ${d.name}`;
        document.getElementById('l-serving').innerText = `#${current}`;
        const statusEl = document.getElementById('l-status');
        
        if (pos <= 0) {
            statusEl.innerText = "YOUR TURN!";
            statusEl.style.color = "#10b981";
            document.getElementById('l-pos').innerText = "0";
            document.getElementById('l-wait').innerText = "Now";
            
            if (Notification.permission === "granted") {
                new Notification("SmartClinic: It's your turn!", { body: `Please proceed to Dr. ${d.name}` });
            }
        } else {
            statusEl.innerText = "WAITING";
            statusEl.style.color = "#0ea5e9";
            document.getElementById('l-pos').innerText = pos;
            document.getElementById('l-wait').innerText = `${pos * 10}m`;
        }
    });
}

// Request notification permission on load
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}
