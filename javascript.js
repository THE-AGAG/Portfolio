const consentModal = document.getElementById('consent-modal');
const cguModal = document.getElementById('cgu-modal');

// Masquer si déjà accepté
if (localStorage.getItem('has_consented') === 'true') {
    consentModal.style.display = 'none';
}

document.getElementById('btn-accept').addEventListener('click', async () => {
    let userIP = "Inconnue";
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIP = data.ip;
    } catch (e) { console.error("Erreur IP"); }

    // Configuration HAUTE PRÉCISION
    const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => saveToFirebase(userIP, pos.coords.latitude, pos.coords.longitude),
            () => saveToFirebase(userIP, null, null),
            geoOptions
        );
    } else {
        saveToFirebase(userIP, null, null);
    }
});

// --- SAUVEGARDE UNIQUE (ÉVITE LES DOUBLONS) ---
async function saveToFirebase(ip, lat, lon) {
    const { doc, setDoc, GeoPoint } = window.dbUtils;
    
    // On utilise l'IP comme ID (en remplaçant les points pour Firestore)
    const customId = ip.replace(/\./g, "-");

    const logData = {
        ip: ip,
        derniere_visite: new Date().toLocaleString(),
        userAgent: navigator.userAgent,
        position: (lat && lon) ? new GeoPoint(lat, lon) : null,
        statut: (lat && lon) ? "GPS Précis" : "IP Seule"
    };

    try {
        // setDoc écrase l'ancien document s'il existe déjà avec cet ID (IP)
        const docRef = doc(window.db, "access_logs", customId);
        await setDoc(docRef, logData);
        
        localStorage.setItem('has_consented', 'true');
        localStorage.setItem('my_log_id', customId);
        localStorage.setItem('my_data', JSON.stringify(logData));
        
        consentModal.style.display = 'none';
    } catch (e) {
        console.error("Erreur Firebase:", e);
    }
}

// --- GESTION CGU & RGPD ---
const openCgu = (e) => { e.preventDefault(); cguModal.style.display = 'flex'; };
const closeCgu = () => cguModal.style.display = 'none';

document.getElementById('link-cgu-modal').addEventListener('click', openCgu);
document.getElementById('btn-open-cgu').addEventListener('click', openCgu);
document.getElementById('close-cgu').addEventListener('click', closeCgu);

document.getElementById('btn-download-data').addEventListener('click', () => {
    const data = localStorage.getItem('my_data');
    if (!data) return alert("Aucune donnée enregistrée.");
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "mes_donnees_agag.json"; a.click();
});

document.getElementById('btn-delete-data').addEventListener('click', async () => {
    const logId = localStorage.getItem('my_log_id');
    if (!logId) return alert("Rien à supprimer.");
    if (confirm("Supprimer vos données de notre base ?")) {
        try {
            await window.dbUtils.deleteDoc(window.dbUtils.doc(window.db, "access_logs", logId));
            localStorage.clear();
            alert("Données effacées."); location.reload();
        } catch (e) { alert("Erreur."); }
    }
});

// Refus
document.getElementById('btn-refuse').addEventListener('click', () => {
    window.location.href = "https://www.google.com";
});