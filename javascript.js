document.addEventListener("DOMContentLoaded", () => {
    const consentModal = document.getElementById('consent-modal');
    const cguModal = document.getElementById('cgu-modal');

    // 1. Vérifier si déjà accepté
    if (localStorage.getItem('has_consented') === 'true') {
        consentModal.style.display = 'none';
    }

    // 2. Bouton ACCEPTER
    document.getElementById('btn-accept').addEventListener('click', async () => {
        let userIP = "Inconnue";
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            userIP = data.ip;
        } catch (e) { console.error("Erreur IP"); }

        const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

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

    // 3. Sauvegarde Firebase (Unique par IP)
    async function saveToFirebase(ip, lat, lon) {
        const { doc, setDoc, GeoPoint } = window.dbUtils;
        const customId = ip.replace(/\./g, "-");

        const logData = {
            ip: ip,
            derniere_visite: new Date().toLocaleString(),
            userAgent: navigator.userAgent,
            position: (lat && lon) ? new GeoPoint(lat, lon) : null
        };

        try {
            await setDoc(doc(window.db, "access_logs", customId), logData);
            localStorage.setItem('has_consented', 'true');
            localStorage.setItem('my_log_id', customId);
            localStorage.setItem('my_data', JSON.stringify(logData));
            consentModal.style.display = 'none';
        } catch (e) {
            alert("Erreur Firebase : Vérifiez vos clés et vos règles.");
        }
    }

    // 4. Gestion CGU & Outils
    const toggleCGU = (show) => cguModal.style.display = show ? 'flex' : 'none';
    
    document.getElementById('btn-open-cgu').addEventListener('click', () => toggleCGU(true));
    document.getElementById('link-cgu-modal').addEventListener('click', (e) => { e.preventDefault(); toggleCGU(true); });
    document.getElementById('close-cgu').addEventListener('click', () => toggleCGU(false));

    // Télécharger
    document.getElementById('btn-download-data').addEventListener('click', () => {
        const data = localStorage.getItem('my_data');
        if (!data) return alert("Pas de données.");
        const blob = new Blob([data], { type: "application/json" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "mes_donnees.json";
        a.click();
    });

    // Supprimer (Réinitialise tout)
    document.getElementById('btn-delete-data').addEventListener('click', async () => {
        const logId = localStorage.getItem('my_log_id');
        if (logId && confirm("Supprimer vos données ?")) {
            try {
                await window.dbUtils.deleteDoc(window.dbUtils.doc(window.db, "access_logs", logId));
                localStorage.clear();
                location.reload();
            } catch (e) { alert("Erreur."); }
        }
    });

    document.getElementById('btn-refuse').addEventListener('click', () => {
        window.location.href = "https://www.google.com";
    });
});